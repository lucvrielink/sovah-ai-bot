import OpenAI from "openai";
import fs from "fs";
import path from "path";

// CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://sovahcare.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// Load catalogs
const bundlesPath = path.join(process.cwd(), "data", "bundle_catalog.json");
const productsPath = path.join(process.cwd(), "data", "product_catalog.json");

const BUNDLES_JSON = fs.readFileSync(bundlesPath, "utf8");
const PRODUCTS_JSON = fs.readFileSync(productsPath, "utf8");

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

const bundleCatalog: BundleCatalog = JSON.parse(BUNDLES_JSON);
const productCatalog: ProductCatalog = JSON.parse(PRODUCTS_JSON);

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SOVAH_SYSTEM_PROMPT = `
You are the SOVAH skincare assistant for sovahcare.com.

Your role:
- help the user find the best SOVAH routine or add-on
- think internally
- keep replies short, warm, clear, and premium

Rules:
- never mention suppliers or private label partners
- never make medical claims or diagnoses
- only use the provided BUNDLES JSON and PRODUCTS JSON
- do not include raw URLs
- do not include AM/PM steps
- do not explain ingredients
- do not explain each product in detail
- do not overload the user
- if the user is unclear, ask only the next missing question

Important logic:
- if the user asks which routine fits them best, do not recommend immediately unless both skin type and main goal are clear
- if only skin type is known, ask for the main goal
- if only main goal is known, ask for the skin type
- if the user mentions breakouts but skin type is unclear, ask skin type first
- only recommend once the match is clear

When you have enough information:
- recommend 1 best-fit bundle
- give 1 short sentence about what it is best for
- list included product names only
- mention max 1 add-on if clearly relevant
- give 1 short sentence about what the add-on is for
- end with 1 short next step

BUNDLES JSON:
${BUNDLES_JSON}

PRODUCTS JSON:
${PRODUCTS_JSON}
`;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsExactName(text: string, name: string): boolean {
  const pattern = new RegExp(`(^|[^\\w&+-])${escapeRegExp(name)}([^\\w&+-]|$)`, "i");
  return pattern.test(text);
}

function hasAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function findMentionedBundles(text: string): Bundle[] {
  return bundleCatalog.bundles.filter((bundle) => containsExactName(text, bundle.name));
}

function detectAddonFromText(text: string): string | null {
  if (text.includes("AHA Peeling Concentrate")) return "AHA Peeling Concentrate";
  if (text.includes("Acne Spot Care")) return "Acne Spot Care";
  if (text.includes("Smoothing Eye Cream")) return "Smoothing Eye Cream";
  return null;
}

function detectSkinType(
  message: string
): "dry" | "oily" | "combination" | "normal" | "sensitive" | null {
  const t = (message || "").toLowerCase();

  if (t.includes("combination")) return "combination";
  if (t.includes("sensitive") || t.includes("reactive")) return "sensitive";
  if (t.includes("oily") || t.includes("shiny")) return "oily";
  if (t.includes("dry") || t.includes("dehydrated")) return "dry";
  if (t.includes("normal")) return "normal";

  return null;
}

function detectGoal(
  message: string
): "hydration" | "glow" | "antiage" | "breakouts" | "simple" | null {
  const t = (message || "").toLowerCase();

  if (hasAny(t, ["breakout", "breakouts", "acne", "blemish", "blemishes", "spots", "pimples", "blackheads"])) {
    return "breakouts";
  }
  if (hasAny(t, ["glow", "radiance", "dull", "bright", "brighter", "uneven", "texture", "pores"])) {
    return "glow";
  }
  if (hasAny(t, ["hydration", "hydrate", "moisture"])) {
    return "hydration";
  }
  if (hasAny(t, ["anti-age", "anti aging", "anti-aging", "fine lines", "firmness", "wrinkles", "aging", "ageing"])) {
    return "antiage";
  }
  if (hasAny(t, ["simple", "minimal", "no-fuss", "easy routine"])) {
    return "simple";
  }

  return null;
}

