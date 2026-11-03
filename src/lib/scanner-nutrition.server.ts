import { z } from "zod";

const GEMINI_MODEL = "gemini-3.8-flash";
const GEMINI_FALLBACK_MODEL = "gemini-3.6-flash";
const FDC_BASE = "https://api.nal.usda.gov/fdc/v1";
const MAX_DETECTED_FOODS = 6;

const foodIdentificationSchema = z.object({
  food_name: z.string().trim().min(1).max(120),
  portion_g: z.number().int().min(1).max(3000),
  confidence: z.enum(["low", "medium", "high"]),
  notes: z.string().max(400).default(""),
});
const identificationSchema = z.object({
  foods: z.array(foodIdentificationSchema).max(MAX_DETECTED_FOODS),
});

export type FoodIdentification = z.infer<typeof foodIdentificationSchema>;
export type Nutrients = {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fibre_g: number | null;
  sugar_g: number | null;
};
export type NutritionMatch = {
  fdcId: number;
  description: string;
  dataType: string;
  per100g: Nutrients;
};

const prompt = `Inspect the food photo and identify up to ${MAX_DETECTED_FOODS} distinct edible foods that are visibly present. Do not identify background objects, plates, cutlery, packaging, or ingredients that cannot be seen. Treat a mixed dish such as fried rice or biryani as one dish; list separate foods such as idli and sambar separately. For every item give a concise common food name suitable for a food-composition database, estimate only its edible portion weight in grams, choose confidence, and provide a short visual note. Do not estimate nutrients. If no food is visible, return an empty foods array. Return only JSON.`;

function parseGeminiJson(text: string): FoodIdentification[] {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return identificationSchema.parse(JSON.parse(cleaned)).foods;
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
            foods: {
              type: "ARRAY",
              maxItems: MAX_DETECTED_FOODS,
              items: {
                type: "OBJECT",
                properties: {
                  food_name: { type: "STRING" },
                  portion_g: { type: "INTEGER" },
                  confidence: { type: "STRING", enum: ["low", "medium", "high"] },
                  notes: { type: "STRING" },
                },
                required: ["food_name", "portion_g", "confidence", "notes"],
              },
            },
          },
          required: ["foods"],
        },
      },
    }),
    signal: AbortSignal.timeout(20000),
  });
}

export async function identifyFoodsWithGemini(dataUrl: string): Promise<FoodIdentification[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Food recognition is not configured on the server.");
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("Please upload a JPG, PNG or WEBP photo.");
  let response: Response;
  let model = GEMINI_MODEL;
  try {
    response = await requestGemini(model, match[1], match[2], key);
  } catch {
    model = GEMINI_FALLBACK_MODEL;
    try {
      response = await requestGemini(model, match[1], match[2], key);
    } catch {
      throw new Error("Gemini could not be reached. Check the server network and try again.");
    }
  }
  if (response.status === 503 || response.status === 404) {
    model = model === GEMINI_MODEL ? GEMINI_FALLBACK_MODEL : GEMINI_MODEL;
    try {
      response = await requestGemini(model, match[1], match[2], key);
    } catch {
      throw new Error("Gemini could not be reached. Check the server network and try again.");
    }
  }
  if (!response.ok) {
    const providerError = await response.json().catch(() => null);
    const detail = providerError?.error;
    const providerCode = typeof detail?.status === "string" ? detail.status : "unknown";
    const providerMessage =
      typeof detail?.message === "string" ? detail.message.slice(0, 500) : "No provider message";
    console.error("Gemini recognition request failed", {
      model,
      httpStatus: response.status,
      providerCode,
      providerMessage,
    });
    throw new Error(
      response.status === 429
        ? "Gemini is busy or this API key has reached its request quota. Please try again shortly."
        : response.status === 401 || response.status === 403
          ? "Gemini rejected the server API key. Check GEMINI_API_KEY in Vercel Production settings."
          : response.status === 503
            ? "Gemini is temporarily overloaded. Please try again in a moment."
            : response.status === 404
              ? "Gemini recognition model is unavailable. Check the configured model name."
              : "Gemini rejected this photo request. Try a clear JPG, PNG or WEBP food photo.",
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
    throw new Error(
      "We couldn't read the food recognition result. Please retry with another photo.",
    );
  }
}

function normalizedWords(value: string): string[] {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\bveg\b/g, "vegetable")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !["indian", "style", "dish", "food"].includes(word));
}

