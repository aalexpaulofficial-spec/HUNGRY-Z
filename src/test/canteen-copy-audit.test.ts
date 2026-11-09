import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { translateDashboardText } from "@/lib/dashboard-language";

describe("Canteen Dashboard static copy coverage", () => {
  it("translates static text and accessible labels across all canteen sections", () => {
    const files = ["src/routes/canteen.tsx", "src/components/foodexa/CanteenAvailabilityPanel.tsx", "src/components/foodexa/CanteenAnalytics.tsx", "src/components/foodexa/OfflinePOSAnalytics.tsx", "src/components/foodexa/EventCapacityPanel.tsx", "src/components/foodexa/CanteenTemplatePreview.tsx", "src/components/foodexa/FeedbackDialog.tsx", "src/components/foodexa/LegalDialog.tsx", "src/components/foodexa/OrderStatusBadge.tsx", "src/components/ThemeToggle.tsx", "src/lib/back-nav.tsx"];
    const keepAsIs = new Set(["", "HUNGRY Z", "x", "Rs", "- Rs", "UPI", "AM", "PM", "1234567", "hungryofficialx@gmail.com"]);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const strings = new Set<string>();
      const visit = (node: ts.Node) => {
        if (ts.isJsxText(node)) {
          const value = node.getText(sf).replace(/\s+/g, " ").trim();
          if (value && /[A-Za-z]/.test(value)) strings.add(value);
        }
        if (ts.isJsxAttribute(node) && ["placeholder", "aria-label", "title", "alt"].includes(node.name.getText(sf)) && node.initializer && ts.isStringLiteral(node.initializer)) strings.add(node.initializer.text);
        ts.forEachChild(node, visit);
      };
      visit(sf);
      const missing = [...strings].filter((value) => !keepAsIs.has(value) && ["hi", "kn"].some((language) => translateDashboardText(value, language as "hi" | "kn") === value));
      expect(missing, `${file}: ${missing.join(" | ")}`).toEqual([]);
    }
  });
});
