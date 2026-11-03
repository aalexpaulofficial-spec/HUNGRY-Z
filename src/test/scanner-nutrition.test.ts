import { afterEach, describe, expect, it, vi } from "vitest";
import {
  identifyFoodsWithGemini,
  NUTRITION_DATA_UNAVAILABLE_NOTE,
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

  it("provides no nutrition values while there is no licensed dataset", () => {
    expect(NUTRITION_DATA_UNAVAILABLE_NOTE).toContain("written permission");
  });
});
