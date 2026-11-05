import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScannerTab } from "@/components/foodexa/ScannerTab";

const mocks = vi.hoisted(() => ({
  getAccess: vi.fn(),
  listScans: vi.fn(),
  scan: vi.fn(),
  updateFood: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/scanner.functions", () => ({
  getScannerAccess: mocks.getAccess,
  listFoodScans: mocks.listScans,
  scanFood: mocks.scan,
  updateFoodScan: mocks.updateFood,
}));

const row = {
  id: "11111111-1111-4111-8111-111111111111",
  food_name: "plain dosa",
  portion: "120 g",
  portion_g: 120,
  calories: null,
  protein_g: null,
  carbs_g: null,
  fat_g: null,
  fibre_g: null,
  sugar_g: null,
  confidence: "medium",
  notes: "",
  nutrition_source: null,
  nutrition_reference: null,
};

describe("scanner camera and photo input", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAccess.mockResolvedValue({
      ok: true,
      completed_orders: 4,
      total_usages: 4,
      used_usages: 0,
      remaining_usages: 4,
    });
    mocks.listScans.mockResolvedValue([]);
    mocks.scan.mockResolvedValue({ ok: true, scans: [row], personalizedInsight: "You often order dosa.", usage: { completed_orders: 4, total_usages: 4, used_usages: 1, remaining_usages: 3 } });
    mocks.updateFood.mockResolvedValue({ ok: true, scan: row });
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

  it("shows future scanner versions as coming soon", async () => {
    render(<ScannerTab />);
    await screen.findByRole("button", { name: /Scan Food/i });
    expect(screen.getAllByText("COMING SOON")).toHaveLength(3);
    expect(screen.getByText("HUNGRY AI SCAN")).toBeInTheDocument();
    expect(screen.getByText("AVAILABLE NOW")).toBeInTheDocument();
    expect(screen.getByText("AI-powered food recognition and nutrition analysis.")).toBeInTheDocument();
    expect(screen.getByText("HUNGRYZ NUTRI")).toBeInTheDocument();
    expect(screen.getByText("Your personal AI nutrition coach.")).toBeInTheDocument();
    expect(screen.getByText("HUNGRYZ INSIGHT")).toBeInTheDocument();
    expect(screen.getByText("Advanced AI-powered nutrition intelligence.")).toBeInTheDocument();
    expect(screen.getByText(/Daily nutrition tracking/)).toBeInTheDocument();
    expect(screen.getByText(/Multiple food recognition/)).toBeInTheDocument();
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

    fireEvent.click(await screen.findByRole("button", { name: /Scan Food/i }));
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
      expect(mocks.scan).toHaveBeenCalledWith({ data: expect.objectContaining({ image: "data:image/jpeg;base64,Zm9vZA==", requestId: expect.stringMatching(/^[0-9a-f-]{36}$/i) }) }),
    );
    expect(track.stop).toHaveBeenCalled();
    expect(mocks.listScans).not.toHaveBeenCalled();
  });

  it("shows a useful permission error and offers a device-camera fallback", async () => {
    const getUserMedia = vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    render(<ScannerTab />);
    fireEvent.click(await screen.findByRole("button", { name: /Scan Food/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/permission is blocked/i);
    expect(screen.getByRole("button", { name: /Open device camera/i })).toBeInTheDocument();
  });

  it("converts a gallery image and submits it for scanning", async () => {
    render(<ScannerTab />);
    const input = await screen.findByLabelText("Upload food photo from gallery");
    const file = new File(["food"], "lunch.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(mocks.scan).toHaveBeenCalledWith({ data: expect.objectContaining({ image: "data:image/jpeg;base64,Zm9vZA==", requestId: expect.stringMatching(/^[0-9a-f-]{36}$/i) }) }),
    );
    expect((await screen.findAllByText("plain dosa")).length).toBeGreaterThan(0);
    expect(screen.getByText("You often order dosa.")).toBeInTheDocument();
    expect(screen.getByText("Usages remaining").parentElement).toHaveTextContent("4");
    expect(mocks.listScans).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /^Close$/i }));
    expect(screen.queryByText("plain dosa")).not.toBeInTheDocument();
  });
});
