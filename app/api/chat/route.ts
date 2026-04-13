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

function detectLanguage(text: string): Lang {
  const t = normalize(text);

  const dutchSignals = [
    "ik", "mijn", "huid", "droog", "droge", "vette", "vet", "gevoelig",
    "gevoelige", "welke", "wat", "past", "bij", "mij", "puistjes",
    "onzuiverheden", "stralend", "hydratatie", "dagcreme", "dagcrème",
    "nachtcreme", "nachtcrème", "routine", "gezicht", "hulp", "advies",
  ];

  const englishSignals = [
    "my", "skin", "dry", "oily", "sensitive", "which", "what", "routine",
    "fits", "best", "glow", "breakouts", "hydration", "cleanser", "serum",
    "help", "advice", "radiance", "moisture",
  ];

  const nlCount = dutchSignals.filter((w) => t.includes(w)).length;
  const enCount = englishSignals.filter((w) => t.includes(w)).length;

  return nlCount >= enCount ? "nl" : "en";
}

function tr(lang: Lang, nl: string, en: string): string {
  return lang === "nl" ? nl : en;
}

// ─── Detection ──────────────────────────────────────────────────────────────

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
      "puistjes", "puistje", "mee-eters", "mee eters", "verstopte poriën",
      "verstopte pories", "onzuiverheden", "vette huid acne",
    ])
  ) return "breakouts";

  if (
    hasAny(t, [
      "glow", "glowy", "radiance", "radiant", "dull", "bright",
      "brighter", "uneven", "texture", "pores", "fresh look", "more glow",
      "straling", "stralend", "stralende huid", "doffe huid", "dof",
      "egaler", "egale teint", "teint", "frisser",
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
      "anti-aging", "anti aging", "rimpels", "rimpel", "fijne lijntjes",
      "ouder wordende huid", "stevigheid", "verouderende",
    ])
  ) return "antiage";

  if (
    hasAny(t, [
      "simple", "minimal", "easy routine", "no fuss", "no-fuss",
      "basic routine", "easy",
      "simpel", "eenvoudig", "minimaal", "makkelijke routine",
      "geen gedoe", "basiszorg", "basisroutine",
    ])
  ) return "simple";

  return null;
}

