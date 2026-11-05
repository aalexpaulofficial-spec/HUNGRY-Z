import { afterEach, describe, expect, it } from "vitest";
import { eventStatusClass, eventStatusLabel } from "@/components/foodexa/EventCapacityPanel";
import { localizeDashboard, translateDashboardText } from "@/lib/dashboard-language";

afterEach(() => document.body.replaceChildren());

describe("event dashboard language and status presentation", () => {
  it("switches event controls and notifications between Hindi and Kannada while retaining event data", () => {
    const root = document.createElement("section");
    root.innerHTML = '<h2>Faculty Events</h2><button>Open Event</button><p>3 tokens remaining</p><p>Event request sent to FLAMES. Event Code: 1234567. The canteen will review the request and send a quotation.</p><p data-no-translate>Campus Innovation Day</p>';

    const stopHindi = localizeDashboard(root, "hi");
    expect(root.textContent).toContain("संकाय कार्यक्रम");
    expect(root.textContent).toContain("कार्यक्रम खोलें");
    expect(root.textContent).toContain("3 टोकन शेष");
    expect(root.textContent).toContain("FLAMES को कार्यक्रम अनुरोध भेजा गया");
    expect(root.textContent).toContain("Campus Innovation Day");
    stopHindi();

    const stopKannada = localizeDashboard(root, "kn");
    expect(root.textContent).toContain("ಅಧ್ಯಾಪಕರ ಕಾರ್ಯಕ್ರಮಗಳು");
    expect(root.textContent).toContain("ಕಾರ್ಯಕ್ರಮ ತೆರೆಯಿರಿ");
    expect(root.textContent).toContain("3 ಟೋಕನ್‌ಗಳು ಉಳಿದಿವೆ");
    expect(root.textContent).toContain("FLAMES ಗೆ ಕಾರ್ಯಕ್ರಮದ ವಿನಂತಿ ಕಳುಹಿಸಲಾಗಿದೆ");
    expect(root.textContent).toContain("Campus Innovation Day");
    stopKannada();
  });

  it("translates the new event logo and actual serving sections without translating food or event names", () => {
    const root = document.createElement("section");
    root.innerHTML = '<label>Event logo (optional)</label><img alt="Revival Meeting event logo"><h3>Actual Food Quantities Served</h3><p data-no-translate>Chicken Biryani</p><p>Originally requested: <strong>10</strong></p><p>Actual served: <strong>12</strong></p><p>Remaining: <strong>0</strong></p><p>Last updated: 11/5/2026</p>';

    const stopHindi = localizeDashboard(root, "hi");
    expect(root.textContent).toContain("कार्यक्रम का लोगो (वैकल्पिक)");
    expect(root.textContent).toContain("परोसे गए भोजन की वास्तविक मात्रा");
    expect(root.textContent).toContain("मूल अनुरोध की मात्रा:");
    expect(root.textContent).toContain("वास्तव में परोसी गई मात्रा:");
    expect(root.textContent).toContain("शेष मात्रा:");
    expect(root.querySelector("img")).toHaveAttribute("alt", "Revival Meeting · कार्यक्रम का लोगो");
    expect(root.textContent).toContain("Chicken Biryani");
    stopHindi();

    const stopKannada = localizeDashboard(root, "kn");
    expect(root.textContent).toContain("ಕಾರ್ಯಕ್ರಮದ ಲೋಗೋ (ಐಚ್ಛಿಕ)");
    expect(root.textContent).toContain("ವಿತರಿಸಿದ ಆಹಾರದ ನಿಜವಾದ ಪ್ರಮಾಣ");
    expect(root.textContent).toContain("ನಿಜವಾಗಿ ವಿತರಿಸಿದ ಪ್ರಮಾಣ:");
    expect(root.querySelector("img")).toHaveAttribute("alt", "Revival Meeting · ಕಾರ್ಯಕ್ರಮದ ಲೋಗೋ");
    expect(root.textContent).toContain("Chicken Biryani");
    stopKannada();
  });

  it("translates the optional logo upload controls", () => {
    for (const language of ["hi", "kn"] as const) {
      for (const label of ["EVENT LOGO (OPTIONAL)", "PNG, JPG or JPEG · maximum 8 MB", "Selected file:", "Replace image", "Remove image", "Crop / Adjust Image (optional)", "Crop shape", "Original proportions", "Wide (16:9)", "Square (1:1)"]) {
        expect(translateDashboardText(label, language), `${language}: ${label}`).not.toBe(label);
      }
    }
  });

  it("uses consistent requested, accepted, published, rejected and completed status colours", () => {
    expect(eventStatusLabel("requested")).toBe("PENDING");
    expect(eventStatusClass("requested")).toContain("border-orange-");
    expect(eventStatusLabel("accepted")).toBe("ACCEPTED");
    expect(eventStatusClass("accepted")).toContain("border-emerald-");
    expect(eventStatusLabel("published")).toBe("ACCEPTED & PUBLISHED");
    expect(eventStatusClass("published")).toContain("border-emerald-");
    expect(eventStatusLabel("rejected")).toBe("REJECTED");
    expect(eventStatusClass("rejected")).toContain("border-red-");
    expect(eventStatusLabel("cancelled")).toBe("CANCELLED");
    expect(eventStatusClass("cancelled")).toContain("border-red-");
    expect(eventStatusLabel("completed")).toBe("COMPLETED");
    expect(eventStatusClass("completed")).toContain("text-muted-foreground");
  });
});
