import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/back-nav", () => ({ BackButton: () => null, useBackNavigationEnabled: () => true }));

import { Navbar } from "@/components/foodexa/Navbar";

describe("sticky landing navbar branding", () => {
  afterEach(() => cleanup());

  it.each([
    ["desktop", 1440],
    ["mobile", 390],
  ])("collapses to the supplied logo while scrolling on %s", (_label, width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
    render(<Navbar />);

    const brandText = document.querySelector<HTMLElement>("[data-brand-text]");
    expect(brandText).toHaveTextContent("HUNGRY Z");
    expect(brandText).toHaveClass("max-w-32", "opacity-100");

    Object.defineProperty(window, "scrollY", { configurable: true, value: 100 });
    fireEvent.scroll(window);
    expect(brandText).toHaveClass("max-w-0", "opacity-0");
    expect(screen.getByRole("img", { name: "HUNGRY Z" })).toHaveAttribute("src", "/HUNGRY%20Z%20Q%20LOGO.png");

    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
    fireEvent.scroll(window);
    expect(brandText).toHaveClass("max-w-32", "opacity-100");
  });
});
