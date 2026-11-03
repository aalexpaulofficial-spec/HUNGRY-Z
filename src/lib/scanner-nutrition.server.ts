import { z } from "zod";

const GEMINI_MODEL = "gemini-3.8-flash";
const GEMINI_FALLBACK_MODEL = "gemini-3.6-flash";
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

export const NUTRITION_DATA_UNAVAILABLE_NOTE =
  "No reliable matching record was found in the nutrition database. No nutrition values were estimated.";

export type ScannerFoodResult = {
  id: string;
  food_name: string;
  portion: string;
  portion_g: number;
  confidence: "low" | "medium" | "high";
  notes: string;
  nutrition_source: string | null;
  nutrition_reference: string | null;
} & Nutrients;

const USDA_BASE = "https://api.nal.usda.gov/fdc/v1";
const normalizeFoodName = (value: string) => value.toLowerCase()
  .replace(/\b(veg|veggie)\b/g, "vegetable")
  .replace(/\b(chips|fries)\b/g, "fries")
  .replace(/\bvegetables\b/g, "vegetable")
  .replace(/\bpotatoes\b/g, "potato")
  .replace(/\btomatoes\b/g, "tomato")
  .replace(/\bberries\b/g, "berry")
  .replace(/[^a-z0-9]+/g, " ").trim();

function foodSimilarity(query: string, label: string): number {
  const q = normalizeFoodName(query).split(" ").filter((word) => word.length > 2);
  const normalizedLabel = normalizeFoodName(label);
  const l = normalizedLabel.split(" ").filter((word) => word.length > 2);
  if (!q.length || !l.length) return 0;
  if (q.join(" ") === l.join(" ")) return 1;
  const overlap = q.filter((word) => l.includes(word)).length;
  const coverage = overlap / q.length;
  const precision = overlap / l.length;
  // Every distinctive word in the scanned food name must appear in the USDA
  // record, except that FDC's meatless fried-rice record is a disclosed close
  // match for vegetable fried rice when an exact vegetable entry is absent.
  const isVegetableFriedRice = q.includes("vegetable") && q.includes("fried") && q.includes("rice");
  const isMeatlessFriedRice =
    (normalizedLabel.includes("fried rice meatless") || normalizedLabel.includes("rice fried meatless")) ||
    normalizedLabel.includes("fried rice without meat");
  if (coverage < 1) return isVegetableFriedRice && isMeatlessFriedRice ? 0.67 : 0;
  return (2 * coverage * precision) / (coverage + precision || 1);
}

function isDisclosedVegetableFriedRiceClosestMatch(query: string, label: string): boolean {
  const normalizedQuery = normalizeFoodName(query);
  const normalizedLabel = normalizeFoodName(label);
  return (
    normalizedQuery.includes("vegetable fried rice") &&
    ((normalizedLabel.includes("fried rice meatless") || normalizedLabel.includes("rice fried meatless")) ||
      normalizedLabel.includes("fried rice without meat"))
  );
}

async function usdaRequest(url: URL, init?: RequestInit): Promise<any> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(12000) });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("USDA FoodData Central request failed", { status: response.status });
    if (response.status === 401 || response.status === 403)
      throw new Error("USDA rejected the server key. Check USDA_FDC_API_KEY in Vercel Production settings.");
    if (response.status === 429) throw new Error("USDA FoodData Central rate limit reached. Please retry shortly.");
    throw new Error("USDA FoodData Central is temporarily unavailable. Please retry.");
  }
  return body;
}

export async function lookupUsdaNutrition(foodName: string, portionG: number): Promise<{
  values: Nutrients;
  source: string;
  reference: string;
}> {
  const apiKey = process.env.USDA_FDC_API_KEY;
  if (!apiKey) throw new Error("USDA nutrition lookup is not configured. Add USDA_FDC_API_KEY as a Vercel backend secret.");

  const queries = [...new Map([foodName, normalizeFoodName(foodName).replace(/\bvegetable\b/g, "veg")].map((query) => [query.toLowerCase(), query])).values()];
  const candidates: any[] = [];
  for (const query of queries) {
    const url = new URL(`${USDA_BASE}/foods/search`);
    url.searchParams.set("api_key", apiKey);
    const result = await usdaRequest(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, pageSize: 25, dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)"] }),
    });
    if (!Array.isArray(result?.foods))
      throw new Error("USDA FoodData Central returned an unreadable search result. Please retry.");
    candidates.push(...result.foods);
  }
  const unique = [...new Map(candidates.map((item) => [item.fdcId, item])).values()];
  const ranked = unique
    .map((item) => ({ item, score: foodSimilarity(foodName, item.description ?? "") }))
    .sort((a, b) => b.score - a.score);
  // Never take an unrelated first result just because it came back from a broad query.
  const selected = ranked.find((candidate) => candidate.score >= 0.65)?.item;
  if (!selected?.fdcId) throw new Error("No reliable USDA nutrition match was found for this food. Try correcting its name or description.");

  const detailUrl = new URL(`${USDA_BASE}/food/${selected.fdcId}`);
  detailUrl.searchParams.set("api_key", apiKey);
  const details = await usdaRequest(detailUrl);
  const nutrient = (number: string): number | null => {
    const item = (details.foodNutrients ?? []).find((entry: any) => String(entry.nutrient?.number ?? entry.nutrientNumber) === number);
    const amount = item?.amount ?? item?.value;
    return typeof amount === "number" && Number.isFinite(amount) ? amount : null;
  };
  const per100g: Nutrients = {
    calories: nutrient("208") ?? nutrient("1008"), protein_g: nutrient("203"), carbs_g: nutrient("205"),
    fat_g: nutrient("204"), fibre_g: nutrient("291"), sugar_g: nutrient("269"),
  };
  const servingValues = scaleNutrition(per100g, portionG);
  const closeMatchNote = isDisclosedVegetableFriedRiceClosestMatch(foodName, details.description ?? selected.description)
    ? " · closest USDA fried-rice entry; vegetable recipe may differ"
    : "";
  return {
    values: servingValues,
    source: "USDA FoodData Central",
    reference: `${details.description ?? selected.description} · FDC ${selected.fdcId} · ${details.dataType ?? selected.dataType} · per 100 g scaled to ${portionG} g${closeMatchNote}`,
  };
}

const prompt = `Inspect the food photo and identify up to ${MAX_DETECTED_FOODS} distinct edible foods that are visibly present. Do not identify background objects, plates, cutlery, packaging, or ingredients that cannot be seen. Recognize ingredients only when they are visibly identifiable; mention these in the visual note and do not create duplicate nutrition lines for ingredients already included in a mixed dish. Treat a mixed dish such as fried rice or biryani as one dish; list separate servings such as idli and sambar separately. For every item give a concise common food name, estimate only its edible portion weight in grams, choose confidence, and provide a short visual note. Do not estimate nutrients. If no food is visible, return an empty foods array. Return only JSON.`;

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
    throw new Error("We couldn't read the food recognition result. Please retry with another photo.");
  }
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
