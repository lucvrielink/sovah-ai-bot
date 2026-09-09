import fs from "node:fs";

const file = "lib/sovah-recommendation.ts";
let source = fs.readFileSync(file, "utf8");

if (!source.includes('import bundleCatalogData from "../data/bundle_catalog.json";')) {
  source = `import bundleCatalogData from "../data/bundle_catalog.json";\n\n${source}`;
}

source = source.replace(
  /export type Bundle = \{[\s\S]*?\n\};\n\nexport type Addon/,
  `export type Bundle = {
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

export type Addon`
);

const start = source.indexOf("const BUNDLES: Record<string, Bundle> = {");
const end = source.indexOf("\n\nconst ADDONS: Record<string, Addon> = {", start);
if (start < 0 || end < 0) throw new Error("Could not locate BUNDLES block");

const replacement = `type BundleCatalogEntry = {
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
  if (!entry) throw new Error(\`Missing bundle catalog entry: \${id}\`);
  const handle = new URL(entry.url).pathname.split("/").filter(Boolean).pop();
  if (!handle || !entry.variant_id || !entry.image || !entry.price) {
    throw new Error(\`Incomplete bundle catalog entry: \${id}\`);
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
};`;

source = `${source.slice(0, start)}${replacement}${source.slice(end)}`;

source = source.replace(
  '  if (skinType === "oily") return BUNDLES.simpleOily;\n',
  '  if (skinType === "oily") return BUNDLES.simpleOily;\n  if (concern === "dryness" || skinType === "dry" || goal === "hydration") {\n    return BUNDLES.simpleDry;\n  }\n'
);
source = source.replace(
  '  if (skinType === "oily") return BUNDLES.acne;\n',
  '  if (skinType === "oily") return BUNDLES.oily;\n'
);

source = source.replace(
  /function getLocalizedSteps\([\s\S]*?\n\}\n\nexport function getQuizRecommendation/,
  `function getLocalizedSteps(
  lang: Lang,
  bundle: Bundle,
  addon: Addon | null
): string[] {
  const steps = (bundle.howToUse[lang] || bundle.howToUse.en)
    .split(/\\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (addon) {
    steps.push(
      lang === "nl"
        ? \`Optionele extra stap: \${addon.title}. Volg altijd de gebruiksinstructies op de productpagina.\`
        : \`Optional extra step: \${addon.title}. Always follow the directions on its product page.\`
    );
  }
  return steps;
}

export function getQuizRecommendation`
);

source = source.replace(
  '      case "Normal Skin Routine":\n        return "Deze routine past het best bij een normale huid die dagelijkse balans zoekt.";',
  '      case "Normal Skin Routine":\n        return "Deze routine past het best bij een normale huid die dagelijkse balans zoekt.";\n      case "Oily Skin Routine":\n        return "Deze routine past het best bij een vette of snel glimmende huid.";'
);
source = source.replace(
  '      case "Simple Dull Skin Routine":\n        return "Deze routine past het best als je simpel wilt starten voor een frissere, minder doffe huid.";',
  '      case "Simple Dull Skin Routine":\n        return "Deze routine past het best als je simpel wilt starten voor een frissere, minder doffe huid.";\n      case "Simple Dry Routine":\n        return "Deze routine past het best als je een eenvoudige start wilt voor een droge of trekkerige huid.";'
);
source = source.replace(
  '    case "Normal Skin Routine":\n      return "This routine is the best match for normal skin that wants daily balance.";',
  '    case "Normal Skin Routine":\n      return "This routine is the best match for normal skin that wants daily balance.";\n    case "Oily Skin Routine":\n      return "This routine is the best match for oily or quickly shiny skin.";'
);
source = source.replace(
  '    case "Simple Dull Skin Routine":\n      return "This routine is the best match if you want a simple start for fresher-looking, less dull skin.";',
  '    case "Simple Dull Skin Routine":\n      return "This routine is the best match if you want a simple start for fresher-looking, less dull skin.";\n    case "Simple Dry Routine":\n      return "This routine is the best match if you want a simple start for dry or tight-feeling skin.";'
);

fs.writeFileSync(file, source);
console.log("Quiz catalog now reads all 16 routines from bundle_catalog.json.");
