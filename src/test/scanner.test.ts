import { describe, expect, it } from "vitest";
import { SCANNER_PRICE_INR, STUDENT_SCANNER_PLANS, isTrialActive, trialDaysLeft, trialEndsAt } from "@/lib/scanner";

describe("HUNGRY Z SCANNER student plans", () => {
  it("all three versions are ₹0", () => {
    expect(SCANNER_PRICE_INR).toBe(0);
    expect(STUDENT_SCANNER_PLANS.map((p) => p.version)).toEqual(["1.0", "2.0", "3.0"]);
  });
  it("only Version 1.0 is live", () => {
    expect(STUDENT_SCANNER_PLANS.filter((p) => p.status === "live").map((p) => p.version)).toEqual(["1.0"]);
  });
});

describe("one-month free access", () => {
  it("ends one calendar month after start", () => {
    expect(trialEndsAt(new Date("2026-11-03T08:30:00Z")).toISOString()).toBe("2026-12-03T08:30:00.000Z");
  });
  it("clamps to month end like the database", () => {
    expect(trialEndsAt(new Date("2026-01-31T00:00:00Z")).toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });
  it("is active before expiry and inactive after", () => {
    const exp = "2026-12-03T08:30:00Z";
    expect(isTrialActive(exp, new Date("2026-12-03T08:29:59Z"))).toBe(true);
    expect(isTrialActive(exp, new Date("2026-12-03T08:30:00Z"))).toBe(false);
    expect(trialDaysLeft(exp, new Date("2026-11-03T08:30:00Z"))).toBe(30);
  });
});
