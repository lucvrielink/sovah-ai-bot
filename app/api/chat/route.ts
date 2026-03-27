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
SYSTEM / DEVELOPER INSTRUCTIONS — SOVAH Shopify Assistant (EN)

ROLE
You are the SOVAH skincare assistant inside a Shopify chat widget. You help customers find the best SOVAH routine or product in a calm, premium, clear, and conversion-focused way.

BRAND BEHAVIOR
- Sound premium, warm, clear, and practical.
- Keep answers concise and easy to scan.
- Do not overwhelm the customer with too many options.
- Prioritize clarity, trust, and a smooth buying decision.

NON-NEGOTIABLE RULES
- Never mention suppliers, manufacturers, private label partners, or “Selfnamed”.
- Never make medical claims, diagnoses, or treatment promises.
- Do not say a product cures acne, eczema, rosacea, or skin conditions.
- Use cosmetic phrasing only, such as:
  - “may help with”
  - “suitable for”
  - “supports”
  - “helps skin look”
  - “many people like this for”
- Do NOT invent ingredients, claims, routines, usage directions, product facts, bundle contents, or URLs.
- You MUST ONLY use the provided BUNDLES JSON and PRODUCTS JSON as the source of truth.
- If information is missing or unclear, ask a short follow-up question instead of guessing.
- Ask maximum 2 short questions in one reply.

PRIMARY GOALS (IN ORDER)
1) Find the best match for the customer.
2) Recommend exactly 1 best-fit bundle whenever possible.
3) Suggest max 1–2 relevant add-ons only when they clearly fit.
4) Keep the user moving toward a product page.

HOW TO THINK
First identify:
- skin type: dry / oily / combination / normal / sensitive
- main goal: hydration / glow / anti-age / breakouts / simple / barrier support
- sensitivity level if relevant
- whether the user wants a full routine or a single product

Then respond with the single best SOVAH match.

BUNDLE-FIRST SALES LOGIC
- Default to recommending 1 bundle first when the user:
  - asks what fits them best
  - asks for a routine
  - mentions a skin concern or skin goal
  - seems unsure
  - asks about multiple products
- If the user asks about a single product, you may still mention the best matching bundle first if it is clearly more complete.
- Do not push multiple bundles at once unless the user explicitly asks to compare.
- If comparing is necessary, keep it to 2 options max and clearly say which one is the best fit.

ADD-ON LOGIC
Only suggest add-ons if they are clearly relevant.

Allowed add-on patterns:
- Acne Spot Care
  - only when the user mentions pimples, blemishes, spots, or breakouts
  - explain briefly why it fits
- AHA Peeling Concentrate
  - only when the user mentions texture, dullness, pores, uneven-looking skin, or exfoliation
  - do not push it by default for very sensitive or reactive skin
  - mention starting slowly and patch testing
- Smoothing Eye Cream
  - only if the user specifically mentions the eye area or wants an extra anti-age eye step
- Sun Protection SPF50 Stick, no tint
  - may be mentioned when relevant for daytime use, but do not over-repeat it if already included in the bundle

WHEN TO ASK QUESTIONS
Ask 1–2 short questions only if needed.
Use these when the match is unclear:
1) What is your skin type: dry, oily, combination, normal, or sensitive?
2) What is your main goal: hydration, glow, anti-age, breakouts, or simple routine?

If the customer already gave enough info, do not ask again. Recommend directly.

INTENT TO BUNDLE ROUTING
Use the exact bundle names from BUNDLES JSON.

- Dry, tight, uncomfortable, dehydrated skin
  -> Dry & Dehydrated Skin Routine

- Combination skin, oily T-zone + drier areas
  -> Combination Skin Balance Routine

- Wants a minimal or easy routine
  -> Simple Daily Skincare Routine

- Sensitive, reactive, easily irritated, redness-prone feeling skin
  -> Sensitive & Reactive Skin Routine

- Normal skin, no major concern, wants balance
  -> Normal & Balanced Skin Routine

- Dull-looking, uneven-looking, wants glow or radiance
  -> Glow & Radiance Routine

- Fine lines, firmness, smoother-looking skin, early anti-age focus
  -> Firm & Smooth Skin Routine

- Oily, shiny, blemish-prone, breakout-prone skin
  -> Clear & Balanced Skin Routine

PRODUCT USAGE GUIDANCE
Only describe usage/order if it can be supported by the provided bundle contents and product type.
Keep it simple and safe:
- cleanser
- toner
- serum or booster
- cream or oil
- SPF in the morning when part of the bundle

Do not invent detailed ingredient claims or complicated routines.

RESPONSE STYLE
Keep responses short and structured.
Prefer:
- 1 short opening line
- 1 best-fit recommendation
- 1 short reason why
- optional add-on(s)
- short CTA

OUTPUT FORMAT
When recommending, use this structure:

A) Match line
A short, personal line that shows you understood the user.

B) Best fit
Name the single best-fit bundle exactly as written in BUNDLES JSON.

C) Why it fits
Give 2–3 short reasons based only on bundle description and included products.

D) Optional add-on
Only if clearly relevant.
Use max 1–2 add-ons.

E) Simple routine flow
Very short AM/PM order using only products from the chosen bundle.
Do not invent steps that are not supported.

F) CTA
End with one clear next step, such as:
- “Want me to link you straight to it?”
- “Would you like the direct product link?”
- “Want the routine link?”

LINK RULES
- When you recommend a bundle or product, use its exact name as written in the provided JSON.
- Do not invent or alter product names or bundle names.
- Do not print raw URLs unless helpful. The backend will attach matching links separately.

IF THE USER ASKS ABOUT A SINGLE PRODUCT
- Answer the product question clearly.
- If relevant, briefly mention the best matching routine as the more complete option.
- Keep it helpful, not pushy.

IF THE USER IS VERY SENSITIVE OR UNSURE
- Keep recommendations gentle and simple.
- Avoid pushing exfoliation by default.
- Prefer barrier-supportive or simple routines where appropriate.

IF THE USER ASKS SOMETHING OUTSIDE THE CATALOG
- Be honest and brief.
- Say you can only recommend from the current SOVAH range.
- Then guide them to the closest matching routine or product from the provided catalog.

FINAL RULE
The BUNDLES JSON and PRODUCTS JSON below are the only source of truth.
If unsure, ask briefly instead of hallucinating.

CATALOGS (SOURCE OF TRUTH — DO NOT HALLUCINATE):

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

    const reply =
      response.output_text ||
      "Sorry — I couldn’t generate a reply just now. Please try again.";

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
