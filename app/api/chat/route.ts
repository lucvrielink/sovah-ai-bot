import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";

function buildCorsHeaders(origin?: string | null) {
  const allowedOrigins = [
    "https://sovahcare.com",
    "https://www.sovahcare.com",
  ];

  const safeOrigin =
    origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": safeOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(origin),
  });
}

const bundlesPath = path.join(process.cwd(), "data", "bundle_catalog.json");
const productsPath = path.join(process.cwd(), "data", "product_catalog.json");

const BUNDLES_JSON = fs.readFileSync(bundlesPath, "utf8");
const PRODUCTS_JSON = fs.readFileSync(productsPath, "utf8");

type Lang = "nl" | "en";

type Bundle = {
  name: string;
  url: string;
  description?: string;
  products?: string[];
  how_to_use_nl?: {
    morning?: string[];
    evening?: string[];
  };
  how_to_use_en?: {
    morning?: string[];
    evening?: string[];
  };
  best_combined_with?: string[];
  combination_note_nl?: string;
  combination_note_en?: string;
  patch_test_nl?: string;
  patch_test_en?: string;
  caution_nl?: string;
  caution_en?: string;
};

type Product = {
  title: string;
  handle: string;
  url: string;
  first_available_variant_id?: number;
  source_tags?: string[];
  short_copy_nl?: string;
  short_copy_en?: string;
  usage_nl?: string;
  usage_en?: string;
  when_to_use_nl?: string;
  when_to_use_en?: string;
  routine_step_nl?: string;
  routine_step_en?: string;
  pairs_well_with?: string[];
  pairing_note_nl?: string;
  pairing_note_en?: string;
};

type BundleCatalog = { bundles: Bundle[] };
type ProductCatalog = { products: Product[] };

type ChatAction = {
  type: "OPEN_URL";
  label: string;
  url: string;
};

const QUIZ_URL = "https://sovahcare.com/pages/find-your-routine";

const bundleCatalog: BundleCatalog = JSON.parse(BUNDLES_JSON);
const productCatalog: ProductCatalog = JSON.parse(PRODUCTS_JSON);

// ───────────────── helpers ─────────────────

function normalize(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[^\w\s&+\-'/]/g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLoose(text: string): string {
  return normalize(text).replace(/[-+&]/g, " ").replace(/\s+/g, " ").trim();
}

function hasAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function countMatches(text: string, words: string[]): number {
  return words.reduce((acc, word) => acc + (text.includes(word) ? 1 : 0), 0);
}

function tr(lang: Lang, nl: string, en: string): string {
  return lang === "nl" ? nl : en;
}

function detectLanguage(currentMessage: string, historyText = "", forcedLang?: string): Lang {
  if (forcedLang === "nl" || forcedLang === "en") return forcedLang;

  const current = normalize(currentMessage);
  const history = normalize(historyText);

  const dutchSignals = [
    "ik", "mijn", "huid", "droog", "droge", "vette", "vet", "gevoelig",
    "welke", "wat", "past", "bij", "mij", "puistjes", "acne", "routine",
    "product", "producten", "hoe gebruik", "wanneer gebruik", "oudere huid",
    "fijne lijntjes", "rimpels", "geen routine", "paar producten"
  ];

  const englishSignals = [
    "my", "skin", "dry", "oily", "sensitive", "which", "what", "routine",
    "product", "products", "how do i use", "when do i use", "older skin",
    "fine lines", "wrinkles", "not a full routine", "few products"
  ];

  const nlScore = countMatches(current, dutchSignals) * 3 + countMatches(history, dutchSignals);
  const enScore = countMatches(current, englishSignals) * 3 + countMatches(history, englishSignals);

  return nlScore >= enScore ? "nl" : "en";
}

function extractUserMessages(history: string[]): string[] {
  return history
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => item.toLowerCase().startsWith("user:"))
    .map((item) => item.replace(/^user:\s*/i, "").trim());
}

function getProductByName(name: string): Product | undefined {
  return productCatalog.products.find((p) => p.title === name);
}

function getBundleByName(name: string): Bundle | undefined {
  return bundleCatalog.bundles.find((b) => b.name === name);
}

function findMentionedProducts(text: string): Product[] {
  const t = normalizeLoose(text);
  return productCatalog.products.filter((p) => t.includes(normalizeLoose(p.title)));
}

