import { describe, expect, it } from "vitest";
import { privacyPolicy, termsConditions } from "@/content/legal";

const allText = (document: { sections: { title: string; paragraphs: string[] }[] }) => document.sections.flatMap((section) => [section.title, ...section.paragraphs]).join(" ").toLowerCase();

describe("published HUNGRY Z legal content", () => {
  it("describes event access codes, quotations, token data and chat handling in the privacy notice", () => {
    const text = allText(privacyPolicy);
    expect(text).toContain("seven-digit event access code");
    expect(text).toContain("four-digit token");
    expect(text).toContain("estimated budget");
    expect(text).toContain("not sent to hungry z's server");
  });

  it("explains published event approval, capacity-limited tokens and their distinction from food checkout", () => {
    const text = allText(termsConditions);
    expect(text).toContain("faculty may request quotation changes or approve");
    expect(text).toContain("approved capacity");
    expect(text).toContain("not food orders, payment");
  });
});
