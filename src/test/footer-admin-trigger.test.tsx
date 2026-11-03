import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigateMock }));

import { Footer } from "@/components/foodexa/Footer";

describe("footer admin login trigger", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    navigateMock.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it.each([
    ["desktop", 1440],
    ["mobile", 390],
  ])("opens admin login after exactly three footer logo clicks on %s", (_label, width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    render(<Footer />);
    const footerLogo = screen.getByRole("button", { name: "HUNGRY" });

    fireEvent.click(footerLogo);
    fireEvent.click(footerLogo);
    expect(navigateMock).not.toHaveBeenCalled();

    fireEvent.click(footerLogo);
    expect(navigateMock).toHaveBeenCalledOnce();
    expect(navigateMock).toHaveBeenCalledWith({ to: "/admin" });
  });

  it("resets the sequence when the clicks are too far apart", () => {
    render(<Footer />);
    const footerLogo = screen.getByRole("button", { name: "HUNGRY" });

    fireEvent.click(footerLogo);
    fireEvent.click(footerLogo);
    vi.advanceTimersByTime(1500);
    fireEvent.click(footerLogo);

    expect(navigateMock).not.toHaveBeenCalled();
  });
});
