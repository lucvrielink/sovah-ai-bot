export type Lang = "nl" | "en";
export type SkinType = "dry" | "oily" | "combination" | "normal" | "sensitive" | "unknown";
export type Concern =
  | "dryness"
  | "breakouts"
  | "sensitivity"
  | "glow"
  | "dark_spots"
  | "antiage"
  | "unknown";
export type Goal = "hydration" | "calm" | "glow" | "even" | "firm" | "simple" | "unknown";
export type RoutinePreference = "simple" | "balanced" | "results" | "unknown";
export type SensitivityLevel = "high" | "medium" | "low" | "unknown";

export type QuizAnswers = {
  lang: Lang;
  skinType: SkinType;
  concern: Concern;
  sensitivityLevel: SensitivityLevel;
  goal: Goal;
  routinePreference: RoutinePreference;
};

type Bundle = {
  name: string;
  handle: string;
  url: string;
  variantId: number;
  description: string;
  products: string[];
};

type Addon = {
  title: string;
  handle: string;
  url: string;
  variantId: number;
};

type RecommendationResult = {
  lang: Lang;
  recommendedBundle: Bundle;
  addon: Addon | null;
  reasonShort: string;
  reasonLong: string;
  steps: string[];
};

const VARIANT_IDS = {
  products: {
    "Micellar Cleansing Water": 51851602854226,
    "Hydrating Toner": 51881462956370,
    "Hydrating Serum": 51886996390226,
    "Double Hydration Boost Gel + HA": 51887105278290,
    "Moisturising Day Cream": 51887248539986,
    "Ceramide Barrier Night Cream": 51887297593682,
    "Purifying Mousse": 51900553560402,
    "Antioxidant Ginkgo Gel Booster": 51900617851218,
    "Calming Facial Oil": 51900798566738,
    "AHA Peeling Concentrate": 51900930589010,
    "Caffeine Gel Booster": 51901220454738,
    "Oil-Free Hydrating Gel": 51901284352338,
    "Peptide Anti-Aging Serum": 51929446154578,
    "Collagen Boost Serum": 51929475711314,
    "Anti-Age Day Cream": 51929503367506,
    "Natural Retinol Alternative Oil Serum": 51929571393874,
    "Smoothing Eye Cream": 51929683329362,
    "Vitamin C Serum": 51930475528530,
    "Brightening Face&Body Exfoliator with Kojic Acid": 51930578714962,
    "Dark Spot Face Cream with Kojic Acid": 51930733216082,
    "All-In-One Facial Oil": 51930909180242,
    "Sun Protection SPF50 Stick, no tint": 51952704848210,
    "Acne Spot Care": 51984072966482,
    "Niacinamide Gel Moisturiser": 51984073851218,
  },
  routines: {
    "Dry & Dehydrated Skin Routine": 52332020433234,
    "Sensitive & Reactive Skin Routine": 52332074074450,
    "Clear & Balanced Skin Routine": 52332389204306,
    "Combination Skin Balance Routine": 52332448809298,
    "Glow & Radiance Routine": 52332474302802,
    "Firm & Smooth Skin Routine": 52332494487890,
    "Simple Daily Skincare Routine": 52332514246994,
    "Normal & Balanced Skin Routine": 52435433292114,
  },
} as const;

