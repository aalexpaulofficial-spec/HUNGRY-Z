import { describe, expect, it } from "vitest";
import { originallyRequestedQuantity } from "@/lib/faculty-event-quantities";

describe("originally requested faculty event quantities", () => {
  it("prefers the structured quantity saved with the event", () => {
    expect(originallyRequestedQuantity("Biryani", { Biryani: 10 }, "MAKE 12 BIRYANI", 8)).toBe(10);
  });

  it("parses quantity from a manual request such as MAKE 10 CHICKEN BIRYANI", () => {
    expect(originallyRequestedQuantity("BIRYANI", {}, "MAKE 10 CHICKEN BIRYANI", 8)).toBe(10);
  });

  it("parses quantity written after the food name", () => {
    expect(originallyRequestedQuantity("BIRYANI", {}, "BIRYANI x 10", 8)).toBe(10);
  });

  it("uses the saved quotation quantity when an older manual request has no quantity", () => {
    expect(originallyRequestedQuantity("BIRYANI", {}, "Please prepare biryani for the event", 8)).toBe(8);
  });

  it("matches structured menu quantities without case sensitivity", () => {
    expect(originallyRequestedQuantity("BIRYANI", { Biryani: 10 }, "", 8)).toBe(10);
  });
});
