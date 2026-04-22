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

function tr(lang: Lang, nl: string, en: string): string {
  return lang === "nl" ? nl : en;
}

// ───────────────── aliases / canonicalization ─────────────────

const PRODUCT_ALIASES: Record<string, string[]> = {
  "Micellar Cleansing Water": [
    "micellar cleansing water",
    "micellar water",
    "micellar cleanser",
    "cleansing water",
  ],
  "Hydrating Toner": [
    "hydrating toner",
    "hydra toner",
    "toner",
  ],
  "Hydrating Serum": [
    "hydrating serum",
    "hydra serum",
  ],
  "Double Hydration Boost Gel + HA": [
    "double hydration boost gel + ha",
    "double hydration boost gel",
    "boost gel + ha",
    "hydration boost gel",
    "boost gel",
    "ha gel",
  ],
  "Moisturising Day Cream": [
    "moisturising day cream",
    "moisturizing day cream",
    "moisture day cream",
    "hydrating day cream",
    "day cream",
    "dagcreme",
    "dagcrème",
  ],
  "Ceramide Barrier Night Cream": [
    "ceramide barrier night cream",
    "ceramide night cream",
    "barrier night cream",
    "ceramide cream",
    "barrier cream",
    "night cream",
    "nachtcreme",
    "nachtcrème",
  ],
  "Purifying Mousse": [
    "purifying mousse",
    "mousse cleanser",
    "cleansing mousse",
    "mousse",
  ],
  "Antioxidant Ginkgo Gel Booster": [
    "antioxidant ginkgo gel booster",
    "ginkgo gel booster",
    "ginkgo booster",
  ],
  "Calming Facial Oil": [
    "calming facial oil",
    "calming oil",
  ],
  "AHA Peeling Concentrate": [
    "aha peeling concentrate",
    "aha peeling",
    "aha",
    "aha concentrate",
  ],
  "Caffeine Gel Booster": [
    "caffeine gel booster",
    "caffeine booster",
  ],
  "Oil-Free Hydrating Gel": [
    "oil-free hydrating gel",
    "oil free hydrating gel",
    "oil-free gel",
    "oil free gel",
  ],
  "Peptide Anti-Aging Serum": [
    "peptide anti-aging serum",
    "peptide anti aging serum",
    "peptide serum",
  ],
  "Collagen Boost Serum": [
    "collagen boost serum",
    "collagen serum",
    "collagen boost",
  ],
  "Anti-Age Day Cream": [
    "anti-age day cream",
    "anti age day cream",
    "anti-aging day cream",
    "anti aging day cream",
  ],
  "Natural Retinol Alternative Oil Serum": [
    "natural retinol alternative oil serum",
    "retinol alternative oil serum",
    "natural retinol alternative",
    "retinol alternative",
  ],
  "Smoothing Eye Cream": [
    "smoothing eye cream",
    "eye cream",
    "oogcreme",
    "oogcrème",
  ],
  "Vitamin C Serum": [
    "vitamin c serum",
    "vitamin c",
    "vit c serum",
    "vit c",
  ],
  "Brightening Face&Body Exfoliator with Kojic Acid": [
    "brightening face body exfoliator with kojic acid",
    "brightening exfoliator with kojic acid",
    "brightening exfoliator",
    "kojic exfoliator",
  ],
  "Dark Spot Face Cream with Kojic Acid": [
    "dark spot face cream with kojic acid",
    "dark spot cream with kojic acid",
    "dark spot cream",
    "kojic acid cream",
  ],
  "All-In-One Facial Oil": [
    "all-in-one facial oil",
    "all in one facial oil",
    "all-in-one oil",
    "all in one oil",
  ],
  "Sun Protection SPF50 Stick, no tint": [
    "sun protection spf50 stick no tint",
    "sun protection spf50 stick",
    "sun protection stick",
    "spf50 stick",
    "spf stick",
    "sun stick",
    "sunscreen stick",
    "sunscreen",
    "sun protection",
    "spf",
    "zonnebrand",
    "zonnebrandcreme",
    "zonnebrandcrème",
    "suncream",
    "sun screen",
  ],
  "Acne Spot Care": [
    "acne spot care",
    "acne spot",
    "spot care",
    "spot treatment",
    "acne treatment",
  ],
  "Niacinamide Gel Moisturiser": [
    "niacinamide gel moisturiser",
    "niacinamide gel moisturizer",
    "niacinamide moisturiser",
    "niacinamide moisturizer",
    "niacinamide gel",
    "niacinamide",
  ],
};