function detectRoutineRequest(message: string): boolean {
  const t = (message || "").toLowerCase();
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
  ]);
}

function getBundleByName(name: string): Bundle | undefined {
  return bundleCatalog.bundles.find((bundle) => bundle.name === name);
}

function pickBundle(
  skinType: "dry" | "oily" | "combination" | "normal" | "sensitive" | null,
  goal: "hydration" | "glow" | "antiage" | "breakouts" | "simple" | null
): Bundle | undefined {
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
    return undefined;
  }

  if (goal === "glow") {
    return getBundleByName("Glow & Radiance Routine");
  }

  if (goal === "antiage") {
    return getBundleByName("Firm & Smooth Skin Routine");
  }

  if (goal === "simple") {
    return getBundleByName("Simple Daily Skincare Routine");
  }

  if (goal === "hydration") {
    if (skinType === "dry") return getBundleByName("Dry & Dehydrated Skin Routine");
    if (skinType === "sensitive") return getBundleByName("Sensitive & Reactive Skin Routine");
    if (skinType === "combination") return getBundleByName("Combination Skin Balance Routine");
    return getBundleByName("Dry & Dehydrated Skin Routine");
  }

  if (!goal && skinType) {
    if (skinType === "sensitive") return getBundleByName("Sensitive & Reactive Skin Routine");
    if (skinType === "combination") return getBundleByName("Combination Skin Balance Routine");
    if (skinType === "normal") return getBundleByName("Normal & Balanced Skin Routine");
  }

  return undefined;
}

function pickAddon(
  skinType: "dry" | "oily" | "combination" | "normal" | "sensitive" | null,
  goal: "hydration" | "glow" | "antiage" | "breakouts" | "simple" | null
): string | null {
  if (goal === "breakouts") return "Acne Spot Care";
  if (goal === "antiage") return "Smoothing Eye Cream";
  if (goal === "glow" && skinType !== "sensitive") return "AHA Peeling Concentrate";
  return null;
}

function shortBundleDescription(bundleName: string): string {
  const map: Record<string, string> = {
    "Dry & Dehydrated Skin Routine": "It is best for dry or dehydrated skin that needs comfort and hydration.",
    "Combination Skin Balance Routine": "It is best for combination skin that needs balance without feeling heavy.",
    "Simple Daily Skincare Routine": "It is best for an easy everyday routine with no unnecessary steps.",
    "Sensitive & Reactive Skin Routine": "It is best for sensitive or reactive skin that needs a gentle routine.",
    "Normal & Balanced Skin Routine": "It is best for normal skin that wants a simple balanced routine.",
    "Glow & Radiance Routine": "It is best for dull or uneven-looking skin that wants more glow.",
    "Firm & Smooth Skin Routine": "It is best for early signs of aging, smoothness, and firmness.",
    "Clear & Balanced Skin Routine": "It is best for oily or blemish-prone skin that needs a fresh lightweight routine.",
  };

  return map[bundleName] || "It looks like the strongest fit from the current range.";
}

function shortAddonDescription(addonName: string): string {
  const map: Record<string, string> = {
    "AHA Peeling Concentrate": "A good add-on for texture or dullness.",
    "Acne Spot Care": "A good add-on for visible blemishes.",
    "Smoothing Eye Cream": "A good add-on for the eye area.",
  };

  return map[addonName] || "";
}

function buildShortReplyFromSelection(bundle: Bundle, addonName?: string | null): string {
  const parts: string[] = [];

  parts.push(bundle.name);
  parts.push(shortBundleDescription(bundle.name));

  if (bundle.products && bundle.products.length > 0) {
    parts.push(`Included products:\n${bundle.products.map((product) => `- ${product}`).join("\n")}`);
  }

  if (addonName) {
    parts.push(`Add-on: ${addonName}\n${shortAddonDescription(addonName)}`);
  }

  parts.push("Want me to link you straight to it?");

  return parts.join("\n\n");
}

