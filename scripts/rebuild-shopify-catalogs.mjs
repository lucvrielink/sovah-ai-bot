import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const snapshot = JSON.parse(fs.readFileSync(path.join(root, "data/shopify_source_snapshot.json"), "utf8"));
const productPath = path.join(root, "data/product_catalog.json");
const bundlePath = path.join(root, "data/bundle_catalog.json");
const productCatalog = JSON.parse(fs.readFileSync(productPath, "utf8"));
const previousBundles = JSON.parse(fs.readFileSync(bundlePath, "utf8"));

const nl = {
  "acne-care-moisturiser": ["Een lichte crème die de onzuivere huid hydrateert zonder zwaar aan te voelen en helpt de huid er gladder en evenwichtiger uit te laten zien.", "Breng een hoeveelheid ter grootte van een erwt aan op een schone huid van gezicht en hals. Gebruik 's ochtends en 's avonds en sluit overdag af met een aparte breedspectrum-SPF."],
  "acne-purifying-face-wash": ["Een milde, pH-gebalanceerde reiniger voor de onzuivere huid die vuil en overtollig talg verwijdert zonder agressief te reinigen.", "Breng een kleine hoeveelheid aan op een vochtige huid, masseer zacht in en spoel goed af. Gebruik 's ochtends en/of 's avonds."],
  "clarifying-gel": ["Een frisse gelreiniger die dagelijkse onzuiverheden en overtollig talg verwijdert en de huid schoon en comfortabel laat aanvoelen.", "Schuim een kleine hoeveelheid op tussen natte handen, masseer over de vochtige huid en spoel goed af. Gebruik 's ochtends en/of 's avonds."],
  "cleansing-foam": ["Een zacht, luchtig reinigingsschuim dat dagelijkse onzuiverheden en lichte make-up verwijdert zonder een trekkerig gevoel.", "Masseer 1–2 pompjes op een vochtige huid en spoel goed af met lauwwarm water. Gebruik 's ochtends en/of 's avonds."],
  "collagen-anti-age-night-cream": ["Een rijke nachtcrème die de droge of rijpere huid ondersteunt en haar 's ochtends zachter, voller en gladder laat ogen.", "Breng 's avonds aan op een schone huid als laatste stap van je routine."],
  "gentle-cleansing-milk": ["Een zijdezachte reinigingsmelk die make-up en dagelijkse onzuiverheden verwijdert en de droge of rijpere huid zacht en comfortabel laat aanvoelen.", "Masseer over het gezicht en spoel grondig af met lauwwarm water. Gebruik 's ochtends en/of 's avonds."],
  "light-moisturising-day-cream": ["Een lichte dagcrème die snel intrekt en hydrateert met een comfortabele, natuurlijk matte finish.", "Breng 1–2 pompjes aan op een schone huid na toner of serum. Gebruik 's ochtends en sluit af met een aparte breedspectrum-SPF."],
  "nourishing-rich-cream-fragrance-free": ["Een rijke gezichtscrème die een droog aanvoelende huid langdurig hydrateert en zacht, glad en fluweelachtig laat aanvoelen.", "Masseer een kleine hoeveelheid in op een schone huid als laatste hydraterende stap. Gebruik 's ochtends en/of 's avonds en sluit overdag af met een aparte breedspectrum-SPF."],
  "peptide-ageless-am-pm-cream": ["Een veelzijdige peptidecrème voor ochtend en avond die hydratatie, elasticiteit en een gladdere uitstraling in één stap ondersteunt.", "Breng 1–2 pompjes aan op een schone huid, 's ochtends en 's avonds. Sluit overdag af met een aparte breedspectrum-SPF."],
  "purifying-toner": ["Een verfrissende toner die achtergebleven vuil en overtollig talg verwijdert en de huid na het reinigen soepel en in balans laat aanvoelen.", "Breng na het reinigen een kleine hoeveelheid aan met schone handen of een herbruikbaar wattenschijfje. Vermijd direct contact met de ogen."],
  "radiant-glow-facial-wash": ["Een verfrissende dagelijkse reiniger die vuil, overtollig talg en make-upresten verwijdert en de vochtbalans comfortabel houdt.", "Schuim op in natte handen, masseer zacht over een vochtige huid en spoel goed af. Schud voorzichtig als de natuurlijke formule licht is gescheiden."],
  "sensitive-skin-moisturiser-fragrance-free": ["Een milde dagelijkse crème die de gevoelige huid hydrateert en verzorgt met een parfumvrije, dermatologisch geteste formule.", "Breng 1–3 pompjes aan op een schone huid van gezicht en hals. Gebruik 's ochtends en/of 's avonds en sluit overdag af met een aparte breedspectrum-SPF."],
  "sensitive-skin-oil-to-milk-cleanser": ["Een comfortabele olie-gelreiniger die met water verandert in een zachte melk en make-up en vuil verwijdert zonder de gevoelige huid uit te drogen.", "Masseer op een droge of vochtige huid, voeg een beetje water toe totdat de textuur melkachtig wordt en spoel grondig af. Vermijd direct contact met de ogen."],
  "sensitive-skin-overnight-cream-fragrance-free": ["Een parfumvrije nachtcrème die een gevoelige, roodheidsgevoelige huid tijdens de nacht hydrateert en comfortabel laat aanvoelen.", "Breng 's avonds 1–3 pompjes aan op een gereinigd gezicht, hals en decolleté als laatste stap van je routine."]
};

