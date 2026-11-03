import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getSession: vi.fn(),
  hasRole: vi.fn(),
  ownerCanteen: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/app", searchStr: "" }),
  useRouter: () => ({}),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: supabaseMocks.getUser, getSession: supabaseMocks.getSession },
    rpc: supabaseMocks.hasRole,
    from: () => ({ select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: supabaseMocks.ownerCanteen }) }) }) }),
  },
}));

import { BackButton, BackProvider, getBackFallbackPath, getSafeBackFallbackPath, navigateBack, useBackNavigationEnabled, useBackStep } from "@/lib/back-nav";

describe("shared back navigation", () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => {
    supabaseMocks.getUser.mockReset();
    supabaseMocks.getSession.mockReset();
    supabaseMocks.hasRole.mockReset();
    supabaseMocks.ownerCanteen.mockReset();
  });

  it.each([
    ["/auth", "/"],
    ["/register-canteen", "/"],
    ["/app/orders/123", "/app/orders"],
  ])("uses the parent fallback for %s", (pathname, expected) => {
    expect(getBackFallbackPath(pathname)).toBe(expected);
  });

  it("uses tracked HUNGRY router history rather than arbitrary browser history", async () => {
    vi.spyOn(window.history, "length", "get").mockReturnValue(1);
    const router = { stores: { location: { get: () => ({ state: { __TSR_index: 2 } }) } }, history: { back: vi.fn() }, navigate: vi.fn() };

    await navigateBack(router as never, "/auth", []);

    expect(router.history.back).toHaveBeenCalledOnce();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("does not leave HUNGRY for unrelated browser history", async () => {
    vi.spyOn(window.history, "length", "get").mockReturnValue(4);
    const router = { stores: { location: { get: () => ({ state: { __TSR_index: 0 } }) } }, history: { back: vi.fn() }, navigate: vi.fn() };

    await navigateBack(router as never, "/app/orders/123", []);

    expect(router.history.back).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith({ to: "/app/orders", replace: true });
  });

  it("runs the current in-page back step before changing routes", async () => {
    const step = vi.fn();
    const router = { stores: { location: { get: () => ({ state: { __TSR_index: 2 } }) } }, history: { back: vi.fn() }, navigate: vi.fn() };

    await navigateBack(router as never, "/app", [{ id: 1, fn: step }]);

    expect(step).toHaveBeenCalledOnce();
    expect(router.history.back).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("uses the authenticated canteen dashboard as the legal-page fallback", async () => {
    supabaseMocks.getUser.mockResolvedValue({ data: { user: { id: "owner-1" } }, error: null });
    supabaseMocks.hasRole.mockResolvedValue({ data: false, error: null });
    supabaseMocks.ownerCanteen.mockResolvedValue({ data: { id: "canteen-1" }, error: null });
    await expect(getSafeBackFallbackPath("/privacy")).resolves.toBe("/canteen");
  });

  it("uses the authenticated admin dashboard as the legal-page fallback", async () => {
    supabaseMocks.getUser.mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null });
    supabaseMocks.hasRole.mockResolvedValue({ data: true, error: null });
    await expect(getSafeBackFallbackPath("/terms")).resolves.toBe("/admin");
  });

  it("uses a saved Supabase session when live auth verification is temporarily unavailable", async () => {
    supabaseMocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("offline") });
    supabaseMocks.getSession.mockResolvedValue({ data: { session: { user: { id: "student-1" } } }, error: null });
    supabaseMocks.hasRole.mockResolvedValue({ data: false, error: null });
    supabaseMocks.ownerCanteen.mockResolvedValue({ data: null, error: null });

    await expect(getSafeBackFallbackPath("/privacy")).resolves.toBe("/app");
  });

  it("uses the student dashboard for signed-in customers and the landing page for visitors", async () => {
    supabaseMocks.getUser.mockResolvedValue({ data: { user: { id: "student-1" } }, error: null });
    supabaseMocks.hasRole.mockResolvedValue({ data: false, error: null });
    supabaseMocks.ownerCanteen.mockResolvedValue({ data: null, error: null });
    await expect(getSafeBackFallbackPath("/privacy")).resolves.toBe("/app");

    supabaseMocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(getSafeBackFallbackPath("/terms")).resolves.toBe("/");
  });

  it("disables back navigation and back-step registration for installed app shells", () => {
    function BackNavigationProbe() {
      useBackStep(true, vi.fn());
      return createElement("span", null, useBackNavigationEnabled() ? "enabled" : "disabled");
    }

    render(
      createElement(
        BackProvider,
        { disabled: true },
        createElement(BackButton),
        createElement(BackNavigationProbe),
      ),
    );

    expect(screen.getByText("disabled")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Go back" })).not.toBeInTheDocument();
  });

  it("keeps the website back button enabled by default", () => {
    render(createElement(BackProvider, null, createElement(BackButton)));

    expect(screen.getByRole("button", { name: "Go back" })).toBeInTheDocument();
  });
});
