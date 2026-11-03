import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { imageDataUrlSchema, isTrialActive } from "@/lib/scanner";
import {
  identifyFoodsWithGemini,
  lookupFoodNutrition,
  scaleNutrition,
} from "@/lib/scanner-nutrition.server";

const SCAN_COLUMNS =
  "id, user_id, food_name, portion, portion_g, calories, protein_g, carbs_g, fat_g, fibre_g, sugar_g, confidence, notes, created_at, fdc_id, nutrition_source, nutrition_reference, scan_group_id";

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
      .limit(100);
    if (error) throw new Error("Could not load scan history.");
    return data ?? [];
  });

export const deleteFoodScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("food_scans")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
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
        message: "We couldn't verify scanner access. Please retry.",
      };
    }
    const accessRow = access as { expires_at: string };
    if (!isTrialActive(accessRow.expires_at))
      return { ok: false as const, message: "Your free month of HUNGRY SCANNER has ended." };

    let identifiedFoods;
    try {
      identifiedFoods = await identifyFoodsWithGemini(data.image);
    } catch (error) {
      return {
        ok: false as const,
        message:
          error instanceof Error ? error.message : "We couldn't analyse this photo. Please retry.",
      };
    }
    if (identifiedFoods.length === 0)
      return { ok: false as const, message: "No food was detected. Try a clearer food photo." };

    const confidenceRank = { low: 1, medium: 2, high: 3 } as const;
    const uniqueFoods = new Map<string, (typeof identifiedFoods)[number]>();
    for (const item of identifiedFoods) {
      const key = item.food_name
        .toLowerCase()
        .replace(/\bveg\b/g, "vegetable")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
      const existing = uniqueFoods.get(key);
      if (!existing) {
        uniqueFoods.set(key, item);
        continue;
      }
      existing.portion_g = Math.min(3000, existing.portion_g + item.portion_g);
      if (confidenceRank[item.confidence] > confidenceRank[existing.confidence])
        existing.confidence = item.confidence;
      existing.notes = [existing.notes, item.notes].filter(Boolean).join(" ").slice(0, 400);
    }
    const foodsToSave = [...uniqueFoods.values()];

    const scanGroupId = crypto.randomUUID();
    const rows = await Promise.all(
      foodsToSave.map(async (item) => {
        let match = null;
        let lookupError = "";
        try {
          match = await lookupFoodNutrition(item.food_name);
        } catch (error) {
          lookupError = error instanceof Error ? error.message : "Nutrition lookup failed.";
          console.error("Food nutrition lookup failed", {
            foodName: item.food_name,
            message: lookupError,
          });
        }

        const nutrients = match ? scaleNutrition(match.per100g, item.portion_g) : null;
        const missingNutrients = nutrients
          ? Object.entries(nutrients)
              .filter(([, value]) => value === null)
              .map(([name]) => name.replace(/_g$/, ""))
          : [];
        const exactRecord =
          match?.description.trim().toLowerCase() === item.food_name.trim().toLowerCase();
        const notes = [
          item.notes,
          lookupError,
          !match && !lookupError
            ? "No suitable verified USDA FoodData Central match was found; nutrition values are unavailable."
            : "",
          missingNutrients.length
            ? `This USDA record does not report: ${missingNutrients.join(", ")}.`
            : "",
        ]
          .filter(Boolean)
          .join(" ")
          .slice(0, 1000);

        return {
          user_id: context.userId,
          scan_group_id: scanGroupId,
          food_name: item.food_name,
          portion: `${item.portion_g} g`,
          portion_g: item.portion_g,
          calories: nutrients?.calories ?? null,
          protein_g: nutrients?.protein_g ?? null,
          carbs_g: nutrients?.carbs_g ?? null,
          fat_g: nutrients?.fat_g ?? null,
          fibre_g: nutrients?.fibre_g ?? null,
          sugar_g: nutrients?.sugar_g ?? null,
          confidence: item.confidence,
          notes,
          fdc_id: match?.fdcId ?? null,
          nutrition_source: match ? "USDA FoodData Central" : null,
          nutrition_reference: match
            ? `${exactRecord ? "Exact record" : "Closest verified record"}: ${match.description} (FDC ${match.fdcId}; ${match.dataType}; values per 100 g)`
            : null,
        };
      }),
    );

    const { data: savedRows, error } = await context.supabase
      .from("food_scans")
      .insert(rows)
      .select(SCAN_COLUMNS);
    if (error || !savedRows) {
      console.error("Food scan save failed", error?.code ?? "unknown");
      return {
        ok: false as const,
        message: "Food was identified, but scan history could not be saved. Please retry.",
      };
    }
    return { ok: true as const, scans: savedRows };
  });

export const updateFoodScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        foodName: z.string().trim().min(1).max(120),
        portionG: z.number().int().min(1).max(3000),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    let match = null;
    let lookupError = "";
    try {
      match = await lookupFoodNutrition(data.foodName);
    } catch (error) {
      lookupError = error instanceof Error ? error.message : "Nutrition lookup failed.";
    }
    const nutrients = match ? scaleNutrition(match.per100g, data.portionG) : null;
    const exactRecord =
      match?.description.trim().toLowerCase() === data.foodName.trim().toLowerCase();
    const notes = [
      match
        ? "Food name and portion corrected by student; nutrition recalculated from the verified database record."
        : "No suitable verified USDA FoodData Central match was found for the corrected food name; nutrition values are unavailable.",
      lookupError,
    ]
      .filter(Boolean)
      .join(" ")
      .slice(0, 1000);
    const { data: row, error } = await context.supabase
      .from("food_scans")
      .update({
        food_name: data.foodName,
        portion_g: data.portionG,
        portion: `${data.portionG} g`,
        calories: nutrients?.calories ?? null,
        protein_g: nutrients?.protein_g ?? null,
        carbs_g: nutrients?.carbs_g ?? null,
        fat_g: nutrients?.fat_g ?? null,
        fibre_g: nutrients?.fibre_g ?? null,
        sugar_g: nutrients?.sugar_g ?? null,
        notes,
        fdc_id: match?.fdcId ?? null,
        nutrition_source: match ? "USDA FoodData Central" : null,
        nutrition_reference: match
          ? `${exactRecord ? "Exact record" : "Closest verified record"}: ${match.description} (FDC ${match.fdcId}; ${match.dataType}; values per 100 g)`
          : null,
      })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select(SCAN_COLUMNS)
      .single();
    if (error || !row)
      return { ok: false as const, message: "Could not save the corrected food and portion." };
    return { ok: true as const, scan: row };
  });
