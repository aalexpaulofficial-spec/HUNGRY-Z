import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadCanvasPng } from "@/lib/download-png";

afterEach(() => vi.restoreAllMocks());

describe("PNG canvas download", () => {
  it("downloads the actual canvas PNG with the order-specific filename", () => {
    let downloadedName = "";
    let downloadedSource = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloadedName = this.download;
      downloadedSource = this.href;
    });
    const canvas = { toDataURL: vi.fn(() => "data:image/png;base64,cXItbWF0cml4") } as unknown as HTMLCanvasElement;

    expect(downloadCanvasPng(canvas, "HUNGRY Z-HG-1024-QR.png")).toBe(true);
    expect(canvas.toDataURL).toHaveBeenCalledWith("image/png");
    expect(downloadedName).toBe("HUNGRY Z-HG-1024-QR.png");
    expect(downloadedSource).toContain("data:image/png;base64,");
  });

  it("reports an unsupported canvas export without throwing", () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const canvas = { toDataURL: vi.fn(() => { throw new Error("Canvas export unavailable"); }) } as unknown as HTMLCanvasElement;

    expect(downloadCanvasPng(canvas, "HUNGRY Z-HG-1024-QR.png")).toBe(false);
  });
});