function similarity(query: string, candidate: string): number {
  const a = new Set(normalizedWords(query));
  const b = new Set(normalizedWords(candidate));
  if (!a.size || !b.size) return 0;
  const overlap = [...a].filter((word) => b.has(word)).length;
  const precision = overlap / b.size;
  const recall = overlap / a.size;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return a.size === b.size && overlap === a.size ? 1 : f1;
}

const QUERY_ALIASES: Array<{ matches: RegExp; queries: string[] }> = [
  {
    matches: /\b(vegetable|veg) fried rice\b|\bfried rice (with )?vegetables\b/i,
    queries: [
      "rice fried meatless",
      "fried rice with vegetables",
      "rice fried with vegetables",
      "fried rice vegetable",
    ],
  },
  { matches: /\bidli\b/i, queries: ["idli", "idli steamed"] },
  { matches: /\bsambar\b/i, queries: ["sambar", "sambar vegetable stew"] },
  { matches: /\bmasala dosa\b/i, queries: ["dosa with filling", "masala dosa", "dosa plain"] },
  { matches: /\bchicken biryani\b/i, queries: ["biryani with chicken", "chicken biryani"] },
  { matches: /\b(chapati|chapatti|roti)\b/i, queries: ["bread chapati or roti", "chapati roti"] },
  { matches: /\bvegetable curry\b/i, queries: ["vegetable curry", "vegetable curry with rice"] },
];

function searchQueries(foodName: string): string[] {
  const alias = QUERY_ALIASES.find(({ matches }) => matches.test(foodName))?.queries ?? [];
  return [...new Set([foodName.trim(), ...alias])].slice(0, 3);
}

type FdcSearchFood = { fdcId: number; description: string; dataType?: string };
type FdcNutrient = {
  nutrient?: { number?: string; name?: string; unitName?: string };
  nutrientNumber?: string;
  nutrientName?: string;
  unitName?: string;
  amount?: number;
  value?: number;
};
type FdcFoodDetails = {
  fdcId: number;
  description: string;
  dataType?: string;
  foodNutrients?: FdcNutrient[];
};

function nutrientNumber(row: FdcNutrient): string {
  return row.nutrient?.number ?? row.nutrientNumber ?? "";
}

function nutrientValue(rows: FdcNutrient[], numbers: string[], names: string[]): number | null {
  const row = rows.find(
    (item) =>
      numbers.includes(nutrientNumber(item)) ||
      names.includes((item.nutrient?.name ?? item.nutrientName ?? "").toLowerCase()),
  );
  const value = row?.amount ?? row?.value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function mapFdcNutrients(rows: FdcNutrient[]): Nutrients | null {
  const energy = nutrientValue(rows, ["208", "1008"], []);
  const energyKj = energy === null ? nutrientValue(rows, ["268"], []) : null;
  const values: Nutrients = {
    calories: energy ?? (energyKj === null ? null : Math.round((energyKj / 4.184) * 10) / 10),
    protein_g: nutrientValue(rows, ["203"], ["protein"]),
    carbs_g: nutrientValue(rows, ["205"], ["carbohydrate, by difference"]),
    fat_g: nutrientValue(rows, ["204"], ["total lipid (fat)"]),
    fibre_g: nutrientValue(rows, ["291"], ["fiber, total dietary", "fibre, total dietary"]),
    sugar_g: nutrientValue(rows, ["269"], ["sugars, total including nlea"]),
  };
  const hasCoreNutrition =
    values.calories !== null &&
    values.protein_g !== null &&
    values.carbs_g !== null &&
    values.fat_g !== null;
  if (!hasCoreNutrition) return null;
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      value === null ? null : Math.round(value * 10) / 10,
    ]),
  ) as Nutrients;
}

