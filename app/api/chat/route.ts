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
    "Vary": "Origin",
  };
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(origin),
  });
}

// Load catalogs
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
  pairing_source?: string;
};

type BundleCatalog = { bundles: Bundle[] };
type ProductCatalog = { products: Product[] };

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

const QUIZ_URL = "https://sovahcare.com/pages/find-your-routine";

const bundleCatalog: BundleCatalog = JSON.parse(BUNDLES_JSON);
const productCatalog: ProductCatalog = JSON.parse(PRODUCTS_JSON);

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function hasExactWord(text: string, words: string[]): boolean {
  return words.some((word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|\\s)${escaped}(\\s|$)`, "i").test(text);
  });
}

function countMatches(text: string, words: string[]): number {
  return words.reduce((acc, word) => acc + (text.includes(word) ? 1 : 0), 0);
}

function detectLanguage(currentMessage: string, historyText = "", forcedLang?: string): Lang {
  if (forcedLang === "nl" || forcedLang === "en") {
    return forcedLang;
  }

  const current = normalize(currentMessage);
  const history = normalize(historyText);

  const dutchSignals = [
    "ik", "mijn", "huid", "droog", "droge", "vette", "vet", "gevoelig",
    "gevoelige", "welke", "wat", "past", "bij", "mij", "puistjes",
    "acne", "stralend", "hydratatie", "dagcreme", "dagcrème",
    "nachtcreme", "nachtcrème", "routine", "gezicht", "hulp", "advies",
    "waarom", "geen", "bedoel", "wil", "heb", "last van", "meer glow",
    "doffe huid", "normale huid", "welk product", "wat raad je aan",
    "hoe gebruik", "hoe moet ik", "wanneer gebruik", "hoe vaak", "combineren",
    "aanraden", "paar producten", "geen routine", "oudere huid",
    "fijne lijntjes", "rimpels", "gevoelige huid", "puistjes", "droge huid"
  ];

  const englishSignals = [
    "my", "skin", "dry", "oily", "sensitive", "which", "what", "routine",
    "fits", "best", "glow", "breakouts", "hydration", "cleanser", "serum",
    "help", "advice", "radiance", "moisture", "why", "don't", "mean",
    "want", "have", "product", "dull skin", "fine lines", "recommend",
    "how do i use", "when do i use", "how often", "can i combine", "combine",
    "few products", "not a full routine", "only products", "older skin",
    "wrinkles", "sensitive skin", "dry skin"
  ];

  const currentNl = countMatches(current, dutchSignals);
  const currentEn = countMatches(current, englishSignals);
  const historyNl = countMatches(history, dutchSignals);
  const historyEn = countMatches(history, englishSignals);

  const nlScore = currentNl * 3 + historyNl;
  const enScore = currentEn * 3 + historyEn;

  return nlScore >= enScore ? "nl" : "en";
}

function tr(lang: Lang, nl: string, en: string): string {
  return lang === "nl" ? nl : en;
}

function extractUserMessages(history: string[]): string[] {
  return history
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => item.toLowerCase().startsWith("user:"))
    .map((item) => item.replace(/^user:\s*/i, "").trim());
}

function isShortMessage(text: string): boolean {
  return normalize(text).split(" ").filter(Boolean).length <= 4;
}

// ─── Catalog helpers ────────────────────────────────────────────────────────

function getBundleByName(name: string): Bundle | undefined {
  return bundleCatalog.bundles.find((b) => b.name === name);
}

function getProductByName(name: string): Product | undefined {
  return productCatalog.products.find((p) => p.title === name);
}

function getShortProductCopy(product: Product, lang: Lang): string {
  return lang === "nl"
    ? product.short_copy_nl || "Een product uit het huidige SOVAH assortiment."
    : product.short_copy_en || "A product from the current SOVAH range.";
}

function getProductUsage(product: Product, lang: Lang): string | null {
  return (lang === "nl" ? product.usage_nl : product.usage_en) || null;
}

function getProductWhenToUse(product: Product, lang: Lang): string | null {
  return (lang === "nl" ? product.when_to_use_nl : product.when_to_use_en) || null;
}

function getProductRoutineStep(product: Product, lang: Lang): string | null {
  return (lang === "nl" ? product.routine_step_nl : product.routine_step_en) || null;
}

function getProductPairingNote(product: Product, lang: Lang): string | null {
  return (lang === "nl" ? product.pairing_note_nl : product.pairing_note_en) || null;
}

function findMentionedProducts(text: string): Product[] {
  const t = normalizeLoose(text);
  return productCatalog.products.filter((p) => t.includes(normalizeLoose(p.title)));
}

function findMentionedBundles(text: string): Bundle[] {
  const t = normalizeLoose(text);
  return bundleCatalog.bundles.filter((b) => t.includes(normalizeLoose(b.name)));
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
    "Sun Protection SPF50 Stick, no tint": ["spf stick", "sun stick", "spf50 stick", "sun protection stick", "zonnebescherming", "spf"],
    "Micellar Cleansing Water": ["micellar", "micellar cleansing water", "reinigingswater"],
    "Calming Facial Oil": ["calming oil", "facial oil", "calming facial oil", "gezichtsolie"],
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

function findBundleFromLooseIntent(text: string): Bundle | undefined {
  const t = normalizeLoose(text);
  return bundleCatalog.bundles.find((b) => t.includes(normalizeLoose(b.name)));
}

// ─── Intent detection ───────────────────────────────────────────────────────

function detectConversationIntent(text: string): ConversationIntent {
  const t = normalize(text);

  if (
    hasExactWord(t, ["hello", "hi", "hey", "hallo", "yo", "hoi"]) ||
    hasAny(t, ["good morning", "good afternoon", "good evening", "goedemorgen", "goedemiddag", "goedenavond"])
  ) return "greeting";

  if (hasAny(t, ["thanks", "thank you", "thx", "ty", "bedankt", "dankje", "dankjewel", "merci"])) {
    return "thanks";
  }

  if (hasAny(t, ["bye", "goodbye", "see you", "later", "doei", "tot ziens", "dag"])) {
    return "bye";
  }

  if (
    hasAny(t, [
      "help", "can you help me", "what can you do", "how can you help",
      "wat kan je", "wat kun je", "kun je me helpen", "kan je me helpen"
    ])
  ) return "help";

  if (hasExactWord(t, ["yes", "yeah", "yep", "sure", "okay", "ok", "oke", "alright", "ja", "jup", "jep"])) {
    return "yes";
  }

  if (hasExactWord(t, ["no", "nope", "nah", "nee"])) {
    return "no";
  }

  if (
    hasAny(t, [
      "i dont know", "i don't know", "idk", "not sure", "confused",
      "ik weet het niet", "geen idee", "weet ik niet"
    ])
  ) return "confused";

  if (
    hasAny(t, [
      "huh", "hmm", "uh", "umm", "random", "weird",
      "my skin is weird", "not sure what i need"
    ])
  ) return "unclear";

  if (
    hasAny(t, [
      "how are you", "you there", "are you real", "can we talk", "talk to me",
      "hoe gaat het", "ben je er", "spreek je nederlands"
    ])
  ) return "human_chat";

  return null;
}

function buildConversationReply(intent: ConversationIntent, lang: Lang): string | null {
  if (intent === "greeting") {
    return tr(
      lang,
      "Hi! Ik ben de SOVAH skincare assistant. Vertel me waar je hulp bij wilt, dan help ik je verder.",
      "Hello! I'm the SOVAH skincare assistant. Tell me what you'd like help with, and I'll help from there."
    );
  }

  if (intent === "thanks") return tr(lang, "Graag gedaan!", "You're welcome!");
  if (intent === "bye") return tr(lang, "Tot snel 🌿", "Goodbye! 🌿");

  if (intent === "help") {
    return tr(
      lang,
      "Ik kan je helpen met productvragen, hoe je producten gebruikt, combinaties tussen producten, productaanbevelingen en algemene keuzehulp. Voor de beste routine-match kun je ook onze quiz gebruiken.",
      "I can help with product questions, how to use products, product combinations, product recommendations, and general skincare guidance. For the best routine match, you can also use our quiz."
    );
  }

  if (intent === "yes") {
    return tr(
      lang,
      "Top. Vertel me wat voor huid je hebt of welk product je bedoelt.",
      "Great. Tell me your skin type or which product you mean."
    );
  }

  if (intent === "no") {
    return tr(
      lang,
      "Geen probleem. Vertel me maar waar je wél hulp bij wilt.",
      "No problem. Tell me what you would like help with instead."
    );
  }

  if (intent === "confused") {
    return tr(
      lang,
      "Geen stress. Vertel me gewoon of je hulp wilt met een product, met hoe je het gebruikt, met een paar producten, of met het kiezen van een routine.",
      "No worries. Just tell me whether you want help with a product, how to use it, a few products, or choosing a routine."
    );
  }

  if (intent === "unclear") {
    return tr(
      lang,
      "Ik snap nog niet helemaal wat je bedoelt. Gaat het om een product, hoe je iets gebruikt, een paar producten, of wil je hulp met je huid?",
      "I'm not fully sure what you mean yet. Is it about a product, how to use something, a few products, or do you want help with your skin?"
    );
  }

  if (intent === "human_chat") {
    return tr(
      lang,
      "Ja hoor, ik ben er. Vertel me waar je hulp bij wilt.",
      "Yes, I'm here. Tell me what you'd like help with."
    );
  }

  return null;
}

function detectCompareRequest(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "compare", "difference", "what is better", "which is better", "vs", "versus",
    "vergelijk", "verschil", "wat is beter", "welke is beter"
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

function detectWhereRequest(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "where", "where can i find", "find", "show me", "send me",
    "waar", "waar vind", "vinden", "geef me de link", "stuur me"
  ]);
}

function detectUsageRequest(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "how do i use", "how should i use", "when do i use", "how often",
    "how many times", "how to use", "before or after", "step in routine",
    "hoe gebruik ik", "hoe moet ik gebruiken", "wanneer gebruik ik",
    "hoe vaak", "hoe moet ik dit gebruiken", "voor of na", "welke stap",
    "in welke stap", "hoe moet ik de", "hoe gebruik je"
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

function detectBundleUsageRequest(text: string): boolean {
  return detectUsageRequest(text);
}

function detectDrySignal(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "dry", "dehydrated", "droog", "droge huid", "uitgedroogd", "vochttekort", "tight", "flaky"
  ]);
}

function detectGlowSignal(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "glow", "radiance", "dull", "stralend", "doffe huid", "dof", "meer glow", "frissere huid", "frissere uitstraling"
  ]);
}

function detectBreakoutSignal(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "acne", "puistjes", "breakouts", "blemishes", "spots", "onzuiverheden"
  ]);
}

function detectSensitiveSignal(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "sensitive", "gevoelig", "reactive", "reactief", "irritated", "geïrriteerd", "geirriteerd", "redness", "roodheid"
  ]);
}

function detectAntiAgeSignal(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "anti age", "anti-age", "anti aging", "anti-aging", "fine lines",
    "wrinkles", "rimpels", "fijne lijntjes", "firmness", "stevigheid",
    "older skin", "oudere huid", "verouderende huid"
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
    "maar een paar producten",
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
    "ik wil 1 2 producten voor droge huid",
    "ik wil 1-2 producten voor droge huid",
    "ik wil 1 2 producten voor puistjes",
    "ik wil 1-2 producten voor puistjes",
    "ik wil 1 2 producten voor oudere huid",
    "ik wil 1-2 producten voor oudere huid",
    "ik wil 1 2 producten voor glow",
    "ik wil 1-2 producten voor glow",
    "i want 1 2 products for dry skin",
    "i want 1-2 products for dry skin",
    "i want 1 2 products for breakouts",
    "i want 1-2 products for breakouts",
    "i want 1 2 products for older skin",
    "i want 1-2 products for older skin",
    "i want 1 2 products for glow",
    "i want 1-2 products for glow"
  ]);
}

function detectSkinSignals(text: string): string[] {
  const t = normalize(text);
  const found = new Set<string>();

  if (hasAny(t, ["dry", "dehydrated", "droog", "droge huid", "uitgedroogd", "vochttekort", "tight", "flaky"])) found.add("dry");
  if (hasAny(t, ["oily", "vet", "vette huid", "glimmend", "shiny", "greasy"])) found.add("oily");
  if (hasAny(t, ["combination", "combinatie", "combinatiehuid", "t-zone", "combo"])) found.add("combination");
  if (hasAny(t, ["sensitive", "gevoelig", "reactive", "reactief", "roodheid", "irritated", "geïrriteerd", "geirriteerd"])) found.add("sensitive");
  if (hasAny(t, ["normal", "normaal", "normale huid", "balanced", "gebalanceerd"])) found.add("normal");
  if (hasAny(t, ["glow", "doffe huid", "dof", "radiance", "stralend", "meer glow", "dull"])) found.add("glow");
  if (hasAny(t, ["acne", "puistjes", "breakouts", "blemishes", "spots", "onzuiverheden", "mee eters", "mee-eters"])) found.add("breakouts");
  if (hasAny(t, ["anti age", "anti-age", "anti aging", "anti-aging", "fine lines", "wrinkles", "rimpels", "fijne lijntjes", "firmness", "stevigheid", "older skin", "oudere huid"])) found.add("antiage");
  if (hasAny(t, ["simple", "simpel", "easy routine", "geen gedoe", "makkelijke routine"])) found.add("simple");

  return Array.from(found);
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
    "what do you recommend",
    "recommend me a routine",
    "recommend something for my skin",
    "what should i use",
    "what do i need",
    "what fits my skin",
    "find my routine",
    "ik weet niet wat ik nodig heb",
    "wat raad je aan",
    "welke routine past bij mij",
    "welke routine",
    "beste routine voor mij",
    "wat past bij mijn huid",
    "welke producten heb ik nodig",
    "routine voor mijn huid",
    "beste match voor mijn huid",
    "wat moet ik gebruiken",
    "help me kiezen"
  ]);
}

function detectCorrectionMessage(text: string): boolean {
  const t = normalize(text);

  return hasAny(t, [
    "ik bedoel",
    "nee dat bedoel ik niet",
    "niet daarvoor",
    "geen acne maar",
    "niet acne maar",
    "meer glow",
    "meer hydratatie",
    "not acne",
    "i mean",
    "that's not what i mean",
    "that is not what i mean",
    "no i mean",
    "i dont mean",
    "i don't mean",
    "instead",
    "rather"
  ]);
}

function detectNotKnowingSkinType(text: string): boolean {
  const t = normalize(text);

  return hasAny(t, [
    "ik weet mijn huidtype niet",
    "huid type weet ik niet",
    "huidtype weet ik niet",
    "ik weet niet wat mijn huidtype is",
    "ik weet niet welk huidtype ik heb",
    "i dont know my skin type",
    "i don't know my skin type",
    "not sure what my skin type is",
    "i don't know what skin type i have",
    "ik weet het huidtype niet"
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

function isSpecificProductQuestion(message: string): boolean {
  const mentionedProducts = findMentionedProducts(message);
  const looseProduct = findProductFromLooseIntent(message);

  if (!(mentionedProducts.length === 1 || looseProduct)) return false;

  if (detectRoutineHelpRequest(message)) return false;
  if (detectCorrectionMessage(message)) return false;
  if (detectNotKnowingSkinType(message)) return false;
  if (detectCombinationRequest(message) && findMentionedProducts(message).length >= 2) return false;
  if (detectProductRecommendationRequest(message)) return false;

  return true;
}

function shouldRedirectToQuiz(message: string, combinedUserText: string): boolean {
  const current = normalize(message);
  const totalSignals = detectSkinSignals(combinedUserText);

  if (detectUsageRequest(message)) return false;
  if (detectCombinationRequest(message)) return false;
  if (detectProductRecommendationRequest(message)) return false;
  if (detectProductOnlyPreference(message)) return false;
  if (isSpecificProductQuestion(message)) return false;
  if (detectCompareRequest(message)) return false;
  if (detectSuitabilityRequest(message) && isSpecificProductQuestion(message)) return false;
  if (detectWhereRequest(message) && isSpecificProductQuestion(message)) return false;

  if (detectRoutineHelpRequest(message)) return true;
  if (detectNotKnowingSkinType(message)) return true;
  if (detectBroadSkinGoal(message) && !detectProductOnlyPreference(message)) return true;
  if (detectCorrectionMessage(message) && !detectProductOnlyPreference(message)) return true;

  const currentSignals = detectSkinSignals(message);

  if (currentSignals.length >= 2) return true;

  if (
    currentSignals.length >= 1 &&
    hasAny(current, [
      "wat raad je aan", "what do you recommend", "help", "hulp", "voor mijn huid",
      "for my skin", "wat moet ik", "what should i", "wat past", "what fits"
    ]) &&
    !detectProductRecommendationRequest(message) &&
    !detectProductOnlyPreference(message)
  ) {
    return true;
  }

  if (
    isShortMessage(message) &&
    totalSignals.length >= 1 &&
    hasAny(current, ["ja", "nee", "yes", "no", "oke", "ok", "meer", "instead", "bedoel", "droog", "vet", "gevoelig", "normal", "normaal"]) &&
    !detectProductOnlyPreference(message)
  ) {
    return true;
  }

  if (totalSignals.length >= 2 && !detectProductOnlyPreference(message)) {
    return true;
  }

  return false;
}

// ─── Recommendation helpers ─────────────────────────────────────────────────

function recommendProductsFromText(text: string): Product[] {
  const picks: Product[] = [];

  const add = (title: string) => {
    const p = getProductByName(title);
    if (p && !picks.find((x) => x.title === p.title)) {
      picks.push(p);
    }
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

  const lines = products.map((p) => `**${p.title}**\n${getShortProductCopy(p, lang)}`);

  return `${intro}\n\n${lines.join("\n\n")}`;
}

// ─── Reply builders ─────────────────────────────────────────────────────────

function buildQuizRedirectReply(lang: Lang): { reply: string; actions: ChatAction[]; lang: Lang } {
  return {
    reply: tr(
      lang,
      "Voor de beste routine-match kun je het beste onze skincare quiz doen.\n\nDaar begeleiden we je stap voor stap naar de juiste routine voor jouw huid.",
      "For the best routine match, the best next step is our skincare quiz.\n\nThere we guide you step by step to the right routine for your skin."
    ),
    actions: [
      {
        type: "OPEN_URL",
        label: tr(lang, "Start de quiz", "Start quiz"),
        url: QUIZ_URL,
      },
    ],
    lang,
  };
}

function buildActionsForProduct(product: Product, lang: Lang): ChatAction[] {
  return [
    {
      type: "OPEN_URL",
      label: tr(lang, "Bekijk product", "View product"),
      url: product.url,
    },
  ];
}

function buildActionsForBundle(bundle: Bundle, lang: Lang): ChatAction[] {
  return [
    {
      type: "OPEN_URL",
      label: tr(lang, "Bekijk routine", "View routine"),
      url: bundle.url,
    },
  ];
}

function buildProductReply(product: Product, lang: Lang): string {
  return `**${product.title}**\n\n${getShortProductCopy(product, lang)}`;
}

function buildProductUsageReply(product: Product, lang: Lang): string {
  const parts: string[] = [`**${product.title}**`];

  const usage = getProductUsage(product, lang);
  const when = getProductWhenToUse(product, lang);
  const step = getProductRoutineStep(product, lang);

  if (usage) parts.push(usage);

  if (when) {
    parts.push(
      lang === "nl"
        ? `**Wanneer gebruik je het?**\n${when}`
        : `**When do you use it?**\n${when}`
    );
  }

  if (step) {
    parts.push(
      lang === "nl"
        ? `**Stap in je routine**\n${step}`
        : `**Step in your routine**\n${step}`
    );
  }

  if (!usage && !when && !step) {
    parts.push(
      tr(
        lang,
        "Ik heb hier nog geen volledige gebruiksinformatie voor, maar ik kan je wel helpen met een product dat hierbij past of met de juiste routine via de quiz.",
        "I don't have the full usage details here yet, but I can help with a product that pairs well with it or with the right routine via the quiz."
      )
    );
  }

  return parts.join("\n\n");
}

function buildProductCombinationReply(product: Product, partner: Product | null, lang: Lang): string {
  const parts: string[] = [];

  if (partner) {
    parts.push(`**${product.title} + ${partner.title}**`);

    const canPair =
      (product.pairs_well_with || []).includes(partner.title) ||
      (partner.pairs_well_with || []).includes(product.title);

    parts.push(
      canPair
        ? tr(lang, "Dit is een logische combinatie binnen een routine.", "This is a logical combination within a routine.")
        : tr(lang, "Dit kan soms binnen één routine passen, maar het hangt af van je huid en hoe actief de rest van je routine al is.", "This can sometimes fit within one routine, but it depends on your skin and how active the rest of your routine already is.")
    );

    const noteA = getProductPairingNote(product, lang);
    const noteB = getProductPairingNote(partner, lang);

    if (noteA) parts.push(noteA);
    if (noteB && noteB !== noteA) parts.push(noteB);
  } else {
    parts.push(`**${product.title}**`);

    if (product.pairs_well_with?.length) {
      const intro = tr(lang, "Producten die hier goed bij passen:", "Products that pair well with this:");
      parts.push(`${intro}\n${product.pairs_well_with.map((p) => `- ${p}`).join("\n")}`);
    }

    const note = getProductPairingNote(product, lang);
    if (note) parts.push(note);
  }

  return parts.join("\n\n");
}

function buildBundleReply(bundle: Bundle, lang: Lang): string {
  const productsPart = bundle.products?.length
    ? tr(
        lang,
        `Wat erin zit:\n${bundle.products.map((p) => `- ${p}`).join("\n")}`,
        `Included products:\n${bundle.products.map((p) => `- ${p}`).join("\n")}`
      )
    : "";

  return [
    `**${bundle.name}**`,
    bundle.description || tr(lang, "Routine uit het huidige SOVAH assortiment.", "Routine from the current SOVAH range."),
    productsPart,
  ].filter(Boolean).join("\n\n");
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

  if (patch) {
    parts.push(`**Patch test**\n${patch}`);
  }

  if (caution) {
    parts.push(
      lang === "nl"
        ? `**Let op**\n${caution}`
        : `**Caution**\n${caution}`
    );
  }

  if (parts.length === 1) {
    parts.push(
      tr(
        lang,
        "Ik heb hier nog geen volledige how-to-use voor, maar ik kan je wel helpen met producten uit deze routine of met de quiz.",
        "I don't have the full how-to-use for this here yet, but I can help with products from this routine or with the quiz."
      )
    );
  }

  return parts.join("\n\n");
}

function buildCompareReply(items: (Bundle | Product)[], lang: Lang): string {
  const firstName = "name" in items[0] ? items[0].name : items[0].title;
  const secondName = "name" in items[1] ? items[1].name : items[1].title;

  return tr(
    lang,
    `**${firstName}** vs **${secondName}**\n\nVertel me wat voor huid je hebt of wat je doel is, dan help ik je kiezen welke beter past.`,
    `**${firstName}** vs **${secondName}**\n\nTell me your skin type or goal, and I’ll help you choose which one fits better.`
  );
}

// ─── Claude fallback ────────────────────────────────────────────────────────

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

    const messages = [
      {
        role: "user" as const,
        content: history.length
          ? `Previous customer context:\n${history.join("\n")}\n\nCurrent customer message:\n${message}`
          : message,
      },
    ];

    const systemPrompt = `You are the SOVAH skincare assistant for sovahcare.com.

Use only the provided bundle and product catalog as source of truth.
Do not use website content outside the catalog, scraped content, or outside product information.
Do not invent products, ingredients, medical claims, or unsupported benefits.

Available bundles: ${bundleList}
Available products: ${productList}

Rules:
- Always reply in the customer's language.
- Keep replies short, natural, practical, and premium.
- In Dutch, use natural webshop Dutch, not stiff translated Dutch.
- If the user asks which routine fits them, what you recommend for their skin as a full routine, says they do not know their skin type, mentions multiple skin concerns, or gives correction-style skin input, prefer the skincare quiz.
- If the user asks for one product or a few products, do not force the quiz.
- If the user asks about one specific product, answer directly.
- If the user asks how to use a product or when to use it, answer directly using the catalog.
- If the user asks how to use a bundle or routine, answer directly using the catalog.
- If the user asks what combines well with a product, answer directly using the catalog.
- If the user compares products, answer directly.
- If the user asks where to find a product, answer directly with the product link.
- Never recommend Acne Spot Care if the user clearly says they do not have acne or breakouts.
- Ask at most one short clarifying question only if truly needed.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 350,
      system: systemPrompt,
      messages,
    });

    const text =
      response.content[0]?.type === "text"
        ? response.content[0].text
        : tr(
            lang,
            "Vertel me wat voor product of routine je bedoelt, dan help ik je verder.",
            "Tell me which product or routine you mean, and I'll help from there."
          );

    const mentionedProducts = findMentionedProducts(text);
    const mentionedBundles = findMentionedBundles(text);

    let actions: ChatAction[] = [];

    if (mentionedBundles.length > 0) {
      actions = buildActionsForBundle(mentionedBundles[0], lang);
    } else if (mentionedProducts.length > 0) {
      actions = buildActionsForProduct(mentionedProducts[0], lang);
    }

    return { reply: text, actions: actions.slice(0, 2), lang };
  } catch (err) {
    console.error("Claude API error:", err);
    return {
      reply: tr(
        lang,
        "Ik weet nog niet helemaal wat je bedoelt. Vertel me welk product of welke routine je bedoelt, dan help ik je verder.",
        "I'm not fully sure what you mean yet. Tell me which product or routine you mean, and I'll help from there."
      ),
      actions: [],
      lang,
    };
  }
}