const AMBIGUOUS_ALIAS_GROUPS: Array<{
  aliases: string[];
  productNames: string[];
}> = [
  {
    aliases: ["day cream", "dagcreme", "dagcrème"],
    productNames: ["Moisturising Day Cream", "Anti-Age Day Cream"],
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
  const current = normalize(currentMessage);
  const history = normalize(historyText);

  const strongEnglishSignals = [
    "can i combine",
    "how do i use",
    "which routine",
    "i want",
    "dry skin",
    "breakouts",
    "older skin",
    "what do you recommend",
    "can you recommend",
    "day cream",
    "night cream",
    "those",
    "them",
    "this one",
    "that one",
    "moisturising",
    "anti age",
    "hello",
    "hi",
  ];

  const strongDutchSignals = [
    "kan ik combineren",
    "hoe gebruik ik",
    "welke routine",
    "ik wil",
    "droge huid",
    "puistjes",
    "oudere huid",
    "wat raad je aan",
    "kan je aanraden",
    "dagcrème",
    "dagcreme",
    "nachtcrème",
    "nachtcreme",
    "deze",
    "die",
    "dit product",
    "hydraterend",
    "hallo",
    "hoi",
  ];

  const hasStrongEn = strongEnglishSignals.some((w) => current.includes(w));
  const hasStrongNl = strongDutchSignals.some((w) => current.includes(w));

  if (hasStrongEn && !hasStrongNl) return "en";
  if (hasStrongNl && !hasStrongEn) return "nl";

  const dutchSignals = [
    "ik",
    "mijn",
    "huid",
    "droog",
    "droge",
    "vette",
    "vet",
    "gevoelig",
    "welke",
    "wat",
    "past",
    "bij",
    "mij",
    "puistjes",
    "acne",
    "routine",
    "product",
    "producten",
    "hoe gebruik",
    "wanneer gebruik",
    "oudere huid",
    "fijne lijntjes",
    "rimpels",
    "geen routine",
    "paar producten",
    "deze",
    "die",
    "dit",
    "droge huid",
    "gevoelige huid",
    "voor puistjes",
    "dagcreme",
    "dagcrème",
    "hallo",
    "hoi",
  ];

  const englishSignals = [
    "my",
    "skin",
    "dry",
    "oily",
    "sensitive",
    "which",
    "what",
    "routine",
    "product",
    "products",
    "how do i use",
    "when do i use",
    "older skin",
    "fine lines",
    "wrinkles",
    "not a full routine",
    "few products",
    "this",
    "that",
    "dry skin",
    "sensitive skin",
    "breakouts",
    "those",
    "them",
    "both",
    "day cream",
    "night cream",
    "hello",
    "hi",
  ];

  const currentNl = countMatches(current, dutchSignals);
  const currentEn = countMatches(current, englishSignals);
  const historyNl = countMatches(history, dutchSignals);
  const historyEn = countMatches(history, englishSignals);

  if (currentEn > 0 && currentNl === 0) return "en";
  if (currentNl > 0 && currentEn === 0) return "nl";

  const nlScore = currentNl * 5 + historyNl;
  const enScore = currentEn * 5 + historyEn;

  if (nlScore > enScore) return "nl";
  if (enScore > nlScore) return "en";

  if (forcedLang === "nl" || forcedLang === "en") return forcedLang;
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
  return bundleCatalog.bundles.filter((b) => t.includes(normalizeLoose(b.name)));
}

function findBundleFromLooseIntent(text: string): Bundle | undefined {
  const t = normalizeLoose(text);
  return bundleCatalog.bundles.find((b) => t.includes(normalizeLoose(b.name)));
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
    "droog",
    "droge huid",
    "uitgedroogd",
    "vochttekort",
    "tight",
    "flaky",
  ]);
}

function detectGlowSignal(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "glow",
    "radiance",
    "dull",
    "stralend",
    "doffe huid",
    "dof",
    "meer glow",
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
    "onzuiverheden",
  ]);
}

