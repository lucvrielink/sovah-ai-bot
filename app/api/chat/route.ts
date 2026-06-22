import fs from "fs";
import path from "path";
import OpenAI from "openai";

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

type Lang = "nl" | "en" | "de";
type SkinType =
  | "dry"
  | "oily"
  | "combination"
  | "sensitive"
  | "normal"
  | null;

type Bundle = {
  name: string;
  old_name?: string;
  old_names?: string[];
  handle?: string;
  type?: string;
  target?: string;
  url: string;
  image?: string;
  price?: string;
  description?: string;
  products?: string[];
  bundle_products?: Array<string | { title?: string; name?: string; url?: string; image?: string }>;
  routing_priority?: number;
  quiz_route?: string[];
  quiz_route_misspellings?: string[];
  ai_routing_support?: unknown;
  chat_route?: string;
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
  ai_detection?: {
    routing_mode?: string;
    normal_routes?: string[];
    customer_language_routes?: string[];
    skin_concern_routes?: string[];
    usage_intent_routes?: string[];
    misspellings?: string[];
    do_not_recommend_when?: string[];
    recommendation_priority?: string;
  };
};

type BundleCatalog = { bundles: Bundle[] };
type ProductCatalog = { products: Product[] };

type ChatAction =
  | {
      type: "OPEN_URL";
      label: string;
      url: string;
    }
  | {
      type: "ROUTINE_CARD";
      label: string;
      title: string;
      url: string;
      image?: string;
      price?: string;
    };

type ModelTier = "none" | "mini" | "full";

const QUIZ_URL = "https://sovahcare.com/pages/find-your-routine";

const bundleCatalog: BundleCatalog = JSON.parse(BUNDLES_JSON);
const productCatalog: ProductCatalog = JSON.parse(PRODUCTS_JSON);

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

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

