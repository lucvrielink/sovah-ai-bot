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

const bundlesPath = path.join(process.cwd(), "data", "bundle_catalog.json");
const productsPath = path.join(process.cwd(), "data", "product_catalog.json");

const BUNDLES_JSON = fs.readFileSync(bundlesPath, "utf8");
const PRODUCTS_JSON = fs.readFileSync(productsPath, "utf8");

type SkinType = "dry" | "oily" | "combination" | "normal" | "sensitive";
type Goal = "hydration" | "glow" | "antiage" | "breakouts" | "simple";
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
    "waarom", "geen", "bedoel", "wil", "heb", "last van"
  ];

  const englishSignals = [
    "my", "skin", "dry", "oily", "sensitive", "which", "what", "routine",
    "fits", "best", "glow", "breakouts", "hydration", "cleanser", "serum",
    "help", "advice", "radiance", "moisture", "why", "don't", "mean",
    "want", "have", "product"
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
  return normalize(text).split(" ").filter(Boolean).length <= 3;
}

function detectNoAcne(text: string): boolean {
  const t = normalize(text);

  return hasAny(t, [
    "i dont have acne",
    "i don't have acne",
    "i do not have acne",
    "no acne",
    "not acne prone",
    "i dont get breakouts",
    "i don't get breakouts",
    "i dont have blemishes",
    "i don't have blemishes",
    "ik heb geen acne",
    "ik heb geen puistjes",
    "geen acne",
    "geen puistjes",
    "ik heb daar geen last van",
  ]);
}

function detectWhyQuestion(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "why",
    "why that",
    "why acne spot care",
    "waarom",
    "waarom die",
    "waarom acne spot care",
  ]);
}

function detectQuizRequest(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "quiz",
    "skincare quiz",
    "skin quiz",
    "huid quiz",
    "huidquiz",
    "start quiz",
    "start de quiz",
    "do the quiz",
    "take the quiz",
  ]);
}

function detectExplicitRoutineSelectionRequest(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "which routine fits me best",
    "what routine fits me best",
    "best routine for me",
    "welke routine past bij mij",
    "beste routine voor mij",
    "wat past bij mijn huid",
    "find my routine",
  ]);
}

