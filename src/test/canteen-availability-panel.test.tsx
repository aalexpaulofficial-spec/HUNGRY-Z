import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CanteenAvailabilityPanel, type AvailabilitySettings } from "@/components/foodexa/CanteenAvailabilityPanel";
import { DEFAULT_WEEKLY_HOURS } from "@/lib/canteen-availability";

afterEach(cleanup);

const settings: AvailabilitySettings = {
  availability_mode: "schedule",
  operating_hours: DEFAULT_WEEKLY_HOURS,
};

describe("canteen availability controls", () => {
  it("opens the weekly schedule from SCHEDULE and toggles it closed on the next click", () => {
    render(<CanteenAvailabilityPanel isActive visibility="public" settings={settings} saving={false} onSave={vi.fn().mockResolvedValue(undefined)} />);
    const schedule = screen.getByRole("button", { name: /SCHEDULE/ });
    expect(screen.queryByLabelText("Monday open")).not.toBeInTheDocument();

    fireEvent.click(schedule);
    expect(screen.getByLabelText("Monday open")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Monday all day"));
    expect(screen.getByLabelText("Monday from AM/PM")).toBeInTheDocument();
    expect(screen.getByLabelText("Monday to AM/PM")).toBeInTheDocument();
    fireEvent.click(schedule);
    expect(screen.queryByLabelText("Monday open")).not.toBeInTheDocument();
  });

  it("saves an owner manual close and reflects the realtime CLOSED state", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<CanteenAvailabilityPanel isActive visibility="public" settings={settings} saving={false} onSave={onSave} />);

    expect(screen.getByText("OPEN — Accepting Orders")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /CLOSED/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ ...settings, availability_mode: "closed" }));

    rerender(<CanteenAvailabilityPanel isActive visibility="public" settings={{ ...settings, availability_mode: "closed" }} saving={false} onSave={onSave} />);
    expect(screen.getByText("CLOSED — Not Accepting Orders")).toBeInTheDocument();
    expect(screen.getByText("The owner has temporarily closed the canteen.")).toBeInTheDocument();
    expect(screen.queryByText(/Opens next at/)).not.toBeInTheDocument();
  });

  it("saves changed weekly hours in IST", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<CanteenAvailabilityPanel isActive visibility="public" settings={settings} saving={false} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /SCHEDULE/ }));
    fireEvent.click(screen.getByLabelText("Monday all day"));
    fireEvent.change(screen.getByLabelText("Monday from hour"), { target: { value: "08" } });
    fireEvent.change(screen.getByLabelText("Monday from minute"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Save hours" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ ...settings, operating_hours: { ...DEFAULT_WEEKLY_HOURS, mon: { open: "08:30", close: "17:00" } } }));
  });
});
