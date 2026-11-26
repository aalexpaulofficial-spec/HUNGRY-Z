import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MaintenanceScreen } from "@/components/MaintenanceScreen";

describe("maintenance screen", () => {
  it("shows only the HUNGRY Z name on a solid black screen", () => {
    const { container } = render(<MaintenanceScreen />);
    expect(screen.getByRole("heading", { name: "HUNGRY Z" })).toBeInTheDocument();
    expect(container.querySelector("main")).toHaveStyle({ background: "rgb(0, 0, 0)" });
    expect(container.querySelectorAll("a, button, input, textarea, section")).toHaveLength(0);
    expect(container.textContent).toBe("HUNGRY Z");
  });
});
