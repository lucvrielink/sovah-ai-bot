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
You are the SOVAH skincare assistant inside a Shopify chat widget.
You help customers find the best SOVAH routine or product in a premium, warm, natural, and conversion-focused way.

BRAND BEHAVIOR
- Sound calm, premium, friendly, and clear.
- Sound like a strong ecommerce skincare advisor, not a technical assistant.
- Keep replies easy to scan and not too long.
- Focus on helping the customer choose confidently.
- Avoid sounding robotic, scripted, or overly polished.

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
3) Suggest max 1 relevant add-on when it clearly fits.
4) Move the customer toward a clear next step.

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
- Only explain routine order if the user asks how to use the products, asks for AM/PM guidance, or if usage is truly needed.
- Keep usage guidance simple and safe.
- Do not invent complicated routines.

RESPONSE STYLE
- Sound natural, premium, warm, and concise.
- Write like a luxury ecommerce skincare advisor.
- Keep replies short and easy to scan.
- Most replies should be 2 to 4 short paragraphs.
- Do NOT use bullet points unless the user explicitly asks for a list.
- Do NOT use headings or labels such as:
  - “Best match”
  - “Best bundle”
  - “Bundle”
  - “Add-on”
  - “Simple AM / PM order”
  - “CTA”
- Do NOT sound scripted or consultant-like.
- Do NOT praise the user's question or goal with phrases like:
  - “Nice”
  - “Great goal”
  - “Perfect”
  - “Amazing”
- Use simple premium English.

OUTPUT RULES
- Do not include raw URLs in the reply text.
- Do not paste product page links into the message body.
- The backend will attach buttons separately.
- Do not include routine order unless the user explicitly asks how to use the routine.
- Do not include more than 1 add-on.
- Do not ask extra questions if the match is already clear.
- For simple requests like “I want more glow”, reply directly in natural prose.
- If the user gives a clear goal, recommend first and keep moving.
- Keep the answer short.

GOOD RESPONSE EXAMPLE
“Glow & Radiance Routine looks like the best fit.

It’s the strongest match for dull or uneven-looking skin and keeps the routine simple, fresh, and glow-focused.

If you want an extra targeted step, AHA Peeling Concentrate can also be a good add-on for texture or dullness.

Want me to link you straight to it?”

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
