import { z } from "zod";

const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_FALLBACK_MODEL = "gemini-3.8-flash";
const FDC_BASE = "https://api.nal.usda.gov/fdc/v1";

const identificationSchema = z.object({
  is_food: z.boolean(),
  food_name: z.string().min(1).max(120),
  portion_g: z.number().int().min(1).max(3000),
  confidence: z.enum(["low", "medium", "high"]),
  notes: z.string().max(400),
});

export type FoodIdentification = z.infer<typeof identificationSchema>;
export type Nutrients = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number;
  sugar_g: number;
};
export type NutritionMatch = { fdcId: number; description: string; per100g: Nutrients };

const prompt = `Identify the single main food item or dish shown. Estimate the edible weight in grams for that item only. If there are separate sides, dips, chutneys, sauces or drinks, exclude them from the food_name and portion_g. Use a concise common food name that can be looked up in a food composition database. Do not estimate calories or nutrients. Do not infer ingredients that cannot be identified from the image. If it is not food, set is_food=false. Return only JSON with is_food, food_name, portion_g, confidence, notes.`;

function parseGeminiJson(text: string): FoodIdentification {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return identificationSchema.parse(JSON.parse(cleaned));
}

async function requestGemini(
  model: string,
  mimeType: string,
  imageBase64: string,
  key: string,
): Promise<Response> {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            is_food: { type: "BOOLEAN" },
            food_name: { type: "STRING" },
            portion_g: { type: "INTEGER" },
            confidence: { type: "STRING", enum: ["low", "medium", "high"] },
            notes: { type: "STRING" },
          },
          required: ["is_food", "food_name", "portion_g", "confidence", "notes"],
        },
      },
    }),
    signal: AbortSignal.timeout(20000),
  });
}

export async function identifyFoodWithGemini(dataUrl: string): Promise<FoodIdentification> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Food recognition is not configured on the server.");
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("Please upload a JPG, PNG or WEBP photo.");
  let response: Response;
  try {
    response = await requestGemini(GEMINI_MODEL, match[1], match[2], key);
  } catch {
    response = await requestGemini(GEMINI_FALLBACK_MODEL, match[1], match[2], key);
  }
  if (response.status === 503 || response.status === 404) {
    response = await requestGemini(GEMINI_FALLBACK_MODEL, match[1], match[2], key);
  }
  if (!response.ok) {
    console.error("Gemini recognition request failed", response.status);
    throw new Error(
      response.status === 429
        ? "Food recognition is busy. Please try again shortly."
        : "Food recognition is temporarily unavailable.",
    );
  }
  const result = await response.json();
  const text =
    result?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("") ?? "";
  try {
    return parseGeminiJson(text);
  } catch {
    throw new Error("We couldn't read the food recognition result. Please try another photo.");
  }
}

function normalizedWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1);
}

function similarity(query: string, candidate: string): number {
  const a = new Set(normalizedWords(query));
  const b = new Set(normalizedWords(candidate));
  if (!a.size || !b.size) return 0;
  if ([...a].every((word) => b.has(word))) return 0.55 + 0.45 * (a.size / b.size);
  const overlap = [...a].filter((word) => b.has(word)).length;
  return overlap / new Set([...a, ...b]).size;
}

type FdcSearchFood = { fdcId: number; description: string; dataType?: string };
type FdcNutrient = {
  nutrient?: { number?: string; name?: string };
  nutrientNumber?: string;
  nutrientName?: string;
  unitName?: string;
  amount?: number;
  value?: number;
};

function nutrientNumber(row: FdcNutrient): string {
  return row.nutrient?.number ?? row.nutrientNumber ?? "";
}

function nutrientValue(rows: FdcNutrient[], number: string, name: string): number | null {
  const row = rows.find(
    (item) =>
      nutrientNumber(item) === number ||
      (item.nutrient?.name ?? item.nutrientName ?? "").toLowerCase() === name,
  );
  const value = row?.amount ?? row?.value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function mapFdcNutrients(rows: FdcNutrient[]): Nutrients | null {
  const values = {
    calories: nutrientValue(rows, "208", "energy"),
    protein_g: nutrientValue(rows, "203", "protein"),
    carbs_g: nutrientValue(rows, "205", "carbohydrate, by difference"),
    fat_g: nutrientValue(rows, "204", "total lipid (fat)"),
    fibre_g: nutrientValue(rows, "291", "fiber, total dietary"),
    sugar_g: nutrientValue(rows, "269", "sugars, total including nleA"),
  };
  if (Object.values(values).some((value) => value === null)) return null;
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, Math.round((value as number) * 10) / 10]),
  ) as Nutrients;
}

export function scaleNutrition(per100g: Nutrients, portionG: number): Nutrients {
  const factor = portionG / 100;
  return {
    calories: Math.round(per100g.calories * factor),
    protein_g: Math.round(per100g.protein_g * factor * 10) / 10,
    carbs_g: Math.round(per100g.carbs_g * factor * 10) / 10,
    fat_g: Math.round(per100g.fat_g * factor * 10) / 10,
    fibre_g: Math.round(per100g.fibre_g * factor * 10) / 10,
    sugar_g: Math.round(per100g.sugar_g * factor * 10) / 10,
  };
}

async function fdcFetch<T>(path: string, apiKey: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(
      `${FDC_BASE}${path}${path.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(apiKey)}`,
      { ...init, signal: AbortSignal.timeout(15000) },
    );
  } catch {
    throw new Error("The nutrition database did not respond. Please try again.");
  }
  if (!response.ok) {
    console.error("Food database request failed", response.status);
    throw new Error(
      response.status === 429
        ? "The nutrition database is busy. Please try again shortly."
        : "The nutrition database is temporarily unavailable.",
    );
  }
  return response.json() as Promise<T>;
}

export async function lookupFoodNutrition(foodName: string): Promise<NutritionMatch | null> {
  const apiKey = process.env.USDA_FDC_API_KEY;
  if (!apiKey) throw new Error("Food nutrition lookup is not configured on the server.");
  const search = await fdcFetch<{ foods?: FdcSearchFood[] }>("/foods/search", apiKey, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: foodName,
      pageSize: 20,
      dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)"],
    }),
  });
  const candidates = (search.foods ?? [])
    .map((food) => ({ food, score: similarity(foodName, food.description) }))
    .filter(({ score }) => score >= 0.55)
    .sort((a, b) => b.score - a.score);
  for (const { food } of candidates.slice(0, 5)) {
    const detail = await fdcFetch<{
      fdcId: number;
      description: string;
      foodNutrients?: FdcNutrient[];
    }>(`/food/${food.fdcId}`, apiKey);
    const nutrients = mapFdcNutrients(detail.foodNutrients ?? []);
    if (nutrients)
      return { fdcId: detail.fdcId, description: detail.description, per100g: nutrients };
  }
  return null;
}

export async function lookupFoodNutritionById(fdcId: number): Promise<NutritionMatch | null> {
  const apiKey = process.env.USDA_FDC_API_KEY;
  if (!apiKey) throw new Error("Food nutrition lookup is not configured on the server.");
  const detail = await fdcFetch<{
    fdcId: number;
    description: string;
    foodNutrients?: FdcNutrient[];
  }>(`/food/${fdcId}`, apiKey);
  const nutrients = mapFdcNutrients(detail.foodNutrients ?? []);
  return nutrients
    ? { fdcId: detail.fdcId, description: detail.description, per100g: nutrients }
    : null;
}
