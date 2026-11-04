import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventCapacityPanel } from "@/components/foodexa/EventCapacityPanel";

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/hungry.functions", () => ({
  createFacultyEvent: vi.fn(), publishFacultyEvent: vi.fn(), requestFacultyEventCapacity: vi.fn(),
  resolveFacultyEventCapacity: vi.fn(), reviewFacultyEventRequest: vi.fn(), updateFacultyEvent: vi.fn(),
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

afterEach(() => cleanup());

describe("faculty event food request menu", () => {
  it("hides menu cards until MENU opens and preserves selections across closing and reopening", async () => {
    render(<EventCapacityPanel mode="faculty" canteenId="canteen-1" canteenName="FLAMES" />);

    const menuButton = await screen.findByRole("button", { name: "Open FLAMES menu" });
    expect(screen.queryByText("DOSA")).not.toBeInTheDocument();
    expect(screen.queryByText("WADA")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Additional Food Requirements/)).not.toBeInTheDocument();

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
