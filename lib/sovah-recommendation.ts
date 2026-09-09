import bundleCatalogData from "../data/bundle_catalog.json";

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

export type Bundle = {
  name: string;
  handle: string;
  url: string;
  variantId: number;
  image: string;
  price: string;
  description: string;
  products: string[];
  howToUse: Record<Lang, string>;
};

export type Addon = {
  title: string;
  handle: string;
  url: string;
  variantId: number;
  image: string;
  price: string;
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

const PRODUCTS = {
  micellar: {
    title: "Micellar Cleansing Water",
    handle: "micellar-cleansing-water",
    url: "https://sovahcare.com/products/micellar-cleansing-water",
    variantId: 51851602854226,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Micellar-Cleansing-Water-vegan-organic-certified.jpg?v=1775136796",
    price: "€24,95",
  },

  toner: {
    title: "Hydrating Toner",
    handle: "hydrating-toner",
    url: "https://sovahcare.com/products/hydrating-toner",
    variantId: 51881462956370,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Hydrating-Toner-fragrance-free-vegan.jpg?v=1775136707",
    price: "€24,95",
  },

  hydratingSerum: {
    title: "Hydrating Face Serum with Aloe & Hyaluronic Acid",
    handle: "hydrating-serum",
    url: "https://sovahcare.com/products/hydrating-serum",
    variantId: 51886996390226,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Hydrating-Serum-vegan-natural-certified.jpg?v=1775136609",
    price: "€34,95",
  },

  hydrationBoost: {
    title: "Hydration Boost Gel Moisturizer",
    handle: "double-hydration-boost-gel-ha",
    url: "https://sovahcare.com/products/double-hydration-boost-gel-ha",
    variantId: 51887105278290,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Double-Hydration-Boost-Gel-HA-natural-certified.jpg?v=1775136519",
    price: "€34,95",
  },

  dayCream: {
    title: "Moisturising Day Face Cream with Hyaluronic Acid",
    handle: "moisturising-day-cream",
    url: "https://sovahcare.com/products/moisturising-day-cream",
    variantId: 51887248539986,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Moisturising-Day-Cream-hyaluronic-moisturizer.jpg?v=1775136917",
    price: "€39,95",
  },

  nightCream: {
    title: "Ceramide Barrier Night Cream for Dry & Normal Skin",
    handle: "ceramide-barrier-night-cream",
    url: "https://sovahcare.com/products/ceramide-barrier-night-cream",
    variantId: 51887297593682,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Ceramide-Barrier-Night-Cream-barrier-repair-moisturizer_54139ef5-7701-4007-afb4-adb7140f7dd7.jpg?v=1775136179",
    price: "€39,95",
  },

  purifyingMousse: {
    title: "Purifying Mousse",
    handle: "purifying-mousse",
    url: "https://sovahcare.com/products/purifying-mousse",
    variantId: 51900553560402,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Purifying-Mousse-gluten-free-nut-free-vegan-natural-certified.jpg?v=1775137464",
    price: "€34,95",
  },

  ginkgoBooster: {
    title: "Antioxidant Ginkgo Hydrating Gel Booster",
    handle: "antioxidant-ginkgo-gel-booster",
    url: "https://sovahcare.com/products/antioxidant-ginkgo-gel-booster",
    variantId: 51900617851218,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Antioxidant-Ginkgo-Gel-Booster-hydrating-gel-serum.jpg?v=1775135203",
    price: "€34,95",
  },

  calmingOil: {
    title: "Calming Facial Oil",
    handle: "calming-facial-oil",
    url: "https://sovahcare.com/products/calming-facial-oil",
    variantId: 51900798566738,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Calming-Facial-Oil-nourishing-face-oil.jpg?v=1775135603",
    price: "€39,95",
  },

  aha: {
    title: "AHA Peeling Concentrate Exfoliating Face Serum",
    handle: "aha-peeling-concentrate",
    url: "https://sovahcare.com/products/aha-peeling-concentrate",
    variantId: 51900930589010,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-AHA-Peeling-Concentrate-exfoliating-face-serum.jpg?v=1775134637",
    price: "€34,95",
  },

  caffeine: {
    title: "Caffeine Hydrating Gel Booster for Face & Eyes",
    handle: "caffeine-gel-booster",
    url: "https://sovahcare.com/products/caffeine-gel-booster",
    variantId: 51901220454738,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Caffeine-Gel-Booster-hydrating-gel-serum.jpg?v=1775135510",
    price: "€34,95",
  },

  oilFreeGel: {
    title: "Oil-Free Hydrating Gel Moisturizer",
    handle: "oil-free-hydrating-gel",
    url: "https://sovahcare.com/products/oil-free-hydrating-gel",
    variantId: 51901284352338,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Oil-Free-Hydrating-Gel-vegan-natural-certified.jpg?v=1775137249",
    price: "€39,95",
  },

  peptide: {
    title: "Peptide Anti-Aging Serum",
    handle: "peptide-anti-aging-serum",
    url: "https://sovahcare.com/products/peptide-anti-aging-serum",
    variantId: 51929446154578,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Peptide-Anti-Aging-Serum-vegan-natural-certified-gluten-free_b3d3c1a2-9748-4728-9c8d-31ef88dd41fc.jpg?v=1775137936",
    price: "€39,95",
  },

  collagen: {
    title: "Collagen Boost Serum",
    handle: "collagen-boost-serum",
    url: "https://sovahcare.com/products/collagen-boost-serum",
    variantId: 51929475711314,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Collagen-Boost-Serum-firming-hydrating-serum.jpg?v=1775136257",
    price: "€39,95",
  },

  antiAgeDayCream: {
    title: "Anti-Age Day Cream",
    handle: "anti-age-day-cream",
    url: "https://sovahcare.com/products/anti-age-day-cream",
    variantId: 51929503367506,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Anti-Age-Day-Cream-hyaluronic-acid-moisturizer.jpg?v=1775135005",
    price: "€39,95",
  },

  retinolAlternative: {
    title: "Natural Retinol Alternative Oil Serum",
    handle: "natural-retinol-alternative-oil-serum",
    url: "https://sovahcare.com/products/natural-retinol-alternative-oil-serum",
    variantId: 51929571393874,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Natural-Retinol-Alternative-Oil-Serum-organic-certified.jpg?v=1775137069",
    price: "€39,95",
  },

  eyeCream: {
    title: "Smoothing Eye Cream",
    handle: "smoothing-eye-cream",
    url: "https://sovahcare.com/products/smoothing-eye-cream",
    variantId: 51929683329362,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Smoothing-Eye-Cream-gluten-free-vegan-natural-certified.jpg?v=1775137579",
    price: "€34,95",
  },

  vitaminC: {
    title: "Vitamin C Serum",
    handle: "vitamin-c-serum",
    url: "https://sovahcare.com/products/vitamin-c-serum",
    variantId: 51930475528530,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Vitamin-C-Serum-vegan-gluten-free-natural-certified_6292763e-027a-4de1-850b-3953b8983743.jpg?v=1775134504",
    price: "€34,95",
  },

  kojicExfoliator: {
    title: "Brightening Face & Body Exfoliating Cleanser with Kojic Acid",
    handle: "brightening-face-body-exfoliator-with-kojic-acid",
    url: "https://sovahcare.com/products/brightening-face-body-exfoliator-with-kojic-acid",
    variantId: 51930578714962,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Brightening-Face-and-Body-Exfoliator-Kojic-Acid.jpg?v=1775135392",
    price: "€34,95",
  },

  kojicCream: {
    title: "Dark Spot Face Cream with Kojic Acid",
    handle: "dark-spot-face-cream-with-kojic-acid",
    url: "https://sovahcare.com/products/dark-spot-face-cream-with-kojic-acid",
    variantId: 51930733216082,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Dark-Spot-Face-Cream-Kojic-Acid-vegan.jpg?v=1775136353",
    price: "€34,95",
  },

  allInOneOil: {
    title: "All-In-One Facial Oil",
    handle: "all-in-one-facial-oil",
    url: "https://sovahcare.com/products/all-in-one-facial-oil",
    variantId: 51930909180242,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-All-In-One-Facial-Oil-nourishing-face-oil.jpg?v=1775134905",
    price: "€34,95",
  },

  spf: {
    title: "Sun Protection SPF50 Stick, no tint",
    handle: "sun-protection-spf50-stick-no-tint",
    url: "https://sovahcare.com/products/sun-protection-spf50-stick-no-tint",
    variantId: 51952704848210,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Sun-Protection-SPF50-Stick-no-tint.jpg?v=1775137726",
    price: "€29,95",
  },

  acneSpot: {
    title: "Acne Spot Care",
    handle: "acne-spot-care",
    url: "https://sovahcare.com/products/acne-spot-care",
    variantId: 51984072966482,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Acne-Spot-Care-acne-treatment-blemish-care_718e95d2-b927-4adc-b551-15bebb4fce84.jpg?v=1775133667",
    price: "€34,95",
  },

  niacinamide: {
    title: "Niacinamide Gel Face Moisturiser",
    handle: "niacinamide-gel-moisturiser-1",
    url: "https://sovahcare.com/products/niacinamide-gel-moisturiser-1",
    variantId: 51984073851218,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH-Niacinamide-Gel-Moisturiser-vitamin-B3-moisturizer_d227899e-7edf-4a39-a992-ce94684179df.jpg?v=1775138791",
    price: "€39,95",
  },
} as const;

type BundleCatalogEntry = {
  id: string;
  name: string;
  url: string;
  image?: string | null;
  price?: string | null;
  variant_id?: number | null;
  bundle_products?: Array<{ title: string }>;
  description?: Partial<Record<Lang, string>>;
  how_to_use?: Partial<Record<Lang, string>>;
};

const bundleCatalogEntries = (
  bundleCatalogData as { bundles: BundleCatalogEntry[] }
).bundles;

function bundleFromCatalog(id: string): Bundle {
  const entry = bundleCatalogEntries.find((bundle) => bundle.id === id);
  if (!entry) throw new Error(`Missing bundle catalog entry: ${id}`);
  const handle = new URL(entry.url).pathname.split("/").filter(Boolean).pop();
  if (!handle || !entry.variant_id || !entry.image || !entry.price) {
    throw new Error(`Incomplete bundle catalog entry: ${id}`);
  }
  return {
    name: entry.name,
    handle,
    url: entry.url,
    variantId: entry.variant_id,
    image: entry.image,
    price: entry.price,
    description: entry.description?.en || "",
    products: (entry.bundle_products || []).map((product) => product.title),
    howToUse: {
      nl: entry.how_to_use?.nl || "",
      en: entry.how_to_use?.en || "",
    },
  };
}

const BUNDLES: Record<string, Bundle> = {
  dry: bundleFromCatalog("dry-skin-routine"),
  sensitive: bundleFromCatalog("sensitive-skin-routine"),
  acne: bundleFromCatalog("acne-skin-routine"),
  combination: bundleFromCatalog("combination-skin-routine"),
  dull: bundleFromCatalog("dull-skin-routine"),
  aging: bundleFromCatalog("aging-skin-routine"),
  normal: bundleFromCatalog("normal-skin-routine"),
  oily: bundleFromCatalog("oily-skin-routine"),
  simpleNormal: bundleFromCatalog("simple-normal-skin-routine"),
  simpleSensitive: bundleFromCatalog("simple-sensitive-skin-routine"),
  simpleOily: bundleFromCatalog("simple-oily-skin-routine"),
  simpleCombination: bundleFromCatalog("simple-combination-skin-routine"),
  simpleAging: bundleFromCatalog("simple-aging-skin-routine"),
  simpleAcne: bundleFromCatalog("simple-acne-routine"),
  simpleDull: bundleFromCatalog("simple-dull-skin-routine"),
  simpleDry: bundleFromCatalog("simple-dry-routine"),
};

const ADDONS: Record<string, Addon> = {
  acneSpot: {
    title: PRODUCTS.acneSpot.title,
    handle: PRODUCTS.acneSpot.handle,
    url: PRODUCTS.acneSpot.url,
    variantId: PRODUCTS.acneSpot.variantId,
    image: PRODUCTS.acneSpot.image,
    price: PRODUCTS.acneSpot.price,
    description:
      "A targeted extra step for pimples, blemishes, breakouts and active spots.",
  },

  aha: {
    title: PRODUCTS.aha.title,
    handle: PRODUCTS.aha.handle,
    url: PRODUCTS.aha.url,
    variantId: PRODUCTS.aha.variantId,
    image: PRODUCTS.aha.image,
    price: PRODUCTS.aha.price,
    description:
      "An exfoliating evening serum for smoother-looking texture and dull skin.",
  },

  vitaminC: {
    title: PRODUCTS.vitaminC.title,
    handle: PRODUCTS.vitaminC.handle,
    url: PRODUCTS.vitaminC.url,
    variantId: PRODUCTS.vitaminC.variantId,
    image: PRODUCTS.vitaminC.image,
    price: PRODUCTS.vitaminC.price,
    description:
      "A brightening serum for glow, dull skin and a fresher-looking complexion.",
  },

  kojicCream: {
    title: PRODUCTS.kojicCream.title,
    handle: PRODUCTS.kojicCream.handle,
    url: PRODUCTS.kojicCream.url,
    variantId: PRODUCTS.kojicCream.variantId,
    image: PRODUCTS.kojicCream.image,
    price: PRODUCTS.kojicCream.price,
    description:
      "A targeted cream for a more even-looking complexion and dark spot care.",
  },

  kojicExfoliator: {
    title: PRODUCTS.kojicExfoliator.title,
    handle: PRODUCTS.kojicExfoliator.handle,
    url: PRODUCTS.kojicExfoliator.url,
    variantId: PRODUCTS.kojicExfoliator.variantId,
    image: PRODUCTS.kojicExfoliator.image,
    price: PRODUCTS.kojicExfoliator.price,
    description:
      "A face and body exfoliating cleanser for smoother, brighter-looking skin.",
  },

  calmingOil: {
    title: PRODUCTS.calmingOil.title,
    handle: PRODUCTS.calmingOil.handle,
    url: PRODUCTS.calmingOil.url,
    variantId: PRODUCTS.calmingOil.variantId,
    image: PRODUCTS.calmingOil.image,
    price: PRODUCTS.calmingOil.price,
    description:
      "A nourishing facial oil for extra comfort, especially for dry or sensitive-feeling skin.",
  },

  eyeCream: {
    title: PRODUCTS.eyeCream.title,
    handle: PRODUCTS.eyeCream.handle,
    url: PRODUCTS.eyeCream.url,
    variantId: PRODUCTS.eyeCream.variantId,
    image: PRODUCTS.eyeCream.image,
    price: PRODUCTS.eyeCream.price,
    description:
      "An extra eye-care step for the under-eye area and smoother-looking skin around the eyes.",
  },

  retinolAlternative: {
    title: PRODUCTS.retinolAlternative.title,
    handle: PRODUCTS.retinolAlternative.handle,
    url: PRODUCTS.retinolAlternative.url,
    variantId: PRODUCTS.retinolAlternative.variantId,
    image: PRODUCTS.retinolAlternative.image,
    price: PRODUCTS.retinolAlternative.price,
    description:
      "An evening oil-serum for smoother-looking skin and anti-aging support.",
  },

  spf: {
    title: PRODUCTS.spf.title,
    handle: PRODUCTS.spf.handle,
    url: PRODUCTS.spf.url,
    variantId: PRODUCTS.spf.variantId,
    image: PRODUCTS.spf.image,
    price: PRODUCTS.spf.price,
    description:
      "A standalone SPF product for daily sun protection. It is not included inside SOVAH routine bundles.",
  },
};

function wantsSimpleRoutine(answers: QuizAnswers): boolean {
  return answers.routinePreference === "simple" || answers.goal === "simple";
}

function chooseSimpleBundle(answers: QuizAnswers): Bundle {
  const { skinType, concern, goal, sensitivityLevel } = answers;

  if (concern === "breakouts") return BUNDLES.simpleAcne;
  if (
    concern === "sensitivity" ||
    skinType === "sensitive" ||
    sensitivityLevel === "high" ||
    goal === "calm"
  ) {
    return BUNDLES.simpleSensitive;
  }

  if (skinType === "combination") return BUNDLES.simpleCombination;
  if (skinType === "oily") return BUNDLES.simpleOily;
  if (concern === "dryness" || skinType === "dry" || goal === "hydration") {
    return BUNDLES.simpleDry;
  }

  if (concern === "antiage" || goal === "firm") return BUNDLES.simpleAging;

  if (
    concern === "glow" ||
    concern === "dark_spots" ||
    goal === "glow" ||
    goal === "even"
  ) {
    return BUNDLES.simpleDull;
  }

  return BUNDLES.simpleNormal;
}

function chooseFullBundle(answers: QuizAnswers): Bundle {
  const { skinType, concern, goal, sensitivityLevel } = answers;

  if (concern === "breakouts") return BUNDLES.acne;

  if (
    concern === "sensitivity" ||
    skinType === "sensitive" ||
    sensitivityLevel === "high" ||
    goal === "calm"
  ) {
    return BUNDLES.sensitive;
  }

  if (concern === "dryness" || skinType === "dry" || goal === "hydration") {
    return BUNDLES.dry;
  }

  if (concern === "antiage" || goal === "firm") return BUNDLES.aging;

  if (
    concern === "dark_spots" ||
    concern === "glow" ||
    goal === "even" ||
    goal === "glow"
  ) {
    return BUNDLES.dull;
  }

  if (skinType === "combination") return BUNDLES.combination;
  if (skinType === "oily") return BUNDLES.oily;
  if (skinType === "normal") return BUNDLES.normal;

  return BUNDLES.normal;
}

function chooseBundle(answers: QuizAnswers): Bundle {
  return wantsSimpleRoutine(answers)
    ? chooseSimpleBundle(answers)
    : chooseFullBundle(answers);
}

function bundleAlreadyContains(bundle: Bundle, productTitle: string): boolean {
  return bundle.products.includes(productTitle);
}

function chooseAddon(answers: QuizAnswers, bundle: Bundle): Addon | null {
  const { concern, goal, sensitivityLevel, skinType } = answers;

  if (
    concern === "breakouts" &&
    !bundleAlreadyContains(bundle, PRODUCTS.acneSpot.title)
  ) {
    return ADDONS.acneSpot;
  }

  if (concern === "dark_spots" || goal === "even") {
    return sensitivityLevel === "high"
      ? ADDONS.kojicCream
      : ADDONS.kojicExfoliator;
  }

  if (
    (concern === "glow" || goal === "glow") &&
    !bundleAlreadyContains(bundle, PRODUCTS.vitaminC.title)
  ) {
    return ADDONS.vitaminC;
  }

  if (
    (concern === "sensitivity" ||
      skinType === "sensitive" ||
      sensitivityLevel === "high") &&
    !bundleAlreadyContains(bundle, PRODUCTS.calmingOil.title)
  ) {
    return ADDONS.calmingOil;
  }

  if (
    (concern === "antiage" || goal === "firm") &&
    !bundleAlreadyContains(bundle, PRODUCTS.eyeCream.title)
  ) {
    return ADDONS.eyeCream;
  }

  if (bundle.name === "Dull Skin Routine" && sensitivityLevel === "low") {
    return ADDONS.aha;
  }

  return null;
}

function getLocalizedReasonShort(lang: Lang, bundle: Bundle): string {
  if (lang === "nl") {
    switch (bundle.name) {
      case "Dry Skin Routine":
        return "Deze routine past het best bij een droge, trekkerige of vochtarme huid.";
      case "Sensitive Skin Routine":
        return "Deze routine past het best bij een gevoelige huid die snel reageert en rust nodig heeft.";
      case "Acne Skin Routine":
        return "Deze routine past het best bij puistjes, acne, breakouts of onzuiverheden.";
      case "Combination Skin Routine":
        return "Deze routine past het best bij een gecombineerde huid met vettere en drogere zones.";
      case "Dull Skin Routine":
        return "Deze routine past het best bij een doffe huid die meer glow en frisheid kan gebruiken.";
      case "Aging Skin Routine":
        return "Deze routine past het best bij fijne lijntjes, huidveroudering en een stevigere uitstraling.";
      case "Normal Skin Routine":
        return "Deze routine past het best bij een normale huid die dagelijkse balans zoekt.";
      case "Oily Skin Routine":
        return "Deze routine past het best bij een vette of snel glimmende huid.";
      case "Simple Normal Skin Routine":
        return "Deze routine past het best als je simpel wilt beginnen met normale huidverzorging.";
      case "Simple Sensitive Skin Routine":
        return "Deze routine past het best als je een simpele, milde start wilt voor gevoelige huid.";
      case "Simple Oily Skin Routine":
        return "Deze routine past het best als je een simpele start wilt voor een vette of glimmende huid.";
      case "Simple Combination Skin Routine":
        return "Deze routine past het best als je een simpele start wilt voor een gecombineerde huid.";
      case "Simple Aging Skin Routine":
        return "Deze routine past het best als je simpel wilt starten met anti-aging verzorging.";
      case "Simple Acne Routine":
        return "Deze routine past het best als je simpel wilt starten tegen puistjes en onzuiverheden.";
      case "Simple Dull Skin Routine":
        return "Deze routine past het best als je simpel wilt starten voor een frissere, minder doffe huid.";
      case "Simple Dry Routine":
        return "Deze routine past het best als je een eenvoudige start wilt voor een droge of trekkerige huid.";
      default:
        return "Deze routine past het best bij jouw antwoorden.";
    }
  }

  switch (bundle.name) {
    case "Dry Skin Routine":
      return "This routine is the best match for dry, tight or dehydrated-feeling skin.";
    case "Sensitive Skin Routine":
      return "This routine is the best match for sensitive or easily reactive skin.";
    case "Acne Skin Routine":
      return "This routine is the best match for acne, pimples, breakouts or blemishes.";
    case "Combination Skin Routine":
      return "This routine is the best match for combination skin with oilier and drier areas.";
    case "Dull Skin Routine":
      return "This routine is the best match for dull skin that needs more glow and freshness.";
    case "Aging Skin Routine":
      return "This routine is the best match for fine lines, aging skin and firmer-looking skin.";
    case "Normal Skin Routine":
      return "This routine is the best match for normal skin that wants daily balance.";
    case "Oily Skin Routine":
      return "This routine is the best match for oily or quickly shiny skin.";
    case "Simple Normal Skin Routine":
      return "This routine is the best match if you want a simple start for normal skin.";
    case "Simple Sensitive Skin Routine":
      return "This routine is the best match if you want a simple, gentle start for sensitive skin.";
    case "Simple Oily Skin Routine":
      return "This routine is the best match if you want a simple start for oily or shiny skin.";
    case "Simple Combination Skin Routine":
      return "This routine is the best match if you want a simple start for combination skin.";
    case "Simple Aging Skin Routine":
      return "This routine is the best match if you want a simple anti-aging start.";
    case "Simple Acne Routine":
      return "This routine is the best match if you want a simple start for pimples and blemishes.";
    case "Simple Dull Skin Routine":
      return "This routine is the best match if you want a simple start for fresher-looking, less dull skin.";
    case "Simple Dry Routine":
      return "This routine is the best match if you want a simple start for dry or tight-feeling skin.";
    default:
      return "This routine is the best match for your answers.";
  }
}

function getLocalizedReasonLong(
  lang: Lang,
  bundle: Bundle,
  addon: Addon | null
): string {
  if (lang === "nl") {
    return addon
      ? `${bundle.name} sluit het best aan op je antwoorden. ${addon.title} is toegevoegd als extra aanbevolen stap waar dat logisch is.`
      : `${bundle.name} sluit het best aan op je antwoorden en houdt je routine duidelijk, passend en niet onnodig ingewikkeld.`;
  }

  return addon
    ? `${bundle.name} is the best fit for your answers. ${addon.title} is added as an extra recommended step where it makes sense.`
    : `${bundle.name} is the best fit for your answers and keeps your routine clear, relevant and not unnecessarily complicated.`;
}

function getLocalizedSteps(
  lang: Lang,
  bundle: Bundle,
  addon: Addon | null
): string[] {
  const steps = (bundle.howToUse[lang] || bundle.howToUse.en)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (addon) {
    steps.push(
      lang === "nl"
        ? `Optionele extra stap: ${addon.title}. Volg altijd de gebruiksinstructies op de productpagina.`
        : `Optional extra step: ${addon.title}. Always follow the directions on its product page.`
    );
  }
  return steps;
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
    reasonLong: getLocalizedReasonLong(answers.lang, recommendedBundle, addon),
    steps: getLocalizedSteps(answers.lang, recommendedBundle, addon),
  };
}
