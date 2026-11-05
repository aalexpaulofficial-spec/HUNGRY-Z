import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-start")>()),
  useServerFn: () => vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { setSession: vi.fn() } },
}));

import { CanteenSection } from "@/components/foodexa/CanteenSection";

describe("canteen owner login UI", () => {
  afterEach(() => cleanup());

  it("requires both registration PDFs and rejects non-PDF file selections", async () => {
    render(<CanteenSection />);
    const fssaiPdf = screen.getByLabelText(/FSSAI Licence Document/) as HTMLInputElement;
    const ownerIdPdf = screen.getByLabelText(/Owner Government ID/) as HTMLInputElement;
    expect(fssaiPdf.accept).toBe("application/pdf,.pdf");
    expect(ownerIdPdf.accept).toBe("application/pdf,.pdf");

    fireEvent.change(fssaiPdf, { target: { files: [new File(["not pdf"], "notes.txt", { type: "text/plain" })] } });
    expect(await screen.findByText("Choose a PDF file.")).toBeInTheDocument();

    for (const [label, value] of [
      ["Owner full name", "Alex Paul"],
      ["Owner phone number", "+919876543210"],
      ["Contact email", "owner@example.com"],
      ["Canteen name", "Campus Cafe"],
      ["University / campus name", "Example University"],
      ["Campus address / city", "Campus Road"],
      ["FSSAI licence number", "FSSAI12345"],
      ["Owner government ID (Aadhaar / PAN no.)", "ABCD1234"],
    ]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));

    expect(await screen.findByText("Upload the FSSAI licence document PDF.")).toBeInTheDocument();
    expect(screen.getByText("Upload the owner's Aadhaar / PAN PDF.")).toBeInTheDocument();
  });

  it("shows separate labeled owner credentials and preserves the registration link below them", async () => {
    render(<CanteenSection />);
    fireEvent.click(screen.getByRole("button", { name: /canteen login/i }));

    const ownerId = await screen.findByLabelText("Canteen Owner ID (7 characters)");
    const passwordCode = await screen.findByLabelText("Canteen Owner Password Code (7 characters)");
    expect(ownerId).toHaveAttribute("placeholder", "ABC1234");
    expect(passwordCode).toHaveAttribute("placeholder", "ABC1234");
    expect(ownerId).toHaveAttribute("maxLength", "7");
    expect(passwordCode).toHaveAttribute("maxLength", "7");
    expect(await screen.findByRole("button", { name: "Open dashboard" })).toBeInTheDocument();

    const registerLink = screen.getByRole("button", { name: "Not approved yet? Register your canteen" });
    expect(ownerId.compareDocumentPosition(passwordCode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(passwordCode.compareDocumentPosition(registerLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(registerLink).toHaveClass("text-primary-bright");

    fireEvent.click(registerLink);
    await waitFor(() => expect(screen.getByRole("button", { name: "Submit application" })).toBeInTheDocument());
  });
});
