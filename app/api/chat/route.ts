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

Tone:
- premium
- warm
- natural
- concise

Core rules:
- Keep replies short.
- Do not overload the user.
- Never mention suppliers, manufacturers, private label partners, or Selfnamed.
- Never make medical claims or diagnoses.
- Only use the provided BUNDLES JSON and PRODUCTS JSON as the source of truth.
- Do not invent products, claims, ingredients, or usage directions.
- Do not include raw URLs in the reply.
- The backend adds buttons separately.
- Do not use headings like:
  - "Best bundle"
  - "Best match"
  - "Add-on"
  - "AM / PM"
  - "CTA"
- Do not use bullet points unless the user explicitly asks for a list.
- Most replies should be short.

How to respond:
- If the user is clear, recommend directly.
- If the user is unclear, ask only 1 short question.
- Do not try to do everything in one reply.
- Do not include routine steps.
- Do not include AM/PM order.
- Do not describe ingredients.
- Do not explain every product in the bundle.
- For bundles:
  - say the bundle name
  - say very briefly what it is best for
  - list the included product names only
- For add-ons:
  - mention at most 1 add-on
  - give only a very short reason what it is for
- End with one short natural next step.

Routine mapping:
- Dry, dehydrated, tight -> Dry & Dehydrated Skin Routine
- Combination skin -> Combination Skin Balance Routine
- Sensitive, reactive, redness-prone -> Sensitive & Reactive Skin Routine
- Normal, balanced -> Normal & Balanced Skin Routine
- Dull, uneven, wants glow -> Glow & Radiance Routine
- Fine lines, firmness, early anti-age -> Firm & Smooth Skin Routine
- Oily, shiny, blemish-prone, breakout-prone -> Clear & Balanced Skin Routine
- Wants minimal, easy routine -> Simple Daily Skincare Routine

Add-ons:
- Acne Spot Care only for breakouts, blemishes, pimples, spots
- AHA Peeling Concentrate only for texture, dullness, pores, uneven-looking skin, exfoliation
- Smoothing Eye Cream only for eye-area or extra anti-age eye step

Good example:
User: "I want more glow"

Reply:
"Glow & Radiance Routine looks like the best fit.

It is best for dull or uneven-looking skin that wants more glow.

Included products: Micellar Cleansing Water, Vitamin C Serum, Antioxidant Ginkgo Gel Booster, Moisturising Day Cream, Sun Protection SPF50 Stick, no tint.

AHA Peeling Concentrate is a good add-on for texture or dullness.

Want me to link you straight to it?"

If unclear:
Ask only 1 short question.

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

function cleanReply(reply: string): string {
  let cleaned = reply || "";

  cleaned = cleaned.replace(/https?:\/\/\S+/gi, "").trim();

  cleaned = cleaned.replace(/^\s*[-•]?\s*Best match:?\s*/gim, "");
  cleaned = cleaned.replace(/^\s*[-•]?\s*Best bundle:?\s*/gim, "");
  cleaned = cleaned.replace(/^\s*[-•]?\s*Bundle:?\s*/gim, "");
  cleaned = cleaned.replace(/^\s*[-•]?\s*Add-on(\s*\(optional\))?:?\s*/gim, "");
  cleaned = cleaned.replace(/^\s*[-•]?\s*Benefits:?\s*/gim, "");
  cleaned = cleaned.replace(/^\s*[-•]?\s*Quick question:.*$/gim, "");
  cleaned = cleaned.replace(/^\s*[-•]?\s*Simple AM\s*\/\s*PM order.*$/gim, "");
  cleaned = cleaned.replace(/^\s*[-•]?\s*Quick AM\s*\/\s*PM order.*$/gim, "");
  cleaned = cleaned.replace(/^\s*[-•]?\s*AM:\s.*$/gim, "");
  cleaned = cleaned.replace(/^\s*[-•]?\s*PM:\s.*$/gim, "");
  cleaned = cleaned.replace(/^\s*[-•]\s*/gim, "");
  cleaned = cleaned.replace(/^(Nice|Perfect|Amazing|Great)\s*[—\-–:]?\s*/i, "");

  const hasBundleName =
    cleaned.includes("Glow & Radiance Routine") ||
    cleaned.includes("Clear & Balanced Skin Routine") ||
    cleaned.includes("Dry & Dehydrated Skin Routine") ||
    cleaned.includes("Sensitive & Reactive Skin Routine") ||
    cleaned.includes("Simple Daily Skincare Routine") ||
    cleaned.includes("Combination Skin Balance Routine") ||
    cleaned.includes("Normal & Balanced Skin Routine") ||
    cleaned.includes("Firm & Smooth Skin Routine");

  if (hasBundleName) {
    cleaned = cleaned.replace(/^Quick question:.*$/gim, "").trim();
    cleaned = cleaned.replace(/^Do you have sensitive.*$/gim, "").trim();
    cleaned = cleaned.replace(/^Is your skin sensitive.*$/gim, "").trim();
  }

  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  return cleaned;
}