function buildQuizRedirectReply(lang: Lang): { reply: string; actions: ChatAction[]; lang: Lang } {
  return {
    reply: tr(
      lang,
      "Voor uitgebreider routine-advies kun je ook onze skincare quiz gebruiken.\n\nDaar begeleiden we je stap voor stap naar de beste match voor jouw huid.",
      "For more complete routine advice, you can also use our skincare quiz.\n\nThere we guide you step by step to the best match for your skin."
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

function detectSkinType(text: string): SkinType | null {
  const t = normalize(text);

  if (
    hasAny(t, [
      "combination", "combo skin", "combo", "combi skin", "combi",
      "oily t zone", "oily in some areas", "dry in others",
      "combinatie", "combinatiehuid", "t-zone", "t zone",
      "vet op sommige", "droog op sommige",
    ])
  ) return "combination";

  if (
    hasAny(t, [
      "sensitive", "sensetive", "reactive", "redness prone",
      "irritated", "skin barrier", "barrier",
      "gevoelig", "gevoelige huid", "gevoeligehuid", "reactief", "roodheid",
      "geïrriteerd", "geirriteerd", "huidbarrière", "huidbarriere",
    ])
  ) return "sensitive";

  if (
    hasAny(t, [
      "oily", "oilly", "oilie", "shiny", "greasy", "oil prone",
      "vet", "vette huid", "vettig", "glimmend", "glans op gezicht",
    ])
  ) return "oily";

  if (
    hasAny(t, [
      "dry", "dehydrated", "dehydration", "tight", "flaky", "rough",
      "droog", "droge huid", "uitgedroogd", "vochttekort", "strak", "schilfert",
    ])
  ) return "dry";

  if (
    hasAny(t, [
      "normal", "balanced skin", "balanced",
      "normaal", "normale huid", "gebalanceerd",
    ])
  ) return "normal";

  return null;
}

function detectGoal(text: string): Goal | null {
  const t = normalize(text);

  if (
    hasAny(t, [
      "breakout", "breakouts", "brakouts", "acne", "blemish", "blemishes",
      "spots", "pimples", "blackheads", "clogged pores",
      "puistjes", "puistje", "mee-eters", "mee eters",
      "last van puistjes",
    ])
  ) return "breakouts";

  if (
    hasAny(t, [
      "glow", "glowy", "radiance", "radiant", "dull", "bright",
      "brighter", "uneven", "texture", "fresh look", "more glow",
      "straling", "stralend", "doffe huid", "dof",
      "egaler", "egale teint", "frisser", "meer glow",
    ])
  ) return "glow";

  if (
    hasAny(t, [
      "hydration", "hydrate", "hydrating", "moisture", "more moisture", "comfort",
      "hydratatie", "hydrateren", "vochtinbrengende", "vochtcreme", "vocht",
      "droogheid verhelpen", "meer vocht",
    ])
  ) return "hydration";

  if (
    hasAny(t, [
      "anti age", "anti-age", "antiage", "anti aging", "anti-aging",
      "ageing", "aging", "fine lines", "firmness", "wrinkles", "smoothness",
      "rimpels", "rimpel", "fijne lijntjes",
      "ouder wordende huid", "stevigheid", "verouderende",
    ])
  ) return "antiage";

  if (
    hasAny(t, [
      "simple", "minimal", "easy routine", "no fuss", "no-fuss",
      "basic routine", "easy",
      "simpel", "eenvoudig", "minimaal", "makkelijke routine",
      "geen gedoe", "basisroutine",
    ])
  ) return "simple";

  return null;
}

function detectConversationIntent(text: string): ConversationIntent {
  const t = normalize(text);

  if (
    hasExactWord(t, ["hello", "hi", "hey", "hallo", "yo", "hoi"]) ||
    hasAny(t, ["good morning", "good afternoon", "good evening", "goedemorgen", "goedemiddag", "goedenavond"])
  ) return "greeting";

  if (
    hasAny(t, ["thanks", "thank you", "thx", "ty", "bedankt", "dankje", "dankjewel", "merci"])
  ) return "thanks";

  if (
    hasAny(t, ["bye", "goodbye", "see you", "later", "doei", "tot ziens", "dag"])
  ) return "bye";

  if (
    hasAny(t, [
      "help",
      "can you help me",
      "what can you do",
      "how can you help",
      "wat kan je",
      "wat kun je",
      "kun je me helpen",
      "kan je me helpen",
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
      "ik weet het niet", "geen idee", "weet ik niet",
    ])
  ) return "confused";

  if (
    hasAny(t, [
      "huh", "hmm", "uh", "umm", "lol", "random", "weird",
      "my skin is weird", "not sure what i need",
    ])
  ) return "unclear";

  if (
    hasAny(t, [
      "how are you", "you there", "are you real", "can we talk", "talk to me",
      "hoe gaat het", "ben je er", "spreek je nederlands",
    ])
  ) return "human_chat";

  return null;
}

function buildConversationReply(intent: ConversationIntent, lang: Lang): string | null {
  if (intent === "greeting") {
    return tr(
      lang,
      "Hi! Ik ben de SOVAH skincare assistant. Vertel me wat voor huid je hebt of waar je hulp bij wilt, dan denk ik met je mee.",
      "Hello! I'm the SOVAH skincare assistant. Tell me your skin type or what you'd like help with, and I'll help you find the right match."
    );
  }

  if (intent === "thanks") {
    return tr(lang, "Graag gedaan!", "You're welcome!");
  }

  if (intent === "bye") {
    return tr(lang, "Tot snel 🌿", "Goodbye! 🌿");
  }

  if (intent === "help") {
    return tr(
      lang,
      "Ik kan je helpen met producten uitleggen, producten vergelijken en meedenken op basis van jouw huid en doel.",
      "I can help explain products, compare products, and think along based on your skin and goal."
    );
  }

  if (intent === "yes") {
    return tr(
      lang,
      "Top. Vertel me wat voor huid je hebt of waar je hulp bij wilt.",
      "Great. Tell me your skin type or what you'd like help with."
    );
  }

  if (intent === "no") {
    return tr(
      lang,
      "Geen probleem. Vertel maar waar je hulp bij wilt.",
      "No problem. Just tell me what you'd like help with."
    );
  }

  if (intent === "confused") {
    return tr(
      lang,
      "Geen stress. Vertel me gewoon wat voor huid je hebt of welk product je bekijkt.",
      "No worries. Just tell me your skin type or which product you're looking at."
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
      "Ja hoor, ik ben er. Vertel me waar je hulp bij wilt, dan help ik je verder.",
      "Yes, I'm here. Tell me what you'd like help with, and I'll help from there."
    );
  }

  return null;
}

function getBundleByName(name: string): Bundle | undefined {
  return bundleCatalog.bundles.find((b) => b.name === name);
}

function getProductByName(name: string): Product | undefined {
  return productCatalog.products.find((p) => p.title === name);
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
    "Niacinamide Gel Moisturiser": ["niacinamide", "niacinamide moisturiser", "gel moisturiser"],
    "Sun Protection SPF50 Stick, no tint": ["spf stick", "sun stick", "spf50 stick", "sun protection stick", "zonnebescherming"],
    "Micellar Cleansing Water": ["micellar", "micellar cleansing water", "reinigingswater"],
    "Calming Facial Oil": ["calming oil", "facial oil", "calming facial oil", "gezichtsolie"],
    "Moisturising Day Cream": ["day cream", "moisturising day cream", "dagcrème", "dagcreme"],
    "Ceramide Barrier Night Cream": ["night cream", "ceramide cream", "nachtcrème", "nachtcreme"],
  };

  for (const [productName, words] of Object.entries(aliases)) {
    if (words.some((word) => t.includes(normalizeLoose(word)))) {
      return getProductByName(productName);
    }
  }

  return undefined;
}

function detectCompareRequest(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "compare", "difference", "what is better", "which is better", "vs", "versus",
    "vergelijk", "verschil", "wat is beter", "welke is beter",
  ]);
}

