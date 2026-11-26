import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const submitApplication = vi.hoisted(() => vi.fn());

vi.mock("@/lib/hungry.functions", () => ({
  submitCanteenApplication: "submit-canteen-application",
  getCanteenOwnerAccess: "get-owner-access",
}));

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-start")>()),
  useServerFn: (serverFunction: string) => serverFunction === "submit-canteen-application" ? submitApplication : vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { setSession: vi.fn() } } }));
vi.mock("@/lib/backend-config", () => ({ backendConfigured: true }));

import { CanteenSection } from "@/components/foodexa/CanteenSection";

describe("canteen registration", () => {
  beforeEach(() => submitApplication.mockResolvedValue({ ok: true, emailSent: true }));
  afterEach(() => {
    cleanup();
    submitApplication.mockReset();
  });

  it("submits the retained registration details without licence or government-ID documents", async () => {
    render(<CanteenSection />);
    for (const [label, value] of [
      ["Owner full name", "Alex Paul"],
      ["Owner phone number", "+919876543210"],
      ["Contact email", "owner@example.com"],
      ["Canteen name", "Campus Cafe"],
      ["University / campus name", "Example University"],
      ["Campus address / city", "Campus Road"],
    ]) fireEvent.change(screen.getByLabelText(label), { target: { value } });

    expect(screen.queryByLabelText(/FSSAI/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Aadhaar|PAN|Government ID/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));
    expect(await screen.findByText("Application submitted!")).toBeInTheDocument();
    expect(submitApplication).toHaveBeenCalledWith({ data: expect.objectContaining({
      ownerName: "Alex Paul",
      ownerPhone: "+919876543210",
      contactEmail: "owner@example.com",
      canteenName: "Campus Cafe",
      universityName: "Example University",
      campusLocation: "Campus Road",
      notes: "",
    }) });
    expect(submitApplication.mock.calls[0][0].data).not.toHaveProperty("fssaiLicense");
    expect(submitApplication.mock.calls[0][0].data).not.toHaveProperty("ownerIdProof");
  });
});
