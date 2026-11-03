import { afterEach, describe, expect, it, vi } from "vitest";
import {
  identifyFoodsWithGemini,
  lookupFoodNutrition,
  mapFdcNutrients,
  scaleNutrition,
} from "@/lib/scanner-nutrition.server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("scanner nutrition sources", () => {
  it("uses Gemini for food identification and portion only", async () => {
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

  it("falls back to another supported Vision model when Gemini is unavailable", async () => {
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
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).contents[0].parts[1]).toEqual({
      inline_data: { mime_type: "image/jpeg", data: "Zm9vZA==" },
    });
  });

  it("maps FDC nutrient values and scales them to a portion", () => {
    const rows = [
      { nutrientNumber: "208", nutrientName: "Energy", unitName: "KCAL", value: 210 },
      { nutrientNumber: "203", nutrientName: "Protein", unitName: "G", value: 5.7 },
      {
        nutrientNumber: "205",
        nutrientName: "Carbohydrate, by difference",
        unitName: "G",
        value: 37,
      },
      { nutrientNumber: "204", nutrientName: "Total lipid (fat)", unitName: "G", value: 4.1 },
      { nutrientNumber: "291", nutrientName: "Fiber, total dietary", unitName: "G", value: 1.8 },
      {
        nutrientNumber: "269",
        nutrientName: "Sugars, Total Including NLEA",
        unitName: "G",
        value: 0.4,
      },
    ];
    const per100g = mapFdcNutrients(rows);
    expect(per100g).toEqual({
      calories: 210,
      protein_g: 5.7,
      carbs_g: 37,
      fat_g: 4.1,
      fibre_g: 1.8,
      sugar_g: 0.4,
    });
    expect(scaleNutrition(per100g!, 150)).toEqual({
      calories: 315,
      protein_g: 8.6,
      carbs_g: 55.5,
      fat_g: 6.1,
      fibre_g: 2.7,
      sugar_g: 0.6,
    });
  });

  it("does not return a verified nutrition record with missing required nutrients", () => {
    expect(
      mapFdcNutrients([
        { nutrientNumber: "208", nutrientName: "Energy", unitName: "KCAL", value: 1 },
      ]),
    ).toBeNull();
  });

  it("keeps missing optional values null and scales only verified values", () => {
    const per100g = mapFdcNutrients([
      { nutrientNumber: "208", nutrientName: "Energy", value: 174 },
      { nutrientNumber: "203", nutrientName: "Protein", value: 3.84 },
      { nutrientNumber: "205", nutrientName: "Carbohydrate, by difference", value: 32.5 },
      { nutrientNumber: "204", nutrientName: "Total lipid (fat)", value: 3.19 },
    ]);
    expect(per100g).toEqual({
      calories: 174,
      protein_g: 3.8,
      carbs_g: 32.5,
      fat_g: 3.2,
      fibre_g: null,
      sugar_g: null,
    });
    expect(scaleNutrition(per100g!, 150)).toEqual({
      calories: 261,
      protein_g: 5.7,
      carbs_g: 48.8,
      fat_g: 4.8,
      fibre_g: null,
      sugar_g: null,
    });
  });

  it("looks up the matching FDC item and then loads its nutrition detail", async () => {
    vi.stubEnv("USDA_FDC_API_KEY", "test-key");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            foods: [{ fdcId: 1, description: "Dosa, plain", dataType: "Survey (FNDDS)" }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            fdcId: 1,
            description: "Dosa, plain",
            foodNutrients: [
              { nutrientNumber: "208", nutrientName: "Energy", value: 210 },
              { nutrientNumber: "203", nutrientName: "Protein", value: 5.7 },
              { nutrientNumber: "205", nutrientName: "Carbohydrate, by difference", value: 37 },
              { nutrientNumber: "204", nutrientName: "Total lipid (fat)", value: 4.1 },
              { nutrientNumber: "291", nutrientName: "Fiber, total dietary", value: 1.8 },
              { nutrientNumber: "269", nutrientName: "Sugars, Total Including NLEA", value: 0.4 },
            ],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const result = await lookupFoodNutrition("dosa plain");
    expect(result?.fdcId).toBe(1);
    expect(result?.per100g.calories).toBe(210);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("matches Vegetable Fried Rice to the verified FNDDS meatless fried-rice record", async () => {
    vi.stubEnv("USDA_FDC_API_KEY", "test-key");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/foods/search")) {
        const query = JSON.parse(String(init?.body)).query as string;
        return new Response(
          JSON.stringify({
            foods:
              query === "rice fried meatless"
                ? [
                    {
                      fdcId: 2708951,
                      description: "Rice, fried, meatless",
                      dataType: "Survey (FNDDS)",
                    },
                  ]
                : [],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          fdcId: 2708951,
          description: "Rice, fried, meatless",
          dataType: "Survey (FNDDS)",
          foodNutrients: [
            { nutrientNumber: "208", nutrientName: "Energy", value: 174 },
            { nutrientNumber: "203", nutrientName: "Protein", value: 3.84 },
            { nutrientNumber: "205", nutrientName: "Carbohydrate, by difference", value: 32.5 },
            { nutrientNumber: "204", nutrientName: "Total lipid (fat)", value: 3.19 },
            { nutrientNumber: "291", nutrientName: "Fiber, total dietary", value: 1.1 },
            { nutrientNumber: "269", nutrientName: "Sugars, total including NLEA", value: 0.62 },
          ],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupFoodNutrition("Vegetable Fried Rice");

    expect(result).toMatchObject({
      fdcId: 2708951,
      description: "Rice, fried, meatless",
      per100g: {
        calories: 174,
        protein_g: 3.8,
        carbs_g: 32.5,
        fat_g: 3.2,
        fibre_g: 1.1,
        sugar_g: 0.6,
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
