import fs from "fs";
import path from "path";

// CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://sovahcare.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// Load catalogs
const bundlesPath = path.join(process.cwd(), "data", "bundle_catalog.json");
const productsPath = path.join(process.cwd(), "data", "product_catalog.json");

const BUNDLES_JSON = fs.readFileSync(bundlesPath, "utf8");
const PRODUCTS_JSON = fs.readFileSync(productsPath, "utf8");

type SkinType = "dry" | "oily" | "combination" | "normal" | "sensitive";
type Goal = "hydration" | "glow" | "antiage" | "breakouts" | "simple";

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

function hasAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function normalize(text: string): string {
  return (text || "").toLowerCase().trim();
}

function detectSkinType(text: string): SkinType | null {
  const t = normalize(text);

  if (t.includes("combination")) return "combination";
  if (t.includes("sensitive") || t.includes("reactive")) return "sensitive";
  if (t.includes("oily") || t.includes("shiny")) return "oily";
  if (t.includes("dry") || t.includes("dehydrated")) return "dry";
  if (t.includes("normal")) return "normal";

  return null;
}

function detectGoal(text: string): Goal | null {
  const t = normalize(text);

  if (hasAny(t, ["breakout", "breakouts", "acne", "blemish", "blemishes", "spots", "pimples", "blackheads"])) {
    return "breakouts";
  }
  if (hasAny(t, ["glow", "radiance", "dull", "bright", "brighter", "uneven", "texture", "pores"])) {
    return "glow";
  }
  if (hasAny(t, ["hydration", "hydrate", "moisture"])) {
    return "hydration";
  }
  if (hasAny(t, ["anti-age", "anti aging", "anti-aging", "fine lines", "firmness", "wrinkles", "aging", "ageing"])) {
    return "antiage";
  }
  if (hasAny(t, ["simple", "minimal", "no-fuss", "easy routine"])) {
    return "simple";
  }

  return null;
}

function detectRoutineRequest(text: string): boolean {
  const t = normalize(text);
  return hasAny(t, [
    "which routine fits me best",
    "what routine fits me best",
    "best routine for me",
    "which routine",
    "what routine",
    "fits me best",
    "help me choose",
    "what do you recommend",
    "recommend me a routine",
    "recommend a routine",
  ]);
}

function getBundleByName(name: string): Bundle | undefined {
  return bundleCatalog.bundles.find((bundle) => bundle.name === name);
}

function getProductByName(name: string): Product | undefined {
  return productCatalog.products.find((product) => product.title === name);
}

function pickBundle(skinType: SkinType | null, goal: Goal | null): Bundle | undefined {
  if (!goal) return undefined;

  if (goal === "breakouts") {
    if (skinType === "oily" || skinType === "combination") {
      return getBundleByName("Clear & Balanced Skin Routine");
    }
    if (skinType === "sensitive") {
      return getBundleByName("Sensitive & Reactive Skin Routine");
    }
    if (skinType === "dry") {
      return getBundleByName("Dry & Dehydrated Skin Routine");
    }
    if (skinType === "normal") {
      return getBundleByName("Clear & Balanced Skin Routine");
    }
    return undefined;
  }

  if (goal === "glow") {
    return getBundleByName("Glow & Radiance Routine");
  }

  if (goal === "antiage") {
    return getBundleByName("Firm & Smooth Skin Routine");
  }

  if (goal === "simple") {
    return getBundleByName("Simple Daily Skincare Routine");
  }

  if (goal === "hydration") {
    if (skinType === "sensitive") return getBundleByName("Sensitive & Reactive Skin Routine");
    if (skinType === "combination") return getBundleByName("Combination Skin Balance Routine");
    return getBundleByName("Dry & Dehydrated Skin Routine");
  }

  return undefined;
}

function pickAddon(skinType: SkinType | null, goal: Goal | null): string | null {
  if (!goal) return null;

  if (goal === "breakouts") return "Acne Spot Care";
  if (goal === "antiage") return "Smoothing Eye Cream";
  if (goal === "glow" && skinType !== "sensitive") return "AHA Peeling Concentrate";

  return null;
}