const BUNDLES: Record<string, Bundle> = {
  dry: {
    name: "Dry & Dehydrated Skin Routine",
    handle: "dry-dehydrated-skin-routine",
    url: "/products/dry-dehydrated-skin-routine",
    variantId: VARIANT_IDS.routines["Dry & Dehydrated Skin Routine"],
    description: "A hydration-focused routine for skin that feels dry, tight, or dehydrated.",
    products: [
      "Micellar Cleansing Water",
      "Hydrating Toner",
      "Hydrating Serum",
      "Double Hydration Boost Gel + HA",
      "Moisturising Day Cream",
      "Ceramide Barrier Night Cream",
    ],
  },
  sensitive: {
    name: "Sensitive & Reactive Skin Routine",
    handle: "sensitive-reactive-skin-routine",
    url: "/products/sensitive-reactive-skin-routine",
    variantId: VARIANT_IDS.routines["Sensitive & Reactive Skin Routine"],
    description: "A gentle routine for skin that reacts easily and needs a calmer approach.",
    products: [
      "Micellar Cleansing Water",
      "Hydrating Toner",
      "Hydrating Serum",
      "Moisturising Day Cream",
      "Ceramide Barrier Night Cream",
      "Calming Facial Oil",
    ],
  },
  clear: {
    name: "Clear & Balanced Skin Routine",
    handle: "clear-balanced-skin-routine",
    url: "/products/clear-balanced-skin-routine",
    variantId: VARIANT_IDS.routines["Clear & Balanced Skin Routine"],
    description: "A balancing routine for blemish-prone skin that wants clarity without overdoing it.",
    products: [
      "Purifying Mousse",
      "Hydrating Toner",
      "Niacinamide Gel Moisturiser",
      "Oil-Free Hydrating Gel",
    ],
  },
  combination: {
    name: "Combination Skin Balance Routine",
    handle: "combination-skin-balance-routine",
    url: "/products/combination-skin-balance-routine",
    variantId: VARIANT_IDS.routines["Combination Skin Balance Routine"],
    description: "A routine for skin that needs balance between oilier and drier areas.",
    products: [
      "Purifying Mousse",
      "Hydrating Toner",
      "Hydrating Serum",
      "Niacinamide Gel Moisturiser",
      "Oil-Free Hydrating Gel",
    ],
  },
  glow: {
    name: "Glow & Radiance Routine",
    handle: "glow-radiance-routine",
    url: "/products/glow-radiance-routine",
    variantId: VARIANT_IDS.routines["Glow & Radiance Routine"],
    description: "A routine for dull skin that needs more radiance and a fresher-looking finish.",
    products: [
      "Micellar Cleansing Water",
      "Hydrating Toner",
      "Vitamin C Serum",
      "Antioxidant Ginkgo Gel Booster",
      "Moisturising Day Cream",
    ],
  },
  firm: {
    name: "Firm & Smooth Skin Routine",
    handle: "firm-smooth-skin-routine",
    url: "/products/firm-smooth-skin-routine",
    variantId: VARIANT_IDS.routines["Firm & Smooth Skin Routine"],
    description: "A more targeted routine focused on smoother- and firmer-looking skin.",
    products: [
      "Hydrating Toner",
      "Peptide Anti-Aging Serum",
      "Collagen Boost Serum",
      "Anti-Age Day Cream",
      "Natural Retinol Alternative Oil Serum",
      "Smoothing Eye Cream",
    ],
  },
  simple: {
    name: "Simple Daily Skincare Routine",
    handle: "simple-daily-skincare-routine",
    url: "/products/simple-daily-skincare-routine",
    variantId: VARIANT_IDS.routines["Simple Daily Skincare Routine"],
    description: "A simple everyday routine that keeps things easy and effective.",
    products: [
      "Micellar Cleansing Water",
      "Hydrating Toner",
      "Moisturising Day Cream",
    ],
  },
  normal: {
    name: "Normal & Balanced Skin Routine",
    handle: "normal-balanced-skin-routine",
    url: "/products/normal-balanced-skin-routine",
    variantId: VARIANT_IDS.routines["Normal & Balanced Skin Routine"],
    description: "A balanced routine for skin that feels fairly stable and wants daily support.",
    products: [
      "Micellar Cleansing Water",
      "Hydrating Toner",
      "Hydrating Serum",
      "Moisturising Day Cream",
    ],
  },
};

const ADDONS: Record<string, Addon> = {
  acne: {
    title: "Acne Spot Care",
    handle: "acne-spot-care",
    url: "/products/acne-spot-care",
    variantId: VARIANT_IDS.products["Acne Spot Care"],
  },
  aha: {
    title: "AHA Peeling Concentrate",
    handle: "aha-peeling-concentrate",
    url: "/products/aha-peeling-concentrate",
    variantId: VARIANT_IDS.products["AHA Peeling Concentrate"],
  },
  vitaminC: {
    title: "Vitamin C Serum",
    handle: "vitamin-c-serum",
    url: "/products/vitamin-c-serum",
    variantId: VARIANT_IDS.products["Vitamin C Serum"],
  },
  kojicExfoliator: {
    title: "Brightening Face&Body Exfoliator with Kojic Acid",
    handle: "brightening-face-body-exfoliator-with-kojic-acid",
    url: "/products/brightening-face-body-exfoliator-with-kojic-acid",
    variantId: VARIANT_IDS.products["Brightening Face&Body Exfoliator with Kojic Acid"],
  },
  kojicCream: {
    title: "Dark Spot Face Cream with Kojic Acid",
    handle: "dark-spot-face-cream-with-kojic-acid",
    url: "/products/dark-spot-face-cream-with-kojic-acid",
    variantId: VARIANT_IDS.products["Dark Spot Face Cream with Kojic Acid"],
  },
  calmingOil: {
    title: "Calming Facial Oil",
    handle: "calming-facial-oil",
    url: "/products/calming-facial-oil",
    variantId: VARIANT_IDS.products["Calming Facial Oil"],
  },
};