const typeFor = (p) => {
  const typeTag = p.tags.find((tag) => /\(Type\)/i.test(tag)) || "";
  if (/cleanser/i.test(typeTag)) return "cleanser";
  if (/toner/i.test(typeTag)) return "toner";
  return "moisturiser";
};

const skinTypesFor = (p) => {
  const joined = p.tags.join(" | ").toLowerCase();
  const result = new Set();
  if (joined.includes("all skin types")) ["normal", "dry", "oily", "combination", "sensitive"].forEach((x) => result.add(x));
  if (joined.includes("normal (skin type)")) result.add("normal");
  if (joined.includes("dry (skin type)")) result.add("dry");
  if (joined.includes("oily (skin type)")) { result.add("oily"); result.add("combination"); }
  if (joined.includes("mature (skin type)")) result.add("mature");
  if (joined.includes("blemish-prone skin")) { result.add("oily"); result.add("combination"); }
  if (joined.includes("sensitive skin (concern)")) result.add("sensitive");
  return [...result];
};

const concernsFor = (p) => {
  const joined = p.tags.join(" | ").toLowerCase();
  const result = new Set();
  if (joined.includes("blemish")) { result.add("blemishes"); result.add("breakouts"); }
  if (joined.includes("dehydrated")) result.add("dehydration");
  if (joined.includes("anti-age")) result.add("antiage");
  if (joined.includes("sensitive")) result.add("sensitivity");
  if (joined.includes("damaged skin barrier")) result.add("barrier_support");
  if (joined.includes("cleansing")) result.add("cleansing");
  if (joined.includes("make-up buildup")) result.add("makeup_removal");
  return [...result];
};

const claim = (p, value) => p.tags.some((tag) => tag.toLowerCase() === `${value.toLowerCase()} (claims)`);
const hasFragrance = (p) => /parfum|fragrance|aroma/i.test(p.inci || "");
const isFragranceFree = (p) => /fragrance free|no added fragnance/i.test(`${p.title} ${p.tags.join(" ")}`) && !hasFragrance(p);

