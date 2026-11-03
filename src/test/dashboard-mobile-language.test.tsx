import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FoodCard } from "@/routes/_authenticated/app";
import { localizeDashboard, translateDashboardText } from "@/lib/dashboard-language";
import type { MenuItem } from "@/lib/access";

afterEach(cleanup);

const item: MenuItem = {
  id: "food-1",
  canteen_id: "canteen-1",
  name: "Masala Dosa",
  description: "Crisp dosa with potato masala",
  image: "",
  price: 45,
  category: "Breakfast",
  veg: true,
  prep_minutes: 8,
  counter: "Counter 1",
  tag: null,
  available: true,
  stock: 2,
};

const dashboardCopy = {
  HOME: ["Today's picks", "Quick bites", "Order now ↗"],
  MENU: ["Search dishes…", "Add to cart", "Sold out"],
  ORDERS: ["No orders yet", "Order ID", "Pickup code", "Collected", "Ready for pickup"],
  YOU: ["Current canteen", "Verified HUNGRYZ Canteen", "Log out"],
  SCAN: ["HUNGRY AI", "Scan Any Food,", "Know Its Nutrition", "Scan Food", "Upload Image"],
} as const;

const expectedTabCopy = {
  hi: ["आज के खास व्यंजन", "झटपट नाश्ता", "व्यंजन खोजें…", "टोकरी में जोड़ें", "अभी कोई ऑर्डर नहीं", "ऑर्डर आईडी", "पिकअप कोड", "वर्तमान कैंटीन", "सत्यापित HUNGRYZ कैंटीन", "लॉग आउट"],
  kn: ["ಇಂದಿನ ವಿಶೇಷಗಳು", "ತ್ವರಿತ ತಿಂಡಿಗಳು", "ತಿನಿಸುಗಳನ್ನು ಹುಡುಕಿ…", "ಕಾರ್ಟ್‌ಗೆ ಸೇರಿಸಿ", "ಇನ್ನೂ ಆರ್ಡರ್‌ಗಳಿಲ್ಲ", "ಆರ್ಡರ್ ಐಡಿ", "ಪಿಕಪ್ ಕೋಡ್", "ಪ್ರಸ್ತುತ ಕ್ಯಾಂಟೀನ್", "ಪರಿಶೀಲಿಸಿದ HUNGRYZ ಕ್ಯಾಂಟೀನ್", "ಲಾಗ್ ಔಟ್"],
} as const;

