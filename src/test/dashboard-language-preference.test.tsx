import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ resolveRead: null as ((value: unknown) => void) | null, upsert: vi.fn(async () => ({ error: null })) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select() { return this; },
      eq() { return this; },
      maybeSingle: () => new Promise((resolve) => { state.resolveRead = resolve; }),
      upsert: state.upsert,
    }),
  },
}));

import { useDashboardLanguage } from "@/lib/dashboard-language";

function PreferenceHarness() {
  const { language, ready, saveLanguage } = useDashboardLanguage("faculty-1");
  return <div><output>{language}</output><output>{ready ? "ready" : "loading"}</output><button onClick={() => void saveLanguage("hi")}>Choose Hindi</button></div>;
}

beforeEach(() => { localStorage.clear(); state.resolveRead = null; vi.clearAllMocks(); });
afterEach(cleanup);

describe("dashboard language preference", () => {
  it("keeps an immediate language choice when the older preference read completes later", async () => {
    render(<PreferenceHarness />);
    await waitFor(() => expect(state.resolveRead).toBeTypeOf("function"));

    fireEvent.click(screen.getByRole("button", { name: "Choose Hindi" }));
    expect(screen.getByText("hi")).toBeInTheDocument();
    expect(localStorage.getItem("hungry:language")).toBe("hi");
    state.resolveRead?.({ data: { language: "en" }, error: null });

    await waitFor(() => expect(screen.getByText("ready")).toBeInTheDocument());
    expect(screen.getByText("hi")).toBeInTheDocument();
    await waitFor(() => expect(state.upsert).toHaveBeenCalledWith(
      { user_id: "faculty-1", language: "hi", updated_at: expect.any(String) },
      { onConflict: "user_id" },
    ));
  });
});
