import { describe, expect, it } from "vitest";
import { canUseHungryAi } from "@/lib/scanner";

describe("HUNGRY AI dashboard role access", () => {
  it("shows HUNGRY AI to students only", () => {
    expect(canUseHungryAi("student")).toBe(true);
    expect(canUseHungryAi("faculty")).toBe(false);
    expect(canUseHungryAi("guest")).toBe(false);
    expect(canUseHungryAi(null)).toBe(false);
  });
});