function findMentionedBundles(text: string): Bundle[] {
  const t = normalizeLoose(text);
  return bundleCatalog.bundles.filter((b) => t.includes(normalizeLoose(b.name)));
}

function findBundleFromLooseIntent(text: string): Bundle | undefined {
  const t = normalizeLoose(text);
  return bundleCatalog.bundles.find((b) => t.includes(normalizeLoose(b.name)));
}

function findProductFromLooseIntent(text: string): Product | undefined {
  const t = normalizeLoose(text);

  const aliases: Record<string, string[]> = {
    "Acne Spot Care": ["acne spot", "spot care", "acne spot care"],
    "Vitamin C Serum": ["vitamin c", "vit c serum", "vitamin c serum"],
    "Hydrating Serum": ["hydrating serum"],
    "Hydrating Toner": ["hydrating toner", "toner"],
    "Purifying Mousse": ["purifying mousse", "mousse cleanser", "mousse"],
    "Smoothing Eye Cream": ["eye cream", "smoothing eye cream", "oogcreme", "oogcrème"],
    "AHA Peeling Concentrate": ["aha", "aha peeling", "aha peeling concentrate", "peeling"],
    "Niacinamide Gel Moisturiser": ["niacinamide", "niacinamide moisturiser", "gel moisturiser", "gel moisturizer"],
    "Sun Protection SPF50 Stick, no tint": ["spf stick", "sun stick", "spf50 stick", "sun protection stick", "spf"],
    "Micellar Cleansing Water": ["micellar", "micellar cleansing water"],
    "Calming Facial Oil": ["calming oil", "facial oil", "calming facial oil"],
    "Moisturising Day Cream": ["day cream", "moisturising day cream", "dagcrème", "dagcreme"],
    "Ceramide Barrier Night Cream": ["night cream", "ceramide cream", "nachtcrème", "nachtcreme"],
    "Collagen Boost Serum": ["collagen serum", "collagen boost"],
    "Anti-Age Day Cream": ["anti age day cream", "anti-aging day cream", "anti-age day cream"],
    "Natural Retinol Alternative Oil Serum": ["retinol alternative", "natural retinol"],
    "Antioxidant Ginkgo Gel Booster": ["ginkgo booster", "ginkgo gel booster"],
    "Oil-Free Hydrating Gel": ["oil free gel", "oil-free gel", "hydrating gel"],
    "All-In-One Facial Oil": ["all in one oil", "all-in-one oil"],
    "Dark Spot Face Cream with Kojic Acid": ["dark spot cream", "kojic acid cream"],
    "Brightening Face&Body Exfoliator with Kojic Acid": ["brightening exfoliator", "kojic exfoliator"]
  };

  for (const [productName, words] of Object.entries(aliases)) {
    if (words.some((word) => t.includes(normalizeLoose(word)))) {
      return getProductByName(productName);
    }
  }

  return undefined;
}

// ───────────────── signals ─────────────────

function detectDrySignal(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, ["dry", "dehydrated", "droog", "droge huid", "uitgedroogd", "vochttekort", "tight", "flaky"]);
}

function detectGlowSignal(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, ["glow", "radiance", "dull", "stralend", "doffe huid", "dof", "meer glow"]);
}

function detectBreakoutSignal(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, ["acne", "puistjes", "breakouts", "blemishes", "spots", "onzuiverheden"]);
}

function detectSensitiveSignal(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, ["sensitive", "gevoelig", "reactive", "reactief", "irritated", "geïrriteerd", "geirriteerd"]);
}

function detectAntiAgeSignal(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "anti age", "anti-age", "anti aging", "anti-aging",
    "fine lines", "wrinkles", "rimpels", "fijne lijntjes",
    "firmness", "stevigheid", "older skin", "oudere huid", "verouderende huid"
  ]);
}

// ───────────────── intent detection ─────────────────

function detectUsageRequest(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "how do i use", "how should i use", "when do i use", "how often",
    "how many times", "how to use", "before or after", "step in routine",
    "hoe gebruik ik", "hoe moet ik gebruiken", "wanneer gebruik ik",
    "hoe vaak", "hoe moet ik dit gebruiken", "voor of na", "welke stap",
    "in welke stap", "hoe gebruik je"
  ]);
}

function detectCombinationRequest(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "combine", "combined with", "can i combine", "can i use together",
    "use together", "layer with", "works well with", "pair with",
    "combineren", "combineer", "kan ik combineren", "samen met",
    "past goed bij", "welke producten passen hierbij", "wat past hierbij",
    "waarmee combineren", "welke combinatie"
  ]);
}

