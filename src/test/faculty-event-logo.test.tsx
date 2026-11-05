import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventLogoCropAdjust, EventLogoImage, createCroppedEventLogoFile } from "@/components/foodexa/FacultyEventLogo";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("responsive faculty event logos", () => {
  it.each([
    ["wide logo", "wide-logo.png"],
    ["portrait logo", "portrait-logo.jpg"],
    ["square logo", "square-logo.png"],
  ])("contains %s inside the same bounded responsive frame", (_name, filename) => {
    const { container } = render(<EventLogoImage src="/logo" alt={filename} />);
    expect(screen.getByAltText(filename)).toHaveClass("object-contain", "max-h-52", "max-w-full");
    expect(container.firstElementChild).toHaveClass("min-h-28", "max-h-56", "w-full", "overflow-hidden", "rounded-2xl");
  });

  it("offers an optional crop preview with aspect, zoom and drag positioning controls", async () => {
    const onCropChange = vi.fn();
    render(<EventLogoCropAdjust src="blob:logo" onCropChange={onCropChange} />);
    expect(screen.queryByRole("slider", { name: "Logo zoom" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Crop / Adjust Image (optional)" }));
    const preview = screen.getByRole("img", { name: "Draggable event logo crop preview" });
    expect(preview).toHaveClass("aspect-video", "touch-none", "overflow-hidden");
    const image = preview.querySelector("img")!;
    expect(image).toHaveClass("object-cover");
    fireEvent.change(screen.getByRole("combobox", { name: "Logo crop shape" }), { target: { value: "square" } });
    expect(screen.getByRole("img", { name: "Draggable event logo crop preview" })).toHaveClass("aspect-square");
    fireEvent.change(screen.getByRole("slider", { name: "Logo zoom" }), { target: { value: "2" } });
    await waitFor(() => expect(onCropChange).toHaveBeenLastCalledWith(expect.objectContaining({ aspect: "square", zoom: 2 })));
    expect(onCropChange).toHaveBeenLastCalledWith(expect.objectContaining({ zoom: 2 }));
  });

  it("creates an adjusted derivative while retaining the original file object", async () => {
    const file = new File(["original-image-bytes"], "wide-event.jpg", { type: "image/jpeg", lastModified: 100 });
    const drawImage = vi.fn();
    const bitmap = { width: 4000, height: 1000, close: vi.fn() };
    vi.stubGlobal("createImageBitmap", vi.fn(async () => bitmap));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob(["adjusted-image-bytes"], { type: "image/jpeg" })));

    const adjusted = await createCroppedEventLogoFile(file, { zoom: 2, x: 0.25, y: 0.5, aspect: "wide" });
    expect(adjusted).not.toBe(file);
    expect(adjusted.name).toBe(file.name);
    expect(adjusted.type).toBe("image/jpeg");
    const drawArgs = drawImage.mock.calls[0]!;
    expect(drawArgs[0]).toBe(bitmap);
    expect(drawArgs[1]).toBeCloseTo(777.7778);
    expect(drawArgs[2]).toBe(250);
    expect(drawArgs[3]).toBeCloseTo(888.8889);
    expect(drawArgs[4]).toBe(500);
    expect(drawArgs.slice(5)).toEqual([0, 0, 889, 500]);
    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(file.size).toBe("original-image-bytes".length);
  });

  it.each([
    ["portrait", 900, 1800, "square", 900, 900],
    ["square", 1200, 1200, "original", 1200, 1200],
    ["small landscape", 800, 450, "wide", 800, 450],
  ] as const)("keeps the %s crop bounded to its chosen aspect ratio", async (_name, width, height, aspect, expectedWidth, expectedHeight) => {
    const bitmap = { width, height, close: vi.fn() };
    const drawImage = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn(async () => bitmap));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob(["adjusted"], { type: "image/png" })));

    await createCroppedEventLogoFile(new File(["source"], `${_name}.png`, { type: "image/png" }), { zoom: 1, x: 0.5, y: 0.5, aspect });
    const args = drawImage.mock.calls[0]!;
    expect(args[5]).toBe(0);
    expect(args[6]).toBe(0);
    expect(args[7]).toBe(expectedWidth);
    expect(args[8]).toBe(expectedHeight);
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
});
