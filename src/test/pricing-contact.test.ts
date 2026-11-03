import { describe, expect, it } from "vitest";
import { GENERAL_ENQUIRY_HREF } from "@/components/foodexa/Pricing";

describe("Talk to HUNGRY contact link", () => {
  it("opens a new general enquiry addressed to support in the default mail app", () => {
    const [destination, query] = GENERAL_ENQUIRY_HREF.split("?");
    const params = new URLSearchParams(query);

    expect(destination).toBe("mailto:hungryofficialx@gmail.com");
    expect(params.get("subject")).toBe("HUNGRY — General Enquiry");
  });
});
