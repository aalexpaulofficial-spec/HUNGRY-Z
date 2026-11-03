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
  ])("shows all three versions with restricted coming-soon details on %s", (_label, width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    const { container } = render(<Pricing />);
    const cards = [...container.querySelectorAll("article")];
    expect(cards).toHaveLength(3);

    const [versionOne, versionTwo, versionThree] = cards.map((card) => within(card));
    expect(versionOne!.getByRole("heading", { name: /HUNGRY AI.*AI Food Scanner/ })).toBeInTheDocument();
    expect(versionOne!.getByText("Camera scanning and image upload")).toBeInTheDocument();
    expect(versionOne!.getByText("AI food identification")).toBeInTheDocument();

    for (const [card, product, version, hiddenCopy] of [
      [versionTwo!, "HUNGRYZ NUTRI", "Version 2", ["AI Nutrition Assistant", "Daily nutrition tracking", "Meal planning and nutrition reports"]],
      [versionThree!, "HUNGRYZ INTELLI", "Version 3", ["Nutrition Intelligence", "Advanced food recognition", "Advanced nutrition insights and integrations"]],
    ] as const) {
      expect(card.getByRole("heading", { name: product })).toBeInTheDocument();
      expect(card.getByText(version)).toBeInTheDocument();
      expect(card.getByText("COMING SOON")).toBeInTheDocument();
      expect(card.getByText("FREE")).toBeInTheDocument();
      expect(card.getByText((_, element) => element?.classList.contains("text-primary-bright") ?? false).textContent).toBe("\u20B90");
      for (const text of hiddenCopy) expect(card.queryByText(text)).not.toBeInTheDocument();
      expect(card.queryByText("For students only")).not.toBeInTheDocument();
    }

    expect(screen.getAllByText("COMING SOON")).toHaveLength(2);
  });
});