function detectRoutineRequest(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "which routine fits me best", "what routine fits me best",
    "best routine for me", "which routine", "what routine",
    "fits me best", "help me choose", "what do you recommend",
    "recommend me a routine", "recommend a routine",
    "welke routine past bij mij", "welke routine", "wat raad je aan",
    "aanbevelen", "beste routine voor mij", "routine advies",
    "wat past bij mijn huid",
  ]);
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
      "help", "can you help me", "what can you do", "how can you help",
      "wat kan je", "wat kun je", "kun je me helpen", "kan je me helpen",
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
      "Hallo! Ik ben de SOVAH skincare assistant. Vertel me je huidtype of huiddoel en ik help je de juiste routine te vinden.",
      "Hello! I'm the SOVAH skincare assistant. Tell me your skin type or skin goal and I'll help you find the right routine."
    );
  }

  if (intent === "thanks") {
    return tr(
      lang,
      "Graag gedaan — veel succes met je skincare routine!",
      "You're welcome — good luck with your skincare routine!"
    );
  }

  if (intent === "bye") {
    return tr(
      lang,
      "Tot snel! Zorg goed voor je huid 🌿",
      "Goodbye! Take care of your skin 🌿"
    );
  }

  if (intent === "help") {
    return tr(
      lang,
      "Ik kan je helpen met het vinden van de juiste routine, producten vergelijken of een match maken op basis van je huidtype en doel. Vertel me iets over je huid.",
      "I can help you find the right routine, compare products, or match your skin type and goal. Tell me a bit about your skin."
    );
  }

  if (intent === "yes") {
    return tr(
      lang,
      "Top. Wat is je huidtype: droog, vet, combinatie, normaal of gevoelig?",
      "Great. What's your skin type: dry, oily, combination, normal, or sensitive?"
    );
  }

  if (intent === "no") {
    return tr(
      lang,
      "Geen probleem. Stuur maar wat je zoekt en ik help je verder.",
      "No problem. Send me what you're looking for and I'll help you."
    );
  }

  if (intent === "confused") {
    return tr(
      lang,
      "Geen probleem. Begin met je huidtype: droog, vet, combinatie, normaal of gevoelig.",
      "That's okay. Start with your skin type: dry, oily, combination, normal, or sensitive."
    );
  }

  if (intent === "unclear") {
    return tr(
      lang,
      "Ik weet nog niet helemaal wat je bedoelt. Wat is je huidtype en wat is je belangrijkste doel?",
      "I'm not fully sure what you mean yet. What's your skin type, and what's your main goal?"
    );
  }

  if (intent === "human_chat") {
    return tr(
      lang,
      "Ja, ik ben er. Ik ben de SOVAH skincare assistant. Vertel me over je huid en ik help je de juiste routine te vinden.",
      "Yes, I'm here. I'm the SOVAH skincare assistant. Tell me about your skin and I'll help you find the right routine."
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
    "AHA Peeling Concentrate": ["aha", "aha peeling", "peeling concentrate"],
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
    "Dry & Dehydrated Skin Routine": "Het beste voor een droge of vochtarme huid die comfort en hydratatie nodig heeft.",
    "Combination Skin Balance Routine": "Het beste voor een gecombineerde huid die balans nodig heeft zonder zwaar aan te voelen.",
    "Simple Daily Skincare Routine": "Het beste voor een makkelijke dagelijkse routine zonder onnodige stappen.",
    "Sensitive & Reactive Skin Routine": "Het beste voor een gevoelige of reactieve huid die een milde routine nodig heeft.",
    "Normal & Balanced Skin Routine": "Het beste voor een normale huid die een simpele gebalanceerde routine wil.",
    "Glow & Radiance Routine": "Het beste voor een doffe of ongelijk ogende huid die meer glow wil.",
    "Firm & Smooth Skin Routine": "Het beste bij eerste tekenen van huidveroudering, gladheid en stevigheid.",
    "Clear & Balanced Skin Routine": "Het beste voor een vette of onzuivere huid die een frisse lichte routine nodig heeft.",
  };

  const mapEn: Record<string, string> = {
    "Dry & Dehydrated Skin Routine": "Best for dry or dehydrated skin that needs comfort and hydration.",
    "Combination Skin Balance Routine": "Best for combination skin that needs balance without feeling heavy.",
    "Simple Daily Skincare Routine": "Best for an easy everyday routine with no unnecessary steps.",
    "Sensitive & Reactive Skin Routine": "Best for sensitive or reactive skin that needs a gentle routine.",
    "Normal & Balanced Skin Routine": "Best for normal skin that wants a simple balanced routine.",
    "Glow & Radiance Routine": "Best for dull or uneven-looking skin that wants more glow.",
    "Firm & Smooth Skin Routine": "Best for early signs of aging, smoothness, and firmness.",
    "Clear & Balanced Skin Routine": "Best for oily or blemish-prone skin that needs a fresh lightweight routine.",
  };

  return lang === "nl"
    ? mapNl[bundleName] || "Een sterke match uit het huidige assortiment."
    : mapEn[bundleName] || "A strong fit from the current range.";
}

function shortAddonDescription(addonName: string, lang: Lang): string {
  const mapNl: Record<string, string> = {
    "AHA Peeling Concentrate": "Een goede extra stap bij textuur of een doffe huid.",
    "Acne Spot Care": "Een goede extra stap voor zichtbare onzuiverheden.",
    "Smoothing Eye Cream": "Een goede extra stap voor de huid rond de ogen.",
  };

  const mapEn: Record<string, string> = {
    "AHA Peeling Concentrate": "A good add-on for texture or dullness.",
    "Acne Spot Care": "A good add-on for visible blemishes.",
    "Smoothing Eye Cream": "A good add-on for the eye area.",
  };

  return lang === "nl" ? mapNl[addonName] || "" : mapEn[addonName] || "";
}

