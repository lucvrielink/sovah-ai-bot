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
  variantId: number | null;
  image: string;
  price: string;
  description: string;
  products: string[];
};

type Addon = {
  title: string;
  handle: string;
  url: string;
  variantId: number | null;
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

const BUNDLES: Record<string, Bundle> = {
  dry: {
    name: "Dry Skin Routine",
    handle: "dry-dehydrated-skin-routine",
    url: "https://sovahcare.com/products/dry-dehydrated-skin-routine",
    variantId: 52332020433234,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH_Dry_Dehydrated_Skin_Routine_Skincare_Set_for_Dry_and_Dehydrated_Skin.png?v=1776108066",
    price: "€144,95",
    description:
      "A complete routine for dry, tight or dehydrated skin that needs hydration and comfort.",
    products: [
      PRODUCTS.micellar.title,
      PRODUCTS.toner.title,
      PRODUCTS.hydratingSerum.title,
      PRODUCTS.dayCream.title,
      PRODUCTS.nightCream.title,
    ],
  },

  sensitive: {
    name: "Sensitive Skin Routine",
    handle: "sensitive-reactive-skin-routine",
    url: "https://sovahcare.com/products/sensitive-reactive-skin-routine",
    variantId: 52332074074450,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH_Sensitive_Reactive_Skin_Routine_Soothing_Skincare_for_Sensitive_and_Reactive_Skin.png?v=1776108959",
    price: "€144,95",
    description:
      "A complete gentle routine for sensitive, reactive or easily irritated skin.",
    products: [
      PRODUCTS.micellar.title,
      PRODUCTS.toner.title,
      PRODUCTS.hydratingSerum.title,
      PRODUCTS.calmingOil.title,
      PRODUCTS.nightCream.title,
    ],
  },

  acne: {
    name: "Acne Skin Routine",
    handle: "clear-balanced-skin-routine",
    url: "https://sovahcare.com/products/clear-balanced-skin-routine",
    variantId: 52332389204306,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/sovah-acne-routine-purifying-mousse-oil-free-hydrating-gel-acne-spot-care_a4fa3783-526d-4bd3-ae28-fbac40fb6a22.png?v=1780327241",
    price: "€99,95",
    description:
      "A focused routine for acne-prone skin, breakouts, pimples and blemishes.",
    products: [
      PRODUCTS.purifyingMousse.title,
      PRODUCTS.oilFreeGel.title,
      PRODUCTS.acneSpot.title,
    ],
  },

  combination: {
    name: "Combination Skin Routine",
    handle: "combination-skin-balance-routine",
    url: "https://sovahcare.com/products/combination-skin-balance-routine",
    variantId: 52332448809298,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/sovah-combination-skin-balance-routine-purifying-mousse-hydrating-toner-niacinamide-gel-moisturiser.png?v=1780325388",
    price: "€89,95",
    description:
      "A balancing routine for combination skin with oilier and drier areas.",
    products: [
      PRODUCTS.purifyingMousse.title,
      PRODUCTS.toner.title,
      PRODUCTS.niacinamide.title,
    ],
  },

  dull: {
    name: "Dull Skin Routine",
    handle: "glow-radiance-routine",
    url: "https://sovahcare.com/products/glow-radiance-routine",
    variantId: 52332474302802,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/sovah-dull-skin-routine-micellar-cleansing-water-vitamin-c-serum-antioxidant-ginkgo-gel-booster-moisturising-day-cream.png?v=1780325781",
    price: "€124,95",
    description:
      "A brightening routine for dull, tired-looking skin that needs more glow.",
    products: [
      PRODUCTS.micellar.title,
      PRODUCTS.vitaminC.title,
      PRODUCTS.ginkgoBooster.title,
      PRODUCTS.dayCream.title,
    ],
  },

  aging: {
    name: "Aging Skin Routine",
    handle: "firm-smooth-skin-routine",
    url: "https://sovahcare.com/products/firm-smooth-skin-routine",
    variantId: 52332494487890,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/SOVAH_Firm_Smooth_Skin_Routine_Firming_Anti-Aging_Skincare_for_Mature_Skin.png?v=1776108992",
    price: "€159,95",
    description:
      "A complete routine for aging skin, fine lines and firmer-looking skin.",
    products: [
      PRODUCTS.micellar.title,
      PRODUCTS.peptide.title,
      PRODUCTS.collagen.title,
      PRODUCTS.antiAgeDayCream.title,
      PRODUCTS.nightCream.title,
    ],
  },

  simpleNormal: {
    name: "Simple Normal Skin Routine",
    handle: "simple-daily-skincare-routine",
    url: "https://sovahcare.com/products/simple-daily-skincare-routine",
    variantId: 52332514246994,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/sovah-simple-normal-routine-micellar-cleansing-water-moisturising-day-cream_030fa985-7455-4c86-b1d4-56ee017330eb.png?v=1780326580",
    price: "€59,95",
    description:
      "A simple two-product routine for normal skin or beginners who want a basic start.",
    products: [PRODUCTS.micellar.title, PRODUCTS.dayCream.title],
  },

  normal: {
    name: "Normal Skin Routine",
    handle: "normal-balanced-skin-routine",
    url: "https://sovahcare.com/products/normal-balanced-skin-routine",
    variantId: 52435433292114,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/sovah-normal-balanced-skin-routine-micellar-cleansing-water-hydrating-toner-niacinamide-gel-moisturiser.png?v=1780325164",
    price: "€79,95",
    description:
      "A balanced daily routine for normal skin that wants simple daily support.",
    products: [
      PRODUCTS.micellar.title,
      PRODUCTS.toner.title,
      PRODUCTS.niacinamide.title,
    ],
  },

  simpleSensitive: {
    name: "Simple Sensitive Skin Routine",
    handle: "simple-sensitive-skin-routine",
    url: "https://sovahcare.com/products/simple-sensitive-skin-routine",
    variantId: null,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/sovah-micellar-cleansing-water-niacinamide-gel-moisturiser-skincare-duo.png?v=1780324703",
    price: "€59,95",
    description:
      "A simple two-product routine for sensitive skin that needs a gentle start.",
    products: [PRODUCTS.micellar.title, PRODUCTS.niacinamide.title],
  },

  simpleOily: {
    name: "Simple Oily Skin Routine",
    handle: "simple-oily-skin-routine",
    url: "https://sovahcare.com/products/simple-oily-skin-routine",
    variantId: null,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/sovah-purifying-mousse-oil-free-hydrating-gel-skincare-duo.png?v=1780324287",
    price: "€69,95",
    description:
      "A simple two-product routine for oily or shiny skin that still needs lightweight hydration.",
    products: [PRODUCTS.purifyingMousse.title, PRODUCTS.oilFreeGel.title],
  },

  simpleCombination: {
    name: "Simple Combination Skin Routine",
    handle: "simple-combination-skin-routine",
    url: "https://sovahcare.com/products/simple-combination-skin-routine",
    variantId: null,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/sovah-purifying-mousse-oil-free-hydrating-gel-skincare-duo.png?v=1780324287",
    price: "€69,95",
    description:
      "A simple two-product routine for combination skin that needs a light, balanced start.",
    products: [PRODUCTS.purifyingMousse.title, PRODUCTS.oilFreeGel.title],
  },

  simpleAging: {
    name: "Simple Aging Skin Routine",
    handle: "simple-aging-skin-routine",
    url: "https://sovahcare.com/products/simple-aging-skin-routine",
    variantId: null,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/sovah-micellar-cleansing-water-anti-age-day-cream-skincare-duo.png?v=1780324041",
    price: "€59,95",
    description:
      "A simple two-product routine for aging skin or early fine-line support.",
    products: [PRODUCTS.micellar.title, PRODUCTS.antiAgeDayCream.title],
  },

  simpleAcne: {
    name: "Simple Acne Routine",
    handle: "simple-acne-routine",
    url: "https://sovahcare.com/products/simple-acne-routine",
    variantId: null,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/sovah-purifying-mousse-niacinamide-gel-moisturiser-skincare-duo.png?v=1780323659",
    price: "€69,95",
    description:
      "A simple two-product routine for acne-prone or blemish-prone skin.",
    products: [PRODUCTS.purifyingMousse.title, PRODUCTS.niacinamide.title],
  },

  simpleDull: {
    name: "Simple Dull Skin Routine",
    handle: "simple-dull-skin-routine",
    url: "https://sovahcare.com/products/simple-dull-skin-routine",
    variantId: null,
    image:
      "https://cdn.shopify.com/s/files/1/1007/2974/9842/files/sovah-micellar-cleansing-water-moisturising-day-cream-hydrating-skincare-duo.png?v=1780323397",
    price: "€59,95",
    description:
      "A simple two-product routine for dull or tired-looking skin that needs a basic glow-supporting start.",
    products: [PRODUCTS.micellar.title, PRODUCTS.dayCream.title],
  },
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

  if (
    concern === "breakouts" ||
    skinType === "oily" ||
    skinType === "combination"
  ) {
    if (concern === "breakouts") return BUNDLES.simpleAcne;
    if (skinType === "combination") return BUNDLES.simpleCombination;
    return BUNDLES.simpleOily;
  }

  if (
    concern === "sensitivity" ||
    skinType === "sensitive" ||
    sensitivityLevel === "high" ||
    goal === "calm"
  ) {
    return BUNDLES.simpleSensitive;
  }

  if (concern === "antiage" || goal === "firm") {
    return BUNDLES.simpleAging;
  }

  if (concern === "glow" || concern === "dark_spots" || goal === "glow" || goal === "even") {
    return BUNDLES.simpleDull;
  }

  return BUNDLES.simpleNormal;
}

function chooseFullBundle(answers: QuizAnswers): Bundle {
  const { skinType, concern, goal, sensitivityLevel } = answers;

  if (concern === "breakouts") {
    return BUNDLES.acne;
  }

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

  if (concern === "antiage" || goal === "firm") {
    return BUNDLES.aging;
  }

  if (concern === "dark_spots" || concern === "glow" || goal === "even" || goal === "glow") {
    return BUNDLES.dull;
  }

  if (skinType === "combination") {
    return BUNDLES.combination;
  }

  if (skinType === "oily") {
    return BUNDLES.acne;
  }

  if (skinType === "normal") {
    return BUNDLES.normal;
  }

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

  if (
    concern === "dark_spots" ||
    goal === "even"
  ) {
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

  if (
    bundle.name === "Dull Skin Routine" &&
    sensitivityLevel === "low"
  ) {
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
  const cleanser = bundle.products.find((product) =>
    [PRODUCTS.micellar.title, PRODUCTS.purifyingMousse.title].includes(product)
  );

  const toner = bundle.products.find(
    (product) => product === PRODUCTS.toner.title
  );

  const treatmentProducts = bundle.products.filter(
    (product) =>
      ![
        PRODUCTS.micellar.title,
        PRODUCTS.purifyingMousse.title,
        PRODUCTS.toner.title,
        PRODUCTS.dayCream.title,
        PRODUCTS.nightCream.title,
        PRODUCTS.oilFreeGel.title,
        PRODUCTS.niacinamide.title,
        PRODUCTS.antiAgeDayCream.title,
      ].includes(product)
  );

  const moisturizer = bundle.products.find((product) =>
    [
      PRODUCTS.dayCream.title,
      PRODUCTS.oilFreeGel.title,
      PRODUCTS.niacinamide.title,
      PRODUCTS.antiAgeDayCream.title,
    ].includes(product)
  );

  const nightCream = bundle.products.find(
    (product) => product === PRODUCTS.nightCream.title
  );

  const steps: string[] = [];

  if (lang === "nl") {
    if (cleanser) steps.push(`Begin met ${cleanser} om je huid te reinigen.`);
    if (toner) steps.push(`Gebruik daarna ${toner} als voorbereidende stap.`);

    if (treatmentProducts.length > 0) {
      steps.push(
        `Breng daarna je gerichte verzorging aan: ${treatmentProducts.join(
          ", "
        )}.`
      );
    }

    if (moisturizer) {
      steps.push(`Sluit overdag af met ${moisturizer}.`);
    }

    if (nightCream) {
      steps.push(`Gebruik in de avond ${nightCream} als laatste stap.`);
    }

    if (addon) {
      if (addon.title === PRODUCTS.acneSpot.title) {
        steps.push(`Gebruik ${addon.title} alleen plaatselijk op puistjes of onzuivere zones.`);
      } else if (addon.title === PRODUCTS.aha.title) {
        steps.push(`Gebruik ${addon.title} rustig in de avond en bouw langzaam op.`);
      } else if (
        addon.title === PRODUCTS.kojicCream.title ||
        addon.title === PRODUCTS.kojicExfoliator.title
      ) {
        steps.push(`Gebruik ${addon.title} als extra stap voor een egalere uitstraling.`);
      } else {
        steps.push(`Voeg ${addon.title} toe als extra stap waar je huid dat nodig heeft.`);
      }
    }

    return steps;
  }

  if (cleanser) steps.push(`Start with ${cleanser} to cleanse the skin.`);
  if (toner) steps.push(`Follow with ${toner} as a prep step.`);

  if (treatmentProducts.length > 0) {
    steps.push(
      `Then apply your targeted care: ${treatmentProducts.join(", ")}.`
    );
  }

  if (moisturizer) {
    steps.push(`Finish during the day with ${moisturizer}.`);
  }

  if (nightCream) {
    steps.push(`Use ${nightCream} in the evening as your final step.`);
  }

  if (addon) {
    if (addon.title === PRODUCTS.acneSpot.title) {
      steps.push(`Use ${addon.title} only on targeted pimples or blemish-prone areas.`);
    } else if (addon.title === PRODUCTS.aha.title) {
      steps.push(`Use ${addon.title} carefully in the evening and build up slowly.`);
    } else if (
      addon.title === PRODUCTS.kojicCream.title ||
      addon.title === PRODUCTS.kojicExfoliator.title
    ) {
      steps.push(`Use ${addon.title} as an extra step for a more even-looking complexion.`);
    } else {
      steps.push(`Add ${addon.title} as an extra step where your skin needs it.`);
    }
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
