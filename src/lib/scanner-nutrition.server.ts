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
  "Verified nutrition values are unavailable. IFCT 2017 data cannot be stored in this product until the National Institute of Nutrition grants written permission for electronic use.";

const prompt = `Inspect the food photo and identify up to ${MAX_DETECTED_FOODS} distinct edible foods that are visibly present. Do not identify background objects, plates, cutlery, packaging, or ingredients that cannot be seen. Treat a mixed dish such as fried rice or biryani as one dish; list separate foods such as idli and sambar separately. For every item give a concise common food name, estimate only its edible portion weight in grams, choose confidence, and provide a short visual note. Do not estimate nutrients. If no food is visible, return an empty foods array. Return only JSON.`;

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
