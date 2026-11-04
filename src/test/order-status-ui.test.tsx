import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OrderStatusBadge, orderStatusBorderClass } from "@/components/foodexa/OrderStatusBadge";
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
  ])("uses the red collected indicator in %s theme at %i px", (_theme, theme, width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    document.documentElement.dataset.theme = theme;
    const { container } = render(<OrderStatusBadge status="collected" />);

    const badge = container.querySelector('[data-order-status="collected"]');
    expect(badge).toHaveTextContent("Collected");
    expect(badge).toHaveClass("order-status-other");
    expect(badge?.querySelector("span[aria-hidden='true']")).toHaveClass("order-status-dot-other");
    expect(badge).not.toHaveClass("bg-primary", "bg-muted");
  });

  it("uses green only for placed and red for every other order status", () => {
    const statuses = ["preparing", "ready", "collected", "cancelled"];
    expect(orderStatusBorderClass("placed")).toBe("order-card-placed");
    const { rerender, container } = render(<OrderStatusBadge status="placed" />);
    expect(container.querySelector('[data-order-status="placed"]')).toHaveClass("order-status-placed");

    for (const status of statuses) {
      expect(orderStatusBorderClass(status)).toBe("order-card-other");
      rerender(<OrderStatusBadge status={status} />);
      expect(container.querySelector(`[data-order-status="${status}"]`)).toHaveClass("order-status-other");
    }
  });

  it("shows the requested verified canteen name and check indicator", () => {
    const { container } = render(<VerifiedCanteenLabel />);
    expect(screen.getByText("Verified HUNGRYZ Canteen")).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveClass("h-3.5", "w-3.5");
    expect(container.firstElementChild).toHaveClass("verified-canteen-indicator");
  });
});