function detectCompareRequest(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "compare", "difference", "what is better", "which is better", "vs", "versus",
    "vergelijk", "verschil", "wat is beter", "welke is beter"
  ]);
}

function detectWhereRequest(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "where", "where can i find", "find", "show me", "send me",
    "waar", "waar vind", "vinden", "geef me de link", "stuur me"
  ]);
}

function detectSuitabilityRequest(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "is this good for", "is it good for", "good for", "suitable for",
    "can i use", "would this work for", "is this okay for",
    "geschikt voor", "kan ik gebruiken", "is dit goed voor",
    "werkt dit voor", "past dit bij"
  ]);
}

function detectProductOnlyPreference(text: string): boolean {
  const t = normalize(text);

  return hasAny(t, [
    "maar ik wil maar een paar producten",
    "ik wil maar een paar producten",
    "ik wil een paar producten",
    "ik wil alleen een paar producten",
    "ik wil alleen producten",
    "ik wil geen routine",
    "geen routine",
    "niet een hele routine",
    "niet de hele routine",
    "alleen een product",
    "alleen producten",
    "just a few products",
    "i only want a few products",
    "i only want products",
    "i dont want a full routine",
    "i don't want a full routine",
    "not a full routine",
    "just a product",
    "just products",
    "only a few products"
  ]);
}

function detectProductRecommendationRequest(text: string): boolean {
  const t = normalize(text);

  return hasAny(t, [
    "raad een product aan",
    "raad producten aan",
    "kan je een product aanraden",
    "kan je mij een product aanraden",
    "kan je mij producten aanraden",
    "welk product raad je aan",
    "welke producten raad je aan",
    "welk serum raad je aan",
    "welke creme raad je aan",
    "welke crème raad je aan",
    "ik wil een product voor",
    "ik wil producten voor",
    "ik wil 1 2 producten voor",
    "ik wil 1-2 producten voor",
    "1 2 producten voor",
    "1-2 producten voor",
    "welk product past bij",
    "welke producten passen bij",
    "recommend a product",
    "recommend products",
    "can you recommend a product",
    "can you recommend products",
    "what product do you recommend",
    "which product do you recommend",
    "what products do you recommend",
    "which products do you recommend",
    "i want products for",
    "i want 1 2 products for",
    "i want 1-2 products for",
    "1 2 products for",
    "1-2 products for",
    "older skin",
    "oudere huid",
    "dry skin",
    "droge huid",
    "breakouts",
    "puistjes"
  ]);
}

function detectRoutineHelpRequest(text: string): boolean {
  const t = normalize(text);

  return hasAny(t, [
    "which routine fits me best",
    "what routine fits me best",
    "best routine for me",
    "which routine",
    "what routine",
    "routine advice",
    "build me a routine",
    "help me choose",
    "recommend me a routine",
    "which routine fits my skin",
    "welke routine past bij mij",
    "welke routine",
    "beste routine voor mij",
    "wat past bij mijn huid",
    "welke producten heb ik nodig",
    "routine voor mijn huid",
    "beste match voor mijn huid",
    "ik weet niet wat ik nodig heb"
  ]);
}

function detectNotKnowingSkinType(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "ik weet mijn huidtype niet",
    "huidtype weet ik niet",
    "ik weet niet wat mijn huidtype is",
    "ik weet niet welk huidtype ik heb",
    "i dont know my skin type",
    "i don't know my skin type",
    "not sure what my skin type is"
  ]);
}

function detectBroadSkinGoal(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "ik wil een normale huid",
    "ik wil een rustigere huid",
    "ik wil een gladdere huid",
    "ik wil een betere huid",
    "ik wil een egale huid",
    "ik wil meer glow",
    "ik wil minder puistjes",
    "ik wil minder acne",
    "ik wil minder droogte",
    "i want better skin",
    "i want normal skin",
    "i want smoother skin",
    "i want more glow",
    "i want less acne",
    "i want less dryness"
  ]);
}

function detectCorrectionMessage(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "ik bedoel",
    "nee dat bedoel ik niet",
    "geen acne maar",
    "meer glow",
    "meer hydratatie",
    "not acne",
    "i mean",
    "that's not what i mean",
    "no i mean",
    "instead",
    "rather"
  ]);
}

