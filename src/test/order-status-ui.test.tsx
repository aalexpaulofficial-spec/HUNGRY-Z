import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OrderStatusBadge } from "@/components/foodexa/OrderStatusBadge";
import { VerifiedCanteenLabel } from "@/components/foodexa/VerifiedCanteenLabel";

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.theme;
});

describe("student order status and verification UI", () => {
  it.each([
    ["White", "light", 390],
    ["HUNGRY", "dark", 1440],
    ["White", "light", 1440],
    ["HUNGRY", "dark", 390],
  ])("uses the green collected indicator in %s theme at %i px", (_theme, theme, width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    document.documentElement.dataset.theme = theme;
    const { container } = render(<OrderStatusBadge status="collected" />);

    const badge = container.querySelector('[data-order-status="collected"]');
    expect(badge).toHaveTextContent("Collected");
    expect(badge).toHaveClass("status-collected", "border");
    expect(badge).not.toHaveClass("bg-primary", "bg-muted");
  });

  it("keeps non-collected status colors unchanged", () => {
    const { rerender } = render(<OrderStatusBadge status="ready" />);
    expect(screen.getByText("Ready for pickup")).toHaveClass("bg-primary", "text-primary-foreground");
    rerender(<OrderStatusBadge status="preparing" />);
    expect(screen.getByText("Preparing")).toHaveClass("bg-muted", "text-muted-foreground");
  });

  it("shows the requested verified canteen name and check indicator", () => {
    const { container } = render(<VerifiedCanteenLabel />);
    expect(screen.getByText("Verified HUNGRYZ Canteen")).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveClass("h-3.5", "w-3.5");
    expect(container.firstElementChild).toHaveClass("verified-canteen-indicator");
  });
});
