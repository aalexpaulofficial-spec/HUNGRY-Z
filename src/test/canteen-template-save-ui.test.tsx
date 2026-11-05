import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  mocks.storedTemplate = null;
  mocks.savedPayload = null;
  mocks.uploadedPath = "";
  vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:banner-preview", revokeObjectURL: vi.fn() });
});

describe("canteen template save flow", () => {
  it("uploads the selected image, saves crop settings, returns to Menu, and restores the saved crop", async () => {
    const { container } = render(<Dashboard canteen={{ id: "canteen-1", code: "ABC1234", name: "Main Canteen", university_name: "Campus", visibility: "public", is_active: true, availability_mode: "schedule", timezone: "Asia/Kolkata", operating_hours: { mon: { open: "00:00", close: "24:00" }, tue: { open: "00:00", close: "24:00" }, wed: { open: "00:00", close: "24:00" }, thu: { open: "00:00", close: "24:00" }, fri: { open: "00:00", close: "24:00" }, sat: { open: "00:00", close: "24:00" }, sun: { open: "00:00", close: "24:00" } } }} language="en" onLanguageChange={() => undefined} onSignOut={() => undefined} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Change Template/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Change Template/ }));

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
    await waitFor(() => expect(screen.getByRole("button", { name: /Menu/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Change Template/ }));
    await waitFor(() => expect(screen.getByRole("slider", { name: "Banner image zoom" })).toHaveValue("1.8"));
    expect(container.querySelector(".cursor-grab img")).toHaveStyle({ transform: "translate(40%, -40%) scale(1.8)" });
  });
});
