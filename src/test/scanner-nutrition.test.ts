import { afterEach, describe, expect, it, vi } from "vitest";
import {
  identifyFoodsWithGemini,
  lookupUsdaNutrition,
  scaleNutrition,
} from "@/lib/scanner-nutrition.server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("scanner food recognition and nutrition safety", () => {
  it("uses Gemini Vision for food identification and portion only", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      foods: [
                        {
                          food_name: "plain dosa",
                          portion_g: 120,
                          confidence: "medium",
                          notes: "One dosa.",
                        },
                        {
                          food_name: "sambar",
                          portion_g: 80,
                          confidence: "high",
                          notes: "Small bowl beside dosa.",
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await identifyFoodsWithGemini("data:image/jpeg;base64,Zm9vZA==");

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ food_name: "plain dosa", portion_g: 120 });
    expect(JSON.stringify(result)).not.toMatch(/calories|protein|carbs|fat/i);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toContain("/models/gemini-3.8-flash:generateContent");
    expect(fetchMock.mock.calls[0][1].headers["x-goog-api-key"]).toBe("test-key");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).contents[0].parts[1]).toEqual({
      inline_data: { mime_type: "image/jpeg", data: "Zm9vZA==" },
    });
  });

  it("falls back to Gemini 3.6 Vision when the primary model is unavailable", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: 503, status: "UNAVAILABLE" } }), {
          status: 503,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        foods: [
                          {
                            food_name: "idli",
                            portion_g: 100,
                            confidence: "high",
                            notes: "One idli.",
                          },
                        ],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await identifyFoodsWithGemini("data:image/jpeg;base64,Zm9vZA==");

    expect(result[0].food_name).toBe("idli");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain("/models/gemini-3.6-flash:generateContent");
  });

  it("scales only verified source values and keeps absent nutrients unavailable", () => {
    expect(
      scaleNutrition(
        {
          calories: 210,
          protein_g: 5.7,
          carbs_g: 37,
          fat_g: 4.1,
          fibre_g: 1.8,
          sugar_g: null,
        },
        150,
      ),
    ).toEqual({
      calories: 315,
      protein_g: 8.6,
      carbs_g: 55.5,
      fat_g: 6.1,
      fibre_g: 2.7,
      sugar_g: null,
    });
  });

  it("retrieves USDA nutrients and scales per-100g values to the estimated portion", async () => {
    vi.stubEnv("USDA_FDC_API_KEY", "test-usda-key");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ foods: [{ fdcId: 123, description: "Rice, fried, with vegetables", dataType: "Survey (FNDDS)" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ foods: [{ fdcId: 123, description: "Rice, fried, with vegetables", dataType: "Survey (FNDDS)" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ fdcId: 123, description: "Rice, fried, with vegetables", dataType: "Survey (FNDDS)", foodNutrients: [
        { nutrient: { number: "208" }, amount: 180 }, { nutrient: { number: "203" }, amount: 5 },
        { nutrient: { number: "205" }, amount: 30 }, { nutrient: { number: "204" }, amount: 4 },
        { nutrient: { number: "291" }, amount: 2 }, { nutrient: { number: "269" }, amount: 1 },
      ] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await lookupUsdaNutrition("Vegetable Fried Rice", 200);
    expect(response.values).toEqual({ calories: 360, protein_g: 10, carbs_g: 60, fat_g: 8, fibre_g: 4, sugar_g: 2 });
    expect(response.source).toBe("USDA FoodData Central");
    expect(response.reference).toContain("FDC 123");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/foods/search");
    expect(String(fetchMock.mock.calls[2][0])).toContain("/food/123");
  });

  it("refuses unrelated USDA search results instead of inventing a match", async () => {
    vi.stubEnv("USDA_FDC_API_KEY", "test-usda-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ foods: [{ fdcId: 1, description: "Raw spinach", dataType: "Foundation" }] }), { status: 200 })));
    await expect(lookupUsdaNutrition("Sushi", 250)).rejects.toThrow(/No reliable USDA nutrition match/);
  });

  it("does not treat generic meatless fried rice as a verified vegetable fried rice match", async () => {
    vi.stubEnv("USDA_FDC_API_KEY", "test-usda-key");
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ foods: [
        { fdcId: 2708951, description: "Rice, fried, meatless", dataType: "Survey (FNDDS)" },
      ] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ foods: [
        { fdcId: 2708951, description: "Rice, fried, meatless", dataType: "Survey (FNDDS)" },
      ] }), { status: 200 })));
    await expect(lookupUsdaNutrition("Vegetable Fried Rice", 350)).rejects.toThrow(/No reliable USDA nutrition match/);
  });
});
