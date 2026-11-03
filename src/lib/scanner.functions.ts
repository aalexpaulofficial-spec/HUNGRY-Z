import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { imageDataUrlSchema, isTrialActive } from "@/lib/scanner";
import {
  identifyFoodsWithGemini,
  lookupUsdaNutrition,
  type ScannerFoodResult,
} from "@/lib/scanner-nutrition.server";

/** Starts (once) and returns the student's free month of HUNGRY Z SCANNER v1.0. */
export const getScannerAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("hungry_start_scanner_trial");
    if (error) {
      if (error.message.includes("students_only"))
        return { ok: false as const, message: "HUNGRY Z SCANNER is available to student accounts only." };
      throw new Error("Could not load your scanner access. Please try again.");
    }
    const row = data as { started_at: string; expires_at: string; version: string };
    return { ok: true as const, startedAt: row.started_at, expiresAt: row.expires_at, version: row.version, active: isTrialActive(row.expires_at) };
  });

async function analyzeFood(foodName: string, portionG: number, confidence: "low" | "medium" | "high", notes: string): Promise<ScannerFoodResult> {
  let nutrition;
  try {
    nutrition = await lookupUsdaNutrition(foodName, portionG);
  } catch (error) {
    const providerMessage = error instanceof Error ? error.message : "Nutrition lookup is temporarily unavailable.";
    const safeMessage = providerMessage.includes("USDA_FDC_API_KEY")
      ? "Verified nutrition lookup is not configured yet. No nutrition values are shown."
      : providerMessage.includes("No reliable USDA")
        ? providerMessage
        : "Verified nutrition lookup is temporarily unavailable. No nutrition values are shown.";
    return {
      id: crypto.randomUUID(), food_name: foodName, portion: `${portionG} g`, portion_g: portionG,
      calories: null, protein_g: null, carbs_g: null, fat_g: null, fibre_g: null, sugar_g: null,
      confidence, notes: `${notes}${notes ? " " : ""}${safeMessage}`,
      nutrition_source: null, nutrition_reference: null,
    };
  }
  return {
    id: crypto.randomUUID(), food_name: foodName, portion: `${portionG} g`, portion_g: portionG,
    ...nutrition.values, confidence, notes,
    nutrition_source: nutrition.source, nutrition_reference: nutrition.reference,
  };
}

export const scanFood = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ image: imageDataUrlSchema }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: access, error } = await context.supabase.rpc("hungry_start_scanner_trial");
    if (error) {
      if (error.message.includes("students_only")) return { ok: false as const, message: "HUNGRY Z SCANNER is available to student accounts only." };
      return { ok: false as const, message: "We couldn't verify scanner access. Please retry." };
    }
    if (!isTrialActive((access as { expires_at: string }).expires_at))
      return { ok: false as const, message: "Your free month of HUNGRY Z SCANNER has ended." };
    try {
      const identified = await identifyFoodsWithGemini(data.image);
      if (!identified.length) return { ok: false as const, message: "No food was detected. Try a clearer food photo." };
      const confidenceRank = { low: 1, medium: 2, high: 3 } as const;
      const unique = new Map<string, (typeof identified)[number]>();
      for (const item of identified) {
        const key = item.food_name.toLowerCase().replace(/\bveg\b/g, "vegetable").replace(/[^a-z0-9]+/g, " ").trim();
        const old = unique.get(key);
        if (!old) unique.set(key, item);
        else {
          old.portion_g = Math.min(3000, old.portion_g + item.portion_g);
          if (confidenceRank[item.confidence] > confidenceRank[old.confidence]) old.confidence = item.confidence;
          old.notes = [old.notes, item.notes].filter(Boolean).join(" ").slice(0, 400);
        }
      }
      const scans = await Promise.all([...unique.values()].map((item) => analyzeFood(item.food_name, item.portion_g, item.confidence, item.notes)));
      return { ok: true as const, scans };
    } catch (error) {
      return { ok: false as const, message: error instanceof Error ? error.message : "We couldn't analyse this photo. Please retry." };
    }
  });

/** Requeries the licensed provider for edits. The result remains in memory only. */
export const updateFoodScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ foodName: z.string().trim().min(1).max(120), portionG: z.number().int().min(1).max(3000), confidence: z.enum(["low", "medium", "high"]).default("medium"), notes: z.string().max(400).default("") }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: access, error } = await context.supabase.rpc("hungry_start_scanner_trial");
    if (error || !isTrialActive((access as { expires_at: string } | null)?.expires_at ?? ""))
      return { ok: false as const, message: "Your scanner access is unavailable or has ended. Please reload the scanner." };
    try {
      return { ok: true as const, scan: await analyzeFood(data.foodName, data.portionG, data.confidence, data.notes) };
    } catch (error) {
      return { ok: false as const, message: error instanceof Error ? error.message : "Could not look up the corrected food." };
    }
  });
