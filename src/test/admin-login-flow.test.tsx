import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminLogin: vi.fn(),
  signInWithPassword: vi.fn(),
  signedIn: false,
  getUserError: null as Error | null,
  from: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({ useServerFn: () => mocks.adminLogin }));
vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
    createFileRoute: () => (options: unknown) => options,
    Link: ({ to, children, ...props }: React.PropsWithChildren<{ to: string }>) =>
      React.createElement("a", { href: to, ...props }, children),
  };
});
vi.mock("@/lib/backend-config", () => ({ backendConfigured: true }));
vi.mock("@/lib/back-nav", () => ({ BackButton: () => null, useBackStep: () => {} }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: mocks.signedIn ? { id: "test-admin-user" } : null }, error: mocks.getUserError }),
      signInWithPassword: mocks.signInWithPassword,
      signOut: async () => { mocks.signedIn = false; },
    },
    rpc: async () => ({ data: mocks.signedIn }),
    from: mocks.from,
  },
}));
vi.mock("@/lib/hungry.functions", () => ({
  adminLogin: vi.fn(),
  approveApplication: vi.fn(),
  issueCanteenOwnerCredentials: vi.fn(),
  approveRefund: vi.fn(),
  createCoupon: vi.fn(),
  rejectApplication: vi.fn(),
  rejectRefund: vi.fn(),
  setCanteenVisibility: vi.fn(),
  setCouponActive: vi.fn(),
}));

import { Route } from "@/routes/admin";

const AdminPage = (Route as unknown as { component: ComponentType }).component;

describe("admin login flow", () => {
  beforeEach(() => {
    mocks.adminLogin.mockReset();
    mocks.signInWithPassword.mockReset();
    mocks.signedIn = false;
    mocks.getUserError = null;
    mocks.from.mockImplementation(() => {
      const query = {
        select: () => query,
        order: async () => ({ data: [], error: null }),
      };
      return query;
    });
  });

  async function submitLogin() {
    await screen.findByRole("heading", { name: "Admin Login" });
    fireEvent.change(screen.getByRole("textbox", { name: "Admin Email" }), {
      target: { value: "test-admin@example.invalid" },
    });
    fireEvent.change(screen.getByLabelText("Admin Password"), {
      target: { value: "test-only-password" },
    });
    fireEvent.submit(screen.getByLabelText("Admin Email").closest("form")!);
  }

  it("shows the login form without a connection error when no session exists", async () => {
    mocks.getUserError = Object.assign(new Error("Auth session missing"), { name: "AuthSessionMissingError" });
    render(<AdminPage />);

    expect(await screen.findByRole("heading", { name: "Admin Login" })).toBeInTheDocument();
    expect(screen.queryByText("Could not verify the current Supabase session. Please try signing in again.")).not.toBeInTheDocument();
  });

  it("keeps genuine Supabase session errors visible", async () => {
    mocks.getUserError = new Error("Network request failed");
    render(<AdminPage />);

    expect(await screen.findByText("Could not verify the current Supabase session. Please try signing in again.")).toBeInTheDocument();
  });

  it("rejects invalid credentials without starting a Supabase session", async () => {
    mocks.adminLogin.mockRejectedValue(new Error("Invalid admin credentials."));
    render(<AdminPage />);

    await submitLogin();

    expect(await screen.findByText("Invalid admin credentials.")).toBeInTheDocument();
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Canteen applications" })).not.toBeInTheDocument();
  });

  it("opens the existing dashboard after server verification and Supabase sign-in", async () => {
    mocks.adminLogin.mockResolvedValue({ ok: true });
    mocks.signInWithPassword.mockImplementation(async () => {
      mocks.signedIn = true;
      return { error: null };
    });
    render(<AdminPage />);

    await submitLogin();

    expect(await screen.findByRole("heading", { name: "Canteen applications" })).toBeInTheDocument();
    expect(mocks.adminLogin).toHaveBeenCalledWith({
      data: { email: "test-admin@example.invalid", password: "test-only-password" },
    });
    await waitFor(() => expect(mocks.signInWithPassword).toHaveBeenCalledTimes(1));
  });
});
