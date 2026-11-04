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
  ])("uses the green collected indicator in %s theme at %i px", (_theme, theme, width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    document.documentElement.dataset.theme = theme;
    const { container, rerender } = render(<OrderStatusBadge status="collected" />);

    const badge = container.querySelector('[data-order-status="collected"]');
    expect(badge).toHaveTextContent("Collected");
    expect(badge).toHaveClass("order-status-collected");
    expect(badge?.querySelector("span[aria-hidden='true']")).toHaveClass("order-status-dot-collected");

    rerender(<OrderStatusBadge status="cancelled" />);
    const cancelledBadge = container.querySelector('[data-order-status="cancelled"]');
    expect(cancelledBadge).toHaveClass("order-status-cancelled");
    expect(cancelledBadge?.querySelector("span[aria-hidden='true']")).toHaveClass("order-status-dot-cancelled");
  });

  it("uses green for placed and collected, red for cancelled, and neutral for in-progress statuses", () => {
    expect(orderStatusBorderClass("placed")).toBe("order-card-placed");
    const { rerender, container } = render(<OrderStatusBadge status="placed" />);
    expect(container.querySelector('[data-order-status="placed"]')).toHaveClass("order-status-placed");

    expect(orderStatusBorderClass("collected")).toBe("order-card-collected");
    rerender(<OrderStatusBadge status="collected" />);
    expect(container.querySelector('[data-order-status="collected"]')).toHaveClass("order-status-collected");

    expect(orderStatusBorderClass("cancelled")).toBe("order-card-cancelled");

    for (const status of ["preparing", "ready"]) {
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
