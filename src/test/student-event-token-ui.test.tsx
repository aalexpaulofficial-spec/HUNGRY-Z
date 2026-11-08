import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudentEventsTab } from "@/components/foodexa/StudentEventsTab";

const { listEvents, verifyCode, issueToken } = vi.hoisted(() => ({ listEvents: vi.fn(), verifyCode: vi.fn(), issueToken: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("qrcode.react", () => ({ QRCodeCanvas: () => <canvas aria-label="Event QR code" /> }));
vi.mock("@/lib/hungry.functions", () => ({
  listPublishedFacultyEventCards: listEvents,
  verifyFacultyEventAccessCode: verifyCode,
  issueFacultyEventToken: issueToken,
}));

const eventCard = {
  id: "event-1", serial_number: 1, name: "Hackathon", description: "Campus coding event",
  event_date: "2026-12-01", venue: "Main Hall", event_logo_url: "https://storage.example/student-logo",
};
function eventDetails(tokens: Array<{ id: string; token_number: string; status: string }> = []) {
  return {
    id: "event-1", name: "Hackathon", serial_number: 1, description: "Campus coding event", event_date: "2026-12-01", venue: "Main Hall",
    approved_capacity: 10, issued_tokens: tokens.length, tokens_remaining: 10 - tokens.length, capacity_available: true,
    my_tokens: tokens, event_logo_url: "https://storage.example/student-logo",
  };
}

beforeEach(() => {
  listEvents.mockResolvedValue([eventCard]);
  verifyCode.mockImplementation(async ({ data }: { data: { eventId: string; eventCode: string } }) => {
    if (data.eventId !== eventCard.id || data.eventCode !== "1234567") throw new Error("Invalid Event Access Code. Check the 7-digit code and try again.");
    return eventDetails();
  });
  issueToken.mockResolvedValue({ token_number: "0042", approved_capacity: 10, issued_tokens: 1, tokens_remaining: 9, already_issued: false });
});

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("faculty event access-code gate", () => {
  it.each(["student", "faculty", "guest"])("requires code verification for %s before showing details or tokens", async (role) => {
    render(<StudentEventsTab canteenId="00000000-0000-0000-0000-000000000001" canteenName="FLAMES" userId={`${role}-1`} />);
    fireEvent.click(await screen.findByRole("button", { name: "View event EVENT #001" }));

    expect(await screen.findByRole("dialog", { name: "Verify Event Access" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hackathon" })).toBeInTheDocument();
    expect(screen.getByText("Campus coding event")).toBeInTheDocument();
    expect(screen.getByText("Main Hall")).toBeInTheDocument();
    expect(document.body).toHaveTextContent(new Date("2026-12-01T00:00:00").toLocaleDateString());
    expect(screen.getByRole("img", { name: "Hackathon event image" })).toHaveAttribute("src", eventCard.event_logo_url);
    expect(screen.queryByRole("dialog", { name: "Hackathon" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generate Token" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("7-digit Event Access Code"), { target: { value: "1234567" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify Code" }));
    expect(await screen.findByRole("dialog", { name: "Hackathon" })).toHaveTextContent("Campus coding event");
    expect(verifyCode).toHaveBeenCalledWith({ data: { eventId: "event-1", eventCode: "1234567" } });
  });

  it("keeps event details and token generation hidden after an invalid code", async () => {
    render(<StudentEventsTab canteenId="00000000-0000-0000-0000-000000000001" canteenName="FLAMES" userId="student-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "View event EVENT #001" }));
    fireEvent.change(await screen.findByLabelText("7-digit Event Access Code"), { target: { value: "7654321" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify Code" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid Event Access Code");
    expect(screen.getByRole("dialog", { name: "Verify Event Access" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hackathon" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Hackathon" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generate Token" })).not.toBeInTheDocument();
    expect(issueToken).not.toHaveBeenCalled();
  });

  it("generates a unique token only after verification and no longer shows additional-token controls", async () => {
    verifyCode.mockResolvedValueOnce(eventDetails()).mockResolvedValueOnce(eventDetails([{ id: "00000000-0000-4000-8000-000000000042", token_number: "0042", status: "issued" }]));
    render(<StudentEventsTab canteenId="00000000-0000-0000-0000-000000000001" canteenName="FLAMES" userId="student-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "View event EVENT #001" }));
    fireEvent.change(await screen.findByLabelText("7-digit Event Access Code"), { target: { value: "1234567" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify Code" }));

    const dialog = await screen.findByRole("dialog", { name: "Hackathon" });
    expect(dialog).toHaveTextContent("Main Hall");
    expect(dialog.querySelector("img")).toHaveAttribute("src", "https://storage.example/student-logo");
    expect(screen.getByRole("button", { name: "Generate Token" })).toBeInTheDocument();
    expect(screen.queryByText("Additional tokens")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Request Additional Tokens/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Additional token quantity")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Generate Token" }));
    expect(await screen.findByText("0042")).toBeInTheDocument();
    expect(dialog.querySelector("canvas")).toBeInTheDocument();
    expect(issueToken).toHaveBeenCalledWith({ data: { eventId: "event-1", eventCode: "1234567" } });
    await waitFor(() => expect(verifyCode).toHaveBeenCalledTimes(2));
  });

  it("shows the event created by this Faculty member in their selected canteen listing", async () => {
    render(<StudentEventsTab canteenId="00000000-0000-0000-0000-000000000001" canteenName="FLAMES" userId="faculty-creator" />);
    expect(await screen.findByRole("heading", { name: "Hackathon" })).toBeInTheDocument();
    expect(listEvents).toHaveBeenCalledWith({ data: { canteenId: "00000000-0000-0000-0000-000000000001" } });
    fireEvent.click(screen.getByRole("button", { name: "View event EVENT #001" }));
    expect(await screen.findByRole("dialog", { name: "Verify Event Access" })).toBeInTheDocument();
  });
});