function isSpecificProductQuestion(message: string): boolean {
  const mentionedProducts = findMentionedProducts(message);
  const looseProduct = findProductFromLooseIntent(message);

  if (!(mentionedProducts.length === 1 || looseProduct)) return false;
  if (detectProductRecommendationRequest(message)) return false;
  if (detectUsageRequest(message)) return false;
  if (detectCombinationRequest(message)) return false;
  if (detectCompareRequest(message)) return false;
  return true;
}

function shouldRedirectToQuiz(message: string, combinedUserText: string): boolean {
  const current = normalize(message);

  if (detectUsageRequest(message)) return false;
  if (detectCombinationRequest(message)) return false;
  if (detectProductRecommendationRequest(message)) return false;
  if (detectProductOnlyPreference(message)) return false;
  if (isSpecificProductQuestion(message)) return false;
  if (detectCompareRequest(message)) return false;
  if (detectWhereRequest(message)) return false;
  if (detectSuitabilityRequest(message)) return false;

  if (detectRoutineHelpRequest(message)) return true;
  if (detectNotKnowingSkinType(message)) return true;
  if (detectBroadSkinGoal(message) && !detectProductOnlyPreference(message)) return true;
  if (detectCorrectionMessage(message) && !detectProductOnlyPreference(message)) return true;

  const signalCount = [
    detectDrySignal(combinedUserText),
    detectGlowSignal(combinedUserText),
    detectBreakoutSignal(combinedUserText),
    detectSensitiveSignal(combinedUserText),
    detectAntiAgeSignal(combinedUserText),
  ].filter(Boolean).length;

  if (signalCount >= 2) return true;

  if (
    signalCount >= 1 &&
    hasAny(current, [
      "wat raad je aan", "what do you recommend", "voor mijn huid",
      "for my skin", "wat moet ik", "what should i", "wat past", "what fits"
    ]) &&
    !detectProductRecommendationRequest(message) &&
    !detectProductOnlyPreference(message)
  ) {
    return true;
  }

  return false;
}

// ───────────────── recommendation helpers ─────────────────

function recommendProductsFromText(text: string): Product[] {
  const picks: Product[] = [];

  const add = (title: string) => {
    const p = getProductByName(title);
    if (p && !picks.find((x) => x.title === p.title)) picks.push(p);
  };

  if (detectDrySignal(text)) {
    add("Hydrating Serum");
    add("Moisturising Day Cream");
  }

  if (detectGlowSignal(text)) {
    add("Vitamin C Serum");
    add("Antioxidant Ginkgo Gel Booster");
  }

  if (detectBreakoutSignal(text)) {
    add("Acne Spot Care");
    add("Niacinamide Gel Moisturiser");
  }

  if (detectSensitiveSignal(text)) {
    add("Calming Facial Oil");
    add("Ceramide Barrier Night Cream");
  }

  if (detectAntiAgeSignal(text)) {
    add("Peptide Anti-Aging Serum");
    add("Anti-Age Day Cream");
  }

  return picks.slice(0, 2);
}

// ───────────────── reply builders ─────────────────

function buildActionsForProduct(product: Product, lang: Lang): ChatAction[] {
  return [{
    type: "OPEN_URL",
    label: tr(lang, "Bekijk product", "View product"),
    url: product.url,
  }];
}

function buildActionsForBundle(bundle: Bundle, lang: Lang): ChatAction[] {
  return [{
    type: "OPEN_URL",
    label: tr(lang, "Bekijk routine", "View routine"),
    url: bundle.url,
  }];
}

function buildQuizRedirectReply(lang: Lang) {
  return {
    reply: tr(
      lang,
      "Voor de beste routine-match kun je het beste onze skincare quiz doen.\n\nDaar begeleiden we je stap voor stap naar de juiste routine voor jouw huid.",
      "For the best routine match, the best next step is our skincare quiz.\n\nThere we guide you step by step to the right routine for your skin."
    ),
    actions: [{
      type: "OPEN_URL" as const,
      label: tr(lang, "Start de quiz", "Start quiz"),
      url: QUIZ_URL,
    }],
    lang,
  };
}

function buildProductReply(product: Product, lang: Lang): string {
  return `**${product.title}**\n\n${lang === "nl"
    ? product.short_copy_nl || "Een product uit het huidige SOVAH assortiment."
    : product.short_copy_en || "A product from the current SOVAH range."}`;
}

