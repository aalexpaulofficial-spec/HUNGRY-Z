import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({ events: [] as Record<string, unknown>[] }));

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/hungry.functions", () => ({
  collectFacultyEventToken: vi.fn(), createFacultyEvent: vi.fn(), publishFacultyEvent: vi.fn(),
  requestFacultyEventCapacity: vi.fn(), resolveAdditionalFacultyEventTokens: vi.fn(), resolveFacultyEventCapacity: vi.fn(),
  reviewFacultyEventQuotation: vi.fn(), reviewFacultyEventRequest: vi.fn(), submitFacultyEventQuotation: vi.fn(),
  updateFacultyEvent: vi.fn(), updateFacultyEventServedQuantities: vi.fn(),
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
      query.order = vi.fn(() => query);
      query.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
      return query;
    },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: vi.fn(),
  },
}));

import { EventCapacityPanel } from "@/components/foodexa/EventCapacityPanel";
import { reviewFacultyEventQuotation, submitFacultyEventQuotation } from "@/lib/hungry.functions";

afterEach(() => { cleanup(); vi.clearAllMocks(); fixtures.events = []; });

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1", faculty_user_id: "faculty-1", canteen_id: "canteen-1", name: "Revival Meeting", event_code: "1234567", token_prefix: "R",
    description: "", event_date: "2026-12-01", venue: "Main Hall", food_request_message: "MAKE 10 CHICKEN BIRYANI", faculty_note: "",
    food_requirements: {}, initial_capacity: 10, approved_capacity: 10, estimated_budget: 0, served_food_quantities: {}, status: "accepted",
    canteen_note: "", food_confirmation: {}, created_at: "2026-11-05T00:00:00Z", ...overrides,
  };
}

describe("manual quotation for message-only faculty requests", () => {
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
});