function shortBundleDescription(bundleName: string): string {
  const map: Record<string, string> = {
    "Dry & Dehydrated Skin Routine": "Best for dry or dehydrated skin that needs comfort and hydration.",
    "Combination Skin Balance Routine": "Best for combination skin that needs balance without feeling heavy.",
    "Simple Daily Skincare Routine": "Best for an easy everyday routine with no unnecessary steps.",
    "Sensitive & Reactive Skin Routine": "Best for sensitive or reactive skin that needs a gentle routine.",
    "Normal & Balanced Skin Routine": "Best for normal skin that wants a simple balanced routine.",
    "Glow & Radiance Routine": "Best for dull or uneven-looking skin that wants more glow.",
    "Firm & Smooth Skin Routine": "Best for early signs of aging, smoothness, and firmness.",
    "Clear & Balanced Skin Routine": "Best for oily or blemish-prone skin that needs a fresh lightweight routine.",
  };

  return map[bundleName] || "A strong fit from the current range.";
}

function shortAddonDescription(addonName: string): string {
  const map: Record<string, string> = {
    "AHA Peeling Concentrate": "A good add-on for texture or dullness.",
    "Acne Spot Care": "A good add-on for visible blemishes.",
    "Smoothing Eye Cream": "A good add-on for the eye area.",
  };

  return map[addonName] || "";
}

function buildReply(bundle: Bundle, addonName?: string | null): string {
  const parts: string[] = [];

  parts.push(bundle.name);
  parts.push(shortBundleDescription(bundle.name));

  if (bundle.products?.length) {
    parts.push(`Included products:\n${bundle.products.map((p) => `- ${p}`).join("\n")}`);
  }

  if (addonName) {
    parts.push(`Add-on: ${addonName}\n${shortAddonDescription(addonName)}`);
  }

  parts.push("Want me to link you straight to it?");

  return parts.join("\n\n");
}

function buildActions(bundle: Bundle, addonName?: string | null): ChatAction[] {
  const actions: ChatAction[] = [
    { type: "OPEN_URL", label: "View routine", url: bundle.url },
  ];

  if (addonName) {
    const addon = getProductByName(addonName);
    if (addon) {
      actions.push({ type: "OPEN_URL", label: "View product", url: addon.url });
    }
  }

  return actions.slice(0, 2);
}

function askSkinType(): string {
  return "What’s your skin type: dry, oily, combination, normal, or sensitive?";
}

function askGoal(): string {
  return "What’s your main goal: hydration, glow, anti-age, breakouts, or simple routine?";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message: string | undefined = body?.message;
    const history: string[] = Array.isArray(body?.history) ? body.history : [];

    if (!message) {
      return new Response(JSON.stringify({ reply: "Missing message.", actions: [] }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Use history + current message together
    const fullHistory = [...history, message].slice(-10);
    const combined = fullHistory.join(" \n ").toLowerCase();

    const wantsRoutine = fullHistory.some((m) => detectRoutineRequest(m));
    const skinType = detectSkinType(combined);
    const goal = detectGoal(combined);

    // Step 1: routine request but no skin type yet
    if (wantsRoutine && !skinType) {
      return new Response(JSON.stringify({ reply: askSkinType(), actions: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Step 2: skin type known but no goal yet
    if (wantsRoutine && skinType && !goal) {
      return new Response(JSON.stringify({ reply: askGoal(), actions: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Breakouts without skin type -> ask first
    if (goal === "breakouts" && !skinType) {
      return new Response(JSON.stringify({ reply: askSkinType(), actions: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // If user sends only a skin type outside routine flow, still ask goal
    if (!wantsRoutine && detectSkinType(message) && !detectGoal(combined)) {
      return new Response(JSON.stringify({ reply: askGoal(), actions: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const bundle = pickBundle(skinType, goal);
    const addon = pickAddon(skinType, goal);

    if (bundle) {
      const reply = buildReply(bundle, addon);
      const actions = buildActions(bundle, addon);

      return new Response(JSON.stringify({ reply, actions }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ reply: askSkinType(), actions: [] }), {
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
