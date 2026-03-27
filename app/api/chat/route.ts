import OpenAI from "openai";
import fs from "fs";
import path from "path";

// CORS (so Shopify can call Vercel)
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://sovahcare.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Handle preflight
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// Load catalogs from /data
const bundlesPath = path.join(process.cwd(), "data", "bundle_catalog.json");
const productsPath = path.join(process.cwd(), "data", "product_catalog.json");

const BUNDLES_JSON = fs.readFileSync(bundlesPath, "utf8");
const PRODUCTS_JSON = fs.readFileSync(productsPath, "utf8");

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

type BundleCatalog = {
  bundles: Bundle[];
};

type ProductCatalog = {
  products: Product[];
};

type ChatAction = {
  type: "OPEN_URL";
  label: string;
  url: string;
};

const bundleCatalog: BundleCatalog = JSON.parse(BUNDLES_JSON);
const productCatalog: ProductCatalog = JSON.parse(PRODUCTS_JSON);

// OpenAI client
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SOVAH_SYSTEM_PROMPT = `
You are the SOVAH skincare assistant for sovahcare.com.

Your job:
- identify the single best SOVAH bundle for the user's goal
- optionally identify one relevant add-on
- keep reasoning internal

Rules:
- never mention suppliers or private label partners
- never make medical claims or diagnoses
- only use the provided BUNDLES JSON and PRODUCTS JSON
- do not include raw URLs
- do not include AM/PM steps
- do not explain ingredients
- do not explain each product in detail
- do not use headings like Best Match, Bundle, Add-on, Benefits, CTA
- if the user is unclear, ask only 1 short question

Output style:
- if clear, answer naturally and briefly
- if unclear, ask 1 short question only
- do not overload the user

Catalogs:
BUNDLES JSON:
${BUNDLES_JSON}

PRODUCTS JSON:
${PRODUCTS_JSON}
`;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsExactName(text: string, name: string): boolean {
  const pattern = new RegExp(`(^|[^\\w&+-])${escapeRegExp(name)}([^\\w&+-]|$)`, "i");
  return pattern.test(text);
}

function findMentionedBundles(text: string): Bundle[] {
  return bundleCatalog.bundles.filter((bundle) => containsExactName(text, bundle.name));
}

function findMentionedProducts(text: string): Product[] {
  return productCatalog.products.filter((product) => containsExactName(text, product.title));
}

function detectAddonFromText(text: string): string | null {
  if (text.includes("AHA Peeling Concentrate")) return "AHA Peeling Concentrate";
  if (text.includes("Acne Spot Care")) return "Acne Spot Care";
  if (text.includes("Smoothing Eye Cream")) return "Smoothing Eye Cream";
  return null;
}

function hasAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function detectIntentFromUserMessage(message: string): string | null {
  const t = (message || "").toLowerCase();

  if (hasAny(t, ["breakout", "breakouts", "acne", "blemish", "blemishes", "spots", "pimples", "blackheads"])) {
    return "breakouts";
  }
  if (hasAny(t, ["glow", "radiance", "dull", "bright", "brighter", "uneven"])) {
    return "glow";
  }
  if (hasAny(t, ["dry", "dehydrated", "tight", "hydration", "flaky", "rough"])) {
    return "dry";
  }
  if (hasAny(t, ["sensitive", "reactive", "redness", "irritated", "barrier"])) {
    return "sensitive";
  }
  if (hasAny(t, ["anti-age", "anti aging", "anti-aging", "fine lines", "firmness", "wrinkles", "aging", "ageing"])) {
    return "antiage";
  }
  if (hasAny(t, ["simple", "minimal", "no-fuss", "easy routine"])) {
    return "simple";
  }
  if (hasAny(t, ["combination", "oily t-zone"])) {
    return "combination";
  }
  if (hasAny(t, ["normal skin", "balanced skin"])) {
    return "normal";
  }
  if (hasAny(t, ["texture", "pores", "bumpy", "exfoliate", "exfoliation"])) {
    return "texture";
  }
  return null;
}

function getBundleByName(name: string): Bundle | undefined {
  return bundleCatalog.bundles.find((bundle) => bundle.name === name);
}

function pickBundleFromIntent(intent: string | null): Bundle | undefined {
  if (intent === "glow" || intent === "texture") {
    return getBundleByName("Glow & Radiance Routine");
  }
  if (intent === "breakouts") {
    return getBundleByName("Clear & Balanced Skin Routine");
  }
  if (intent === "dry") {
    return getBundleByName("Dry & Dehydrated Skin Routine");
  }
  if (intent === "sensitive") {
    return getBundleByName("Sensitive & Reactive Skin Routine");
  }
  if (intent === "antiage") {
    return getBundleByName("Firm & Smooth Skin Routine");
  }
  if (intent === "simple") {
    return getBundleByName("Simple Daily Skincare Routine");
  }
  if (intent === "combination") {
    return getBundleByName("Combination Skin Balance Routine");
  }
  if (intent === "normal") {
    return getBundleByName("Normal & Balanced Skin Routine");
  }
  return undefined;
}

function pickAddonFromIntent(intent: string | null): string | null {
  if (intent === "glow" || intent === "texture") return "AHA Peeling Concentrate";
  if (intent === "breakouts") return "Acne Spot Care";
  if (intent === "antiage") return "Smoothing Eye Cream";
  return null;
}