const newProducts = snapshot.products.map((p) => {
  const [descriptionNl, usageNl] = nl[p.handle];
  const type = typeFor(p);
  const warningNl = "Alleen voor uitwendig gebruik. Test eerst op een klein stukje huid als je huid snel reageert en stop bij aanhoudende irritatie.";
  const warningEn = "For external use only. Patch test first if your skin is reactive and stop use if persistent irritation occurs.";
  return {
    id: p.handle,
    title: p.title,
    price: `€${Number(p.price).toFixed(2).replace(".", ",")}`,
    currency: "EUR",
    url: `https://sovahcare.com/products/${p.handle}`,
    image: p.image,
    variant_id: Number(p.variantId),
    available_for_sale: true,
    type,
    routine_step: type === "cleanser" ? "cleanse" : type === "toner" ? "after cleansing" : /night|overnight/i.test(p.title) ? "final evening step" : "moisturise",
    volume_ml: null,
    volume_fl_oz: null,
    source: { supplier_product_name: p.title, supplier_sheet_version: "2026.07", last_verified: "2026-09-09", customer_visible: false },
    description: { nl: descriptionNl, en: p.description, de: p.description },
    usage: { nl: usageNl, en: p.usage, de: p.usage },
    when_to_use: { nl: usageNl, en: p.usage, de: p.usage },
    skin_types: skinTypesFor(p),
    concerns: concernsFor(p),
    supplier_skin_type_raw: skinTypesFor(p),
    supplier_concerns_raw: concernsFor(p),
    key_ingredients: p.keyIngredients,
    active_percentages: {},
    inci: (p.inci || "").split(",").map((x) => x.trim()).filter(Boolean),
    inci_raw: p.inci || "",
    aroma: hasFragrance(p) ? "Contains fragrance" : isFragranceFree(p) ? "Fragrance free" : null,
    claims: {
      supplier_original_en: [],
      approved: { nl: [descriptionNl], en: [p.description], de: [p.description] },
      prohibited_wording: ["cures acne", "geneest acne", "removes wrinkles", "verwijdert rimpels", "guaranteed results", "gegarandeerd resultaat"]
    },
    certifications: {
      vegan: claim(p, "Vegan") ? true : null,
      gluten_free: claim(p, "Gluten Free") ? true : null,
      nut_free: claim(p, "Nut Free") ? true : null,
      allergen_label_free: claim(p, "Allergen Label Free") ? true : null,
      fragrance_free: isFragranceFree(p) ? true : hasFragrance(p) ? false : null,
      supplier_declared_fragrance_free: isFragranceFree(p) ? true : null,
      dermatologically_tested: claim(p, "Dermatologically tested") ? true : null,
      cosmos: claim(p, "Natural Certified") ? "COSMOS NATURAL" : null,
      natural_origin_percentage: null,
      organic_percentage: null,
      cruelty_free: null
    },
    pao: null,
    regional_availability: "Available in the EU",
    safety: {
      patch_test: true,
      sun_sensitivity: false,
      avoid_eye_area: type === "cleanser" || type === "toner",
      beginner_frequency: null,
      avoid_same_routine_with: [],
      warning_nl: warningNl,
      warning_en: warningEn,
      warning_de: warningEn
    },
    compatibility: { pairs_well_with: [], avoid_same_routine_with: [] },
    ai_detection: {
      routing_mode: "semantic_first_with_catalog_grounding",
      aliases: [p.title, p.handle, p.title.toLowerCase()],
      customer_language_examples: [...skinTypesFor(p), ...concernsFor(p), ...p.keyIngredients],
      misspellings: [],
      do_not_recommend_when: [],
      safety_note: "Use cosmetic language only. Do not make medical claims. Advise patch testing and gradual introduction."
    },
    verification: { status: "verified_with_shopify_and_supplier_sheet", conflicts: [], requires_manual_review: false }
  };
});

const byId = new Map(productCatalog.products.map((p) => [p.id, p]));
for (const product of newProducts) byId.set(product.id, product);
productCatalog.products = [...byId.values()];
productCatalog.products = productCatalog.products.filter((product) => !/spf|sunscreen/i.test(product.id));
productCatalog.catalog_version = "2026-09-10-shopify-routines-v3";
productCatalog.last_verified = "2026-09-10";