function buildProductUsageReply(product: Product, lang: Lang): string {
  const parts: string[] = [`**${product.title}**`];

  const usage = lang === "nl" ? product.usage_nl : product.usage_en;
  const whenToUse = lang === "nl" ? product.when_to_use_nl : product.when_to_use_en;
  const step = lang === "nl" ? product.routine_step_nl : product.routine_step_en;

  if (usage) parts.push(usage);
  if (whenToUse) {
    parts.push(lang === "nl" ? `**Wanneer gebruik je het?**\n${whenToUse}` : `**When do you use it?**\n${whenToUse}`);
  }
  if (step) {
    parts.push(lang === "nl" ? `**Stap in je routine**\n${step}` : `**Step in your routine**\n${step}`);
  }

  if (parts.length === 1) {
    parts.push(tr(
      lang,
      "Ik heb hier nog geen volledige gebruiksinformatie voor, maar ik kan je wel helpen met een passend product of routine.",
      "I don't have the full usage details here yet, but I can still help with a suitable product or routine."
    ));
  }

  return parts.join("\n\n");
}

function buildBundleUsageReply(bundle: Bundle, lang: Lang): string {
  const how = lang === "nl" ? bundle.how_to_use_nl : bundle.how_to_use_en;
  const patch = lang === "nl" ? bundle.patch_test_nl : bundle.patch_test_en;
  const caution = lang === "nl" ? bundle.caution_nl : bundle.caution_en;

  const parts: string[] = [`**${bundle.name}**`];

  if (how?.morning?.length) {
    parts.push(
      lang === "nl"
        ? `**Ochtend**\n${how.morning.map((step) => `- ${step}`).join("\n")}`
        : `**Morning**\n${how.morning.map((step) => `- ${step}`).join("\n")}`
    );
  }

  if (how?.evening?.length) {
    parts.push(
      lang === "nl"
        ? `**Avond**\n${how.evening.map((step) => `- ${step}`).join("\n")}`
        : `**Evening**\n${how.evening.map((step) => `- ${step}`).join("\n")}`
    );
  }

  if (patch) parts.push(`**Patch test**\n${patch}`);
  if (caution) parts.push(lang === "nl" ? `**Let op**\n${caution}` : `**Caution**\n${caution}`);

  return parts.join("\n\n");
}

function buildProductCombinationReply(product: Product, partner: Product | null, lang: Lang): string {
  if (partner) {
    const notes = [
      lang === "nl" ? product.pairing_note_nl : product.pairing_note_en,
      lang === "nl" ? partner.pairing_note_nl : partner.pairing_note_en,
    ].filter(Boolean);

    return [
      `**${product.title} + ${partner.title}**`,
      tr(
        lang,
        "Dit kan een logische combinatie zijn, afhankelijk van je huid en de rest van je routine.",
        "This can be a logical combination, depending on your skin and the rest of your routine."
      ),
      ...notes,
    ].join("\n\n");
  }

  const list = product.pairs_well_with?.length
    ? `${tr(lang, "Producten die hier goed bij passen:", "Products that pair well with this:")}\n${product.pairs_well_with.map((p) => `- ${p}`).join("\n")}`
    : tr(lang, "Ik heb hier nog geen pairing-lijst voor.", "I don't have a pairing list for this yet.");

  const note = lang === "nl" ? product.pairing_note_nl : product.pairing_note_en;

  return [`**${product.title}**`, list, note].filter(Boolean).join("\n\n");
}

function buildProductRecommendationReply(products: Product[], lang: Lang): string {
  if (!products.length) {
    return tr(
      lang,
      "Vertel me even wat voor huid je hebt of waar je vooral hulp bij wilt, dan raad ik je liever 1 of 2 passende producten aan.",
      "Tell me your skin type or what you'd mainly like help with, and I’ll recommend 1 or 2 suitable products."
    );
  }

  const intro = tr(
    lang,
    "Als je liever geen hele routine wilt, zou ik het hierbij houden:",
    "If you'd rather not go for a full routine, I’d keep it to these:"
  );

  const lines = products.map((p) => `**${p.title}**\n${lang === "nl" ? p.short_copy_nl || "" : p.short_copy_en || ""}`);

  return `${intro}\n\n${lines.join("\n\n")}`;
}

// ───────────────── Claude fallback ─────────────────

