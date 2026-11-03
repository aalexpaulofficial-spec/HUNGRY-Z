import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { CanteenTemplatePreview } from "@/components/foodexa/CanteenTemplatePreview";
import { bannerCropStyle, moveBannerCrop, normalizeBannerCrop } from "@/lib/banner-crop";

afterEach(cleanup);

function PreviewHarness() {
  const [crop, setCrop] = useState({ x: 50, y: 50, zoom: 1 });
  const [showTemplate, setShowTemplate] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setShowTemplate(false)}>Menu tab</button>
      <button type="button" onClick={() => setShowTemplate(true)}>Change Template tab</button>
      {showTemplate && <CanteenTemplatePreview imageUrl="https://images.example/banner.jpg" heading="Welcome" description="Fresh food" canteenName="Main" universityName="Campus" crop={crop} onCropChange={setCrop} />}
      <output aria-label="Saved preview crop">{crop.x},{crop.y},{crop.zoom}</output>
    </>
  );
}

describe("canteen template crop preview", () => {
  it("normalizes crop values and safely clamps pointer movement", () => {
    expect(normalizeBannerCrop({ x: Number.NaN, y: 110, zoom: 0 })).toEqual({ x: 50, y: 100, zoom: 1 });
    const moved = moveBannerCrop({ x: 50, y: 50, zoom: 1 }, 10, -20, 100, 100);
    expect(moved.x).toBeCloseTo(25);
    expect(moved.y).toBe(100);
    expect(moved.zoom).toBeCloseTo(1.4);
    expect(moveBannerCrop({ x: 50, y: 50, zoom: 1 }, 1, 1, 0, 100)).toEqual({ x: 50, y: 50, zoom: 1 });
    expect(bannerCropStyle({ x: 25, y: 100, zoom: 1.4 }).transform).toBe("translate(10%, -20%) scale(1.4)");
  });

  it("supports all preview sizes, dragging and zoom, and preserves the crop when navigating away and back", () => {
    const { container } = render(<PreviewHarness />);
    const frame = screen.getByTestId("banner-preview-frame");
    for (const [size, width] of [[/mobile/i, "360px"], [/tablet/i, "640px"], [/laptop/i, "900px"]] as const) {
      fireEvent.click(screen.getByRole("button", { name: size }));
      expect(frame).toHaveStyle({ maxWidth: width });
    }

    const dragSurface = container.querySelector(".cursor-grab") as HTMLElement;
    Object.defineProperty(dragSurface, "getBoundingClientRect", { value: () => ({ width: 100, height: 100, left: 0, top: 0, right: 100, bottom: 100 }) });
    const pointer = (name: string, x: number, y: number) => {
      const event = new Event(name, { bubbles: true });
      Object.defineProperties(event, { pointerId: { value: 7 }, clientX: { value: x }, clientY: { value: y } });
      fireEvent(dragSurface, event);
    };
    pointer("pointerdown", 50, 50);
    pointer("pointermove", 60, 40);
    pointer("pointerup", 60, 40);
    fireEvent.change(screen.getByRole("slider", { name: "Banner image zoom" }), { target: { value: "1.75" } });
    expect(screen.getByLabelText("Saved preview crop")).toHaveTextContent("0,100,1.75");

    fireEvent.click(screen.getByRole("button", { name: "Menu tab" }));
    fireEvent.click(screen.getByRole("button", { name: "Change Template tab" }));
    expect(screen.getByLabelText("Saved preview crop")).toHaveTextContent("0,100,1.75");
    const previewImage = container.querySelector(".cursor-grab img") as HTMLImageElement;
    expect(previewImage.style.transform).toBe("translate(37.5%, -37.5%) scale(1.75)");
    expect(previewImage.src).toBe("https://images.example/banner.jpg");
  });
});