const gidToProductId = new Map([
  ...snapshot.products.map((p) => [p.shopifyId, p.handle]),
  ["gid://shopify/Product/10388250853714", "acne-spot-care"],
  ["gid://shopify/Product/10367777407314", "peptide-anti-aging-serum"],
  ["gid://shopify/Product/10367785304402", "anti-age-day-cream"],
  ["gid://shopify/Product/10355835994450", "hydrating-face-serum"],
  ["gid://shopify/Product/10355903725906", "moisturising-day-face-cream"],
  ["gid://shopify/Product/10355914244434", "ceramide-barrier-night-cream"],
  ["gid://shopify/Product/10368455835986", "vitamin-c-serum"],
  ["gid://shopify/Product/10388251574610", "niacinamide-gel-face-moisturiser"],
  ["gid://shopify/Product/10360482529618", "oil-free-hydrating-gel-moisturizer"]
]);

const routineIdByHandle = {
  "clear-balanced-skin-routine": "acne-skin-routine",
  "firm-smooth-skin-routine": "aging-skin-routine",
  "combination-skin-balance-routine": "combination-skin-routine",
  "dry-dehydrated-skin-routine": "dry-skin-routine",
  "glow-radiance-routine": "dull-skin-routine",
  "normal-balanced-skin-routine": "normal-skin-routine",
  "oily-skin-routine": "oily-skin-routine",
  "sensitive-reactive-skin-routine": "sensitive-skin-routine",
  "simple-acne-routine": "simple-acne-routine",
  "simple-aging-skin-routine": "simple-aging-skin-routine",
  "simple-combination-skin-routine": "simple-combination-skin-routine",
  "simple-daily-skincare-routine": "simple-normal-skin-routine",
  "simple-dry-routine": "simple-dry-routine",
  "simple-dull-skin-routine": "simple-dull-skin-routine",
  "simple-oily-skin-routine": "simple-oily-skin-routine",
  "simple-sensitive-skin-routine": "simple-sensitive-skin-routine"
};

const nlIntro = {
  "acne-skin-routine": "Een gerichte driestappenroutine voor een vette, verstopte en onzuivere huid, met lichte hydratatie en plaatselijke verzorging.",
  "aging-skin-routine": "Een complete vierstappenroutine voor de huid met zichtbare tekenen van huidveroudering, droogte of verminderde stevigheid.",
  "combination-skin-routine": "Een gebalanceerde driestappenroutine voor een huid met een vettere T-zone en normale of drogere zones.",
  "dry-skin-routine": "Een comfortabele vierstappenroutine voor een droge, trekkerige of vochtarme huid, met aparte verzorging voor dag en nacht.",
  "dull-skin-routine": "Een gerichte driestappenroutine voor een vermoeid, dof of ongelijkmatig ogende huid.",
  "normal-skin-routine": "Een gebalanceerde driestappenroutine voor de normale huid met milde reiniging, hydratatie en dagelijkse verzorging.",
  "oily-skin-routine": "Een frisse driestappenroutine voor een huid die snel glanst of vet aanvoelt, met lichte texturen.",
  "sensitive-skin-routine": "Een milde driestappenroutine voor een gevoelige of reactief aanvoelende huid, met verzorging voor dag en nacht.",
  "simple-acne-routine": "Een gerichte tweestappenroutine voor een vette, verstopte en onzuivere huid.",
  "simple-aging-skin-routine": "Een eenvoudige tweestappenroutine voor de huid met vroege tekenen van huidveroudering.",
  "simple-combination-skin-routine": "Een eenvoudige tweestappenroutine voor een gecombineerde huid met lichte hydratatie.",
  "simple-normal-skin-routine": "Een gebalanceerde tweestappenroutine met de dagelijkse basis voor een normale huid.",
  "simple-dry-routine": "Een comfortabele tweestappenroutine voor een droge of trekkerig aanvoelende huid.",
  "simple-dull-skin-routine": "Een verhelderende tweestappenroutine voor een vermoeid of dof ogende huid.",
  "simple-oily-skin-routine": "Een frisse tweestappenroutine voor een vette en glimmende huid.",
  "simple-sensitive-skin-routine": "Een milde tweestappenroutine voor een gevoelige of reactief aanvoelende huid."
};

