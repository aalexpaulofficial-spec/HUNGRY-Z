import { describe, expect, it } from "vitest";
import { canAccessOwnerCanteen } from "@/lib/canteen-owner-flow";

describe("canteen owner access", () => {
  it("allows dashboard access only for active approved canteens", () => {
    expect(canAccessOwnerCanteen(true, "approved")).toBe(true);
    expect(canAccessOwnerCanteen(false, "approved")).toBe(false);
    expect(canAccessOwnerCanteen(true, "pending")).toBe(false);
    expect(canAccessOwnerCanteen(true, "rejected")).toBe(false);
    expect(canAccessOwnerCanteen(true, "missing")).toBe(false);
  });
});
