import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/foodexa/use-gsap", () => ({ useGsap: () => null }));
vi.mock("@/components/foodexa/Phone", () => ({ Phone: () => <div aria-hidden="true" /> }));

import { Pricing } from "@/components/foodexa/Pricing";

describe("public scanner pricing cards", () => {
  afterEach(() => cleanup());

  it.each([
    ["desktop", 1440],
    ["mobile", 390],
  ])("shows official product names, descriptions, features and statuses on %s", (_label, width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    const { container } = render(<Pricing />);
    const cards = [...container.querySelectorAll("article")];
    expect(cards).toHaveLength(3);

    const [versionOne, versionTwo, versionThree] = cards.map((card) => within(card));
    expect(versionOne!.getByRole("heading", { name: "HUNGRY AI SCAN" })).toBeInTheDocument();
    expect(versionOne!.getByText("Version 1.0")).toBeInTheDocument();
    expect(versionOne!.getByText("AVAILABLE NOW")).toBeInTheDocument();
    expect(versionOne!.getByText("AI-powered food recognition and nutrition analysis.")).toBeInTheDocument();
    expect(versionOne!.getByText("One eligible completed food order provides one AI usage.")).toBeInTheDocument();
    for (const feature of ["Camera scanning", "Gallery upload", "Food identification", "Portion estimation", "Calories", "Protein", "Carbohydrates", "Fats", "Fibre", "Sugar"]) {
      expect(versionOne!.getByText(feature)).toBeInTheDocument();
    }

    for (const [card, product, version, description, features] of [
      [versionTwo!, "HUNGRYZ NUTRI", "Version 2.0", "Your personal AI nutrition coach.", ["Daily nutrition tracking", "Personalised food recommendations", "Meal planning", "Nutrition reports", "AI nutrition chat"]],
      [versionThree!, "HUNGRYZ INSIGHT", "Version 3.0", "Advanced AI-powered nutrition intelligence.", ["Multiple food recognition", "Advanced portion analysis", "Detailed nutritional insights", "Intelligent meal analysis"]],
    ] as const) {
      expect(card.getByRole("heading", { name: product })).toBeInTheDocument();
      expect(card.getByText(version)).toBeInTheDocument();
      expect(card.getByText("COMING SOON")).toBeInTheDocument();
      expect(card.getByText(description)).toBeInTheDocument();
      for (const feature of features) expect(card.getByText(feature)).toBeInTheDocument();
      expect(card.getByText("FREE")).toBeInTheDocument();
      expect(card.getByText((_, element) => element?.classList.contains("text-primary-bright") ?? false).textContent).toBe("\u20B90");
      expect(card.queryByRole("button")).not.toBeInTheDocument();
      expect(card.queryByRole("link")).not.toBeInTheDocument();
    }

    expect(screen.getAllByText("COMING SOON")).toHaveLength(2);
  });
});