const howToNl = {
  "acne-skin-routine": "Ochtend\n1. Reinig met Acne Purifying Face Wash.\n2. Breng Acne Care Moisturiser aan.\n3. Sluit af met een aparte breedspectrum-SPF.\n\nAvond\n1. Reinig met Acne Purifying Face Wash.\n2. Breng Acne Care Moisturiser aan.\n3. Gebruik Acne Spot Care alleen plaatselijk op onzuiverheden volgens de productpagina.",
  "aging-skin-routine": "Ochtend\n1. Reinig met Gentle Cleansing Milk.\n2. Breng Peptide Anti-Aging Serum aan.\n3. Sluit af met Anti-Age Day Cream en daarna een aparte breedspectrum-SPF.\n\nAvond\n1. Reinig met Gentle Cleansing Milk.\n2. Breng Peptide Anti-Aging Serum aan.\n3. Sluit af met Collagen Anti-Age Night Cream.",
  "combination-skin-routine": "Ochtend\n1. Reinig met Clarifying Gel.\n2. Breng Purifying Toner aan.\n3. Sluit af met Light Moisturising Day Cream en een aparte breedspectrum-SPF.\n\nAvond\nHerhaal dezelfde volgorde. Begin om de avond met de toner als je huid nog niet gewend is aan zuiverende producten.",
  "dry-skin-routine": "Ochtend\n1. Reinig met Gentle Cleansing Milk.\n2. Breng Hydrating Serum aan.\n3. Sluit af met Moisturising Day Face Cream en een aparte breedspectrum-SPF.\n\nAvond\n1. Reinig met Gentle Cleansing Milk.\n2. Breng Hydrating Serum aan.\n3. Sluit af met Ceramide Barrier Night Cream.",
  "dull-skin-routine": "Ochtend\n1. Reinig met Radiant Glow Facial Wash.\n2. Breng Vitamin C Serum aan.\n3. Sluit af met Niacinamide Gel Face Moisturiser en een aparte breedspectrum-SPF.\n\nAvond\nHerhaal dezelfde volgorde. Bouw Vitamin C Serum rustig op als je huid nog niet gewend is aan actieve huidverzorging.",
  "normal-skin-routine": "Ochtend\n1. Reinig met Cleansing Foam.\n2. Breng Hydrating Serum aan.\n3. Sluit af met Moisturising Day Face Cream en een aparte breedspectrum-SPF.\n\nAvond\nHerhaal dezelfde drie verzorgingsstappen.",
  "oily-skin-routine": "Ochtend en avond\n1. Reinig met Clarifying Gel.\n2. Breng Purifying Toner aan.\n3. Breng Oil-Free Hydrating Gel Moisturizer aan.\n4. Sluit 's ochtends af met een aparte breedspectrum-SPF.",
  "sensitive-skin-routine": "Ochtend\n1. Masseer Sensitive Skin Oil-To-Milk Cleanser op een droge of vochtige huid.\n2. Voeg water toe, masseer tot de textuur melkachtig wordt en spoel af.\n3. Breng Sensitive Skin Moisturiser aan en sluit af met een aparte breedspectrum-SPF.\n\nAvond\n1. Reinig op dezelfde manier.\n2. Sluit af met Sensitive Skin Overnight Cream.",
  "simple-acne-routine": "Ochtend en avond\n1. Reinig met Acne Purifying Face Wash.\n2. Breng Acne Care Moisturiser aan.\n3. Sluit 's ochtends af met een aparte breedspectrum-SPF.",
  "simple-aging-skin-routine": "Ochtend en avond\n1. Reinig met Gentle Cleansing Milk.\n2. Breng Peptide Ageless AM/PM Cream aan op gezicht en hals.\n3. Sluit 's ochtends af met een aparte breedspectrum-SPF.",
  "simple-combination-skin-routine": "Ochtend en avond\n1. Reinig met Clarifying Gel.\n2. Breng Light Moisturising Day Cream aan.\n3. Sluit 's ochtends af met een aparte breedspectrum-SPF.",
  "simple-normal-skin-routine": "Ochtend en avond\n1. Reinig met Cleansing Foam.\n2. Breng Moisturising Day Face Cream aan.\n3. Sluit 's ochtends af met een aparte breedspectrum-SPF.",
  "simple-dry-routine": "Ochtend en avond\n1. Reinig met Gentle Cleansing Milk.\n2. Breng Nourishing Rich Cream aan op gezicht en hals.\n3. Sluit 's ochtends af met een aparte breedspectrum-SPF.",
  "simple-dull-skin-routine": "Ochtend en avond\n1. Reinig met Radiant Glow Facial Wash.\n2. Breng Niacinamide Gel Face Moisturiser aan.\n3. Sluit 's ochtends af met een aparte breedspectrum-SPF.",
  "simple-oily-skin-routine": "Ochtend en avond\n1. Reinig met Clarifying Gel.\n2. Breng Oil-Free Hydrating Gel Moisturizer aan.\n3. Sluit 's ochtends af met een aparte breedspectrum-SPF.",
  "simple-sensitive-skin-routine": "Ochtend en avond\n1. Masseer Sensitive Skin Oil-To-Milk Cleanser op een droge of vochtige huid.\n2. Voeg water toe, masseer tot de textuur melkachtig wordt en spoel af.\n3. Breng Sensitive Skin Moisturiser aan.\n4. Sluit 's ochtends af met een aparte breedspectrum-SPF."
};