describe("multilingual mobile dashboard layout", () => {
  it("translates HOME, MENU, ORDERS and YOU labels in Hindi and Kannada without changing owner content", () => {
    const root = document.createElement("div");
    root.innerHTML = Object.entries(dashboardCopy)
      .map(([tab, strings]) => `<section data-tab="${tab}">${strings.map(value => `<span>${value}</span>`).join("")}</section>`)
      .join("") + '<p data-no-translate>Masala Dosa</p><p data-no-translate>South Canteen</p>';

    for (const language of ["hi", "kn"] as const) {
      const stop = localizeDashboard(root, language);
      for (const label of expectedTabCopy[language]) expect(root.textContent).toContain(label);
      const orders = root.querySelector('[data-tab="ORDERS"]')!;
      expect(orders.textContent).toContain(translateDashboardText("Collected", language));
      expect(orders.textContent).toContain(translateDashboardText("Ready for pickup", language));
      const scanner = root.querySelector('[data-tab="SCAN"]')!;
      for (const label of dashboardCopy.SCAN) expect(scanner.textContent).toContain(translateDashboardText(label, language));
      expect(root.textContent).not.toContain("Today's picks");
      expect(root.textContent).not.toContain("Search dishes…");
      expect(root.textContent).not.toContain("No orders yet");
      expect(root.textContent).not.toContain("Current canteen");
      expect(root.textContent).toContain("Masala Dosa");
      expect(root.textContent).toContain("South Canteen");
      stop();
    }
  });

  it("translates collected status, verified canteen identity, and HUNGRY AI controls", () => {
    expect(translateDashboardText("Collected", "en")).toBe("Collected");
    expect(translateDashboardText("Collected", "hi")).toBe("ले लिया गया");
    expect(translateDashboardText("Collected", "kn")).toBe("ಪಡೆದುಕೊಳ್ಳಲಾಗಿದೆ");
    expect(translateDashboardText("Verified HUNGRYZ Canteen", "hi")).toBe("सत्यापित HUNGRYZ कैंटीन");
    expect(translateDashboardText("Verified HUNGRYZ Canteen", "kn")).toBe("ಪರಿಶೀಲಿಸಿದ HUNGRYZ ಕ್ಯಾಂಟೀನ್");
    expect(translateDashboardText("Scan Any Food,", "hi")).toBe("किसी भी खाने को स्कैन करें,");
    expect(translateDashboardText("Scan Any Food,", "kn")).toBe("ಯಾವುದೇ ಆಹಾರವನ್ನು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ,");
    expect(translateDashboardText("Upload Image", "hi")).toBe("तस्वीर अपलोड करें");
    expect(translateDashboardText("Upload Image", "kn")).toBe("ಚಿತ್ರ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ");
    expect(translateDashboardText("HUNGRY AI", "hi")).toBe("HUNGRY AI");
    expect(translateDashboardText("HUNGRY AI", "kn")).toBe("HUNGRY AI");
    const productCopy = [
      "Version 1.0", "Version 2.0", "Version 3.0", "AVAILABLE NOW", "COMING SOON", "Features:",
      "AI-powered food recognition and nutrition analysis.", "Camera scanning", "Gallery upload", "Food identification", "Portion estimation", "Calories", "Protein", "Carbohydrates", "Fats", "Fibre", "Sugar",
      "Your personal AI nutrition coach.", "Daily nutrition tracking", "Personalised food recommendations", "Meal planning", "Nutrition reports", "AI nutrition chat",
      "Advanced AI-powered nutrition intelligence.", "Multiple food recognition", "Advanced portion analysis", "Detailed nutritional insights", "Intelligent meal analysis",
    ];
    for (const language of ["hi", "kn"] as const) {
      for (const copy of productCopy) expect(translateDashboardText(copy, language), `${language}: ${copy}`).not.toBe(copy);
    }
  });

  it("keeps mobile food-card content constrained and the add button visible with long translated stock text", () => {
    const { container } = render(<FoodCard item={item} onOpen={() => {}} onAdd={() => {}} />);
    const card = container.firstElementChild as HTMLElement;
    const addButton = screen.getByRole("button", { name: "Add Masala Dosa" });
    expect(card.className).toContain("min-w-0");
    expect(card.className).toContain("overflow-hidden");
    expect(addButton.className).toContain("shrink-0");
    expect(addButton.className).toContain("h-9 w-9");
    for (const [language, stockLabel] of [["en", "Only 2 left"], ["hi", "केवल 2 बचे"], ["kn", "ಇನ್ನೂ 2 ಮಾತ್ರ"]] as const) {
      const stop = localizeDashboard(document.body, language);
      expect(screen.getByText(stockLabel)).toBeInTheDocument();
      expect(screen.getByText("Masala Dosa")).toBeInTheDocument();
      expect(addButton).toBeInTheDocument();
      stop();
    }
  });

  it("keeps English copy unchanged and translates dynamic header names without wrapping data into UI labels", () => {
    expect(translateDashboardText("Menu (2)", "en")).toBe("Menu (2)");
    expect(translateDashboardText("Hi, Alex Paul 👋", "hi")).toBe("नमस्ते, Alex Paul 👋");
    expect(translateDashboardText("Hi, Alex Paul 👋", "kn")).toBe("ನಮಸ್ಕಾರ, Alex Paul 👋");
  });
});