async function callClaudeFallback(
  message: string,
  history: string[],
  lang: Lang
): Promise<{ reply: string; actions: ChatAction[]; lang: Lang }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return {
      reply: tr(
        lang,
        "Ik weet nog niet helemaal wat je bedoelt. Gaat het om een product, hoe je iets gebruikt, een paar producten, of wil je hulp met de juiste routine?",
        "I'm not fully sure what you mean yet. Is it about a product, how to use something, a few products, or do you want help with the right routine?"
      ),
      actions: [],
      lang,
    };
  }

  try {
    const client = new Anthropic({ apiKey });

    const productList = productCatalog.products.map((p) => p.title).join(", ");
    const bundleList = bundleCatalog.bundles.map((b) => b.name).join(", ");

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 350,
      system: `You are the SOVAH skincare assistant for sovahcare.com.

Use only the provided bundle and product catalog as source of truth.
Do not invent products, ingredients, medical claims, or unsupported benefits.

Available bundles: ${bundleList}
Available products: ${productList}

Rules:
- Reply in the customer's language.
- Keep replies short, natural, practical, and premium.
- If the user asks for 1 or 2 products, do not force the quiz.
- If the user asks for the best routine or a complete routine match, use the quiz.
- If the user asks how to use a product or bundle, answer directly using the catalog.
- If the user asks what combines well with a product, answer directly using the catalog.
- Ask at most one short clarifying question only if truly needed.`,
      messages: [
        {
          role: "user",
          content: history.length
            ? `Previous customer context:\n${history.join("\n")}\n\nCurrent message:\n${message}`
            : message,
        },
      ],
    });

    const text =
      response.content[0]?.type === "text"
        ? response.content[0].text
        : tr(
            lang,
            "Vertel me welk product of welke routine je bedoelt, dan help ik je verder.",
            "Tell me which product or routine you mean, and I’ll help from there."
          );

    const mentionedProducts = findMentionedProducts(text);
    const mentionedBundles = findMentionedBundles(text);

    let actions: ChatAction[] = [];
    if (mentionedBundles.length > 0) actions = buildActionsForBundle(mentionedBundles[0], lang);
    else if (mentionedProducts.length > 0) actions = buildActionsForProduct(mentionedProducts[0], lang);

    return { reply: text, actions: actions.slice(0, 2), lang };
  } catch {
    return {
      reply: tr(
        lang,
        "Ik weet nog niet helemaal wat je bedoelt. Vertel me welk product of welke routine je bedoelt, dan help ik je verder.",
        "I'm not fully sure what you mean yet. Tell me which product or routine you mean, and I’ll help from there."
      ),
      actions: [],
      lang,
    };
  }
}

