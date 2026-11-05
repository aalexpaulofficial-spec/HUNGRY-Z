import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({ events: [] as Record<string, unknown>[], realtimeCallbacks: [] as Array<() => unknown>, upload: vi.fn(async () => ({ data: { path: "" }, error: null })), signed: vi.fn(async (_paths: string[]) => ({ data: [] as Array<{ path: string; signedUrl: string }>, error: null as Error | null })), remove: vi.fn(async () => ({ data: [], error: null })) }));

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/hungry.functions", () => ({
  collectFacultyEventToken: vi.fn(), createFacultyEvent: vi.fn(), publishFacultyEvent: vi.fn(),
  deleteFacultyEvent: vi.fn(),
  requestFacultyEventCapacity: vi.fn(), resolveAdditionalFacultyEventTokens: vi.fn(), resolveFacultyEventCapacity: vi.fn(),
  reviewFacultyEventQuotation: vi.fn(), reviewFacultyEventRequest: vi.fn(), submitFacultyEventQuotation: vi.fn(),
  updateFacultyEvent: vi.fn(), updateFacultyEventLogo: vi.fn(), updateFacultyEventServedQuantities: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const result = table === "faculty_events" ? { data: fixtures.events, error: null }
        : table === "menu_items" ? { data: [], error: null }
          : { data: [], error: null };
      const query: Record<string, unknown> = {};
      query.select = vi.fn(() => query);
      query.eq = vi.fn(() => query);
      query.is = vi.fn(() => query);
      query.order = vi.fn(() => query);
      query.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
      return query;
    },
    channel: () => ({ on(_event: unknown, _filter: unknown, callback: () => unknown) { fixtures.realtimeCallbacks.push(callback); return this; }, subscribe() { return this; } }),
    storage: { from: () => ({ upload: fixtures.upload, createSignedUrls: fixtures.signed, remove: fixtures.remove }) },
    removeChannel: vi.fn(),
  },
}));

import { EventCapacityPanel } from "@/components/foodexa/EventCapacityPanel";
import { createFacultyEvent, deleteFacultyEvent, reviewFacultyEventQuotation, submitFacultyEventQuotation, updateFacultyEventLogo, updateFacultyEventServedQuantities } from "@/lib/hungry.functions";

afterEach(() => { cleanup(); vi.clearAllMocks(); fixtures.events = []; fixtures.realtimeCallbacks = []; });

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1", faculty_user_id: "faculty-1", canteen_id: "canteen-1", name: "Revival Meeting", event_code: "1234567", serial_number: 1, token_prefix: "R",
    description: "", event_date: "2026-12-01", venue: "Main Hall", food_request_message: "MAKE 10 CHICKEN BIRYANI", faculty_note: "",
    food_requirements: {}, initial_capacity: 10, approved_capacity: 10, estimated_budget: 0, served_food_quantities: {}, archived_at: null, status: "accepted",
    canteen_note: "", food_confirmation: {}, created_at: "2026-11-05T00:00:00Z", ...overrides,
  };
}

