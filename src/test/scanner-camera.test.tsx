import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScannerTab } from "@/components/foodexa/ScannerTab";

const mocks = vi.hoisted(() => ({
  getAccess: vi.fn(),
  listScans: vi.fn(),
  scan: vi.fn(),
  remove: vi.fn(),
  saveFood: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/scanner.functions", () => ({
  getScannerAccess: mocks.getAccess,
  listFoodScans: mocks.listScans,
  scanFood: mocks.scan,
  deleteFoodScan: mocks.remove,
  updateFoodScan: mocks.saveFood,
}));

const row = {
  id: "11111111-1111-4111-8111-111111111111",
  food_name: "plain dosa",
  portion: "120 g",
  portion_g: 120,
  calories: 252,
  protein_g: 6.8,
  carbs_g: 44.4,
  fat_g: 4.9,
  fibre_g: 2.2,
  sugar_g: 0.4,
  confidence: "medium",
  notes: "",
  created_at: "2026-01-01T00:00:00Z",
  fdc_id: 1,
  nutrition_source: "USDA FoodData Central",
  nutrition_reference: "Dosa, plain (FDC 1, per 100 g)",
  scan_group_id: "22222222-2222-4222-8222-222222222222",
};

describe("scanner camera and photo input", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAccess.mockResolvedValue({
      ok: true,
      expiresAt: "2099-01-01T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      version: "1.0",
      active: true,
    });
    mocks.listScans.mockResolvedValue([]);
    mocks.scan.mockResolvedValue({ ok: true, scans: [row] });
    mocks.remove.mockResolvedValue({ ok: true });
    mocks.saveFood.mockResolvedValue({ ok: true, scan: row });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLVideoElement.prototype, "videoWidth", "get").mockReturnValue(640);
    vi.spyOn(HTMLVideoElement.prototype, "videoHeight", "get").mockReturnValue(480);
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:test-image"),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal(
      "Image",
      class {
        width = 640;
        height = 480;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/jpeg;base64,Zm9vZA==",
    );
  });

  it("opens a live preview, switches camera and captures food", async () => {
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    render(<ScannerTab />);

    fireEvent.click(await screen.findByRole("button", { name: /Scan with camera/i }));
    await waitFor(() =>
      expect(getUserMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          video: expect.objectContaining({ facingMode: { ideal: "environment" } }),
        }),
      ),
    );
    expect(await screen.findByLabelText("Live food camera preview")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Switch camera/i }));
    await waitFor(() =>
      expect(getUserMedia).toHaveBeenLastCalledWith(
        expect.objectContaining({
          video: expect.objectContaining({ facingMode: { ideal: "user" } }),
        }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /Capture Food/i }));
    await waitFor(() =>
      expect(mocks.scan).toHaveBeenCalledWith({
        data: { image: "data:image/jpeg;base64,Zm9vZA==" },
      }),
    );
    expect(track.stop).toHaveBeenCalled();
  });

  it("shows a useful permission error and offers a device-camera fallback", async () => {
    const getUserMedia = vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    render(<ScannerTab />);
    fireEvent.click(await screen.findByRole("button", { name: /Scan with camera/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/permission is blocked/i);
    expect(screen.getByRole("button", { name: /Open device camera/i })).toBeInTheDocument();
  });

  it("converts a gallery image and submits it for scanning", async () => {
    render(<ScannerTab />);
    const input = await screen.findByLabelText("Upload food photo from gallery");
    const file = new File(["food"], "lunch.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(mocks.scan).toHaveBeenCalledWith({
        data: { image: "data:image/jpeg;base64,Zm9vZA==" },
      }),
    );
    expect((await screen.findAllByText("plain dosa")).length).toBeGreaterThan(0);
  });
});
