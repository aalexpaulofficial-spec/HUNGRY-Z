import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/foodexa/use-gsap", () => ({ useGsap: () => null }));

import { Phone } from "@/components/foodexa/Phone";

describe("landing hero featured image", () => {
  afterEach(() => cleanup());

  it("preserves the image proportions and keeps the caption below it without a dark gradient", () => {
    const { container } = render(<Phone screen="home" />);
    const image = screen.getByRole("img", { name: "Featured campus meal" });

    expect(image).toHaveAttribute("width", "600");
    expect(image).toHaveAttribute("height", "400");
    expect(image).toHaveClass("h-auto", "object-contain");
    expect(container.querySelector(".bg-gradient-to-t")).not.toBeInTheDocument();
    expect(screen.getByText("Today at Food Court")).toBeInTheDocument();
  });
});
