import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const serverMocks = vi.hoisted(() => ({ uploadPhotoUrl: vi.fn(), submitApplication: vi.fn(), upload: vi.fn() }));

vi.mock("@/lib/hungry.functions", () => ({
  submitCanteenApplication: "submit-canteen-application",
  createCanteenApplicationPhotoUploadUrl: "create-canteen-photo-upload-url",
  getCanteenOwnerAccess: "get-owner-access",
}));

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-start")>()),
  useServerFn: (serverFunction: string) => serverFunction === "submit-canteen-application" ? serverMocks.submitApplication
    : serverFunction === "create-canteen-photo-upload-url" ? serverMocks.uploadPhotoUrl : vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { setSession: vi.fn() },
  storage: { from: () => ({ uploadToSignedUrl: serverMocks.upload }) },
} }));
vi.mock("@/lib/backend-config", () => ({ backendConfigured: true }));

import { CanteenSection } from "@/components/foodexa/CanteenSection";

describe("canteen registration", () => {
  beforeEach(() => {
    serverMocks.submitApplication.mockResolvedValue({ ok: true, emailSent: true });
    serverMocks.uploadPhotoUrl.mockResolvedValue({ path: "applications/123e4567-e89b-12d3-a456-426614174000/canteen-photo.png", token: "signed-token" });
    serverMocks.upload.mockResolvedValue({ error: null });
  });
  afterEach(() => {
    cleanup();
    serverMocks.submitApplication.mockReset();
    serverMocks.uploadPhotoUrl.mockReset();
    serverMocks.upload.mockReset();
  });

  it("submits retained details and securely uploads an optional canteen photo", async () => {
    render(<CanteenSection />);
    for (const [label, value] of [
      ["Owner full name", "Alex Paul"],
      ["Owner phone number", "+919876543210"],
      ["Contact email", "owner@example.com"],
      ["Canteen name", "Campus Cafe"],
      ["University / campus name", "Example University"],
      ["Campus address / city", "Campus Road"],
    ]) fireEvent.change(screen.getByLabelText(label), { target: { value } });

    const photo = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "canteen.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Upload canteen photo"), { target: { files: [photo] } });
    expect(await screen.findByText("canteen.png")).toBeInTheDocument();
    expect(screen.getByAltText("Canteen photo preview")).toBeInTheDocument();

    expect(screen.queryByLabelText(/FSSAI/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Aadhaar|PAN|Government ID/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));
    expect(await screen.findByText("Application submitted!")).toBeInTheDocument();
    expect(serverMocks.uploadPhotoUrl).toHaveBeenCalledWith({ data: { contentType: "image/png" } });
    expect(serverMocks.upload).toHaveBeenCalledWith(
      "applications/123e4567-e89b-12d3-a456-426614174000/canteen-photo.png",
      "signed-token",
      photo,
      expect.objectContaining({ contentType: "image/png" }),
    );
    expect(serverMocks.submitApplication).toHaveBeenCalledWith({ data: expect.objectContaining({
      application: expect.objectContaining({
      ownerName: "Alex Paul",
      ownerPhone: "+919876543210",
      contactEmail: "owner@example.com",
      canteenName: "Campus Cafe",
      universityName: "Example University",
      campusLocation: "Campus Road",
      notes: "",
      }),
      photoPath: "applications/123e4567-e89b-12d3-a456-426614174000/canteen-photo.png",
    }) });
    expect(serverMocks.submitApplication.mock.calls[0][0].data.application).not.toHaveProperty("fssaiLicense");
    expect(serverMocks.submitApplication.mock.calls[0][0].data.application).not.toHaveProperty("ownerIdProof");
  });
});