function translateKnownEnglishToGerman(text: string): string {
  const trimmed = (text || "").trim();

  if (
    trimmed.includes("I'm not fully sure what you mean yet") ||
    trimmed.includes("I’m not fully sure what you mean yet")
  ) {
    return "Ich bin noch nicht ganz sicher, was du meinst. Sag mir kurz, ob du eine Routine, 1–2 Produkte oder Hilfe bei einem bestimmten Hautproblem suchst.";
  }

  return text
    .replace(/This bundle includes:/g, "Diese Routine enthält:")
    .replace(/The bundle includes:/g, "Diese Routine enthält:")
    .replace(/View routine/g, "Routine ansehen")
    .replace(/Start quiz/g, "Quiz starten")
    .replace(/Contact support/g, "Kontakt aufnehmen")
    .replace(/Tell me your skin type or what you'd mainly like help with, and I’ll recommend 1 or 2 suitable products\./g, "Sag mir deinen Hauttyp oder wobei du Hilfe brauchst, dann empfehle ich dir 1–2 passende Produkte.")
    .replace(/If you'd rather not go for a full routine, I’d keep it to these:/g, "Wenn du keine komplette Routine möchtest, würde ich es bei diesen Produkten halten:")
    .replace(/For the best routine match, the best next step is our skincare quiz\./g, "Für die beste Routine-Empfehlung ist unser Skincare-Quiz der sinnvollste nächste Schritt.")
    .replace(/There we guide you step by step to the right routine for your skin\./g, "Dort führen wir dich Schritt für Schritt zur passenden Routine für deine Haut.")
    .replace(/Hi! I’d be happy to help you find the right SOVAH products or routine\./g, "Hi! Ich helfe dir gerne, die passenden SOVAH Produkte oder die richtige Routine zu finden.")
    .replace(/Tell me your skin type or what you mainly want help with, like dryness, glow, breakouts, or sensitivity\./g, "Sag mir kurz deinen Hauttyp oder wobei du Hilfe brauchst, zum Beispiel Trockenheit, Glow, Pickel oder Empfindlichkeit.")
    .replace(/I’m not fully sure what you mean yet\./g, "Ich bin noch nicht ganz sicher, was du meinst.")
    .replace(/I'm not fully sure what you mean yet\./g, "Ich bin noch nicht ganz sicher, was du meinst.")
    .replace(/Tell me which product or routine you mean, and I’ll help from there\./g, "Sag mir, welches Produkt oder welche Routine du meinst, dann helfe ich dir weiter.")
    .replace(/Tell me your skin type and goal, and I’ll tell you if it fits\./g, "Sag mir deinen Hauttyp und dein Ziel, dann sage ich dir, ob es passt.")
    .replace(/You can find it here\./g, "Du findest es hier.")
    .replace(/Products that pair well with this:/g, "Produkte, die gut dazu passen:")
    .replace(/I don't have a pairing list for this yet\./g, "Dazu habe ich noch keine feste Kombinationsliste.")
    .replace(/That’s still a bit too general\./g, "Das ist noch etwas zu allgemein.")
    .replace(/Do you mean:/g, "Meinst du:")
    .replace(/Which one do you mean exactly\?/g, "Welches meinst du genau?")
    .replace(/For these products, I would use them like this:/g, "Diese Produkte würde ich so verwenden:")
    .replace(/When:/g, "Wann:")
    .replace(/Step:/g, "Schritt:");
}

function tr(lang: Lang, nl: string, en: string, de?: string): string {
  if (lang === "nl") return nl;
  if (lang === "de") return de || translateKnownEnglishToGerman(en);
  return en;
}

function languageName(lang: Lang): string {
  if (lang === "nl") return "Dutch";
  if (lang === "de") return "German";
  return "English";
}

// ───────────────── aliases / canonicalization ─────────────────

const PRODUCT_ALIASES: Record<string, string[]> = {
  "Micellar Cleansing Water": [
    "micellar cleansing water",
    "micellar water",
    "micellair water",
    "micelair water",
    "micellar cleanser",
    "cleansing water",
    "makeup remover",
    "make-up remover",
    "zachte reiniger",
    "milde reiniger",
    "reinigingswater",
  ],

  "Hydrating Toner": [
    "hydrating toner",
    "hydra toner",
    "toner",
    "face toner",
    "hydraterende toner",
    "vocht toner",
    "gezichtstoner",
    "tonic",
  ],

  "Hydrating Face Serum with Aloe & Hyaluronic Acid": [
    "hydrating face serum with aloe hyaluronic acid",
    "hydrating face serum",
    "hydrating serum",
    "hydra serum",
    "hydration serum",
    "hyaluronic acid serum",
    "hyaluronic serum",
    "aloe serum",
    "hydraterend serum",
    "vocht serum",
    "serum droge huid",
  ],

  "Hydration Boost Gel Moisturizer": [
    "hydration boost gel moisturizer",
    "hydration boost gel moisturiser",
    "double hydration boost gel + ha",
    "double hydration boost gel",
    "boost gel + ha",
    "hydration boost gel",
    "boost gel",
    "ha gel",
    "hyaluronic acid gel",
    "hydraterende gel",
    "hydratatie boost gel",
    "vochtboost gel",
  ],

  "Moisturising Day Face Cream with Hyaluronic Acid": [
    "moisturising day face cream with hyaluronic acid",
    "moisturising day face cream",
    "moisturising day cream",
    "moisturizing day cream",
    "moisture day cream",
    "hydrating day cream",
    "day cream",
    "face cream",
    "moisturizer",
    "moisturiser",
    "dagcreme",
    "dagcrème",
    "dag creme",
    "dag crème",
    "hydraterende creme",
    "hydraterende crème",
  ],

  "Ceramide Barrier Night Cream for Dry & Normal Skin": [
    "ceramide barrier night cream for dry normal skin",
    "ceramide barrier night cream",
    "ceramide night cream",
    "barrier night cream",
    "ceramide cream",
    "barrier cream",
    "night cream",
    "nachtcreme",
    "nachtcrème",
    "barriere creme",
    "barrière crème",
  ],

  "Purifying Mousse": [
    "purifying mousse",
    "purifying mouse",
    "purifing mousse",
    "purifiying mousse",
    "mousse cleanser",
    "cleansing mousse",
    "face mousse",
    "foam cleanser",
    "foaming cleanser",
    "schuimreiniger",
    "reinigingsmousse",
    "mousse",
  ],

  "Antioxidant Ginkgo Hydrating Gel Booster": [
    "antioxidant ginkgo hydrating gel booster",
    "antioxidant ginkgo gel booster",
    "ginkgo gel booster",
    "ginkgo booster",
    "ginko booster",
    "antioxidant booster",
    "glow booster",
    "gel booster",
  ],

  "Calming Facial Oil": [
    "calming facial oil",
    "calming oil",
    "face oil sensitive",
    "facial oil sensitive",
    "gezichtsolie gevoelige huid",
    "kalmerende olie",
    "comfort oil",
  ],

  "AHA Peeling Concentrate Exfoliating Face Serum": [
    "aha peeling concentrate exfoliating face serum",
    "aha peeling concentrate",
    "aha peeling",
    "aha",
    "aha concentrate",
    "aha acid",
    "aha acids",
    "ahas",
    "a h a",
    "chemical peeling",
    "peeling concentrate",
    "exfoliating serum",
    "exfoliating acid",
    "exfoliant",
    "acid peel",
    "peeling serum",
    "peeling concentraat",
    "zuur peeling",
  ],

  "Caffeine Hydrating Gel Booster for Face & Eyes": [
    "caffeine hydrating gel booster for face eyes",
    "caffeine gel booster",
    "caffeine booster",
    "caffeine gel",
    "cafeine booster",
    "cafeïne booster",
    "under eye booster",
    "eye booster",
    "wallen",
    "moe ogen",
  ],

  "Oil-Free Hydrating Gel Moisturizer": [
    "oil-free hydrating gel moisturizer",
    "oil free hydrating gel moisturizer",
    "oil-free hydrating gel moisturiser",
    "oil free hydrating gel moisturiser",
    "oil-free hydrating gel",
    "oil free hydrating gel",
    "oil-free gel",
    "oil free gel",
    "oil free moisturizer",
    "oil free moisturiser",
    "olievrije gel",
    "olie vrije gel",
    "lichte gel",
  ],

  "Peptide Anti-Aging Serum": [
    "peptide anti-aging serum",
    "peptide anti aging serum",
    "peptide serum",
    "peptiden serum",
    "anti aging serum",
    "anti-age serum",
    "serum fijne lijntjes",
    "firming serum",
  ],

  "Collagen Boost Serum": [
    "collagen boost serum",
    "collagen serum",
    "collagen boost",
    "collageen serum",
    "collageen boost",
    "firming collagen serum",
  ],

  "Anti-Age Day Cream": [
    "anti-age day cream",
    "anti age day cream",
    "anti-aging day cream",
    "anti aging day cream",
    "anti age dagcreme",
    "anti age dagcrème",
    "aging day cream",
    "mature skin cream",
  ],

  "Natural Retinol Alternative Oil Serum": [
    "natural retinol alternative oil serum",
    "retinol alternative oil serum",
    "natural retinol alternative",
    "retinol alternative",
    "retinol alternatief",
    "retinol alternatief olie",
    "natural retinol",
    "anti age oil serum",
  ],

  "Smoothing Eye Cream": [
    "smoothing eye cream",
    "eye cream",
    "under eye cream",
    "oogcreme",
    "oogcrème",
    "oog verzorging",
    "oogverzorging",
    "eye care",
  ],

  "Vitamin C Serum": [
    "vitamin c serum",
    "vitamin c",
    "vit c serum",
    "vit c",
    "vitamine c serum",
    "vitamine c",
    "brightening serum",
    "glow serum",
  ],

  "Brightening Face & Body Exfoliating Cleanser with Kojic Acid": [
    "brightening face body exfoliating cleanser with kojic acid",
    "brightening face body exfoliator with kojic acid",
    "brightening exfoliator with kojic acid",
    "brightening exfoliating cleanser",
    "brightening exfoliator",
    "kojic exfoliator",
    "kojic acid exfoliator",
    "face body exfoliator",
    "body exfoliator kojic",
  ],

  "Dark Spot Face Cream with Kojic Acid": [
    "dark spot face cream with kojic acid",
    "dark spot cream with kojic acid",
    "dark spot face cream",
    "dark spot cream",
    "kojic acid cream",
    "kojic cream",
    "pigment cream",
    "pigmentvlekken creme",
    "pigmentvlekken crème",
    "donkere plekjes creme",
  ],

  "All-In-One Facial Oil": [
    "all-in-one facial oil",
    "all in one facial oil",
    "all-in-one oil",
    "all in one oil",
    "facial oil",
    "face oil",
    "gezichtsolie",
    "multi use oil",
    "glow oil",
  ],

  "Sun Protection SPF50 Stick, no tint": [
    "sun protection spf50 stick no tint",
    "sun protection spf50 stick",
    "sun protection stick",
    "spf50 stick",
    "spf 50 stick",
    "spf stick",
    "sun stick",
    "sunscreen stick",
    "sunscreen",
    "sun protection",
    "spf",
    "zonnebrand",
    "zonnebrandcreme",
    "zonnebrandcrème",
    "zonbescherming",
    "suncream",
    "sun screen",
  ],

  "Acne Spot Care": [
    "acne spot care",
    "acne spot",
    "spot care",
    "spot treatment",
    "acne treatment",
    "acne cream",
    "acne creme",
    "acne crème",
    "acne gel",
    "pimple cream",
    "pimple treatment",
    "blemish cream",
    "blemish treatment",
    "puistjes creme",
    "puistjes crème",
    "puistjes gel",
    "puistje creme",
    "puistje crème",
    "puistjes product",
    "puisten creme",
    "puisten crème",
    "akne creme",
    "aknee creme",
  ],

  "Niacinamide Gel Face Moisturiser": [
    "niacinamide gel face moisturiser",
    "niacinamide gel face moisturizer",
    "niacinamide gel moisturiser",
    "niacinamide gel moisturizer",
    "niacinamide moisturiser",
    "niacinamide moisturizer",
    "niacinamide gel",
    "niacinamide",
    "niacimide",
    "niacinimide",
    "niacinamide moisterizer",
    "niacimide moisturiser",
    "niacinamide creme",
    "niacinamide crème",
    "gel moisturiser",
    "gel moisturizer",
  ],
};

const AMBIGUOUS_ALIAS_GROUPS: Array<{
  aliases: string[];
  productNames: string[];
}> = [
  {
    aliases: ["day cream", "dagcreme", "dagcrème"],
    productNames: ["Moisturising Day Face Cream with Hyaluronic Acid", "Anti-Age Day Cream"],
  },
];

const CANONICAL_PRODUCT_INDEX = new Map<string, Product>();

for (const product of productCatalog.products) {
  CANONICAL_PRODUCT_INDEX.set(normalizeLoose(product.title), product);
}

for (const [canonicalTitle, aliases] of Object.entries(PRODUCT_ALIASES)) {
  const product = productCatalog.products.find((p) => p.title === canonicalTitle);
  if (!product) continue;

  CANONICAL_PRODUCT_INDEX.set(normalizeLoose(canonicalTitle), product);
  for (const alias of aliases) {
    CANONICAL_PRODUCT_INDEX.set(normalizeLoose(alias), product);
  }
}

function canonicalizeProductName(name: string): string {
  const key = normalizeLoose(name);
  return CANONICAL_PRODUCT_INDEX.get(key)?.title || name;
}

function displayProductName(name: string): string {
  const canonical = canonicalizeProductName(name);
  const shortNames: Record<string, string> = {
    "Hydrating Face Serum with Aloe & Hyaluronic Acid": "Hydrating Face Serum",
    "Hydration Boost Gel Moisturizer": "Hydration Boost Gel",
    "Moisturising Day Face Cream with Hyaluronic Acid": "Day Face Cream",
    "Ceramide Barrier Night Cream for Dry & Normal Skin": "Ceramide Night Cream",
    "Antioxidant Ginkgo Hydrating Gel Booster": "Antioxidant Ginkgo Booster",
    "AHA Peeling Concentrate Exfoliating Face Serum": "AHA Peeling Concentrate",
    "Caffeine Hydrating Gel Booster for Face & Eyes": "Caffeine Gel Booster",
    "Oil-Free Hydrating Gel Moisturizer": "Oil-Free Hydrating Gel",
    "Brightening Face & Body Exfoliating Cleanser with Kojic Acid": "Brightening Kojic Exfoliating Cleanser",
    "Niacinamide Gel Face Moisturiser": "Niacinamide Gel Moisturiser",
  };

  return shortNames[canonical] || canonical;
}

function getProductByName(name: string): Product | undefined {
  const canonical = canonicalizeProductName(name);
  return productCatalog.products.find((p) => p.title === canonical);
}

function dedupeProducts(products: Product[]): Product[] {
  const seen = new Set<string>();
  const out: Product[] = [];

  for (const p of products) {
    const key = canonicalizeProductName(p.title);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }

  return out;
}

function dedupeActions(actions: ChatAction[]): ChatAction[] {
  const seen = new Set<string>();
  const out: ChatAction[] = [];

  for (const action of actions) {
    const key = `${action.type}::${action.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(action);
  }

  return out;
}

function extractUserMessages(history: string[]): string[] {
  return history
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => item.toLowerCase().startsWith("user:"))
    .map((item) => item.replace(/^user:\s*/i, "").trim());
}

function extractAssistantMessages(history: string[]): string[] {
  return history
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => item.toLowerCase().startsWith("assistant:"))
    .map((item) => item.replace(/^assistant:\s*/i, "").trim());
}

// ───────────────── language ─────────────────

function detectLanguage(
  currentMessage: string,
  historyText = "",
  forcedLang?: string
): Lang {
  if (forcedLang === "nl" || forcedLang === "en" || forcedLang === "de") {
    return forcedLang;
  }

  const current = normalize(currentMessage);
  const history = normalize(historyText);

  const strongGermanSignals = [
    "welche routine",
    "ich habe",
    "ich will",
    "ich möchte",
    "trockene haut",
    "empfindliche haut",
    "unreine haut",
    "pickel",
    "akne",
    "was empfiehlst du",
    "was brauche ich",
    "hautproblem",
    "routine aufbauen",
    "produkt empfehlen",
  ];

  const strongEnglishSignals = [
    "can i combine",
    "how do i use",
    "which routine",
    "i want",
    "i have",
    "i need",
    "dry skin",
    "breakouts",
    "what do you recommend",
    "what do i need",
    "help me choose",
    "skin concern",
    "build my routine",
  ];

  const strongDutchSignals = [
    "kan ik combineren",
    "hoe gebruik ik",
    "welke routine",
    "ik wil",
    "droge huid",
    "puistjes",
    "wat raad je aan",
    "wat heb ik nodig",
    "help me kiezen",
    "huidprobleem",
    "routine opbouwen",
  ];

  const hasStrongDe = strongGermanSignals.some((w) => current.includes(w));
  const hasStrongEn = strongEnglishSignals.some((w) => current.includes(w));
  const hasStrongNl = strongDutchSignals.some((w) => current.includes(w));

  if (hasStrongDe && !hasStrongEn && !hasStrongNl) return "de";
  if (hasStrongEn && !hasStrongNl && !hasStrongDe) return "en";
  if (hasStrongNl && !hasStrongEn && !hasStrongDe) return "nl";

  const germanSignals = [
    "ich", "meine", "haut", "trocken", "trockene", "ölig", "fettige",
    "empfindlich", "welche", "was", "passt", "pickel", "akne",
    "unreinheiten", "routine", "produkt", "produkte", "wie benutze",
    "kombinieren", "empfehlen", "feine linien", "fahle haut", "hautproblem",
  ];
  const dutchSignals = [
    "ik", "mijn", "huid", "droog", "droge", "vette", "vet", "gevoelig",
    "welke", "wat", "past", "bij", "mij", "puistjes", "routine",
    "product", "producten", "hoe gebruik", "wanneer gebruik", "huidprobleem",
    "wat heb ik nodig", "help me kiezen",
  ];
  const englishSignals = [
    "my", "i", "have", "need", "skin", "dry", "oily", "sensitive",
    "which", "what", "routine", "product", "products", "how do i use",
    "breakouts", "what do i need", "help me choose", "skin concern",
  ];

  const currentDe = countMatches(current, germanSignals);
  const currentNl = countMatches(current, dutchSignals);
  const currentEn = countMatches(current, englishSignals);
  const historyDe = countMatches(history, germanSignals);
  const historyNl = countMatches(history, dutchSignals);
  const historyEn = countMatches(history, englishSignals);

  if (currentDe > 0 && currentNl === 0 && currentEn === 0) return "de";
  if (currentEn > 0 && currentNl === 0 && currentDe === 0) return "en";
  if (currentNl > 0 && currentEn === 0 && currentDe === 0) return "nl";

  const deScore = currentDe * 5 + historyDe;
  const nlScore = currentNl * 5 + historyNl;
  const enScore = currentEn * 5 + historyEn;

  if (deScore > nlScore && deScore > enScore) return "de";
  if (nlScore > enScore) return "nl";
  if (enScore > nlScore) return "en";
  return "nl";
}

// ───────────────── product / bundle matching ─────────────────

function findMentionedProducts(text: string): Product[] {
  const t = normalizeLoose(text);
  const matches: Product[] = [];

  for (const product of productCatalog.products) {
    const titleLoose = normalizeLoose(product.title);
    if (t.includes(titleLoose)) {
      matches.push(product);
    }
  }

  return dedupeProducts(matches);
}

function findProductsByStrongAlias(text: string): Product[] {
  const t = normalizeLoose(text);
  const matches: Product[] = [];

  for (const [productName, aliases] of Object.entries(PRODUCT_ALIASES)) {
    const product = getProductByName(productName);
    if (!product) continue;

    if (aliases.some((alias) => t.includes(normalizeLoose(alias)))) {
      matches.push(product);
    }
  }

  return dedupeProducts(matches);
}

function findAmbiguousAliasCandidates(text: string): Product[] {
  const t = normalizeLoose(text);
  const matches: Product[] = [];

  for (const group of AMBIGUOUS_ALIAS_GROUPS) {
    const hit = group.aliases.some((alias) => t.includes(normalizeLoose(alias)));
    if (!hit) continue;

    for (const productName of group.productNames) {
      const product = getProductByName(productName);
      if (product) matches.push(product);
    }
  }

  return dedupeProducts(matches);
}

function findProductFromLooseIntent(text: string): Product | undefined {
  const exact = findMentionedProducts(text);
  if (exact.length === 1) return exact[0];

  const strongAlias = findProductsByStrongAlias(text);
  if (strongAlias.length === 1) return strongAlias[0];

  return undefined;
}

function resolveProductsFromMessage(text: string): Product[] {
  const exact = findMentionedProducts(text);
  const aliasMatches = findProductsByStrongAlias(text);
  return dedupeProducts([...exact, ...aliasMatches]);
}

function findMentionedBundles(text: string): Bundle[] {
  const t = normalizeLoose(text);
  const matches = bundleCatalog.bundles.filter((b) => {
    const names = [b.name, b.old_name, b.handle].filter(Boolean).map((x) => normalizeLoose(String(x)));
    return names.some((name) => name && t.includes(name));
  });

  const fuzzy = findBundleByExactOrAlias(text);
  if (fuzzy && !matches.some((b) => normalizeLoose(b.name) === normalizeLoose(fuzzy.name))) {
    matches.push(fuzzy);
  }

  return matches;
}

function findBundleFromLooseIntent(text: string): Bundle | undefined {
  return findBundleByExactOrAlias(text);
}

// ───────────────── product/meta inference ─────────────────

type ProductType =
  | "cleanser"
  | "toner"
  | "serum"
  | "gel"
  | "cream"
  | "oil"
  | "spf"
  | "spot"
  | "exfoliant"
  | "other";

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
  const t = normalize(
    product.title +
      " " +
      (product.when_to_use_en || "") +
      " " +
      (product.when_to_use_nl || "")
  );

  if (t.includes("night") || t.includes("avond") || t.includes("evening")) {
    return "evening";
  }
  if (
    t.includes("day cream") ||
    t.includes("ochtend") ||
    t.includes("morning") ||
    t.includes("spf")
  ) {
    return "morning";
  }
  return "both";
}

function inferOrderIndex(product: Product): number {
  const type = inferProductType(product);
  switch (type) {
    case "cleanser":
      return 1;
    case "toner":
      return 2;
    case "spot":
      return 3;
    case "exfoliant":
      return 3;
    case "serum":
      return 4;
    case "gel":
      return 5;
    case "cream":
      return 6;
    case "oil":
      return 7;
    case "spf":
      return 8;
    default:
      return 5;
  }
}

function sortProductsByRoutineOrder(products: Product[]): Product[] {
  return [...products].sort((a, b) => inferOrderIndex(a) - inferOrderIndex(b));
}

// ───────────────── signals ─────────────────

function detectGreeting(text: string): boolean {
  const t = normalize(text);
  return [
    "hallo",
    "hoi",
    "hey",
    "heyy",
    "yo",
    "hello",
    "hi",
    "good morning",
    "goedemorgen",
    "good evening",
    "goedenavond",
  ].includes(t);
}

function detectDrySignal(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "dry",
    "dehydrated",
    "dry skin",
    "dehydrated skin",
    "tight skin",
    "tight",
    "flaky",
    "rough skin",
    "lack of hydration",
    "droog",
    "droge huid",
    "uitgedroogd",
    "vochttekort",
    "trekkerig",
    "schilfertjes",
    "schilferig",
    "trockene haut",
    "trocken",
    "feuchtigkeitsarm",
    "spannt",
  ]);
}

function detectGlowSignal(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "glow",
    "radiance",
    "dull",
    "dull skin",
    "brighter skin",
    "glowy skin",
    "more glow",
    "stralend",
    "doffe huid",
    "dof",
    "meer glow",
    "glowy",
    "egale glow",
    "fahle haut",
    "müde haut",
    "mehr glow",
    "strahlend",
  ]);
}

function detectBreakoutSignal(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "acne",
    "puistjes",
    "breakouts",
    "blemishes",
    "spots",
    "pimples",
    "blackheads",
    "clogged pores",
    "onzuiverheden",
    "pickel",
    "akne",
    "unreinheiten",
    "mitesser",
    "mee eters",
    "mee-eters",
  ]);
}

function detectSensitiveSignal(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "sensitive",
    "sensitive skin",
    "reacts fast",
    "reactive",
    "redness",
    "irritated",
    "gevoelig",
    "gevoelige huid",
    "reactief",
    "roodheid",
    "geïrriteerd",
    "geirriteerd",
    "empfindlich",
    "empfindliche haut",
    "gereizt",
    "rötung",
  ]);
}

function detectAntiAgeSignal(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "anti age",
    "anti-age",
    "anti aging",
    "anti-aging",
    "fine lines",
    "wrinkles",
    "aging",
    "ageing",
    "rimpels",
    "fijne lijntjes",
    "firmness",
    "stevigheid",
    "older skin",
    "oudere huid",
    "verouderende huid",
    "first signs of aging",
    "falten",
    "feine linien",
    "reife haut",
    "straffheit",
  ]);
}

function detectConcernIntent(text: string): boolean {
  const t = normalize(text);

  return hasAny(t, [
    "skin concern",
    "main concern",
    "my concern",
    "target your concern",
    "concern",
    "help based on my main skin concern",
    "help based on my skin concern",
    "i want help based on my main skin concern",
    "i want help based on my skin concern",
    "help with my skin",
    "help me with my skin",
    "i want help",
    "i need help",
    "what do i need",
    "help me choose",
    "recommend for me",
    "my main issue",
    "my skin problem",
    "my skin issue",
    "huidprobleem",
    "mijn huidprobleem",
    "mijn grootste huidprobleem",
    "kies op huidprobleem",
    "waar moet ik op letten",
    "ik wil hulp",
    "help me kiezen",
    "wat heb ik nodig",
    "ik weet niet wat ik nodig heb",
  ]);
}

function detectSkinType(text: string): SkinType {
  const t = normalize(text);

  if (
    hasAny(t, [
      "combination",
      "combi",
      "combo skin",
      "combination skin",
      "combinatie",
      "combinatiehuid",
      "t-zone",
      "t zone",
    ])
  ) {
    return "combination";
  }
  if (
    hasAny(t, [
      "sensitive",
      "gevoelig",
      "reactive",
      "reactief",
      "irritated",
      "geïrriteerd",
      "geirriteerd",
    ])
  ) {
    return "sensitive";
  }
  if (
    hasAny(t, [
      "oily",
      "oilly",
      "greasy",
      "shiny",
      "oilier skin",
      "vette huid",
      "vet",
      "glimmend",
    ])
  ) {
    return "oily";
  }
  if (
    hasAny(t, [
      "dry",
      "dehydrated",
      "droog",
      "droge huid",
      "uitgedroogd",
      "vochttekort",
    ])
  ) {
    return "dry";
  }
  if (
    hasAny(t, [
      "normal",
      "balanced skin",
      "normaal",
      "normale huid",
      "gebalanceerd",
    ])
  ) {
    return "normal";
  }

  return null;
}

// ───────────────── intent detection ─────────────────

function detectUsageRequest(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "how do i use",
    "how should i use",
    "when do i use",
    "how often",
    "how many times",
    "how to use",
    "before or after",
    "step in routine",
    "hoe gebruik ik",
    "hoe moet ik gebruiken",
    "wanneer gebruik ik",
    "hoe vaak",
    "hoe moet ik dit gebruiken",
    "voor of na",
    "welke stap",
    "in welke stap",
    "hoe gebruik je",
  ]);
}

function detectRelativeOrderQuestion(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "voor of na",
    "before or after",
    "na toner",
    "after toner",
    "before toner",
    "voor toner",
  ]);
}

function detectCombinationRequest(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "combine",
    "combined with",
    "can i combine",
    "can i use together",
    "use together",
    "layer with",
    "works well with",
    "pair with",
    "what pairs with",
    "what goes with",
    "what fits with",
    "combineren",
    "combineer",
    "kan ik combineren",
    "samen met",
    "past goed bij",
    "wat past bij",
    "welke producten passen hierbij",
    "wat past hierbij",
    "waarmee combineren",
    "welke combinatie",
  ]);
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
    "vergelijk",
    "verschil",
    "wat is beter",
    "welke is beter",
  ]);
}

function detectWhereRequest(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "where",
    "where can i find",
    "show me",
    "send me",
    "waar",
    "waar vind",
    "vinden",
    "geef me de link",
    "stuur me",
    "link naar",
    "link for",
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
    "geschikt voor",
    "kan ik gebruiken",
    "is dit goed voor",
    "werkt dit voor",
    "past dit bij",
  ]);
}

function detectPluralReference(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "those",
    "them",
    "these",
    "both",
    "allebei",
    "beide",
    "beiden",
    "die",
    "deze",
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
    "that one",
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
    "only a few products",
    "one to two products",
    "1 to 2 products",
    "1-2 products",
    "1 of 2 products",
    "1 or 2 products",
    "one or two products",
    "can you recommend one to two products",
    "can you recommend one or two products",
    "not the full routine",
    "and not the full routine",
    "een tot twee producten",
    "1 tot 2 producten",
    "1-2 producten",
    "1 of 2 producten",
    "1 of 2",
    "1 of twee producten",
    "een of twee producten",
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
    "1 of 2 producten voor",
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
    "1 of 2 products for",
    "what do i need for",
    "what products do i need for",
    "can you recommend one to two products",
    "can you recommend one or two products",
    "recommend one to two products",
    "recommend one or two products",
    "one to two products for",
    "one or two products for",
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
    "build my routine",
    "help me choose a routine",
    "recommend me a routine",
    "which routine fits my skin",
    "welke routine past bij mij",
    "welke routine",
    "beste routine voor mij",
    "wat past bij mijn huid",
    "welke producten heb ik nodig",
    "routine voor mijn huid",
    "beste match voor mijn huid",
    "ik weet niet wat ik nodig heb",
    "routine opbouwen",
    "find my routine",
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
    "not sure what my skin type is",
  ]);
}

function detectGenericAdviceRequest(text: string): boolean {
  const t = normalize(text);

  return hasAny(t, [
    "wat raden jullie aan",
    "wat raad je aan",
    "wat past bij mij",
    "ik zoek iets goeds",
    "ik zoek iets",
    "what do you recommend",
    "what suits me",
    "what fits me",
    "i want something good",
    "recommend something",
  ]);
}

function isSpecificProductQuestion(message: string): boolean {
  const mentionedProducts = resolveProductsFromMessage(message);
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
  if (detectGenericAdviceRequest(message)) return false;
  if (detectConcernIntent(message)) return false;

  if (detectRoutineHelpRequest(message)) return true;
  if (detectNotKnowingSkinType(message)) return true;

  const signalCount = [
    detectDrySignal(combinedUserText),
    detectGlowSignal(combinedUserText),
    detectBreakoutSignal(combinedUserText),
    detectSensitiveSignal(combinedUserText),
    detectAntiAgeSignal(combinedUserText),
  ].filter(Boolean).length;

  // If there is any clear concern, answer directly in chat instead of sending the customer away to the quiz.

  // If there is one clear concern, answer directly in chat instead of sending the customer away to the quiz.
  // Example: "what fits for acne?" should recommend Acne Skin Routine / Simple Acne Routine,
  // not only say "take the quiz".
  if (
    signalCount >= 1 &&
    detectPrimaryConcern(combinedUserText)
  ) {
    return false;
  }

  if (
    signalCount >= 1 &&
    hasAny(current, [
      "voor mijn huid",
      "for my skin",
      "wat moet ik",
      "what should i",
      "wat past",
      "what fits",
    ]) &&
    !detectProductRecommendationRequest(message) &&
    !detectProductOnlyPreference(message)
  ) {
    return false;
  }

  return false;
}

// ───────────────── history helpers ─────────────────

function getRecentMentionedProductsFromMessages(messages: string[]): Product[] {
  const recent: Product[] = [];
  const seen = new Set<string>();

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const candidates = resolveProductsFromMessage(msg);

    for (const p of candidates) {
      const key = canonicalizeProductName(p.title);
      if (!seen.has(key)) {
        recent.push(p);
        seen.add(key);
      }
    }

    if (recent.length >= 6) break;
  }

  return recent.slice(0, 6);
}

function getLastRecommendedProducts(history: string[]): Product[] {
  const assistantMessages = extractAssistantMessages(history);

  for (let i = assistantMessages.length - 1; i >= 0; i--) {
    const msg = assistantMessages[i];
    const unique = resolveProductsFromMessage(msg);

    if (unique.length >= 2) {
      return unique.slice(0, 2);
    }
  }

  return getRecentMentionedProductsFromMessages(history).slice(0, 2);
}

function getLastSingleProductContext(history: string[]): Product | undefined {
  const recent = getRecentMentionedProductsFromMessages(history);
  return recent[0];
}


// ───────────────── sales / routine routing helpers ─────────────────

type Concern =
  | "dry"
  | "acne"
  | "sensitive"
  | "aging"
  | "dull"
  | "combination"
  | "oily"
  | "normal"
  | null;

function getBundleProductNames(bundle: Bundle): string[] {
  const raw = bundle.bundle_products?.length
    ? bundle.bundle_products
    : bundle.products?.length
      ? bundle.products
      : [];

  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of raw) {
    const rawName = typeof item === "string" ? item : item?.title || item?.name || "";
    if (!rawName) continue;

    const canonical = canonicalizeProductName(rawName);
    const key = normalizeLoose(canonical);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(displayProductName(canonical));
  }

  return out;
}

function findBundleByName(name: string): Bundle | undefined {
  const key = normalizeLoose(name);
  return bundleCatalog.bundles.find((bundle) => {
    const names = [bundle.name, bundle.old_name, ...(bundle.old_names || []), bundle.handle]
      .filter(Boolean)
      .map((x) => normalizeLoose(String(x)));
    return names.includes(key);
  });
}

function findBundleByExactOrAlias(text: string): Bundle | undefined {
  const t = normalizeLoose(text);

  let best: { bundle: Bundle; score: number } | undefined;

  for (const bundle of bundleCatalog.bundles) {
    const directNames = [bundle.name, bundle.old_name, ...(bundle.old_names || []), bundle.handle]
      .filter(Boolean)
      .map((x) => normalizeLoose(String(x)));

    let score = 0;

    for (const name of directNames) {
      if (!name) continue;
      if (t === name) score += 100;
      else if (t.includes(name)) score += 70;
    }

    const aiDetection = (bundle as Bundle & { ai_detection?: { quiz_route?: string[]; misspellings?: string[] } }).ai_detection;
    const routeSignals = [
      ...(bundle.quiz_route || []),
      ...(bundle.quiz_route_misspellings || []),
      ...(aiDetection?.quiz_route || []),
      ...(aiDetection?.misspellings || []),
    ];

    for (const signal of routeSignals) {
      const s = normalizeLoose(signal);
      if (!s || s.length < 4) continue;
      if (t.includes(s)) score += 3;
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { bundle, score };
    }
  }

  // Below 50 is usually only generic routing language like "complete routine".
  // That should not be treated as a specific bundle mention.
  return best && best.score >= 50 ? best.bundle : undefined;
}

function hasRoutineReference(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "routine",
    "routines",
    "bundle",
    "bundel",
    "set",
    "pakket",
    "skincare set",
    "skin care set",
    "routine product",
    "routine products",
    "routine producten",
    "routin",
    "rutine",
    "routien",
  ]);
}

function findBundleByConcernAndPreference(text: string): Bundle | undefined {
  if (!hasRoutineReference(text) && !detectBundleContentsRequest(text) && !detectFullRoutinePreference(text) && !detectSimpleRoutinePreference(text)) {
    return undefined;
  }

  const concern = detectPrimaryConcern(text);
  if (!concern) return undefined;

  const { full, simple } = getConcernBundles(concern);
  const wantsSimple = detectSimpleRoutinePreference(text);
  const wantsFull = detectFullRoutinePreference(text);

  if (wantsSimple && simple) return simple;
  if (wantsFull && full) return full;

  // If the customer asks "what products are in the dry routine", use the full routine by default.
  // If there is no full routine for that concern, fall back to the simple one.
  return full || simple;
}

function findBestBundleForMessage(text: string): Bundle | undefined {
  return (
    findBundleByExactOrAlias(text) ||
    findBundleFromLooseIntent(text) ||
    findBundleByConcernAndPreference(text)
  );
}

function detectBundleContentsRequest(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "what products are in",
    "which products are in",
    "what product are in",
    "what products are inside",
    "what product is inside",
    "which product is in",
    "which products do i get",
    "what comes with",
    "does it come with",
    "what's in",
    "whats in",
    "what is in",
    "included in",
    "bundle includes",
    "products in the routine",
    "products are in the routine",
    "products in",
    "what do i get",
    "wat zit er in",
    "wat zit erin",
    "welke producten zitten in",
    "welke producten zitten er in",
    "welke producten zitten erin",
    "welke product zit erin",
    "welke producten krijg ik",
    "wat krijg ik",
    "wat krijg je erbij",
    "wat zit er allemaal in",
    "wat zit in",
    "wat komt erbij",
    "zit in de routine",
    "in de bundel",
    "in het pakket",
    "bevat",
    "inhoud van",
  ]);
}

function detectSPFQuestion(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "spf",
    "sunscreen",
    "sun screen",
    "sun protection",
    "spf50",
    "zonnebrand",
    "zonbescherming",
    "zit spf",
    "is spf included",
    "spf included",
  ]);
}

function detectFullRoutinePreference(text: string): boolean {
  const t = normalize(text);
  if (detectSimpleRoutinePreference(text)) return false;
  return hasAny(t, [
    "full routine",
    "complete routine",
    "complete skincare",
    "complete set",
    "full skincare",
    "everything i need",
    "best complete routine",
    "hele routine",
    "volledige routine",
    "complete routine",
    "complete bundel",
    "alles wat ik nodig heb",
    "uitgebreide routine",
    "grote routine",
  ]);
}

function detectSimpleRoutinePreference(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "simple routine",
    "small routine",
    "short routine",
    "basic routine",
    "starter routine",
    "easy routine",
    "quick routine",
    "not a full routine",
    "don't build a full routine",
    "dont build a full routine",
    "do not build a full routine",
    "dont want a full routine",
    "don't want a full routine",
    "i dont want full",
    "i don't want full",
    "no full routine",
    "only 2 steps",
    "two steps",
    "2 step",
    "2-step",
    "simple products",
    "simpele routine",
    "kleine routine",
    "korte routine",
    "basis routine",
    "start routine",
    "makkelijke routine",
    "geen volledige routine",
    "bouw geen volledige routine",
    "maak geen volledige routine",
    "niet een hele routine",
    "niet de hele routine",
    "ik wil geen hele routine",
    "ik wil geen volledige routine",
    "alleen 2 stappen",
    "twee stappen",
    "2 stappen",
    "1 of 2",
    "1 of 2 producten",
    "1 of 2 products",
    "1 or 2 products",
  ]);
}

function detectPrimaryConcern(text: string): Concern {
  const t = normalize(text);
  const scores: Record<Exclude<Concern, null>, number> = {
    dry: 0,
    acne: 0,
    sensitive: 0,
    aging: 0,
    dull: 0,
    combination: 0,
    oily: 0,
    normal: 0,
  };

  if (detectDrySignal(t)) scores.dry += 5;
  if (detectBreakoutSignal(t)) scores.acne += 7;
  if (detectSensitiveSignal(t)) scores.sensitive += 6;
  if (detectAntiAgeSignal(t)) scores.aging += 6;
  if (detectGlowSignal(t)) scores.dull += 5;

  const skinType = detectSkinType(t);
  if (skinType === "combination") scores.combination += 7;
  if (skinType === "oily") scores.oily += 7;
  if (skinType === "normal") scores.normal += 6;
  if (skinType === "dry") scores.dry += 2;
  if (skinType === "sensitive") scores.sensitive += 2;

  if (hasAny(t, ["acnee", "akne", "aknee", "puisjes", "puisten", "puistjes", "pukkels", "break out", "breakouts", "spotjes"])) scores.acne += 4;
  if (hasAny(t, ["dof", "doffe", "dofe", "dull", "duf", "grauw", "tired skin", "vermoeid", "vermoeide huid", "geen glow", "lack of glow"])) scores.dull += 4;
  if (hasAny(t, ["anti aging", "anti-aging", "againg", "aging", "ageing", "ouder", "rimpel", "lijntjes", "fijne lijntjes"])) scores.aging += 4;

  const entries = Object.entries(scores) as Array<[Exclude<Concern, null>, number]>;
  entries.sort((a, b) => b[1] - a[1]);

  return entries[0][1] > 0 ? entries[0][0] : null;
}

function getConcernBundles(concern: Concern): { full?: Bundle; simple?: Bundle; addOns: Product[] } {
  const byName = (name: string) => findBundleByName(name);
  const product = (name: string) => getProductByName(name);

  switch (concern) {
    case "acne":
      return {
        full: byName("Acne Skin Routine"),
        simple: byName("Simple Acne Routine"),
        addOns: [product("Acne Spot Care")].filter(Boolean) as Product[],
      };
    case "dry":
      return {
        full: byName("Dry Skin Routine"),
        simple: undefined,
        addOns: [product("Hydration Boost Gel Moisturizer"), product("All-In-One Facial Oil")].filter(Boolean) as Product[],
      };
    case "sensitive":
      return {
        full: byName("Sensitive Skin Routine"),
        simple: byName("Simple Sensitive Skin Routine"),
        addOns: [product("Calming Facial Oil")].filter(Boolean) as Product[],
      };
    case "aging":
      return {
        full: byName("Aging Skin Routine"),
        simple: byName("Simple Aging Skin Routine"),
        addOns: [product("Smoothing Eye Cream"), product("Peptide Anti-Aging Serum")].filter(Boolean) as Product[],
      };
    case "dull":
      return {
        full: byName("Dull Skin Routine"),
        simple: byName("Simple Dull Skin Routine"),
        addOns: [product("Vitamin C Serum"), product("Antioxidant Ginkgo Hydrating Gel Booster")].filter(Boolean) as Product[],
      };
    case "combination":
      return {
        full: byName("Combination Skin Routine"),
        simple: byName("Simple Combination Skin Routine"),
        addOns: [product("Hydrating Toner")].filter(Boolean) as Product[],
      };
    case "oily":
      return {
        full: undefined,
        simple: byName("Simple Oily Skin Routine"),
        addOns: [product("Niacinamide Gel Face Moisturiser"), product("Acne Spot Care")].filter(Boolean) as Product[],
      };
    case "normal":
      return {
        full: byName("Normal Skin Routine"),
        simple: byName("Simple Normal Skin Routine"),
        addOns: [product("Hydrating Toner")].filter(Boolean) as Product[],
      };
    default:
      return { addOns: [] };
  }
}

function buildBundleProductsReply(bundle: Bundle, lang: Lang, options?: { includeSpfNote?: boolean; softIntro?: string }): string {
  const productNames = getBundleProductNames(bundle);
  const parts: string[] = [`**${bundle.name}**`];

  if (options?.softIntro) parts.push(options.softIntro);

  if (productNames.length) {
    parts.push(
      tr(lang, "Deze bundel bevat:", "This bundle includes:") +
        "\n" +
        productNames.map((name) => `- ${name}`).join("\n")
    );
  } else {
    parts.push(
      tr(
        lang,
        "Ik heb voor deze routine nog geen vaste productlijst in de catalogus staan.",
        "I do not have a fixed product list for this routine in the catalog yet."
      )
    );
  }

  if (options?.includeSpfNote) {
    parts.push(
      tr(
        lang,
        "Let op: SPF zit niet in deze bundel. Je kunt SPF los toevoegen als laatste ochtendstap.",
        "Note: SPF is not included in this bundle. You can add SPF separately as the final morning step."
      )
    );
  }

  return parts.join("\n\n");
}

function buildRoutineRecommendationReply(bundle: Bundle, lang: Lang, concern?: Concern, options?: { includeProducts?: boolean; includeSpfNote?: boolean }): string {
  const intro = tr(
    lang,
    `Voor ${concern ? concernLabel(concern, lang) : "jouw huid"} zou ik **${bundle.name}** kiezen.`,
    `For ${concern ? concernLabel(concern, lang) : "your skin"}, I’d choose **${bundle.name}**.`
  );

  if (options?.includeProducts) {
    return buildBundleProductsReply(bundle, lang, {
      softIntro: intro,
      includeSpfNote: options.includeSpfNote,
    });
  }

  return `**${bundle.name}**\n\n${intro}`;
}


function buildRoutineSizeQuestionReply(concern: Concern, lang: Lang): string {
  return tr(
    lang,
    `Helder. Voor ${concernLabel(concern, lang)} kan ik twee kanten op:\n\n- **Kleine basisroutine**: weinig stappen, makkelijk starten\n- **Uitgebreide routine**: completer pakket met meer ondersteuning\n\nZoek je iets kleins of juist een uitgebreide routine?`,
    `Got it. For ${concernLabel(concern, lang)}, I can go two ways:\n\n- **Small base routine**: fewer steps, easy to start\n- **Complete routine**: a fuller set with more support\n\nAre you looking for something small or a complete routine?`
  );
}

function assistantAskedRoutineSizePreference(history: string[]): boolean {
  const assistantMessages = extractAssistantMessages(history).slice(-4);
  return assistantMessages.some((message) => {
    const t = normalize(message);
    return hasAny(t, [
      "something small or a complete routine",
      "small base routine",
      "complete routine",
      "zoek je iets kleins",
      "uitgebreide routine",
      "kleine basisroutine",
      "twee kanten op",
      "two ways",
    ]);
  });
}

function detectRoutineSizeAnswer(text: string): "simple" | "full" | null {
  if (detectSimpleRoutinePreference(text)) return "simple";
  if (detectFullRoutinePreference(text)) return "full";

  const t = normalize(text);
  if (hasAny(t, [
    "small",
    "smaller",
    "basic",
    "starter",
    "short",
    "easy",
    "quick",
    "1 of 2",
    "1 or 2",
    "klein",
    "kleine",
    "basis",
    "simpel",
    "simpele",
    "kort",
    "makkelijk",
  ])) return "simple";

  if (hasAny(t, [
    "full",
    "complete",
    "advanced",
    "bigger",
    "more complete",
    "alles",
    "volledig",
    "volledige",
    "compleet",
    "uitgebreid",
    "uitgebreide",
    "groot",
    "grote",
  ])) return "full";

  return null;
}

function buildChosenRoutineFromSizeReply(
  concern: Concern,
  size: "simple" | "full",
  lang: Lang,
  includeSpfNote = false
): { reply: string; actions: ChatAction[]; lang: Lang } | null {
  const { full, simple, addOns } = getConcernBundles(concern);

  if (size === "simple") {
    const chosen = simple || full;
    if (!chosen) return null;
    const addOn = addOns[0];
    const reply = addOn
      ? buildSimplePlusAddOnReply(chosen, addOn, lang, concern)
      : buildRoutineRecommendationReply(chosen, lang, concern, { includeProducts: true, includeSpfNote });

    return {
      reply,
      actions: dedupeActions([
        ...buildActionsForBundle(chosen, lang),
        ...(addOn ? buildActionsForProduct(addOn) : []),
      ]).slice(0, 3),
      lang,
    };
  }

  const chosen = full || simple;
  if (!chosen) return null;
  return {
    reply: buildRoutineRecommendationReply(chosen, lang, concern, { includeProducts: true, includeSpfNote }),
    actions: buildActionsForBundle(chosen, lang),
    lang,
  };
}

function concernLabel(concern: Concern, lang: Lang): string {
  const nl: Record<string, string> = {
    dry: "droge of vochtarme huid",
    acne: "acne, puistjes of onzuiverheden",
    sensitive: "gevoelige huid",
    aging: "fijne lijntjes of aging skin",
    dull: "doffe of vermoeide huid",
    combination: "combinatiehuid",
    oily: "vette huid",
    normal: "normale huid",
  };
  const en: Record<string, string> = {
    dry: "dry or dehydrated skin",
    acne: "acne, pimples or blemishes",
    sensitive: "sensitive skin",
    aging: "fine lines or aging skin",
    dull: "dull or tired-looking skin",
    combination: "combination skin",
    oily: "oily skin",
    normal: "normal skin",
  };

  const de: Record<string, string> = {
    dry: "trockene oder feuchtigkeitsarme Haut",
    acne: "Akne, Pickel oder Unreinheiten",
    sensitive: "empfindliche Haut",
    aging: "feine Linien oder Aging Skin",
    dull: "fahle oder müde wirkende Haut",
    combination: "Mischhaut",
    oily: "ölige Haut",
    normal: "normale Haut",
  };

  if (!concern) return lang === "nl" ? "jouw huid" : lang === "de" ? "deine Haut" : "your skin";
  return lang === "nl" ? nl[concern] : lang === "de" ? de[concern] : en[concern];
}

function buildSimplePlusAddOnReply(simpleBundle: Bundle, addOn: Product | undefined, lang: Lang, concern: Concern): string {
  const products = getBundleProductNames(simpleBundle);
  const parts: string[] = [`**${simpleBundle.name}**`];

  parts.push(
    tr(
      lang,
      `Voor ${concernLabel(concern, lang)} zou ik klein starten met **${simpleBundle.name}**. Dat is beter dan meteen te veel producten tegelijk gebruiken.`,
      `For ${concernLabel(concern, lang)}, I’d start small with **${simpleBundle.name}**. That is better than jumping into too many products at once.`
    )
  );

  if (products.length) {
    parts.push(
      tr(lang, "De bundel bevat:", "The bundle includes:") +
        "\n" +
        products.map((name) => `- ${name}`).join("\n")
    );
  }

  if (addOn) {
    const acneAddon = concern === "acne" && addOn.title === "Acne Spot Care";
    parts.push(
      acneAddon
        ? tr(
            lang,
            `Als je actieve puistjes hebt, voeg **${addOn.title}** los toe als gerichte extra stap.`,
            `If you have active pimples, add **${addOn.title}** separately as a targeted extra step.`
          )
        : tr(
            lang,
            `Als je meer ondersteuning wilt, kun je **${addOn.title}** los toevoegen als extra stap.`,
            `If you want extra support, you can add **${addOn.title}** separately as an extra step.`
          )
    );
  }

  return parts.join("\n\n");
}


function buildRoutinePlusAddOnReply(bundle: Bundle, addOn: Product, lang: Lang, concern: Concern): string {
  const base = buildRoutineRecommendationReply(bundle, lang, concern, { includeProducts: true });

  const extra = tr(
    lang,
    `Omdat je ook acne of puistjes noemt, zou ik **${displayProductName(addOn.title)}** los toevoegen als gerichte stap voor actieve puistjes. De routine zelf helpt vooral met de huidbasis; deze extra stap pakt de puistjes gerichter aan.`,
    `Because you also mention acne or pimples, I would add **${displayProductName(addOn.title)}** separately as a targeted step for active spots. The routine supports the skin base; this extra step targets pimples more directly.`
  );

  return `${base}\n\n${extra}`;
}

function buildSalesRouteReply(message: string, combinedUserText: string, lang: Lang): { reply: string; actions: ChatAction[]; lang: Lang } | null {
  const concern = detectPrimaryConcern(combinedUserText);
  if (!concern) return null;

  const wantsSimple = detectSimpleRoutinePreference(message) || detectSimpleRoutinePreference(combinedUserText) || detectProductOnlyPreference(message);
  const wantsFull = detectFullRoutinePreference(message) || detectFullRoutinePreference(combinedUserText) || detectRoutineHelpRequest(message);
  const includeSpfNote = detectSPFQuestion(message);
  const { full, simple, addOns } = getConcernBundles(concern);

  const messageHasAcneAndDry =
    detectBreakoutSignal(message) &&
    detectDrySignal(message);

  if (messageHasAcneAndDry) {
    const dryBundle = findBundleByName("Dry Skin Routine");
    const acneSpot = getProductByName("Acne Spot Care");

    if (dryBundle && acneSpot) {
      return {
        reply: buildRoutinePlusAddOnReply(dryBundle, acneSpot, lang, "dry"),
        actions: dedupeActions([
          ...buildActionsForBundle(dryBundle, lang),
          ...buildActionsForProduct(acneSpot),
        ]).slice(0, 3),
        lang,
      };
    }
  }

  // Acne is special: for a normal concern like "I have acne", do not jump straight to only Acne Spot Care.
  // Start with the Simple Acne Routine and use Acne Spot Care as add-on.
  if (concern === "acne" && simple) {
    const addOn = addOns.find((p) => p.title === "Acne Spot Care") || addOns[0];
    if (wantsFull && !wantsSimple && full) {
      return {
        reply: buildRoutineRecommendationReply(full, lang, concern, { includeProducts: true, includeSpfNote }),
        actions: buildActionsForBundle(full, lang),
        lang,
      };
    }

    return {
      reply: buildSimplePlusAddOnReply(simple, addOn, lang, concern),
      actions: dedupeActions([
        ...buildActionsForBundle(simple, lang).map((a) => ({ ...a, label: tr(lang, "Bekijk Simple Acne Routine", "View Simple Acne Routine") })),
        ...(addOn ? buildActionsForProduct(addOn) : []),
      ]).slice(0, 3),
      lang,
    };
  }

  if (wantsSimple && simple) {
    const mainAddOn = addOns[0];
    return {
      reply: mainAddOn
        ? buildSimplePlusAddOnReply(simple, mainAddOn, lang, concern)
        : buildRoutineRecommendationReply(simple, lang, concern, { includeProducts: true, includeSpfNote }),
      actions: dedupeActions([
        ...buildActionsForBundle(simple, lang),
        ...(mainAddOn ? buildActionsForProduct(mainAddOn) : []),
      ]).slice(0, 3),
      lang,
    };
  }

  if (wantsFull && full) {
    return {
      reply: buildRoutineRecommendationReply(full, lang, concern, { includeProducts: true, includeSpfNote }),
      actions: buildActionsForBundle(full, lang),
      lang,
    };
  }

  // Default: for a clear concern without "simple" wording, recommend the full routine.
  // This makes the chatbot decisive instead of giving a small/basic answer by default.
  if (full) {
    return {
      reply: buildRoutineRecommendationReply(full, lang, concern, { includeProducts: true, includeSpfNote }),
      actions: buildActionsForBundle(full, lang),
      lang,
    };
  }

  if (simple) {
    return {
      reply: buildRoutineRecommendationReply(simple, lang, concern, { includeProducts: true, includeSpfNote }),
      actions: buildActionsForBundle(simple, lang),
      lang,
    };
  }

  return null;
}

// ───────────────── smart copy ─────────────────

function getSmartFallbackCopy(product: Product, lang: Lang): string {
  const title = product.title;

  const nl: Record<string, string> = {
    "Hydrating Face Serum with Aloe & Hyaluronic Acid":
      "Een licht serum voor extra hydratatie en een comfortabeler huidgevoel.",
    "Moisturising Day Face Cream with Hyaluronic Acid":
      "Een dagcrème voor dagelijkse hydratatie en comfort.",
    "Acne Spot Care":
      "Gerichte spot care voor puistjes en onzuiverheden.",
    "Niacinamide Gel Face Moisturiser":
      "Een lichte gel moisturiser voor balans en comfort.",
    "Oil-Free Hydrating Gel Moisturizer":
      "Een olievrije gel voor lichte dagelijkse hydratatie.",
    "Hydrating Toner": "Een hydraterende toner voor comfort en balans.",
    "Vitamin C Serum":
      "Een serum voor een frissere en stralendere uitstraling.",
    "Antioxidant Ginkgo Hydrating Gel Booster":
      "Een lichte booster voor hydratatie en een frissere uitstraling.",
    "Calming Facial Oil":
      "Een kalmerende olie voor comfort en zachtheid.",
    "Ceramide Barrier Night Cream for Dry & Normal Skin":
      "Een rijke nachtcrème voor comfort en support van de huidbarrière.",
    "Purifying Mousse":
      "Een schuimende reiniger voor een frisse, lichte finish.",
    "Peptide Anti-Aging Serum":
      "Een serum voor een gladdere en verzorgde uitstraling.",
    "Anti-Age Day Cream":
      "Een dagcrème voor dagelijkse verzorging bij eerste lijntjes.",
    "Collagen Boost Serum":
      "Een serum gericht op stevigheid en comfort.",
    "AHA Peeling Concentrate Exfoliating Face Serum":
      "Een exfoliërend concentraat voor dofheid of textuur.",
    "Micellar Cleansing Water":
      "Een zachte reiniger om make-up en vuil te verwijderen.",
    "Natural Retinol Alternative Oil Serum":
      "Een verzorgend olieserum voor een gladdere uitstraling.",
    "Sun Protection SPF50 Stick, no tint":
      "Een SPF stick voor dagelijkse bescherming zonder tint.",
    "All-In-One Facial Oil":
      "Een verzorgende olie voor extra comfort en zachtheid.",
    "Dark Spot Face Cream with Kojic Acid":
      "Een verzorgende crème gericht op een egalere uitstraling.",
    "Brightening Face & Body Exfoliating Cleanser with Kojic Acid":
      "Een exfoliator voor een gladdere en frissere uitstraling.",
    "Hydration Boost Gel Moisturizer":
      "Een hydraterende gel voor extra comfort en een voller huidgevoel.",
    "Smoothing Eye Cream":
      "Een oogcrème voor een zachtere en verzorgde oogzone.",
    "Caffeine Hydrating Gel Booster for Face & Eyes":
      "Een lichte gel booster voor een frissere uitstraling.",
  };

  const en: Record<string, string> = {
    "Hydrating Face Serum with Aloe & Hyaluronic Acid":
      "A lightweight serum for extra hydration and a more comfortable skin feel.",
    "Moisturising Day Face Cream with Hyaluronic Acid":
      "A day cream for daily hydration and comfort.",
    "Acne Spot Care":
      "A targeted spot treatment for blemishes and breakouts.",
    "Niacinamide Gel Face Moisturiser":
      "A lightweight gel moisturiser for balance and comfort.",
    "Oil-Free Hydrating Gel Moisturizer":
      "An oil-free gel for lightweight daily hydration.",
    "Hydrating Toner": "A hydrating toner for comfort and balance.",
    "Vitamin C Serum":
      "A serum for a fresher and more radiant-looking complexion.",
    "Antioxidant Ginkgo Hydrating Gel Booster":
      "A lightweight booster for hydration and a fresher look.",
    "Calming Facial Oil":
      "A calming facial oil for comfort and softness.",
    "Ceramide Barrier Night Cream for Dry & Normal Skin":
      "A rich night cream for comfort and barrier support.",
    "Purifying Mousse":
      "A foaming cleanser for a fresh, lightweight feel.",
    "Peptide Anti-Aging Serum":
      "A serum for a smoother-looking complexion.",
    "Anti-Age Day Cream":
      "A day cream for daily care with an early anti-age focus.",
    "Collagen Boost Serum":
      "A serum focused on firmness and comfort.",
    "AHA Peeling Concentrate Exfoliating Face Serum":
      "An exfoliating concentrate for dullness or texture.",
    "Micellar Cleansing Water":
      "A gentle cleanser to remove makeup and daily buildup.",
    "Natural Retinol Alternative Oil Serum":
      "A nourishing oil serum for a smoother-looking complexion.",
    "Sun Protection SPF50 Stick, no tint":
      "An SPF stick for daily protection without tint.",
    "All-In-One Facial Oil":
      "A caring facial oil for extra comfort and softness.",
    "Dark Spot Face Cream with Kojic Acid":
      "A care cream focused on a more even-looking complexion.",
    "Brightening Face & Body Exfoliating Cleanser with Kojic Acid":
      "An exfoliator for a smoother and fresher-looking finish.",
    "Hydration Boost Gel Moisturizer":
      "A hydrating gel for extra comfort and a plumper-looking feel.",
    "Smoothing Eye Cream":
      "An eye cream for a softer and more cared-for eye area.",
    "Caffeine Hydrating Gel Booster for Face & Eyes":
      "A lightweight gel booster for a fresher look.",
  };

  return lang === "nl"
    ? nl[title] || "Een product dat kan passen binnen een verzorgingsroutine van SOVAH."
    : en[title] || "A product that can fit well within a SOVAH skincare routine.";
}

function getSafeShortCopy(product: Product, lang: Lang): string {
  const copy = lang === "nl" ? product.short_copy_nl : product.short_copy_en;
  if (copy && copy.trim()) return copy;
  return getSmartFallbackCopy(product, lang);
}

// ───────────────── replies ─────────────────

function buildActionsForProduct(product: Product): ChatAction[] {
  return [
    {
      type: "OPEN_URL",
      label: product.title,
      url: product.url,
    },
  ];
}

function buildActionsForProducts(products: Product[]): ChatAction[] {
  return dedupeActions(products.flatMap((p) => buildActionsForProduct(p))).slice(0, 3);
}

function buildActionsForBundle(bundle: Bundle, lang: Lang): ChatAction[] {
  return [
    {
      type: "ROUTINE_CARD",
      label: tr(lang, "Bekijk routine", "View routine", "Routine ansehen"),
      title: bundle.name,
      url: bundle.url,
      image: bundle.image,
      price: bundle.price,
    },
  ];
}

function buildGreetingReply(lang: Lang) {
  return {
    reply: tr(
      lang,
      "Hi! Ik help je graag met de juiste SOVAH producten of routine.\n\nVertel me kort wat je huidtype is of waar je vooral hulp bij wilt, zoals droogte, glow, puistjes of gevoeligheid.",
      "Hi! I’d be happy to help you find the right SOVAH products or routine.\n\nTell me your skin type or what you mainly want help with, like dryness, glow, breakouts, or sensitivity."
    ),
    actions: [],
    lang,
  };
}

function buildQuizRedirectReply(lang: Lang) {
  return {
    reply: tr(
      lang,
      "Voor de beste routine-match kun je het beste onze skincare quiz doen.\n\nDaar begeleiden we je stap voor stap naar de juiste routine voor jouw huid.",
      "For the best routine match, the best next step is our skincare quiz.\n\nThere we guide you step by step to the right routine for your skin."
    ),
    actions: [
      {
        type: "OPEN_URL" as const,
        label: tr(lang, "Start de quiz", "Start quiz", "Quiz starten"),
        url: QUIZ_URL,
      },
    ],
    lang,
  };
}

function buildConcernReply(lang: Lang) {
  return {
    reply: tr(
      lang,
      "Top. Waar heb je vooral last van?\n\n- Droge huid\n- Puistjes / acne\n- Gevoelige huid\n- Doffe huid / glow\n- Fijne lijntjes",
      "Got it. What is your main concern?\n\n- Dry skin\n- Acne / breakouts\n- Sensitive skin\n- Dull skin / glow\n- Fine lines"
    ),
    actions: [],
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
    parts.push(
      lang === "nl"
        ? `**Wanneer gebruik je het?**\n${whenToUse}`
        : lang === "de"
        ? `**Wann benutzt du es?**\n${whenToUse}`
        : `**When do you use it?**\n${whenToUse}`
    );
  }

  if (step) {
    parts.push(
      lang === "nl"
        ? `**Stap in je routine**\n${step}`
        : lang === "de"
        ? `**Schritt in deiner Routine**\n${step}`
        : `**Step in your routine**\n${step}`
    );
  }

  return parts.join("\n\n");
}

function buildRelativeOrderReply(
  mainProduct: Product,
  referencedProduct: Product,
  lang: Lang
): string {
  const mainType = inferProductType(mainProduct);
  const refType = inferProductType(referencedProduct);

  let orderLine = tr(
    lang,
    `Gebruik **${mainProduct.title}** na **${referencedProduct.title}**.`,
    `Use **${mainProduct.title}** after **${referencedProduct.title}**.`
  );

  if (mainType === "spf") {
    orderLine = tr(
      lang,
      `Gebruik **${mainProduct.title}** als laatste stap, dus na **${referencedProduct.title}**.`,
      `Use **${mainProduct.title}** as the final step, so after **${referencedProduct.title}**.`
    );
  } else if (mainType === "toner") {
    orderLine = tr(
      lang,
      `Gebruik **${mainProduct.title}** vroeg in je routine, meestal na reinigen en vóór zwaardere stappen.`,
      `Use **${mainProduct.title}** early in your routine, usually after cleansing and before heavier steps.`
    );
  } else if (mainType === "exfoliant" && refType === "toner") {
    orderLine = tr(
      lang,
      `Ik zou **${mainProduct.title}** na reinigen gebruiken. Als je ook een toner gebruikt, houd de routine rustig en kijk goed hoe je huid reageert.`,
      `I would use **${mainProduct.title}** after cleansing. If you also use a toner, keep the routine gentle and watch how your skin responds.`
    );
  }

  return `**${mainProduct.title}**\n\n${orderLine}`;
}

function buildMultiProductUsageReply(products: Product[], lang: Lang): string {
  const unique = dedupeProducts(products).slice(0, 2);

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
  return [
    `**${bundle.name}**`,
    tr(
      lang,
      "Je kunt de volledige uitleg vinden op de productpagina van deze routine. Daar staat de sectie **Hoe te gebruiken** met de ochtend- en avondstappen.",
      "You can find the full instructions on this routine product page. There is a **How to use** section with the morning and evening steps."
    ),
    tr(
      lang,
      "Klik op de knop hieronder om de routinepagina te openen.",
      "Click the button below to open the routine page."
    ),
  ].join("\n\n");
}

function buildDynamicCombinationReply(a: Product, b: Product, lang: Lang): string {
  const [first, second] = sortProductsByRoutineOrder([a, b]);
  const firstType = inferProductType(first);
  const firstTime = inferUseTime(first);
  const secondTime = inferUseTime(second);

  const notes: string[] = [];
  const title = `**${a.title} + ${b.title}**`;

  const titles = [a.title, b.title];

  const bothActive =
    titles.includes("AHA Peeling Concentrate Exfoliating Face Serum") &&
    (titles.includes("Vitamin C Serum") ||
      titles.includes("Natural Retinol Alternative Oil Serum"));

  const exfoliantWithSpot =
    titles.includes("AHA Peeling Concentrate Exfoliating Face Serum") &&
    titles.includes("Acne Spot Care");

  if (bothActive) {
    notes.push(
      tr(
        lang,
        "Deze combinatie kan te actief zijn in dezelfde routine. Ik zou ze liever afwisselen dan direct samen gebruiken.",
        "This combination can be too active in the same routine. I would rather alternate them than use them directly together."
      )
    );
  } else if (exfoliantWithSpot) {
    notes.push(
      tr(
        lang,
        "Deze combinatie kan voor sommige huiden wat te actief zijn. Bouw dit rustig op.",
        "This combination can be a bit too active for some skin types. Build it in slowly."
      )
    );
  } else {
    notes.push(
      tr(
        lang,
        "Dit kan een logische combinatie zijn binnen één routine, afhankelijk van je huid.",
        "This can be a logical combination within one routine, depending on your skin."
      )
    );
  }

  if (!bothActive) {
    if (firstType === "spf" || inferProductType(second) === "spf") {
      const spfProduct = firstType === "spf" ? first : second;
      const otherProduct =
        canonicalizeProductName(spfProduct.title) === canonicalizeProductName(first.title)
          ? second
          : first;

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
    notes.push(
      tr(lang, "Deze combinatie past het best in de ochtend.", "This combination fits best in the morning.")
    );
  } else if (firstTime === "evening" && secondTime === "evening") {
    notes.push(
      tr(lang, "Deze combinatie past het best in de avond.", "This combination fits best in the evening.")
    );
  }

  if (bothActive) {
    notes.push(
      tr(
        lang,
        "Gebruik overdag altijd SPF als je met actievere producten werkt.",
        "Always use SPF during the day when using more active products."
      )
    );
  }

  return [title, ...notes].join("\n\n");
}

function buildSingleProductPairingReply(product: Product, lang: Lang): string {
  const list = product.pairs_well_with?.length
    ? `${tr(lang, "Producten die hier goed bij passen:", "Products that pair well with this:")}\n${product.pairs_well_with.map((p) => `- ${canonicalizeProductName(p)}`).join("\n")}`
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

  const lines = products.map((p) => `**${displayProductName(p.title)}**\n${getSafeShortCopy(p, lang)}`);

  return `${intro}\n\n${lines.join("\n\n")}`;
}

function buildClarifyProductReply(products: Product[], lang: Lang): string {
  const unique = dedupeProducts(products).slice(0, 4);
  const names = unique.map((p) => displayProductName(p.title));

  return tr(
    lang,
    `Ik weet nog niet precies welk product je bedoelt. Bedoel je:\n- ${names.join("\n- ")}`,
    `I’m not fully sure which product you mean yet. Do you mean:\n- ${names.join("\n- ")}`
  );
}

function buildAmbiguousAliasReply(
  ambiguousCandidates: Product[],
  lang: Lang,
  contextProduct?: Product
): string {
  const unique = dedupeProducts(ambiguousCandidates).slice(0, 4);
  const names = unique.map((p) => displayProductName(p.title));

  if (contextProduct) {
    return tr(
      lang,
      `Met **${contextProduct.title}** bedoel je waarschijnlijk één van deze day creams:\n- ${names.join("\n- ")}\n\nWelke bedoel je precies?`,
      `With **${contextProduct.title}**, you probably mean one of these day creams:\n- ${names.join("\n- ")}\n\nWhich one do you mean exactly?`
    );
  }

  return tr(
    lang,
    `Dat is nog net iets te algemeen. Bedoel je:\n- ${names.join("\n- ")}`,
    `That’s still a bit too general. Do you mean:\n- ${names.join("\n- ")}`
  );
}

function buildGenericAdviceReply(message: string, lang: Lang): string {
  const t = normalize(message);

  if (hasAny(t, ["wat past bij mij", "what fits me"])) {
    return tr(
      lang,
      "Daar helpen we je het snelst mee via onze skincare quiz. In een paar korte vragen kijken we wat het best past bij jouw huid.",
      "The quickest way to help with that is through our skincare quiz. In just a few short questions, we look at what fits your skin best."
    );
  }

  if (hasAny(t, ["ik zoek iets goeds", "ik zoek iets", "i want something good"])) {
    return tr(
      lang,
      "Als je nog niet precies weet wat je zoekt, is onze skincare quiz de beste start. Zo kom je sneller uit bij producten die echt bij jouw huid passen.",
      "If you’re not completely sure what you’re looking for yet, our skincare quiz is the best place to start. That way you get to products that really fit your skin faster."
    );
  }

  if (hasAny(t, ["wat raden jullie aan", "wat raad je aan", "what do you recommend"])) {
    return tr(
      lang,
      "Dat hangt vooral af van je huid en waar je hulp bij wilt. Daarom is onze skincare quiz hier de beste volgende stap.",
      "That mainly depends on your skin and what you want help with. That’s why our skincare quiz is the best next step here."
    );
  }

  return tr(
    lang,
    "Voor een echt passende aanbeveling kun je het beste onze skincare quiz doen. Daarmee begeleiden we je stap voor stap naar de juiste match.",
    "For a recommendation that really fits, the best next step is our skincare quiz. It guides you step by step to the right match."
  );
}

// ───────────────── recommendations ─────────────────

function recommendProductsFromText(text: string): Product[] {
  const picks: Product[] = [];
  const skinType = detectSkinType(text);

  const add = (title: string) => {
    const p = getProductByName(title);
    if (
      p &&
      !picks.find(
        (x) =>
          canonicalizeProductName(x.title) === canonicalizeProductName(p.title)
      )
    ) {
      picks.push(p);
    }
  };

  if (detectBreakoutSignal(text)) {
    add("Acne Spot Care");

    if (skinType === "dry") {
      add("Moisturising Day Face Cream with Hyaluronic Acid");
    } else if (skinType === "sensitive" || skinType === "normal") {
      add("Niacinamide Gel Face Moisturiser");
    } else {
      add("Oil-Free Hydrating Gel Moisturizer");
    }

    return picks.slice(0, 2);
  }

  if (detectDrySignal(text)) {
    add("Hydrating Face Serum with Aloe & Hyaluronic Acid");
    add("Moisturising Day Face Cream with Hyaluronic Acid");
    return picks.slice(0, 2);
  }

  if (detectSensitiveSignal(text)) {
    add("Calming Facial Oil");
    add("Ceramide Barrier Night Cream for Dry & Normal Skin");
    return picks.slice(0, 2);
  }

  if (detectAntiAgeSignal(text)) {
    add("Peptide Anti-Aging Serum");
    add("Anti-Age Day Cream");
    return picks.slice(0, 2);
  }

  if (detectGlowSignal(text)) {
    add("Vitamin C Serum");
    add("Antioxidant Ginkgo Hydrating Gel Booster");
    return picks.slice(0, 2);
  }

  return picks.slice(0, 2);
}

// ───────────────── OpenAI fallback ─────────────────

function decideModelTier(message: string, combinedUserText: string): ModelTier {
  const current = normalize(message);
  const combined = normalize(combinedUserText);

  if (
    detectUsageRequest(message) ||
    detectCombinationRequest(message) ||
    detectWhereRequest(message) ||
    detectSuitabilityRequest(message) ||
    detectConcernIntent(message)
  ) {
    return "none";
  }

  if (
    detectRoutineHelpRequest(message) ||
    detectNotKnowingSkinType(message) ||
    shouldRedirectToQuiz(message, combinedUserText)
  ) {
    return "none";
  }

  const complexSignals =
    [
      detectDrySignal(combined),
      detectGlowSignal(combined),
      detectBreakoutSignal(combined),
      detectSensitiveSignal(combined),
      detectAntiAgeSignal(combined),
    ].filter(Boolean).length >= 2;

  if (
    complexSignals ||
    detectCompareRequest(message) ||
    hasAny(current, [
      "what do you recommend for my skin",
      "wat raad je aan voor mijn huid",
      "what fits me best",
      "wat past het best",
      "help me choose between",
      "help me kiezen tussen",
    ])
  ) {
    return "full";
  }

  return "mini";
}

function buildOpenAISystemPrompt(lang: Lang): string {
  const productNames = productCatalog.products.map((p) => p.title).join(", ");
  const bundleNames = bundleCatalog.bundles.map((b) => b.name).join(", ");

  return `
You are the SOVAH skincare assistant for sovahcare.com.

LANGUAGE:
- Reply in ${languageName(lang)} only.

STRICT RULES:
- Use only the provided product and bundle catalog as source of truth.
- Never invent ingredients, usage steps, medical claims, diagnoses, or results.
- Keep the reply concise, premium, natural, and practical.
- Never mention suppliers or external brands.
- First classify the customer intent: product info, bundle contents, usage, comparison, concern advice, simple routine, full routine, or add-on.
- If the user asks what products are in a routine, answer with the real bundle_products only. Do not re-recommend.
- If the user has acne, pimples, breakouts or blemishes, do not jump straight to only Acne Spot Care. Prefer Simple Acne Routine first, then Acne Spot Care as add-on.
- If the user asks what products are in any routine, answer with the bundle_products from the bundle catalog. Do not recommend a different routine.
- If the user says they do not want a full routine, choose the matching Simple routine where available.
- If the user asks for a complete/full routine, choose the matching full routine where available.
- If the user asks how to use any product, answer with that product's usage and when_to_use fields.
- If the user asks whether products can be combined, answer generally using product types and the catalog; be careful with exfoliants, retinol-like products and spot care.
- If the user says they do not want a full routine, do not recommend a full routine. Recommend the matching simple routine if it exists.
- If the user clearly wants only products, recommend 1 or 2 products maximum.
- If the user wants a full routine or best routine match, recommend the matching catalog routine when clear; otherwise point to the skincare quiz.
- If uncertain, ask at most one short clarifying question.
- Do not output JSON.
- Do not use emojis.
- Keep the answer under 120 words unless the user explicitly asks for more detail.

AVAILABLE BUNDLES:
${bundleNames}

AVAILABLE PRODUCTS:
${productNames}
`.trim();
}

function buildOpenAIUserPrompt(
  message: string,
  history: string[],
  lang: Lang
): string {
  const recentHistory = history.slice(-12).join("\n");

  return `
Conversation history:
${recentHistory || "(none)"}

Current customer message:
${message}

Useful bundle catalog:
${BUNDLES_JSON}

Useful product catalog:
${PRODUCTS_JSON}

Write the best answer now in ${languageName(lang)}.
`.trim();
}

async function callOpenAIFallback(
  message: string,
  history: string[],
  lang: Lang,
  tier: ModelTier
): Promise<{ reply: string; actions: ChatAction[]; lang: Lang }> {
  if (!openai || tier === "none") {
    return {
      reply: tr(
        lang,
        "Ik weet nog niet helemaal wat je bedoelt. Gaat het om een product, hoe je iets gebruikt, een paar producten, of wil je hulp met de juiste routine?",
        "I'm not fully sure what you mean yet. Is it about a product, how to use something, a few products, or do you want help with the right routine?",
        "Ich bin noch nicht ganz sicher, was du meinst. Geht es um ein Produkt, die Anwendung, 1–2 Produkte oder die passende Routine?"
      ),
      actions: [],
      lang,
    };
  }

  const model = tier === "full" ? "gpt-5.4" : "gpt-5.4-mini";

  try {
    const response = await openai.responses.create({
      model,
      input: [
        {
          role: "system",
          content: buildOpenAISystemPrompt(lang),
        },
        {
          role: "user",
          content: buildOpenAIUserPrompt(message, history, lang),
        },
      ],
      reasoning: {
        effort: tier === "full" ? "medium" : "low",
      },
      text: {
        verbosity: "low",
      },
      max_output_tokens: tier === "full" ? 260 : 180,
    });

    const text = (response.output_text || "").trim();

    if (!text) {
      return {
        reply: tr(
          lang,
          "Vertel me welk product of welke routine je bedoelt, dan help ik je verder.",
          "Tell me which product or routine you mean, and I’ll help from there.",
          "Sag mir kurz, welches Produkt oder welche Routine du meinst, dann helfe ich dir weiter."
        ),
        actions: [],
        lang,
      };
    }

    const mentionedProductsInReply = resolveProductsFromMessage(text);
    const mentionedBundlesInReply = findMentionedBundles(text);

    let actions: ChatAction[] = [];
    if (mentionedBundlesInReply.length > 0) {
      actions = buildActionsForBundle(mentionedBundlesInReply[0], lang);
    } else if (mentionedProductsInReply.length > 0) {
      actions = buildActionsForProducts(mentionedProductsInReply);
    }

    return { reply: text, actions: actions.slice(0, 3), lang };
  } catch (error) {
    console.error("OpenAI fallback error:", error);

    return {
      reply: tr(
        lang,
        "Ik weet nog niet helemaal wat je bedoelt. Vertel me welk product of welke routine je bedoelt, dan help ik je verder.",
        "I'm not fully sure what you mean yet. Tell me which product or routine you mean, and I’ll help from there.",
        "Ich bin noch nicht ganz sicher, was du meinst. Sag mir kurz, ob du eine Routine, 1–2 Produkte oder Hilfe bei einem bestimmten Hautproblem suchst."
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
    const message: string =
      typeof body?.message === "string" ? body.message : "";
    const forcedLang: string | undefined =
      typeof body?.lang === "string" ? body.lang : undefined;
    const historyRaw: unknown = body?.history;

    const history: string[] = Array.isArray(historyRaw)
      ? historyRaw.filter((item): item is string => typeof item === "string")
      : [];

    if (!message) {
      return new Response(
        JSON.stringify({ reply: "Missing message.", actions: [], lang: "en" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const userHistory = extractUserMessages(history);
    const assistantHistory = extractAssistantMessages(history);
    const conversationTimeline = [...history, `User: ${message}`].slice(-30);
    const userTimeline = [...userHistory, message].slice(-18);
    const combinedUserText = userTimeline.join(" \n ");
    const allHistoryText = [...history, `User: ${message}`].join(" \n ");
    const lang = detectLanguage(message, allHistoryText, forcedLang);

    const mentionedProducts = resolveProductsFromMessage(message);
    const mentionedBundles = findMentionedBundles(message);
    const looseProduct = findProductFromLooseIntent(message);
    const ambiguousCandidates = findAmbiguousAliasCandidates(message);
    const recentProducts = getRecentMentionedProductsFromMessages(conversationTimeline);
    const lastRecommendedProducts = getLastRecommendedProducts(conversationTimeline);
    const lastSingleContextProduct = getLastSingleProductContext(conversationTimeline);

    const explicitProducts = dedupeProducts(
      mentionedProducts.length ? mentionedProducts : looseProduct ? [looseProduct] : []
    );

    const hasExactCanonicalProduct =
      mentionedProducts.some(
        (p) => normalizeLoose(p.title) === normalizeLoose(message)
      ) ||
      productCatalog.products.some(
        (p) => normalizeLoose(p.title) === normalizeLoose(message)
      );

    const currentHasGoalSignal =
      detectDrySignal(message) ||
      detectGlowSignal(message) ||
      detectBreakoutSignal(message) ||
      detectSensitiveSignal(message) ||
      detectAntiAgeSignal(message);

    const contextSuggestsProductOnly =
      detectProductOnlyPreference(allHistoryText) ||
      detectProductRecommendationRequest(allHistoryText) ||
      assistantHistory.some((m) =>
        hasAny(normalize(m), [
          "tell me your skin type",
          "what you'd mainly like help with",
          "what you'd like help with",
          "vertel me even wat voor huid je hebt",
          "waar je vooral hulp bij wilt",
          "ik raad je liever 1 of 2 passende producten aan",
        ])
      );

    const explicitBundle = mentionedBundles[0] || findBestBundleForMessage(message);

    // A. Customer asks what is inside a bundle. This must answer contents, not recommend again.
    if (explicitBundle && detectBundleContentsRequest(message)) {
      return new Response(
        JSON.stringify({
          reply: buildBundleProductsReply(explicitBundle, lang, { includeSpfNote: detectSPFQuestion(message) }),
          actions: buildActionsForBundle(explicitBundle, lang),
          lang,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // B. SPF question about a bundle. Keep clear that SPF is not included in bundles.
    if (explicitBundle && detectSPFQuestion(message)) {
      return new Response(
        JSON.stringify({
          reply: buildBundleProductsReply(explicitBundle, lang, { includeSpfNote: true }),
          actions: buildActionsForBundle(explicitBundle, lang),
          lang,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // C0. Decisive concern routing.
    // Clear concern messages like "ik heb acne", "mijn huid is dof" or "droge huid" should get a direct answer.
    // Do not send these to the quiz and do not ask the same follow-up again.
    if (
      currentHasGoalSignal &&
      !detectUsageRequest(message) &&
      !detectCombinationRequest(message) &&
      !detectWhereRequest(message) &&
      !detectSuitabilityRequest(message) &&
      !detectCompareRequest(message) &&
      !isSpecificProductQuestion(message)
    ) {
      const explicitSmallAnswer = detectRoutineSizeAnswer(message) === "simple";
      const wantsOnlyProducts =
        explicitSmallAnswer ||
        detectProductOnlyPreference(message) ||
        (contextSuggestsProductOnly && !detectFullRoutinePreference(message));

      const messageHasAcneAndDry =
        detectBreakoutSignal(message) &&
        detectDrySignal(message);

      if (wantsOnlyProducts && !messageHasAcneAndDry && !detectRoutineHelpRequest(message)) {
        const picks = recommendProductsFromText(combinedUserText);
        return new Response(
          JSON.stringify({
            reply: buildProductRecommendationReply(picks, lang),
            actions: buildActionsForProducts(picks).slice(0, 2),
            lang,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      const directSalesRoute = buildSalesRouteReply(message, combinedUserText, lang);
      if (directSalesRoute) {
        return new Response(JSON.stringify(directSalesRoute), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // C. Quiz priority for broad routine-fit questions.
    // If the customer asks which routine fits their skin, route to the quiz first.
    // Do not let concern sales routing override this, otherwise "which routine for acne?"
    // becomes a direct product/routine push instead of the quiz flow.
    if (shouldRedirectToQuiz(message, combinedUserText)) {
      const quizOut = buildQuizRedirectReply(lang);
      return new Response(JSON.stringify(quizOut), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // C2. Product-only context must beat routine sales routing.
    // Example: user asks "Can you recommend 1-2 products, not a full routine?" and then says "dry skin".
    // In that case we recommend products, not Dry Skin Routine.
    if (
      contextSuggestsProductOnly &&
      currentHasGoalSignal &&
      !detectRoutineHelpRequest(message) &&
      !detectUsageRequest(message) &&
      !detectCombinationRequest(message) &&
      !detectWhereRequest(message) &&
      !detectSuitabilityRequest(message) &&
      !detectCompareRequest(message)
    ) {
      const picks = recommendProductsFromText(combinedUserText);
      return new Response(
        JSON.stringify({
          reply: buildProductRecommendationReply(picks, lang),
          actions: buildActionsForProducts(picks).slice(0, 2),
          lang,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // C3. If the assistant just asked whether the customer wants a small or complete routine,
    // use that answer for every skin type/concern.
    const routineSizeAnswer = detectRoutineSizeAnswer(message);
    if (
      assistantAskedRoutineSizePreference(conversationTimeline) &&
      routineSizeAnswer &&
      !contextSuggestsProductOnly &&
      !detectUsageRequest(message) &&
      !detectCombinationRequest(message) &&
      !detectWhereRequest(message) &&
      !detectSuitabilityRequest(message) &&
      !detectCompareRequest(message)
    ) {
      const concern = detectPrimaryConcern(combinedUserText);
      const chosenRoutine = concern
        ? buildChosenRoutineFromSizeReply(concern, routineSizeAnswer, lang, detectSPFQuestion(message))
        : null;

      if (chosenRoutine) {
        return new Response(JSON.stringify(chosenRoutine), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // C4. Direct concern statements should not instantly push a routine.
    // Ask whether the customer wants something small or complete first, unless they already said it.
    if (
      false &&
      currentHasGoalSignal &&
      !contextSuggestsProductOnly &&
      !detectSimpleRoutinePreference(message) &&
      !detectFullRoutinePreference(message) &&
      !detectProductOnlyPreference(message) &&
      !detectProductRecommendationRequest(message) &&
      !detectRoutineHelpRequest(message) &&
      !detectNotKnowingSkinType(message) &&
      !detectUsageRequest(message) &&
      !detectCombinationRequest(message) &&
      !detectWhereRequest(message) &&
      !detectSuitabilityRequest(message) &&
      !detectCompareRequest(message) &&
      !isSpecificProductQuestion(message)
    ) {
      const concern = detectPrimaryConcern(combinedUserText);
      if (concern) {
        return new Response(
          JSON.stringify({
            reply: buildRoutineSizeQuestionReply(concern, lang),
            actions: [],
            lang,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }

    // D. Sales routing: concern first, product second. Prevents acne => only Acne Spot Care.
    // This is only for direct concern statements like "I have acne", not for broad
    // "which routine do I need?" questions, because those should go to the quiz.
    const salesRoute = buildSalesRouteReply(message, combinedUserText, lang);
    if (
      salesRoute &&
      currentHasGoalSignal &&
      !contextSuggestsProductOnly &&
      !detectProductOnlyPreference(message) &&
      !detectProductRecommendationRequest(message) &&
      !detectRoutineHelpRequest(message) &&
      !detectNotKnowingSkinType(message) &&
      !detectUsageRequest(message) &&
      !detectCombinationRequest(message) &&
      !detectWhereRequest(message) &&
      !detectSuitabilityRequest(message) &&
      !detectCompareRequest(message) &&
      !isSpecificProductQuestion(message)
    ) {
      return new Response(JSON.stringify(salesRoute), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 0. greeting
    if (detectGreeting(message)) {
      return new Response(JSON.stringify(buildGreetingReply(lang)), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 0.5 concern intent
    if (
      detectConcernIntent(message) &&
      !currentHasGoalSignal &&
      !detectUsageRequest(message) &&
      !detectCombinationRequest(message) &&
      !detectWhereRequest(message) &&
      !detectSuitabilityRequest(message) &&
      !detectProductRecommendationRequest(message) &&
      !detectRoutineHelpRequest(message)
    ) {
      return new Response(JSON.stringify(buildConcernReply(lang)), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 1. exact product wins over ambiguous alias logic
    if (!hasExactCanonicalProduct && ambiguousCandidates.length >= 2) {
      const contextProduct =
        explicitProducts.find(
          (p) =>
            !ambiguousCandidates.some(
              (a) =>
                canonicalizeProductName(a.title) ===
                canonicalizeProductName(p.title)
            )
        );

      return new Response(
        JSON.stringify({
          reply: buildAmbiguousAliasReply(ambiguousCandidates, lang, contextProduct),
          actions: [],
          lang,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // 2. relative order question like "voor of na toner"
    if (
      detectUsageRequest(message) &&
      detectRelativeOrderQuestion(message) &&
      explicitProducts.length >= 1 &&
      lastSingleContextProduct &&
      canonicalizeProductName(lastSingleContextProduct.title) !==
        canonicalizeProductName(explicitProducts[0].title)
    ) {
      return new Response(
        JSON.stringify({
          reply: buildRelativeOrderReply(lastSingleContextProduct, explicitProducts[0], lang),
          actions: buildActionsForProducts([lastSingleContextProduct, explicitProducts[0]]).slice(0, 2),
          lang,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // 3. plural reference + explicit product
    if (
      detectCombinationRequest(message) &&
      detectPluralReference(message) &&
      explicitProducts.length >= 1 &&
      lastRecommendedProducts.length >= 1
    ) {
      const anchor = explicitProducts[0];
      const previous = dedupeProducts(lastRecommendedProducts).filter(
        (p) =>
          canonicalizeProductName(p.title) !== canonicalizeProductName(anchor.title)
      );

      if (previous.length) {
        const replyParts = previous.map((p) =>
          buildDynamicCombinationReply(anchor, p, lang)
        );
        return new Response(
          JSON.stringify({
            reply: replyParts.join("\n\n"),
            actions: buildActionsForProducts([anchor, ...previous]),
            lang,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }

    // 4. plural reference like "how do i use those"
    if (detectPluralReference(message) && lastRecommendedProducts.length >= 2) {
      const chosen = lastRecommendedProducts.slice(0, 2);

      if (detectUsageRequest(message)) {
        return new Response(
          JSON.stringify({
            reply: buildMultiProductUsageReply(chosen, lang),
            actions: buildActionsForProducts(chosen).slice(0, 2),
            lang,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      if (detectCombinationRequest(message)) {
        return new Response(
          JSON.stringify({
            reply: buildDynamicCombinationReply(chosen[0], chosen[1], lang),
            actions: buildActionsForProducts(chosen).slice(0, 2),
            lang,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }

    // 5. direct combination with explicit products
    if (detectCombinationRequest(message) && explicitProducts.length >= 2) {
      return new Response(
        JSON.stringify({
          reply: buildDynamicCombinationReply(explicitProducts[0], explicitProducts[1], lang),
          actions: buildActionsForProducts([explicitProducts[0], explicitProducts[1]]).slice(0, 2),
          lang,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // 6. ambiguous contextual references
    if (
      detectAmbiguousReference(message) ||
      ((detectUsageRequest(message) ||
        detectCombinationRequest(message) ||
        detectWhereRequest(message) ||
        detectSuitabilityRequest(message)) &&
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
              actions: buildActionsForProduct(resolved),
              lang,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            }
          );
        }

        if (detectCombinationRequest(message)) {
          return new Response(
            JSON.stringify({
              reply: buildSingleProductPairingReply(resolved, lang),
              actions: buildActionsForProduct(resolved),
              lang,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            }
          );
        }

        if (detectWhereRequest(message)) {
          return new Response(
            JSON.stringify({
              reply: tr(
                lang,
                `**${resolved.title}**\n\nJe vindt het hier.`,
                `**${resolved.title}**\n\nYou can find it here.`
              ),
              actions: buildActionsForProduct(resolved),
              lang,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            }
          );
        }
      }

      if (recentProducts.length >= 2) {
        return new Response(
          JSON.stringify({
            reply: buildClarifyProductReply(recentProducts, lang),
            actions: [],
            lang,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }

    // 7. bundle usage
    if (detectUsageRequest(message)) {
      const bundle = mentionedBundles[0] || findBundleFromLooseIntent(message);
      if (bundle) {
        return new Response(
          JSON.stringify({
            reply: buildBundleUsageReply(bundle, lang),
            actions: buildActionsForBundle(bundle, lang),
            lang,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }

    // 8. product usage
    if (detectUsageRequest(message) && (mentionedProducts.length === 1 || looseProduct)) {
      const product = mentionedProducts[0] || looseProduct!;
      return new Response(
        JSON.stringify({
          reply: buildProductUsageReply(product, lang),
          actions: buildActionsForProduct(product),
          lang,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // 9. single explicit combination product
    if (detectCombinationRequest(message) && explicitProducts.length === 1) {
      return new Response(
        JSON.stringify({
          reply: buildSingleProductPairingReply(explicitProducts[0], lang),
          actions: buildActionsForProduct(explicitProducts[0]),
          lang,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // 10. generic advice request -> quiz
    if (detectGenericAdviceRequest(message)) {
      return new Response(
        JSON.stringify({
          reply: buildGenericAdviceReply(message, lang),
          actions: [
            {
              type: "OPEN_URL",
              label: tr(lang, "Start de quiz", "Start quiz", "Quiz starten"),
              url: QUIZ_URL,
            },
          ],
          lang,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // 10.5 Customer rejects full routine after a previous concern. Respect that context.
    if (detectSimpleRoutinePreference(message)) {
      const simpleSalesRoute = buildSalesRouteReply(message, combinedUserText, lang);
      if (simpleSalesRoute) {
        return new Response(JSON.stringify(simpleSalesRoute), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // 11. direct product recommendation from a single clear concern
    if (
      currentHasGoalSignal &&
      !detectRoutineHelpRequest(message) &&
      !detectProductOnlyPreference(message) &&
      !detectCombinationRequest(message) &&
      !detectUsageRequest(message) &&
      !detectWhereRequest(message) &&
      !detectSuitabilityRequest(message) &&
      !shouldRedirectToQuiz(message, combinedUserText)
    ) {
      const picks = recommendProductsFromText(message);

      if (picks.length) {
        return new Response(
          JSON.stringify({
            reply: buildProductRecommendationReply(picks, lang),
            actions: buildActionsForProducts(picks).slice(0, 2),
            lang,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }

    // 12. contextual short reply after product request
    if (
      contextSuggestsProductOnly &&
      currentHasGoalSignal &&
      normalize(message).split(" ").length <= 5 &&
      !detectCombinationRequest(message) &&
      !detectUsageRequest(message) &&
      !detectWhereRequest(message) &&
      !detectSuitabilityRequest(message)
    ) {
      const picks = recommendProductsFromText(combinedUserText);

      return new Response(
        JSON.stringify({
          reply: buildProductRecommendationReply(picks, lang),
          actions: buildActionsForProducts(picks).slice(0, 2),
          lang,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // 13. product recommendation hard override
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
          actions: buildActionsForProducts(picks).slice(0, 2),
          lang,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // 14. compare
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
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }

    // 15. where
    if (detectWhereRequest(message) && (mentionedProducts.length === 1 || looseProduct)) {
      const product = mentionedProducts[0] || looseProduct!;
      return new Response(
        JSON.stringify({
          reply: tr(
            lang,
            `**${product.title}**\n\nJe vindt het hier.`,
            `**${product.title}**\n\nYou can find it here.`
          ),
          actions: buildActionsForProduct(product),
          lang,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // 16. suitability
    if (detectSuitabilityRequest(message) && (mentionedProducts.length === 1 || looseProduct)) {
      const product = mentionedProducts[0] || looseProduct!;
      return new Response(
        JSON.stringify({
          reply: tr(
            lang,
            `**${product.title}**\n\n${getSafeShortCopy(product, lang)}\n\nVertel me wat voor huid je hebt en wat je doel is, dan zeg ik of dit goed past.`,
            `**${product.title}**\n\n${getSafeShortCopy(product, lang)}\n\nTell me your skin type and goal, and I’ll tell you if it fits.`
          ),
          actions: buildActionsForProduct(product),
          lang,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // 17. routine to quiz
    if (shouldRedirectToQuiz(message, combinedUserText)) {
      const quizOut = buildQuizRedirectReply(lang);
      return new Response(JSON.stringify(quizOut), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 18. specific product
    if (mentionedProducts.length === 1 || looseProduct) {
      const product = mentionedProducts[0] || looseProduct!;
      return new Response(
        JSON.stringify({
          reply: buildProductReply(product, lang),
          actions: buildActionsForProduct(product),
          lang,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // 19. specific bundle
    if (mentionedBundles.length === 1) {
      const bundle = mentionedBundles[0];
      return new Response(
        JSON.stringify({
          reply: buildBundleProductsReply(bundle, lang, { includeSpfNote: detectSPFQuestion(message) }),
          actions: buildActionsForBundle(bundle, lang),
          lang,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // 20. OpenAI fallback
    const tier = decideModelTier(message, combinedUserText);
    const openAIOut = await callOpenAIFallback(message, conversationTimeline, lang, tier);

    return new Response(JSON.stringify(openAIOut), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e: unknown) {
    console.error("SOVAH /api/chat error:", e);

    return new Response(
      JSON.stringify({
        reply: "Sorry, something went wrong. Try again later.",
        actions: [],
        lang: "en",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
}
