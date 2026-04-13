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

export type RoutinePreference =
  | "simple"
  | "balanced"
  | "results"
  | "unknown";

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
  image: string;
  description: string;
  products: string[];
};

type Addon = {
  title: string;
  handle: string;
  url: string;
  variantId: number;
  image: string;
  description: string;
};

type RecommendationResult = {
  lang: Lang;
  recommendedBundle: Bundle;
  addon: Addon | null;
  reasonShort: string;
  reasonLong: string;
  steps: string[];
};

const PRODUCT_DATA = {
  "Micellar Cleansing Water": {
    variantId: 51851602854226,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Micellar-Cleansing-Water-vegan-organic-certified.jpg?v=1775136796",
  },
  "Hydrating Toner": {
    variantId: 51881462956370,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Hydrating-Toner-fragrance-free-vegan.jpg?v=1775136707",
  },
  "Hydrating Serum": {
    variantId: 51886996390226,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Hydrating-Serum-vegan-natural-certified.jpg?v=1775136609",
  },
  "Double Hydration Boost Gel + HA": {
    variantId: 51887105278290,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Double-Hydration-Boost-Gel-HA-natural-certified.jpg?v=1775136519",
  },
  "Moisturising Day Cream": {
    variantId: 51887248539986,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Moisturising-Day-Cream-hyaluronic-moisturizer.jpg?v=1775136917",
  },
  "Ceramide Barrier Night Cream": {
    variantId: 51887297593682,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Ceramide-Barrier-Night-Cream-barrier-repair-moisturizer_54139ef5-7701-4007-afb4-adb7140f7dd7.jpg?v=1775136179",
  },
  "Purifying Mousse": {
    variantId: 51900553560402,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Purifying-Mousse-gluten-free-nut-free-vegan-natural-certified.jpg?v=1775137464",
  },
  "Antioxidant Ginkgo Gel Booster": {
    variantId: 51900617851218,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Antioxidant-Ginkgo-Gel-Booster-hydrating-gel-serum.jpg?v=1775135203",
  },
  "Calming Facial Oil": {
    variantId: 51900798566738,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Calming-Facial-Oil-nourishing-face-oil.jpg?v=1775135603",
  },
  "AHA Peeling Concentrate": {
    variantId: 51900930589010,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-AHA-Peeling-Concentrate-exfoliating-face-serum.jpg?v=1775134637",
  },
  "Caffeine Gel Booster": {
    variantId: 51901220454738,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Caffeine-Gel-Booster-hydrating-gel-serum.jpg?v=1775135510",
  },
  "Oil-Free Hydrating Gel": {
    variantId: 51901284352338,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Oil-Free-Hydrating-Gel-vegan-natural-certified.jpg?v=1775137249",
  },
  "Peptide Anti-Aging Serum": {
    variantId: 51929446154578,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Peptide-Anti-Aging-Serum-vegan-natural-certified-gluten-free_b3d3c1a2-9748-4728-9c8d-31ef88dd41fc.jpg?v=1775137936",
  },
  "Collagen Boost Serum": {
    variantId: 51929475711314,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Collagen-Boost-Serum-firming-hydrating-serum.jpg?v=1775136257",
  },
  "Anti-Age Day Cream": {
    variantId: 51929503367506,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Anti-Age-Day-Cream-hyaluronic-acid-moisturizer.jpg?v=1775135005",
  },
  "Natural Retinol Alternative Oil Serum": {
    variantId: 51929571393874,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Natural-Retinol-Alternative-Oil-Serum-organic-certified.jpg?v=1775137069",
  },
  "Smoothing Eye Cream": {
    variantId: 51929683329362,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Smoothing-Eye-Cream-gluten-free-vegan-natural-certified.jpg?v=1775137579",
  },
  "Vitamin C Serum": {
    variantId: 51930475528530,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Vitamin-C-Serum-vegan-gluten-free-natural-certified_6292763e-027a-4de1-850b-3953b8983743.jpg?v=1775134504",
  },
  "Brightening Face&Body Exfoliator with Kojic Acid": {
    variantId: 51930578714962,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Brightening-Face-and-Body-Exfoliator-Kojic-Acid.jpg?v=1775135392",
  },
  "Dark Spot Face Cream with Kojic Acid": {
    variantId: 51930733216082,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Dark-Spot-Face-Cream-Kojic-Acid-vegan.jpg?v=1775136353",
  },
  "All-In-One Facial Oil": {
    variantId: 51930909180242,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-All-In-One-Facial-Oil-nourishing-face-oil.jpg?v=1775134905",
  },
  "Sun Protection SPF50 Stick no tint": {
    variantId: 51952704848210,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Sun-Protection-SPF50-Stick-no-tint.jpg?v=1775137726",
  },
  "Acne Spot Care": {
    variantId: 51984072966482,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Acne-Spot-Care-acne-treatment-blemish-care_718e95d2-b927-4adc-b551-15bebb4fce84.jpg?v=1775133667",
  },
  "Niacinamide Gel Moisturiser": {
    variantId: 51984073851218,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Niacinamide-Gel-Moisturiser-vitamin-B3-moisturizer_d227899e-7edf-4a39-a992-ce94684179df.jpg?v=1775138791",
  },
} as const;