// ───────────────── Main handler ─────────────────

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const corsHeaders = buildCorsHeaders(origin);

  try {
    const body = await req.json();
    const message: string | undefined = body?.message;
    const forcedLang: string | undefined = body?.lang;
    const historyRaw: unknown = body?.history;

    const history: string[] = Array.isArray(historyRaw)
      ? historyRaw.filter((item): item is string => typeof item === "string")
      : [];

    if (!message) {
      return new Response(
        JSON.stringify({ reply: "Missing message.", actions: [], lang: "en" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userHistory = extractUserMessages(history);
    const userTimeline = [...userHistory, message].slice(-18);
    const combinedUserText = userTimeline.join(" \n ");
    const lang = detectLanguage(message, combinedUserText, forcedLang);

    const mentionedProducts = findMentionedProducts(message);
    const mentionedBundles = findMentionedBundles(message);
    const looseProduct = findProductFromLooseIntent(message);

    // 1. product recommendation hard override
    if (
      detectProductRecommendationRequest(message) ||
      detectProductOnlyPreference(message) ||
      (detectProductOnlyPreference(combinedUserText) &&
        (detectDrySignal(combinedUserText) ||
          detectGlowSignal(combinedUserText) ||
          detectBreakoutSignal(combinedUserText) ||
          detectSensitiveSignal(combinedUserText) ||
          detectAntiAgeSignal(combinedUserText)))
    ) {
      const picks = recommendProductsFromText(combinedUserText);

      return new Response(
        JSON.stringify({
          reply: buildProductRecommendationReply(picks, lang),
          actions: picks.flatMap((p) => buildActionsForProduct(p, lang)).slice(0, 2),
          lang,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 2. usage bundle
    if (detectUsageRequest(message)) {
      const bundle = mentionedBundles[0] || findBundleFromLooseIntent(message);
      if (bundle) {
        return new Response(
          JSON.stringify({
            reply: buildBundleUsageReply(bundle, lang),
            actions: buildActionsForBundle(bundle, lang),
            lang,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // 3. usage product
    if (detectUsageRequest(message) && (mentionedProducts.length === 1 || looseProduct)) {
      const product = mentionedProducts[0] || looseProduct!;
      return new Response(
        JSON.stringify({
          reply: buildProductUsageReply(product, lang),
          actions: buildActionsForProduct(product, lang),
          lang,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 4. combinations
    if (detectCombinationRequest(message)) {
      const products = mentionedProducts.length ? mentionedProducts : looseProduct ? [looseProduct] : [];

      if (products.length >= 2) {
        return new Response(
          JSON.stringify({
            reply: buildProductCombinationReply(products[0], products[1], lang),
            actions: [buildActionsForProduct(products[0], lang)[0], buildActionsForProduct(products[1], lang)[0]].slice(0, 2),
            lang,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (products.length === 1) {
        return new Response(
          JSON.stringify({
            reply: buildProductCombinationReply(products[0], null, lang),
            actions: buildActionsForProduct(products[0], lang),
            lang,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // 5. compare
    if (detectCompareRequest(message)) {
      const compareItems = [...mentionedBundles, ...mentionedProducts].slice(0, 2);
      if (compareItems.length === 2) {
        return new Response(
          JSON.stringify({
            reply: tr(
              lang,
              `**${"name" in compareItems[0] ? compareItems[0].name : compareItems[0].title}** vs **${"name" in compareItems[1] ? compareItems[1].name : compareItems[1].title}**\n\nVertel me wat voor huid je hebt of wat je doel is, dan help ik je kiezen welke beter past.`,
              `**${"name" in compareItems[0] ? compareItems[0].name : compareItems[0].title}** vs **${"name" in compareItems[1] ? compareItems[1].name : compareItems[1].title}**\n\nTell me your skin type or goal, and I’ll help you choose which one fits better.`
            ),
            actions: [],
            lang,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // 6. where
    if (detectWhereRequest(message) && (mentionedProducts.length === 1 || looseProduct)) {
      const product = mentionedProducts[0] || looseProduct!;
      return new Response(
        JSON.stringify({
          reply: tr(lang, `**${product.title}**\n\nJe vindt het hier.`, `**${product.title}**\n\nYou can find it here.`),
          actions: buildActionsForProduct(product, lang),
          lang,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 7. suitability
    if (detectSuitabilityRequest(message) && (mentionedProducts.length === 1 || looseProduct)) {
      const product = mentionedProducts[0] || looseProduct!;
      return new Response(
        JSON.stringify({
          reply: tr(
            lang,
            `**${product.title}**\n\n${product.short_copy_nl || ""}\n\nVertel me wat voor huid je hebt en wat je doel is, dan zeg ik of dit goed past.`,
            `**${product.title}**\n\n${product.short_copy_en || ""}\n\nTell me your skin type and goal, and I’ll tell you if it fits.`
          ),
          actions: buildActionsForProduct(product, lang),
          lang,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 8. routine to quiz
    if (shouldRedirectToQuiz(message, combinedUserText)) {
      const quizOut = buildQuizRedirectReply(lang);
      return new Response(
        JSON.stringify(quizOut),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 9. specific product
    if (mentionedProducts.length === 1 || looseProduct) {
      const product = mentionedProducts[0] || looseProduct!;
      return new Response(
        JSON.stringify({
          reply: buildProductReply(product, lang),
          actions: buildActionsForProduct(product, lang),
          lang,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 10. specific bundle
    if (mentionedBundles.length === 1) {
      const bundle = mentionedBundles[0];
      return new Response(
        JSON.stringify({
          reply: `**${bundle.name}**\n\n${bundle.description || tr(lang, "Routine uit het huidige SOVAH assortiment.", "Routine from the current SOVAH range.")}`,
          actions: buildActionsForBundle(bundle, lang),
          lang,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const claudeOut = await callClaudeFallback(message, userTimeline, lang);

    return new Response(
      JSON.stringify(claudeOut),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (e: unknown) {
    console.error("SOVAH /api/chat error:", e);

    return new Response(
      JSON.stringify({
        reply: "Sorry, something went wrong. Try again later.",
        actions: [],
        lang: "en",
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
}