function shortBundleDescription(bundleName: string): string {
  const map: Record<string, string> = {
    "Dry & Dehydrated Skin Routine": "It is best for dry or dehydrated skin that needs comfort and hydration.",
    "Combination Skin Balance Routine": "It is best for combination skin that needs balance without feeling heavy.",
    "Simple Daily Skincare Routine": "It is best for an easy everyday routine with no unnecessary steps.",
    "Sensitive & Reactive Skin Routine": "It is best for sensitive or reactive skin that needs a gentle routine.",
    "Normal & Balanced Skin Routine": "It is best for normal skin that wants a simple balanced routine.",
    "Glow & Radiance Routine": "It is best for dull or uneven-looking skin that wants more glow.",
    "Firm & Smooth Skin Routine": "It is best for early signs of aging, smoothness, and firmness.",
    "Clear & Balanced Skin Routine": "It is best for oily or blemish-prone skin that needs a fresh lightweight routine.",
  };

  return map[bundleName] || "It looks like the strongest fit from the current range.";
}

function shortAddonDescription(addonName: string): string {
  const map: Record<string, string> = {
    "AHA Peeling Concentrate": "AHA Peeling Concentrate is a good add-on for texture or dullness.",
    "Acne Spot Care": "Acne Spot Care is a good add-on for visible blemishes.",
    "Smoothing Eye Cream": "Smoothing Eye Cream is a good add-on for the eye area.",
  };

  return map[addonName] || "";
}

function buildShortReplyFromSelection(bundle: Bundle, addonName?: string | null): string {
  const parts: string[] = [];

  parts.push(`${bundle.name} looks like the best fit.`);
  parts.push(shortBundleDescription(bundle.name));

  if (bundle.products && bundle.products.length > 0) {
    parts.push(`Included products: ${bundle.products.join(", ")}.`);
  }

  if (addonName) {
    const addonLine = shortAddonDescription(addonName);
    if (addonLine) parts.push(addonLine);
  }

  parts.push("Want me to link you straight to it?");

  return parts.join("\n\n");
}

function buildActionsFromSelection(bundle: Bundle, addonName?: string | null): ChatAction[] {
  const actions: ChatAction[] = [
    {
      type: "OPEN_URL",
      label: "View routine",
      url: bundle.url,
    },
  ];

  if (addonName) {
    const addonProduct = productCatalog.products.find((product) => product.title === addonName);
    if (addonProduct) {
      actions.push({
        type: "OPEN_URL",
        label: "View product",
        url: addonProduct.url,
      });
    }
  }

  return actions.slice(0, 2);
}

function cleanModelText(text: string): string {
  let cleaned = text || "";

  cleaned = cleaned.replace(/https?:\/\/\S+/gi, "").trim();
  cleaned = cleaned.replace(/^\s*[-•]?\s*Best match:?\s*/gim, "");
  cleaned = cleaned.replace(/^\s*[-•]?\s*Best bundle:?\s*/gim, "");
  cleaned = cleaned.replace(/^\s*[-•]?\s*Bundle:?\s*/gim, "");
  cleaned = cleaned.replace(/^\s*[-•]?\s*Add-on(\s*\(optional\))?:?\s*/gim, "");
  cleaned = cleaned.replace(/^\s*[-•]?\s*Benefits:?\s*/gim, "");
  cleaned = cleaned.replace(/^\s*[-•]?\s*Simple AM\s*\/\s*PM order.*$/gim, "");
  cleaned = cleaned.replace(/^\s*[-•]?\s*Quick AM\s*\/\s*PM order.*$/gim, "");
  cleaned = cleaned.replace(/^\s*[-•]?\s*AM:\s.*$/gim, "");
  cleaned = cleaned.replace(/^\s*[-•]?\s*PM:\s.*$/gim, "");
  cleaned = cleaned.replace(/^\s*[-•]\s*/gim, "");
  cleaned = cleaned.replace(/^(Nice|Perfect|Amazing|Great)\s*[—\-–:]?\s*/i, "");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  return cleaned;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message: string | undefined = body?.message;

    if (!message) {
      return new Response(JSON.stringify({ reply: "Missing message.", actions: [] }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const intent = detectIntentFromUserMessage(message);

    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: [
        { role: "system", content: SOVAH_SYSTEM_PROMPT },
        { role: "user", content: message },
      ],
      text: { format: { type: "text" } },
    });

    const rawReply =
      response.output_text ||
      "Sorry — I couldn’t generate a reply just now. Please try again.";

    const cleanedReply = cleanModelText(rawReply);

    // First try: read model selection
    let selectedBundle = findMentionedBundles(cleanedReply)[0];
    let selectedAddon = detectAddonFromText(cleanedReply);

    // Fallback: choose from user intent
    if (!selectedBundle) {
      selectedBundle = pickBundleFromIntent(intent);
    }
    if (!selectedAddon) {
      selectedAddon = pickAddonFromIntent(intent);
    }

    if (selectedBundle) {
      const reply = buildShortReplyFromSelection(selectedBundle, selectedAddon);
      const actions = buildActionsFromSelection(selectedBundle, selectedAddon);

      return new Response(JSON.stringify({ reply, actions }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // If still unclear, keep only a short question
    const fallbackReply = "What’s your skin type: dry, oily, combination, normal, or sensitive?";

    return new Response(JSON.stringify({ reply: fallbackReply, actions: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e: any) {
    console.error("SOVAH /api/chat error:", e);

    return new Response(
      JSON.stringify({
        reply: "Sorry, something went wrong. Try again later.",
        actions: [],
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
}
