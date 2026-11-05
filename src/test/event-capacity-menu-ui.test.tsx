import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventCapacityPanel } from "@/components/foodexa/EventCapacityPanel";
import { createFacultyEvent } from "@/lib/hungry.functions";

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/hungry.functions", () => ({
  createFacultyEvent: vi.fn(), publishFacultyEvent: vi.fn(), requestFacultyEventCapacity: vi.fn(),
  resolveFacultyEventCapacity: vi.fn(), reviewFacultyEventRequest: vi.fn(), updateFacultyEvent: vi.fn(),
  submitFacultyEventQuotation: vi.fn(), reviewFacultyEventQuotation: vi.fn(), collectFacultyEventToken: vi.fn(),
  updateFacultyEventServedQuantities: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const result = table === "menu_items"
        ? { data: [
          { id: "dosa", name: "DOSA", price: 4, image: "https://images.example/dosa.jpg", category: "BREAKFAST", stock: 10 },
          { id: "wada", name: "WADA", price: 8, image: "https://images.example/wada.jpg", category: "BREAKFAST", stock: 10 },
        ], error: null }
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

afterEach(() => { cleanup(); vi.clearAllMocks(); });

function fillEventBasics() {
  fireEvent.change(screen.getByLabelText("Event name"), { target: { value: "Campus Meetup" } });
  fireEvent.change(screen.getByLabelText("Event date"), { target: { value: "2026-12-01" } });
  fireEvent.change(screen.getByLabelText("Event venue"), { target: { value: "Main Hall" } });
  fireEvent.change(screen.getByLabelText("7-digit Event Code"), { target: { value: "1000002" } });
}

async function submitFoodRequest() {
  fireEvent.submit(screen.getByRole("button", { name: "6. Submit Food Request" }).closest("form")!);
}

describe("faculty event food request menu", () => {
  it("shows a validation error only when both menu quantities and canteen message are empty", async () => {
    render(<EventCapacityPanel mode="faculty" canteenId="canteen-1" canteenName="FLAMES" />);
    fillEventBasics();
    fireEvent.change(screen.getByLabelText("Message to Canteen (Optional)"), { target: { value: "   " } });
    await submitFoodRequest();

    expect(await screen.findByRole("alert")).toHaveTextContent("Select at least one food item or enter a message to the canteen.");
    expect(createFacultyEvent).not.toHaveBeenCalled();
  });

  it("submits a request with a message and no menu items", async () => {
    vi.mocked(createFacultyEvent).mockResolvedValue({ event_code: "1000002" } as never);
    render(<EventCapacityPanel mode="faculty" canteenId="canteen-1" canteenName="FLAMES" />);
    fillEventBasics();
    fireEvent.change(screen.getByLabelText("Message to Canteen (Optional)"), { target: { value: "Please suggest a suitable menu." } });
    await submitFoodRequest();

    await waitFor(() => expect(createFacultyEvent).toHaveBeenCalledWith({ data: expect.objectContaining({ foodRequirements: {}, foodRequestMessage: "Please suggest a suitable menu." }) }));
    expect(await screen.findByRole("status")).toHaveTextContent("Event request sent to FLAMES.");
  });

  it("submits a request with a selected menu item and no message", async () => {
    vi.mocked(createFacultyEvent).mockResolvedValue({ event_code: "1000002" } as never);
    render(<EventCapacityPanel mode="faculty" canteenId="canteen-1" canteenName="FLAMES" />);
    fillEventBasics();
    fireEvent.click(await screen.findByRole("button", { name: "Open FLAMES menu" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add one DOSA" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "FLAMES Menu" })).not.toBeInTheDocument());
    await submitFoodRequest();

    await waitFor(() => expect(createFacultyEvent).toHaveBeenCalledWith({ data: expect.objectContaining({ foodRequirements: { DOSA: 1 }, foodRequestMessage: "" }) }));
  });

  it("hides menu cards until MENU opens and preserves selections across closing and reopening", async () => {
    render(<EventCapacityPanel mode="faculty" canteenId="canteen-1" canteenName="FLAMES" />);

    const menuButton = await screen.findByRole("button", { name: "Open FLAMES menu" });
    const detailsField = screen.getByLabelText("Faculty event details");
    expect(screen.getByText("FACULTY EVENT DETAILS")).toBeInTheDocument();
    expect(detailsField).toHaveClass("text-foreground");
    expect(detailsField.parentElement).toHaveClass("border-primary/45", "bg-primary/[0.06]");
    expect(screen.queryByText("DOSA")).not.toBeInTheDocument();
    expect(screen.queryByText("WADA")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Message to Canteen (Optional)")).toBeInTheDocument();

    fireEvent.click(menuButton);
    expect(await screen.findByRole("dialog", { name: "FLAMES Menu" })).toBeInTheDocument();
    expect(screen.getByText("DOSA")).toBeInTheDocument();
    expect(screen.getByText("WADA")).toBeInTheDocument();
    expect(screen.getByText("BREAKFAST · ₹4")).toBeInTheDocument();
    expect(screen.getAllByAltText("")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Add one DOSA" }));
    fireEvent.click(screen.getByRole("button", { name: "Add one WADA" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "FLAMES Menu" })).not.toBeInTheDocument());
    expect(screen.getByText("DOSA × 1")).toBeInTheDocument();
    expect(screen.getByText("WADA × 1")).toBeInTheDocument();
    expect(screen.getByText("2 items · 2 total")).toBeInTheDocument();

    fireEvent.click(menuButton);
    expect(screen.getByLabelText("DOSA quantity")).toHaveTextContent("1");
    expect(screen.getByLabelText("WADA quantity")).toHaveTextContent("1");
  });
});