function buildActionsFromSelection(bundle: Bundle, addonName?: string | null): ChatAction[] {
  const actions: ChatAction[] = [
    {
      type: "OPEN_URL",
      label: "View routine",
      url: bundle.url,
    },
  ];

  if (addonName) {
    const addonProduct = productCatalog.products.find((product) => product.title === addonName);
    if (addonProduct) {
      actions.push({
        type: "OPEN_URL",
        label: "View product",
        url: addonProduct.url,
      });
    }
  }

  return actions.slice(0, 2);
}

function cleanModelText(text: string): string {
  let cleaned = text || "";

  cleaned = cleaned.replace(/https?:\/\/\S+/gi, "").trim();
  cleaned = cleaned.replace(/^\s*[-•]?\s*Best match:?\s*/gim, "");
  cleaned = cleaned.replace(/^\s*[-•]?\s*Best bundle:?\s*/gim, "");
  cleaned = cleaned.replace(/^\s*[-•]?\s*Bundle:?\s*/gim, "");
  cleaned = cleaned.replace(/^\s*[-•]?\s*Add-on(\s*\(optional\))?:?\s*/gim, "");
  cleaned = cleaned.replace(/^\s*[-•]?\s*Benefits:?\s*/gim, "");
  cleaned = cleaned.replace(/^\s*[-•]?\s*Simple AM\s*\/\s*PM order.*$/gim, "");
  cleaned = cleaned.replace(/^\s*[-•]?\s*Quick AM\s*\/\s*PM order.*$/gim, "");
  cleaned = cleaned.replace(/^\s*[-•]?\s*AM:\s.*$/gim, "");
  cleaned = cleaned.replace(/^\s*[-•]?\s*PM:\s.*$/gim, "");
  cleaned = cleaned.replace(/^\s*[-•]\s*/gim, "");
  cleaned = cleaned.replace(/^(Nice|Perfect|Amazing|Great)\s*[—\-–:]?\s*/i, "");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  return cleaned;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message: string | undefined = body?.message;

    if (!message) {
      return new Response(JSON.stringify({ reply: "Missing message.", actions: [] }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const skinType = detectSkinType(message);
    const goal = detectGoal(message);
    const wantsRoutine = detectRoutineRequest(message);

    // Ask for missing info in the right order
    if (wantsRoutine && !skinType && !goal) {
      return new Response(
        JSON.stringify({
          reply: "What’s your skin type: dry, oily, combination, normal, or sensitive?",
          actions: [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (skinType && !goal) {
      return new Response(
        JSON.stringify({
          reply: "What’s your main goal: hydration, glow, anti-age, breakouts, or simple routine?",
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
          reply: "What’s your skin type: oily, combination, dry, normal, or sensitive?",
          actions: [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: [
        { role: "system", content: SOVAH_SYSTEM_PROMPT },
        { role: "user", content: message },
      ],
      text: { format: { type: "text" } },
    });

    const rawReply =
      response.output_text ||
      "Sorry — I couldn’t generate a reply just now. Please try again.";

    const cleanedReply = cleanModelText(rawReply);

    let selectedBundle: Bundle | undefined = findMentionedBundles(cleanedReply)[0];
    let selectedAddon: string | null = detectAddonFromText(cleanedReply);

    if (!selectedBundle) {
      selectedBundle = pickBundle(skinType, goal);
    }
    if (!selectedAddon) {
      selectedAddon = pickAddon(skinType, goal);
    }

    if (selectedBundle) {
      const reply = buildShortReplyFromSelection(selectedBundle, selectedAddon);
      const actions = buildActionsFromSelection(selectedBundle, selectedAddon);

      return new Response(JSON.stringify({ reply, actions }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const fallbackReply = "What’s your skin type: dry, oily, combination, normal, or sensitive?";

    return new Response(JSON.stringify({ reply: fallbackReply, actions: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e: any) {
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
