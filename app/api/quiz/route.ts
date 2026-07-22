import { NextResponse } from "next/server";
import {
  getQuizRecommendation,
  type Addon,
  type Bundle,
  type Concern,
  type Goal,
  type Lang,
  type QuizAnswers,
  type RoutinePreference,
  type SkinType,
} from "../../../lib/sovah-recommendation";

function buildCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(),
  });
}

const VALID_LANGS = ["nl", "en"] as const;

const VALID_SKIN_TYPES = [
  "dry",
  "oily",
  "combination",
  "normal",
  "sensitive",
  "unknown",
] as const;

const VALID_CONCERNS = [
  "dryness",
  "breakouts",
  "sensitivity",
  "glow",
  "dark_spots",
  "antiage",
  "unknown",
] as const;

const VALID_GOALS = [
  "hydration",
  "calm",
  "glow",
  "even",
  "firm",
  "simple",
  "unknown",
] as const;

const VALID_ROUTINE_PREFERENCES = [
  "simple",
  "balanced",
  "results",
  "unknown",
] as const;

const VALID_SENSITIVITY_LEVELS = [
  "high",
  "medium",
  "low",
  "unknown",
] as const;

function isOneOf<T extends readonly string[]>(
  value: unknown,
  validValues: T
): value is T[number] {
  return typeof value === "string" && validValues.includes(value);
}

function normalizeQuizAnswers(body: unknown): QuizAnswers {
  const data =
    body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : {};

  return {
    lang: isOneOf(data.lang, VALID_LANGS) ? (data.lang as Lang) : "en",

    skinType: isOneOf(data.skinType, VALID_SKIN_TYPES)
      ? (data.skinType as SkinType)
      : "unknown",

    concern: isOneOf(data.concern, VALID_CONCERNS)
      ? (data.concern as Concern)
      : "unknown",

    sensitivityLevel: isOneOf(
      data.sensitivityLevel,
      VALID_SENSITIVITY_LEVELS
    )
      ? data.sensitivityLevel
      : "unknown",

    goal: isOneOf(data.goal, VALID_GOALS)
      ? (data.goal as Goal)
      : "unknown",

    routinePreference: isOneOf(
      data.routinePreference,
      VALID_ROUTINE_PREFERENCES
    )
      ? (data.routinePreference as RoutinePreference)
      : "unknown",
  };
}

function cleanRecommendedBundle(bundle: Bundle) {
  return {
    name: bundle?.name || "",
    url: bundle?.url || "",
    handle: bundle?.handle || null,
    variantId: bundle?.variantId ?? null,
    image: bundle?.image || null,
    price: bundle?.price || null,
    description: bundle?.description || "",
    products: Array.isArray(bundle?.products) ? bundle.products : [],
  };
}

function cleanAddon(addon: Addon | null) {
  if (!addon) return null;

  return {
    title: addon?.title || "",
    url: addon?.url || "",
    handle: addon?.handle || null,
    variantId: addon?.variantId ?? null,
    image: addon?.image || null,
    price: addon?.price || null,
    description: addon?.description || "",
  };
}

export async function POST(req: Request) {
  const corsHeaders = buildCorsHeaders();

  try {
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: "Invalid JSON body.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    const answers = normalizeQuizAnswers(body);
    const result = getQuizRecommendation(answers);

    if (!result || !result.recommendedBundle) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: "No recommendation could be created.",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    return new NextResponse(
      JSON.stringify({
        success: true,
        result: {
          lang: result.lang || answers.lang,
          recommendedBundle: cleanRecommendedBundle(result.recommendedBundle),
          addon: cleanAddon(result.addon),
          reasonShort: result.reasonShort || "",
          reasonLong: result.reasonLong || "",
          steps: Array.isArray(result.steps) ? result.steps : [],
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error("SOVAH /api/quiz error:", error);

    return new NextResponse(
      JSON.stringify({
        success: false,
        error: "Something went wrong.",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
}
