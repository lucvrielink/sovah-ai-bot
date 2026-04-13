import { NextResponse } from "next/server";
import {
  getQuizRecommendation,
  type Concern,
  type Goal,
  type Lang,
  type QuizAnswers,
  type RoutinePreference,
  type SkinType,
} from "@/lib/sovah-recommendation";

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

function isLang(value: unknown): value is Lang {
  return value === "nl" || value === "en";
}

function isSkinType(value: unknown): value is SkinType {
  return [
    "dry",
    "oily",
    "combination",
    "normal",
    "sensitive",
    "unknown",
  ].includes(String(value));
}

function isConcern(value: unknown): value is Concern {
  return [
    "dryness",
    "breakouts",
    "sensitivity",
    "glow",
    "dark_spots",
    "antiage",
    "unknown",
  ].includes(String(value));
}

function isGoal(value: unknown): value is Goal {
  return [
    "hydration",
    "calm",
    "glow",
    "even",
    "firm",
    "simple",
    "unknown",
  ].includes(String(value));
}

function isRoutinePreference(value: unknown): value is RoutinePreference {
  return ["simple", "balanced", "results", "unknown"].includes(String(value));
}

function isSensitivityLevel(value: unknown): value is QuizAnswers["sensitivityLevel"] {
  return ["high", "medium", "low", "unknown"].includes(String(value));
}

export async function POST(req: Request) {
  const corsHeaders = buildCorsHeaders();

  try {
    const body = await req.json();

    const answers: QuizAnswers = {
      lang: isLang(body?.lang) ? body.lang : "en",
      skinType: isSkinType(body?.skinType) ? body.skinType : "unknown",
      concern: isConcern(body?.concern) ? body.concern : "unknown",
      sensitivityLevel: isSensitivityLevel(body?.sensitivityLevel)
        ? body.sensitivityLevel
        : "unknown",
      goal: isGoal(body?.goal) ? body.goal : "unknown",
      routinePreference: isRoutinePreference(body?.routinePreference)
        ? body.routinePreference
        : "unknown",
    };

    const result = getQuizRecommendation(answers);

    return new NextResponse(
      JSON.stringify({
        success: true,
        result: {
          lang: result.lang,
          recommendedBundle: {
            name: result.recommendedBundle.name,
            url: result.recommendedBundle.url,
            description: result.recommendedBundle.description || "",
            products: result.recommendedBundle.products || [],
          },
          addon: result.addon
            ? {
                title: result.addon.title,
                url: result.addon.url,
                handle: result.addon.handle,
              }
            : null,
          reasonShort: result.reasonShort,
          reasonLong: result.reasonLong,
          steps: result.steps,
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
