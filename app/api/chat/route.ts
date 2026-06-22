import fs from "fs";
import path from "path";
import OpenAI from "openai";

type Lang = "nl" | "en" | "de";
type Intent =
  | "greeting"
  | "product_info"
  | "ingredients"
  | "certifications"
  | "usage"
  | "compatibility"
  | "comparison"
  | "product_recommendation"
  | "routine_recommendation"
  | "bundle_contents"
  | "general_skincare"
  | "support"
  | "other";

type LocalizedText = Record<Lang, string>;

type Product = {
  id: string;
  title: string;
  price?: string | null;
  currency?: string;
  url: string;
  image?: string | null;
  variant_id?: number | null;
  type?: string | null;
  routine_step?: string | null;
  volume_ml?: number | null;
  volume_fl_oz?: number | null;
  description: LocalizedText;
  usage: LocalizedText;
  when_to_use: LocalizedText;
  skin_types: string[];
  concerns: string[];
  key_ingredients: string[];
  active_percentages: Record<string, string>;
  inci: string[];
  inci_raw: string;
  aroma?: string | null;
  claims: {
    supplier_original_en?: string[];
    approved: Record<Lang, string[]>;
    prohibited_wording?: string[];
  };
  certifications: {
    vegan: boolean | null;
    gluten_free: boolean | null;
    nut_free: boolean | null;
    allergen_label_free: boolean | null;
    fragrance_free: boolean | null;
    supplier_declared_fragrance_free?: boolean | null;
    dermatologically_tested: boolean | null;
    cosmos: string | null;
    natural_origin_percentage: number | null;
    organic_percentage: number | null;
    cruelty_free?: boolean | null;
  };
  pao?: string | null;
  regional_availability?: string | null;
  safety: {
    patch_test?: boolean;
    sun_sensitivity?: boolean;
    avoid_eye_area?: boolean;
    beginner_frequency?: string | null;
    avoid_same_routine_with?: string[];
    warning_nl?: string;
    warning_en?: string;
    warning_de?: string;
  };
  compatibility: {
    pairs_well_with?: string[];
    avoid_same_routine_with?: string[];
  };
  ai_detection?: {
    aliases?: string[];
    misspellings?: string[];
    customer_language_examples?: string[];
    do_not_recommend_when?: string[];
    [key: string]: unknown;
  };
  verification: {
    status: string;
    conflicts: string[];
    requires_manual_review: boolean;
  };
  source?: {
    supplier_product_name?: string;
    [key: string]: unknown;
  };
};

type Bundle = {
  id: string;
  name: string;
  old_names?: string[];
  type?: string | null;
  target?: string | null;
  price?: string | null;
  currency?: string;
  url: string;
  image?: string | null;
  variant_id?: number | null;
  routing_priority?: number;
  product_ids: string[];
  bundle_products?: Array<{
    id: string;
    title: string;
    url: string;
    image?: string | null;
  }>;
  derived_certification_summary?: Record<string, boolean>;
  ai_detection?: {
    quiz_route?: string[];
    misspellings?: string[];
    recognize_old_names_but_do_not_display_them?: string[];
    [key: string]: unknown;
  };
  safety?: {
    spf_included?: boolean;
    manual_review_note?: string | null;
    [key: string]: unknown;
  };
};

type ProductCatalog = {
  catalog_version: string;
  policy: Record<string, unknown>;
  ingredient_glossary?: Record<string, LocalizedText>;
  products: Product[];
};

type BundleCatalog = {
  catalog_version: string;
  global_rules?: Record<string, unknown>;
  bundles: Bundle[];
};

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

type ResolverResult = {
  intent: Intent;
  product_ids: string[];
  bundle_ids: string[];
  confidence: number;
  needs_clarification: boolean;
  clarification_question: string;
};

type AnswerResult = {
  reply: string;
  product_ids: string[];
  bundle_ids: string[];
};

type ConversationContext = {
  product_ids: string[];
  bundle_ids: string[];
  intent: Intent | null;
};

type RequestBody = {
  message?: unknown;
  history?: unknown;
  context?: unknown;
  lang?: unknown;
  sessionId?: unknown;
};

type RateState = { count: number; resetAt: number };

const QUIZ_URL = "https://sovahcare.com/pages/find-your-routine";
const SUPPORT_URL = "https://sovahcare.com/pages/contact";
const MAX_MESSAGE_LENGTH = 1600;
const MAX_HISTORY_ITEMS = 12;
const MAX_HISTORY_ITEM_LENGTH = 1200;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REQUESTS = 30;
const DEBUG = process.env.SOVAH_DEBUG === "1";
const RESOLVER_MODEL = process.env.SOVAH_RESOLVER_MODEL || "gpt-5.4-nano";
const ANSWER_MODEL = process.env.SOVAH_ANSWER_MODEL || "gpt-5.4-mini";

const productsPath = path.join(process.cwd(), "data", "product_catalog.json");
const bundlesPath = path.join(process.cwd(), "data", "bundle_catalog.json");
const productCatalog = JSON.parse(
  fs.readFileSync(productsPath, "utf8")
) as ProductCatalog;
const bundleCatalog = JSON.parse(
  fs.readFileSync(bundlesPath, "utf8")
) as BundleCatalog;

const productsById = new Map(productCatalog.products.map((p) => [p.id, p]));
const bundlesById = new Map(bundleCatalog.bundles.map((b) => [b.id, b]));
const productIds = productCatalog.products.map((p) => p.id);
const bundleIds = bundleCatalog.bundles.map((b) => b.id);
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;
const rateStates = new Map<string, RateState>();

validateCatalogs();