export function scaleNutrition(per100g: Nutrients, portionG: number): Nutrients {
  const factor = portionG / 100;
  const scale = (value: number | null, integer = false): number | null =>
    value === null
      ? null
      : integer
        ? Math.round(value * factor)
        : Math.round(value * factor * 10) / 10;
  return {
    calories: scale(per100g.calories, true),
    protein_g: scale(per100g.protein_g),
    carbs_g: scale(per100g.carbs_g),
    fat_g: scale(per100g.fat_g),
    fibre_g: scale(per100g.fibre_g),
    sugar_g: scale(per100g.sugar_g),
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
    throw new Error("USDA FoodData Central could not be reached. Please retry the scan.");
  }
  if (!response.ok) {
    console.error("FoodData Central request failed", { path, status: response.status });
    throw new Error(
      response.status === 429
        ? "USDA FoodData Central is busy. Please retry shortly."
        : response.status === 401 || response.status === 403
          ? "USDA FoodData Central rejected its server API key. Check USDA_FDC_API_KEY in Vercel settings."
          : "USDA FoodData Central is temporarily unavailable. Please retry the scan.",
    );
  }
  return response.json() as Promise<T>;
}

function dataTypeRank(dataType?: string): number {
  if (dataType === "Survey (FNDDS)") return 3;
  if (dataType === "SR Legacy") return 2;
  if (dataType === "Foundation") return 1;
  return 0;
}

export async function lookupFoodNutrition(foodName: string): Promise<NutritionMatch | null> {
  const apiKey = process.env.USDA_FDC_API_KEY;
  if (!apiKey) throw new Error("USDA FoodData Central is not configured on the server.");
  const results = new Map<number, { food: FdcSearchFood; score: number }>();
  const queries = searchQueries(foodName);
  const searchResults = await Promise.allSettled(
    queries.map((query) =>
      fdcFetch<{ foods?: FdcSearchFood[] }>("/foods/search", apiKey, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query,
          pageSize: 25,
          dataType: ["Survey (FNDDS)", "SR Legacy", "Foundation"],
        }),
      }),
    ),
  );
  if (searchResults.every((result) => result.status === "rejected")) {
    const failed = searchResults.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
  }
  for (const [index, settled] of searchResults.entries()) {
    if (settled.status === "rejected") continue;
    const search = settled.value;
    const query = queries[index];
    for (const food of search.foods ?? []) {
      const score = similarity(query, food.description);
      const current = results.get(food.fdcId);
      if (!current || score > current.score) results.set(food.fdcId, { food, score });
    }
  }
  const candidates = [...results.values()]
    .filter(
      ({ food, score }) =>
        score >= 0.28 || queries.some((query) => similarity(query, food.description) === 1),
    )
    .sort(
      (a, b) => b.score - a.score || dataTypeRank(b.food.dataType) - dataTypeRank(a.food.dataType),
    );

  const details = await Promise.allSettled(
    candidates
      .slice(0, 3)
      .map(({ food }) => fdcFetch<FdcFoodDetails>(`/food/${food.fdcId}`, apiKey)),
  );
  for (const [index, settled] of details.entries()) {
    if (settled.status === "rejected") continue;
    const detail = settled.value;
    const nutrients = mapFdcNutrients(detail.foodNutrients ?? []);
    if (!nutrients) continue;
    const candidate = candidates[index].food;
    return {
      fdcId: detail.fdcId,
      description: detail.description,
      dataType: detail.dataType ?? candidate.dataType ?? "USDA FoodData Central",
      per100g: nutrients,
    };
  }
  return null;
}

export async function lookupFoodNutritionById(fdcId: number): Promise<NutritionMatch | null> {
  const apiKey = process.env.USDA_FDC_API_KEY;
  if (!apiKey) throw new Error("USDA FoodData Central is not configured on the server.");
  const detail = await fdcFetch<FdcFoodDetails>(`/food/${fdcId}`, apiKey);
  const nutrients = mapFdcNutrients(detail.foodNutrients ?? []);
  return nutrients
    ? {
        fdcId: detail.fdcId,
        description: detail.description,
        dataType: detail.dataType ?? "USDA FoodData Central",
        per100g: nutrients,
      }
    : null;
}
