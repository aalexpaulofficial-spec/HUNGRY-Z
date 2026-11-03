import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "@/components/ThemeToggle";

describe("HUNGRY Z theme toggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dataset.theme = "dark";
  });

  afterEach(() => {
    cleanup();
    document.documentElement.dataset.theme = "dark";
  });

  it("switches the whole document to White Theme and saves the preference", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to White Theme" }));

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("hungry-theme")).toBe("light");
    expect(screen.getByRole("button", { name: "Switch to HUNGRY Z Theme" })).toHaveAttribute("aria-pressed", "true");
  });

  it("restores the selected theme when mounted on another route", () => {
    localStorage.setItem("hungry-theme", "light");
    document.documentElement.dataset.theme = "light";
    const view = render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Switch to HUNGRY Z Theme" })).toHaveAttribute("aria-pressed", "true");

    view.unmount();
    act(() => { document.documentElement.dataset.theme = "light"; });
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to HUNGRY Z Theme" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("hungry-theme")).toBe("dark");
  });
});
