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
type SkinType = "dry" | "oily" | "combination" | "sensitive" | "normal" | null;

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
  if (forcedLang === "nl" || forcedLang === "en") {
    const current = normalize(currentMessage);

    const strongEnglishSignals = [
      "nothing for acne",
      "for acne",
      "for dry skin",
      "for older skin",
      "how do i use",
      "what pairs with",
      "recommend",
      "product",
      "products",
      "routine",
      "breakouts",
      "older skin",
      "dry skin",
      "sensitive skin",
      "what about",
      "not that one",
      "nothing for",
      "those",
      "them"
    ];

    const strongDutchSignals = [
      "niets voor acne",
      "voor acne",
      "voor droge huid",
      "voor oudere huid",
      "hoe gebruik ik",
      "wat past bij",
      "raad aan",
      "product",
      "producten",
      "routine",
      "puistjes",
      "oudere huid",
      "droge huid",
      "gevoelige huid",
      "wat dan",
      "niet die",
      "deze",
      "die"
    ];

    const currentEnStrong = strongEnglishSignals.some((w) => current.includes(w));
    const currentNlStrong = strongDutchSignals.some((w) => current.includes(w));

    if (currentEnStrong && !currentNlStrong) return "en";
    if (currentNlStrong && !currentEnStrong) return "nl";
  }

  const current = normalize(currentMessage);
  const history = normalize(historyText);

  const dutchSignals = [
    "ik", "mijn", "huid", "droog", "droge", "vette", "vet", "gevoelig",
    "welke", "wat", "past", "bij", "mij", "puistjes", "acne", "routine",
    "product", "producten", "hoe gebruik", "wanneer gebruik", "oudere huid",
    "fijne lijntjes", "rimpels", "geen routine", "paar producten", "deze", "die", "dit",
    "droge huid", "gevoelige huid", "voor puistjes"
  ];

  const englishSignals = [
    "my", "skin", "dry", "oily", "sensitive", "which", "what", "routine",
    "product", "products", "how do i use", "when do i use", "older skin",
    "fine lines", "wrinkles", "not a full routine", "few products", "this", "that",
    "dry skin", "sensitive skin", "breakouts", "those", "them"
  ];

  const currentNl = countMatches(current, dutchSignals);
  const currentEn = countMatches(current, englishSignals);
  const historyNl = countMatches(history, dutchSignals);
  const historyEn = countMatches(history, englishSignals);

  const nlScore = currentNl * 5 + historyNl;
  const enScore = currentEn * 5 + historyEn;

  if (currentEn > 0 && currentNl === 0) return "en";
  if (currentNl > 0 && currentEn === 0) return "nl";

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
    "Sun Protection SPF50 Stick, no tint": ["spf stick", "sun stick", "spf50 stick", "sun protection stick", "spf", "sun protection"],
    "Micellar Cleansing Water": ["micellar", "micellar cleansing water"],
    "Calming Facial Oil": ["calming oil", "facial oil", "calming facial oil"],
    "Moisturising Day Cream": ["day cream", "moisturising day cream", "dagcrème", "dagcreme"],
    "Ceramide Barrier Night Cream": ["night cream", "ceramide cream", "nachtcrème", "nachtcreme"],
    "Collagen Boost Serum": ["collagen serum", "collagen boost"],
    "Anti-Age Day Cream": ["anti age day cream", "anti-aging day cream", "anti-age day cream"],
    "Natural Retinol Alternative Oil Serum": ["retinol alternative", "natural retinol", "retinol oil serum"],
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

// ───────────────── product/meta inference ─────────────────

type ProductType = "cleanser" | "toner" | "serum" | "gel" | "cream" | "oil" | "spf" | "spot" | "exfoliant" | "other";
type UseTime = "morning" | "evening" | "both";

function inferProductType(product: Product): ProductType {
  const t = normalize(product.title);

  if (t.includes("spf") || t.includes("sun protection")) return "spf";
  if (t.includes("cleansing water") || t.includes("mousse")) return "cleanser";
  if (t.includes("toner")) return "toner";
  if (t.includes("peeling") || t.includes("exfoliator")) return "exfoliant";
  if (t.includes("spot care")) return "spot";
  if (t.includes("oil")) return "oil";
  if (t.includes("cream")) return "cream";
  if (t.includes("gel")) return "gel";
  if (t.includes("serum") || t.includes("booster")) return "serum";

  return "other";
}

function inferUseTime(product: Product): UseTime {
  const t = normalize(product.title + " " + (product.when_to_use_en || "") + " " + (product.when_to_use_nl || ""));

  if (t.includes("night") || t.includes("avond") || t.includes("evening")) return "evening";
  if (t.includes("day cream") || t.includes("ochtend") || t.includes("morning") || t.includes("spf")) return "morning";
  return "both";
}

