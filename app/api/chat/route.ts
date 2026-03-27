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
- Most replies should be 2 to 4 short paragraphs max.

How to respond:
- If the user is clear, recommend directly.
- If the user is unclear, ask only 1 short question.
- Do not try to do the full sales flow in one reply.
- Do not give routine steps unless the user asks how to use it.
- Do not give more than 1 add-on.
- Prefer recommending 1 best-fit routine when the user asks about a goal, concern, or what fits them best.
- If a single product is more relevant, answer that directly.
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

It’s the strongest match for dull or uneven-looking skin and keeps the routine fresh, simple, and glow-focused.

If you want an extra targeted step, AHA Peeling Concentrate can also be a good add-on for texture or dullness.

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

function formatShortReply(reply: string): string {
  const text = cleanReply(reply);

  const bundle = findMentionedBundles(text)[0];
  const addon =
    text.includes("AHA Peeling Concentrate")
      ? "AHA Peeling Concentrate"
      : text.includes("Acne Spot Care")
        ? "Acne Spot Care"
        : text.includes("Smoothing Eye Cream")
          ? "Smoothing Eye Cream"
          : null;

  if (bundle) {
    const reasonMap: Record<string, string> = {
      "Glow & Radiance Routine":
        "It’s the strongest match for dull or uneven-looking skin and keeps the routine fresh, simple, and glow-focused.",
      "Clear & Balanced Skin Routine":
        "It’s the strongest match for oily or blemish-prone skin and keeps the routine lightweight and balanced.",
      "Dry & Dehydrated Skin Routine":
        "It suits skin that feels dry, tight, or low on hydration and keeps the routine comforting and simple.",
      "Sensitive & Reactive Skin Routine":
        "It’s the safest match for skin that feels delicate, reactive, or easily irritated.",
      "Firm & Smooth Skin Routine":
        "It’s the strongest match for smoother-looking skin, early fine lines, and firmness.",
      "Simple Daily Skincare Routine":
        "It’s ideal if you want an easy routine without unnecessary steps.",
      "Combination Skin Balance Routine":
        "It’s designed for skin that feels oilier in some areas and drier in others, without feeling heavy.",
      "Normal & Balanced Skin Routine":
        "It’s a strong everyday option if your skin feels fairly balanced and you want a simple routine.",
    };

    const addonMap: Record<string, string> = {
      "AHA Peeling Concentrate":
        "If you want an extra targeted step, AHA Peeling Concentrate can be a good add-on for texture or dullness.",
      "Acne Spot Care":
        "If you want an extra targeted step, Acne Spot Care is a good add-on for visible blemishes.",
      "Smoothing Eye Cream":
        "If you want an extra targeted step for the eye area, Smoothing Eye Cream is a good add-on.",
    };

    const parts = [
      `${bundle.name} looks like the best fit.`,
      reasonMap[bundle.name] || "It looks like the strongest overall match from the current range.",
    ];

    if (addon && addonMap[addon]) {
      parts.push(addonMap[addon]);
    }

    parts.push("Want me to link you straight to it?");

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