function detectSensitiveSignal(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "sensitive",
    "gevoelig",
    "reactive",
    "reactief",
    "irritated",
    "geïrriteerd",
    "geirriteerd",
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
    "rimpels",
    "fijne lijntjes",
    "firmness",
    "stevigheid",
    "older skin",
    "oudere huid",
    "verouderende huid",
  ]);
}

function detectSkinType(text: string): SkinType {
  const t = normalize(text);

  if (
    hasAny(t, [
      "combination",
      "combi",
      "combo skin",
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
    "ik weet niet wat ik nodig heb",
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

  if (detectRoutineHelpRequest(message)) return true;
  if (detectNotKnowingSkinType(message)) return true;

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
    return true;
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

// ───────────────── smart copy ─────────────────

function getSmartFallbackCopy(product: Product, lang: Lang): string {
  const title = product.title;

  const nl: Record<string, string> = {
    "Hydrating Serum":
      "Een licht serum voor extra hydratatie en een comfortabeler huidgevoel.",
    "Moisturising Day Cream":
      "Een dagcrème voor dagelijkse hydratatie en comfort.",
    "Acne Spot Care":
      "Gerichte spot care voor puistjes en onzuiverheden.",
    "Niacinamide Gel Moisturiser":
      "Een lichte gel moisturiser voor balans en comfort.",
    "Oil-Free Hydrating Gel":
      "Een olievrije gel voor lichte dagelijkse hydratatie.",
    "Hydrating Toner": "Een hydraterende toner voor comfort en balans.",
    "Vitamin C Serum":
      "Een serum voor een frissere en stralendere uitstraling.",
    "Antioxidant Ginkgo Gel Booster":
      "Een lichte booster voor hydratatie en een frissere uitstraling.",
    "Calming Facial Oil":
      "Een kalmerende olie voor comfort en zachtheid.",
    "Ceramide Barrier Night Cream":
      "Een rijke nachtcrème voor comfort en support van de huidbarrière.",
    "Purifying Mousse":
      "Een schuimende reiniger voor een frisse, lichte finish.",
    "Peptide Anti-Aging Serum":
      "Een serum voor een gladdere en verzorgde uitstraling.",
    "Anti-Age Day Cream":
      "Een dagcrème voor dagelijkse verzorging bij eerste lijntjes.",
    "Collagen Boost Serum":
      "Een serum gericht op stevigheid en comfort.",
    "AHA Peeling Concentrate":
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
    "Brightening Face&Body Exfoliator with Kojic Acid":
      "Een exfoliator voor een gladdere en frissere uitstraling.",
    "Double Hydration Boost Gel + HA":
      "Een hydraterende gel voor extra comfort en een voller huidgevoel.",
    "Smoothing Eye Cream":
      "Een oogcrème voor een zachtere en verzorgde oogzone.",
    "Caffeine Gel Booster":
      "Een lichte gel booster voor een frissere uitstraling.",
  };

  const en: Record<string, string> = {
    "Hydrating Serum":
      "A lightweight serum for extra hydration and a more comfortable skin feel.",
    "Moisturising Day Cream":
      "A day cream for daily hydration and comfort.",
    "Acne Spot Care":
      "A targeted spot treatment for blemishes and breakouts.",
    "Niacinamide Gel Moisturiser":
      "A lightweight gel moisturiser for balance and comfort.",
    "Oil-Free Hydrating Gel":
      "An oil-free gel for lightweight daily hydration.",
    "Hydrating Toner": "A hydrating toner for comfort and balance.",
    "Vitamin C Serum":
      "A serum for a fresher and more radiant-looking complexion.",
    "Antioxidant Ginkgo Gel Booster":
      "A lightweight booster for hydration and a fresher look.",
    "Calming Facial Oil":
      "A calming facial oil for comfort and softness.",
    "Ceramide Barrier Night Cream":
      "A rich night cream for comfort and barrier support.",
    "Purifying Mousse":
      "A foaming cleanser for a fresh, lightweight feel.",
    "Peptide Anti-Aging Serum":
      "A serum for a smoother-looking complexion.",
    "Anti-Age Day Cream":
      "A day cream for daily care with an early anti-age focus.",
    "Collagen Boost Serum":
      "A serum focused on firmness and comfort.",
    "AHA Peeling Concentrate":
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
    "Brightening Face&Body Exfoliator with Kojic Acid":
      "An exfoliator for a smoother and fresher-looking finish.",
    "Double Hydration Boost Gel + HA":
      "A hydrating gel for extra comfort and a plumper-looking feel.",
    "Smoothing Eye Cream":
      "An eye cream for a softer and more cared-for eye area.",
    "Caffeine Gel Booster":
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
      type: "OPEN_URL",
      label: tr(lang, "Bekijk routine", "View routine"),
      url: bundle.url,
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
        label: tr(lang, "Start de quiz", "Start quiz"),
        url: QUIZ_URL,
      },
    ],
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
        : `**When do you use it?**\n${whenToUse}`
    );
  }

  if (step) {
    parts.push(
      lang === "nl"
        ? `**Stap in je routine**\n${step}`
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
  if (caution) {
    parts.push(lang === "nl" ? `**Let op**\n${caution}` : `**Caution**\n${caution}`);
  }

  return parts.join("\n\n");
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
    titles.includes("AHA Peeling Concentrate") &&
    (titles.includes("Vitamin C Serum") ||
      titles.includes("Natural Retinol Alternative Oil Serum"));

  const exfoliantWithSpot =
    titles.includes("AHA Peeling Concentrate") &&
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

  const lines = products.map((p) => `**${p.title}**\n${getSafeShortCopy(p, lang)}`);

  return `${intro}\n\n${lines.join("\n\n")}`;
}

function buildClarifyProductReply(products: Product[], lang: Lang): string {
  const unique = dedupeProducts(products).slice(0, 4);
  const names = unique.map((p) => p.title);

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
  const names = unique.map((p) => p.title);

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
    if (p && !picks.find((x) => canonicalizeProductName(x.title) === canonicalizeProductName(p.title))) {
      picks.push(p);
    }
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

// ───────────────── OpenAI fallback ─────────────────

function decideModelTier(message: string, combinedUserText: string): ModelTier {
  const current = normalize(message);
  const combined = normalize(combinedUserText);

  if (
    detectUsageRequest(message) ||
    detectCombinationRequest(message) ||
    detectWhereRequest(message) ||
    detectSuitabilityRequest(message)
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
- Reply in ${lang === "nl" ? "Dutch" : "English"} only.

STRICT RULES:
- Use only the provided product and bundle catalog as source of truth.
- Never invent ingredients, usage steps, medical claims, diagnoses, or results.
- Keep the reply concise, premium, natural, and practical.
- Never mention suppliers or external brands.
- If the user clearly wants only products, recommend 1 or 2 products maximum.
- If the user wants a full routine or best routine match, tell them to use the skincare quiz.
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

Write the best answer now in ${lang === "nl" ? "Dutch" : "English"}.
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
        "I'm not fully sure what you mean yet. Is it about a product, how to use something, a few products, or do you want help with the right routine?"
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
        effort: tier === "full" ? "medium" : "minimal",
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
          "Tell me which product or routine you mean, and I’ll help from there."
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
    const lang = detectLanguage(message, combinedUserText, forcedLang);

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

    // 0. greeting
    if (detectGreeting(message)) {
      return new Response(JSON.stringify(buildGreetingReply(lang)), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 1. exact product wins over ambiguous alias logic
    if (!hasExactCanonicalProduct && ambiguousCandidates.length >= 2) {
      const contextProduct =
        explicitProducts.find((p) => !ambiguousCandidates.some((a) => canonicalizeProductName(a.title) === canonicalizeProductName(p.title)));

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
      canonicalizeProductName(lastSingleContextProduct.title) !== canonicalizeProductName(explicitProducts[0].title)
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
        (p) => canonicalizeProductName(p.title) !== canonicalizeProductName(anchor.title)
      );

      if (previous.length) {
        const replyParts = previous.map((p) => buildDynamicCombinationReply(anchor, p, lang));
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
              label: tr(lang, "Start de quiz", "Start quiz"),
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
          reply: `**${bundle.name}**\n\n${
            bundle.description ||
            tr(
              lang,
              "Routine uit het huidige SOVAH assortiment.",
              "Routine from the current SOVAH range."
            )
          }`,
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
