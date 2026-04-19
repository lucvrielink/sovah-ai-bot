import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";

function buildCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(),
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
    .replace(/[^\w\s&+\-']/g, " ")
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
    "doffe huid", "normale huid", "welk product", "wat raad je aan"
  ];

  const englishSignals = [
    "my", "skin", "dry", "oily", "sensitive", "which", "what", "routine",
    "fits", "best", "glow", "breakouts", "hydration", "cleanser", "serum",
    "help", "advice", "radiance", "moisture", "why", "don't", "mean",
    "want", "have", "product", "dull skin", "fine lines", "recommend"
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

// ─── Detection ──────────────────────────────────────────────────────────────

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
      "Ik kan je helpen met productvragen, productvergelijkingen en algemene keuzehulp. Voor de beste routine-match kun je ook onze quiz gebruiken.",
      "I can help with product questions, product comparisons, and general skincare guidance. For the best routine match, you can also use our quiz."
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
      "Geen stress. Vertel me gewoon of je hulp wilt met een product of met het kiezen van een routine.",
      "No worries. Just tell me whether you want help with a product or with choosing a routine."
    );
  }

  if (intent === "unclear") {
    return tr(
      lang,
      "Ik snap nog niet helemaal wat je bedoelt. Gaat het om een product of wil je hulp met je huid?",
      "I'm not fully sure what you mean yet. Is it about a product or do you want help with your skin?"
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

function detectSkinSignals(text: string): string[] {
  const t = normalize(text);
  const found = new Set<string>();

  if (hasAny(t, ["dry", "dehydrated", "droog", "droge huid", "uitgedroogd", "vochttekort", "tight", "flaky"])) {
    found.add("dry");
  }

  if (hasAny(t, ["oily", "vet", "vette huid", "glimmend", "shiny", "greasy"])) {
    found.add("oily");
  }

  if (hasAny(t, ["combination", "combinatie", "combinatiehuid", "t-zone", "combo"])) {
    found.add("combination");
  }

  if (hasAny(t, ["sensitive", "gevoelig", "reactive", "reactief", "roodheid", "irritated", "geïrriteerd", "geirriteerd"])) {
    found.add("sensitive");
  }

  if (hasAny(t, ["normal", "normaal", "normale huid", "balanced", "gebalanceerd"])) {
    found.add("normal");
  }

  if (hasAny(t, ["glow", "doffe huid", "dof", "radiance", "stralend", "meer glow", "dull"])) {
    found.add("glow");
  }

  if (hasAny(t, ["acne", "puistjes", "breakouts", "blemishes", "spots", "onzuiverheden", "mee eters", "mee-eters"])) {
    found.add("breakouts");
  }

  if (hasAny(t, [
    "anti age", "anti-age", "anti aging", "anti-aging", "fine lines",
    "wrinkles", "rimpels", "fijne lijntjes", "firmness", "stevigheid"
  ])) {
    found.add("antiage");
  }

  if (hasAny(t, ["simple", "simpel", "easy routine", "geen gedoe", "makkelijke routine"])) {
    found.add("simple");
  }

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

  const t = normalize(message);
  const skinSignals = detectSkinSignals(message);

  if (detectRoutineHelpRequest(message)) return false;
  if (detectCorrectionMessage(message)) return false;
  if (detectNotKnowingSkinType(message)) return false;

  if (
    skinSignals.length >= 2 &&
    !hasAny(t, ["wat doet", "what does", "verschil", "difference", "waar", "where", "geschikt", "good for"])
  ) {
    return false;
  }

  return true;
}

function shouldRedirectToQuiz(message: string, combinedUserText: string): boolean {
  const current = normalize(message);
  const all = normalize(combinedUserText);

  const currentSignals = detectSkinSignals(message);
  const totalSignals = detectSkinSignals(combinedUserText);

  if (isSpecificProductQuestion(message)) return false;
  if (detectCompareRequest(message)) return false;
  if (detectSuitabilityRequest(message) && isSpecificProductQuestion(message)) return false;
  if (detectWhereRequest(message) && isSpecificProductQuestion(message)) return false;

  if (detectRoutineHelpRequest(message)) return true;
  if (detectNotKnowingSkinType(message)) return true;
  if (detectBroadSkinGoal(message)) return true;
  if (detectCorrectionMessage(message)) return true;

  if (currentSignals.length >= 2) return true;

  if (
    currentSignals.length >= 1 &&
    hasAny(current, [
      "wat raad je aan", "what do you recommend", "help", "hulp", "voor mijn huid",
      "for my skin", "wat moet ik", "what should i", "wat past", "what fits"
    ])
  ) {
    return true;
  }

  if (
    hasAny(current, [
      "voor mijn huid", "for my skin", "mijn huid", "my skin",
      "huid", "skin"
    ]) &&
    !isSpecificProductQuestion(message) &&
    !findMentionedBundles(message).length
  ) {
    if (currentSignals.length >= 1) return true;
      if (hasAny(current, ["raad", "recommend", "advies", "help", "kiezen", "choose"])) return true;
  }

  if (
    isShortMessage(message) &&
    totalSignals.length >= 1 &&
    hasAny(current, ["ja", "nee", "yes", "no", "oke", "ok", "meer", "instead", "bedoel", "droog", "vet", "gevoelig", "normal", "normaal"])
  ) {
    return true;
  }

  if (
    totalSignals.length >= 2 &&
    !isSpecificProductQuestion(message) &&
    !findMentionedBundles(message).length
  ) {
    return true;
  }

  if (
    hasAny(all, ["wat raad je aan", "what do you recommend", "which routine", "welke routine", "beste routine"]) &&
    isShortMessage(message)
  ) {
    return true;
  }

  return false;
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
    lang === "nl"
      ? bundle.description || "Routine uit het huidige SOVAH assortiment."
      : bundle.description || "Routine from the current SOVAH range.",
    productsPart,
  ].filter(Boolean).join("\n\n");
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
        "Ik weet nog niet helemaal wat je bedoelt. Voor de beste routine-match kun je het beste onze skincare quiz doen.",
        "I'm not fully sure what you mean yet. For the best routine match, the best next step is our skincare quiz."
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
Do not use website content, scraped content, or outside product information.
Do not invent products, ingredients, medical claims, or unsupported benefits.

Available bundles: ${bundleList}
Available products: ${productList}

Rules:
- Always reply in the customer's language.
- Keep replies short, natural, practical, and premium.
- In Dutch, use natural webshop Dutch, not stiff translated Dutch.
- If the user asks which routine fits them, what you recommend for their skin, says they do not know their skin type, mentions multiple skin concerns, or gives correction-style skin input, prefer the skincare quiz.
- If the user asks about one specific product, answer directly.
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
            "Vertel me wat voor huid je hebt of welk product je bedoelt, dan help ik je verder.",
            "Tell me your skin type or which product you mean, and I'll help from there."
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
        "Voor de beste routine-match kun je het beste onze skincare quiz doen.",
        "For the best routine match, the best next step is our skincare quiz."
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
}

// ─── Main handler ───────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const corsHeaders = buildCorsHeaders();

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
      !detectWhereRequest(message);

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

    // QUIZ FIRST for broad skin/routine guidance
    if (shouldRedirectToQuiz(message, combinedUserText)) {
      const quizOut = buildQuizRedirectReply(lang);
      return new Response(
        JSON.stringify(quizOut),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
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
      return new Response(
        JSON.stringify({
          reply: tr(
            lang,
            `**${product.title}**\n\n${getShortProductCopy(product, lang)}\n\nVertel me wat voor huid je hebt en wat je doel is, dan zeg ik of dit goed past.`,
            `**${product.title}**\n\n${getShortProductCopy(product, lang)}\n\nTell me your skin type and goal, and I’ll tell you if it fits.`
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
    if (mentionedProducts.length === 1 && !detectCompareRequest(message) && !detectSuitabilityRequest(message)) {
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

    if (looseProduct && !detectCompareRequest(message) && !detectSuitabilityRequest(message) && !detectWhereRequest(message)) {
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
    if (mentionedBundles.length === 1) {
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