function inferOrderIndex(product: Product): number {
  const type = inferProductType(product);
  switch (type) {
    case "cleanser": return 1;
    case "toner": return 2;
    case "spot": return 3;
    case "exfoliant": return 3;
    case "serum": return 4;
    case "gel": return 5;
    case "cream": return 6;
    case "oil": return 7;
    case "spf": return 8;
    default: return 5;
  }
}

function sortProductsByRoutineOrder(products: Product[]): Product[] {
  return [...products].sort((a, b) => inferOrderIndex(a) - inferOrderIndex(b));
}

// ───────────────── skin signals ─────────────────

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

function detectSkinType(text: string): SkinType {
  const t = normalize(text);

  if (hasAny(t, ["combination", "combi", "combo skin", "combinatie", "combinatiehuid", "t-zone", "t zone"])) {
    return "combination";
  }

  if (hasAny(t, ["sensitive", "gevoelig", "reactive", "reactief", "irritated", "geïrriteerd", "geirriteerd"])) {
    return "sensitive";
  }

  if (hasAny(t, ["oily", "oilly", "greasy", "shiny", "vette huid", "vet", "glimmend"])) {
    return "oily";
  }

  if (hasAny(t, ["dry", "dehydrated", "droog", "droge huid", "uitgedroogd", "vochttekort"])) {
    return "dry";
  }

  if (hasAny(t, ["normal", "balanced skin", "normaal", "normale huid", "gebalanceerd"])) {
    return "normal";
  }

  return null;
}

// ───────────────── intents ─────────────────

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

function detectPluralReference(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "those",
    "them",
    "these",
    "die",
    "deze",
    "allebei",
    "beide",
    "beiden",
    "both"
  ]);
}

function detectAmbiguousReference(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "hoe gebruik ik die",
    "hoe gebruik ik dit",
    "hoe gebruik ik deze",
    "wat past hierbij",
    "kan ik deze combineren",
    "kan ik dit combineren",
    "waar gebruik ik die",
    "waar gebruik ik dit",
    "how do i use this",
    "how do i use that",
    "what pairs with this",
    "what goes with this",
    "can i combine this",
    "where do i use this",
    "this one",
    "that one"
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
    "puistjes",
    "nothing for acne",
    "nothing for breakouts",
    "something for acne",
    "something for breakouts",
    "iets voor acne",
    "iets voor puistjes",
    "niets voor acne",
    "niets voor puistjes"
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

// ───────────────── history resolving ─────────────────

function getRecentMentionedProducts(history: string[]): Product[] {
  const recent: Product[] = [];
  const seen = new Set<string>();

  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    const explicit = findMentionedProducts(msg);
    const loose = findProductFromLooseIntent(msg);
    const candidates = loose ? [...explicit, loose] : explicit;

    for (const p of candidates) {
      if (!seen.has(p.title)) {
        recent.push(p);
        seen.add(p.title);
      }
    }

    if (recent.length >= 4) break;
  }

  return recent.slice(0, 4);
}

function buildClarifyProductReply(products: Product[], lang: Lang): string {
  const picks = products.slice(0, 2).map((p) => `**${p.title}**`).join(tr(lang, " of ", " or "));
  return tr(
    lang,
    `Bedoel je ${picks}?`,
    `Do you mean ${picks}?`
  );
}

// ───────────────── recommendations ─────────────────

function recommendProductsFromText(text: string): Product[] {
  const picks: Product[] = [];
  const skinType = detectSkinType(text);

  const add = (title: string) => {
    const p = getProductByName(title);
    if (p && !picks.find((x) => x.title === p.title)) picks.push(p);
  };

  if (detectBreakoutSignal(text)) {
    add("Acne Spot Care");

    if (skinType === "dry") {
      add("Moisturising Day Cream");
    } else if (skinType === "sensitive" || skinType === "normal") {
      add("Niacinamide Gel Moisturiser");
    } else {
      add("Oil-Free Hydrating Gel");
    }

    return picks.slice(0, 2);
  }

  if (detectDrySignal(text)) {
    add("Hydrating Serum");
    add("Moisturising Day Cream");
    return picks.slice(0, 2);
  }

  if (detectSensitiveSignal(text)) {
    add("Calming Facial Oil");
    add("Ceramide Barrier Night Cream");
    return picks.slice(0, 2);
  }

  if (detectAntiAgeSignal(text)) {
    add("Peptide Anti-Aging Serum");
    add("Anti-Age Day Cream");
    return picks.slice(0, 2);
  }

  if (detectGlowSignal(text)) {
    add("Vitamin C Serum");
    add("Antioxidant Ginkgo Gel Booster");
    return picks.slice(0, 2);
  }

  return picks.slice(0, 2);
}