function getLocalizedReasonShort(lang: Lang, bundle: Bundle): string {
  if (lang === "nl") {
    switch (bundle.name) {
      case "Dry & Dehydrated Skin Routine":
        return "Deze routine past het best bij een huid die vocht, comfort en herstel nodig heeft.";
      case "Sensitive & Reactive Skin Routine":
        return "Deze routine past het best bij een gevoelige huid die snel reageert en rust nodig heeft.";
      case "Clear & Balanced Skin Routine":
        return "Deze routine past het best bij een huid met acne, puistjes of onzuiverheden die in balans moet komen.";
      case "Combination Skin Balance Routine":
        return "Deze routine past het best bij een gecombineerde huid die balans zoekt tussen vettere en drogere zones.";
      case "Glow & Radiance Routine":
        return "Deze routine past het best bij een doffere huid die meer glow en frisheid kan gebruiken.";
      case "Firm & Smooth Skin Routine":
        return "Deze routine past het best bij een huid die meer focus wil op stevigheid en een gladdere uitstraling.";
      case "Simple Daily Skincare Routine":
        return "Deze routine past het best als je het graag simpel en duidelijk houdt.";
      default:
        return "Deze routine past het best bij een huid die vooral balans en dagelijkse ondersteuning nodig heeft.";
    }
  }

  switch (bundle.name) {
    case "Dry & Dehydrated Skin Routine":
      return "This routine is the best match for skin that needs hydration, comfort, and support.";
    case "Sensitive & Reactive Skin Routine":
      return "This routine is the best match for skin that reacts easily and needs a gentler approach.";
    case "Clear & Balanced Skin Routine":
      return "This routine is the best match for skin dealing with acne, breakouts, or clogged areas.";
    case "Combination Skin Balance Routine":
      return "This routine is the best match for skin that needs balance across oilier and drier areas.";
    case "Glow & Radiance Routine":
      return "This routine is the best match for skin that looks dull and could use more radiance.";
    case "Firm & Smooth Skin Routine":
      return "This routine is the best match for skin focused on smoother- and firmer-looking results.";
    case "Simple Daily Skincare Routine":
      return "This routine is the best match if you want to keep things simple and easy to maintain.";
    default:
      return "This routine is the best match for skin that mainly needs balance and daily support.";
  }
}

function getLocalizedReasonLong(lang: Lang, bundle: Bundle, addon: Addon | null): string {
  if (lang === "nl") {
    return addon
      ? `${bundle.name} sluit het best aan op je antwoorden. ${addon.title} is toegevoegd als extra stap waar dat logisch is.`
      : `${bundle.name} sluit het best aan op je antwoorden en houdt je routine duidelijk en passend.`;
  }

  return addon
    ? `${bundle.name} is the best fit for your answers. ${addon.title} is included as an extra step where it makes sense.`
    : `${bundle.name} is the best fit for your answers and keeps your routine clear and relevant.`;
}