const routingTerms = (id) => {
  const terms = [id.replaceAll("-", " ")];
  if (id.includes("acne")) terms.push("acne", "puistjes", "onzuiverheden", "breakouts", "blemishes");
  if (id.includes("aging")) terms.push("rijpe huid", "huidveroudering", "fijne lijntjes", "mature skin", "fine lines");
  if (id.includes("combination")) terms.push("gecombineerde huid", "gemengde huid", "combination skin");
  if (id.includes("dry")) terms.push("droge huid", "trekkerige huid", "vochtarme huid", "dry skin", "dehydrated skin");
  if (id.includes("dull")) terms.push("doffe huid", "meer glow", "vermoeide huid", "dull skin", "radiance");
  if (id.includes("normal")) terms.push("normale huid", "normal skin");
  if (id.includes("oily")) terms.push("vette huid", "glimmende huid", "oily skin", "shine prone");
  if (id.includes("sensitive")) terms.push("gevoelige huid", "reactieve huid", "sensitive skin", "reactive skin");
  if (id.startsWith("simple-")) terms.push("simple", "eenvoudig", "2 stappen", "starter", "minimal");
  else terms.push("complete routine", "volledige routine", "full routine");
  return [...new Set(terms)];
};

const productById = new Map(productCatalog.products.map((p) => [p.id, p]));
const previousByHandle = new Map(previousBundles.bundles.map((b) => [new URL(b.url).pathname.split("/").pop(), b]));
const patchEn = "Patch test each product separately before using the full routine. Introduce one product at a time and stop use if persistent irritation occurs.";
const patchNl = "Test elk product eerst afzonderlijk op een klein stukje huid. Voeg één product tegelijk toe en stop bij aanhoudende irritatie.";

