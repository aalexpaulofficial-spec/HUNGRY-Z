import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudentEventsTab } from "@/components/foodexa/StudentEventsTab";

const { issueToken } = vi.hoisted(() => ({ issueToken: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("qrcode.react", () => ({ QRCodeCanvas: () => <canvas aria-label="Event QR code" /> }));
vi.mock("@/lib/hungry.functions", () => ({ issueFacultyEventToken: issueToken }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const query: Record<string, unknown> = {};
      query.select = vi.fn(() => query);
      query.eq = vi.fn(() => query);
      query.order = vi.fn(() => query);
      query.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve({ data: [{ id: "event-1", name: "Hackathon", event_code: "1234567", description: "Campus coding event", event_date: "2026-12-01", venue: "Main Hall", approved_capacity: 10, status: "published" }], error: null }).then(resolve, reject);
      return query;
    },
    rpc: () => ({ maybeSingle: async () => ({ data: { approved_capacity: 10, issued_tokens: 2, tokens_remaining: 8 }, error: null }) }),
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: vi.fn(),
  },
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("student event participation", () => {
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
});