const ROUTINE_DATA = {
  "Dry & Dehydrated Skin Routine": {
    variantId: 52332020433234,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH_Dry_Dehydrated_Skin_Routine_Skincare_Set_for_Dry_and_Dehydrated_Skin.png?v=1776108066",
  },
  "Sensitive & Reactive Skin Routine": {
    variantId: 52332074074450,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH_Sensitive_Reactive_Skin_Routine_Soothing_Skincare_for_Sensitive_and_Reactive_Skin.png?v=1776108959",
  },
  "Clear & Balanced Skin Routine": {
    variantId: 52332389204306,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH_Clear_Balanced_Skin_Routine_Skincare_Set_for_Blemish-Prone_and_Combination_Skin.png?v=1776108960",
  },
  "Combination Skin Balance Routine": {
    variantId: 52332448809298,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH_Combination_Skin_Balance_Routine_Balancing_Skincare_Set_for_Combination_Skin.png?v=1776109368",
  },
  "Glow & Radiance Routine": {
    variantId: 52332474302802,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH_Glow_Radiance_Routine_Brightening_Skincare_Set_for_Glowing_Skin.png?v=1776109005",
  },
  "Firm & Smooth Skin Routine": {
    variantId: 52332494487890,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH_Firm_Smooth_Skin_Routine_Firming_Anti-Aging_Skincare_for_Mature_Skin.png?v=1776108992",
  },
  "Simple Daily Skincare Routine": {
    variantId: 52332514246994,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH_Simple_Daily_Skincare_Routine_Essential_Skincare_Set_for_Daily_Use.png?v=1776108956",
  },
  "Normal & Balanced Skin Routine": {
    variantId: 52435433292114,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH_Normal_Balanced_Skin_Routine_Complete_Skincare_Set_for_Normal_Skin.png?v=1776108062",
  },
} as const;

