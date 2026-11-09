import { afterEach, describe, expect, it } from "vitest";
import { localizeDashboard, translateDashboardText } from "@/lib/dashboard-language";

afterEach(() => { document.body.replaceChildren(); delete document.documentElement.dataset.theme; });

const canteenDashboardCopy = [
  "CANTEEN DASHBOARD", "CANTEEN CODE", "COPY", "COPIED", "public", "private",
  "Canteen Availability", "Control order availability and set your weekly operating hours.",
  "OPEN — Accepting Orders", "CLOSED — Not Accepting Orders", "Accept orders now", "Pause orders now",
  "Use weekly hours", "Today:", "Weekly operating hours", "All day", "Save hours", "Saving…",
  "MENU", "ONLINE ORDERS", "OFFLINE POS", "FACULTY EVENTS", "ANALYTICS",
  "Search POS menu", "Food categories", "PHYSICAL KEYBOARD", "ON-SCREEN KEYBOARD", "⌫ BACKSPACE", "SPACE", "CLEAR",
  "Held orders", "Current bill", "Subtotal", "Total", "Hold order", "Clear order", "Print Bill", "RESUME",
  "Faculty Events", "Event Requests", "Review each canteen response, quotation, budget and publication stage.",
  "Quotation sent to Faculty", "ONLINE BUSINESS INSIGHTS", "OFFLINE BUSINESS INSIGHTS",
];

describe("Canteen Dashboard language coverage", () => {
  it("translates header, availability, menu, POS, events and analytics copy in both themes", () => {
    for (const theme of ["light", "dark"]) {
      document.documentElement.dataset.theme = theme;
      const root = document.createElement("main");
      root.className = "hz-canteen-app";
      root.innerHTML = `<header><p>CANTEEN DASHBOARD</p><p><span data-no-translate>University of Example</span> · <span>public</span></p><button>CANTEEN CODE</button></header><section>${canteenDashboardCopy.map(copy => `<span>${copy}</span>`).join("")}</section>`;

      for (const language of ["hi", "kn"] as const) {
        const stop = localizeDashboard(root, language);
        const display = root.textContent ?? "";
        for (const copy of canteenDashboardCopy) {
          expect(translateDashboardText(copy, language), `${theme}/${language}: ${copy}`).not.toBe(copy);
        }
        expect(display).toContain("University of Example");
        expect(display).not.toContain("public");
        stop();
        const reset = localizeDashboard(root, "en");
        reset();
      }
    }
  });

  it("translates weekday operating-hours labels and accessible controls", () => {
    for (const language of ["hi", "kn"] as const) {
      for (const label of ["Monday", "Monday open", "Tuesday all day", "Wednesday from AM/PM", "Sunday to AM/PM", "Closed today", "Open all day"]) {
        expect(translateDashboardText(label, language), `${language}: ${label}`).not.toBe(label);
      }
    }
  });

  it("translates live counts, analytics mode labels, payment metrics and menu categories", () => {
    const dynamicLabels = ["MENU (2)", "FACULTY EVENTS (3 REQUESTS)", "ONLINE ANALYTICS", "OFFLINE ANALYTICS", "ONLINE · Total orders", "ONLINE · Today's revenue", "OFFLINE · Bill count", "OFFLINE · Billed sales", "OFFLINE cash · paid", "0 bills · ₹0", "Breakfast"];
    for (const language of ["hi", "kn"] as const) {
      for (const label of dynamicLabels) {
        expect(translateDashboardText(label, language), `${language}: ${label}`).not.toBe(label);
      }
      const root = document.createElement("section");
      root.innerHTML = "<span>MENU (2)</span><span>FACULTY EVENTS (3 REQUESTS)</span><span>OFFLINE · Bill count</span><span>OFFLINE cash · paid</span><span>Breakfast</span>";
      const stop = localizeDashboard(root, language);
      expect(root.textContent).not.toContain("MENU");
      expect(root.textContent).not.toContain("FACULTY EVENTS");
      expect(root.textContent).not.toContain("OFFLINE");
      expect(root.textContent).not.toContain("Breakfast");
      stop();
    }
  });
});
