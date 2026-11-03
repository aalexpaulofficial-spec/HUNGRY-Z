import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { imageDataUrlSchema, isTrialActive, nutritionSchema } from "@/lib/scanner";

const SCAN_COLUMNS = "id, food_name, portion, calories, protein_g, carbs_g, fat_g, fibre_g, sugar_g, confidence, notes, created_at";

/** Starts (once) and returns the student's free month of HUNGRY SCANNER v1.0. */
export const getScannerAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("hungry_start_scanner_trial");
    if (error) {
      if (error.message.includes("students_only")) return { ok: false as const, message: "HUNGRY SCANNER is available to student accounts only." };
      throw new Error("Could not load your scanner access. Please try again.");
    }
    const row = data as { started_at: string; expires_at: string; version: string };
    return { ok: true as const, startedAt: row.started_at, expiresAt: row.expires_at, version: row.version, active: isTrialActive(row.expires_at) };
  });

export const listFoodScans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("food_scans").select(SCAN_COLUMNS).order("created_at", { ascending: false }).limit(50);
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

const PROMPT = `You are HUNGRY SCANNER, a nutrition analyst for Indian campus food.
Look at the photo, identify the main dish (or meal) and estimate the visible portion.
Return nutrition estimates for that portion: calories (kcal), protein, carbohydrates, fat, dietary fibre and sugar in grams.
If the photo does not show food, set is_food=false, food_name="Not food", all numbers 0 and explain in notes.
Keep notes to one short helpful sentence. Return JSON.`;

const jsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["is_food", "food_name", "portion", "calories", "protein_g", "carbs_g", "fat_g", "fibre_g", "sugar_g", "confidence", "notes"],
  properties: {
    is_food: { type: "boolean" },
    food_name: { type: "string" },
    portion: { type: "string", description: "e.g. '1 plate (~350 g)'" },
    calories: { type: "number" },
    protein_g: { type: "number" },
    carbs_g: { type: "number" },
    fat_g: { type: "number" },
    fibre_g: { type: "number" },
    sugar_g: { type: "number" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    notes: { type: "string" },
  },
} as const;

export const scanFood = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ image: imageDataUrlSchema }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: access } = await context.supabase.from("scanner_access").select("expires_at").eq("user_id", context.userId).maybeSingle();
    if (!access || !isTrialActive(access.expires_at)) {
      return { ok: false as const, message: "Your free month of HUNGRY SCANNER has ended." };
    }

    const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
    let text = "";
    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: PROMPT },
              { type: "input_image", image_url: data.image, detail: "auto" },
            ],
          },
        ],
        text: { format: { type: "json_schema", name: "nutrition", schema: jsonSchema, strict: true } },
      });
      for (const item of res.output ?? []) {
        if (item.type === "message") {
          for (const c of item.content) if (c.type === "output_text") text += c.text;
        }
      }
    } catch (e) {
      if (e instanceof GatewayError) {
        console.error("scanFood gateway error", e.code, e.httpStatus);
        if (e.httpStatus === 429) return { ok: false as const, message: "The scanner is busy. Please try again in a minute." };
        if (e.httpStatus === 402) return { ok: false as const, message: "The scanner is temporarily unavailable." };
      } else console.error("scanFood error", e);
      return { ok: false as const, message: "We couldn't analyse this photo. Please try again." };
    }

    let parsed;
    try {
      parsed = nutritionSchema.parse(JSON.parse(text));
    } catch {
      return { ok: false as const, message: "We couldn't read the scan result. Please try another photo." };
    }
    if (!parsed.is_food) return { ok: false as const, message: parsed.notes || "No food detected in this photo." };

    const r1 = (n: number) => Math.round(n * 10) / 10;
    const { data: row, error } = await context.supabase
      .from("food_scans")
      .insert({
        user_id: context.userId,
        food_name: parsed.food_name,
        portion: parsed.portion,
        calories: Math.round(parsed.calories),
        protein_g: r1(parsed.protein_g),
        carbs_g: r1(parsed.carbs_g),
        fat_g: r1(parsed.fat_g),
        fibre_g: r1(parsed.fibre_g),
        sugar_g: r1(parsed.sugar_g),
        confidence: parsed.confidence,
        notes: parsed.notes,
      })
      .select(SCAN_COLUMNS)
      .single();
    if (error || !row) return { ok: false as const, message: "Scan analysed but could not be saved. Please try again." };
    return { ok: true as const, scan: row };
  });