const bundles = snapshot.routines.map((routine) => {
  const id = routineIdByHandle[routine.handle];
  const productIds = routine.productRefs.map((gid) => gidToProductId.get(gid)).filter(Boolean);
  if (!id || !productIds.length) throw new Error(`Missing routine mapping for ${routine.handle}`);
  const products = productIds.map((productId) => {
    const product = productById.get(productId);
    if (!product) throw new Error(`Unknown product ${productId} in ${routine.handle}`);
    return { id: product.id, title: product.title, url: product.url, image: product.image };
  });
  const previous = previousByHandle.get(routine.handle) || {};
  const vegan = productIds.every((x) => productById.get(x)?.certifications?.vegan === true);
  const glutenFree = productIds.every((x) => productById.get(x)?.certifications?.gluten_free === true);
  const nutFree = productIds.every((x) => productById.get(x)?.certifications?.nut_free === true);
  const fragranceFree = productIds.every((x) => productById.get(x)?.certifications?.fragrance_free === true);
  return {
    id,
    name: routine.title,
    old_names: previous.old_names || [],
    type: id.startsWith("simple-") ? "simple_routine" : "full_routine",
    target: nlIntro[id],
    price: `€${Number(routine.variant.price).toFixed(2).replace(".", ",")}`,
    compare_at_price: routine.variant.compareAtPrice ? `€${Number(routine.variant.compareAtPrice).toFixed(2).replace(".", ",")}` : null,
    currency: "EUR",
    url: `https://sovahcare.com/products/${routine.handle}`,
    image: routine.image,
    image_alt: routine.imageAlt,
    variant_id: Number(routine.variant.id.split("/").pop()),
    routing_priority: previous.routing_priority || (id.includes("acne") ? 95 : id.includes("sensitive") ? 90 : 75),
    product_ids: productIds,
    bundle_products: products,
    description: {
      nl: nlIntro[id],
      en: routine.intro,
      de: previous.description?.de || routine.intro,
    },
    how_to_use: {
      nl: `${howToNl[id]}\n\n${patchNl}`,
      en: `${routine.howTo}\n\n${patchEn}`,
      de: previous.how_to_use?.de || `${routine.howTo}\n\n${patchEn}`,
    },
    derived_certification_summary: {
      all_products_vegan: vegan,
      all_products_gluten_free: glutenFree,
      all_products_nut_free: nutFree,
      all_products_fragrance_free: fragranceFree,
      contains_fragrance_or_unverified_fragrance_status: !fragranceFree,
      contains_manual_review_item: productIds.some((x) => productById.get(x)?.verification?.requires_manual_review)
    },
    ai_detection: {
      ...(previous.ai_detection || {}),
      routing_mode: "broad_semantic_customer_language_not_exact_match_only",
      quiz_route: [...new Set([...(previous.ai_detection?.quiz_route || []), ...routingTerms(id)])],
      recognize_old_names_but_do_not_display_them: previous.old_names || []
    },
    safety: { spf_included: false, patch_test_required: true, derive_product_safety_from_product_catalog: true }
  };
});

const bundleCatalog = {
  catalog_version: "2026-09-10-shopify-routines-v3",
  generated_from: "Current active Shopify routines, variants, images and sovah metafields",
  last_verified: "2026-09-10",
  global_rules: {
    product_catalog_is_source_of_truth: true,
    edit_product_ids_not_generated_bundle_products: true,
    spf_must_never_be_included: true,
    old_names_are_recognition_only: true,
    routine_certifications_must_be_derived_from_all_products: true,
    patch_test_must_be_in_every_how_to_use: true
  },
  global_ai_routing_rules: previousBundles.global_ai_routing_rules || [],
  bundles
};

fs.writeFileSync(productPath, `${JSON.stringify(productCatalog, null, 2)}\n`);
fs.writeFileSync(bundlePath, `${JSON.stringify(bundleCatalog, null, 2)}\n`);
console.log(`Updated ${newProducts.length} new products and ${bundles.length} routines.`);
