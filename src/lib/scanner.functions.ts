import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { imageDataUrlSchema } from "@/lib/scanner";
import {
  identifyFoodsWithGemini,
  lookupUsdaNutrition,
  type CompletedOrderFood,
  type ScannerFoodResult,
} from "@/lib/scanner-nutrition.server";

type ScannerUsage = { completed_orders: number; total_usages: number; used_usages: number; remaining_usages: number };

function firstRow<T>(data: T | T[] | null): T | null {
  return Array.isArray(data) ? data[0] ?? null : data;
}

async function releaseScannerUsage(requestId: string, userId: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("hungry_release_scanner_usage", { p_request_id: requestId, p_user_id: userId });
  } catch { /* The short-lived reservation expires in SQL if cleanup is temporarily unavailable. */ }
}

/** Returns order-earned analysis usage. The database function validates eligible account roles. */
export const getScannerAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("hungry_get_scanner_usage");
    if (error) {
      if (error.message.includes("ineligible_role"))
        return { ok: false as const, message: "HUNGRY AI access requires an eligible Student, Faculty or Guest account and completed food orders." };
      throw new Error("Could not load your scanner access. Please try again.");
    }
    const row = firstRow(data as ScannerUsage | ScannerUsage[] | null);
    if (!row) throw new Error("Could not load your HUNGRY AI usage. Please try again.");
    return { ok: true as const, ...row };
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
  .inputValidator((d: unknown) => z.object({ image: imageDataUrlSchema, requestId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: reservedData, error } = await context.supabase.rpc("hungry_reserve_scanner_usage", { p_request_id: data.requestId });
    if (error) {
      if (error.message.includes("ineligible_role")) return { ok: false as const, message: "HUNGRY AI access requires an eligible Student, Faculty or Guest account and completed food orders." };
      if (error.message.includes("usage_limit_reached")) return { ok: false as const, message: "Complete a food order to get another HUNGRY AI usage." };
      return { ok: false as const, message: "We couldn't verify scanner access. Please retry." };
    }
    const reservation = firstRow(reservedData as (ScannerUsage & { reserved: boolean }) | (ScannerUsage & { reserved: boolean })[] | null);
    if (!reservation) return { ok: false as const, message: "We couldn't verify scanner access. Please retry." };
    if (!reservation.reserved) return { ok: false as const, message: "This scan request was already used. Start a new scan to continue." };
    try {
      const { data: orderData, error: orderError } = await context.supabase.from("orders")
        .select("lines,status,completion_workflow,food_received_confirmed_at")
        .eq("user_id", context.userId).order("created_at", { ascending: false }).limit(100);
      if (orderError) throw new Error("Could not read your completed order history. Please retry.");
      const foodCounts = new Map<string, number>();
      for (const order of (orderData ?? []) as unknown as Array<{ lines: unknown; status: string; completion_workflow: string | null; food_received_confirmed_at: string | null }>) {
        const complete = order.completion_workflow === "printed"
          ? Boolean(order.food_received_confirmed_at)
          : order.status === "collected";
        if (!complete || !Array.isArray(order.lines)) continue;
        const foodsInOrder = new Set<string>();
        for (const line of order.lines as Array<{ name?: unknown; qty?: unknown }>) {
          if (typeof line?.name !== "string" || !line.name.trim()) continue;
          const food = [...line.name.trim()].filter((character) => {
            const code = character.charCodeAt(0);
            return code >= 0x20 && code !== 0x7f;
          }).join("").slice(0, 80);
          foodsInOrder.add(food);
        }
        for (const food of foodsInOrder) foodCounts.set(food, (foodCounts.get(food) ?? 0) + 1);
      }
      const orderHistory: CompletedOrderFood[] = [...foodCounts.entries()]
        .map(([food_name, order_count]) => ({ food_name, order_count }))
        .sort((a, b) => b.order_count - a.order_count).slice(0, 12);
      const identified = await identifyFoodsWithGemini(data.image, orderHistory);
      if (!identified.foods.length) {
        await releaseScannerUsage(data.requestId, context.userId);
        return { ok: false as const, message: "No food was detected. Try a clearer food photo." };
      }
      const confidenceRank = { low: 1, medium: 2, high: 3 } as const;
      const unique = new Map<string, (typeof identified.foods)[number]>();
      for (const item of identified.foods) {
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
      const { data: usageData, error: usageError } = await context.supabase.rpc("hungry_complete_scanner_usage", { p_request_id: data.requestId });
      if (usageError) throw new Error("Could not save this HUNGRY AI usage. Please retry.");
      const usage = firstRow(usageData as ScannerUsage | ScannerUsage[] | null);
      if (!usage) throw new Error("Could not refresh your HUNGRY AI usage. Please retry.");
      return { ok: true as const, scans, personalizedInsight: identified.personalizedInsight, usage };
    } catch (error) {
      await releaseScannerUsage(data.requestId, context.userId);
      return { ok: false as const, message: error instanceof Error ? error.message : "We couldn't analyse this photo. Please retry." };
    }
  });

/** Requeries the licensed provider for edits. The result remains in memory only. */
export const updateFoodScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ foodName: z.string().trim().min(1).max(120), portionG: z.number().int().min(1).max(3000), confidence: z.enum(["low", "medium", "high"]).default("medium"), notes: z.string().max(400).default("") }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("hungry_get_scanner_usage");
    if (error)
      return { ok: false as const, message: error.message.includes("ineligible_role") ? "HUNGRY AI access requires an eligible Student, Faculty or Guest account and completed food orders." : "Your scanner access is unavailable. Please reload the scanner." };
    try {
      return { ok: true as const, scan: await analyzeFood(data.foodName, data.portionG, data.confidence, data.notes) };
    } catch (error) {
      return { ok: false as const, message: error instanceof Error ? error.message : "Could not look up the corrected food." };
    }
  });