function detectSuitabilityRequest(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "is this good for", "is it good for", "good for", "suitable for",
    "can i use", "would this work for", "is this okay for",
    "geschikt voor", "kan ik gebruiken", "is dit goed voor",
    "werkt dit voor", "past dit bij",
  ]);
}

function pickBundle(skinType: SkinType | null, goal: Goal | null): Bundle | undefined {
  if (!goal) return undefined;

  if (goal === "breakouts") {
    if (skinType === "oily" || skinType === "combination") return getBundleByName("Clear & Balanced Skin Routine");
    if (skinType === "sensitive") return getBundleByName("Sensitive & Reactive Skin Routine");
    if (skinType === "dry") return getBundleByName("Dry & Dehydrated Skin Routine");
    return getBundleByName("Clear & Balanced Skin Routine");
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

function shortBundleDescription(bundleName: string, lang: Lang): string {
  const mapNl: Record<string, string> = {
    "Dry & Dehydrated Skin Routine": "Past goed bij een droge of vochtarme huid die wat extra comfort en hydratatie nodig heeft.",
    "Combination Skin Balance Routine": "Past goed bij een combinatiehuid die in balans moet blijven zonder zwaar aan te voelen.",
    "Simple Daily Skincare Routine": "Fijn als je gewoon een makkelijke dagelijkse routine wilt zonder te veel stappen.",
    "Sensitive & Reactive Skin Routine": "Past goed bij een gevoelige huid die behoefte heeft aan een rustige, milde routine.",
    "Normal & Balanced Skin Routine": "Een fijne match voor een normale huid die goed in balans is.",
    "Glow & Radiance Routine": "Past goed als je huid wat dof oogt en je meer glow wilt.",
    "Firm & Smooth Skin Routine": "Past goed als je huid wat gladder en steviger mag aanvoelen.",
    "Clear & Balanced Skin Routine": "Past goed bij een vettere huid of als je snel last hebt van acne of puistjes.",
  };

  const mapEn: Record<string, string> = {
    "Dry & Dehydrated Skin Routine": "A good fit for dry or dehydrated skin that needs extra comfort and hydration.",
    "Combination Skin Balance Routine": "A good fit for combination skin that needs balance without feeling heavy.",
    "Simple Daily Skincare Routine": "Great if you want an easy daily routine without too many steps.",
    "Sensitive & Reactive Skin Routine": "A good fit for sensitive skin that needs a calm, gentle routine.",
    "Normal & Balanced Skin Routine": "A nice match for normal skin that already feels balanced.",
    "Glow & Radiance Routine": "A good fit if your skin looks a bit dull and you want more glow.",
    "Firm & Smooth Skin Routine": "A good fit if you want your skin to feel smoother and firmer.",
    "Clear & Balanced Skin Routine": "A good fit for oilier skin or if you often deal with acne or breakouts.",
  };

  return lang === "nl"
    ? mapNl[bundleName] || "Een sterke match uit het huidige assortiment."
    : mapEn[bundleName] || "A strong fit from the current range.";
}

function shortAddonDescription(addonName: string, lang: Lang): string {
  const mapNl: Record<string, string> = {
    "AHA Peeling Concentrate": "Een fijne extra stap als je huid wat dof is of niet helemaal glad aanvoelt.",
    "Acne Spot Care": "Een handige extra stap als je plaatselijk last hebt van acne of puistjes.",
    "Smoothing Eye Cream": "Een fijne extra stap voor de huid rond je ogen.",
  };

  const mapEn: Record<string, string> = {
    "AHA Peeling Concentrate": "A nice add-on if your skin feels a bit dull or uneven.",
    "Acne Spot Care": "A helpful add-on if you deal with acne or breakouts in specific areas.",
    "Smoothing Eye Cream": "A nice add-on for the skin around your eyes.",
  };

  return lang === "nl" ? mapNl[addonName] || "" : mapEn[addonName] || "";
}

function shortProductDescription(productName: string, lang: Lang): string {
  const mapNl: Record<string, string> = {
    "Micellar Cleansing Water": "Een milde reiniger voor elke dag.",
    "Hydrating Toner": "Een hydraterende toner die je huid fris en comfortabel laat aanvoelen.",
    "Hydrating Serum": "Een licht serum voor extra hydratatie.",
    "Double Hydration Boost Gel + HA": "Een hydraterende gel voor een comfortabeler huidgevoel.",
    "Moisturising Day Cream": "Een dagcrème voor dagelijkse hydratatie en comfort.",
    "Ceramide Barrier Night Cream": "Een rijkere nachtcrème die je huid helpt comfortabel aan te voelen.",
    "Purifying Mousse": "Een schuimende reiniger met een fris en licht gevoel.",
    "Antioxidant Ginkgo Gel Booster": "Een lichte booster voor extra hydratatie en een frisse uitstraling.",
    "Calming Facial Oil": "Een kalmerende gezichtsolie voor comfort en zachtheid.",
    "AHA Peeling Concentrate": "Een extra stap voor als je huid wat dof is of niet helemaal glad aanvoelt.",
    "Caffeine Gel Booster": "Een lichte booster voor een frissere uitstraling.",
    "Oil-Free Hydrating Gel": "Een olievrije gel voor lichte dagelijkse hydratatie.",
    "Peptide Anti-Aging Serum": "Een serum voor een gladdere uitstraling.",
    "Collagen Boost Serum": "Een serum dat past bij een routine voor meer stevigheid en comfort.",
    "Anti-Age Day Cream": "Een dagcrème voor een routine gericht op een gladdere huid.",
    "Natural Retinol Alternative Oil Serum": "Een milde olie-serum stap voor een routine met meer focus op huidveroudering.",
    "Smoothing Eye Cream": "Een oogcrème voor de huid rond je ogen.",
    "Vitamin C Serum": "Een serum voor een frissere en stralendere uitstraling.",
    "Brightening Face&Body Exfoliator with Kojic Acid": "Een exfoliator voor een gladdere en frissere look.",
    "Dark Spot Face Cream with Kojic Acid": "Een crème voor een egalere uitstraling.",
    "All-In-One Facial Oil": "Een voedende gezichtsolie voor glow en comfort.",
    "Sun Protection SPF50 Stick, no tint": "Een SPF50 stick voor makkelijke dagelijkse bescherming.",
    "Acne Spot Care": "Een gerichte behandeling voor plekjes met acne of puistjes.",
    "Niacinamide Gel Moisturiser": "Een lichte gel moisturiser voor balans en comfort.",
  };

  const mapEn: Record<string, string> = {
    "Micellar Cleansing Water": "A gentle everyday cleanser.",
    "Hydrating Toner": "A hydrating toner that leaves your skin feeling fresh and comfortable.",
    "Hydrating Serum": "A lightweight serum for extra hydration.",
    "Double Hydration Boost Gel + HA": "A hydrating gel for a more comfortable skin feel.",
    "Moisturising Day Cream": "A day cream for daily hydration and comfort.",
    "Ceramide Barrier Night Cream": "A richer night cream that helps your skin feel comfortable.",
    "Purifying Mousse": "A foaming cleanser with a fresh, lightweight feel.",
    "Antioxidant Ginkgo Gel Booster": "A lightweight booster for extra hydration and a fresher look.",
    "Calming Facial Oil": "A calming facial oil for comfort and softness.",
    "AHA Peeling Concentrate": "A nice extra step if your skin feels dull or uneven.",
    "Caffeine Gel Booster": "A lightweight booster for a fresher-looking complexion.",
    "Oil-Free Hydrating Gel": "An oil-free gel for lightweight daily hydration.",
    "Peptide Anti-Aging Serum": "A serum for a smoother-looking complexion.",
    "Collagen Boost Serum": "A serum that fits well in a routine focused on firmness and comfort.",
    "Anti-Age Day Cream": "A day cream for a routine focused on smoother-looking skin.",
    "Natural Retinol Alternative Oil Serum": "A gentle oil serum for a routine with more anti-age focus.",
    "Smoothing Eye Cream": "An eye cream for the skin around your eyes.",
    "Vitamin C Serum": "A serum for a fresher and more radiant-looking complexion.",
    "Brightening Face&Body Exfoliator with Kojic Acid": "An exfoliator for a smoother and fresher look.",
    "Dark Spot Face Cream with Kojic Acid": "A cream for a more even-looking complexion.",
    "All-In-One Facial Oil": "A nourishing facial oil for glow and comfort.",
    "Sun Protection SPF50 Stick, no tint": "An SPF50 stick for easy daily protection.",
    "Acne Spot Care": "A targeted treatment for areas with acne or breakouts.",
    "Niacinamide Gel Moisturiser": "A lightweight gel moisturiser for balance and comfort.",
  };

  return lang === "nl"
    ? mapNl[productName] || "Een product uit het huidige SOVAH assortiment."
    : mapEn[productName] || "A product from the current SOVAH range.";
}

function buildBundleReply(bundle: Bundle, addonName: string | null, lang: Lang): string {
  const parts: string[] = [];
  parts.push(`**${bundle.name}**`);
  parts.push(shortBundleDescription(bundle.name, lang));

  if (bundle.products?.length) {
    parts.push(
      lang === "nl"
        ? `Wat erin zit:\n${bundle.products.map((p) => `- ${p}`).join("\n")}`
        : `Included products:\n${bundle.products.map((p) => `- ${p}`).join("\n")}`
    );
  }

  if (addonName) {
    parts.push(
      lang === "nl"
        ? `Extra tip\n**${addonName}**\n${shortAddonDescription(addonName, lang)}`
        : `Add-on\n**${addonName}**\n${shortAddonDescription(addonName, lang)}`
    );
  }

  return parts.join("\n\n");
}

function buildProductReply(product: Product, lang: Lang): string {
  return `**${product.title}**\n\n${shortProductDescription(product.title, lang)}`;
}

function buildCompareReply(items: (Bundle | Product)[], lang: Lang): string {
  const firstName = "name" in items[0] ? items[0].name : items[0].title;
  const secondName = "name" in items[1] ? items[1].name : items[1].title;

  return lang === "nl"
    ? `**${firstName}** vs **${secondName}**\n\nVertel me wat voor huid je hebt en waar je hulp bij wilt, dan zeg ik welke beter past.`
    : `**${firstName}** vs **${secondName}**\n\nTell me your skin type and main goal, and I'll tell you which one fits better.`;
}

function buildActionsForBundle(bundle: Bundle, addonName?: string | null, lang: Lang = "en"): ChatAction[] {
  const actions: ChatAction[] = [
    {
      type: "OPEN_URL",
      label: lang === "nl" ? "Bekijk routine" : "View routine",
      url: bundle.url,
    },
  ];

  if (addonName) {
    const addon = getProductByName(addonName);
    if (addon) {
      actions.push({
        type: "OPEN_URL",
        label: lang === "nl" ? "Bekijk extra" : "View add-on",
        url: addon.url,
      });
    }
  }

  return actions.slice(0, 2);
}

function buildActionsForProduct(product: Product, lang: Lang = "en"): ChatAction[] {
  return [
    {
      type: "OPEN_URL",
      label: lang === "nl" ? "Bekijk product" : "View product",
      url: product.url,
    },
  ];
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
        "Ik weet nog niet helemaal wat je bedoelt. Vertel me wat voor huid je hebt en waar je hulp bij wilt, dan help ik je verder.",
        "I'm not fully sure what you mean. Tell me your skin type and main goal, and I'll help from there."
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

You may only use the provided bundle and product catalog as your source of truth.
Do not use website content, scraped page content, or outside product information.
Do not invent products, ingredients, claims, routines, skin results, or medical advice.

Available bundles: ${bundleList}
Available products: ${productList}

Rules:
- Always reply in the customer's language.
- Keep replies practical, natural, and conversational.
- In Dutch, use natural webshop Dutch, not stiff translated Dutch.
- You may answer product questions, comparison questions, fit/suitability questions, and general skincare-routing questions.
- You may recommend one best-fit bundle or one best-fit product when the user's need is clear.
- For explicit full-routine selection requests, you may also mention the skincare quiz as an extra option, but do not force a quiz redirect for every skincare question.
- If the customer says they do not have acne or breakouts, do not recommend Acne Spot Care unless they ask for it directly later.
- If the customer asks why something was recommended, explain briefly and correct yourself if needed.
- Ask at most one short clarifying question if needed.
- Keep it premium, warm, concise, and useful.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      system: systemPrompt,
      messages,
    });

    const text =
      response.content[0]?.type === "text"
        ? response.content[0].text
        : tr(
            lang,
            "Vertel me wat voor huid je hebt en waar je hulp bij wilt, dan help ik je de juiste match te vinden.",
            "Tell me your skin type and main goal, and I'll help you find the right match."
          );

    const mentionedProducts = findMentionedProducts(text);
    const mentionedBundles = findMentionedBundles(text);

    let actions: ChatAction[] = [];

    if (mentionedBundles.length > 0) {
      actions = buildActionsForBundle(mentionedBundles[0], null, lang);
    } else if (mentionedProducts.length > 0) {
      actions = buildActionsForProduct(mentionedProducts[0], lang);
    }

    return { reply: text, actions: actions.slice(0, 2), lang };
  } catch (err) {
    console.error("Claude API error:", err);
    return {
      reply: tr(
        lang,
        "Vertel me wat voor huid je hebt en waar je hulp bij wilt, dan help ik je de juiste match te vinden.",
        "Tell me your skin type and main goal, and I'll help you find the right match."
      ),
      actions: [],
      lang,
    };
  }
}

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
    const userTimeline = [...userHistory, message].slice(-16);
    const combinedUserText = userTimeline.join(" \n ");
    const lang = detectLanguage(message, combinedUserText, forcedLang);

    const conversationIntent = detectConversationIntent(message);
    const shouldUseConversationIntent =
      isShortMessage(message) &&
      !detectSkinType(combinedUserText) &&
      !detectGoal(combinedUserText) &&
      !findMentionedProducts(message).length &&
      !findMentionedBundles(message).length &&
      !detectCompareRequest(message) &&
      !detectSuitabilityRequest(message);

    if (shouldUseConversationIntent) {
      const conversationReply = buildConversationReply(conversationIntent, lang);
      if (conversationReply) {
        return new Response(
          JSON.stringify({ reply: conversationReply, actions: [], lang }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    if (detectQuizRequest(message)) {
      const quizOut = buildQuizRedirectReply(lang);
      return new Response(
        JSON.stringify(quizOut),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (detectNoAcne(message)) {
      return new Response(
        JSON.stringify({
          reply: tr(
            lang,
            "Snap ik. Dan is Acne Spot Care geen logische match. Waar wil je wél hulp bij: droge huid, meer glow, fijne lijntjes of gewoon een productadvies?",
            "Got it. Then Acne Spot Care is not the right match. What would you like help with instead: hydration, glow, anti-age, or product advice?"
          ),
          actions: [],
          lang,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (detectWhyQuestion(message)) {
      const recentUserText = normalize(combinedUserText);
      const mentionsAcne = hasAny(recentUserText, ["acne", "breakout", "breakouts", "puistjes"]);

      if (mentionsAcne || hasAny(normalize(message), ["acne spot care", "spot care"])) {
        return new Response(
          JSON.stringify({
            reply: tr(
              lang,
              "Die aanbeveling werd waarschijnlijk gekoppeld aan acne of puistjes. Als jij daar geen last van hebt, dan hoort Acne Spot Care er niet bij. Vertel me wat voor huid je hebt en waar je wél hulp bij wilt, dan geef ik een betere match.",
              "That recommendation was probably linked to acne or breakouts. If that is not your concern, then Acne Spot Care should not be part of it. Tell me your skin type and what you'd actually like help with, and I'll give you a better match."
            ),
            actions: [],
            lang,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    if (detectExplicitRoutineSelectionRequest(message)) {
      const quizOut = buildQuizRedirectReply(lang);
      return new Response(
        JSON.stringify(quizOut),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const skinType = detectSkinType(combinedUserText);
    const goal = detectGoal(combinedUserText);

    const mentionedProducts = findMentionedProducts(message);
    const mentionedBundles = findMentionedBundles(message);
    const looseProduct = findProductFromLooseIntent(message);

    if (detectCompareRequest(message)) {
      const compareItems = [...mentionedBundles, ...mentionedProducts].slice(0, 2);
      if (compareItems.length === 2) {
        return new Response(
          JSON.stringify({ reply: buildCompareReply(compareItems, lang), actions: [], lang }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    if (detectSuitabilityRequest(message) && mentionedProducts.length === 1) {
      const product = mentionedProducts[0];

      return new Response(
        JSON.stringify({
          reply:
            lang === "nl"
              ? `**${product.title}**\n\n${shortProductDescription(product.title, lang)}\n\nVertel me wat voor huid je hebt en waar je hulp bij wilt, dan zeg ik of dit goed past.`
              : `**${product.title}**\n\n${shortProductDescription(product.title, lang)}\n\nTell me your skin type and goal, and I'll tell you if it fits.`,
          actions: buildActionsForProduct(product, lang),
          lang,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (
      looseProduct &&
      (normalize(message).includes("where") ||
        normalize(message).includes("waar") ||
        normalize(message).includes("vinden"))
    ) {
      return new Response(
        JSON.stringify({
          reply:
            lang === "nl"
              ? `**${looseProduct.title}**\n\nJe vindt het hier.`
              : `**${looseProduct.title}**\n\nYou can find it here.`,
          actions: buildActionsForProduct(looseProduct, lang),
          lang,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (looseProduct && !skinType && !goal) {
      return new Response(
        JSON.stringify({
          reply: buildProductReply(looseProduct, lang),
          actions: buildActionsForProduct(looseProduct, lang),
          lang,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (mentionedProducts.length === 1 && !goal && !skinType) {
      const product = mentionedProducts[0];
      const bundle = inferBestBundleForProduct(product.title);

      return new Response(
        JSON.stringify({
          reply: bundle
            ? lang === "nl"
              ? `**${product.title}**\n\n${shortProductDescription(product.title, lang)}\n\nAls je ook naar een complete routine wilt kijken, kun je daarnaast onze quiz gebruiken.`
              : `**${product.title}**\n\n${shortProductDescription(product.title, lang)}\n\nIf you'd also like to look at a complete routine, you can use our quiz as well.`
            : buildProductReply(product, lang),
          actions: bundle
            ? [
                ...buildActionsForProduct(product, lang),
                {
                  type: "OPEN_URL" as const,
                  label: lang === "nl" ? "Start de quiz" : "Start quiz",
                  url: QUIZ_URL,
                },
              ].slice(0, 2)
            : buildActionsForProduct(product, lang),
          lang,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (mentionedBundles.length === 1 && !goal && !skinType) {
      const bundle = mentionedBundles[0];
      return new Response(
        JSON.stringify({
          reply: buildBundleReply(bundle, null, lang),
          actions: buildActionsForBundle(bundle, null, lang),
          lang,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (detectSkinType(message) && !goal) {
      return new Response(
        JSON.stringify({
          reply: tr(
            lang,
            "Waar wil je vooral hulp bij: droge huid, meer glow, acne of puistjes, fijne lijntjes of een specifiek product?",
            "What's your main goal: hydration, glow, acne or breakouts, anti-age, or a specific product?"
          ),
          actions: [],
          lang,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const bundle = pickBundle(skinType, goal);
    const addon = detectNoAcne(combinedUserText) && pickAddon(skinType, goal) === "Acne Spot Care"
      ? null
      : pickAddon(skinType, goal);

    if (bundle) {
      return new Response(
        JSON.stringify({
          reply: buildBundleReply(bundle, addon, lang),
          actions: buildActionsForBundle(bundle, addon, lang),
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