// ───────────────── replies ─────────────────

function getSafeShortCopy(product: Product, lang: Lang): string {
  const copy = lang === "nl" ? product.short_copy_nl : product.short_copy_en;
  if (copy && copy.trim()) return copy;

  return tr(
    lang,
    "Een product uit het huidige SOVAH assortiment.",
    "A product from the current SOVAH range."
  );
}

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
  return `**${product.title}**\n\n${getSafeShortCopy(product, lang)}`;
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

function buildMultiProductUsageReply(products: Product[], lang: Lang): string {
  const unique = products
    .filter((p, idx, arr) => arr.findIndex((x) => x.title === p.title) === idx)
    .slice(0, 2);

  const intro = tr(
    lang,
    "Voor deze producten zou ik het zo gebruiken:",
    "For these products, I would use them like this:"
  );

  const blocks = unique.map((p) => {
    const usage = lang === "nl" ? p.usage_nl : p.usage_en;
    const whenToUse = lang === "nl" ? p.when_to_use_nl : p.when_to_use_en;
    const step = lang === "nl" ? p.routine_step_nl : p.routine_step_en;

    const lines = [`**${p.title}**`];
    if (usage) lines.push(usage);
    if (whenToUse) lines.push(lang === "nl" ? `Wanneer: ${whenToUse}` : `When: ${whenToUse}`);
    if (step) lines.push(lang === "nl" ? `Stap: ${step}` : `Step: ${step}`);

    return lines.join("\n");
  });

  return [intro, ...blocks].join("\n\n");
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

function buildDynamicCombinationReply(a: Product, b: Product, lang: Lang): string {
  const [first, second] = sortProductsByRoutineOrder([a, b]);
  const firstType = inferProductType(first);
  const secondType = inferProductType(second);
  const firstTime = inferUseTime(first);
  const secondTime = inferUseTime(second);

  const notes: string[] = [];
  const title = `**${a.title} + ${b.title}**`;

  const bothActive =
    [a.title, b.title].includes("AHA Peeling Concentrate") &&
    ([a.title, b.title].includes("Vitamin C Serum") || [a.title, b.title].includes("Natural Retinol Alternative Oil Serum"));

  const exfoliantWithSpot =
    [a.title, b.title].includes("AHA Peeling Concentrate") &&
    [a.title, b.title].includes("Acne Spot Care");

  if (bothActive) {
    notes.push(
      tr(
        lang,
        "Deze combinatie kan te actief zijn in dezelfde routine. Gebruik ze liever niet direct na elkaar in één routine, maar wissel ze af.",
        "This combination can be too active in the same routine. It is better not to use them back to back in one routine, but to alternate them."
      )
    );
  } else if (exfoliantWithSpot) {
    notes.push(
      tr(
        lang,
        "Deze combinatie kan voor sommige huiden wat te actief zijn. Bouw dit rustig op en gebruik het liever niet te agressief samen.",
        "This combination can be a bit too active for some skin types. Build it in slowly and avoid using it too aggressively together."
      )
    );
  } else {
    notes.push(
      tr(
        lang,
        "Dit kan een logische combinatie zijn binnen één routine, afhankelijk van je huid en hoe gevoelig die reageert.",
        "This can be a logical combination within one routine, depending on your skin and how sensitive it is."
      )
    );
  }

  if (!bothActive) {
    if (firstType === "spf" || secondType === "spf") {
      const spfProduct = firstType === "spf" ? first : second;
      const otherProduct = spfProduct.title === first.title ? second : first;
      notes.push(
        tr(
          lang,
          `Gebruik eerst **${otherProduct.title}** en breng **${spfProduct.title}** als laatste stap in de ochtend aan.`,
          `Use **${otherProduct.title}** first and apply **${spfProduct.title}** as the final step in the morning.`
        )
      );
    } else {
      notes.push(
        tr(
          lang,
          `Gebruik eerst **${first.title}** en daarna **${second.title}**.`,
          `Use **${first.title}** first and then **${second.title}**.`
        )
      );
    }
  }

  if (firstTime === "morning" && secondTime === "morning") {
    notes.push(tr(lang, "Deze combinatie past het best in de ochtend.", "This combination fits best in the morning."));
  } else if (firstTime === "evening" && secondTime === "evening") {
    notes.push(tr(lang, "Deze combinatie past het best in de avond.", "This combination fits best in the evening."));
  } else if (bothActive) {
    notes.push(tr(lang, "Gebruik overdag altijd SPF als je met actievere producten werkt.", "Always use SPF during the day when using more active products."));
  }

  const pairNoteA = lang === "nl" ? a.pairing_note_nl : a.pairing_note_en;
  const pairNoteB = lang === "nl" ? b.pairing_note_nl : b.pairing_note_en;

  if (pairNoteA) notes.push(pairNoteA);
  if (pairNoteB && pairNoteB !== pairNoteA) notes.push(pairNoteB);

  return [title, ...notes].join("\n\n");
}

function buildSingleProductPairingReply(product: Product, lang: Lang): string {
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

  const lines = products.map((p) => `**${p.title}**\n${getSafeShortCopy(p, lang)}`);

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
    const recentProducts = getRecentMentionedProducts(userTimeline);

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

    // 2. plural reference like "how do i use those"
    if (detectPluralReference(message) && recentProducts.length >= 2) {
      if (detectUsageRequest(message)) {
        const chosen = recentProducts.slice(0, 2);
        return new Response(
          JSON.stringify({
            reply: buildMultiProductUsageReply(chosen, lang),
            actions: chosen.flatMap((p) => buildActionsForProduct(p, lang)).slice(0, 2),
            lang,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (detectCombinationRequest(message)) {
        const chosen = recentProducts.slice(0, 2);
        return new Response(
          JSON.stringify({
            reply: buildDynamicCombinationReply(chosen[0], chosen[1], lang),
            actions: chosen.flatMap((p) => buildActionsForProduct(p, lang)).slice(0, 2),
            lang,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // 3. ambiguous single reference handling
    if (
      detectAmbiguousReference(message) ||
      ((detectUsageRequest(message) || detectCombinationRequest(message) || detectWhereRequest(message) || detectSuitabilityRequest(message)) &&
        !mentionedProducts.length &&
        !looseProduct &&
        !mentionedBundles.length)
    ) {
      if (recentProducts.length === 1) {
        const resolved = recentProducts[0];

        if (detectUsageRequest(message)) {
          return new Response(
            JSON.stringify({
              reply: buildProductUsageReply(resolved, lang),
              actions: buildActionsForProduct(resolved, lang),
              lang,
            }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        if (detectCombinationRequest(message)) {
          return new Response(
            JSON.stringify({
              reply: buildSingleProductPairingReply(resolved, lang),
              actions: buildActionsForProduct(resolved, lang),
              lang,
            }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        if (detectWhereRequest(message)) {
          return new Response(
            JSON.stringify({
              reply: tr(lang, `**${resolved.title}**\n\nJe vindt het hier.`, `**${resolved.title}**\n\nYou can find it here.`),
              actions: buildActionsForProduct(resolved, lang),
              lang,
            }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }

      if (recentProducts.length >= 2) {
        return new Response(
          JSON.stringify({
            reply: buildClarifyProductReply(recentProducts, lang),
            actions: recentProducts.slice(0, 2).flatMap((p) => buildActionsForProduct(p, lang)),
            lang,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // 4. usage bundle
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

    // 5. usage product
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

    // 6. combinations
    if (detectCombinationRequest(message)) {
      const explicitProducts = mentionedProducts.length ? mentionedProducts : looseProduct ? [looseProduct] : [];

      if (explicitProducts.length >= 2) {
        return new Response(
          JSON.stringify({
            reply: buildDynamicCombinationReply(explicitProducts[0], explicitProducts[1], lang),
            actions: [buildActionsForProduct(explicitProducts[0], lang)[0], buildActionsForProduct(explicitProducts[1], lang)[0]].slice(0, 2),
            lang,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (explicitProducts.length === 1) {
        return new Response(
          JSON.stringify({
            reply: buildSingleProductPairingReply(explicitProducts[0], lang),
            actions: buildActionsForProduct(explicitProducts[0], lang),
            lang,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // 7. compare
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

    // 8. where
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

    // 9. suitability
    if (detectSuitabilityRequest(message) && (mentionedProducts.length === 1 || looseProduct)) {
      const product = mentionedProducts[0] || looseProduct!;
      return new Response(
        JSON.stringify({
          reply: tr(
            lang,
            `**${product.title}**\n\n${getSafeShortCopy(product, lang)}\n\nVertel me wat voor huid je hebt en wat je doel is, dan zeg ik of dit goed past.`,
            `**${product.title}**\n\n${getSafeShortCopy(product, lang)}\n\nTell me your skin type and goal, and I’ll tell you if it fits.`
          ),
          actions: buildActionsForProduct(product, lang),
          lang,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 10. routine to quiz
    if (shouldRedirectToQuiz(message, combinedUserText)) {
      const quizOut = buildQuizRedirectReply(lang);
      return new Response(
        JSON.stringify(quizOut),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 11. specific product
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

    // 12. specific bundle
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
