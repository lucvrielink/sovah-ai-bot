import fs from "node:fs";

const productCatalog = JSON.parse(fs.readFileSync("data/product_catalog.json", "utf8"));
const bundleCatalog = JSON.parse(fs.readFileSync("data/bundle_catalog.json", "utf8"));
const products = productCatalog.products;
const bundles = bundleCatalog.bundles;
const snapshot = JSON.parse(fs.readFileSync("data/shopify_source_snapshot.json", "utf8"));

const expected = {
  "acne-skin-routine": ["acne-purifying-face-wash", "acne-care-moisturiser", "acne-spot-care"],
  "aging-skin-routine": ["gentle-cleansing-milk", "peptide-anti-aging-serum", "anti-age-day-cream", "collagen-anti-age-night-cream"],
  "combination-skin-routine": ["clarifying-gel", "purifying-toner", "light-moisturising-day-cream"],
  "dry-skin-routine": ["gentle-cleansing-milk", "hydrating-face-serum", "moisturising-day-face-cream", "ceramide-barrier-night-cream"],
  "dull-skin-routine": ["radiant-glow-facial-wash", "vitamin-c-serum", "niacinamide-gel-face-moisturiser"],
  "normal-skin-routine": ["cleansing-foam", "hydrating-face-serum", "moisturising-day-face-cream"],
  "oily-skin-routine": ["clarifying-gel", "purifying-toner", "oil-free-hydrating-gel-moisturizer"],
  "sensitive-skin-routine": ["sensitive-skin-oil-to-milk-cleanser", "sensitive-skin-moisturiser-fragrance-free", "sensitive-skin-overnight-cream-fragrance-free"],
  "simple-acne-routine": ["acne-purifying-face-wash", "acne-care-moisturiser"],
  "simple-aging-skin-routine": ["gentle-cleansing-milk", "peptide-ageless-am-pm-cream"],
  "simple-combination-skin-routine": ["clarifying-gel", "light-moisturising-day-cream"],
  "simple-normal-skin-routine": ["cleansing-foam", "moisturising-day-face-cream"],
  "simple-dry-routine": ["gentle-cleansing-milk", "nourishing-rich-cream-fragrance-free"],
  "simple-dull-skin-routine": ["radiant-glow-facial-wash", "niacinamide-gel-face-moisturiser"],
  "simple-oily-skin-routine": ["clarifying-gel", "oil-free-hydrating-gel-moisturizer"],
  "simple-sensitive-skin-routine": ["sensitive-skin-oil-to-milk-cleanser", "sensitive-skin-moisturiser-fragrance-free"],
};

const errors = [];
const assert = (condition, message) => {
  if (!condition) errors.push(message);
};

assert(products.length === 37, `Expected 37 products, found ${products.length}`);
assert(bundles.length === 16, `Expected 16 routines, found ${bundles.length}`);
assert(productCatalog.catalog_version === bundleCatalog.catalog_version, "Product and routine catalog versions differ");
assert(productCatalog.catalog_version === "2026-09-10-shopify-routines-v3", "Unexpected catalog version");
assert(new Set(products.map((item) => item.id)).size === products.length, "Duplicate product IDs found");
assert(new Set(bundles.map((item) => item.id)).size === bundles.length, "Duplicate routine IDs found");

const productById = new Map(products.map((item) => [item.id, item]));
const snapshotByTitle = new Map(snapshot.routines.map((item) => [item.title, item]));

for (const bundle of bundles) {
  const wanted = expected[bundle.id];
  assert(Boolean(wanted), `Unexpected routine: ${bundle.id}`);
  assert(JSON.stringify(bundle.product_ids) === JSON.stringify(wanted), `${bundle.id}: wrong product order or products`);
  assert(bundle.product_ids.every((id) => productById.has(id)), `${bundle.id}: references an unknown product`);
  assert(bundle.bundle_products?.length === bundle.product_ids.length, `${bundle.id}: incomplete product cards`);
  assert(bundle.bundle_products?.every((item, index) => item.id === bundle.product_ids[index]), `${bundle.id}: product card order mismatch`);
  assert(bundle.image?.includes("/sovah-") && bundle.image?.includes("-hero_"), `${bundle.id}: old or missing routine image`);
  assert(Boolean(bundle.variant_id), `${bundle.id}: missing variant ID`);
  assert(Boolean(bundle.price), `${bundle.id}: missing price`);
  assert(/test elk product/i.test(bundle.how_to_use?.nl || ""), `${bundle.id}: Dutch patch-test text missing`);
  assert(/patch test each product/i.test(bundle.how_to_use?.en || ""), `${bundle.id}: English patch-test text missing`);
  assert(/jedes produkt/i.test(bundle.how_to_use?.de || ""), `${bundle.id}: German usage text missing`);
  assert(!bundle.product_ids.some((id) => /spf|sunscreen/.test(id)), `${bundle.id}: SPF must not be included`);

  const source = snapshotByTitle.get(bundle.name);
  assert(Boolean(source), `${bundle.id}: missing Shopify source routine`);
  if (source) {
    assert(bundle.image === source.image, `${bundle.id}: image differs from Shopify`);
    assert(bundle.variant_id === Number(source.variant.id.split("/").pop()), `${bundle.id}: variant differs from Shopify`);
    assert(bundle.price === `€${source.variant.price.replace(".", ",")}`, `${bundle.id}: price differs from Shopify`);
    assert(bundle.url.endsWith(`/products/${source.handle}`), `${bundle.id}: URL differs from Shopify`);
  }
}

for (const id of Object.keys(expected)) {
  assert(bundles.some((bundle) => bundle.id === id), `Missing routine: ${id}`);
}

const newProducts = products.filter((item) => item.source?.last_verified === "2026-09-09");
assert(newProducts.length === 14, `Expected 14 newly verified products, found ${newProducts.length}`);
for (const product of newProducts) {
  assert(Boolean(product.variant_id), `${product.id}: missing variant ID`);
  assert(Boolean(product.image), `${product.id}: missing product image`);
  assert(Boolean(product.usage?.nl && product.usage?.en), `${product.id}: missing usage`);
  assert(product.inci?.length > 0, `${product.id}: missing INCI`);
  assert(product.safety?.patch_test === true, `${product.id}: patch-test safety missing`);
}

assert(!products.some((item) => /spf|sunscreen/.test(item.id)), "Removed SPF product is still present");
assert(products.every((item) => Boolean(item.variant_id)), "A product is missing its Shopify variant ID");
assert(products.every((item) => typeof item.available_for_sale === "boolean"), "A product is missing availability metadata");
assert(productById.get("acne-spot-care")?.price === "€29,95", "Acne Spot Care price differs from Shopify");

if (errors.length) {
  console.error(`Catalog audit failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Catalog audit passed: ${products.length} products, ${bundles.length} routines, ${newProducts.length} newly verified products.`);
