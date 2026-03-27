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

type SessionState = {
  wantsRoutine?: boolean;
  skinType?: SkinType;
  goal?: Goal;
  updatedAt: number;
};

const bundleCatalog: BundleCatalog = JSON.parse(BUNDLES_JSON);
const productCatalog: ProductCatalog = JSON.parse(PRODUCTS_JSON);

// Simple in-memory session store
const sessionStore = new Map<string, SessionState>();
const SESSION_TTL_MS = 1000 * 60 * 30; // 30 min

function cleanupSessions() {
  const now = Date.now();
  for (const [key, value] of sessionStore.entries()) {
    if (now - value.updatedAt > SESSION_TTL_MS) {
      sessionStore.delete(key);
    }
  }
}

function getSession(sessionId?: string): SessionState {
  cleanupSessions();

  if (!sessionId) {
    return { updatedAt: Date.now() };
  }

  const existing = sessionStore.get(sessionId);
  if (existing) {
    existing.updatedAt = Date.now();
    return existing;
  }

  const created: SessionState = { updatedAt: Date.now() };
  sessionStore.set(sessionId, created);
  return created;
}

function saveSession(sessionId: string | undefined, state: SessionState) {
  if (!sessionId) return;
  state.updatedAt = Date.now();
  sessionStore.set(sessionId, state);
}

function hasAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function normalizeMessage(message: string): string {
  return (message || "").toLowerCase().trim();
}

function detectSkinType(message: string): SkinType | null {
  const t = normalizeMessage(message);

  if (t.includes("combination")) return "combination";
  if (t.includes("sensitive") || t.includes("reactive")) return "sensitive";
  if (t.includes("oily") || t.includes("shiny")) return "oily";
  if (t.includes("dry") || t.includes("dehydrated")) return "dry";
  if (t.includes("normal")) return "normal";

  return null;
}

function detectGoal(message: string): Goal | null {
  const t = normalizeMessage(message);

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

function detectRoutineRequest(message: string): boolean {
  const t = normalizeMessage(message);
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

function pickBundle(skinType: SkinType | undefined, goal: Goal | undefined): Bundle | undefined {
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

function pickAddon(skinType: SkinType | undefined, goal: Goal | undefined): string | null {
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

function buildShortReplyFromSelection(bundle: Bundle, addonName?: string | null): string {
  const parts: string[] = [];

  parts.push(bundle.name);
  parts.push(shortBundleDescription(bundle.name));

  if (bundle.products && bundle.products.length > 0) {
    parts.push(
      `Included products:\n${bundle.products.map((product) => `- ${product}`).join("\n")}`
    );
  }

  if (addonName) {
    parts.push(`Add-on: ${addonName}\n${shortAddonDescription(addonName)}`);
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
    const addonProduct = getProductByName(addonName);
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
    const sessionId: string | undefined = body?.sessionId;

    if (!message) {
      return new Response(JSON.stringify({ reply: "Missing message.", actions: [] }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const state = getSession(sessionId);

    const skinType = detectSkinType(message);
    const goal = detectGoal(message);
    const wantsRoutine = detectRoutineRequest(message);

    if (skinType) {
      state.skinType = skinType;
    }

    if (goal) {
      state.goal = goal;
    }

    if (wantsRoutine) {
      state.wantsRoutine = true;
    }

    // Step-by-step routine flow
    if (state.wantsRoutine) {
      if (!state.skinType) {
        saveSession(sessionId, state);
        return new Response(JSON.stringify({ reply: askSkinType(), actions: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      if (!state.goal) {
        saveSession(sessionId, state);
        return new Response(JSON.stringify({ reply: askGoal(), actions: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const bundle = pickBundle(state.skinType, state.goal);
      const addon = pickAddon(state.skinType, state.goal);

      if (bundle) {
        const reply = buildShortReplyFromSelection(bundle, addon);
        const actions = buildActionsFromSelection(bundle, addon);

        state.wantsRoutine = false;
        saveSession(sessionId, state);

        return new Response(JSON.stringify({ reply, actions }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // Breakouts need skin type first
    if (goal === "breakouts" && !state.skinType) {
      saveSession(sessionId, state);
      return new Response(JSON.stringify({ reply: askSkinType(), actions: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // If user sends only skin type outside the routine flow, ask goal
    if (skinType && !goal) {
      saveSession(sessionId, state);
      return new Response(JSON.stringify({ reply: askGoal(), actions: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Direct clear recommendation
    const directBundle = pickBundle(state.skinType, state.goal);
    const directAddon = pickAddon(state.skinType, state.goal);

    if (directBundle && state.goal) {
      const reply = buildShortReplyFromSelection(directBundle, directAddon);
      const actions = buildActionsFromSelection(directBundle, directAddon);
      saveSession(sessionId, state);

      return new Response(JSON.stringify({ reply, actions }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    saveSession(sessionId, state);

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
