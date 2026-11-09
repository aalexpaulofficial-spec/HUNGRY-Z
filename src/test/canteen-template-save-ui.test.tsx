import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";

const mocks = vi.hoisted(() => ({
  storedTemplate: null as Record<string, unknown> | null,
  savedPayload: null as Record<string, unknown> | null,
  uploadedPath: "" as string,
}));

vi.mock("@/integrations/supabase/client", () => {
  const builders = (table: string) => {
    let payload: Record<string, unknown> = {};
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.is = () => builder;
    builder.order = () => builder;
    builder.limit = () => builder;
    builder.maybeSingle = async () => ({ data: table === "canteen_templates" ? mocks.storedTemplate : null, error: null });
    builder.upsert = (next: Record<string, unknown>) => { payload = next; mocks.savedPayload = next; return builder; };
    builder.single = async () => {
      mocks.storedTemplate = { ...payload, updated_at: "2026-10-31T00:00:00.000Z" };
      return { data: mocks.storedTemplate, error: null };
    };
    return builder;
  };
  const subscription = { on: () => subscription, subscribe: () => subscription };
  return {
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: "owner-1" } }, error: null }) },
      from: (table: string) => builders(table),
      channel: () => subscription,
      removeChannel: () => undefined,
      storage: {
        from: () => ({
          upload: async (path: string) => { mocks.uploadedPath = path; return { error: null }; },
          getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.example/${path}` } }),
          remove: async () => ({ error: null }),
        }),
      },
    },
  };
});

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ to, children, ...props }: ComponentProps<typeof actual.Link>) => <a href={to as string} {...props}>{children as React.ReactNode}</a>,
  };
});
vi.mock("@/lib/hungry.functions", () => ({
  createCanteenMenuImageUpload: vi.fn(),
  getCanteenOwnerAccess: vi.fn(),
  ownerRecordConfirmedBillPrint: vi.fn(),
  saveCanteenAvailability: vi.fn(),
  submitSupportRequest: vi.fn(),
  ownerUpdateOrderStatus: vi.fn(),
}));
vi.mock("@/lib/back-nav", () => ({ BackButton: () => null, useBackStep: () => undefined }));

import { Dashboard } from "@/routes/canteen";

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  mocks.storedTemplate = null;
  mocks.savedPayload = null;
  mocks.uploadedPath = "";
  vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:banner-preview", revokeObjectURL: vi.fn() });
});

describe("canteen template save flow", () => {
  it("uploads the selected image, saves crop settings, returns to Menu, and restores the saved crop", async () => {
    const { container } = render(<Dashboard canteen={{ id: "canteen-1", code: "ABC1234", name: "Main Canteen", university_name: "Campus", visibility: "public", is_active: true, availability_mode: "schedule", timezone: "Asia/Kolkata", operating_hours: { mon: { open: "00:00", close: "24:00" }, tue: { open: "00:00", close: "24:00" }, wed: { open: "00:00", close: "24:00" }, thu: { open: "00:00", close: "24:00" }, fri: { open: "00:00", close: "24:00" }, sat: { open: "00:00", close: "24:00" }, sun: { open: "00:00", close: "24:00" } } }} language="en" onLanguageChange={() => undefined} onSignOut={() => undefined} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /CHANGE TEMPLATE/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /CHANGE TEMPLATE/ }));

    const file = new File([new Uint8Array([1, 2, 3])], "banner.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Choose canteen banner image"), { target: { files: [file] } });
    await waitFor(() => expect(container.querySelector('img[src="blob:banner-preview"]')).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /mobile/i }));
    expect(screen.getByTestId("banner-preview-frame")).toHaveStyle({ maxWidth: "360px" });
    fireEvent.click(screen.getByRole("button", { name: /tablet/i }));
    expect(screen.getByTestId("banner-preview-frame")).toHaveStyle({ maxWidth: "640px" });
    fireEvent.click(screen.getByRole("button", { name: /laptop/i }));

    const dragSurface = container.querySelector(".cursor-grab") as HTMLElement;
    Object.defineProperty(dragSurface, "getBoundingClientRect", { value: () => ({ width: 100, height: 100, left: 0, top: 0, right: 100, bottom: 100 }) });
    const pointer = (name: string, x: number, y: number) => {
      const event = new Event(name, { bubbles: true });
      Object.defineProperties(event, { pointerId: { value: 8 }, clientX: { value: x }, clientY: { value: y } });
      fireEvent(dragSurface, event);
    };
    pointer("pointerdown", 50, 50);
    pointer("pointermove", 60, 40);
    pointer("pointerup", 60, 40);
    fireEvent.change(screen.getByRole("slider", { name: "Banner image zoom" }), { target: { value: "1.8" } });
    fireEvent.change(screen.getByPlaceholderText("Heading (optional)"), { target: { value: "Welcome" } });
    fireEvent.change(screen.getByPlaceholderText("Description (optional)"), { target: { value: "Fresh food" } });

    fireEvent.click(screen.getByRole("button", { name: "Save template" }));
    await waitFor(() => expect(mocks.savedPayload).toMatchObject({
      canteen_id: "canteen-1",
      banner_image_url: expect.stringMatching(/^https:\/\/storage\.example\/canteen-1\//),
      heading: "Welcome",
      description: "Fresh food",
      banner_crop_x: 0,
      banner_crop_y: 100,
      banner_crop_zoom: 1.8,
    }));
    expect(mocks.uploadedPath).toMatch(/^canteen-1\//);
    await waitFor(() => expect(screen.getByRole("button", { name: /MENU/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /CHANGE TEMPLATE/ }));
    await waitFor(() => expect(screen.getByRole("slider", { name: "Banner image zoom" })).toHaveValue("1.8"));
    expect(container.querySelector(".cursor-grab img")).toHaveStyle({ transform: "translate(40%, -40%) scale(1.8)" });
  });

  it("uses one editable search field for physical and on-screen input and closes the keypad on cancel", async () => {
    localStorage.setItem("hungry:offline-menu:canteen-1", JSON.stringify([{ id: "item-1", name: "Lime Soda", price: 30, image: null, category: "Drinks", description: "Fresh lime", stock: 0, available: false }]));
    render(<Dashboard canteen={{ id: "canteen-1", code: "ABC1234", name: "Main Canteen", university_name: "Campus", visibility: "public", is_active: true, availability_mode: "schedule", timezone: "Asia/Kolkata", operating_hours: { mon: { open: "00:00", close: "24:00" }, tue: { open: "00:00", close: "24:00" }, wed: { open: "00:00", close: "24:00" }, thu: { open: "00:00", close: "24:00" }, fri: { open: "00:00", close: "24:00" }, sat: { open: "00:00", close: "24:00" }, sun: { open: "00:00", close: "24:00" } } }} language="en" onLanguageChange={() => undefined} onSignOut={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: /OFFLINE POS/ }));

    const search = screen.getByRole("searchbox", { name: "Search POS menu" });
    expect(search).not.toHaveAttribute("readonly");
    expect(screen.getByRole("group", { name: "On-screen search keyboard" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "A" }));
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(search).toHaveValue("A2");
    fireEvent.click(screen.getByRole("button", { name: "Backspace" }));
    expect(search).toHaveValue("A");
    fireEvent.click(screen.getByRole("button", { name: "Space" }));
    expect(search).toHaveValue("A ");
    fireEvent.click(screen.getByRole("button", { name: "123" }));
    fireEvent.click(screen.getByRole("button", { name: "!" }));
    expect(search).toHaveValue("A !");
    fireEvent.click(screen.getByRole("button", { name: "ABC" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(search).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "A" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("group", { name: "On-screen search keyboard" })).not.toBeInTheDocument();
    fireEvent.focus(search);
    expect(screen.getByRole("group", { name: "On-screen search keyboard" })).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole("heading", { name: "Offline POS" }));
    expect(screen.queryByRole("group", { name: "On-screen search keyboard" })).not.toBeInTheDocument();
    expect(search).toHaveValue("A");
    fireEvent.focus(search);
    expect(screen.getByRole("group", { name: "On-screen search keyboard" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(search).toHaveValue("");

    const searchBounds = { top: -60, bottom: -20, left: 0, right: 300, width: 300, height: 40, x: 0, y: -60, toJSON: () => ({}) };
    vi.spyOn(search, "getBoundingClientRect").mockReturnValue(searchBounds as DOMRect);
    act(() => { window.dispatchEvent(new Event("scroll")); });
    expect(screen.queryByRole("group", { name: "On-screen search keyboard" })).not.toBeInTheDocument();
    vi.restoreAllMocks();

    fireEvent.focus(search);
    fireEvent.click(screen.getByRole("button", { name: "Add Lime Soda, ₹30" }));
    expect(screen.queryByRole("group", { name: "On-screen search keyboard" })).not.toBeInTheDocument();
    const currentBill = screen.getByRole("complementary", { name: "Current counter bill" });
    expect(currentBill).toHaveTextContent("Lime Soda");
    fireEvent.click(within(currentBill).getByRole("button", { name: "Increase Lime Soda" }));
    expect(currentBill).toHaveTextContent("2");
    expect(currentBill).toHaveTextContent(/60/);

    expect(search).not.toHaveAttribute("readonly");
    fireEvent.change(search, { target: { value: "lime" } });
    expect(search).toHaveValue("lime");
    expect(screen.getByRole("button", { name: "Add Lime Soda, ₹30" })).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "tea" } });
    expect(screen.queryByRole("button", { name: "Add Lime Soda, ₹30" })).not.toBeInTheDocument();
  });

  it("shows complete held-order cards without a nested scroller and resumes the saved bill", () => {
    localStorage.setItem("hungry:offline-pos:canteen-1", JSON.stringify({
      current: [],
      held: [{ id: "H-12345678", createdAt: "2026-11-09T10:00:00.000Z", paymentMethod: "upi", paymentStatus: "paid", lines: [{ id: "item-1", name: "Lime Soda", price: 30, image: null, category: "Drinks", stock: 0, qty: 2 }] }],
      completed: [], paymentMethod: "cash", paymentStatus: "unpaid",
    }));
    render(<Dashboard canteen={{ id: "canteen-1", code: "ABC1234", name: "Main Canteen", university_name: "Campus", visibility: "public", is_active: true, availability_mode: "schedule", timezone: "Asia/Kolkata", operating_hours: { mon: { open: "00:00", close: "24:00" }, tue: { open: "00:00", close: "24:00" }, wed: { open: "00:00", close: "24:00" }, thu: { open: "00:00", close: "24:00" }, fri: { open: "00:00", close: "24:00" }, sat: { open: "00:00", close: "24:00" }, sun: { open: "00:00", close: "24:00" } } }} language="en" onLanguageChange={() => undefined} onSignOut={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: /OFFLINE POS/ }));

    const heldSection = screen.getByRole("region", { name: "Held orders" });
    expect(heldSection).toHaveTextContent("H-12345678");
    expect(heldSection).toHaveTextContent("Lime Soda");
    expect(heldSection).toHaveTextContent("2 ×");
    expect(heldSection).toHaveTextContent(new Date("2026-11-09T10:00:00.000Z").toLocaleString());
    expect(heldSection).toHaveTextContent("₹60");
    expect(heldSection).toHaveTextContent("UPI");
    expect(heldSection).toHaveTextContent("PAID");
    expect(heldSection.querySelector(".overflow-y-auto")).toBeNull();
    fireEvent.click(within(heldSection).getByRole("button", { name: "RESUME" }));
    const currentBill = screen.getByRole("complementary", { name: "Current counter bill" });
    expect(currentBill).toHaveTextContent("Lime Soda");
    expect(currentBill).toHaveTextContent("₹30 × 2 = ₹60");
    expect(screen.getByText("No held bills on this device.")).toBeInTheDocument();
  });
});
