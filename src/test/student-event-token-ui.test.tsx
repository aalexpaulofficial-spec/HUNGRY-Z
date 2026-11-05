import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudentEventsTab } from "@/components/foodexa/StudentEventsTab";

const fixtures = vi.hoisted(() => ({ eventLogoPath: null as string | null, signed: vi.fn(async (_paths: string[]) => ({ data: [] as Array<{ path: string; signedUrl: string }>, error: null as Error | null })) }));
const { issueToken, requestTokens } = vi.hoisted(() => ({ issueToken: vi.fn(), requestTokens: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("qrcode.react", () => ({ QRCodeCanvas: () => <canvas aria-label="Event QR code" /> }));
vi.mock("@/lib/hungry.functions", () => ({ issueFacultyEventToken: issueToken, requestAdditionalFacultyEventTokens: requestTokens }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const result = table === "faculty_events"
        ? { data: [{ id: "event-1", name: "Hackathon", event_code: "1234567", description: "Campus coding event", event_date: "2026-12-01", venue: "Main Hall", approved_capacity: 10, status: "published", event_logo_path: fixtures.eventLogoPath }], error: null }
        : { data: [], error: null };
      const query: Record<string, unknown> = {};
      query.select = vi.fn(() => query);
      query.eq = vi.fn(() => query);
      query.neq = vi.fn(() => query);
      query.order = vi.fn(() => query);
      query.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
      return query;
    },
    rpc: () => ({ maybeSingle: async () => ({ data: { approved_capacity: 10, issued_tokens: 2, tokens_remaining: 8 }, error: null }) }),
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    storage: { from: () => ({ createSignedUrls: fixtures.signed }) },
    removeChannel: vi.fn(),
  },
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); fixtures.eventLogoPath = null; });

describe("student event participation", () => {
  it("keeps the Event Code placeholder and full seven-digit value visible in the mobile layout", async () => {
    render(<StudentEventsTab canteenId="canteen-1" canteenName="FLAMES" userId="student-1" />);
    fireEvent.click(await screen.findByRole("button", { name: /Hackathon/ }));
    const input = screen.getByLabelText("7-digit Event Code") as HTMLInputElement;
    const form = input.closest("form")!;
    expect(input.placeholder).toBe("7-digit Event Code");
    expect(form).toHaveClass("flex-col", "sm:flex-row", "min-w-0");
    expect(input).toHaveClass("w-full", "min-w-0", "max-w-full", "text-sm", "tracking-[0.12em]", "placeholder:tracking-normal");
    expect(screen.getByRole("button", { name: "Open Event" })).toHaveClass("w-full", "sm:w-auto", "min-h-12");

    fireEvent.change(input, { target: { value: "1234567" } });
    expect(input).toHaveValue("1234567");
    expect(input.value).toHaveLength(7);
  });

  it("verifies the seven-digit code and issues a four-digit token without food checkout", async () => {
    issueToken.mockResolvedValue({ token_number: "0042", approved_capacity: 10, issued_tokens: 3, tokens_remaining: 7, already_issued: false });
    render(<StudentEventsTab canteenId="canteen-1" canteenName="FLAMES" userId="student-1" />);

    fireEvent.click(await screen.findByRole("button", { name: /Hackathon/ }));
    fireEvent.change(screen.getByLabelText("7-digit Event Code"), { target: { value: "1234567" } });
    fireEvent.click(screen.getByRole("button", { name: "Open Event" }));

    const dialog = await screen.findByRole("dialog", { name: "Hackathon" });
    expect(dialog).toHaveTextContent("Campus coding event");
    expect(dialog).toHaveTextContent("Main Hall");
    expect(dialog).not.toHaveTextContent("Food order");
    expect(dialog).not.toHaveTextContent("Add food");
    fireEvent.click(screen.getByRole("button", { name: "Generate Token" }));

    expect(await screen.findByText("0042")).toBeInTheDocument();
    expect(dialog.querySelector("canvas")).toBeInTheDocument();
    expect(issueToken).toHaveBeenCalledWith({ data: { eventId: "event-1", eventCode: "1234567" } });
  });

  it("requests a chosen number of additional tokens without food selection", async () => {
    requestTokens.mockResolvedValue({ request_id: "request-1", status: "pending", requested_count: 2, tokens_remaining: 6 });
    render(<StudentEventsTab canteenId="canteen-1" canteenName="FLAMES" userId="student-1" />);
    fireEvent.click(await screen.findByRole("button", { name: /Hackathon/ }));
    fireEvent.change(screen.getByLabelText("7-digit Event Code"), { target: { value: "1234567" } });
    fireEvent.click(screen.getByRole("button", { name: "Open Event" }));
    const dialog = await screen.findByRole("dialog", { name: "Hackathon" });
    fireEvent.click(screen.getByRole("button", { name: "Add one additional token" }));
    expect(screen.getByLabelText("Additional token quantity")).toHaveTextContent("2");
    fireEvent.click(screen.getByRole("button", { name: "Request Additional Tokens" }));
    await waitFor(() => expect(requestTokens).toHaveBeenCalledWith({ data: { eventId: "event-1", requestedCount: 2 } }));
    expect(dialog).not.toHaveTextContent(/Food order|cart|checkout/i);
  });

  it("shows a private signed event logo in the published Student Events view", async () => {
    const logoPath = "faculty-1/event-1/550e8400-e29b-41d4-a716-446655440000.png";
    fixtures.eventLogoPath = logoPath;
    fixtures.signed.mockResolvedValue({ data: [{ path: logoPath, signedUrl: "https://storage.example/student-logo" }], error: null });
    render(<StudentEventsTab canteenId="canteen-1" canteenName="FLAMES" userId="student-1" />);

    const cardLogo = await screen.findByAltText("Hackathon event logo");
    expect(cardLogo).toHaveAttribute("src", "https://storage.example/student-logo");
    expect(cardLogo).toHaveClass("object-contain", "max-h-52", "max-w-full");
    expect(cardLogo.parentElement).toHaveClass("max-h-56", "overflow-hidden", "rounded-2xl");
    fireEvent.click(screen.getByRole("button", { name: /Hackathon/ }));
    fireEvent.change(screen.getByLabelText("7-digit Event Code"), { target: { value: "1234567" } });
    fireEvent.click(screen.getByRole("button", { name: "Open Event" }));
    const displayedLogos = await screen.findAllByAltText("Hackathon event logo");
    expect(displayedLogos).toHaveLength(2);
    displayedLogos.forEach((logo) => expect(logo).toHaveClass("object-contain", "max-h-52", "max-w-full"));
  });
});
