import fs from "fs";
import path from "path";
import OpenAI from "openai";

function buildCorsHeaders(origin?: string | null) {
  const allowedOrigins = [
    "https://sovahcare.com",
    "https://www.sovahcare.com",
  ];

  const safeOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

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

const QUIZ_URL = "https://sovahcare.com/pages/find-your-routine";

type Lang = "nl" | "en";
type ChatAction = { type: "OPEN_URL"; label: string; url: string };
type SkinGoal =
  | "dry"
  | "sensitive"
  | "oily"
  | "combination"
  | "normal"
  | "acne"
  | "dull"
  | "aging"
  | "dark_spots"
  | "unknown";

type DetectionMap = Record<string, unknown>;

type Bundle = {
  name: string;
  handle?: string;
  url: string;
  type?: string;
  target?: string;
  description?: string;
  products?: string[];
  bundle_products?: string[];
  quiz_route?: string[];
  quiz_route_misspellings?: string[];
  ai_routing_support?: DetectionMap;
  how_to_use_nl?: { morning?: string[]; evening?: string[] };
  how_to_use_en?: { morning?: string[]; evening?: string[] };
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
  ai_detection?: DetectionMap;
  do_not_recommend_when?: string[];
};

type BundleCatalog = { bundles: Bundle[] };
type ProductCatalog = { products: Product[] };
type BotResponse = { reply: string; actions: ChatAction[]; lang: Lang };

const bundleCatalog: BundleCatalog = JSON.parse(BUNDLES_JSON);
const productCatalog: ProductCatalog = JSON.parse(PRODUCTS_JSON);

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

// ───────────────── text helpers ─────────────────

function normalize(text: string): string {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s&+\-'/]/g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function loose(text: string): string {
  return normalize(text).replace(/[&+\-'/]/g, " ").replace(/\s+/g, " ").trim();
}

function compact(text: string): string {
  return loose(text).replace(/\s+/g, "");
}

function tr(lang: Lang, nl: string, en: string): string {
  return lang === "nl" ? nl : en;
}

function hasAny(text: string, signals: string[]): boolean {
  const t = loose(text);
  return signals.some((signal) => {
    const s = loose(signal);
    return !!s && (t.includes(s) || compact(t).includes(compact(s)));
  });
}

function unique<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function flattenStrings(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenStrings);
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap(flattenStrings);
  return [];
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }

  return prev[b.length];
}

function fuzzyIncludes(text: string, phrase: string): boolean {
  const t = loose(text);
  const p = loose(phrase);
  if (!p) return false;
  if (t.includes(p) || compact(t).includes(compact(p))) return true;

  const phraseWords = p.split(" ").filter(Boolean);
  const words = t.split(" ").filter(Boolean);
  if (!phraseWords.length || !words.length) return false;

  if (phraseWords.length === 1) {
    const target = phraseWords[0];
    if (target.length < 5) return false;
    return words.some((word) => {
      if (Math.abs(word.length - target.length) > 2) return false;
      const distance = levenshtein(word, target);
      return distance <= (target.length <= 7 ? 1 : 2);
    });
  }

  if (phraseWords.length <= 4) {
    for (let i = 0; i <= words.length - phraseWords.length; i++) {
      const window = words.slice(i, i + phraseWords.length).join(" ");
      const distance = levenshtein(window, p);
      if (distance <= Math.max(2, Math.floor(p.length * 0.18))) return true;
    }
  }

  return false;
}

function scoreSignals(text: string, signals: string[]): number {
  let score = 0;
  const seen = new Set<string>();

  for (const raw of signals) {
    const signal = loose(raw);
    if (!signal || seen.has(signal)) continue;
    seen.add(signal);

    if (loose(text).includes(signal)) {
      score += signal.split(" ").length >= 3 ? 5 : 3;
    } else if (compact(text).includes(compact(signal))) {
      score += 3;
    } else if (fuzzyIncludes(text, signal)) {
      score += 2;
    }
  }

  return score;
}

function detectLanguage(message: string, historyText = "", forcedLang?: string): Lang {
  if (forcedLang === "nl" || forcedLang === "en") return forcedLang;

  const text = `${message} ${historyText}`;
  const nlSignals = [
    "ik", "mijn", "huid", "droog", "vet", "gevoelig", "puistjes", "welke", "wat", "hoe", "waar", "routine", "producten", "gebruik", "ochtend", "avond", "crème", "creme", "doffe", "normale", "combinatie", "rimpels", "lijntjes",
  ];
  const enSignals = [
    "i", "my", "skin", "dry", "oily", "sensitive", "breakouts", "which", "what", "how", "where", "routine", "products", "use", "morning", "evening", "cream", "dull", "normal", "combination", "wrinkles", "lines",
  ];

  const nlScore = scoreSignals(text, nlSignals);
  const enScore = scoreSignals(text, enSignals);
  return enScore > nlScore + 2 ? "en" : "nl";
}

// ───────────────── catalog indexing ─────────────────

const PRODUCT_EXTRA_ALIASES: Record<string, string[]> = {
  "Micellar Cleansing Water": ["micellar water", "cleansing water", "makeup remover", "make up remover", "reinigingswater", "micelair water", "micelair reiniger", "zachte reiniger"],
  "Hydrating Toner": ["toner", "hydrating toner", "hydraterende toner", "hydra toner", "toner voor droge huid"],
  "Hydrating Serum": ["hydrating serum", "hydraterend serum", "hydration serum", "hydra serum", "serum droge huid"],
  "Double Hydration Boost Gel + HA": ["double hydration", "hydration boost", "boost gel", "ha gel", "hyaluronic gel", "hyaluron gel", "extra hydratatie gel"],
  "Moisturising Day Cream": ["day cream", "dagcreme", "dag crème", "dagcrème", "moisturizer", "moisturiser", "normal moisturiser", "normale moisturizer", "normale creme"],
  "Ceramide Barrier Night Cream": ["night cream", "nachtcreme", "nachtcrème", "barrier cream", "ceramide cream", "barriere creme", "barrière crème"],
  "Purifying Mousse": ["purifying mousse", "purifying mouse", "cleansing mousse", "mousse cleanser", "foam cleanser", "schuim reiniger", "reinigingsmousse", "mousse"],
  "Antioxidant Ginkgo Gel Booster": ["ginkgo booster", "gel booster", "antioxidant booster", "ginko booster", "gingko booster"],
  "Calming Facial Oil": ["calming oil", "facial oil", "kalmerende olie", "gezichtsolie", "sensitive oil"],
  "AHA Peeling Concentrate": ["aha", "aha peeling", "peeling", "peeling concentrate", "exfoliating serum", "exfoliant", "peel"],
  "Caffeine Gel Booster": ["caffeine booster", "caffeine gel", "cafeine booster", "caffein booster", "booster wallen", "wakkere look"],
  "Oil-Free Hydrating Gel": ["oil free gel", "oil-free gel", "oil free hydrating gel", "olievrije gel", "vette huid gel", "light gel", "lichte gel"],
  "Peptide Anti-Aging Serum": ["peptide serum", "anti aging serum", "anti-age serum", "anti age serum", "peptide anti aging", "fijne lijntjes serum"],
  "Collagen Boost Serum": ["collagen serum", "collagen boost", "collageen serum", "collageen booster", "firming serum"],
  "Anti-Age Day Cream": ["anti age day cream", "anti-aging day cream", "anti age cream", "anti age creme", "anti aging creme", "aging moisturizer", "aging moisturiser"],
  "Natural Retinol Alternative Oil Serum": ["retinol alternative", "retinol alternatief", "natural retinol", "retinol oil", "retinol olie", "bakuchiol", "anti aging oil"],
  "Smoothing Eye Cream": ["eye cream", "oogcreme", "oogcrème", "eye creme", "under eye cream", "oog verzorging", "wallen creme"],
  "Vitamin C Serum": ["vitamin c", "vitamine c", "vit c", "vit c serum", "vitamine c serum", "glow serum", "brightening serum"],
  "Brightening Face&Body Exfoliator with Kojic Acid": ["brightening exfoliator", "kojic exfoliator", "face body exfoliator", "body exfoliator", "kojic acid exfoliator", "scrub kojic", "face and body exfoliator"],
  "Dark Spot Face Cream with Kojic Acid": ["dark spot cream", "dark spots cream", "kojic cream", "kojic acid cream", "pigment cream", "pigmentvlekken creme", "dark spot face cream"],
  "All-In-One Facial Oil": ["all in one oil", "all-in-one oil", "facial oil", "gezicht olie", "glow oil", "alles in een olie"],
  "Sun Protection SPF50 Stick, no tint": ["spf", "spf50", "spf stick", "sun stick", "sunscreen", "sun screen", "zonnebrand", "zonnebrand stick", "sun protection", "zonbescherming"],
  "Acne Spot Care": ["acne spot", "spot care", "spot treatment", "puistjes treatment", "puistjes gel", "puistjes product", "acne treatment", "pimple treatment"],
  "Niacinamide Gel Moisturiser": ["niacinamide", "niacinamide gel", "niacinamide moisturiser", "niacinamide moisturizer", "niacimide", "niacinemide", "gel moisturiser", "gel moisturizer"],
};

const BUNDLE_EXTRA_ALIASES: Record<string, string[]> = {
  "Dry Skin Routine": ["dry routine", "dry skin", "droge huid routine", "droge huid", "dehydrated routine", "hydration routine", "dry dehydrated skin routine", "dry & dehydrated skin routine"],
  "Sensitive Skin Routine": ["sensitive routine", "sensitive skin", "gevoelige huid routine", "sensitive reactive skin routine", "sensitive & reactive skin routine", "reactive skin routine"],
  "Acne Routine": ["acne skin routine", "clear routine", "clear balanced routine", "clear & balanced skin routine", "puistjes routine", "onzuiverheden routine", "acne bundel"],
  "Combination Skin Routine": ["combination routine", "combination skin balance routine", "combination skin", "combinatiehuid routine", "combinatie huid routine", "combo skin routine"],
  "Normal Skin Routine": ["normal routine", "normal balanced skin routine", "normal & balanced skin routine", "normale huid routine", "balanced routine"],
  "Dull Skin Routine": ["dull routine", "dull skin", "doffe huid routine", "glow routine", "glow radiance routine", "glow & radiance routine", "radiance routine"],
  "Aging Skin Routine": ["aging routine", "anti aging routine", "anti-age routine", "firm smooth routine", "firm & smooth skin routine", "ouder wordende huid routine"],
  "Simple Normal Skin Routine": ["simple normal", "simple normal routine", "simpele normale huid routine", "basic normal routine"],
  "Simple Sensitive Skin Routine": ["simple sensitive", "simple sensitive routine", "simpele gevoelige huid routine"],
  "Simple Oily Skin Routine": ["simple oily", "simple oily routine", "simpele vette huid routine", "basic oily routine"],
  "Simple Combination Skin Routine": ["simple combination", "simple combination routine", "simpele combinatie huid routine", "basic combination routine"],
  "Simple Aging Skin Routine": ["simple aging", "simple anti aging", "simple anti-age routine", "simpele aging routine"],
  "Simple Acne Routine": ["simple acne", "simple acne routine", "simple blemish control routine", "simpele acne routine", "basic acne routine"],
  "Simple Dull Skin Routine": ["simple dull", "simple dull routine", "simple glow routine", "simpele doffe huid routine", "basic dull routine"],
};

const GOAL_SIGNALS: Record<SkinGoal, string[]> = {
  dry: ["dry", "dry skin", "dehydrated", "dehydrated skin", "tight skin", "tight face", "flaky", "rough", "needs hydration", "hydration", "droog", "droge huid", "vochtarm", "uitgedroogd", "trekkerig", "schilfert", "schilferig", "hydratie", "mijn huid trekt"],
  sensitive: ["sensitive", "sensitive skin", "reactive", "redness", "irritated", "burning skin", "skin reacts", "gevoelig", "gevoelige huid", "reactief", "rode huid", "roodheid", "geirriteerd", "geïrriteerd", "prikt", "brandend"],
  oily: ["oily", "oily skin", "greasy", "shiny", "shine", "oil control", "vette huid", "vet", "glimmend", "glimt", "veel talg", "olieachtig", "snel vet"],
  combination: ["combination", "combination skin", "combo skin", "mixed skin", "oily t zone", "dry cheeks", "t zone", "combinatiehuid", "gecombineerde huid", "vette t zone", "droge wangen", "gemengde huid"],
  normal: ["normal", "normal skin", "balanced", "balanced skin", "no concern", "geen probleem", "normale huid", "normaal", "gebalanceerd", "huid is prima", "gewoon onderhoud"],
  acne: ["acne", "pimples", "pimple", "breakout", "breakouts", "spots", "blemishes", "blackheads", "clogged pores", "puistjes", "puisten", "onzuiverheden", "mee eters", "mee-eters", "verstopte porien", "verstopte poriën", "acnee", "puisjes"],
  dull: ["dull", "dull skin", "tired skin", "lack of glow", "glow", "radiance", "brighten", "fresh skin", "doffe huid", "dof", "vermoeide huid", "grauwe huid", "meer glow", "stralend", "frisse huid", "futloos"],
  aging: ["aging", "ageing", "anti aging", "anti-age", "fine lines", "wrinkles", "firmness", "loss of firmness", "older skin", "rijpere huid", "anti aging", "fijne lijntjes", "rimpels", "stevigheid", "slappere huid", "ouder wordende huid"],
  dark_spots: ["dark spots", "pigmentation", "hyperpigmentation", "uneven tone", "dark marks", "pigment", "pigmentvlekken", "vlekjes", "donkere vlekken", "egale teint", "oneffen teint"],
  unknown: [],
};

function productAliases(product: Product): string[] {
  return unique(
    [
      product.title,
      product.handle?.replace(/-/g, " "),
      ...(PRODUCT_EXTRA_ALIASES[product.title] || []),
      ...flattenStrings(product.ai_detection),
    ],
    loose
  );
}

function bundleAliases(bundle: Bundle): string[] {
  return unique(
    [
      bundle.name,
      bundle.handle?.replace(/-/g, " ") || "",
      ...(BUNDLE_EXTRA_ALIASES[bundle.name] || []),
      ...(bundle.quiz_route || []),
      ...(bundle.quiz_route_misspellings || []),
      ...flattenStrings(bundle.ai_routing_support),
    ],
    loose
  );
}

function getBundleProducts(bundle: Bundle): Product[] {
  const names = bundle.bundle_products?.length ? bundle.bundle_products : bundle.products || [];
  const products = names
    .map((name) => getProductByName(name))
    .filter((p): p is Product => Boolean(p));
  return unique(products, (p) => loose(p.title));
}

function getProductByName(name: string): Product | undefined {
  const target = loose(name);
  return productCatalog.products.find((product) => {
    if (loose(product.title) === target) return true;
    if (loose(product.handle.replace(/-/g, " ")) === target) return true;
    return productAliases(product).some((alias) => loose(alias) === target);
  });
}

function findMentionedProducts(text: string): Product[] {
  const hits = productCatalog.products
    .map((product) => ({ product, score: scoreSignals(text, productAliases(product)) }))
    .filter((item) => item.score >= 3)
    .sort((a, b) => b.score - a.score);

  const maxScore = hits[0]?.score || 0;
  return unique(
    hits.filter((item) => item.score >= Math.max(3, maxScore - 3)).map((item) => item.product),
    (p) => loose(p.title)
  ).slice(0, 5);
}

function findMentionedBundles(text: string): Bundle[] {
  const hits = bundleCatalog.bundles
    .map((bundle) => ({ bundle, score: scoreSignals(text, bundleAliases(bundle)) }))
    .filter((item) => item.score >= 3)
    .sort((a, b) => b.score - a.score);

  const maxScore = hits[0]?.score || 0;
  return unique(
    hits.filter((item) => item.score >= Math.max(3, maxScore - 4)).map((item) => item.bundle),
    (b) => loose(b.name)
  ).slice(0, 4);
}

function getGoalScores(text: string): Array<{ goal: SkinGoal; score: number }> {
  return (Object.keys(GOAL_SIGNALS) as SkinGoal[])
    .filter((goal) => goal !== "unknown")
    .map((goal) => ({ goal, score: scoreSignals(text, GOAL_SIGNALS[goal]) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

function primaryGoal(text: string): SkinGoal {
  const scores = getGoalScores(text);
  return scores[0]?.goal || "unknown";
}

function isSimpleRequest(text: string): boolean {
  return hasAny(text, ["simple", "basic", "starter", "beginner", "easy", "2 step", "two step", "few products", "not a full routine", "simpel", "simpele", "basis", "starter", "beginner", "makkelijk", "2 stappen", "twee stappen", "paar producten", "geen hele routine"]);
}

function isFullRoutineRequest(text: string): boolean {
  return hasAny(text, ["complete routine", "full routine", "whole routine", "morning and evening routine", "complete skincare", "volledige routine", "hele routine", "complete routine", "ochtend en avond routine", "uitgebreide routine"]);
}

function wantsRecommendation(text: string): boolean {
  return hasAny(text, ["recommend", "what do i need", "what should i use", "which routine", "what routine", "what product", "help me choose", "best for", "fits me", "advise", "raad", "aanraden", "wat heb ik nodig", "wat moet ik gebruiken", "welke routine", "welk product", "help me kiezen", "beste voor", "past bij mij", "advies"]);
}

function wantsBundleContents(text: string): boolean {
  return hasAny(text, ["what is in", "what products are in", "which products are in", "products inside", "contents", "included", "contains", "zit erin", "zit er in", "welke producten zitten", "wat zit er in", "wat zit erin", "inhoud", "producten in", "wat krijg ik", "welke producten krijg ik", "bundle products", "bundel producten"]);
}

function wantsUsage(text: string): boolean {
  return hasAny(text, ["how do i use", "how to use", "when do i use", "routine steps", "morning", "evening", "before or after", "how often", "usage", "hoe gebruik", "hoe moet", "wanneer", "ochtend", "avond", "voor of na", "hoe vaak", "stappen", "gebruiksaanwijzing"]);
}

function wantsLink(text: string): boolean {
  return hasAny(text, ["link", "where can i buy", "where can i find", "show me", "open", "view", "waar vind", "stuur link", "geef link", "bekijk", "open", "waar koop"]);
}

function wantsCompare(text: string): boolean {
  return hasAny(text, ["compare", "difference", "vs", "versus", "which is better", "what is better", "verschil", "vergelijk", "wat is beter", "welke is beter", "tegenover"]);
}

function wantsCombination(text: string): boolean {
  return hasAny(text, ["combine", "together", "pair with", "works with", "can i use with", "layer", "combineren", "samen", "past bij", "kan ik gebruiken met", "waarmee", "combinatie"]);
}

function asksAboutSpfInBundle(text: string): boolean {
  return hasAny(text, ["spf in bundle", "sunscreen in bundle", "is spf included", "does it include spf", "zit spf erin", "zit zonnebrand erin", "is sunscreen onderdeel", "is spf onderdeel", "zit zonbescherming erbij"]);
}

function detectGreeting(text: string): boolean {
  const t = loose(text);
  return ["hi", "hello", "hey", "heyy", "hallo", "hoi", "yo", "goedemorgen", "goedenavond"].includes(t);
}

function productType(product: Product): string {
  const t = loose(`${product.title} ${product.routine_step_en || ""} ${product.routine_step_nl || ""}`);
  if (hasAny(t, ["spf", "sun protection"])) return "spf";
  if (hasAny(t, ["cleansing", "cleanser", "mousse", "micellar"])) return "cleanser";
  if (hasAny(t, ["toner"])) return "toner";
  if (hasAny(t, ["peeling", "exfoliator", "exfoliant", "aha"])) return "exfoliant";
  if (hasAny(t, ["spot care", "spot treatment"])) return "spot";
  if (hasAny(t, ["serum", "booster"])) return "serum";
  if (hasAny(t, ["gel"])) return "gel";
  if (hasAny(t, ["cream", "creme", "crème"])) return "cream";
  if (hasAny(t, ["oil", "olie"])) return "oil";
  return "product";
}

function orderIndex(product: Product): number {
  switch (productType(product)) {
    case "cleanser": return 1;
    case "toner": return 2;
    case "exfoliant": return 3;
    case "spot": return 4;
    case "serum": return 5;
    case "gel": return 6;
    case "cream": return 7;
    case "oil": return 8;
    case "spf": return 9;
    default: return 6;
  }
}

function sortRoutineProducts(products: Product[]): Product[] {
  return [...products].sort((a, b) => orderIndex(a) - orderIndex(b));
}

function buildActionsForProduct(product: Product): ChatAction[] {
  return [{ type: "OPEN_URL", label: product.title, url: product.url }];
}

function buildActionsForProducts(products: Product[]): ChatAction[] {
  return unique(products.flatMap(buildActionsForProduct), (action) => action.url).slice(0, 4);
}

function buildActionsForBundle(bundle: Bundle, lang: Lang): ChatAction[] {
  return [{ type: "OPEN_URL", label: tr(lang, "Bekijk routine", "View routine"), url: bundle.url }];
}

function productCopy(product: Product, lang: Lang): string {
  const direct = lang === "nl" ? product.short_copy_nl : product.short_copy_en;
  if (direct?.trim()) return direct.trim();

  const fallbackNl: Record<string, string> = {
    "Micellar Cleansing Water": "Een zachte reiniger om vuil en make-up te verwijderen.",
    "Purifying Mousse": "Een schuimende reiniger die vooral logisch is bij vettere of onzuivere huid.",
    "Niacinamide Gel Moisturiser": "Een lichte gel moisturiser voor balans en comfort.",
    "Oil-Free Hydrating Gel": "Een lichte olievrije gel voor vettere of combinatiehuid.",
    "Moisturising Day Cream": "Een dagcrème voor dagelijkse hydratatie en comfort.",
    "Anti-Age Day Cream": "Een dagcrème voor een verzorgde huid met anti-age focus.",
    "Acne Spot Care": "Een gerichte treatment voor puistjes en onzuivere zones.",
    "Vitamin C Serum": "Een serum voor een frissere, minder doffe uitstraling.",
    "Hydrating Serum": "Een serum voor extra hydratatie en comfort.",
    "Hydrating Toner": "Een hydraterende tussenstap na het reinigen.",
    "Ceramide Barrier Night Cream": "Een nachtcrème om de huid comfortabel af te sluiten.",
    "Sun Protection SPF50 Stick, no tint": "Een SPF50 stick als losse laatste ochtendstap.",
  };

  const fallbackEn: Record<string, string> = {
    "Micellar Cleansing Water": "A gentle cleanser to remove makeup and daily buildup.",
    "Purifying Mousse": "A foaming cleanser that makes most sense for oilier or blemish-prone skin.",
    "Niacinamide Gel Moisturiser": "A lightweight gel moisturiser for balance and comfort.",
    "Oil-Free Hydrating Gel": "A lightweight oil-free gel for oily or combination skin.",
    "Moisturising Day Cream": "A day cream for daily hydration and comfort.",
    "Anti-Age Day Cream": "A day cream for daily care with an anti-age focus.",
    "Acne Spot Care": "A targeted treatment for blemishes and breakout-prone areas.",
    "Vitamin C Serum": "A serum for a fresher, less dull-looking complexion.",
    "Hydrating Serum": "A serum for extra hydration and comfort.",
    "Hydrating Toner": "A hydrating prep step after cleansing.",
    "Ceramide Barrier Night Cream": "A night cream to finish the routine comfortably.",
    "Sun Protection SPF50 Stick, no tint": "An SPF50 stick as a separate final morning step.",
  };

  return (lang === "nl" ? fallbackNl[product.title] : fallbackEn[product.title]) || tr(lang, "Een SOVAH product binnen je skincare routine.", "A SOVAH product within your skincare routine.");
}

// ───────────────── bundle recommendation ─────────────────

function bundleGoal(bundle: Bundle): SkinGoal {
  const text = `${bundle.name} ${bundle.target || ""} ${(bundle.quiz_route || []).join(" ")}`;
  const scores = getGoalScores(text);
  return scores[0]?.goal || "unknown";
}

function findBestBundleForText(text: string): Bundle | undefined {
  const simple = isSimpleRequest(text);
  const full = isFullRoutineRequest(text);
  const goal = primaryGoal(text);

  const candidates = bundleCatalog.bundles.map((bundle) => {
    let score = scoreSignals(text, bundleAliases(bundle));
    const bGoal = bundleGoal(bundle);
    const bType = loose(bundle.type || bundle.name);

    if (goal !== "unknown" && bGoal === goal) score += 18;
    if (simple && bType.includes("simple")) score += 12;
    if (full && !bType.includes("simple")) score += 12;
    if (!simple && !full && !bType.includes("simple")) score += 2;

    // Keep acne, dull and aging direct. They are clearer than vague normal/combo matches.
    if (goal === "acne" && loose(bundle.name).includes("acne")) score += 8;
    if (goal === "dull" && loose(bundle.name).includes("dull")) score += 8;
    if (goal === "aging" && loose(bundle.name).includes("aging")) score += 8;

    return { bundle, score };
  }).sort((a, b) => b.score - a.score);

  return candidates[0]?.score >= 8 ? candidates[0].bundle : undefined;
}

function recommendProductsForText(text: string): Product[] {
  const mentioned = findMentionedProducts(text);
  if (mentioned.length && !wantsRecommendation(text)) return mentioned.slice(0, 3);

  const goal = primaryGoal(text);
  const picks: string[] = [];
  const add = (title: string) => {
    if (!picks.includes(title)) picks.push(title);
  };

  switch (goal) {
    case "acne":
      add("Purifying Mousse");
      add("Niacinamide Gel Moisturiser");
      if (!isSimpleRequest(text)) add("Acne Spot Care");
      break;
    case "oily":
      add("Purifying Mousse");
      add("Oil-Free Hydrating Gel");
      break;
    case "combination":
      add("Purifying Mousse");
      add("Oil-Free Hydrating Gel");
      break;
    case "sensitive":
      add("Micellar Cleansing Water");
      add("Niacinamide Gel Moisturiser");
      if (!isSimpleRequest(text)) add("Calming Facial Oil");
      break;
    case "aging":
      add("Micellar Cleansing Water");
      add("Anti-Age Day Cream");
      if (!isSimpleRequest(text)) add("Peptide Anti-Aging Serum");
      break;
    case "dull":
      add("Micellar Cleansing Water");
      add("Moisturising Day Cream");
      if (!isSimpleRequest(text)) add("Vitamin C Serum");
      break;
    case "dry":
      add("Micellar Cleansing Water");
      add("Moisturising Day Cream");
      if (!isSimpleRequest(text)) add("Hydrating Serum");
      break;
    case "normal":
      add("Micellar Cleansing Water");
      add("Moisturising Day Cream");
      break;
    case "dark_spots":
      add("Dark Spot Face Cream with Kojic Acid");
      add("Vitamin C Serum");
      break;
    default:
      return [];
  }

  return picks.map(getProductByName).filter((p): p is Product => Boolean(p)).slice(0, isSimpleRequest(text) ? 2 : 3);
}

// ───────────────── reply builders ─────────────────

function response(reply: string, actions: ChatAction[], lang: Lang): BotResponse {
  return { reply: reply.trim(), actions: unique(actions, (a) => a.url).slice(0, 4), lang };
}

function buildGreetingReply(lang: Lang): BotResponse {
  return response(
    tr(
      lang,
      "Hi! Ik help je graag met SOVAH producten of routines.\n\nJe kunt bijvoorbeeld vragen: \"Welke producten zitten in de Dry Skin Routine?\", \"Welke routine past bij acne?\" of \"Hoe gebruik ik Vitamin C Serum?\"",
      "Hi! I’d be happy to help with SOVAH products or routines.\n\nYou can ask things like: \"What products are in the Dry Skin Routine?\", \"Which routine fits acne?\" or \"How do I use Vitamin C Serum?\""
    ),
    [],
    lang
  );
}

function buildBundleContentsReply(bundle: Bundle, lang: Lang): BotResponse {
  const products = getBundleProducts(bundle);
  const productLines = products.length
    ? products.map((p) => `- ${p.title}`).join("\n")
    : tr(lang, "Ik heb voor deze routine nog geen vaste bundelproducten gevonden.", "I could not find fixed bundle products for this routine yet.");

  const spfNote = tr(
    lang,
    "\n\nLet op: SPF zit niet in deze bundel. Die kun je los toevoegen als laatste ochtendstap.",
    "\n\nNote: SPF is not included in this bundle. You can add it separately as the final morning step."
  );

  return response(`**${bundle.name}**\n\n${tr(lang, "In deze Shopify-bundel zitten:", "This Shopify bundle includes:")}\n${productLines}${spfNote}`, buildActionsForBundle(bundle, lang), lang);
}

function buildBundleUsageReply(bundle: Bundle, lang: Lang): BotResponse {
  const how = lang === "nl" ? bundle.how_to_use_nl : bundle.how_to_use_en;
  const products = getBundleProducts(bundle);
  const parts = [`**${bundle.name}**`];

  if (how?.morning?.length) {
    parts.push(`${tr(lang, "**Ochtend**", "**Morning**")}\n${how.morning.map((step) => `- ${step}`).join("\n")}`);
  }
  if (how?.evening?.length) {
    parts.push(`${tr(lang, "**Avond**", "**Evening**")}\n${how.evening.map((step) => `- ${step}`).join("\n")}`);
  }
  if (!how?.morning?.length && !how?.evening?.length && products.length) {
    const sorted = sortRoutineProducts(products);
    parts.push(`${tr(lang, "**Volgorde**", "**Order**")}\n${sorted.map((p) => `- ${p.title}`).join("\n")}`);
  }

  const caution = lang === "nl" ? bundle.caution_nl : bundle.caution_en;
  if (caution) parts.push(`${tr(lang, "**Let op**", "**Caution**")}\n${caution}`);

  return response(parts.join("\n\n"), buildActionsForBundle(bundle, lang), lang);
}

function buildBundleRecommendReply(bundle: Bundle, lang: Lang): BotResponse {
  const products = getBundleProducts(bundle).map((p) => p.title).join(", ");
  const simple = loose(bundle.type || bundle.name).includes("simple");

  const intro = simple
    ? tr(lang, `Ik zou **${bundle.name}** nemen als je het simpel wilt houden.`, `I’d choose **${bundle.name}** if you want to keep it simple.`)
    : tr(lang, `Ik zou **${bundle.name}** nemen als je een complete routine wilt.`, `I’d choose **${bundle.name}** if you want a complete routine.`);

  const productLine = products
    ? tr(lang, `Deze bundel bevat: ${products}.`, `This bundle includes: ${products}.`)
    : "";

  const spfLine = tr(lang, "SPF zit niet in de bundel en blijft een losse add-on.", "SPF is not included in the bundle and stays a separate add-on.");

  return response([intro, productLine, spfLine].filter(Boolean).join("\n\n"), buildActionsForBundle(bundle, lang), lang);
}

function buildProductInfoReply(product: Product, lang: Lang): BotResponse {
  return response(`**${product.title}**\n\n${productCopy(product, lang)}`, buildActionsForProduct(product), lang);
}

function buildProductUsageReply(product: Product, lang: Lang): BotResponse {
  const usage = lang === "nl" ? product.usage_nl : product.usage_en;
  const when = lang === "nl" ? product.when_to_use_nl : product.when_to_use_en;
  const step = lang === "nl" ? product.routine_step_nl : product.routine_step_en;

  const parts = [`**${product.title}**`];
  if (usage) parts.push(usage);
  if (when) parts.push(`${tr(lang, "**Wanneer**", "**When**")}\n${when}`);
  if (step) parts.push(`${tr(lang, "**Stap**", "**Step")}\n${step}`);

  return response(parts.join("\n\n"), buildActionsForProduct(product), lang);
}

function buildProductPairingReply(product: Product, lang: Lang): BotResponse {
  const pairs = (product.pairs_well_with || [])
    .map(getProductByName)
    .filter((p): p is Product => Boolean(p));
  const note = lang === "nl" ? product.pairing_note_nl : product.pairing_note_en;

  const lines = pairs.length
    ? pairs.map((p) => `- ${p.title}`).join("\n")
    : tr(lang, "Ik heb hiervoor nog geen vaste pairing in de catalogus.", "I do not have a fixed catalog pairing for this yet.");

  return response(`**${product.title}**\n\n${tr(lang, "Past goed bij:", "Pairs well with:")}\n${lines}${note ? `\n\n${note}` : ""}`, buildActionsForProducts([product, ...pairs]), lang);
}

function buildMultiProductCombinationReply(products: Product[], lang: Lang): BotResponse {
  const sorted = sortRoutineProducts(products).slice(0, 4);
  const names = sorted.map((p) => p.title);
  const activeConflict = names.includes("AHA Peeling Concentrate") && (names.includes("Vitamin C Serum") || names.includes("Natural Retinol Alternative Oil Serum") || names.includes("Acne Spot Care"));

  const order = sorted.map((p) => `- ${p.title}`).join("\n");
  const warning = activeConflict
    ? tr(lang, "\n\nLet op: deze combinatie kan te actief zijn. Gebruik actieve producten liever rustig en wissel ze af als je huid snel reageert.", "\n\nCaution: this combination may be too active. Use active products carefully and alternate them if your skin reacts easily.")
    : "";

  return response(`${tr(lang, "Deze combinatie kan, maar houd de volgorde logisch:", "This combination can work, but keep the order logical:")}\n${order}${warning}`, buildActionsForProducts(sorted), lang);
}

function buildProductRecommendationReply(products: Product[], lang: Lang): BotResponse {
  if (!products.length) {
    return response(tr(lang, "Vertel kort je huidtype of huidprobleem, dan kies ik liever gericht 1 of 2 producten.", "Tell me your skin type or concern, and I’ll choose 1 or 2 products more accurately."), [], lang);
  }

  const lines = products.map((p) => `**${p.title}**\n${productCopy(p, lang)}`);
  return response(`${tr(lang, "Ik zou dan starten met:", "I would start with:")}\n\n${lines.join("\n\n")}`, buildActionsForProducts(products), lang);
}

function buildCompareReply(bundles: Bundle[], products: Product[], lang: Lang): BotResponse {
  if (bundles.length >= 2) {
    const [a, b] = bundles;
    const aProducts = getBundleProducts(a).map((p) => p.title).join(", ");
    const bProducts = getBundleProducts(b).map((p) => p.title).join(", ");
    const reply = `**${a.name}**\n${aProducts}\n\n**${b.name}**\n${bProducts}\n\n${tr(lang, "Kort gezegd: kies de simple routine als je laagdrempelig wilt starten. Kies de volledige routine als je meer stappen en gerichtere ondersteuning wilt.", "In short: choose the simple routine if you want an easy start. Choose the full routine if you want more steps and more targeted support.")}`;
    return response(reply, [...buildActionsForBundle(a, lang), ...buildActionsForBundle(b, lang)], lang);
  }

  if (products.length >= 2) {
    const [a, b] = products;
    const reply = `**${a.title}**\n${productCopy(a, lang)}\n\n**${b.title}**\n${productCopy(b, lang)}\n\n${tr(lang, "Ze kunnen allebei nuttig zijn, maar ze hebben niet dezelfde functie. Kies op basis van je huiddoel.", "Both can be useful, but they do not have the same function. Choose based on your skin goal.")}`;
    return response(reply, buildActionsForProducts([a, b]), lang);
  }

  return response(tr(lang, "Noem even welke twee routines of producten je wilt vergelijken.", "Tell me which two routines or products you want to compare."), [], lang);
}

function buildSpfBundleReply(lang: Lang): BotResponse {
  const spf = getProductByName("Sun Protection SPF50 Stick, no tint");
  const actions = spf ? buildActionsForProduct(spf) : [];
  return response(
    tr(
      lang,
      "Nee, SPF zit niet in de routinebundels. We houden SPF bewust als los product/add-on. Gebruik SPF wel als laatste stap in de ochtend, vooral bij glow, acne, exfoliatie, pigment of anti-age producten.",
      "No, SPF is not included in the routine bundles. SPF is kept as a separate add-on. Use SPF as the final morning step, especially with glow, acne, exfoliation, pigmentation or anti-age products."
    ),
    actions,
    lang
  );
}

function buildClarifyReply(lang: Lang): BotResponse {
  return response(
    tr(
      lang,
      "Ik wil je niet verkeerd sturen. Bedoel je dat je een routine wilt kiezen, wilt weten wat er in een bundel zit, of wil je uitleg over één product?",
      "I don’t want to point you the wrong way. Do you want to choose a routine, know what is inside a bundle, or get help with one product?"
    ),
    [{ type: "OPEN_URL", label: tr(lang, "Start de quiz", "Start quiz"), url: QUIZ_URL }],
    lang
  );
}

// ───────────────── OpenAI fallback ─────────────────

function buildSystemPrompt(lang: Lang): string {
  const bundleSummary = bundleCatalog.bundles.map((bundle) => {
    const products = getBundleProducts(bundle).map((p) => p.title).join(", ");
    return `- ${bundle.name}: ${products || "no fixed products listed"}`;
  }).join("\n");

  const productSummary = productCatalog.products.map((product) => `- ${product.title}: ${productCopy(product, lang)}`).join("\n");

  return `
You are the SOVAH skincare and store assistant for sovahcare.com.
Reply in ${lang === "nl" ? "Dutch" : "English"} only.

NON-NEGOTIABLE RULES:
- The catalogs below are the only source of truth.
- Never invent ingredients, medical claims, diagnoses, stock, discounts, or products.
- First detect the customer's intent: bundle contents, usage, recommendation, comparison, product info, or link request.
- If the customer asks what is inside a routine/bundle, list the exact bundle products. Do not recommend a different routine.
- SPF is not included in any routine bundle. It can only be mentioned as a separate add-on/final morning step.
- For simple routines, keep advice short and beginner-friendly.
- For active products such as AHA, retinol alternative, kojic acid, acne spot care and vitamin C, advise gradual use and patch testing when relevant.
- If uncertain, ask one short clarifying question.
- Keep answers friendly, concise and practical. No emojis. No JSON.

BUNDLE CATALOG:
${bundleSummary}

PRODUCT CATALOG:
${productSummary}
`.trim();
}

async function openAiFallback(message: string, history: string[], lang: Lang): Promise<BotResponse> {
  if (!openai) return buildClarifyReply(lang);

  try {
    const result = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: buildSystemPrompt(lang) },
        { role: "user", content: `History:\n${history.slice(-12).join("\n") || "(none)"}\n\nCustomer message:\n${message}` },
      ],
      text: { verbosity: "low" },
      reasoning: { effort: "minimal" },
      max_output_tokens: 260,
    });

    const reply = (result.output_text || "").trim();
    if (!reply) return buildClarifyReply(lang);

    const mentionedProducts = findMentionedProducts(reply);
    const mentionedBundles = findMentionedBundles(reply);
    const actions = mentionedBundles.length
      ? buildActionsForBundle(mentionedBundles[0], lang)
      : buildActionsForProducts(mentionedProducts);

    return response(reply, actions, lang);
  } catch (error) {
    console.error("OpenAI fallback error:", error);
    return buildClarifyReply(lang);
  }
}

function extractUserMessages(history: string[]): string[] {
  return history
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => item.toLowerCase().startsWith("user:"))
    .map((item) => item.replace(/^user:\s*/i, "").trim());
}