const BUNDLES: Record<string, Bundle> = {
  dry: {
    name: "Dry & Dehydrated Skin Routine",
    handle: "dry-dehydrated-skin-routine",
    url: "/products/dry-dehydrated-skin-routine",
    variantId: ROUTINE_DATA["Dry & Dehydrated Skin Routine"].variantId,
    image: ROUTINE_DATA["Dry & Dehydrated Skin Routine"].image,
    description:
      "A hydration-focused routine for skin that feels dry, tight, or dehydrated.",
    products: [
      "Micellar Cleansing Water",
      "Hydrating Toner",
      "Hydrating Serum",
      "Moisturising Day Cream",
      "Ceramide Barrier Night Cream",
    ],
  },
  sensitive: {
    name: "Sensitive & Reactive Skin Routine",
    handle: "sensitive-reactive-skin-routine",
    url: "/products/sensitive-reactive-skin-routine",
    variantId: ROUTINE_DATA["Sensitive & Reactive Skin Routine"].variantId,
    image: ROUTINE_DATA["Sensitive & Reactive Skin Routine"].image,
    description:
      "A gentle routine for skin that reacts easily and needs a calmer approach.",
    products: [
      "Hydrating Toner",
      "Hydrating Serum",
      "Calming Facial Oil",
      "Ceramide Barrier Night Cream",
    ],
  },
  clear: {
    name: "Clear & Balanced Skin Routine",
    handle: "clear-balanced-skin-routine",
    url: "/products/clear-balanced-skin-routine",
    variantId: ROUTINE_DATA["Clear & Balanced Skin Routine"].variantId,
    image: ROUTINE_DATA["Clear & Balanced Skin Routine"].image,
    description:
      "A balancing routine for blemish-prone skin that wants clarity without overdoing it.",
    products: [
      "Purifying Mousse",
      "Niacinamide Gel Moisturiser",
      "Oil-Free Hydrating Gel",
      "Sun Protection SPF50 Stick no tint",
    ],
  },
  combination: {
    name: "Combination Skin Balance Routine",
    handle: "combination-skin-balance-routine",
    url: "/products/combination-skin-balance-routine",
    variantId: ROUTINE_DATA["Combination Skin Balance Routine"].variantId,
    image: ROUTINE_DATA["Combination Skin Balance Routine"].image,
    description:
      "A routine for skin that needs balance between oilier and drier areas.",
    products: [
      "Purifying Mousse",
      "Hydrating Toner",
      "Niacinamide Gel Moisturiser",
      "Sun Protection SPF50 Stick no tint",
    ],
  },
  glow: {
    name: "Glow & Radiance Routine",
    handle: "glow-radiance-routine",
    url: "/products/glow-radiance-routine",
    variantId: ROUTINE_DATA["Glow & Radiance Routine"].variantId,
    image: ROUTINE_DATA["Glow & Radiance Routine"].image,
    description:
      "A routine for dull skin that needs more radiance and a fresher-looking finish.",
    products: [
      "Micellar Cleansing Water",
      "Vitamin C Serum",
      "Antioxidant Ginkgo Gel Booster",
      "Moisturising Day Cream",
      "Sun Protection SPF50 Stick no tint",
    ],
  },
  firm: {
    name: "Firm & Smooth Skin Routine",
    handle: "firm-smooth-skin-routine",
    url: "/products/firm-smooth-skin-routine",
    variantId: ROUTINE_DATA["Firm & Smooth Skin Routine"].variantId,
    image: ROUTINE_DATA["Firm & Smooth Skin Routine"].image,
    description:
      "A more targeted routine focused on smoother- and firmer-looking skin.",
    products: [
      "Micellar Cleansing Water",
      "Collagen Boost Serum",
      "Anti-Age Day Cream",
      "Peptide Anti-Aging Serum",
      "Ceramide Barrier Night Cream",
    ],
  },
  simple: {
    name: "Simple Daily Skincare Routine",
    handle: "simple-daily-skincare-routine",
    url: "/products/simple-daily-skincare-routine",
    variantId: ROUTINE_DATA["Simple Daily Skincare Routine"].variantId,
    image: ROUTINE_DATA["Simple Daily Skincare Routine"].image,
    description: "A simple everyday routine that keeps things easy and effective.",
    products: [
      "Micellar Cleansing Water",
      "Moisturising Day Cream",
      "Ceramide Barrier Night Cream",
      "Sun Protection SPF50 Stick no tint",
    ],
  },
  normal: {
    name: "Normal & Balanced Skin Routine",
    handle: "normal-balanced-skin-routine",
    url: "/products/normal-balanced-skin-routine",
    variantId: ROUTINE_DATA["Normal & Balanced Skin Routine"].variantId,
    image: ROUTINE_DATA["Normal & Balanced Skin Routine"].image,
    description:
      "A balanced routine for skin that feels fairly stable and wants daily support.",
    products: [
      "Micellar Cleansing Water",
      "Hydrating Toner",
      "Niacinamide Gel Moisturiser",
      "Sun Protection SPF50 Stick no tint",
    ],
  },
};

