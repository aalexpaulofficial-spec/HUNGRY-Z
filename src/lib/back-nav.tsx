import { useLocation, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Global Back navigation.
 * - Screens inside a page (sheets, tabs, checkout) register a back step with useBackStep;
 *   the newest active step runs first.
 * - Otherwise the button goes to the previous page in history (or home).
 * - Typed form values are saved per page in sessionStorage and restored on return.
 */
type Step = { id: number; fn: () => void };
type Ctx = { enabled: boolean; push: (s: Step) => void; remove: (id: number) => void; stack: React.MutableRefObject<Step[]>; inline: number; setInline: React.Dispatch<React.SetStateAction<number>> };
const BackCtx = createContext<Ctx | null>(null);
let nextId = 1;

export function BackProvider({ children, disabled = false }: { children: ReactNode; disabled?: boolean }) {
  const stack = useRef<Step[]>([]);
  const [inline, setInline] = useState(0);
  const value = {
    enabled: !disabled,
    stack,
    inline,
    setInline,
    push: (s: Step) => { stack.current = [...stack.current.filter((x) => x.id !== s.id), s]; },
    remove: (id: number) => { stack.current = stack.current.filter((x) => x.id !== id); },
  };
  return <BackCtx.Provider value={value}>{children}<FormDraftKeeper /></BackCtx.Provider>;
}

export function useBackStep(active: boolean, onBack: () => void) {
  const ctx = useContext(BackCtx);
  const fnRef = useRef(onBack);
  fnRef.current = onBack;
  const idRef = useRef(0);
  if (!idRef.current) idRef.current = nextId++;
  useEffect(() => {
    if (!ctx || !ctx.enabled || !active) return;
    const id = idRef.current;
    ctx.push({ id, fn: () => fnRef.current() });
    return () => ctx.remove(id);
  }, [ctx, active]);
}

export function useBackNavigationEnabled() {
  return useContext(BackCtx)?.enabled ?? true;
}

export function getBackFallbackPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length <= 1) return "/";
  return `/${segments.slice(0, -1).join("/")}`;
}

type BackRouter = ReturnType<typeof useRouter>;

function hasPreviousAppPage(router: BackRouter) {
  const stateIndex = router.stores.location.get().state.__TSR_index;
  if (typeof stateIndex === "number" && stateIndex > 0) return true;

  // A normal same-origin <a> navigation starts a new document and resets TanStack's
  // index. Trust the browser entry only when its referrer proves it came from HUNGRY.
  if (typeof window === "undefined" || window.history.length <= 1 || !document.referrer) return false;
  try {
    return new URL(document.referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}

export async function getAuthenticatedDashboardPath(): Promise<string | null> {
  try {
    const { data: { user: verifiedUser }, error: authError } = await supabase.auth.getUser();
    // A direct legal-page visit can happen while auth verification is briefly offline.
    // The local Supabase session still tells us which dashboard is the safe destination.
    const { data: { session } } = authError
      ? await supabase.auth.getSession()
      : { data: { session: null } };
    const user = verifiedUser ?? session?.user ?? null;
    if (!user) return null;

    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!roleError && isAdmin) return "/admin";

    const { data: canteen, error: canteenError } = await supabase
      .from("canteens")
      .select("id")
      .eq("owner_user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!canteenError && canteen) return "/canteen";

    // A signed-in account without an owner/admin record uses the student app.
    return "/app";
  } catch {
    return null;
  }
}

export async function getSafeBackFallbackPath(pathname: string) {
  if (pathname === "/privacy" || pathname === "/terms") {
    return (await getAuthenticatedDashboardPath()) ?? "/";
  }
  return getBackFallbackPath(pathname);
}

export async function navigateBack(
  router: BackRouter,
  pathname: string,
  steps: Step[],
) {
  const top = steps[steps.length - 1];
  if (top) {
    top.fn();
    return;
  }

  if (hasPreviousAppPage(router)) {
    router.history.back();
    return;
  }

  const fallback = await getSafeBackFallbackPath(pathname);
  await router.navigate({ to: fallback as never, replace: true });
}

/**
 * `inline` renders the arrow inside a page header (next to the logo);
 * while an inline arrow is mounted the floating corner arrow hides, so there is never a duplicate or overlap.
 */
export function BackButton({ inline = false }: { inline?: boolean }) {
  const ctx = useContext(BackCtx);
  const router = useRouter();
  const { pathname } = useLocation();
  const setInline = ctx?.setInline;
  const enabled = ctx?.enabled ?? true;
  useEffect(() => {
    if (!inline || !setInline || !enabled) return;
    setInline((n) => n + 1);
    return () => setInline((n) => n - 1);
  }, [inline, setInline, enabled]);
  if (ctx?.enabled === false || pathname === "/") return null;
  if (!inline && (ctx?.inline ?? 0) > 0) return null;
  const goBack = () => { void navigateBack(router, pathname, ctx?.stack.current ?? []); };
  return (
    <button type="button" onClick={goBack} aria-label="Go back" className={inline ? "back-btn back-btn-inline" : "back-btn back-btn-float"}>
      <ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
    </button>
  );
}

const DRAFT_KEY = "hungry-form-drafts";
type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
const SKIP = new Set(["password", "file", "hidden", "submit", "button", "checkbox", "radio"]);

function fieldKey(el: Field) {
  const name = el.getAttribute("name") || el.id || el.getAttribute("placeholder") || el.getAttribute("aria-label");
  return name ? `${window.location.pathname}${window.location.search}::${name}` : null;
}
function readDrafts(): Record<string, string> {
  try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "{}"); } catch { return {}; }
}

function FormDraftKeeper() {
  const { pathname, searchStr } = useLocation();
  useEffect(() => {
    const onInput = (e: Event) => {
      const el = e.target as Field;
      if (!el || !("value" in el) || SKIP.has((el as HTMLInputElement).type)) return;
      const k = fieldKey(el);
      if (!k) return;
      const d = readDrafts();
      d[k] = el.value;
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    };
    document.addEventListener("input", onInput, true);
    document.addEventListener("change", onInput, true);
    return () => { document.removeEventListener("input", onInput, true); document.removeEventListener("change", onInput, true); };
  }, []);
  // Restore saved values on the page we land on (also covers late-rendered fields).
  useEffect(() => {
    const restore = () => {
      const d = readDrafts();
      document.querySelectorAll<Field>("input, textarea, select").forEach((el) => {
        if (SKIP.has((el as HTMLInputElement).type) || el.value || el.dataset["draftRestored"]) return;
        const k = fieldKey(el);
        if (!k || d[k] == null || d[k] === "") return;
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, d[k]);
        el.dataset["draftRestored"] = "1";
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
    };
    restore();
    const obs = new MutationObserver(restore);
    obs.observe(document.body, { childList: true, subtree: true });
    const t = setTimeout(() => obs.disconnect(), 5000);
    return () => { obs.disconnect(); clearTimeout(t); };
  }, [pathname, searchStr]);
  // Drafts are cleared after a successful submit so finished forms don't refill.
  useEffect(() => {
    const onSubmit = () => setTimeout(() => {
      const d = readDrafts();
      const prefix = `${window.location.pathname}${window.location.search}::`;
      Object.keys(d).forEach((k) => k.startsWith(prefix) && delete d[k]);
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    }, 1500);
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, []);
  return null;
}
