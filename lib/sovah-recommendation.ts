import fs from "fs";
import path from "path";

export type Lang = "nl" | "en";

export type SkinType =
  | "dry"
  | "oily"
  | "combination"
  | "normal"
  | "sensitive"
  | "unknown";

export type Concern =
  | "dryness"
  | "breakouts"
  | "sensitivity"
  | "glow"
  | "dark_spots"
  | "antiage"
  | "unknown";

export type Goal =
  | "hydration"
  | "calm"
  | "glow"
  | "even"
  | "firm"
  | "simple"
  | "unknown";

export type RoutinePreference = "simple" | "balanced" | "results" | "unknown";

export type QuizAnswers = {
  lang?: Lang;
  skinType?: SkinType;
  concern?: Concern;
  sensitivityLevel?: "high" | "medium" | "low" | "unknown";
  goal?: Goal;
  routinePreference?: RoutinePreference;
};

export type Bundle = {
  name: string;
  url: string;
  description?: string;
  products?: string[];
};

export type Product = {
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

export type QuizRecommendation = {
  lang: Lang;
  recommendedBundle: Bundle;
  addon: Product | null;
  reasonShort: string;
  reasonLong: string;
  steps: string[];
};

const bundlesPath = path.join(process.cwd(), "data", "bundle_catalog.json");
const productsPath = path.join(process.cwd(), "data", "product_catalog.json");

const bundleCatalog: BundleCatalog = JSON.parse(fs.readFileSync(bundlesPath, "utf8"));
const productCatalog: ProductCatalog = JSON.parse(fs.readFileSync(productsPath, "utf8"));

function tr(lang: Lang, nl: string, en: string): string {
  return lang === "nl" ? nl : en;
}

function getBundleByName(name: string): Bundle {
  const found = bundleCatalog.bundles.find((b) => b.name === name);
  if (!found) {
    throw new Error(`Bundle not found: ${name}`);
  }
  return found;
}

function getProductByName(name: string): Product | null {
  return productCatalog.products.find((p) => p.title === name) || null;
}

function pushScore(
  scores: Record<string, number>,
  bundleName: string,
  value: number
) {
  scores[bundleName] = (scores[bundleName] || 0) + value;
}

function pickHighestScore(scores: Record<string, number>): string {
  const entries = Object.entries(scores);
  if (!entries.length) return "Simple Daily Skincare Routine";

  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

function buildReason(
  lang: Lang,
  answers: QuizAnswers,
  bundleName: string,
  addonName: string | null
) {
  const concernText = {
    nl: {
      dryness: "droogte en hydratatie",
      breakouts: "puistjes of acne",
      sensitivity: "gevoeligheid en roodheid",
      glow: "een doffe huid en meer glow",
      dark_spots: "een egalere huid",
      antiage: "een gladdere en stevigere huid",
      unknown: "je dagelijkse huidbalans",
    },
    en: {
      dryness: "dryness and hydration",
      breakouts: "breakouts or acne",
      sensitivity: "sensitivity and redness",
      glow: "dullness and more glow",
      dark_spots: "a more even-looking complexion",
      antiage: "smoother- and firmer-looking skin",
      unknown: "your daily skin balance",
    },
  };

  const goalText = {
    nl: {
      hydration: "meer hydratatie",
      calm: "een rustigere huid",
      glow: "meer glow",
      even: "een egalere uitstraling",
      firm: "een gladdere en stevigere uitstraling",
      simple: "een simpele routine",
      unknown: "een routine die goed past",
    },
    en: {
      hydration: "more hydration",
      calm: "calmer-looking skin",
      glow: "more glow",
      even: "a more even-looking complexion",
      firm: "a smoother- and firmer-looking look",
      simple: "a simple routine",
      unknown: "a routine that fits well",
    },
  };

  const short = tr(
    lang,
    `Deze routine past het best bij jouw antwoorden.`,
    `This routine is the best match based on your answers.`
  );

  const long = tr(
    lang,
    `Op basis van je antwoorden lijkt jouw huid vooral behoefte te hebben aan ${concernText.nl[answers.concern || "unknown"]} en ${goalText.nl[answers.goal || "unknown"]}. Daarom past ${bundleName} hier het best bij.${addonName ? ` Als extra stap sluit ${addonName} daar logisch op aan.` : ""}`,
    `Based on your answers, your skin seems to need help mainly with ${concernText.en[answers.concern || "unknown"]} and ${goalText.en[answers.goal || "unknown"]}. That is why ${bundleName} is the best fit here.${addonName ? ` As an extra step, ${addonName} complements it well.` : ""}`
  );

  return { short, long };
}

function buildSteps(lang: Lang, bundleName: string): string[] {
  const genericNl = [
    "Reinig je huid zacht.",
    "Breng daarna je treatment of serum aan.",
    "Sluit af met hydratatie en dagelijkse verzorging.",
  ];

  const genericEn = [
    "Cleanse your skin gently.",
    "Apply your treatment or serum next.",
    "Finish with hydration and daily care.",
  ];

  const specific: Record<string, { nl: string[]; en: string[] }> = {
    "Clear & Balanced Skin Routine": {
      nl: [
        "Reinig je huid zonder haar uit te drogen.",
        "Gebruik producten die helpen om je huid in balans te houden.",
        "Gebruik de extra stap lokaal waar nodig.",
      ],
      en: [
        "Cleanse your skin without stripping it.",
        "Use products that help keep your skin balanced.",
        "Use the add-on locally where needed.",
      ],
    },
    "Dry & Dehydrated Skin Routine": {
      nl: [
        "Begin met een milde reiniging.",
        "Werk daarna in hydraterende lagen.",
        "Sluit af met producten die comfort en voeding geven.",
      ],
      en: [
        "Start with a gentle cleanse.",
        "Layer hydration next.",
        "Finish with products that give comfort and nourishment.",
      ],
    },
    "Sensitive & Reactive Skin Routine": {
      nl: [
        "Houd je routine mild en rustig.",
        "Kies voor comfort en hydratatie zonder onnodige drukte.",
        "Bouw een stabiele dagelijkse basis op.",
      ],
      en: [
        "Keep your routine gentle and calm.",
        "Focus on comfort and hydration without unnecessary extra steps.",
        "Build a stable daily base.",
      ],
    },
  };

  const match = specific[bundleName];
  if (match) return lang === "nl" ? match.nl : match.en;
  return lang === "nl" ? genericNl : genericEn;
}

function chooseAddon(
  answers: QuizAnswers,
  bundleName: string
): string | null {
  if (answers.concern === "breakouts") return "Acne Spot Care";
  if (answers.concern === "glow" && answers.sensitivityLevel !== "high") {
    return "AHA Peeling Concentrate";
  }
  if (answers.concern === "dryness" || answers.goal === "hydration") {
    return "Double Hydration Boost Gel + HA";
  }
  if (answers.concern === "antiage" || answers.goal === "firm") {
    return "Smoothing Eye Cream";
  }
  if (answers.concern === "dark_spots" || answers.goal === "even") {
    return "Vitamin C Serum";
  }

  if (bundleName === "Glow & Radiance Routine") return "Vitamin C Serum";
  return null;
}

export function getQuizRecommendation(
  input: QuizAnswers
): QuizRecommendation {
  const lang: Lang = input.lang === "nl" ? "nl" : "en";

  const scores: Record<string, number> = {
    "Dry & Dehydrated Skin Routine": 0,
    "Combination Skin Balance Routine": 0,
    "Simple Daily Skincare Routine": 0,
    "Sensitive & Reactive Skin Routine": 0,
    "Normal & Balanced Skin Routine": 0,
    "Glow & Radiance Routine": 0,
    "Firm & Smooth Skin Routine": 0,
    "Clear & Balanced Skin Routine": 0,
  };

  switch (input.skinType) {
    case "dry":
      pushScore(scores, "Dry & Dehydrated Skin Routine", 4);
      pushScore(scores, "Sensitive & Reactive Skin Routine", 1);
      break;
    case "oily":
      pushScore(scores, "Clear & Balanced Skin Routine", 4);
      pushScore(scores, "Combination Skin Balance Routine", 2);
      break;
    case "combination":
      pushScore(scores, "Combination Skin Balance Routine", 4);
      pushScore(scores, "Clear & Balanced Skin Routine", 1);
      break;
    case "sensitive":
      pushScore(scores, "Sensitive & Reactive Skin Routine", 5);
      pushScore(scores, "Dry & Dehydrated Skin Routine", 1);
      break;
    case "normal":
      pushScore(scores, "Normal & Balanced Skin Routine", 4);
      pushScore(scores, "Simple Daily Skincare Routine", 1);
      break;
    default:
      pushScore(scores, "Simple Daily Skincare Routine", 1);
      break;
  }

  switch (input.concern) {
    case "dryness":
      pushScore(scores, "Dry & Dehydrated Skin Routine", 5);
      break;
    case "breakouts":
      pushScore(scores, "Clear & Balanced Skin Routine", 6);
      if (input.sensitivityLevel === "high") {
        pushScore(scores, "Sensitive & Reactive Skin Routine", 2);
      }
      break;
    case "sensitivity":
      pushScore(scores, "Sensitive & Reactive Skin Routine", 6);
      break;
    case "glow":
      pushScore(scores, "Glow & Radiance Routine", 5);
      break;
    case "dark_spots":
      pushScore(scores, "Glow & Radiance Routine", 4);
      break;
    case "antiage":
      pushScore(scores, "Firm & Smooth Skin Routine", 6);
      break;
    default:
      break;
  }

  switch (input.goal) {
    case "hydration":
      pushScore(scores, "Dry & Dehydrated Skin Routine", 4);
      break;
    case "calm":
      pushScore(scores, "Sensitive & Reactive Skin Routine", 4);
      break;
    case "glow":
      pushScore(scores, "Glow & Radiance Routine", 4);
      break;
    case "even":
      pushScore(scores, "Glow & Radiance Routine", 3);
      break;
    case "firm":
      pushScore(scores, "Firm & Smooth Skin Routine", 4);
      break;
    case "simple":
      pushScore(scores, "Simple Daily Skincare Routine", 4);
      break;
    default:
      break;
  }

  switch (input.routinePreference) {
    case "simple":
      pushScore(scores, "Simple Daily Skincare Routine", 4);
      pushScore(scores, "Sensitive & Reactive Skin Routine", 1);
      break;
    case "balanced":
      pushScore(scores, "Normal & Balanced Skin Routine", 2);
      pushScore(scores, "Combination Skin Balance Routine", 2);
      break;
    case "results":
      pushScore(scores, "Glow & Radiance Routine", 2);
      pushScore(scores, "Firm & Smooth Skin Routine", 2);
      pushScore(scores, "Clear & Balanced Skin Routine", 2);
      break;
    default:
      break;
  }

  if (input.sensitivityLevel === "high") {
    pushScore(scores, "Sensitive & Reactive Skin Routine", 3);
    pushScore(scores, "Glow & Radiance Routine", -1);
  }

  const bundleName = pickHighestScore(scores);
  const addonName = chooseAddon(input, bundleName);

  const bundle = getBundleByName(bundleName);
  const addon = addonName ? getProductByName(addonName) : null;

  const reason = buildReason(lang, input, bundleName, addonName);
  const steps = buildSteps(lang, bundleName);

  return {
    lang,
    recommendedBundle: bundle,
    addon,
    reasonShort: reason.short,
    reasonLong: reason.long,
    steps,
  };
}