const ADDONS: Record<string, Addon> = {
  acne: {
    title: "Acne Spot Care",
    handle: "acne-spot-care",
    url: "/products/acne-spot-care",
    variantId: PRODUCT_DATA["Acne Spot Care"].variantId,
    image: PRODUCT_DATA["Acne Spot Care"].image,
    description:
      "Een gerichte extra stap voor puistjes, onzuiverheden en verstopte zones.",
  },
  aha: {
    title: "AHA Peeling Concentrate",
    handle: "aha-peeling-concentrate",
    url: "/products/aha-peeling-concentrate",
    variantId: PRODUCT_DATA["AHA Peeling Concentrate"].variantId,
    image: PRODUCT_DATA["AHA Peeling Concentrate"].image,
    description:
      "Een extra avondstap voor een gladdere huid en een verfijndere textuur.",
  },
  vitaminC: {
    title: "Vitamin C Serum",
    handle: "vitamin-c-serum",
    url: "/products/vitamin-c-serum",
    variantId: PRODUCT_DATA["Vitamin C Serum"].variantId,
    image: PRODUCT_DATA["Vitamin C Serum"].image,
    description:
      "Een verhelderende extra stap voor meer glow en een frissere uitstraling.",
  },
  kojicExfoliator: {
    title: "Brightening Face&Body Exfoliator with Kojic Acid",
    handle: "brightening-face-body-exfoliator-with-kojic-acid",
    url: "/products/brightening-face-body-exfoliator-with-kojic-acid",
    variantId:
      PRODUCT_DATA["Brightening Face&Body Exfoliator with Kojic Acid"].variantId,
    image: PRODUCT_DATA["Brightening Face&Body Exfoliator with Kojic Acid"].image,
    description:
      "Een extra stap om de huid gladder, frisser en egaler te laten ogen.",
  },
  kojicCream: {
    title: "Dark Spot Face Cream with Kojic Acid",
    handle: "dark-spot-face-cream-with-kojic-acid",
    url: "/products/dark-spot-face-cream-with-kojic-acid",
    variantId: PRODUCT_DATA["Dark Spot Face Cream with Kojic Acid"].variantId,
    image: PRODUCT_DATA["Dark Spot Face Cream with Kojic Acid"].image,
    description:
      "Een gerichte extra stap voor een egalere en stralendere uitstraling.",
  },
  calmingOil: {
    title: "Calming Facial Oil",
    handle: "calming-facial-oil",
    url: "/products/calming-facial-oil",
    variantId: PRODUCT_DATA["Calming Facial Oil"].variantId,
    image: PRODUCT_DATA["Calming Facial Oil"].image,
    description:
      "Een voedende extra stap wanneer je huid meer comfort en zachtheid nodig heeft.",
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

function getLocalizedReasonLong(
  lang: Lang,
  bundle: Bundle,
  addon: Addon | null
): string {
  if (lang === "nl") {
    return addon
      ? `${bundle.name} sluit het best aan op je antwoorden. ${addon.title} is toegevoegd als extra stap waar dat logisch is.`
      : `${bundle.name} sluit het best aan op je antwoorden en houdt je routine duidelijk en passend.`;
  }

  return addon
    ? `${bundle.name} is the best fit for your answers. ${addon.title} is included as an extra step where it makes sense.`
    : `${bundle.name} is the best fit for your answers and keeps your routine clear and relevant.`;
}

function getLocalizedSteps(
  lang: Lang,
  bundle: Bundle,
  addon: Addon | null
): string[] {
  const cleanser = bundle.products.find((p) =>
    ["Micellar Cleansing Water", "Purifying Mousse"].includes(p)
  );
  const toner = bundle.products.find((p) => p === "Hydrating Toner");
  const dayCream = bundle.products.find((p) =>
    [
      "Moisturising Day Cream",
      "Anti-Age Day Cream",
      "Oil-Free Hydrating Gel",
      "Niacinamide Gel Moisturiser",
      "Sun Protection SPF50 Stick no tint",
    ].includes(p)
  );
  const nightCream = bundle.products.find(
    (p) => p === "Ceramide Barrier Night Cream"
  );
  const serums = bundle.products.filter(
    (p) => ![cleanser, toner, dayCream, nightCream].includes(p as string)
  );

  if (lang === "nl") {
    const steps: string[] = [];

    if (cleanser) steps.push(`Begin met ${cleanser} om je huid te reinigen.`);
    if (toner)
      steps.push(`Gebruik daarna ${toner} als frisse voorbereidende stap.`);
    if (serums.length) {
      steps.push(
        `Breng daarna één of meer gerichte stappen aan, zoals ${serums.join(
          ", "
        )}.`
      );
    }
    if (dayCream) steps.push(`Sluit overdag af met ${dayCream}.`);
    if (nightCream)
      steps.push(`Gebruik in de avond ${nightCream} als voedende afsluiting.`);
    if (addon) {
      if (addon.title === "Acne Spot Care") {
        steps.push(`Gebruik ${addon.title} alleen plaatselijk waar nodig.`);
      } else if (addon.title === "AHA Peeling Concentrate") {
        steps.push(
          `Gebruik ${addon.title} als extra stap in de avond en bouw rustig op.`
        );
      } else {
        steps.push(
          `Voeg ${addon.title} toe als extra stap waar dat past binnen je routine.`
        );
      }
    }

    return steps;
  }

  const steps: string[] = [];

  if (cleanser) steps.push(`Start with ${cleanser} to cleanse the skin.`);
  if (toner) steps.push(`Follow with ${toner} as a fresh prep step.`);
  if (serums.length) {
    steps.push(
      `Then apply one or more targeted steps such as ${serums.join(", ")}.`
    );
  }
  if (dayCream) steps.push(`Finish with ${dayCream} during the day.`);
  if (nightCream)
    steps.push(`Use ${nightCream} in the evening as a nourishing final step.`);
  if (addon) {
    if (addon.title === "Acne Spot Care") {
      steps.push(`Use ${addon.title} only on targeted areas when needed.`);
    } else if (addon.title === "AHA Peeling Concentrate") {
      steps.push(
        `Use ${addon.title} as an extra evening step and build up gradually.`
      );
    } else {
      steps.push(`Add ${addon.title} as an extra step where it fits your routine.`);
    }
  }

  return steps;
}

function chooseBundle(answers: QuizAnswers): Bundle {
  const { skinType, concern, goal, sensitivityLevel, routinePreference } =
    answers;

  if (routinePreference === "simple" || goal === "simple") {
    return BUNDLES.simple;
  }

  if (concern === "breakouts") {
    if (skinType === "combination") return BUNDLES.combination;
    return BUNDLES.clear;
  }

  if (
    concern === "sensitivity" ||
    skinType === "sensitive" ||
    sensitivityLevel === "high"
  ) {
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
    return sensitivityLevel === "high"
      ? ADDONS.kojicCream
      : ADDONS.kojicExfoliator;
  }

  if (goal === "even") {
    return sensitivityLevel === "high"
      ? ADDONS.kojicCream
      : ADDONS.kojicExfoliator;
  }

  if (concern === "glow" && bundle.name !== "Glow & Radiance Routine") {
    return ADDONS.vitaminC;
  }

  if (
    bundle.name === "Sensitive & Reactive Skin Routine" &&
    sensitivityLevel !== "low"
  ) {
    return ADDONS.calmingOil;
  }

  if (
    (bundle.name === "Glow & Radiance Routine" ||
      bundle.name === "Firm & Smooth Skin Routine") &&
    sensitivityLevel === "low"
  ) {
    return ADDONS.aha;
  }

  return null;
}

export function getQuizRecommendation(
  answers: QuizAnswers
): RecommendationResult {
  const recommendedBundle = chooseBundle(answers);
  const addon = chooseAddon(answers, recommendedBundle);

  return {
    lang: answers.lang,
    recommendedBundle,
    addon,
    reasonShort: getLocalizedReasonShort(answers.lang, recommendedBundle),
    reasonLong: getLocalizedReasonLong(
      answers.lang,
      recommendedBundle,
      addon
    ),
    steps: getLocalizedSteps(answers.lang, recommendedBundle, addon),
  };
}
