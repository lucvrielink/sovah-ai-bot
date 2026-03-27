import fs from "fs";
import path from "path";

// CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://sovahcare.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// Load catalogs
const bundlesPath = path.join(process.cwd(), "data", "bundle_catalog.json");
const productsPath = path.join(process.cwd(), "data", "product_catalog.json");

const BUNDLES_JSON = fs.readFileSync(bundlesPath, "utf8");
const PRODUCTS_JSON = fs.readFileSync(productsPath, "utf8");

type SkinType = "dry" | "oily" | "combination" | "normal" | "sensitive";
type Goal = "hydration" | "glow" | "antiage" | "breakouts" | "simple";

type Bundle = {
  name: string;
  url: string;
  description?: string;
  products?: string[];
};

type Product = {
  title: string;
  handle: string;
  url: string;
  first_available_variant_id?: number;
  source_tags?: string[];
  short_copy_nl?: string;
  short_copy_en?: string;
};

type BundleCatalog = {
  bundles: Bundle[];
};

type ProductCatalog = {
  products: Product[];
};

type ChatAction = {
  type: "OPEN_URL";
  label: string;
  url: string;
};

type ConversationIntent =
  | "greeting"
  | "thanks"
  | "bye"
  | "help"
  | "yes"
  | "no"
  | "confused"
  | "unclear"
  | "human_chat"
  | null;

const bundleCatalog: BundleCatalog = JSON.parse(BUNDLES_JSON);
const productCatalog: ProductCatalog = JSON.parse(PRODUCTS_JSON);

