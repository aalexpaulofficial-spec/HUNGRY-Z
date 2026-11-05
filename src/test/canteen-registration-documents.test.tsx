import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const serverMocks = vi.hoisted(() => ({
  createUploadUrls: vi.fn(),
  submitApplication: vi.fn(),
}));

vi.mock("@/lib/hungry.functions", () => ({
  createCanteenDocumentUploadUrls: "create-upload-urls",
  submitCanteenApplicationWithDocuments: "submit-application-with-documents",
  getCanteenOwnerAccess: "get-owner-access",
}));

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-start")>()),
  useServerFn: (serverFunction: string) => {
    if (serverFunction === "create-upload-urls") return serverMocks.createUploadUrls;
    if (serverFunction === "submit-application-with-documents") return serverMocks.submitApplication;
    return vi.fn();
  },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { setSession: vi.fn() } } }));
vi.mock("@/lib/backend-config", () => ({ backendConfigured: true }));

import { CanteenSection } from "@/components/foodexa/CanteenSection";

const paths = {
  fssai: "applications/123e4567-e89b-12d3-a456-426614174000/fssai.pdf",
  ownerId: "applications/123e4567-e89b-12d3-a456-426614174000/owner-id.pdf",
};

describe("canteen registration PDF uploads", () => {
  let originalXhr: typeof XMLHttpRequest;
  let uploadedFiles: File[];
  let requestHeaders: Record<string, string>[];

  beforeEach(() => {
    uploadedFiles = [];
    requestHeaders = [];
    originalXhr = globalThis.XMLHttpRequest;
    serverMocks.createUploadUrls.mockResolvedValue({
      fssai: { path: paths.fssai, signedUrl: "https://storage.example/upload/fssai" },
      ownerId: { path: paths.ownerId, signedUrl: "https://storage.example/upload/owner-id" },
    });
    serverMocks.submitApplication.mockResolvedValue({ ok: true });

    class SuccessfulUploadRequest {
      upload = { onprogress: null as ((event: ProgressEvent) => void) | null };
      status = 0;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      open() {}
      setRequestHeader(name: string, value: string) {
        requestHeaders.push({ [name]: value });
      }
      send(file: File) {
        uploadedFiles.push(file);
        this.upload.onprogress?.({ lengthComputable: true, loaded: file.size, total: file.size } as ProgressEvent);
        this.status = 200;
        this.onload?.();
      }
    }
    globalThis.XMLHttpRequest = SuccessfulUploadRequest as unknown as typeof XMLHttpRequest;
  });

  afterEach(() => {
    cleanup();
    globalThis.XMLHttpRequest = originalXhr;
    serverMocks.createUploadUrls.mockReset();
    serverMocks.submitApplication.mockReset();
  });

  it("uploads both selected PDFs and submits their private storage references", async () => {
    render(<CanteenSection />);

    expect(screen.getAllByRole("button", { name: "Choose PDF / Upload Document" })).toHaveLength(2);
    expect((screen.getByLabelText("FSSAI Licence Document (PDF)") as HTMLInputElement).accept).toBe("application/pdf,.pdf");
    expect((screen.getByLabelText("Owner Government ID – Aadhaar / PAN (PDF)") as HTMLInputElement).accept).toBe("application/pdf,.pdf");

    const fssaiPdf = new File(["%PDF-1.4\nFSSAI test document\n%%EOF"], "fssai-test.pdf", { type: "application/pdf" });
    const ownerIdPdf = new File(["%PDF-1.4\nOwner ID test document\n%%EOF"], "owner-id-test.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("FSSAI Licence Document (PDF)"), { target: { files: [fssaiPdf] } });
    fireEvent.change(screen.getByLabelText("Owner Government ID – Aadhaar / PAN (PDF)"), { target: { files: [ownerIdPdf] } });

    expect(await screen.findByText("fssai-test.pdf")).toBeInTheDocument();
    expect(await screen.findByText("owner-id-test.pdf")).toBeInTheDocument();
    expect(screen.getAllByText("Selected · ready to upload")).toHaveLength(2);

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
    expect(await screen.findByText("Application submitted!")).toBeInTheDocument();
    expect(serverMocks.createUploadUrls).toHaveBeenCalledOnce();
    expect(uploadedFiles).toEqual(expect.arrayContaining([fssaiPdf, ownerIdPdf]));
    expect(requestHeaders).toContainEqual({ "Content-Type": "application/pdf" });
    await waitFor(() => expect(serverMocks.submitApplication).toHaveBeenCalledWith({ data: expect.objectContaining({
      fssaiDocumentPath: paths.fssai,
      ownerIdDocumentPath: paths.ownerId,
    }) }));
  });
});
