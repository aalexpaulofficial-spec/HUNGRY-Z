import { describe, expect, it } from "vitest";
import { GENERAL_ENQUIRY_HREF } from "@/components/foodexa/Pricing";

describe("Talk to HUNGRY Z canteen registration link", () => {
  it("opens the canteen registration page", () => {
    expect(GENERAL_ENQUIRY_HREF).toBe("/register-canteen");
  });
});
