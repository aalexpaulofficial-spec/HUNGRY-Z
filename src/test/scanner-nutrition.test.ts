import { afterEach, describe, expect, it, vi } from "vitest";
import {
  identifyFoodWithGemini,
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
                      is_food: true,
                      food_name: "plain dosa",
                      portion_g: 120,
                      confidence: "medium",
                      notes: "One dosa.",
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
    const result = await identifyFoodWithGemini("data:image/jpeg;base64,Zm9vZA==");
    expect(result).toMatchObject({ food_name: "plain dosa", portion_g: 120 });
    expect(JSON.stringify(result)).not.toMatch(/calories|protein|carbs|fat/i);
    expect(fetchMock).toHaveBeenCalledOnce();
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
});