function getAddonName(text: string): string | null {
  if (text.includes("AHA Peeling Concentrate")) return "AHA Peeling Concentrate";
  if (text.includes("Acne Spot Care")) return "Acne Spot Care";
  if (text.includes("Smoothing Eye Cream")) return "Smoothing Eye Cream";
  return null;
}

function formatShortReply(reply: string): string {
  const text = cleanReply(reply);

  const bundle = findMentionedBundles(text)[0];
  const addon = getAddonName(text);

  if (bundle) {
    const desc = bundle.description || "A strong match from the current range.";
    const productNames = (bundle.products || []).join(", ");

    const addonMap: Record<string, string> = {
      "AHA Peeling Concentrate": "AHA Peeling Concentrate is a good add-on for texture or dullness.",
      "Acne Spot Care": "Acne Spot Care is a good add-on for visible blemishes.",
      "Smoothing Eye Cream": "Smoothing Eye Cream is a good add-on for the eye area.",
    };

    const parts = [
      `${bundle.name} looks like the best fit.`,
      desc,
      productNames ? `Included products: ${productNames}.` : "",
      addon && addonMap[addon] ? addonMap[addon] : "",
      "Want me to link you straight to it?",
    ].filter(Boolean);

    return parts.join("\n\n").trim();
  }

  return text;
}

function buildActions(reply: string): ChatAction[] {
  const actions: ChatAction[] = [];

  const mentionedBundles = findMentionedBundles(reply);
  const mentionedProducts = findMentionedProducts(reply);

  if (mentionedBundles.length > 0) {
    const bundle = mentionedBundles[0];
    actions.push({
      type: "OPEN_URL",
      label: "View routine",
      url: bundle.url,
    });
  }

  const bundleProductNames = new Set(
    mentionedBundles.flatMap((bundle) => bundle.products || [])
  );

  const standaloneProduct = mentionedProducts.find(
    (product) => !bundleProductNames.has(product.title)
  );

  if (standaloneProduct) {
    actions.push({
      type: "OPEN_URL",
      label: "View product",
      url: standaloneProduct.url,
    });
  }

  return actions.slice(0, 2);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message: string | undefined = body?.message;
    const sessionId: string | undefined = body?.sessionId;

    if (!message) {
      return new Response(JSON.stringify({ reply: "Missing message.", actions: [] }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: [
        { role: "system", content: SOVAH_SYSTEM_PROMPT },
        { role: "user", content: message },
      ],
      text: { format: { type: "text" } },
      metadata: sessionId ? { sessionId } : undefined,
    });

    const rawReply =
      response.output_text ||
      "Sorry — I couldn’t generate a reply just now. Please try again.";

    const reply = formatShortReply(rawReply);
    const actions = buildActions(reply);

    return new Response(JSON.stringify({ reply, actions }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e: any) {
    console.error("SOVAH /api/chat error:", e);

    return new Response(
      JSON.stringify({
        reply: "SERVER ERROR: " + (e?.message || "unknown"),
        actions: [],
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
}
