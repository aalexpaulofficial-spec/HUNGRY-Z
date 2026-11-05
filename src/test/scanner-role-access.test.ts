import { describe, expect, it } from "vitest";
import { canUseHungryAi } from "@/lib/scanner";

describe("HUNGRY AI dashboard role access", () => {
  it.each(["student", "faculty", "guest"]) ("shows HUNGRY AI to %s accounts", (role) => {
    expect(canUseHungryAi(role)).toBe(true);
  });

  it("does not show HUNGRY AI to roles outside the order-based user flow", () => {
    expect(canUseHungryAi("student")).toBe(true);
    expect(canUseHungryAi("canteen_owner")).toBe(false);
    expect(canUseHungryAi("admin")).toBe(false);
    expect(canUseHungryAi(null)).toBe(false);
  });
});