function getLocalizedSteps(lang: Lang, bundle: Bundle, addon: Addon | null): string[] {
  const cleanser = bundle.products.find((p) =>
    ["Micellar Cleansing Water", "Purifying Mousse"].includes(p)
  );
  const toner = bundle.products.find((p) => p === "Hydrating Toner");
  const dayCream = bundle.products.find((p) =>
    ["Moisturising Day Cream", "Anti-Age Day Cream", "Oil-Free Hydrating Gel", "Niacinamide Gel Moisturiser"].includes(p)
  );
  const nightCream = bundle.products.find((p) => p === "Ceramide Barrier Night Cream");
  const serums = bundle.products.filter((p) =>
    ![cleanser, toner, dayCream, nightCream].includes(p as string)
  );

  if (lang === "nl") {
    const steps: string[] = [];

    if (cleanser) steps.push(`Begin met ${cleanser} om je huid te reinigen.`);
    if (toner) steps.push(`Gebruik daarna ${toner} als frisse voorbereidende stap.`);
    if (serums.length) steps.push(`Breng daarna één of meer gerichte stappen aan, zoals ${serums.join(", ")}.`);
    if (dayCream) steps.push(`Sluit overdag af met ${dayCream}.`);
    if (nightCream) steps.push(`Gebruik in de avond ${nightCream} als voedende afsluiting.`);
    if (addon) {
      if (addon.title === "Acne Spot Care") {
        steps.push(`Gebruik ${addon.title} alleen plaatselijk waar nodig.`);
      } else if (addon.title === "AHA Peeling Concentrate") {
        steps.push(`Gebruik ${addon.title} als extra stap in de avond en bouw rustig op.`);
      } else {
        steps.push(`Voeg ${addon.title} toe als extra stap waar dat past binnen je routine.`);
      }
    }

    return steps;
  }

  const steps: string[] = [];

  if (cleanser) steps.push(`Start with ${cleanser} to cleanse the skin.`);
  if (toner) steps.push(`Follow with ${toner} as a fresh prep step.`);
  if (serums.length) steps.push(`Then apply one or more targeted steps such as ${serums.join(", ")}.`);
  if (dayCream) steps.push(`Finish with ${dayCream} during the day.`);
  if (nightCream) steps.push(`Use ${nightCream} in the evening as a nourishing final step.`);
  if (addon) {
    if (addon.title === "Acne Spot Care") {
      steps.push(`Use ${addon.title} only on targeted areas when needed.`);
    } else if (addon.title === "AHA Peeling Concentrate") {
      steps.push(`Use ${addon.title} as an extra evening step and build up gradually.`);
    } else {
      steps.push(`Add ${addon.title} as an extra step where it fits your routine.`);
    }
  }

  return steps;
}

function chooseBundle(answers: QuizAnswers): Bundle {
  const { skinType, concern, goal, sensitivityLevel, routinePreference } = answers;

  if (routinePreference === "simple" || goal === "simple") {
    return BUNDLES.simple;
  }

  if (concern === "breakouts") {
    if (skinType === "combination") return BUNDLES.combination;
    return BUNDLES.clear;
  }

  if (concern === "sensitivity" || skinType === "sensitive" || sensitivityLevel === "high") {
    return BUNDLES.sensitive;
  }

  if (concern === "dryness" || skinType === "dry" || goal === "hydration") {
    return BUNDLES.dry;
  }

  if (concern === "glow" || goal === "glow") {
    return BUNDLES.glow;
  }

  if (concern === "dark_spots" || goal === "even") {
    return BUNDLES.glow;
  }

  if (concern === "antiage" || goal === "firm") {
    return BUNDLES.firm;
  }

  if (skinType === "combination" || skinType === "oily") {
    return BUNDLES.combination;
  }

  if (skinType === "normal") {
    return BUNDLES.normal;
  }

  return BUNDLES.normal;
}

function chooseAddon(answers: QuizAnswers, bundle: Bundle): Addon | null {
  const { concern, sensitivityLevel, goal } = answers;

  if (concern === "breakouts") {
    return ADDONS.acne;
  }

  if (concern === "dark_spots") {
    return sensitivityLevel === "high" ? ADDONS.kojicCream : ADDONS.kojicExfoliator;
  }

  if (goal === "even") {
    return sensitivityLevel === "high" ? ADDONS.kojicCream : ADDONS.kojicExfoliator;
  }

  if (concern === "glow" && bundle.name !== "Glow & Radiance Routine") {
    return ADDONS.vitaminC;
  }

  if (bundle.name === "Sensitive & Reactive Skin Routine" && sensitivityLevel !== "low") {
    return ADDONS.calmingOil;
  }

  if (
    (bundle.name === "Glow & Radiance Routine" || bundle.name === "Firm & Smooth Skin Routine") &&
    sensitivityLevel === "low"
  ) {
    return ADDONS.aha;
  }

  return null;
}

export function getQuizRecommendation(answers: QuizAnswers): RecommendationResult {
  const recommendedBundle = chooseBundle(answers);
  const addon = chooseAddon(answers, recommendedBundle);

  return {
    lang: answers.lang,
    recommendedBundle,
    addon,
    reasonShort: getLocalizedReasonShort(answers.lang, recommendedBundle),
    reasonLong: getLocalizedReasonLong(answers.lang, recommendedBundle, addon),
    steps: getLocalizedSteps(answers.lang, recommendedBundle, addon),
  };
}