function validateCatalogs(): void {
  if (!productCatalog.products.length) {
    throw new Error("product_catalog.json contains no products");
  }
  if (!bundleCatalog.bundles.length) {
    throw new Error("bundle_catalog.json contains no bundles");
  }

  const seenProducts = new Set<string>();
  for (const product of productCatalog.products) {
    if (seenProducts.has(product.id)) {
      throw new Error(`Duplicate product ID: ${product.id}`);
    }
    seenProducts.add(product.id);
  }

  const seenBundles = new Set<string>();
  for (const bundle of bundleCatalog.bundles) {
    if (seenBundles.has(bundle.id)) {
      throw new Error(`Duplicate bundle ID: ${bundle.id}`);
    }
    seenBundles.add(bundle.id);

    for (const productId of bundle.product_ids) {
      if (!productsById.has(productId)) {
        throw new Error(
          `Bundle ${bundle.name} references unknown product ID ${productId}`
        );
      }
      if (productId === "sun-protection-spf50-stick-no-tint") {
        throw new Error(`SPF is not allowed in bundle ${bundle.name}`);
      }
    }
  }
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  const configured = (process.env.SOVAH_ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const exact = new Set([
    "https://sovahcare.com",
    "https://www.sovahcare.com",
    ...configured,
  ]);
  if (exact.has(origin)) return true;
  return (
    /^https:\/\/[a-z0-9-]+\.myshopify\.com$/i.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.shopifypreview\.com$/i.test(origin)
  );
}

function buildCorsHeaders(origin: string | null, extra?: Record<string, string>) {
  const safeOrigin = isAllowedOrigin(origin)
    ? origin!
    : "https://sovahcare.com";
  return {
    "Access-Control-Allow-Origin": safeOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Expose-Headers":
      "X-SOVAH-AI-Used, X-SOVAH-Catalog-Version",
    "Cache-Control": "no-store",
    Vary: "Origin",
    "X-SOVAH-Catalog-Version": productCatalog.catalog_version,
    ...extra,
  };
}

function jsonResponse(
  payload: unknown,
  status: number,
  origin: string | null,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...buildCorsHeaders(origin, extraHeaders),
    },
  });
}

export async function OPTIONS(req: Request) {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(req.headers.get("origin")),
  });
}