describe("manual quotation for message-only faculty requests", () => {
  it("shows a Faculty-only delete action and archives after confirmation", async () => {
    fixtures.events = [event()];
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(deleteFacultyEvent).mockImplementation(async () => { fixtures.events = []; return { deleted: true }; });
    render(<EventCapacityPanel mode="faculty" canteenId="canteen-1" canteenName="FLAMES" userId="faculty-1" />);
    expect(await screen.findByRole("button", { name: "Delete Event" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete Event" }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Existing tokens, orders and audit history will be preserved."));
    await waitFor(() => expect(deleteFacultyEvent).toHaveBeenCalledWith({ data: { eventId: "event-1" } }));
    expect(await screen.findByText("Event deleted.")).toBeInTheDocument();
    confirm.mockRestore();
  });

  it("does not show event deletion controls to the canteen owner", async () => {
    fixtures.events = [event()];
    render(<EventCapacityPanel mode="canteen" canteenId="canteen-1" canteenName="FLAMES" />);
    await screen.findByText("MAKE 10 CHICKEN BIRYANI");
    expect(screen.queryByRole("button", { name: "Delete Event" })).not.toBeInTheDocument();
  });

  it("lets the canteen edit manual lines, totals them, and sends the quotation", async () => {
    fixtures.events = [event()];
    vi.mocked(submitFacultyEventQuotation).mockResolvedValue({ estimatedBudget: 2500 } as never);
    render(<EventCapacityPanel mode="canteen" canteenId="canteen-1" canteenName="FLAMES" />);

    expect(await screen.findByText("MAKE 10 CHICKEN BIRYANI")).toBeInTheDocument();
    expect(screen.getByText("MANUALLY ADD FOOD ITEMS")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "+ ADD FOOD ITEM" }));
    fireEvent.change(screen.getByLabelText("Manual food item 1"), { target: { value: "Chicken Biryani" } });
    fireEvent.change(screen.getByLabelText("Manual quantity 1"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Manual price per item 1"), { target: { value: "120" } });
    expect(screen.getByText("Subtotal: ₹1,200")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "+ ADD FOOD ITEM" }));
    fireEvent.change(screen.getByLabelText("Manual food item 2"), { target: { value: "Lime Juice" } });
    fireEvent.change(screen.getByLabelText("Manual quantity 2"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Manual price per item 2"), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: "+ ADD FOOD ITEM" }));
    fireEvent.change(screen.getByLabelText("Manual food item 3"), { target: { value: "Samosa" } });
    fireEvent.change(screen.getByLabelText("Manual quantity 3"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("Manual price per item 3"), { target: { value: "25" } });
    expect(screen.getByText("Estimated quotation total: ₹1,600")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "+ ADD FOOD ITEM" }));
    fireEvent.change(screen.getByLabelText("Manual food item 4"), { target: { value: "Temporary item" } });
    fireEvent.change(screen.getByLabelText("Manual quantity 4"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Manual price per item 4"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove manual food item 4" }));
    expect(screen.getByText("Estimated quotation total: ₹1,600")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Send quotation to Faculty" }));
    await waitFor(() => expect(submitFacultyEventQuotation).toHaveBeenCalledWith({ data: {
      eventId: "event-1", quantities: { "Chicken Biryani": 10, "Lime Juice": 5, Samosa: 8 }, prices: { "Chicken Biryani": 120, "Lime Juice": 40, Samosa: 25 }, note: "",
    } }));
  });

  it("shows the manual items and total to faculty with accept and change actions", async () => {
    fixtures.events = [event({
      status: "quotation_received", estimated_budget: 1600,
      food_confirmation: { quantities: { "Chicken Biryani": 10, "Lime Juice": 5, Samosa: 8 }, prices: { "Chicken Biryani": 120, "Lime Juice": 40, Samosa: 25 } },
    })];
    vi.mocked(reviewFacultyEventQuotation).mockResolvedValue({ status: "approved" } as never);
    render(<EventCapacityPanel mode="faculty" canteenId="canteen-1" canteenName="FLAMES" userId="faculty-1" />);

    expect(await screen.findAllByText((_content, node) => node?.tagName === "LI" && node.textContent === "Chicken Biryani × 10 · ₹120")).toHaveLength(2);
    expect(screen.getAllByText((_content, node) => node?.tagName === "LI" && node.textContent === "Lime Juice × 5 · ₹40")).toHaveLength(2);
    expect(screen.getAllByText((_content, node) => node?.tagName === "LI" && node.textContent === "Samosa × 8 · ₹25")).toHaveLength(2);
    expect(screen.getByText("Estimated budget: ₹1600")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request changes" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Approve quotation" }));
    await waitFor(() => expect(reviewFacultyEventQuotation).toHaveBeenCalledWith({ data: { eventId: "event-1", approve: true, note: "" } }));
  });

  it("shows persisted actual manual quantities and refreshes the faculty card from Realtime", async () => {
    fixtures.events = [event({
      status: "published", food_requirements: {},
      food_confirmation: { quantities: { "Chicken Biryani": 10 }, prices: { "Chicken Biryani": 120 } },
      served_food_quantities: {}, served_food_updated_at: null,
    })];
    render(<EventCapacityPanel mode="faculty" canteenId="canteen-1" canteenName="FLAMES" userId="faculty-1" />);

    const servedSummary = await screen.findByRole("region", { name: "Actual food quantities served" });
    expect(servedSummary).toHaveTextContent("Chicken Biryani");
    expect(servedSummary).toHaveTextContent("Originally requested: Not specified");
    expect(servedSummary).toHaveTextContent("Actual served: 0");
    expect(servedSummary).toHaveTextContent("Last updated: Not updated yet");

    fixtures.events = [event({
      status: "published", food_requirements: {},
      food_confirmation: { quantities: { "Chicken Biryani": 10 }, prices: { "Chicken Biryani": 120 } },
      served_food_quantities: { "Chicken Biryani": 12 }, served_food_updated_at: "2026-11-05T10:00:00.000Z",
    })];
    fixtures.realtimeCallbacks.forEach((callback) => callback());
    await waitFor(() => expect(servedSummary).toHaveTextContent("Actual served: 12"));
    expect(servedSummary).toHaveTextContent("2026");
  });

  it("lets the canteen update saved manual items independently of the current menu", async () => {
    fixtures.events = [event({
      status: "published", food_requirements: {},
      food_confirmation: { quantities: { "Chicken Biryani": 10 }, prices: { "Chicken Biryani": 120 } },
      served_food_quantities: {}, served_food_updated_at: null,
    })];
    vi.mocked(updateFacultyEventServedQuantities).mockResolvedValue({ ok: true } as never);
    render(<EventCapacityPanel mode="canteen" canteenId="canteen-1" canteenName="FLAMES" />);

    const quantity = await screen.findByLabelText("Served quantity for Chicken Biryani");
    fireEvent.change(quantity, { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Save served quantities" }));
    await waitFor(() => expect(updateFacultyEventServedQuantities).toHaveBeenCalledWith({
      data: { eventId: "event-1", quantities: { "Chicken Biryani": 12 } },
    }));
  });

  it("uploads an optional faculty event logo to private storage and saves its event path", async () => {
    vi.mocked(createFacultyEvent).mockResolvedValue({ id: "event-2", event_code: "7654321", serial_number: 2 } as never);
    vi.mocked(updateFacultyEventLogo).mockResolvedValue({ oldPath: null } as never);
    fixtures.upload.mockResolvedValue({ data: { path: "" }, error: null });
    const { container } = render(<EventCapacityPanel mode="faculty" canteenId="canteen-1" canteenName="FLAMES" userId="faculty-1" />);

    fireEvent.change(screen.getByLabelText("Event name"), { target: { value: "Faculty Fellowship" } });
    fireEvent.change(screen.getByLabelText("Faculty event details"), { target: { value: "Annual gathering" } });
    fireEvent.change(screen.getByLabelText("Event date"), { target: { value: "2026-12-01" } });
    fireEvent.change(screen.getByLabelText("Event venue"), { target: { value: "Main Hall" } });
    fireEvent.change(screen.getByLabelText("7-digit Event Code"), { target: { value: "7654321" } });
    fireEvent.change(screen.getByLabelText("Message to Canteen (Optional)"), { target: { value: "Prepare lunch" } });
    const logo = new File(["logo"], "event.png", { type: "image/png" });
    const logoInput = screen.getByLabelText("Upload event logo") as HTMLInputElement;
    expect(logoInput.accept).toBe("image/png,image/jpeg,.png,.jpg,.jpeg");
    expect(logoInput.closest("div[aria-label='Event logo upload']")!.compareDocumentPosition(screen.getByLabelText("Event date")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.change(logoInput, { target: { files: [logo] } });
    expect(screen.getByText("Selected file:").parentElement).toHaveTextContent("event.png");
    expect(container.querySelector('img[alt="Event logo preview"]')).toBeInTheDocument();

    fireEvent.change(logoInput, { target: { files: [new File(["new logo"], "replacement.jpg", { type: "image/jpeg" })] } });
    expect(screen.getByText("Selected file:").parentElement).toHaveTextContent("replacement.jpg");
    fireEvent.click(screen.getByRole("button", { name: "Remove image" }));
    expect(screen.queryByText(/Selected file:/)).not.toBeInTheDocument();
    expect(container.querySelector('img[alt="Event logo preview"]')).not.toBeInTheDocument();
    fireEvent.change(logoInput, { target: { files: [logo] } });
    fireEvent.click(screen.getByRole("button", { name: "6. Submit Food Request" }));

    await waitFor(() => expect(fixtures.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^faculty-1\/event-2\/[0-9a-f-]+\.png$/), logo,
      { contentType: "image/png", cacheControl: "3600", upsert: false },
    ));
    expect(updateFacultyEventLogo).toHaveBeenCalledWith({ data: { eventId: "event-2", imagePath: expect.stringMatching(/^faculty-1\/event-2\/[0-9a-f-]+\.png$/) } });
  });

  it("renders signed event logos in Faculty and Canteen event cards", async () => {
    const path = "faculty-1/event-1/550e8400-e29b-41d4-a716-446655440000.png";
    fixtures.events = [event({ status: "published", event_logo_path: path })];
    fixtures.signed.mockResolvedValue({ data: [{ path, signedUrl: "https://storage.example/signed-logo" }], error: null });
    const { unmount } = render(<EventCapacityPanel mode="faculty" canteenId="canteen-1" canteenName="FLAMES" userId="faculty-1" />);
    expect(await screen.findByAltText("Revival Meeting event logo")).toHaveAttribute("src", "https://storage.example/signed-logo");
    unmount();

    render(<EventCapacityPanel mode="canteen" canteenId="canteen-1" canteenName="FLAMES" />);
    expect(await screen.findByAltText("Revival Meeting event logo")).toHaveAttribute("src", "https://storage.example/signed-logo");
  });
});