function shortProductDescription(productName: string, lang: Lang): string {
  const mapNl: Record<string, string> = {
    "Micellar Cleansing Water": "Een milde reiniger voor dagelijks gebruik.",
    "Hydrating Toner": "Een hydraterende toner voor comfort en balans.",
    "Hydrating Serum": "Een licht serum voor extra hydratatie.",
    "Double Hydration Boost Gel + HA": "Een hydraterende gel voor een comfortabeler huidgevoel.",
    "Moisturising Day Cream": "Een dagcrème voor dagelijkse hydratatie en comfort.",
    "Ceramide Barrier Night Cream": "Een rijke nachtcrème voor comfort en ondersteuning van de huidbarrière.",
    "Purifying Mousse": "Een schuimende reiniger met een fris en licht gevoel.",
    "Antioxidant Ginkgo Gel Booster": "Een lichte booster voor hydratatie en een frissere uitstraling.",
    "Calming Facial Oil": "Een kalmerende gezichtsolie voor comfort en zachtheid.",
    "AHA Peeling Concentrate": "Een exfoliërende extra stap voor textuur of een doffe huid.",
    "Caffeine Gel Booster": "Een lichte booster voor een frissere uitstraling.",
    "Oil-Free Hydrating Gel": "Een olievrije gel voor lichte dagelijkse hydratatie.",
    "Peptide Anti-Aging Serum": "Een serum voor een gladder ogende huid.",
    "Collagen Boost Serum": "Een serum gericht op stevigheid en comfort.",
    "Anti-Age Day Cream": "Een dagcrème met focus op de eerste tekenen van huidveroudering.",
    "Natural Retinol Alternative Oil Serum": "Een milde olie-serum stap voor een anti-age routine.",
    "Smoothing Eye Cream": "Een oogcrème voor de huid rond de ogen.",
    "Vitamin C Serum": "Een serum voor een frissere en stralendere uitstraling.",
    "Brightening Face&Body Exfoliator with Kojic Acid": "Een exfoliator voor een gladdere en frissere look.",
    "Dark Spot Face Cream with Kojic Acid": "Een crème voor een egaler ogende huid.",
    "All-In-One Facial Oil": "Een voedende gezichtsolie voor glow en comfort.",
    "Sun Protection SPF50 Stick, no tint": "Een SPF50 stick voor makkelijke dagelijkse bescherming.",
    "Acne Spot Care": "Een gerichte spot treatment voor zichtbare onzuiverheden.",
    "Niacinamide Gel Moisturiser": "Een lichte gel moisturiser voor balans en comfort.",
  };

  const mapEn: Record<string, string> = {
    "Micellar Cleansing Water": "A gentle everyday cleanser.",
    "Hydrating Toner": "A hydrating toner for comfort and balance.",
    "Hydrating Serum": "A lightweight serum for extra hydration.",
    "Double Hydration Boost Gel + HA": "A hydrating gel for a more comfortable skin feel.",
    "Moisturising Day Cream": "A day cream for daily hydration and comfort.",
    "Ceramide Barrier Night Cream": "A rich night cream for comfort and barrier support.",
    "Purifying Mousse": "A foaming cleanser with a fresh, lightweight feel.",
    "Antioxidant Ginkgo Gel Booster": "A lightweight booster for hydration and a fresher look.",
    "Calming Facial Oil": "A calming facial oil for comfort and softness.",
    "AHA Peeling Concentrate": "An exfoliating add-on for texture or dullness.",
    "Caffeine Gel Booster": "A lightweight booster for a fresher-looking complexion.",
    "Oil-Free Hydrating Gel": "An oil-free gel for lightweight daily hydration.",
    "Peptide Anti-Aging Serum": "A serum for a smoother-looking complexion.",
    "Collagen Boost Serum": "A serum focused on firmness and comfort.",
    "Anti-Age Day Cream": "A day cream with an early anti-age focus.",
    "Natural Retinol Alternative Oil Serum": "A gentle oil serum for an anti-age routine.",
    "Smoothing Eye Cream": "An eye cream for the eye area.",
    "Vitamin C Serum": "A serum for a fresher and more radiant-looking complexion.",
    "Brightening Face&Body Exfoliator with Kojic Acid": "An exfoliator for a smoother and fresher look.",
    "Dark Spot Face Cream with Kojic Acid": "A cream for a more even-looking complexion.",
    "All-In-One Facial Oil": "A nourishing facial oil for glow and comfort.",
    "Sun Protection SPF50 Stick, no tint": "An SPF50 stick for easy daily protection.",
    "Acne Spot Care": "A targeted spot treatment for visible blemishes.",
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
        ? `Inbegrepen producten:\n${bundle.products.map((p) => `- ${p}`).join("\n")}`
        : `Included products:\n${bundle.products.map((p) => `- ${p}`).join("\n")}`
    );
  }

  if (addonName) {
    parts.push(
      lang === "nl"
        ? `Extra aanrader\n**${addonName}**\n${shortAddonDescription(addonName, lang)}`
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
    ? `**${firstName}** vs **${secondName}**\n\nVertel me je huidtype en belangrijkste doel, dan zeg ik welke beter past.`
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
): Promise<{ reply: string; actions: ChatAction[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return {
      reply: tr(
        lang,
        "Ik weet niet helemaal zeker wat je bedoelt. Vertel me je huidtype en je belangrijkste doel, dan help ik je verder.",
        "I'm not fully sure what you mean. Tell me your skin type and main goal, and I'll help from there."
      ),
      actions: [],
    };
  }

  try {
    const client = new Anthropic({ apiKey });

    const productList = productCatalog.products.map((p) => p.title).join(", ");
    const bundleList = bundleCatalog.bundles.map((b) => b.name).join(", ");

    const systemPrompt = `You are the SOVAH skincare assistant for sovahcare.com.

Your job is to help customers find the right SOVAH routine or product based only on the available SOVAH catalog.

Available bundles: ${bundleList}
Available products: ${productList}

Core rules:
- Always reply in the same language as the customer. If the customer writes in Dutch, reply in Dutch. If the customer writes in English, reply in English.
- Keep replies short, clear, and practical.
- Only recommend bundles and products that exist in the provided SOVAH catalog.
- Never invent products, ingredients, claims, or routines.
- Never mention suppliers, internal systems, or technical limitations.
- Never give medical advice.
- If the customer’s request is unclear, ask at most 1 or 2 short clarifying questions.
- Prefer recommending 1 best-fit routine first. Add at most 1 relevant add-on if useful.
- If the customer mentions a specific product, explain what it is briefly and only suggest a routine if it clearly fits.
- If the customer asks for comparison, explain the difference simply and ask for skin type and goal if needed.
- If the customer asks where to find a product or routine, point them to the correct product or routine URL.
- Tone: premium, warm, concise, practical, human.
- Keep most responses within 2 to 5 lines.
- Never give medical advice.`;

    const messages = [
      {
        role: "user" as const,
        content: history.length
          ? `Previous conversation context:\n${history.join("\n")}\n\nCurrent customer message:\n${message}`
          : message,
      },
    ];

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: systemPrompt,
      messages,
    });

    const text =
      response.content[0]?.type === "text"
        ? response.content[0].text
        : tr(
            lang,
            "Vertel me je huidtype en je belangrijkste doel, dan help ik je de juiste routine te vinden.",
            "Tell me your skin type and main goal, and I'll help you find the right routine."
          );

    return { reply: text, actions: [] };
  } catch (err) {
    console.error("Claude API error:", err);
    return {
      reply: tr(
        lang,
        "Vertel me je huidtype en je belangrijkste doel, dan help ik je de juiste routine te vinden.",
        "Tell me your skin type and main goal, and I'll help you find the right routine."
      ),
      actions: [],
    };
  }
}