// ─── Main handler ───────────────────────────────────────────────────────────

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

    const shouldUseConversationIntent =
      isShortMessage(message) &&
      !mentionedProducts.length &&
      !mentionedBundles.length &&
      !looseProduct &&
      !shouldRedirectToQuiz(message, combinedUserText) &&
      !detectCompareRequest(message) &&
      !detectSuitabilityRequest(message) &&
      !detectWhereRequest(message) &&
      !detectUsageRequest(message) &&
      !detectCombinationRequest(message) &&
      !detectProductRecommendationRequest(message);

    if (shouldUseConversationIntent) {
      const conversationIntent = detectConversationIntent(message);
      const conversationReply = buildConversationReply(conversationIntent, lang);

      if (conversationReply) {
        return new Response(
          JSON.stringify({ reply: conversationReply, actions: [], lang }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Product recommendation first when user does NOT want a full routine
    if (
      detectProductRecommendationRequest(message) ||
      detectProductOnlyPreference(message) ||
      (detectProductOnlyPreference(combinedUserText) && detectSkinSignals(combinedUserText).length >= 1)
    ) {
      const picks = recommendProductsFromText(combinedUserText);

      if (picks.length) {
        return new Response(
          JSON.stringify({
            reply: buildProductRecommendationReply(picks, lang),
            actions: picks.flatMap((p) => buildActionsForProduct(p, lang)).slice(0, 2),
            lang,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Quiz for broader routine guidance
    if (shouldRedirectToQuiz(message, combinedUserText)) {
      const quizOut = buildQuizRedirectReply(lang);
      return new Response(
        JSON.stringify(quizOut),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Bundle usage
    if (detectBundleUsageRequest(message)) {
      const bundle =
        mentionedBundles[0] ||
        findBundleFromLooseIntent(message);

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

    // Product usage
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

    // Product combinations
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

      if (mentionedBundles.length === 1) {
        const bundle = mentionedBundles[0];
        const note = lang === "nl" ? bundle.combination_note_nl : bundle.combination_note_en;
        const intro = tr(
          lang,
          `**${bundle.name}**\n\nProducten die hier goed bij passen:`,
          `**${bundle.name}**\n\nProducts that pair well with this:`
        );
        const combined = bundle.best_combined_with?.length
          ? `${intro}\n${bundle.best_combined_with.map((p) => `- ${p}`).join("\n")}${note ? `\n\n${note}` : ""}`
          : note || tr(lang, "Ik heb hier nog geen combinatie-info voor.", "I don't have pairing info for this yet.");

        return new Response(
          JSON.stringify({
            reply: combined,
            actions: buildActionsForBundle(bundle, lang),
            lang,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Compare requests
    if (detectCompareRequest(message)) {
      const compareItems = [...mentionedBundles, ...mentionedProducts].slice(0, 2);
      if (compareItems.length === 2) {
        return new Response(
          JSON.stringify({
            reply: buildCompareReply(compareItems, lang),
            actions: [],
            lang,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Suitability question for one product
    if (detectSuitabilityRequest(message) && (mentionedProducts.length === 1 || looseProduct)) {
      const product = mentionedProducts[0] || looseProduct!;
      const pairing = getProductPairingNote(product, lang);
      return new Response(
        JSON.stringify({
          reply: tr(
            lang,
            `**${product.title}**\n\n${getShortProductCopy(product, lang)}\n\nVertel me wat voor huid je hebt en wat je doel is, dan zeg ik of dit goed past.${pairing ? `\n\n${pairing}` : ""}`,
            `**${product.title}**\n\n${getShortProductCopy(product, lang)}\n\nTell me your skin type and goal, and I’ll tell you if it fits.${pairing ? `\n\n${pairing}` : ""}`
          ),
          actions: buildActionsForProduct(product, lang),
          lang,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Where / link request for one product
    if (detectWhereRequest(message) && (mentionedProducts.length === 1 || looseProduct)) {
      const product = mentionedProducts[0] || looseProduct!;
      return new Response(
        JSON.stringify({
          reply: tr(
            lang,
            `**${product.title}**\n\nJe vindt het hier.`,
            `**${product.title}**\n\nYou can find it here.`
          ),
          actions: buildActionsForProduct(product, lang),
          lang,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Specific product info
    if (mentionedProducts.length === 1 && !detectCompareRequest(message) && !detectSuitabilityRequest(message) && !detectUsageRequest(message) && !detectCombinationRequest(message) && !detectProductRecommendationRequest(message)) {
      const product = mentionedProducts[0];
      return new Response(
        JSON.stringify({
          reply: buildProductReply(product, lang),
          actions: buildActionsForProduct(product, lang),
          lang,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (looseProduct && !detectCompareRequest(message) && !detectSuitabilityRequest(message) && !detectWhereRequest(message) && !detectUsageRequest(message) && !detectCombinationRequest(message) && !detectProductRecommendationRequest(message)) {
      return new Response(
        JSON.stringify({
          reply: buildProductReply(looseProduct, lang),
          actions: buildActionsForProduct(looseProduct, lang),
          lang,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Bundle info
    if (mentionedBundles.length === 1 && !detectUsageRequest(message) && !detectCombinationRequest(message)) {
      const bundle = mentionedBundles[0];
      return new Response(
        JSON.stringify({
          reply: buildBundleReply(bundle, lang),
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
