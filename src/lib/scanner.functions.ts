import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { imageDataUrlSchema, isTrialActive } from "@/lib/scanner";
import {
  identifyFoodsWithGemini,
  NUTRITION_DATA_UNAVAILABLE_NOTE,
} from "@/lib/scanner-nutrition.server";

const SCAN_COLUMNS =
  "id, user_id, food_name, portion, portion_g, calories, protein_g, carbs_g, fat_g, fibre_g, sugar_g, confidence, notes, created_at, nutrition_source, nutrition_reference, scan_group_id";

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
    const rows = foodsToSave.map((item) => ({
      user_id: context.userId,
      scan_group_id: scanGroupId,
      food_name: item.food_name,
      portion: `${item.portion_g} g`,
      portion_g: item.portion_g,
      calories: null,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
      fibre_g: null,
      sugar_g: null,
      confidence: item.confidence,
      notes: [item.notes, NUTRITION_DATA_UNAVAILABLE_NOTE].filter(Boolean).join(" ").slice(0, 1000),
      nutrition_source: null,
      nutrition_reference: null,
    }));

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
    const notes = `Food name and serving corrected by student. ${NUTRITION_DATA_UNAVAILABLE_NOTE}`.slice(
      0,
      1000,
    );
    const { data: row, error } = await context.supabase
      .from("food_scans")
      .update({
        food_name: data.foodName,
        portion_g: data.portionG,
        portion: `${data.portionG} g`,
        calories: null,
        protein_g: null,
        carbs_g: null,
        fat_g: null,
        fibre_g: null,
        sugar_g: null,
        notes,
        fdc_id: null,
        nutrition_source: null,
        nutrition_reference: null,
      })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select(SCAN_COLUMNS)
      .single();
    if (error || !row)
      return { ok: false as const, message: "Could not save the corrected food and portion." };
    return { ok: true as const, scan: row };
  });