function normalize(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[^\w\s&+-]/g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function hasExactWord(text: string, words: string[]): boolean {
  return words.some((word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|\\s)${escaped}(\\s|$)`, "i");
    return pattern.test(text);
  });
}

function normalizeLoose(text: string): string {
  return normalize(text).replace(/[-+&]/g, " ").replace(/\s+/g, " ").trim();
}

function detectSkinType(text: string): SkinType | null {
  const t = normalize(text);

  if (
    hasAny(t, [
      "combination",
      "combo skin",
      "combo",
      "combi skin",
      "combi",
      "oily t zone",
      "oily in some areas",
      "dry in others",
    ])
  ) {
    return "combination";
  }

  if (
    hasAny(t, [
      "sensitive",
      "sensetive",
      "reactive",
      "redness prone",
      "irritated",
      "skin barrier",
      "barrier",
    ])
  ) {
    return "sensitive";
  }

  if (
    hasAny(t, [
      "oily",
      "oilly",
      "oilie",
      "shiny",
      "greasy",
      "oil prone",
    ])
  ) {
    return "oily";
  }

  if (
    hasAny(t, [
      "dry",
      "dehydrated",
      "dehydration",
      "tight",
      "flaky",
      "rough",
    ])
  ) {
    return "dry";
  }

  if (hasAny(t, ["normal", "balanced skin", "balanced"])) {
    return "normal";
  }

  return null;
}

function detectGoal(text: string): Goal | null {
  const t = normalize(text);

  if (
    hasAny(t, [
      "breakout",
      "breakouts",
      "brakouts",
      "acne",
      "blemish",
      "blemishes",
      "spots",
      "pimples",
      "blackheads",
      "clogged pores",
    ])
  ) {
    return "breakouts";
  }

  if (
    hasAny(t, [
      "glow",
      "glowy",
      "radiance",
      "radiant",
      "dull",
      "bright",
      "brighter",
      "uneven",
      "texture",
      "pores",
      "fresh look",
      "more glow",
    ])
  ) {
    return "glow";
  }

  if (
    hasAny(t, [
      "hydration",
      "hydrate",
      "hydrating",
      "moisture",
      "more moisture",
      "comfort",
    ])
  ) {
    return "hydration";
  }

  if (
    hasAny(t, [
      "anti age",
      "anti-age",
      "antiage",
      "anti aging",
      "anti-aging",
      "ageing",
      "aging",
      "fine lines",
      "firmness",
      "wrinkles",
      "smoothness",
      "early aging",
    ])
  ) {
    return "antiage";
  }

  if (
    hasAny(t, [
      "simple",
      "minimal",
      "easy routine",
      "no fuss",
      "no-fuss",
      "basic routine",
      "easy",
    ])
  ) {
    return "simple";
  }

  return null;
}

function detectRoutineRequest(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "which routine fits me best",
    "what routine fits me best",
    "best routine for me",
    "which routine",
    "what routine",
    "fits me best",
    "help me choose",
    "what do you recommend",
    "recommend me a routine",
    "recommend a routine",
  ]);
}

function detectConversationIntent(text: string): ConversationIntent {
  const t = normalize(text);

  if (
    hasExactWord(t, ["hello", "hi", "hey", "hallo", "yo"]) ||
    hasAny(t, ["good morning", "good afternoon", "good evening"])
  ) {
    return "greeting";
  }

  if (
    hasAny(t, [
      "thanks",
      "thank you",
      "thx",
      "ty",
      "bedankt",
      "dankje",
      "dankjewel",
      "top thanks",
    ])
  ) {
    return "thanks";
  }

  if (
    hasAny(t, [
      "bye",
      "goodbye",
      "see you",
      "later",
      "doei",
      "cya",
    ])
  ) {
    return "bye";
  }

  if (
    hasAny(t, [
      "help",
      "can you help me",
      "what can you do",
      "how can you help",
      "wat kan je",
      "wat kun je",
    ])
  ) {
    return "help";
  }

  if (hasExactWord(t, ["yes", "yeah", "yep", "sure", "okay", "ok", "oke", "alright"])) {
    return "yes";
  }

  if (hasExactWord(t, ["no", "nope", "nah", "nee"])) {
    return "no";
  }

  if (
    hasAny(t, [
      "i dont know",
      "i don't know",
      "idk",
      "not sure",
      "confused",
      "ik weet het niet",
      "geen idee",
    ])
  ) {
    return "confused";
  }

  if (
    hasAny(t, [
      "huh",
      "hmm",
      "uh",
      "umm",
      "lol",
      "random",
      "weird",
      "my skin is weird",
      "not sure what i need",
      "i need help but dont know with what",
    ])
  ) {
    return "unclear";
  }

  if (
    hasAny(t, [
      "how are you",
      "you there",
      "are you real",
      "can we talk",
      "talk to me",
    ])
  ) {
    return "human_chat";
  }

  return null;
}

function buildConversationReply(intent: ConversationIntent): string | null {
  if (intent === "greeting") return "Hello! How can I help you today?";
  if (intent === "thanks") return "You’re welcome.";
  if (intent === "bye") return "Goodbye.";
  if (intent === "help") {
    return "I can help you find the right routine, suggest products, compare options, or match your skin type and main goal.";
  }
  if (intent === "yes") {
    return "Great. Tell me your skin type and your main goal, and I’ll help from there.";
  }
  if (intent === "no") {
    return "No problem. Tell me what you want help with, and I’ll keep it simple.";
  }
  if (intent === "confused") {
    return "That’s okay. Start with your skin type and your main goal, and I’ll help you narrow it down.";
  }
  if (intent === "unclear") {
    return "I’m not fully sure what you mean yet. Tell me your skin type and your main goal, and I’ll help you from there.";
  }
  if (intent === "human_chat") {
    return "Yes — I’m here. Tell me what you want help with.";
  }
  return null;
}

function getBundleByName(name: string): Bundle | undefined {
  return bundleCatalog.bundles.find((bundle) => bundle.name === name);
}

function getProductByName(name: string): Product | undefined {
  return productCatalog.products.find((product) => product.title === name);
}

function findMentionedProducts(text: string): Product[] {
  const t = normalizeLoose(text);
  return productCatalog.products.filter((product) => {
    const name = normalizeLoose(product.title);
    return t.includes(name);
  });
}

function findMentionedBundles(text: string): Bundle[] {
  const t = normalizeLoose(text);
  return bundleCatalog.bundles.filter((bundle) => {
    const name = normalizeLoose(bundle.name);
    return t.includes(name);
  });
}

function detectCompareRequest(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "compare",
    "difference",
    "what is better",
    "which is better",
    "vs",
    "versus",
  ]);
}

function detectSuitabilityRequest(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "is this good for",
    "is it good for",
    "good for",
    "suitable for",
    "can i use",
    "would this work for",
    "is this okay for",
  ]);
}

function pickBundle(skinType: SkinType | null, goal: Goal | null): Bundle | undefined {
  if (!goal) return undefined;

  if (goal === "breakouts") {
    if (skinType === "oily" || skinType === "combination") {
      return getBundleByName("Clear & Balanced Skin Routine");
    }
    if (skinType === "sensitive") {
      return getBundleByName("Sensitive & Reactive Skin Routine");
    }
    if (skinType === "dry") {
      return getBundleByName("Dry & Dehydrated Skin Routine");
    }
    if (skinType === "normal") {
      return getBundleByName("Clear & Balanced Skin Routine");
    }
    return undefined;
  }

  if (goal === "glow") return getBundleByName("Glow & Radiance Routine");
  if (goal === "antiage") return getBundleByName("Firm & Smooth Skin Routine");
  if (goal === "simple") return getBundleByName("Simple Daily Skincare Routine");

  if (goal === "hydration") {
    if (skinType === "sensitive") return getBundleByName("Sensitive & Reactive Skin Routine");
    if (skinType === "combination") return getBundleByName("Combination Skin Balance Routine");
    return getBundleByName("Dry & Dehydrated Skin Routine");
  }

  return undefined;
}

function pickAddon(skinType: SkinType | null, goal: Goal | null): string | null {
  if (!goal) return null;
  if (goal === "breakouts") return "Acne Spot Care";
  if (goal === "antiage") return "Smoothing Eye Cream";
  if (goal === "glow" && skinType !== "sensitive") return "AHA Peeling Concentrate";
  return null;
}

function shortBundleDescription(bundleName: string): string {
  const map: Record<string, string> = {
    "Dry & Dehydrated Skin Routine": "Best for dry or dehydrated skin that needs comfort and hydration.",
    "Combination Skin Balance Routine": "Best for combination skin that needs balance without feeling heavy.",
    "Simple Daily Skincare Routine": "Best for an easy everyday routine with no unnecessary steps.",
    "Sensitive & Reactive Skin Routine": "Best for sensitive or reactive skin that needs a gentle routine.",
    "Normal & Balanced Skin Routine": "Best for normal skin that wants a simple balanced routine.",
    "Glow & Radiance Routine": "Best for dull or uneven-looking skin that wants more glow.",
    "Firm & Smooth Skin Routine": "Best for early signs of aging, smoothness, and firmness.",
    "Clear & Balanced Skin Routine": "Best for oily or blemish-prone skin that needs a fresh lightweight routine.",
  };

  return map[bundleName] || "A strong fit from the current range.";
}

function shortAddonDescription(addonName: string): string {
  const map: Record<string, string> = {
    "AHA Peeling Concentrate": "A good add-on for texture or dullness.",
    "Acne Spot Care": "A good add-on for visible blemishes.",
    "Smoothing Eye Cream": "A good add-on for the eye area.",
  };

  return map[addonName] || "";
}

function shortProductDescription(productName: string): string {
  const map: Record<string, string> = {
    "Micellar Cleansing Water": "A gentle everyday cleanser.",
    "Hydrating Toner": "A hydrating toner for comfort and balance.",
    "Hydrating Serum": "A lightweight serum for extra hydration.",
    "Double Hydration Boost Gel + HA": "A hydrating gel for a more comfortable skin feel.",
    "Moisturising Day Cream": "A day cream for daily hydration and comfort.",
    "Ceramide Barrier Night Cream": "A rich night cream for comfort and barrier support.",
    "Purifying Mousse": "A foaming cleanser with a fresh, lightweight feel.",
    "Antioxidant Ginkgo Gel Booster": "A lightweight booster for hydration and a fresher look.",
    "Calming Facial Oil": "A calming facial oil for comfort and softness.",
    "AHA Peeling Concentrate": "An exfoliating add-on for texture or dullness.",
    "Caffeine Gel Booster": "A lightweight booster for a fresher-looking complexion.",
    "Oil-Free Hydrating Gel": "An oil-free gel for lightweight daily hydration.",
    "Peptide Anti-Aging Serum": "A serum for a smoother-looking complexion.",
    "Collagen Boost Serum": "A serum focused on firmness and comfort.",
    "Anti-Age Day Cream": "A day cream with an early anti-age focus.",
    "Natural Retinol Alternative Oil Serum": "A gentle oil serum for an anti-age routine.",
    "Smoothing Eye Cream": "An eye cream for the eye area.",
    "Vitamin C Serum": "A serum for a fresher and more radiant-looking complexion.",
    "Brightening Face&Body Exfoliator with Kojic Acid": "An exfoliator for a smoother and fresher look.",
    "Dark Spot Face Cream with Kojic Acid": "A cream for a more even-looking complexion.",
    "All-In-One Facial Oil": "A nourishing facial oil for glow and comfort.",
    "Sun Protection SPF50 Stick, no tint": "An SPF50 stick for easy daily protection.",
    "Acne Spot Care": "A targeted spot treatment for visible blemishes.",
    "Niacinamide Gel Moisturiser": "A lightweight gel moisturiser for balance and comfort.",
  };

  return map[productName] || "A product from the current SOVAH range.";
}

function buildBundleReply(bundle: Bundle, addonName?: string | null): string {
  const parts: string[] = [];

  parts.push(`**${bundle.name}**`);
  parts.push(shortBundleDescription(bundle.name));

  if (bundle.products?.length) {
    parts.push(
      `Included products:\n${bundle.products.map((product) => `- ${product}`).join("\n")}`
    );
  }

  if (addonName) {
    parts.push(`Add-on\n**${addonName}**\n${shortAddonDescription(addonName)}`);
  }

  return parts.join("\n\n");
}

function buildProductReply(product: Product): string {
  return `**${product.title}**\n\n${shortProductDescription(product.title)}`;
}

function buildCompareReply(items: (Bundle | Product)[]): string {
  const first = items[0];
  const second = items[1];

  const firstName = "name" in first ? first.name : first.title;
  const secondName = "name" in second ? second.name : second.title;

  return `**${firstName}** vs **${secondName}**\n\nTell me your skin type and main goal, and I’ll tell you which one fits better.`;
}

function buildActionsForBundle(bundle: Bundle, addonName?: string | null): ChatAction[] {
  const actions: ChatAction[] = [
    {
      type: "OPEN_URL",
      label: "View routine",
      url: bundle.url,
    },
  ];

  if (addonName) {
    const addon = getProductByName(addonName);
    if (addon) {
      actions.push({
        type: "OPEN_URL",
        label: "View product",
        url: addon.url,
      });
    }
  }

  return actions.slice(0, 2);
}

function buildActionsForProduct(product: Product): ChatAction[] {
  return [
    {
      type: "OPEN_URL",
      label: "View product",
      url: product.url,
    },
  ];
}

function askSkinType(): string {
  return "What’s your skin type: dry, oily, combination, normal, or sensitive?";
}

function askGoal(): string {
  return "What’s your main goal: hydration, glow, anti-age, breakouts, or simple routine?";
}

function inferBestBundleForProduct(productTitle: string): Bundle | undefined {
  const map: Record<string, string> = {
    "Hydrating Toner": "Dry & Dehydrated Skin Routine",
    "Hydrating Serum": "Dry & Dehydrated Skin Routine",
    "Purifying Mousse": "Clear & Balanced Skin Routine",
    "Vitamin C Serum": "Glow & Radiance Routine",
    "Collagen Boost Serum": "Firm & Smooth Skin Routine",
    "Peptide Anti-Aging Serum": "Firm & Smooth Skin Routine",
    "Anti-Age Day Cream": "Firm & Smooth Skin Routine",
    "Calming Facial Oil": "Sensitive & Reactive Skin Routine",
    "Niacinamide Gel Moisturiser": "Combination Skin Balance Routine",
    "Acne Spot Care": "Clear & Balanced Skin Routine",
  };

  const bundleName = map[productTitle];
  return bundleName ? getBundleByName(bundleName) : undefined;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message: string | undefined = body?.message;
    const historyRaw: unknown = body?.history;

    const history: string[] = Array.isArray(historyRaw)
      ? historyRaw.filter((item): item is string => typeof item === "string")
      : [];

    if (!message) {
      return new Response(
        JSON.stringify({
          reply: "Missing message.",
          actions: [],
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const conversationIntent = detectConversationIntent(message);
    const conversationReply = buildConversationReply(conversationIntent);

    if (conversationReply) {
      return new Response(
        JSON.stringify({
          reply: conversationReply,
          actions: [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const fullHistory = [...history, message].slice(-10);
    const combined = fullHistory.join(" \n ");

    const wantsRoutine = fullHistory.some((m) => detectRoutineRequest(m));
    const skinType = detectSkinType(combined);
    const goal = detectGoal(combined);

    const mentionedProducts = findMentionedProducts(combined);
    const mentionedBundles = findMentionedBundles(combined);

    if (detectCompareRequest(message)) {
      const compareItems = [...mentionedBundles, ...mentionedProducts].slice(0, 2);
      if (compareItems.length === 2) {
        return new Response(
          JSON.stringify({
            reply: buildCompareReply(compareItems),
            actions: [],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }

    if (detectSuitabilityRequest(message) && mentionedProducts.length === 1) {
      const product = mentionedProducts[0];
      return new Response(
        JSON.stringify({
          reply: `**${product.title}**\n\n${shortProductDescription(product.title)}\n\nTell me your skin type and goal, and I’ll tell you if it fits.`,
          actions: buildActionsForProduct(product),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (mentionedProducts.length === 1 && !wantsRoutine && !goal && !skinType) {
      const product = mentionedProducts[0];
      const bundle = inferBestBundleForProduct(product.title);

      return new Response(
        JSON.stringify({
          reply: bundle
            ? `**${product.title}**\n\n${shortProductDescription(product.title)}\n\nIf you want the fuller routine, **${bundle.name}** is the closest match.`
            : buildProductReply(product),
          actions: bundle
            ? [
                ...buildActionsForProduct(product),
                { type: "OPEN_URL", label: "View routine", url: bundle.url },
              ].slice(0, 2)
            : buildActionsForProduct(product),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (mentionedBundles.length === 1 && !goal && !skinType && !wantsRoutine) {
      const bundle = mentionedBundles[0];
      return new Response(
        JSON.stringify({
          reply: buildBundleReply(bundle, null),
          actions: buildActionsForBundle(bundle, null),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (wantsRoutine && !skinType) {
      return new Response(
        JSON.stringify({
          reply: askSkinType(),
          actions: [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (wantsRoutine && skinType && !goal) {
      return new Response(
        JSON.stringify({
          reply: askGoal(),
          actions: [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (goal === "breakouts" && !skinType) {
      return new Response(
        JSON.stringify({
          reply: askSkinType(),
          actions: [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!wantsRoutine && detectSkinType(message) && !goal) {
      return new Response(
        JSON.stringify({
          reply: askGoal(),
          actions: [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const bundle = pickBundle(skinType, goal);
    const addon = pickAddon(skinType, goal);

    if (bundle) {
      return new Response(
        JSON.stringify({
          reply: buildBundleReply(bundle, addon),
          actions: buildActionsForBundle(bundle, addon),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    return new Response(
      JSON.stringify({
        reply: "I’m not fully sure what you mean yet. Tell me your skin type and your main goal, and I’ll help you from there.",
        actions: [],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (e: unknown) {
    console.error("SOVAH /api/chat error:", e);

    return new Response(
      JSON.stringify({
        reply: "Sorry, something went wrong. Try again later.",
        actions: [],
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
}