function recentContext(history: string[], message: string): string {
  return [...history.slice(-16), `User: ${message}`].join("\n");
}

function recentProductsFromHistory(history: string[]): Product[] {
  const products: Product[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    products.push(...findMentionedProducts(history[i]));
    if (products.length >= 4) break;
  }
  return unique(products, (p) => p.title).slice(0, 4);
}

function recentBundlesFromHistory(history: string[]): Bundle[] {
  const bundles: Bundle[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    bundles.push(...findMentionedBundles(history[i]));
    if (bundles.length >= 4) break;
  }
  return unique(bundles, (b) => b.name).slice(0, 4);
}

// ───────────────── main route ─────────────────

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const corsHeaders = buildCorsHeaders(origin);

  try {
    const body = await req.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const forcedLang = typeof body?.lang === "string" ? body.lang : undefined;
    const history: string[] = Array.isArray(body?.history)
      ? body.history.filter((item: unknown): item is string => typeof item === "string")
      : [];

    if (!message) {
      return new Response(JSON.stringify({ reply: "Missing message.", actions: [], lang: "en" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userHistory = extractUserMessages(history);
    const context = recentContext(history, message);
    const lang = detectLanguage(message, userHistory.join("\n"), forcedLang);
    const bundleHits = findMentionedBundles(message);
    const productHits = findMentionedProducts(message);
    const historyBundles = recentBundlesFromHistory(history);
    const historyProducts = recentProductsFromHistory(history);
    const combinedUserText = `${userHistory.join("\n")}\n${message}`;

    let result: BotResponse | null = null;

    // 1. Greeting
    if (detectGreeting(message)) {
      result = buildGreetingReply(lang);
    }

    // 2. SPF included in bundles?
    if (!result && asksAboutSpfInBundle(message)) {
      result = buildSpfBundleReply(lang);
    }

    // 3. Exact bundle contents: do not turn this into a recommendation.
    if (!result && wantsBundleContents(message)) {
      const bundle = bundleHits[0] || historyBundles[0] || findBestBundleForText(message);
      if (bundle) result = buildBundleContentsReply(bundle, lang);
    }

    // 4. Bundle usage / steps.
    if (!result && wantsUsage(message) && (bundleHits.length || historyBundles.length)) {
      result = buildBundleUsageReply(bundleHits[0] || historyBundles[0], lang);
    }

    // 5. Product usage.
    if (!result && wantsUsage(message) && (productHits.length || historyProducts.length)) {
      result = buildProductUsageReply(productHits[0] || historyProducts[0], lang);
    }

    // 6. Compare.
    if (!result && wantsCompare(message)) {
      result = buildCompareReply(bundleHits, productHits, lang);
    }

    // 7. Product combination / pairings.
    if (!result && wantsCombination(message)) {
      const products = productHits.length ? productHits : historyProducts;
      if (products.length >= 2) result = buildMultiProductCombinationReply(products, lang);
      else if (products.length === 1) result = buildProductPairingReply(products[0], lang);
    }

    // 8. Link request.
    if (!result && wantsLink(message)) {
      if (bundleHits[0]) result = response(tr(lang, `Hier is de link naar **${bundleHits[0].name}**.`, `Here is the link to **${bundleHits[0].name}**.`), buildActionsForBundle(bundleHits[0], lang), lang);
      else if (productHits[0]) result = response(tr(lang, `Hier is de link naar **${productHits[0].title}**.`, `Here is the link to **${productHits[0].title}**.`), buildActionsForProduct(productHits[0]), lang);
    }

    // 9. If the customer names one product and asks normally, explain that product.
    if (!result && productHits.length === 1 && !wantsRecommendation(message)) {
      result = buildProductInfoReply(productHits[0], lang);
    }

    // 10. If the customer names a bundle but not a specific action, summarize contents.
    if (!result && bundleHits.length === 1 && !wantsRecommendation(message)) {
      result = buildBundleContentsReply(bundleHits[0], lang);
    }

    // 11. Routine recommendation.
    if (!result && (wantsRecommendation(message) || isSimpleRequest(message) || isFullRoutineRequest(message) || primaryGoal(combinedUserText) !== "unknown")) {
      const bundle = findBestBundleForText(combinedUserText);
      if (bundle) {
        result = buildBundleRecommendReply(bundle, lang);
      } else {
        const products = recommendProductsForText(combinedUserText);
        if (products.length) result = buildProductRecommendationReply(products, lang);
      }
    }

    // 12. Final AI fallback for uncommon customer questions.
    if (!result) {
      result = await openAiFallback(message, history, lang);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("SOVAH chat route error:", error);
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