export async function GET(req: Request) {
  return jsonResponse(
    {
      ok: true,
      service: "SOVAH AI chat",
      catalogVersion: productCatalog.catalog_version,
      bundleCatalogVersion: bundleCatalog.catalog_version,
      products: productCatalog.products.length,
      bundles: bundleCatalog.bundles.length,
      aiConfigured: Boolean(openai),
    },
    200,
    req.headers.get("origin"),
    { "X-SOVAH-AI-Used": "0" }
  );
}

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function allowRequest(ip: string): boolean {
  const now = Date.now();
  const existing = rateStates.get(ip);
  if (!existing || existing.resetAt <= now) {
    rateStates.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (existing.count >= RATE_LIMIT_REQUESTS) return false;
  existing.count += 1;
  return true;
}

function normalize(text: string): string {
  return (text || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s+%-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function safeString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parseHistory(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, MAX_HISTORY_ITEM_LENGTH))
    .filter(Boolean)
    .slice(-MAX_HISTORY_ITEMS);
}

function parseConversationContext(value: unknown): ConversationContext {
  const empty: ConversationContext = {
    product_ids: [],
    bundle_ids: [],
    intent: null,
  };

  if (!value || typeof value !== "object") return empty;

  const raw = value as Record<string, unknown>;
  const product_ids = Array.isArray(raw.product_ids)
    ? unique(
        raw.product_ids
          .filter((item): item is string => typeof item === "string")
          .filter((id) => productsById.has(id))
      ).slice(0, 3)
    : [];

  const bundle_ids = Array.isArray(raw.bundle_ids)
    ? unique(
        raw.bundle_ids
          .filter((item): item is string => typeof item === "string")
          .filter((id) => bundlesById.has(id))
      ).slice(0, 2)
    : [];

  const allowedIntents: Intent[] = [
    "greeting",
    "product_info",
    "ingredients",
    "certifications",
    "usage",
    "compatibility",
    "comparison",
    "product_recommendation",
    "routine_recommendation",
    "bundle_contents",
    "general_skincare",
    "support",
    "other",
  ];

  const intent =
    typeof raw.intent === "string" && allowedIntents.includes(raw.intent as Intent)
      ? (raw.intent as Intent)
      : null;

  return { product_ids, bundle_ids, intent };
}

function detectLanguage(message: string, forced: unknown): Lang {
  if (forced === "nl" || forced === "en" || forced === "de") return forced;
  const text = normalize(message);
  const de = [
    "ich",
    "meine haut",
    "welche",
    "was ist",
    "pickel",
    "trocken",
    "empfindlich",
    "verwenden",
  ];
  const en = [
    "my skin",
    "which",
    "what is",
    "how do i",
    "dry skin",
    "breakouts",
    "sensitive",
  ];
  const nl = [
    "mijn huid",
    "welke",
    "wat zit",
    "hoe gebruik",
    "droge huid",
    "puistjes",
    "gevoelig",
  ];
  const score = (signals: string[]) =>
    signals.reduce((sum, signal) => sum + (text.includes(signal) ? 1 : 0), 0);
  const deScore = score(de);
  const enScore = score(en);
  const nlScore = score(nl);
  if (deScore > enScore && deScore > nlScore) return "de";
  if (enScore > nlScore) return "en";
  return "nl";
}

function tr(lang: Lang, nl: string, en: string, de: string): string {
  return lang === "nl" ? nl : lang === "de" ? de : en;
}

function allProductAliases(product: Product): string[] {
  return unique(
    [
      product.title,
      product.id,
      product.source?.supplier_product_name || "",
      ...(product.ai_detection?.aliases || []),
      ...(product.ai_detection?.misspellings || []),
    ]
      .map((item) => normalize(String(item)))
      .filter(Boolean)
  );
}

function allBundleAliases(bundle: Bundle): string[] {
  return unique(
    [
      bundle.name,
      bundle.id,
      ...(bundle.old_names || []),
      ...(bundle.ai_detection?.quiz_route || []),
      ...(bundle.ai_detection?.misspellings || []),
      ...(bundle.ai_detection?.recognize_old_names_but_do_not_display_them || []),
    ]
      .map((item) => normalize(String(item)))
      .filter(Boolean)
  );
}

function scoreAliasMatch(message: string, alias: string, isTitle: boolean): number {
  if (!alias) return 0;
  if (message === alias) return 140 + Math.min(alias.length, 50);
  if (isTitle && message.includes(alias)) return 115 + Math.min(alias.length, 50);
  if (alias.length >= 9 && message.includes(alias)) {
    return 70 + Math.min(alias.length, 40);
  }
  return 0;
}

function deterministicProductMatches(message: string): Product[] {
  const text = normalize(message);
  const scored = productCatalog.products
    .map((product) => {
      let score = 0;
      const title = normalize(product.title);
      for (const alias of allProductAliases(product)) {
        score = Math.max(score, scoreAliasMatch(text, alias, alias === title));
      }
      return { product, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return [];
  const top = scored[0].score;
  const close = scored.filter((item) => item.score >= top - 4);
  if (close.length > 1 && top < 130) return [];
  return scored.filter((item) => item.score >= top - 20).slice(0, 3).map((x) => x.product);
}

function deterministicBundleMatches(message: string): Bundle[] {
  const text = normalize(message);
  const scored = bundleCatalog.bundles
    .map((bundle) => {
      let score = 0;
      const name = normalize(bundle.name);
      for (const alias of allBundleAliases(bundle)) {
        score = Math.max(score, scoreAliasMatch(text, alias, alias === name));
      }
      return { bundle, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return [];
  const top = scored[0].score;
  const close = scored.filter((item) => item.score >= top - 4);
  if (close.length > 1 && top < 130) return [];
  return scored.filter((item) => item.score >= top - 20).slice(0, 2).map((x) => x.bundle);
}


function stripHistoryPrefix(item: string): string {
  return item.replace(/^(user|assistant):\s*/i, "").trim();
}

function latestAssistantMessage(history: string[]): string {
  for (let i = history.length - 1; i >= 0; i--) {
    if (/^assistant:/i.test(history[i])) {
      return stripHistoryPrefix(history[i]);
    }
  }
  return "";
}

function recentProductsFromHistory(history: string[]): Product[] {
  for (let i = history.length - 1; i >= 0; i--) {
    const matches = deterministicProductMatches(stripHistoryPrefix(history[i]));
    if (matches.length) return matches;
  }
  return [];
}

function recentBundlesFromHistory(history: string[]): Bundle[] {
  for (let i = history.length - 1; i >= 0; i--) {
    const matches = deterministicBundleMatches(stripHistoryPrefix(history[i]));
    if (matches.length) return matches;
  }
  return [];
}

function isContextDependentFollowUp(message: string): boolean {
  const text = normalize(message);
  if (!text || text.length > 120) return false;

  return (
    /^(ja|ja graag|graag|doe maar|zeker|prima|ok|oke|oké|vertel|leg uit|meer uitleg|ga door|yes|yes please|please do|go ahead|sure|tell me more|explain|continue|ja bitte|mach das|gern|gerne|erklär|erklar|weiter)$/.test(
      text
    ) ||
    /\b(die|dat|deze|daarover|daarmee|erover|hetzelfde|that|this|those|it|them|dazu|darüber|das|dieses)\b/.test(
      text
    )
  );
}

function inferFollowUpIntent(
  message: string,
  history: string[],
  products: Product[],
  bundles: Bundle[],
  previousIntent: Intent | null
): Intent {
  const latestAssistant = normalize(latestAssistantMessage(history));
  const combined = `${normalize(message)} ${latestAssistant}`;

  if (
    /(ingredient|ingredients|inci|wat zit|wat bevat|belangrijkste ingredient|belangrijkste ingrediënten|contains|what is in|what's in|inhaltsstoff)/.test(
      combined
    )
  ) {
    return bundles.length ? "bundle_contents" : "ingredients";
  }

  if (
    /(hoe gebruik|wanneer gebruik|gebruikswijze|how do i use|when do i use|wie benutze|wann benutze)/.test(
      combined
    )
  ) {
    return "usage";
  }

  if (
    /(vegan|gluten|nut free|noten|allergen|parfum|fragrance|cosmos|certific|keurmerk)/.test(
      combined
    )
  ) {
    return "certifications";
  }

  if (/(combin|samen|together|pair|past bij|vertr[aä]gt sich)/.test(combined)) {
    return "compatibility";
  }

  if (/(verschil|compare|versus|\bvs\b|welke is beter|which is better)/.test(combined)) {
    return "comparison";
  }

  if (previousIntent) return previousIntent;
  if (bundles.length) return "bundle_contents";
  if (products.length) return "product_info";
  return "general_skincare";
}

function buildConversationContext(
  intent: Intent,
  products: Product[],
  bundles: Bundle[]
): ConversationContext {
  return {
    intent,
    product_ids: unique(products.map((product) => product.id)).slice(0, 3),
    bundle_ids: unique(bundles.map((bundle) => bundle.id)).slice(0, 2),
  };
}

function inferIntent(message: string, products: Product[], bundles: Bundle[]): Intent {
  const text = normalize(message);
  if (/^(hi|hello|hey|hoi|hallo|goedemorgen|goedenavond)$/.test(text)) {
    return "greeting";
  }
  if (
    /(ingredient|ingredients|inci|wat zit|wat bevat|bevat het|contains|what is in|what's in|was ist drin|inhaltsstoff)/.test(
      text
    )
  ) {
    return bundles.length ? "bundle_contents" : "ingredients";
  }
  if (
    /(vegan|gluten|nut free|noten|noot|allergen|parfum|fragrance|cosmos|organic|organisch|natural origin|natuurlijke oorsprong|dermatologisch|dermatologically|cruelty|dierproef|certific|keurmerk)/.test(
      text
    )
  ) {
    return "certifications";
  }
  if (
    /(hoe gebruik|wanneer gebruik|how do i use|when do i use|wie benutze|wann benutze|voor of na|before or after)/.test(
      text
    )
  ) {
    return "usage";
  }
  if (/(combin|samen|together|pair|past bij|vertr[aä]gt sich)/.test(text)) {
    return "compatibility";
  }
  if (/(verschil|compare|comparison|versus|\bvs\b|welke is beter|which is better)/.test(text)) {
    return "comparison";
  }
  if (
    /(welke routine|routine opbouwen|build my routine|which routine|routine empfehlen|complete routine|simpele routine)/.test(
      text
    )
  ) {
    return "routine_recommendation";
  }
  if (
    /(raad.*product|recommend.*product|wat heb ik nodig|welk product|which product|produkt empfehlen)/.test(
      text
    )
  ) {
    return "product_recommendation";
  }
  if (bundles.length) return "bundle_contents";
  if (products.length) return "product_info";
  return "general_skincare";
}

function productIndexForResolver() {
  return productCatalog.products.map((product) => ({
    id: product.id,
    title: product.title,
    type: product.type,
    skin_types: product.skin_types,
    concerns: product.concerns,
    aliases: allProductAliases(product).slice(0, 28),
  }));
}

function bundleIndexForResolver() {
  return bundleCatalog.bundles.map((bundle) => ({
    id: bundle.id,
    name: bundle.name,
    type: bundle.type,
    target: bundle.target,
    product_ids: bundle.product_ids,
    aliases: allBundleAliases(bundle).slice(0, 36),
  }));
}

function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function resolveWithAI(
  message: string,
  history: string[],
  lang: Lang
): Promise<ResolverResult | null> {
  if (!openai) return null;

  const schema = {
    type: "object",
    properties: {
      intent: {
        type: "string",
        enum: [
          "greeting",
          "product_info",
          "ingredients",
          "certifications",
          "usage",
          "compatibility",
          "comparison",
          "product_recommendation",
          "routine_recommendation",
          "bundle_contents",
          "general_skincare",
          "support",
          "other",
        ],
      },
      product_ids: {
        type: "array",
        maxItems: 3,
        items: { type: "string", enum: productIds },
      },
      bundle_ids: {
        type: "array",
        maxItems: 2,
        items: { type: "string", enum: bundleIds },
      },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      needs_clarification: { type: "boolean" },
      clarification_question: { type: "string" },
    },
    required: [
      "intent",
      "product_ids",
      "bundle_ids",
      "confidence",
      "needs_clarification",
      "clarification_question",
    ],
    additionalProperties: false,
  };

  const response = await openai.responses.create({
    model: RESOLVER_MODEL,
    store: false,
    reasoning: { effort: "low" },
    input: [
      {
        role: "system",
        content:
          "You resolve customer messages for the SOVAH skincare catalog. " +
          "Correct obvious spelling, phonetic and typing errors semantically, even when the exact typo is not listed. " +
          "For example, terms resembling niacinamide plus gel should resolve to the Niacinamide Gel Face Moisturiser. " +
          "Return only IDs that exist in the supplied index. Do not invent IDs. " +
          "Choose clarification only when two or more products remain genuinely plausible. " +
          "A question about what a named product contains is ingredients. A question about what a routine contains is bundle_contents. " +
          "For general skincare questions, IDs may be empty. Use the conversation context but prioritize the latest customer message. " +
          "Short replies such as 'doe maar', 'ja graag', 'go ahead', 'tell me more' or 'leg uit' continue the assistant's latest offer and should keep the previously discussed product or routine.",
      },
      {
        role: "user",
        content: JSON.stringify({
          response_language: lang,
          latest_message: message,
          recent_history: history,
          products: productIndexForResolver(),
          bundles: bundleIndexForResolver(),
        }),
      },
    ],
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "sovah_catalog_resolution",
        strict: true,
        schema,
      },
    },
    max_output_tokens: 900,
  });

  if (response.status === "incomplete") {
    console.warn("SOVAH resolver incomplete:", response.incomplete_details);
    return null;
  }
  return parseJson<ResolverResult>(response.output_text || "");
}

function publicProductContext(product: Product, lang: Lang, includeFullInci: boolean) {
  return {
    id: product.id,
    title: product.title,
    price: product.price,
    url: product.url,
    type: product.type,
    routine_step: product.routine_step,
    volume_ml: product.volume_ml,
    description: product.description[lang],
    usage: product.usage[lang],
    when_to_use: product.when_to_use[lang],
    skin_types: product.skin_types,
    concerns: product.concerns,
    key_ingredients: product.key_ingredients,
    active_percentages: product.active_percentages,
    inci: includeFullInci ? product.inci : undefined,
    aroma: product.aroma,
    approved_claims: product.claims.approved[lang],
    certifications: product.certifications,
    pao: product.pao,
    regional_availability: product.regional_availability,
    safety: {
      patch_test: product.safety.patch_test,
      sun_sensitivity: product.safety.sun_sensitivity,
      avoid_eye_area: product.safety.avoid_eye_area,
      beginner_frequency: product.safety.beginner_frequency,
      warning:
        lang === "nl"
          ? product.safety.warning_nl
          : lang === "de"
            ? product.safety.warning_de
            : product.safety.warning_en,
    },
    verification: product.verification,
  };
}

function publicBundleContext(bundle: Bundle, lang: Lang) {
  const products = bundle.product_ids
    .map((id) => productsById.get(id))
    .filter((item): item is Product => Boolean(item));
  return {
    id: bundle.id,
    name: bundle.name,
    type: bundle.type,
    target: bundle.target,
    price: bundle.price,
    url: bundle.url,
    product_ids: bundle.product_ids,
    products: products.map((product) => ({
      id: product.id,
      title: product.title,
      type: product.type,
      routine_step: product.routine_step,
      description: product.description[lang],
      certifications: product.certifications,
      safety: product.safety,
      verification: product.verification,
    })),
    derived_certification_summary: bundle.derived_certification_summary,
    safety: bundle.safety,
  };
}

function glossaryForProducts(products: Product[], lang: Lang) {
  const glossary = productCatalog.ingredient_glossary || {};
  const haystack = normalize(
    products
      .flatMap((product) => [
        ...product.key_ingredients,
        ...Object.keys(product.active_percentages || {}),
        ...product.inci,
      ])
      .join(" ")
  );
  return Object.entries(glossary)
    .filter(([ingredient]) => {
      const normalized = normalize(ingredient);
      const firstWord = normalized.split(" ")[0];
      return haystack.includes(normalized) || (firstWord.length > 5 && haystack.includes(firstWord));
    })
    .map(([ingredient, explanation]) => ({
      ingredient,
      explanation: explanation[lang],
    }));
}

function relatedProducts(products: Product[]): Product[] {
  const ids = unique(
    products.flatMap((product) => product.compatibility.pairs_well_with || [])
  );
  return ids
    .map((id) => productsById.get(id))
    .filter((item): item is Product => Boolean(item))
    .filter((item) => !products.some((product) => product.id === item.id))
    .slice(0, 4);
}

function safeResolverResult(result: ResolverResult | null): ResolverResult | null {
  if (!result) return null;
  return {
    intent: result.intent,
    product_ids: unique(result.product_ids).filter((id) => productsById.has(id)).slice(0, 3),
    bundle_ids: unique(result.bundle_ids).filter((id) => bundlesById.has(id)).slice(0, 2),
    confidence: Math.max(0, Math.min(1, Number(result.confidence) || 0)),
    needs_clarification: Boolean(result.needs_clarification),
    clarification_question: safeString(result.clarification_question, 400),
  };
}

function buildAnswerSystemPrompt(lang: Lang): string {
  const languageName = lang === "nl" ? "Dutch" : lang === "de" ? "German" : "English";
  return `You are the SOVAH skincare assistant. Answer in ${languageName}.

Core rules:
- You may answer general skincare questions with cautious educational information.
- Every SOVAH-specific fact, ingredient, percentage, claim, certification, price, routine or usage instruction must come only from the supplied catalog context.
- Never mention a supplier, private label, product sheet, internal source, internal ID, wholesale price or recommended supplier price.
- Silently understand normal spelling and phonetic mistakes. If one intended product is clear, answer directly instead of presenting unrelated alternatives.
- Treat short acknowledgements such as "doe maar", "ja graag", "go ahead" and "tell me more" as a continuation of the latest assistant offer. Do not restart the conversation or ask the customer to choose a new topic when the recent context is clear.
- Use exact current public product and routine names.
- Never invent ingredients, percentages, claims, certifications or routine contents.
- Use approved cosmetic wording. Do not diagnose, treat or claim to cure acne, eczema, rosacea or other medical conditions.
- "Allergen label free" does not mean allergen-free. "Nut free" does not guarantee safety for every allergy. For a serious allergy, advise checking the physical label and seeking professional guidance.
- If a certification is null, unverified or contradicted by a verification conflict, say it is not confirmed. When INCI conflicts with a fragrance-free declaration, prioritize the INCI and explain that fragrance-free cannot be confirmed.
- For ingredient questions, use the exact INCI and active percentages. Explain only relevant ingredients, not every ingredient unless the customer asks for the full INCI.
- For combination questions, use the safety and compatibility data. Be conservative with exfoliants and targeted actives.
- SPF is a standalone product and is never included in a SOVAH routine or bundle.
- Recommend at most one routine and two optional products. Do not overwhelm the customer.
- For severe, painful, persistent or rapidly worsening skin problems, recommend a doctor or dermatologist.
- Keep the answer useful and concise: usually 2-6 sentences or a short list.
- Return product IDs or bundle IDs only when a matching button/card would genuinely help.`;
}

async function answerWithAI(args: {
  message: string;
  history: string[];
  lang: Lang;
  intent: Intent;
  selectedProducts: Product[];
  selectedBundles: Bundle[];
}): Promise<AnswerResult | null> {
  if (!openai) return null;

  const includeFullInci =
    args.intent === "ingredients" || args.intent === "certifications";
  const related = relatedProducts(args.selectedProducts);
  const allowedProductIds = unique([
    ...args.selectedProducts.map((p) => p.id),
    ...related.map((p) => p.id),
  ]);
  const allowedBundleIds = args.selectedBundles.map((b) => b.id);

  const schema = {
    type: "object",
    properties: {
      reply: { type: "string", minLength: 1 },
      product_ids: {
        type: "array",
        maxItems: 2,
        items: {
          type: "string",
          enum: allowedProductIds.length ? allowedProductIds : productIds,
        },
      },
      bundle_ids: {
        type: "array",
        maxItems: 1,
        items: {
          type: "string",
          enum: allowedBundleIds.length ? allowedBundleIds : bundleIds,
        },
      },
    },
    required: ["reply", "product_ids", "bundle_ids"],
    additionalProperties: false,
  };

  const context = {
    intent: args.intent,
    latest_message: args.message,
    recent_history: args.history,
    selected_products: args.selectedProducts.map((product) =>
      publicProductContext(product, args.lang, includeFullInci)
    ),
    related_products: related.map((product) =>
      publicProductContext(product, args.lang, false)
    ),
    selected_bundles: args.selectedBundles.map((bundle) =>
      publicBundleContext(bundle, args.lang)
    ),
    ingredient_glossary: glossaryForProducts(args.selectedProducts, args.lang),
    global_policy: productCatalog.policy,
  };

  const response = await openai.responses.create({
    model: ANSWER_MODEL,
    store: false,
    reasoning: { effort: "low" },
    input: [
      { role: "system", content: buildAnswerSystemPrompt(args.lang) },
      { role: "user", content: JSON.stringify(context) },
    ],
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "sovah_chat_answer",
        strict: true,
        schema,
      },
    },
    max_output_tokens: 1800,
  });

  if (response.status === "incomplete") {
    console.warn("SOVAH answer incomplete:", response.incomplete_details);
    return null;
  }
  const parsed = parseJson<AnswerResult>(response.output_text || "");
  if (!parsed?.reply) return null;
  return {
    reply: safeString(parsed.reply, 4000),
    product_ids: unique(parsed.product_ids || [])
      .filter((id) => allowedProductIds.includes(id))
      .slice(0, 2),
    bundle_ids: unique(parsed.bundle_ids || [])
      .filter((id) => allowedBundleIds.includes(id))
      .slice(0, 1),
  };
}

function productAction(product: Product, lang: Lang): ChatAction {
  return {
    type: "OPEN_URL",
    label: tr(
      lang,
      `Bekijk ${product.title}`,
      `View ${product.title}`,
      `${product.title} ansehen`
    ),
    url: product.url,
  };
}

function bundleAction(bundle: Bundle, lang: Lang): ChatAction {
  return {
    type: "ROUTINE_CARD",
    label: tr(lang, "Bekijk routine", "View routine", "Routine ansehen"),
    title: bundle.name,
    url: bundle.url,
    image: bundle.image || undefined,
    price: bundle.price || undefined,
  };
}

function buildActions(
  answer: AnswerResult,
  selectedProducts: Product[],
  selectedBundles: Bundle[],
  lang: Lang
): ChatAction[] {
  const allowedProducts = new Set([
    ...selectedProducts.map((p) => p.id),
    ...relatedProducts(selectedProducts).map((p) => p.id),
  ]);
  const allowedBundles = new Set(selectedBundles.map((b) => b.id));
  const actions: ChatAction[] = [];

  for (const id of answer.bundle_ids) {
    if (!allowedBundles.has(id)) continue;
    const bundle = bundlesById.get(id);
    if (bundle) actions.push(bundleAction(bundle, lang));
  }
  if (actions.length) return actions.slice(0, 1);

  for (const id of answer.product_ids) {
    if (!allowedProducts.has(id)) continue;
    const product = productsById.get(id);
    if (product) actions.push(productAction(product, lang));
  }
  return actions.slice(0, 2);
}

function certificationText(product: Product, lang: Lang): string {
  const cert = product.certifications;
  const items: string[] = [];
  const yes = (label: string, value: boolean | null) => {
    if (value === true) items.push(label);
  };
  yes("vegan", cert.vegan);
  yes("gluten free", cert.gluten_free);
  yes("nut free", cert.nut_free);
  yes("allergen label free", cert.allergen_label_free);
  yes("fragrance free", cert.fragrance_free);
  yes("dermatologically tested", cert.dermatologically_tested);
  if (cert.cosmos) items.push(cert.cosmos);
  const joined = items.length ? items.join(", ") : tr(lang, "geen bevestigde claims", "no confirmed claims", "keine bestätigten Angaben");
  return tr(
    lang,
    `Bevestigde productinformatie: ${joined}.`,
    `Confirmed product information: ${joined}.`,
    `Bestätigte Produktinformationen: ${joined}.`
  );
}

function directCertificationAnswer(
  product: Product,
  message: string,
  lang: Lang
): string | null {
  const text = normalize(message);
  const cert = product.certifications;
  const lines: string[] = [];

  const yesNoUnknown = (
    labelNl: string,
    labelEn: string,
    labelDe: string,
    value: boolean | null
  ) => {
    const label = lang === "nl" ? labelNl : lang === "de" ? labelDe : labelEn;
    if (value === true) {
      lines.push(tr(lang, `${label}: ja.`, `${label}: yes.`, `${label}: ja.`));
    } else if (value === false) {
      lines.push(tr(lang, `${label}: nee.`, `${label}: no.`, `${label}: nein.`));
    } else {
      lines.push(
        tr(
          lang,
          `${label}: niet bevestigd in de productinformatie.`,
          `${label}: not confirmed in the product information.`,
          `${label}: in den Produktinformationen nicht bestätigt.`
        )
      );
    }
  };

  if (/\bvegan\b/.test(text)) {
    yesNoUnknown("Vegan", "Vegan", "Vegan", cert.vegan);
  }
  if (/gluten/.test(text)) {
    yesNoUnknown("Glutenvrij", "Gluten free", "Glutenfrei", cert.gluten_free);
  }
  if (/(nut free|noten|noot)/.test(text)) {
    yesNoUnknown("Notenvrij", "Nut free", "Nussfrei", cert.nut_free);
    if (cert.nut_free === false && product.inci.some((item) => /almond|amygdalus/i.test(item))) {
      lines.push(
        tr(
          lang,
          "De INCI bevat amandelolie.",
          "The INCI contains almond oil.",
          "Die INCI enthält Mandelöl."
        )
      );
    }
  }
  if (/(allergen label|allergen|allergeen)/.test(text)) {
    yesNoUnknown(
      "Allergen label free",
      "Allergen label free",
      "Ohne kennzeichnungspflichtige Allergene auf dem Etikett",
      cert.allergen_label_free
    );
    lines.push(
      tr(
        lang,
        "Dit betekent niet dat het product volledig allergeenvrij is.",
        "This does not mean that the product is completely allergen-free.",
        "Das bedeutet nicht, dass das Produkt vollständig allergenfrei ist."
      )
    );
  }
  if (/(parfum|fragrance|geurvrij|parfumvrij)/.test(text)) {
    if (cert.fragrance_free === null && product.verification.conflicts.length) {
      lines.push(
        tr(
          lang,
          "Parfumvrij: niet bevestigd. De leveranciersverklaring botst met de INCI, waarin Parfum/Fragrance staat.",
          "Fragrance free: not confirmed. The supplier declaration conflicts with the INCI, which lists Parfum/Fragrance.",
          "Parfümfrei: nicht bestätigt. Die Lieferantenangabe widerspricht der INCI, in der Parfum/Fragrance aufgeführt ist."
        )
      );
    } else {
      yesNoUnknown("Parfumvrij", "Fragrance free", "Parfümfrei", cert.fragrance_free);
    }
  }
  if (/(dermatologisch|dermatologically)/.test(text)) {
    yesNoUnknown(
      "Dermatologisch getest",
      "Dermatologically tested",
      "Dermatologisch getestet",
      cert.dermatologically_tested
    );
  }
  if (/cosmos/.test(text)) {
    lines.push(
      cert.cosmos
        ? tr(
            lang,
            `COSMOS-certificering: ${cert.cosmos}.`,
            `COSMOS certification: ${cert.cosmos}.`,
            `COSMOS-Zertifizierung: ${cert.cosmos}.`
          )
        : tr(
            lang,
            "COSMOS-certificering: niet vermeld voor dit product.",
            "COSMOS certification: not listed for this product.",
            "COSMOS-Zertifizierung: für dieses Produkt nicht aufgeführt."
          )
    );
  }
  if (/(natural origin|natuurlijke oorsprong)/.test(text)) {
    lines.push(
      cert.natural_origin_percentage == null
        ? tr(
            lang,
            "Percentage van natuurlijke oorsprong: niet bevestigd.",
            "Natural-origin percentage: not confirmed.",
            "Anteil natürlichen Ursprungs: nicht bestätigt."
          )
        : tr(
            lang,
            `Van natuurlijke oorsprong: ${cert.natural_origin_percentage}%.`,
            `Natural origin: ${cert.natural_origin_percentage}%.`,
            `Natürlichen Ursprungs: ${cert.natural_origin_percentage}%.`
          )
    );
  }
  if (/(organic|organisch|biologisch)/.test(text) && !/cosmos/.test(text)) {
    lines.push(
      cert.organic_percentage == null
        ? tr(
            lang,
            "Biologisch aandeel: niet bevestigd.",
            "Organic percentage: not confirmed.",
            "Bio-Anteil: nicht bestätigt."
          )
        : tr(
            lang,
            `Biologisch aandeel volgens de productsheet: ${cert.organic_percentage}%.`,
            `Organic content according to the product sheet: ${cert.organic_percentage}%.`,
            `Bio-Anteil laut Produktdatenblatt: ${cert.organic_percentage}%.`
          )
    );
  }
  if (/(cruelty|dierproef)/.test(text)) {
    yesNoUnknown(
      "Dierproefvrij",
      "Cruelty free",
      "Tierversuchsfrei",
      cert.cruelty_free ?? null
    );
  }

  return lines.length ? lines.join("\n") : null;
}

function deterministicFallback(args: {
  message: string;
  lang: Lang;
  intent: Intent;
  products: Product[];
  bundles: Bundle[];
}): { reply: string; actions: ChatAction[] } {
  const product = args.products[0];
  const bundle = args.bundles[0];

  if (bundle) {
    const names = bundle.product_ids
      .map((id) => productsById.get(id)?.title)
      .filter((item): item is string => Boolean(item));
    return {
      reply: tr(
        args.lang,
        `**${bundle.name}** bevat:\n- ${names.join("\n- ")}\n\nSPF zit niet in deze routine.`,
        `**${bundle.name}** includes:\n- ${names.join("\n- ")}\n\nSPF is not included in this routine.`,
        `**${bundle.name}** enthält:\n- ${names.join("\n- ")}\n\nSPF ist nicht in dieser Routine enthalten.`
      ),
      actions: [bundleAction(bundle, args.lang)],
    };
  }

  if (product) {
    if (args.intent === "ingredients") {
      const actives = Object.entries(product.active_percentages)
        .map(([name, percentage]) => `${name} ${percentage}`)
        .join(", ");
      const highlights = product.key_ingredients.slice(0, 6).join(", ");
      return {
        reply: `${product.description[args.lang]}\n\n${tr(
          args.lang,
          `Belangrijkste ingrediënten: ${actives || highlights}.`,
          `Key ingredients: ${actives || highlights}.`,
          `Wichtige Inhaltsstoffe: ${actives || highlights}.`
        )}`,
        actions: [productAction(product, args.lang)],
      };
    }
    if (args.intent === "usage") {
      return {
        reply: `${product.usage[args.lang]} ${product.when_to_use[args.lang]}`,
        actions: [productAction(product, args.lang)],
      };
    }
    if (args.intent === "certifications") {
      const direct = directCertificationAnswer(product, args.message, args.lang);
      const conflict = product.verification.conflicts.length && !direct
        ? ` ${tr(
            args.lang,
            "Er staat een controlepunt in de productdata; daarom maak ik geen onbevestigde claim.",
            "There is a verification issue in the product data, so I will not make an unconfirmed claim.",
            "In den Produktdaten gibt es einen Prüfpunkt; daher mache ich keine unbestätigte Aussage."
          )}`
        : "";
      return {
        reply: direct || `${certificationText(product, args.lang)}${conflict}`,
        actions: [productAction(product, args.lang)],
      };
    }
    return {
      reply: product.description[args.lang],
      actions: [productAction(product, args.lang)],
    };
  }

  return {
    reply: tr(
      args.lang,
      "Vertel me welk product je bedoelt of wat je huidtype en belangrijkste huiddoel zijn, dan help ik je gericht verder.",
      "Tell me which product you mean, or share your skin type and main skin goal, and I will help you more specifically.",
      "Sag mir, welches Produkt du meinst, oder nenne deinen Hauttyp und dein wichtigstes Hautziel, dann helfe ich dir gezielt weiter."
    ),
    actions: [
      {
        type: "OPEN_URL",
        label: tr(args.lang, "Start de huidquiz", "Start the skin quiz", "Hautquiz starten"),
        url: QUIZ_URL,
      },
    ],
  };
}

function logOpenAIError(stage: string, error: unknown): void {
  const candidate = error as {
    status?: unknown;
    code?: unknown;
    type?: unknown;
    message?: unknown;
    error?: unknown;
  };
  console.error(`SOVAH OpenAI ${stage} error:`, {
    status: candidate?.status,
    code: candidate?.code,
    type: candidate?.type,
    message: candidate?.message,
    error: candidate?.error,
  });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const ip = getClientIp(req);
  if (!allowRequest(ip)) {
    return jsonResponse(
      {
        reply: "Te veel berichten in korte tijd. Wacht even en probeer het opnieuw.",
        actions: [],
        lang: "nl",
      },
      429,
      origin,
      { "X-SOVAH-AI-Used": "0" }
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse(
      { error: "Invalid JSON body" },
      400,
      origin,
      { "X-SOVAH-AI-Used": "0" }
    );
  }

  const message = safeString(body.message, MAX_MESSAGE_LENGTH);
  const history = parseHistory(body.history);
  const previousContext = parseConversationContext(body.context);
  const lang = detectLanguage(message, body.lang);
  if (!message) {
    return jsonResponse(
      {
        reply: tr(
          lang,
          "Stel je skincarevraag, dan help ik je verder.",
          "Ask your skincare question and I will help you.",
          "Stelle deine Skincare-Frage, dann helfe ich dir weiter."
        ),
        actions: [],
        lang,
      },
      400,
      origin,
      { "X-SOVAH-AI-Used": "0" }
    );
  }

  let usedAI = false;
  let resolverUsed = false;
  const deterministicProducts = deterministicProductMatches(message);
  const deterministicBundles = deterministicBundleMatches(message);
  let intent = inferIntent(message, deterministicProducts, deterministicBundles);
  let selectedProducts = deterministicProducts;
  let selectedBundles = deterministicBundles;
  let resolver: ResolverResult | null = null;

  const contextualFollowUp = isContextDependentFollowUp(message);

  if (contextualFollowUp) {
    if (!selectedProducts.length) {
      selectedProducts = previousContext.product_ids
        .map((id) => productsById.get(id))
        .filter((item): item is Product => Boolean(item));

      if (!selectedProducts.length) {
        selectedProducts = recentProductsFromHistory(history);
      }
    }

    if (!selectedBundles.length) {
      selectedBundles = previousContext.bundle_ids
        .map((id) => bundlesById.get(id))
        .filter((item): item is Bundle => Boolean(item));

      if (!selectedBundles.length) {
        selectedBundles = recentBundlesFromHistory(history);
      }
    }

    intent = inferFollowUpIntent(
      message,
      history,
      selectedProducts,
      selectedBundles,
      previousContext.intent
    );
  }

  const shouldResolve =
    !selectedProducts.length ||
    (!selectedBundles.length && intent === "routine_recommendation") ||
    intent === "product_recommendation" ||
    intent === "comparison" ||
    intent === "general_skincare";

  if (shouldResolve && openai) {
    try {
      resolverUsed = true;
      resolver = safeResolverResult(await resolveWithAI(message, history, lang));
      if (resolver) {
        usedAI = true;
        intent = resolver.intent;
        selectedProducts = resolver.product_ids
          .map((id) => productsById.get(id))
          .filter((item): item is Product => Boolean(item));
        selectedBundles = resolver.bundle_ids
          .map((id) => bundlesById.get(id))
          .filter((item): item is Bundle => Boolean(item));

        if (
          resolver.needs_clarification &&
          resolver.clarification_question &&
          resolver.confidence < 0.72
        ) {
          return jsonResponse(
            {
              reply: resolver.clarification_question,
              actions: [],
              lang,
              context: buildConversationContext(
                intent,
                selectedProducts,
                selectedBundles
              ),
              ...(DEBUG
                ? {
                    meta: {
                      aiUsed: true,
                      resolverUsed: true,
                      resolver,
                    },
                  }
                : {}),
            },
            200,
            origin,
            { "X-SOVAH-AI-Used": "1" }
          );
        }
      }
    } catch (error) {
      logOpenAIError("resolver", error);
    }
  }

  // For a bundle question, its products are part of the grounded answer context.
  if (selectedBundles.length && !selectedProducts.length) {
    selectedProducts = unique(selectedBundles.flatMap((bundle) => bundle.product_ids))
      .map((id) => productsById.get(id))
      .filter((item): item is Product => Boolean(item))
      .slice(0, 8);
  }

  let answer: AnswerResult | null = null;
  if (openai) {
    try {
      answer = await answerWithAI({
        message,
        history,
        lang,
        intent,
        selectedProducts,
        selectedBundles,
      });
      if (answer) usedAI = true;
    } catch (error) {
      logOpenAIError("answer", error);
    }
  }

  if (answer) {
    const actions = buildActions(answer, selectedProducts, selectedBundles, lang);
    return jsonResponse(
      {
        reply: answer.reply,
        actions,
        lang,
        context: buildConversationContext(
          intent,
          selectedProducts,
          selectedBundles
        ),
        ...(DEBUG
          ? {
              meta: {
                aiUsed: usedAI,
                resolverUsed,
                intent,
                selectedProductIds: selectedProducts.map((p) => p.id),
                selectedBundleIds: selectedBundles.map((b) => b.id),
                models: {
                  resolver: RESOLVER_MODEL,
                  answer: ANSWER_MODEL,
                },
              },
            }
          : {}),
      },
      200,
      origin,
      { "X-SOVAH-AI-Used": usedAI ? "1" : "0" }
    );
  }

  const fallback = deterministicFallback({
    message,
    lang,
    intent,
    products: selectedProducts,
    bundles: selectedBundles,
  });
  return jsonResponse(
    {
      reply: fallback.reply,
      actions: fallback.actions,
      lang,
      context: buildConversationContext(
        intent,
        selectedProducts,
        selectedBundles
      ),
      ...(DEBUG
        ? {
            meta: {
              aiUsed: usedAI,
              resolverUsed,
              intent,
              selectedProductIds: selectedProducts.map((p) => p.id),
              selectedBundleIds: selectedBundles.map((b) => b.id),
              fallback: true,
            },
          }
        : {}),
    },
    200,
    origin,
    { "X-SOVAH-AI-Used": usedAI ? "1" : "0" }
  );
}
