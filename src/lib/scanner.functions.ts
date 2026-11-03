import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { imageDataUrlSchema, isTrialActive } from "@/lib/scanner";
import {
  identifyFoodWithGemini,
  lookupFoodNutrition,
  lookupFoodNutritionById,
  scaleNutrition,
} from "@/lib/scanner-nutrition.server";

const SCAN_COLUMNS =
  "id, food_name, portion, portion_g, calories, protein_g, carbs_g, fat_g, fibre_g, sugar_g, confidence, notes, created_at, fdc_id, nutrition_source, nutrition_reference";

/** Starts (once) and returns the student's free month of HUNGRY SCANNER v1.0. */
export const getScannerAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("hungry_start_scanner_trial");
    if (error) {
      if (error.message.includes("students_only"))
        return {
          ok: false as const,
          message: "HUNGRY SCANNER is available to student accounts only.",
        };
      throw new Error("Could not load your scanner access. Please try again.");
    }
    const row = data as { started_at: string; expires_at: string; version: string };
    return {
      ok: true as const,
      startedAt: row.started_at,
      expiresAt: row.expires_at,
      version: row.version,
      active: isTrialActive(row.expires_at),
    };
  });

export const listFoodScans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("food_scans")
      .select(SCAN_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("Could not load scan history.");
    return data ?? [];
  });

export const deleteFoodScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("food_scans").delete().eq("id", data.id);
    if (error) throw new Error("Could not delete this scan.");
    return { ok: true };
  });

export const scanFood = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ image: imageDataUrlSchema }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: access, error: accessError } = await context.supabase.rpc(
      "hungry_start_scanner_trial",
    );
    if (accessError) {
      if (accessError.message.includes("students_only"))
        return {
          ok: false as const,
          message: "HUNGRY SCANNER is available to student accounts only.",
        };
      return {
        ok: false as const,
        message: "We couldn't verify scanner access. Please try again.",
      };
    }
    const accessRow = access as { expires_at: string };
    if (!isTrialActive(accessRow.expires_at))
      return { ok: false as const, message: "Your free month of HUNGRY SCANNER has ended." };

    let identification;
    try {
      identification = await identifyFoodWithGemini(data.image);
    } catch (error) {
      return {
        ok: false as const,
        message:
          error instanceof Error
            ? error.message
            : "We couldn't analyse this photo. Please try again.",
      };
    }
    if (!identification.is_food)
      return {
        ok: false as const,
        message: identification.notes || "No food detected in this photo.",
      };

    let match = null;
    try {
      match = await lookupFoodNutrition(identification.food_name);
    } catch (error) {
      console.error(
        "Food nutrition lookup failed",
        error instanceof Error ? error.message : "unknown error",
      );
      return {
        ok: false as const,
        message:
          error instanceof Error ? error.message : "Nutrition lookup is temporarily unavailable.",
      };
    }

    const nutrients = match ? scaleNutrition(match.per100g, identification.portion_g) : null;
    const note = match
      ? identification.notes
      : [
          identification.notes,
          "No verified nutrition match was found in the nutrition database; nutrient values are not shown.",
        ]
          .filter(Boolean)
          .join(" ");
    const { data: row, error } = await context.supabase
      .from("food_scans")
      .insert({
        user_id: context.userId,
        food_name: identification.food_name,
        portion: `${identification.portion_g} g`,
        portion_g: identification.portion_g,
        calories: nutrients?.calories ?? null,
        protein_g: nutrients?.protein_g ?? null,
        carbs_g: nutrients?.carbs_g ?? null,
        fat_g: nutrients?.fat_g ?? null,
        fibre_g: nutrients?.fibre_g ?? null,
        sugar_g: nutrients?.sugar_g ?? null,
        confidence: identification.confidence,
        notes: note,
        fdc_id: match?.fdcId ?? null,
        nutrition_source: match ? "USDA FoodData Central" : null,
        nutrition_reference: match ? `${match.description} (FDC ${match.fdcId}, per 100 g)` : null,
      })
      .select(SCAN_COLUMNS)
      .single();
    if (error || !row) {
      console.error("Food scan save failed", error?.code ?? "unknown");
      return {
        ok: false as const,
        message: "Scan analysed but could not be saved. Please try again.",
      };
    }
    return { ok: true as const, scan: row };
  });

export const updateFoodScanPortion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), portionG: z.number().int().min(1).max(3000) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: existing, error: readError } = await context.supabase
      .from("food_scans")
      .select("fdc_id, food_name")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (readError || !existing) return { ok: false as const, message: "Could not load this scan." };
    if (!existing.fdc_id)
      return { ok: false as const, message: "There is no verified database match to recalculate." };

    let match;
    try {
      match = await lookupFoodNutritionById(existing.fdc_id);
    } catch (error) {
      return {
        ok: false as const,
        message:
          error instanceof Error ? error.message : "Nutrition lookup is temporarily unavailable.",
      };
    }
    if (!match)
      return {
        ok: false as const,
        message: "This database record does not contain all required nutrients.",
      };
    const nutrients = scaleNutrition(match.per100g, data.portionG);
    const { data: row, error } = await context.supabase
      .from("food_scans")
      .update({
        portion_g: data.portionG,
        portion: `${data.portionG} g`,
        calories: nutrients.calories,
        protein_g: nutrients.protein_g,
        carbs_g: nutrients.carbs_g,
        fat_g: nutrients.fat_g,
        fibre_g: nutrients.fibre_g,
        sugar_g: nutrients.sugar_g,
      })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select(SCAN_COLUMNS)
      .single();
    if (error || !row)
      return { ok: false as const, message: "Could not save the corrected portion." };
    return { ok: true as const, scan: row };
  });