export async function POST(req: Request) {
  const corsHeaders = buildCorsHeaders();

  try {
    const body = await req.json();
    const message: string | undefined = body?.message;
    const historyRaw: unknown = body?.history;

    const history: string[] = Array.isArray(historyRaw)
      ? historyRaw.filter((item): item is string => typeof item === "string")
      : [];

    if (!message) {
      return new Response(
        JSON.stringify({ reply: "Missing message.", actions: [] }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const fullHistory = [...history, message].slice(-10);
    const combined = fullHistory.join(" \n ");
    const lang = detectLanguage(combined);

    const conversationIntent = detectConversationIntent(message);
    const conversationReply = buildConversationReply(conversationIntent, lang);
    if (conversationReply) {
      return new Response(
        JSON.stringify({ reply: conversationReply, actions: [] }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const wantsRoutine = fullHistory.some((m) => detectRoutineRequest(m));
    const skinType = detectSkinType(combined);
    const goal = detectGoal(combined);

    const mentionedProducts = findMentionedProducts(combined);
    const mentionedBundles = findMentionedBundles(combined);
    const looseProduct = findProductFromLooseIntent(message);

    if (detectCompareRequest(message)) {
      const compareItems = [...mentionedBundles, ...mentionedProducts].slice(0, 2);
      if (compareItems.length === 2) {
        return new Response(
          JSON.stringify({ reply: buildCompareReply(compareItems, lang), actions: [] }),
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
              ? `**${product.title}**\n\n${shortProductDescription(product.title, lang)}\n\nVertel me je huidtype en doel, dan zeg ik of dit goed past.`
              : `**${product.title}**\n\n${shortProductDescription(product.title, lang)}\n\nTell me your skin type and goal, and I'll tell you if it fits.`,
          actions: buildActionsForProduct(product, lang),
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
              ? `**${looseProduct.title}**\n\nJe vindt dit hier.`
              : `**${looseProduct.title}**\n\nYou can find it here.`,
          actions: buildActionsForProduct(looseProduct, lang),
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (looseProduct && !wantsRoutine && !skinType && !goal) {
      return new Response(
        JSON.stringify({
          reply: buildProductReply(looseProduct, lang),
          actions: buildActionsForProduct(looseProduct, lang),
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (mentionedProducts.length === 1 && !wantsRoutine && !goal && !skinType) {
      const product = mentionedProducts[0];
      const bundle = inferBestBundleForProduct(product.title);

      return new Response(
        JSON.stringify({
          reply: bundle
            ? lang === "nl"
              ? `**${product.title}**\n\n${shortProductDescription(product.title, lang)}\n\nAls je de volledige routine wilt, dan is **${bundle.name}** de beste match.`
              : `**${product.title}**\n\n${shortProductDescription(product.title, lang)}\n\nIf you want the fuller routine, **${bundle.name}** is the closest match.`
            : buildProductReply(product, lang),
          actions: bundle
            ? [
                ...buildActionsForProduct(product, lang),
                {
                  type: "OPEN_URL" as const,
                  label: lang === "nl" ? "Bekijk routine" : "View routine",
                  url: bundle.url,
                },
              ].slice(0, 2)
            : buildActionsForProduct(product, lang),
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (mentionedBundles.length === 1 && !goal && !skinType && !wantsRoutine) {
      const bundle = mentionedBundles[0];
      return new Response(
        JSON.stringify({
          reply: buildBundleReply(bundle, null, lang),
          actions: buildActionsForBundle(bundle, null, lang),
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (wantsRoutine && !skinType) {
      return new Response(
        JSON.stringify({
          reply: tr(
            lang,
            "Wat is je huidtype: droog, vet, combinatie, normaal of gevoelig?",
            "What's your skin type: dry, oily, combination, normal, or sensitive?"
          ),
          actions: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (wantsRoutine && skinType && !goal) {
      return new Response(
        JSON.stringify({
          reply: tr(
            lang,
            "Wat is je belangrijkste doel: hydratatie, glow, anti-age, onzuiverheden of een simpele routine?",
            "What's your main goal: hydration, glow, anti-age, breakouts, or a simple routine?"
          ),
          actions: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (goal === "breakouts" && !skinType) {
      return new Response(
        JSON.stringify({
          reply: tr(
            lang,
            "Wat is je huidtype: vet, combinatie, droog, normaal of gevoelig?",
            "What's your skin type: oily, combination, dry, normal, or sensitive?"
          ),
          actions: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!wantsRoutine && detectSkinType(message) && !goal) {
      return new Response(
        JSON.stringify({
          reply: tr(
            lang,
            "Wat is je belangrijkste doel: hydratatie, glow, anti-age, onzuiverheden of een simpele routine?",
            "What's your main goal: hydration, glow, anti-age, breakouts, or a simple routine?"
          ),
          actions: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const bundle = pickBundle(skinType, goal);
    const addon = pickAddon(skinType, goal);

    if (bundle) {
      return new Response(
        JSON.stringify({
          reply: buildBundleReply(bundle, addon, lang),
          actions: buildActionsForBundle(bundle, addon, lang),
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const claudeOut = await callClaudeFallback(message, history, lang);

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
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
}
