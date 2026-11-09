import { createFileRoute, Link } from "@tanstack/react-router";
import { BackButton, useBackNavigationEnabled, useBackStep } from "@/lib/back-nav";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { flushSync } from "react-dom";
import { z } from "zod";
import { LogOut, Plus, Trash2, Pencil, Printer, Settings, Search, Minus, Pause, Play, ShoppingBag, X, Receipt, UtensilsCrossed, LayoutDashboard, CalendarDays, Image as ImageIcon, ChartNoAxesCombined, CircleHelp, Store, ArrowUpRight, Clock3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CanteenTemplatePreview } from "@/components/foodexa/CanteenTemplatePreview";
import { CanteenTemplateBanner } from "@/components/foodexa/CanteenTemplateBanner";
import { OrderStatusBadge, orderStatusBorderClass } from "@/components/foodexa/OrderStatusBadge";
import { DEFAULT_BANNER_CROP, normalizeBannerCrop } from "@/lib/banner-crop";
import { createCanteenMenuImageUpload, getCanteenOwnerAccess, ownerRecordConfirmedBillPrint, ownerUpdateOrderStatus, saveCanteenAvailability } from "@/lib/hungry.functions";
import { ORDER_TYPE_LABELS, orderPaymentMethodLabel, orderPaymentStatusLabel, type OrderType } from "@/lib/order-rules";
import { ORDER_LABELS, type MenuItem } from "@/lib/access";
import { foodImage } from "@/lib/foodexa-images";
import { cn } from "@/lib/utils";
import { backendConfigured } from "@/lib/backend-config";
import { SetupNotice } from "@/components/SetupNotice";
import { CanteenOwnerLoginForm } from "@/components/foodexa/CanteenOwnerLoginForm";
import { LanguageSelect, localizeDashboard, useDashboardLanguage } from "@/lib/dashboard-language";
import { isStandaloneApp } from "@/lib/pwa-install";
import { HeroInstallButton } from "@/components/foodexa/HeroInstallButton";
import { CanteenAnalytics } from "@/components/foodexa/CanteenAnalytics";
import { OfflinePOSAnalytics } from "@/components/foodexa/OfflinePOSAnalytics";
import { EventCapacityPanel } from "@/components/foodexa/EventCapacityPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FeedbackDialog } from "@/components/foodexa/FeedbackDialog";
import { LegalDialog } from "@/components/foodexa/LegalDialog";
import { useSessionState } from "@/lib/session-state";
import { privacyPolicy, termsConditions } from "@/content/legal";
import { CanteenAvailabilityPanel, type AvailabilitySettings } from "@/components/foodexa/CanteenAvailabilityPanel";

export const Route = createFileRoute("/canteen")({
  ssr: false,
  validateSearch: z.object({ code: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "HUNGRY Z Canteen Dashboard" },
      { name: "description", content: "Manage your HUNGRY Z canteen menu and live orders." },
      { property: "og:title", content: "HUNGRY Z Canteen Dashboard" },
      { property: "og:description", content: "Manage your canteen menu and orders on HUNGRY Z." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "manifest", href: "/manifest-canteen.webmanifest" },
      { rel: "icon", href: "/icons/canteen-192.png", type: "image/png", sizes: "192x192" },
    ],
  }),
  component: CanteenPage,
});

const field =
  "w-full rounded-2xl border border-input bg-ink-soft px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition focus:border-primary";

type Canteen = { id: string; code: string; name: string; university_name: string; visibility: string; is_active: boolean; availability_mode: "schedule" | "open" | "closed"; operating_hours: AvailabilitySettings["operating_hours"]; timezone: string };

function CanteenPage() {
  const ownerAccess = useServerFn(getCanteenOwnerAccess);
  const siteNavigationEnabled = useBackNavigationEnabled();
  const [state, setState] = useState<"loading" | "auth" | "ok" | "pending" | "rejected" | "missing" | "error">("loading");
  const [canteen, setCanteen] = useState<Canteen | null>(null);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const { language, saveLanguage } = useDashboardLanguage(ownerUserId);
  const [err, setErr] = useState("");

  const resolve = useCallback(async () => {
    setErr("");
    setState("loading");
    try {
      const { data, error: authError } = await supabase.auth.getSession();
      if (authError) throw new Error("Could not read your owner session. Please sign in again.");
      const sessionUser = data.session?.user;
      if (!sessionUser) {
        setOwnerUserId(null);
        setCanteen(null);
        setState("auth");
        return;
      }
      setOwnerUserId(sessionUser.id);
      const cachedOwner = (() => {
        try { return JSON.parse(localStorage.getItem(`hungry:offline-canteen:${sessionUser.id}`) ?? "null") as { ownerUserId: string; canteen: Canteen } | null; }
        catch { return null; }
      })();
      if (!navigator.onLine && cachedOwner?.ownerUserId === sessionUser.id && cachedOwner.canteen?.id) {
        setCanteen(cachedOwner.canteen);
        setState("ok");
        return;
      }
      const access = await ownerAccess({ data: {} });
      if (access.status !== "approved") {
        setCanteen(null);
        setState(access.status);
        return;
      }
      const q = supabase
        .from("canteens")
        .select("id, code, name, university_name, visibility, is_active, availability_mode, operating_hours, timezone")
        .eq("owner_user_id", sessionUser.id);
      const { data: rows, error } = await q.limit(1);
      if (error) throw new Error("Could not load your canteen. Please try again.");
      const c = (rows?.[0] as Canteen | undefined) ?? null;
      setCanteen(c);
      if (c) localStorage.setItem(`hungry:offline-canteen:${sessionUser.id}`, JSON.stringify({ ownerUserId: sessionUser.id, canteen: c }));
      setState(c ? "ok" : "missing");
    } catch (e) {
      try {
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;
        const cached = user ? JSON.parse(localStorage.getItem(`hungry:offline-canteen:${user.id}`) ?? "null") as { ownerUserId: string; canteen: Canteen } | null : null;
        if (user && cached?.ownerUserId === user.id && cached.canteen?.id && (!navigator.onLine || e instanceof TypeError)) {
          setOwnerUserId(user.id);
          setCanteen(cached.canteen);
          setState("ok");
          return;
        }
      } catch { /* No usable local session/snapshot; show the actual access error. */ }
      setErr(e instanceof Error ? e.message : "Could not verify your canteen access. Please try again.");
      setState("error");
    }
  }, [ownerAccess]);

  useEffect(() => localizeDashboard(document.body, language), [language]);

  useEffect(() => {
    if (backendConfigured) resolve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setCanteen(null);
    setOwnerUserId(null);
    setState("auth");
  }

  if (!backendConfigured) return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto mb-6 flex justify-center"><HeroInstallButton app="canteen" /></div>
      <SetupNotice title="Canteen dashboard isn't connected yet" />
    </div>
  );
  if (state === "loading") return (
    <div className="grid min-h-screen place-content-center justify-items-center gap-5 bg-background px-4 text-sm text-muted-foreground">
      <div role="status">Loading…</div>
      <HeroInstallButton app="canteen" />
    </div>
  );
  if (state === "ok" && canteen) return <Dashboard canteen={canteen} onSignOut={signOut} language={language} onLanguageChange={saveLanguage} />;

  return (
    <div className="hz-canteen-login grain relative min-h-screen overflow-hidden bg-background px-4 py-10">
      <div className="ember anim-pulse-glow pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2" />
      <div className="relative mx-auto w-full max-w-md">
        {siteNavigationEnabled ? (
          <Link to="/" className="mb-8 flex items-center justify-center gap-2 display text-[15px] tracking-[0.3em]" aria-label="HUNGRY Z home"><img src="/HUNGRY%20Z%20CANTEEN%20DAHSBOARD%20LOGO.png" alt="" className="h-10 w-10 rounded-full object-contain" />HUNGRY Z</Link>
        ) : (
          <span className="mb-8 flex items-center justify-center gap-2 display text-[15px] tracking-[0.3em]" aria-label="HUNGRY Z"><img src="/HUNGRY%20Z%20CANTEEN%20DAHSBOARD%20LOGO.png" alt="" className="h-10 w-10 rounded-full object-contain" />HUNGRY Z</span>
        )}
        {state !== "ok" && state !== "error" && <div className="mb-5 flex justify-center"><HeroInstallButton app="canteen" /></div>}
        <div className="glass-red anim-rise rounded-[2rem] p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary-bright">Canteen Dashboard</p>
          {state === "auth" ? (
            <div className="mt-4 space-y-4">
              <h1 className="display text-2xl">Canteen Owner Login</h1>
              <CanteenOwnerLoginForm initialError={err} onRegister={() => {
                window.location.href = isStandaloneApp() ? "/register-canteen?hungry_app=canteen" : "/register-canteen";
              }} />
            </div>
          ) : state === "pending" || state === "rejected" || state === "missing" ? (
            <div className="mt-4 space-y-4">
              <h1 className="display text-2xl">
                {state === "pending" ? "Application under review" : state === "rejected" ? "Application rejected" : "Application not found"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {state === "pending"
                  ? "Your canteen application is under review. We'll email you when it has been reviewed."
                  : state === "rejected"
                    ? "Your canteen application was rejected. No rejection reason is available here; contact HUNGRY Z support for details."
                    : "No approved canteen is linked to this account. Sign in with your 7-character Canteen Owner ID and Owner Password Code."}
              </p>
              {state === "missing" && <a href="/register-canteen" className="block text-xs font-semibold text-primary-bright underline">Register your canteen</a>}
              <button type="button" onClick={signOut} className="w-full rounded-full border border-border py-3 text-sm text-muted-foreground hover:text-foreground">Use another account</button>
            </div>
          ) : state === "error" ? (
            <div className="mt-4 space-y-4">
              <h1 className="display text-2xl">Could not load your dashboard</h1>
              <p role="alert" className="text-sm text-primary-bright">{err}</p>
              <div className="pt-1"><HeroInstallButton app="canteen" /></div>
              <button type="button" onClick={() => void resolve()} className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground">Try again</button>
              <button type="button" onClick={signOut} className="w-full rounded-full border border-border py-3 text-sm text-muted-foreground hover:text-foreground">Sign out</button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type Order = { id: string; order_number: string; customer_name: string; lines: { name: string; qty: number; price: number }[]; subtotal: number; total: number; discount: number; pickup_code: string; counter: string; status: string; created_at: string; order_type: string; payment_method: string; payment_status: string; bill_print_confirmed_at: string | null; completion_workflow: string | null; food_received_confirmed_at: string | null };
type ReceiptPaperWidth = "auto" | "58" | "80";
type POSLine = Pick<MenuItem, "id" | "name" | "price" | "image" | "category" | "stock"> & { qty: number };
type OfflinePaymentMethod = "cash" | "upi" | "card";
type OfflineSale = { id: string; createdAt: string; lines: POSLine[]; subtotal: number; total: number; paymentMethod: OfflinePaymentMethod; paymentStatus: "paid" | "unpaid"; syncStatus?: "pending" | "synced" };
type HeldPOSOrder = { id: string; createdAt: string; lines: POSLine[]; paymentMethod?: OfflinePaymentMethod; paymentStatus?: "paid" | "unpaid" };
type OfflinePOSState = { current: POSLine[]; held: HeldPOSOrder[]; completed: OfflineSale[]; paymentMethod: OfflinePaymentMethod; paymentStatus: "paid" | "unpaid" };
type ReceiptPrintJob = { kind: "order"; order: Order } | { kind: "test"; counterName: string; createdAt: string } | { kind: "offline"; counterName: string; createdAt: string; orderNumber: string; transactionId: string; lines: { name: string; qty: number; price: number }[]; saleLines: POSLine[]; subtotal: number; total: number; paymentMethod: OfflinePaymentMethod; paymentStatus: "paid" | "unpaid" };
const printerPreferenceKey = (canteenId: string) => `hungry:printer-preferences:${canteenId}`;
const offlinePOSStorageKey = (canteenId: string) => `hungry:offline-pos:${canteenId}`;
const offlineMenuStorageKey = (canteenId: string) => `hungry:offline-menu:${canteenId}`;
function readOfflineMenu(canteenId: string): MenuItem[] {
  try {
    const value = JSON.parse(localStorage.getItem(offlineMenuStorageKey(canteenId)) ?? "[]");
    return Array.isArray(value) ? value.filter((item) => item && typeof item.id === "string" && typeof item.name === "string" && Number.isInteger(item.price)) as MenuItem[] : [];
  } catch { return []; }
}
function readOfflinePOS(canteenId: string): OfflinePOSState {
  try {
    const saved = JSON.parse(localStorage.getItem(offlinePOSStorageKey(canteenId)) ?? "null") as Partial<OfflinePOSState> | null;
    const validLine = (line: POSLine) => typeof line.id === "string" && typeof line.name === "string" && Number.isInteger(line.price) && line.price >= 0 && Number.isInteger(line.qty) && line.qty > 0;
    const paymentMethod = saved?.paymentMethod === "upi" || saved?.paymentMethod === "card" ? saved.paymentMethod : "cash";
    return {
      current: Array.isArray(saved?.current) ? saved.current.filter(validLine) : [],
      held: Array.isArray(saved?.held) ? saved.held.filter((order) => typeof order.id === "string" && Array.isArray(order.lines) && order.lines.length > 0 && order.lines.every(validLine)) : [],
      completed: Array.isArray(saved?.completed) ? saved.completed.filter((sale) => typeof sale.id === "string" && typeof sale.createdAt === "string" && Array.isArray(sale.lines) && sale.lines.every(validLine) && Number.isFinite(sale.total) && (sale.paymentMethod === "cash" || sale.paymentMethod === "upi" || sale.paymentMethod === "card") && (sale.paymentStatus === "paid" || sale.paymentStatus === "unpaid")) : [],
      paymentMethod,
      paymentStatus: saved?.paymentStatus === "paid" ? "paid" : "unpaid",
    };
  } catch {
    return { current: [], held: [], completed: [], paymentMethod: "cash", paymentStatus: "unpaid" };
  }
}
function readPrinterPaperWidth(canteenId: string): ReceiptPaperWidth {
  try {
    const saved = localStorage.getItem(printerPreferenceKey(canteenId));
    const width = saved ? (JSON.parse(saved) as { paperWidth?: string }).paperWidth : null;
    return width === "58" || width === "80" ? width : "auto";
  } catch {
    return "80";
  }
}

function ThermalReceipt({ job, paperWidth }: { job: ReceiptPrintJob; paperWidth: ReceiptPaperWidth }) {
  const isTest = job.kind === "test";
  const createdAt = job.kind === "order" ? job.order.created_at : job.createdAt;
  const counterName = job.kind === "order" ? job.order.counter : job.counterName;
  const lines = job.kind === "order" ? job.order.lines : job.kind === "offline" ? job.lines : [{ name: "Printer test item", qty: 1, price: 0 }];
  const collectionCode = job.kind === "order" ? job.order.pickup_code : "1234";

  return (
    <section id="hungry-thermal-print" className={`hungry-print-only hungry-receipt-paper-${paperWidth}`} aria-label="HUNGRY Z receipt">
      <header className="hungry-receipt-header">
        <img src="/HUNGRY%20Z%20Q%20LOGO.png" alt="HUNGRY Z official logo" width="160" height="160" decoding="sync" loading="eager" fetchPriority="high" />
        <h1>HUNGRY Z</h1>
        <p>NO QUEUES. SAVE FOOD.</p>
        <p>SMART CAMPUS FOOD ORDERING</p>
      </header>
      {isTest && <p className="hungry-receipt-test-label">TEST RECEIPT — NOT A REAL ORDER</p>}
      <div className="hungry-receipt-meta">
        <p><span>Order ID</span><strong>{job.kind === "test" ? "TEST-0001" : job.kind === "offline" ? job.orderNumber : job.order.order_number}</strong></p>
        <p><span>Order Time</span><strong>{new Date(createdAt).toLocaleString()}</strong></p>
        <p><span>Counter Name</span><strong>{counterName || "Counter 1"}</strong></p>
        <p><span>Order Type</span><strong>{job.kind === "test" ? "Dine In" : job.kind === "offline" ? "Offline counter bill" : ORDER_TYPE_LABELS[job.order.order_type as OrderType] ?? "Dine In"}</strong></p>
        <p><span>Payment Method</span><strong>{job.kind === "test" ? "Pay at Counter" : job.kind === "offline" ? job.paymentMethod.toUpperCase() : orderPaymentMethodLabel(job.order.payment_method)}</strong></p>
        <p><span>Payment Status</span><strong>{job.kind === "test" ? "Pending" : job.kind === "offline" ? job.paymentStatus.toUpperCase() : orderPaymentStatusLabel(job.order.payment_status)}</strong></p>
      </div>
      <div className="hungry-receipt-items">
        <h2>FOOD ITEMS</h2>
        {lines.map((line, index) => (
          <div className="hungry-receipt-item" key={`${line.name}-${index}`}>
            <strong className="hungry-receipt-item-name">{line.name}</strong>
            <strong className="hungry-receipt-quantity">x {line.qty}<span>Rs {line.price * line.qty}</span></strong>
          </div>
        ))}
        {job.kind !== "test" && <div className="hungry-receipt-totals"><p><span>Subtotal</span><strong>Rs {job.kind === "offline" ? job.subtotal : job.order.subtotal}</strong></p>{job.kind === "order" && job.order.discount > 0 && <p><span>Discount</span><strong>- Rs {job.order.discount}</strong></p>}<p className="hungry-receipt-total"><span>Total</span><strong>Rs {job.kind === "offline" ? job.total : job.order.total}</strong></p></div>}
      </div>
      <footer className="hungry-receipt-code-wrap">
        {job.kind === "offline" ? <><p>THANK YOU · HUNGRY Z</p><p className="mt-1">Offline counter bill</p></> : <><p>{isTest ? "SAMPLE COLLECTION CODE" : "CUSTOMER COLLECTION CODE"}</p><strong className="hungry-receipt-code">{collectionCode}</strong></>}
      </footer>
    </section>
  );
}

function OfflinePOSTab({
  canteenName, menu, current, held, pendingSyncCount, search, category, message, printing, paymentMethod, paymentStatus,
  onSearch, onCategory, onAdd, onQuantity, onHold, onResume, onClear, onPrint, onPaymentMethod, onPaymentStatus,
}: {
  canteenName: string; menu: MenuItem[]; current: POSLine[]; held: HeldPOSOrder[]; pendingSyncCount: number; search: string; category: string; message: string; printing: boolean; paymentMethod: OfflinePaymentMethod; paymentStatus: "paid" | "unpaid";
  onSearch: (value: string) => void; onCategory: (value: string) => void; onAdd: (item: MenuItem) => void; onQuantity: (id: string, delta: number) => void;
  onHold: () => void; onResume: (order: HeldPOSOrder) => void; onClear: () => void; onPrint: () => void; onPaymentMethod: (value: OfflinePaymentMethod) => void; onPaymentStatus: (value: "paid" | "unpaid") => void;
}) {
  // Online stock/availability controls online ordering only. Counter staff can bill any saved menu item.
  const [searchMode, setSearchMode] = useState<"physical" | "onscreen">("physical");
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const searchAreaRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const items = menu;
  const categories = ["All", ...Array.from(new Set(items.map((item) => item.category)))];
  const filtered = items.filter((item) =>
    (category === "All" || item.category === category) &&
    `${item.name} ${item.category} ${item.description}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  const itemCount = current.reduce((sum, line) => sum + line.qty, 0);
  const subtotal = current.reduce((sum, line) => sum + line.price * line.qty, 0);

  useEffect(() => {
    if (searchMode !== "onscreen" || !isKeyboardOpen) return;
    const closeIfOutside = (event: PointerEvent | FocusEvent) => {
      if (!searchAreaRef.current?.contains(event.target as Node)) setIsKeyboardOpen(false);
    };
    const closeIfSearchScrolledAway = () => {
      const bounds = searchInputRef.current?.getBoundingClientRect();
      if (!bounds || bounds.bottom <= 0 || bounds.top >= window.innerHeight) setIsKeyboardOpen(false);
    };
    document.addEventListener("pointerdown", closeIfOutside);
    document.addEventListener("focusin", closeIfOutside);
    window.addEventListener("scroll", closeIfSearchScrolledAway, true);
    return () => {
      document.removeEventListener("pointerdown", closeIfOutside);
      document.removeEventListener("focusin", closeIfOutside);
      window.removeEventListener("scroll", closeIfSearchScrolledAway, true);
    };
  }, [isKeyboardOpen, searchMode]);

  return (
    <section className="hz-pos mt-5" aria-labelledby="offline-pos-title">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Counter billing · {canteenName}</p><h2 id="offline-pos-title" className="display mt-2 text-2xl sm:text-3xl">Offline POS</h2><p className="mt-2 text-xs text-muted-foreground">Quick sale using your published canteen menu and current prices.</p></div>
        <div className="rounded-2xl border border-border bg-card px-4 py-2 text-right"><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Items in bill</p><p className="text-xl font-black tabular-nums">{itemCount}</p></div>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(19rem,.9fr)]">
        <div className="min-w-0 rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-device)] sm:p-5">
          <div ref={searchAreaRef}>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="POS keyboard input mode">
            <button type="button" aria-pressed={searchMode === "physical"} onClick={() => { setSearchMode("physical"); setIsKeyboardOpen(false); }} className={cn("min-h-12 rounded-xl border px-2 text-[10px] font-black tracking-wide transition sm:px-3 sm:text-xs", searchMode === "physical" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40")}>PHYSICAL KEYBOARD</button>
            <button type="button" aria-pressed={searchMode === "onscreen"} onClick={() => setSearchMode("onscreen")} className={cn("min-h-12 rounded-xl border px-2 text-[10px] font-black tracking-wide transition sm:px-3 sm:text-xs", searchMode === "onscreen" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40")}>ON-SCREEN KEYBOARD</button>
          </div>
          <label className="relative mt-3 block">
            <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input ref={searchInputRef} aria-label="Search POS menu" type="search" inputMode={searchMode === "onscreen" ? "none" : "search"} readOnly={searchMode === "onscreen"} onFocus={() => { if (searchMode === "onscreen") setIsKeyboardOpen(true); }} value={search} onChange={(event) => onSearch(event.currentTarget.value)} placeholder="Search dishes by name or category" className="hz-pos-search w-full rounded-2xl border border-input bg-ink-soft py-3 pl-11 pr-12 text-sm text-foreground outline-none focus:border-primary" />
            {search && <button type="button" aria-label="Clear search" onClick={() => onSearch("")} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>}
          </label>
          {searchMode === "onscreen" && isKeyboardOpen && <div role="group" className="mt-3 rounded-2xl border border-border bg-ink-soft p-2.5 sm:p-3" aria-label="On-screen search keyboard">
            <div className="grid gap-1.5 sm:gap-2">
              {["1234567890", "QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"].map((row, rowIndex) => <div key={rowIndex} className="grid grid-cols-5 gap-1.5 sm:grid-cols-10 sm:gap-2">
                {[...row].map((key) => <button key={key} type="button" onClick={() => onSearch(`${search}${key}`)} className="min-h-12 touch-manipulation select-none rounded-xl border border-border bg-card text-sm font-bold text-foreground shadow-sm transition active:scale-95 active:border-primary active:bg-primary/10 sm:min-h-14 sm:text-base">{key}</button>)}
                {rowIndex === 3 && <button type="button" aria-label="Backspace" onClick={() => onSearch(Array.from(search).slice(0, -1).join(""))} className="col-span-2 min-h-12 touch-manipulation rounded-xl border border-border bg-card px-3 text-sm font-black text-foreground shadow-sm active:scale-95 active:border-primary active:bg-primary/10 sm:col-span-3 sm:min-h-14">⌫ BACKSPACE</button>}
              </div>)}
              <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10 sm:gap-2">
                <button type="button" onClick={() => onSearch(`${search} `)} className="col-span-3 min-h-12 touch-manipulation rounded-xl border border-border bg-card text-xs font-bold text-foreground shadow-sm active:scale-95 active:border-primary active:bg-primary/10 sm:col-span-7 sm:min-h-14">SPACE</button>
                <button type="button" onClick={() => onSearch("")} className="col-span-2 min-h-12 touch-manipulation rounded-xl border border-primary/40 bg-primary/10 text-xs font-black text-primary shadow-sm active:scale-95 sm:col-span-3 sm:min-h-14">CLEAR</button>
              </div>
            </div>
          </div>}
          </div>
          <div className="hz-pos-categories mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Food categories">
            {categories.map((name) => <button key={name} type="button" onClick={() => { setIsKeyboardOpen(false); onCategory(name); }} aria-pressed={category === name} className={cn("min-h-10 shrink-0 rounded-full border px-4 text-xs font-bold transition", category === name ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground")}>{name}</button>)}
          </div>
          {filtered.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filtered.map((item) => <button key={item.id} type="button" onClick={() => { setIsKeyboardOpen(false); onAdd(item); }} aria-label={`Add ${item.name}, ₹${item.price}`} className="hz-pos-item flex min-h-32 touch-manipulation flex-col justify-between rounded-2xl border border-border bg-background p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-lg active:scale-[.98] sm:p-5">
              <span data-no-translate className="line-clamp-2 block text-sm font-bold leading-snug">{item.name}</span>
              <span className="mt-3 block text-base font-black text-primary">₹{item.price}</span>
            </button>)}
          </div> : <div className="mt-5 rounded-2xl border border-dashed border-border px-5 py-12 text-center"><UtensilsCrossed className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 text-sm font-bold">{items.length ? "No matching dishes" : "No available menu items"}</p><p className="mt-1 text-xs text-muted-foreground">{items.length ? "Try another search or category." : "Add and publish items from the Menu section to use Offline POS."}</p></div>}
        </div>

        <aside className="hz-pos-bill rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-device)] sm:p-5" aria-label="Current counter bill">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Current bill</p><h3 className="display mt-1 text-xl">Selected items</h3></div><Receipt className="mt-1 h-5 w-5 text-primary" /></div>
          <div className="mt-4 space-y-2 pr-1">
            {current.map((line) => <div key={line.id} className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3">
              <div className="min-w-0 flex-1"><p data-no-translate className="truncate text-xs font-bold">{line.name}</p><p className="mt-1 text-[11px] text-muted-foreground">₹{line.price} × {line.qty} <span className="font-bold text-foreground">= ₹{line.price * line.qty}</span></p></div>
              <div className="flex shrink-0 items-center gap-1"><button type="button" aria-label={`Decrease ${line.name}`} onClick={() => onQuantity(line.id, -1)} className="grid h-9 w-9 place-items-center rounded-xl border border-border hover:border-primary/50"><Minus className="h-3.5 w-3.5" /></button><span className="w-6 text-center text-xs font-black tabular-nums">{line.qty}</span><button type="button" aria-label={`Increase ${line.name}`} onClick={() => onQuantity(line.id, 1)} className="grid h-9 w-9 place-items-center rounded-xl border border-border hover:border-primary/50"><Plus className="h-3.5 w-3.5" /></button></div>
            </div>)}
            {!current.length && <div className="grid min-h-36 place-items-center rounded-2xl border border-dashed border-border px-4 text-center"><div><ShoppingBag className="mx-auto h-6 w-6 text-muted-foreground" /><p className="mt-2 text-xs font-semibold text-muted-foreground">Tap menu items to add them to this bill.</p></div></div>}
          </div>
          <div className="mt-4 space-y-2 border-t border-border pt-4"><div className="flex justify-between text-sm text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">₹{subtotal}</span></div><div className="flex items-baseline justify-between"><span className="text-xs font-bold uppercase tracking-wider">Total</span><strong className="text-2xl font-black tabular-nums">₹{subtotal}</strong></div></div>
          <div className="mt-4 grid gap-3 rounded-2xl bg-ink-soft p-3 sm:grid-cols-2">
            <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">OFFLINE payment method<select value={paymentMethod} onChange={(event) => onPaymentMethod(event.currentTarget.value as OfflinePaymentMethod)} className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm font-semibold normal-case tracking-normal text-foreground"><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option></select></label>
            <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">OFFLINE payment status<select value={paymentStatus} onChange={(event) => onPaymentStatus(event.currentTarget.value as "paid" | "unpaid")} className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm font-semibold normal-case tracking-normal text-foreground"><option value="unpaid">Unpaid</option><option value="paid">Paid</option></select></label>
          </div>
          {message && <p role="status" className="mt-3 rounded-xl border border-primary/25 bg-primary/10 p-3 text-xs text-foreground">{message}</p>}
          <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={onHold} disabled={!current.length} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-xs font-bold disabled:opacity-40"><Pause className="h-4 w-4" /> Hold order</button><button type="button" onClick={onClear} disabled={!current.length} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-xs font-bold text-muted-foreground hover:border-primary/40 hover:text-primary disabled:opacity-40"><Trash2 className="h-4 w-4" /> Clear order</button></div>
          <button type="button" onClick={onPrint} disabled={!current.length || printing} className="mt-2 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground shadow-[var(--shadow-cinema)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"><Printer className="h-4 w-4" /> {printing ? "Preparing bill…" : "Print Bill"}</button>
          <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">OFFLINE POS bills are saved on this device after print confirmation. Payment status is a manual counter record; it does not alter online orders or payment records.</p>
          {pendingSyncCount > 0 && <p role="status" className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-foreground">{pendingSyncCount} OFFLINE POS transaction{pendingSyncCount === 1 ? "" : "s"} waiting to sync to Supabase.</p>}
          <section className="mt-6 border-t border-border pt-5" aria-labelledby="held-orders-title">
            <div className="mb-4 flex items-center justify-between gap-3"><div><h4 id="held-orders-title" className="text-sm font-bold">Held orders</h4><p className="mt-1 text-xs text-muted-foreground">Saved bills stay on this device until resumed.</p></div><span className="grid h-9 min-w-9 place-items-center rounded-full bg-muted px-2 text-xs font-bold tabular-nums">{held.length}</span></div>
            {held.length ? <div className="space-y-3">{held.map((order) => {
              const heldTotal = order.lines.reduce((sum, line) => sum + line.qty * line.price, 0);
              return <article key={order.id} className="rounded-2xl border border-border bg-background p-4 sm:p-5">
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Order ID</p><p className="mt-1 break-all font-mono text-sm font-bold">{order.id}</p><time dateTime={order.createdAt} className="mt-1 block text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString()}</time></div>
                  <button type="button" onClick={() => onResume(order)} disabled={!!current.length} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-black tracking-wide text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"><Play className="h-4 w-4" /> RESUME</button>
                </header>
                <ul className="my-4 divide-y divide-border border-y border-border">
                  {order.lines.map((line) => <li key={line.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5 text-sm"><span className="min-w-0 break-words"><strong className="mr-2 tabular-nums">{line.qty} ×</strong>{line.name}</span><span className="shrink-0 tabular-nums text-muted-foreground">₹{line.qty * line.price}</span></li>)}
                </ul>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div><dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total</dt><dd className="mt-1 text-base font-black tabular-nums text-foreground">₹{heldTotal}</dd></div>
                  <div><dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Payment method</dt><dd className="mt-1 text-xs font-bold">{(order.paymentMethod ?? "cash").toUpperCase()}</dd></div>
                  <div><dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Payment status</dt><dd className="mt-1 text-xs font-bold">{(order.paymentStatus ?? "unpaid").toUpperCase()}</dd></div>
                  <div><dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Items</dt><dd className="mt-1 text-xs font-bold tabular-nums">{order.lines.reduce((sum, line) => sum + line.qty, 0)}</dd></div>
                </dl>
              </article>;
            })}</div> : <p className="text-[11px] text-muted-foreground">No held bills on this device.</p>}
          </section>
        </aside>
      </div>
    </section>
  );
}

type CanteenTemplate = { canteen_id: string; banner_image_url: string | null; heading: string; description: string; banner_crop_x: number; banner_crop_y: number; banner_crop_zoom: number; updated_at?: string };
function normalizeCanteenTemplate(value: Partial<CanteenTemplate> | null | undefined, canteenId: string): CanteenTemplate {
  const crop = normalizeBannerCrop({ x: value?.banner_crop_x, y: value?.banner_crop_y, zoom: value?.banner_crop_zoom });
  return {
    canteen_id: value?.canteen_id ?? canteenId,
    banner_image_url: value?.banner_image_url ?? null,
    heading: value?.heading ?? "",
    description: value?.description ?? "",
    banner_crop_x: crop.x,
    banner_crop_y: crop.y,
    banner_crop_zoom: crop.zoom,
    ...(value?.updated_at ? { updated_at: value.updated_at } : {}),
  };
}
const uid = () => Math.random().toString(36).slice(2);
const NEXT: Record<string, string | undefined> = { placed: "preparing", preparing: "ready", ready: "collected" };
const BANNER_IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };
export function Dashboard({ canteen, onSignOut, language, onLanguageChange }: { canteen: Canteen; onSignOut: () => void; language: "en" | "hi" | "kn"; onLanguageChange: (language: "en" | "hi" | "kn") => void }) {
  const [tab, setTab] = useSessionState<"overview" | "menu" | "orders" | "pos" | "template" | "analytics" | "events">(`hungry-canteen-dashboard-tab-v2-${canteen.id}`, "overview");
  const [pendingEventRequests, setPendingEventRequests] = useState(0);
  const [activeOrderCount, setActiveOrderCount] = useState(0);
  const [eventUpdateNotice, setEventUpdateNotice] = useState(false);
  const [menu, setMenu] = useState<MenuItem[]>(() => readOfflineMenu(canteen.id));
  const [orders, setOrders] = useState<Order[]>([]);
  const [todayOnlineSales, setTodayOnlineSales] = useState<{ created_at: string; total: number; status: string; payment_status: string }[] | null>(null);
  const [todayOnlineSalesError, setTodayOnlineSalesError] = useState(false);
  const [posState, setPOSState] = useState(() => readOfflinePOS(canteen.id));
  const offlineSyncLock = useRef(false);
  const [analyticsMode, setAnalyticsMode] = useSessionState<"online" | "offline">(`hungry-canteen-analytics-mode-${canteen.id}`, "online");
  const [posMessage, setPOSMessage] = useState("");
  const [posSearch, setPOSSearch] = useState("");
  const [posCategory, setPOSCategory] = useState("All");
  const [editing, setEditing] = useState<Partial<MenuItem> | null>(null);
  const [foodImageFile, setFoodImageFile] = useState<File | null>(null);
  const [foodImagePreview, setFoodImagePreview] = useState<string | null>(null);
  const [template, setTemplate] = useState<CanteenTemplate>({ canteen_id: canteen.id, banner_image_url: null, heading: "", description: "", banner_crop_x: 50, banner_crop_y: 50, banner_crop_zoom: 1 });
  const [templateHeading, setTemplateHeading] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateImage, setTemplateImage] = useState<File | null>(null);
  const [templatePreview, setTemplatePreview] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [bannerCrop, setBannerCrop] = useState(DEFAULT_BANNER_CROP);
  useBackStep(tab !== "overview", () => setTab("overview"));
  useBackStep(!!editing, () => setEditing(null));
  const [err, setErr] = useState("");
  const [orderMsg, setOrderMsg] = useState("");
  const [busyOrder, setBusyOrder] = useState<string | null>(null);
  const [printerSettingsOpen, setPrinterSettingsOpen] = useState(false);
  const [printerPaperWidth, setPrinterPaperWidth] = useState<ReceiptPaperWidth>(() => readPrinterPaperWidth(canteen.id));
  const [printerSettingsMsg, setPrinterSettingsMsg] = useState("");
  const [canteenCodeCopied, setCanteenCodeCopied] = useState(false);
  const [printJob, setPrintJob] = useState<ReceiptPrintJob | null>(null);
  const [printing, setPrinting] = useState(false);
  const printLock = useRef(false);
  const [ownerFeedbackOpen, setOwnerFeedbackOpen] = useState(false);
  const [ownerLegalPage, setOwnerLegalPage] = useState<"privacy" | "terms" | null>(null);
  const [availability, setAvailability] = useState(canteen);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const prepareMenuImageUpload = useServerFn(createCanteenMenuImageUpload);
  const move = useServerFn(ownerUpdateOrderStatus);
  const recordConfirmedPrint = useServerFn(ownerRecordConfirmedBillPrint);
  const saveAvailability = useServerFn(saveCanteenAvailability);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const todayOfflineBills = posState.completed.filter((sale) => new Date(sale.createdAt) >= todayStart && new Date(sale.createdAt) < tomorrowStart);
  const todayOfflineRevenue = todayOfflineBills.filter((sale) => sale.paymentStatus === "paid").reduce((sum, sale) => sum + sale.total, 0);
  const todayOnlineCollected = todayOnlineSales?.filter((order) => order.payment_status === "paid" && order.status !== "cancelled").reduce((sum, order) => sum + Number(order.total || 0), 0) ?? null;
  const onlineSalesBuckets = Array.from({ length: 8 }, (_, index) => {
    const hour = index * 3;
    const start = new Date(todayStart);
    start.setHours(hour);
    const end = new Date(start);
    end.setHours(hour + 3);
    const revenue = todayOnlineSales?.filter((order) => order.payment_status === "paid" && order.status !== "cancelled" && new Date(order.created_at) >= start && new Date(order.created_at) < end).reduce((sum, order) => sum + Number(order.total || 0), 0) ?? null;
    return { hour, start, revenue };
  });
  const maxOnlineSales = Math.max(1, ...onlineSalesBuckets.map(({ revenue }) => revenue ?? 0));
  const sidebarSections = [
    { key: "overview", label: "Dashboard", icon: LayoutDashboard },
    { key: "menu", label: `MENU (${menu.length})`, icon: UtensilsCrossed },
    { key: "orders", label: "ONLINE ORDERS", icon: ShoppingBag, count: activeOrderCount },
    { key: "pos", label: "OFFLINE POS", icon: Receipt },
    { key: "events", label: "FACULTY EVENTS", icon: CalendarDays, count: pendingEventRequests },
    { key: "template", label: "CHANGE TEMPLATE", icon: ImageIcon },
    { key: "analytics", label: "ANALYTICS", icon: ChartNoAxesCombined },
  ] as const;

  function selectSection(key: typeof sidebarSections[number]["key"]) {
    setTab(key);
    if (key === "orders") void refreshActiveOrderCount();
    if (key === "events") { setEventUpdateNotice(false); void refreshPendingEventRequests(); }
  }

  useEffect(() => {
    try { localStorage.setItem(offlinePOSStorageKey(canteen.id), JSON.stringify(posState)); }
    catch { setPOSMessage("This browser could not save the current or held counter orders locally."); }
  }, [canteen.id, posState]);

  useEffect(() => {
    if (menu.length) {
      try { localStorage.setItem(offlineMenuStorageKey(canteen.id), JSON.stringify(menu)); }
      catch { setPOSMessage("The menu could not be saved for offline POS on this device."); }
    }
  }, [canteen.id, menu]);

  useEffect(() => {
    const syncPending = async () => {
      if (!navigator.onLine || offlineSyncLock.current) return;
      const pending = posState.completed.filter((sale) => sale.syncStatus !== "synced");
      if (!pending.length) return;
      offlineSyncLock.current = true;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const ownerUserId = sessionData.session?.user.id;
        if (!ownerUserId) return;
        for (const sale of pending) {
          const { error } = await supabase.from("offline_pos_transactions").upsert({
            transaction_id: sale.id,
            canteen_id: canteen.id,
            owner_user_id: ownerUserId,
            client_created_at: sale.createdAt,
            lines: sale.lines.map(({ id, name, qty, price }) => ({ menu_item_id: id, name, qty, unit_price: price })),
            subtotal: sale.subtotal,
            total: sale.total,
            payment_method: sale.paymentMethod,
            payment_status: sale.paymentStatus,
          }, { onConflict: "transaction_id", ignoreDuplicates: true });
          if (error) break;
          setPOSState((current) => ({ ...current, completed: current.completed.map((row) => row.id === sale.id ? { ...row, syncStatus: "synced" } : row) }));
        }
      } catch { /* Leave every unconfirmed transaction queued for the next retry. */ }
      finally { offlineSyncLock.current = false; }
    };
    void syncPending();
    window.addEventListener("online", syncPending);
    return () => window.removeEventListener("online", syncPending);
  }, [canteen.id, posState.completed]);

  useEffect(() => {
    if (!menu.length) return;
    setPOSState((current) => ({
      ...current,
      current: current.current.map((line) => {
        const item = menu.find((candidate) => candidate.id === line.id);
        return item ? { ...line, name: item.name, price: item.price, image: item.image, category: item.category, stock: item.stock } : line;
      }),
    }));
  }, [menu]);

  const refreshPendingEventRequests = useCallback(async () => {
    const { data: eventRows, error: eventError } = await supabase
      .from("faculty_events")
      .select("id")
      .eq("canteen_id", canteen.id)
      .is("archived_at", null);
    if (eventError) return;
    const eventIds = (eventRows ?? []).map((event) => event.id);
    if (eventIds.length === 0) {
      setPendingEventRequests(0);
      return;
    }
    const [capacityRequests, facultyEvents] = await Promise.all([
      supabase.from("faculty_event_capacity_requests").select("id", { count: "exact", head: true }).in("event_id", eventIds).eq("status", "pending"),
      supabase.from("faculty_events").select("id", { count: "exact", head: true }).eq("canteen_id", canteen.id).eq("status", "requested"),
    ]);
    if (!capacityRequests.error && !facultyEvents.error) {
      setPendingEventRequests((capacityRequests.count ?? 0) + (facultyEvents.count ?? 0));
    }
  }, [canteen.id]);

  const refreshActiveOrderCount = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("canteen_id", canteen.id)
        .neq("status", "collected")
        .neq("status", "cancelled");
      if (!error) setActiveOrderCount(count ?? 0);
    } catch {
      // Keep the last confirmed count; the Realtime subscription and retry interval refresh it.
    }
  }, [canteen.id]);

  useEffect(() => {
    void refreshPendingEventRequests();
    const channel = supabase.channel(`canteen-event-notifications-${canteen.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "faculty_event_capacity_requests" }, () => { void refreshPendingEventRequests(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "faculty_events", filter: `canteen_id=eq.${canteen.id}` }, () => { setEventUpdateNotice(true); void refreshPendingEventRequests(); })
      .subscribe();
    const retry = window.setInterval(() => void refreshPendingEventRequests(), 15000);
    return () => { window.clearInterval(retry); void supabase.removeChannel(channel); };
  }, [canteen.id, refreshPendingEventRequests]);

  useEffect(() => {
    setPrinterPaperWidth(readPrinterPaperWidth(canteen.id));
  }, [canteen.id]);

  function savePrinterPreferences() {
    try {
      localStorage.setItem(printerPreferenceKey(canteen.id), JSON.stringify({ paperWidth: printerPaperWidth }));
      setPrinterSettingsMsg(printerPaperWidth === "auto"
        ? "Automatic width saved. The receipt will follow the paper size selected by the printer driver."
        : `${printerPaperWidth}mm width saved. Match the printer driver's paper size before printing.`);
    } catch {
      setPrinterSettingsMsg("Could not save printer preferences in this browser.");
    }
  }

  function addPOSItem(item: MenuItem) {
    setPOSMessage("");
    const existing = posState.current.find((line) => line.id === item.id);
    const nextQty = (existing?.qty ?? 0) + 1;
    if (nextQty < 1) {
      setPOSMessage("Quantity must be at least one.");
      return;
    }
    setPOSState((current) => {
      const line: POSLine = { id: item.id, name: item.name, price: item.price, image: item.image, category: item.category, stock: item.stock, qty: nextQty };
      return { ...current, current: existing ? current.current.map((row) => row.id === item.id ? line : row) : [...current.current, line] };
    });
  }

  function setPOSQuantity(itemId: string, delta: number) {
    setPOSMessage("");
    const line = posState.current.find((row) => row.id === itemId);
    const item = menu.find((candidate) => candidate.id === itemId);
    const nextQty = (line?.qty ?? 0) + delta;
    if (line && nextQty < 1) {
      return;
    }
    setPOSState((current) => ({
      ...current,
      current: current.current.flatMap((line) => {
        if (line.id !== itemId) return [line];
        const nextQty = line.qty + delta;
        if (nextQty < 1) return [];
        return [{ ...line, ...(item ? { name: item.name, price: item.price, image: item.image, category: item.category, stock: item.stock } : {}), qty: nextQty }];
      }),
    }));
  }

  function holdPOSOrder() {
    if (!posState.current.length) return;
    const heldOrder: HeldPOSOrder = { id: `H-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, createdAt: new Date().toISOString(), lines: posState.current, paymentMethod: posState.paymentMethod, paymentStatus: posState.paymentStatus };
    setPOSState((current) => ({ ...current, current: [], held: [heldOrder, ...current.held] }));
    setPOSMessage(`Order ${heldOrder.id} held on this device.`);
  }

  function resumePOSOrder(heldOrder: HeldPOSOrder) {
    if (posState.current.length) {
      setPOSMessage("Hold or clear the current bill before resuming another order.");
      return;
    }
    const restored = heldOrder.lines;
    setPOSState((current) => ({ ...current, current: restored, held: current.held.filter((order) => order.id !== heldOrder.id), paymentMethod: heldOrder.paymentMethod ?? current.paymentMethod, paymentStatus: heldOrder.paymentStatus ?? current.paymentStatus }));
    setPOSMessage(`Order ${heldOrder.id} resumed with its saved items, quantities and prices.`);
  }

  function clearPOSOrder() {
    if (!posState.current.length) return;
    setPOSState((current) => ({ ...current, current: [] }));
    setPOSMessage("Current bill cleared.");
  }

  function printPOSBill() {
    if (!posState.current.length) return;
    const subtotal = posState.current.reduce((sum, line) => sum + line.price * line.qty, 0);
    const createdAt = new Date().toISOString();
    const transactionId = crypto.randomUUID();
    const orderNumber = `POS-${transactionId.slice(0, 8).toUpperCase()}`;
    void startReceiptPrint({ kind: "offline", counterName: canteen.name, createdAt, orderNumber, transactionId, lines: posState.current.map(({ name, qty, price }) => ({ name, qty, price })), saleLines: posState.current, subtotal, total: subtotal, paymentMethod: posState.paymentMethod, paymentStatus: posState.paymentStatus });
  }

  async function startReceiptPrint(job: ReceiptPrintJob) {
    if (printLock.current) return;
    printLock.current = true;
    setPrinting(true);
    let finished = false;
    const clearPrintState = () => {
      if (finished) return;
      finished = true;
      window.removeEventListener("afterprint", finishAfterPrint);
      if (cleanupTimer !== undefined) window.clearTimeout(cleanupTimer);
      printLock.current = false;
      flushSync(() => {
        setPrintJob(null);
        setPrinting(false);
      });
    };
    const finishAfterPrint = () => {
      clearPrintState();
      if (job.kind === "offline") {
        if (window.confirm(`Did ${job.orderNumber} print or save as PDF successfully? Confirming clears this bill from the current counter order.`)) {
          const sale: OfflineSale = { id: job.transactionId, createdAt: job.createdAt, lines: job.saleLines, subtotal: job.subtotal, total: job.total, paymentMethod: job.paymentMethod, paymentStatus: job.paymentStatus, syncStatus: "pending" };
          setPOSState((current) => ({ ...current, current: [], completed: [sale, ...current.completed] }));
          setPOSMessage(`${job.orderNumber} printed and added to this device's OFFLINE POS history.`);
        } else {
          setPOSMessage("Print was not confirmed. The current bill is still available.");
        }
        return;
      }
      if (job.kind === "test") {
        setOrderMsg("Test print dialog closed. No order or payment data was changed.");
        return;
      }
      if (!window.confirm(`Did ${job.order.order_number} print or save as PDF successfully? Choose Yes only if the bill was produced. This records a print audit only; it does not change payment or order status.`)) {
        setOrderMsg("Print was not confirmed. No print record or order/payment change was saved.");
        return;
      }
      setBusyOrder(job.order.id);
      void recordConfirmedPrint({ data: { orderId: job.order.id, paperWidth: printerPaperWidth } })
        .then(({ alreadyConfirmed, confirmedAt }) => {
          setOrders((current) => current.map((order) => order.id === job.order.id ? { ...order, bill_print_confirmed_at: confirmedAt, completion_workflow: "printed" } : order));
          setOrderMsg(alreadyConfirmed
          ? `${job.order.order_number} already has a confirmed print. No duplicate record or customer notification was created.`
          : `${job.order.order_number} print confirmed. The customer can see the receipt status and confirm food receipt. Payment status was not changed.`);
        })
        .catch((cause) => setOrderMsg(cause instanceof Error ? cause.message : "Could not save the bill print record."))
        .finally(() => setBusyOrder(null));
    };
    const finishWithoutPrintConfirmation = () => {
      clearPrintState();
      if (job.kind === "offline") setPOSMessage("Print dialog was not confirmed. The current bill is still available.");
      else setOrderMsg("Print dialog was not confirmed. The order and payment statuses were not changed.");
    };

    if (typeof window.print !== "function") {
      printLock.current = false;
      setPrinting(false);
      if (job.kind === "offline") setPOSMessage("Printing is not supported in this browser. The current bill was left unchanged.");
      else setOrderMsg("Printing is not supported in this browser. The order was left unchanged.");
      return;
    }
    window.addEventListener("afterprint", finishAfterPrint, { once: true });
    const cleanupTimer = window.setTimeout(finishWithoutPrintConfirmation, 60_000);
    try {
      flushSync(() => setPrintJob(job));
      const logo = document.querySelector<HTMLImageElement>("#hungry-thermal-print .hungry-receipt-header img");
      if (!logo) throw new Error("The HUNGRY Z receipt logo is missing.");
      if (!logo.complete) await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("The receipt logo did not finish loading.")), 10000);
        const cleanup = () => { window.clearTimeout(timeout); logo.removeEventListener("load", onLoad); logo.removeEventListener("error", onError); };
        const onLoad = () => { cleanup(); resolve(); };
        const onError = () => { cleanup(); reject(new Error("The receipt logo could not be loaded.")); };
        logo.addEventListener("load", onLoad, { once: true });
        logo.addEventListener("error", onError, { once: true });
        if (logo.complete) onLoad();
      });
      if (!logo.naturalWidth || !logo.naturalHeight) throw new Error("The receipt logo could not be loaded.");
      if (typeof logo.decode === "function") await logo.decode();
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      window.print();
    } catch (cause) {
      clearPrintState();
      const message = cause instanceof Error ? `${cause.message} The bill was not printed.` : "Could not open the browser print dialog.";
      if (job.kind === "offline") setPOSMessage(message);
      else setOrderMsg(message);
    }
  }

  useEffect(() => () => {
    if (foodImagePreview) URL.revokeObjectURL(foodImagePreview);
  }, [foodImagePreview]);

  useEffect(() => {
    if (!templateImage) {
      setTemplatePreview(null);
      return;
    }
    const previewUrl = URL.createObjectURL(templateImage);
    setTemplatePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [templateImage]);

  async function setStatus(o: Order, status: "preparing" | "ready" | "collected" | "cancelled") {
    if (status === "cancelled" && !window.confirm(o.payment_status === "paid" ? `Cancel ${o.order_number}? The customer will be refunded ₹${o.total} automatically.` : `Cancel ${o.order_number}?`)) return;
    setBusyOrder(o.id);
    setOrderMsg("");
    try {
      const r = await move({ data: {
        orderId: o.id,
        status,
        // The ready counter-order action is labelled "Mark paid & collected";
        // this flag records the staff member's explicit payment confirmation.
        counterPaymentConfirmed: status === "collected" && o.payment_method === "counter",
      } });
      void refreshActiveOrderCount();
      if (r.refund) setOrderMsg(`${o.order_number} cancelled — refund started.`);
      if (r.notificationsSent === false) setOrderMsg(`${o.order_number} status updated, but an email notification could not be delivered. Check email configuration and the email log.`);
    } catch (e) {
      setOrderMsg(e instanceof Error ? e.message : "Could not update order");
    } finally {
      setBusyOrder(null);
    }
  }

  useEffect(() => {
    const loadMenu = async () => {
      const { data, error } = await supabase.from("menu_items").select("*").eq("canteen_id", canteen.id).order("category").order("name");
      if (data && !error) {
        const loadedMenu = data as MenuItem[];
        setMenu(loadedMenu);
        try { localStorage.setItem(`hungry:offline-menu:${canteen.id}`, JSON.stringify(loadedMenu)); } catch { /* Keep online menu usable when local storage is full. */ }
      }
    };
    const loadOrders = async () => {
      const { data } = await supabase.from("orders").select("*").eq("canteen_id", canteen.id).order("created_at", { ascending: false }).limit(100);
      setOrders((data as unknown as Order[]) ?? []);
      void refreshActiveOrderCount();
    };
    const loadTemplate = async () => {
      const { data, error } = await supabase.from("canteen_templates").select("canteen_id,banner_image_url,heading,description,banner_crop_x,banner_crop_y,banner_crop_zoom,updated_at").eq("canteen_id", canteen.id).maybeSingle();
      if (error) {
        setTemplateError("Could not load the canteen template. Apply database/007_canteen_template_crop.sql after the earlier migrations and try again.");
        return;
      }
      const loadedTemplate = normalizeCanteenTemplate(data, canteen.id);
      setTemplate(loadedTemplate);
      setTemplateHeading(loadedTemplate.heading);
      setTemplateDescription(loadedTemplate.description);
      setBannerCrop(normalizeBannerCrop({ x: loadedTemplate.banner_crop_x, y: loadedTemplate.banner_crop_y, zoom: loadedTemplate.banner_crop_zoom }));
      setTemplateError("");
    };
    loadMenu();
    loadOrders();
    loadTemplate();
    const ch = supabase
      .channel(`canteen-${canteen.id}-${uid()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items", filter: `canteen_id=eq.${canteen.id}` }, loadMenu)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `canteen_id=eq.${canteen.id}` }, loadOrders)
      .on("postgres_changes", { event: "*", schema: "public", table: "canteen_templates", filter: `canteen_id=eq.${canteen.id}` }, loadTemplate)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "canteens", filter: `id=eq.${canteen.id}` }, (payload) => setAvailability(payload.new as Canteen))
      .subscribe();
    const orderCountRetry = window.setInterval(() => void refreshActiveOrderCount(), 15000);
    return () => {
      window.clearInterval(orderCountRetry);
      supabase.removeChannel(ch);
    };
  }, [canteen.id, refreshActiveOrderCount]);

  useEffect(() => {
    if (tab !== "overview") return;
    let active = true;
    setTodayOnlineSales(null);
    setTodayOnlineSalesError(false);
    const loadTodaySales = async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const rows: { created_at: string; total: number; status: string; payment_status: string }[] = [];
      try {
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await supabase.from("orders")
            .select("created_at,total,status,payment_status")
            .eq("canteen_id", canteen.id)
            .gte("created_at", start.toISOString())
            .lt("created_at", end.toISOString())
            .order("created_at", { ascending: true })
            .range(offset, offset + 999);
          if (error) throw error;
          const page = data ?? [];
          rows.push(...page as typeof rows);
          if (page.length < 1000) break;
        }
        if (active) setTodayOnlineSales(rows);
      } catch {
        if (active) { setTodayOnlineSales(null); setTodayOnlineSalesError(true); }
      }
    };
    void loadTodaySales();
    const channel = supabase.channel(`canteen-overview-sales-${canteen.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `canteen_id=eq.${canteen.id}` }, () => { void loadTodaySales(); })
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [canteen.id, tab]);

  async function updateAvailability(settings: AvailabilitySettings) {
    setAvailabilitySaving(true);
    try {
      const saved = await saveAvailability({ data: { availabilityMode: settings.availability_mode, operatingHours: settings.operating_hours } });
      setAvailability((current) => ({ ...current, ...saved, availability_mode: saved.availability_mode as Canteen["availability_mode"], operating_hours: saved.operating_hours as unknown as Canteen["operating_hours"] }));
    } finally {
      setAvailabilitySaving(false);
    }
  }

  async function saveTemplate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTemplateError("");
    const heading = templateHeading.trim();
    const description = templateDescription.trim();
    if (heading.length > 120) return setTemplateError("Keep the heading under 120 characters.");
    if (description.length > 500) return setTemplateError("Keep the description under 500 characters.");

    setSavingTemplate(true);
    let uploadedPath: string | null = null;
    try {
      let bannerImageUrl = template.banner_image_url;
      if (templateImage) {
        const extension = BANNER_IMAGE_TYPES[templateImage.type];
        if (!extension) throw new Error("Choose a JPG, PNG, WebP, or AVIF banner image.");
        if (templateImage.size > 8 * 1024 * 1024) throw new Error("Banner images must be 8 MB or smaller.");
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) throw new Error("Sign in again before changing your canteen template.");
        uploadedPath = `${canteen.id}/${crypto.randomUUID()}.${extension}`;
        const storage = supabase.storage.from("canteen-home-banners");
        const { error: uploadError } = await storage.upload(uploadedPath, templateImage, {
          cacheControl: "3600",
          contentType: templateImage.type,
          upsert: false,
        });
        if (uploadError) throw new Error(`Could not upload the banner image: ${uploadError.message}`);
        bannerImageUrl = storage.getPublicUrl(uploadedPath).data.publicUrl;
      }
      const { data, error } = await supabase
        .from("canteen_templates")
        .upsert({ canteen_id: canteen.id, banner_image_url: bannerImageUrl, heading, description, banner_crop_x: bannerCrop.x, banner_crop_y: bannerCrop.y, banner_crop_zoom: bannerCrop.zoom }, { onConflict: "canteen_id" })
        .select("canteen_id,banner_image_url,heading,description,banner_crop_x,banner_crop_y,banner_crop_zoom,updated_at")
        .single();
      if (error || !data) throw new Error(error?.message || "Could not save the canteen template.");
      const savedTemplate = normalizeCanteenTemplate(data, canteen.id);
      setTemplate(savedTemplate);
      setTemplateHeading(savedTemplate.heading);
      setTemplateDescription(savedTemplate.description);
      setBannerCrop(normalizeBannerCrop({ x: savedTemplate.banner_crop_x, y: savedTemplate.banner_crop_y, zoom: savedTemplate.banner_crop_zoom }));
      setTemplateImage(null);
      setTab("menu");
    } catch (error) {
      if (uploadedPath) {
        try {
          const { error: cleanupError } = await supabase.storage.from("canteen-home-banners").remove([uploadedPath]);
          if (cleanupError) console.warn("Could not remove the unused banner upload", cleanupError);
        } catch (cleanupError) {
          console.warn("Could not remove the unused banner upload", cleanupError);
        }
      }
      setTemplateError(error instanceof Error ? error.message : "Could not save the canteen template.");
    } finally {
      setSavingTemplate(false);
    }
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const fd = new FormData(e.currentTarget);
    const row = {
      canteen_id: canteen.id,
      name: String(fd.get("name") ?? "").trim().slice(0, 80),
      description: String(fd.get("description") ?? "").trim().slice(0, 300),
      price: Math.round(Number(fd.get("price"))),
      category: String(fd.get("category") ?? "").trim().slice(0, 30) || "Meals",
      prep_minutes: Math.round(Number(fd.get("prep_minutes")) || 10),
      counter: String(fd.get("counter") ?? "").trim().slice(0, 30) || "Counter 1",
      tag: String(fd.get("tag") ?? "").trim().slice(0, 30) || null,
      stock: String(fd.get("stock") ?? "").trim() === "" ? null : Math.max(0, Math.round(Number(fd.get("stock")))),
      image: String(editing?.image ?? ""),
      veg: fd.get("veg") === "on",
      available: fd.get("available") === "on",
    };
    if (!row.name || !Number.isFinite(row.price) || row.price < 0) return setErr("Enter a name and a valid price.");
    if (row.stock !== null && !Number.isFinite(row.stock)) return setErr("Stock must be a number, or empty for unlimited.");
    let uploadedPath: string | null = null;
    try {
      if (foodImageFile) {
        const mimeToExtension: Record<string, string> = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
          "image/avif": "avif",
        };
        const extension = mimeToExtension[foodImageFile.type];
        if (!extension) return setErr("Choose a JPG, PNG, WEBP, or AVIF food image.");
        if (foodImageFile.size > 8 * 1024 * 1024) return setErr("Food images must be 8 MB or smaller.");
        const uploadTarget = await prepareMenuImageUpload({
          data: {
            canteenId: canteen.id,
            contentType: foodImageFile.type as "image/jpeg" | "image/png" | "image/webp" | "image/avif",
          },
        });
        uploadedPath = uploadTarget.path;
        const storage = supabase.storage.from("canteen-menu-images");
        const { error: uploadError } = await storage.uploadToSignedUrl(uploadedPath, uploadTarget.token, foodImageFile, {
          cacheControl: "3600",
          contentType: foodImageFile.type,
        });
        if (uploadError) throw new Error(`Could not upload the food image: ${uploadError.message}`);
        row.image = uploadTarget.publicUrl;
      }
      const result = editing?.id
        ? await supabase.from("menu_items").update(row).eq("id", editing.id).select().single()
        : await supabase.from("menu_items").insert(row).select().single();
      if (result.error) throw new Error(`Could not save the menu item: ${result.error.message}`);
      const savedItem = result.data as MenuItem;
      setMenu((current) => editing?.id
        ? current.map((item) => item.id === savedItem.id ? savedItem : item)
        : [...current, savedItem]);
    } catch (e) {
      if (uploadedPath) await supabase.storage.from("canteen-menu-images").remove([uploadedPath]);
      return setErr(e instanceof Error ? e.message : "Could not save the menu item. Please try again.");
    }
    setEditing(null);
    setFoodImageFile(null);
    setFoodImagePreview(null);
  }

  return (
    <div className="hz-canteen-app min-h-screen bg-background">
      <div className="hz-canteen-layout mx-auto w-full max-w-[1760px]">
        <aside className="hz-canteen-sidebar" aria-label="Canteen dashboard navigation">
          <div className="hz-canteen-sidebar-brand"><img src="/HUNGRY%20Z%20Q%20LOGO.png" alt="HUNGRY Z" /><span>CANTEEN</span></div>
          <nav className="hz-canteen-sidebar-nav" aria-label="Canteen dashboard sections">
            {sidebarSections.map((item) => { const { key, label, icon: Icon } = item; const count = "count" in item ? item.count : 0; return <button key={key} type="button" aria-current={tab === key ? "page" : undefined} onClick={() => selectSection(key)} className={cn("hz-canteen-side-link", tab === key && "is-active")}><Icon aria-hidden="true" /><span>{label}</span>{count > 0 && <span className="hz-canteen-side-count">{count}</span>}</button>; })}
          </nav>
          <div className="hz-canteen-sidebar-footer">
            <button type="button" onClick={() => { setTab("orders"); setPrinterSettingsOpen(true); setPrinterSettingsMsg(""); }} className="hz-canteen-side-link"><Settings aria-hidden="true" /><span>Settings</span></button>
            <button type="button" onClick={() => setOwnerFeedbackOpen(true)} className="hz-canteen-side-link"><CircleHelp aria-hidden="true" /><span>Help &amp; Support</span></button>
            <div className="hz-canteen-plan-card"><Store aria-hidden="true" /><div><strong data-no-translate>{canteen.name}</strong><span>Active canteen</span></div></div>
          </div>
        </aside>
        <main className="hz-canteen-main"><div className="hz-canteen-content">
        <header className="hz-canteen-header grid grid-cols-1 gap-4 rounded-3xl border border-border bg-card p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-6">
          <div className="hz-canteen-brand flex min-w-0 items-start gap-3 sm:gap-4">
            <BackButton inline />
            <img src="/HUNGRY%20Z%20CANTEEN%20DAHSBOARD%20LOGO.png" alt="HUNGRY Z Canteen Dashboard" className="h-11 w-11 shrink-0 rounded-full object-contain sm:h-12 sm:w-12" />
            <div className="hz-canteen-brand-copy min-w-0 flex-1">
              <p className="mb-0.5 text-[10px] font-semibold tracking-[0.22em] text-primary-bright">CANTEEN DASHBOARD</p>
              <h1 data-no-translate className="display truncate text-xl leading-tight sm:text-2xl">{canteen.name}</h1>
              <button type="button" onClick={() => { void navigator.clipboard.writeText(canteen.code).then(() => { setCanteenCodeCopied(true); window.setTimeout(() => setCanteenCodeCopied(false), 1800); }).catch(() => setCanteenCodeCopied(false)); }} className="mt-1.5 inline-flex min-h-10 max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-primary/35 bg-primary/10 px-3 py-1.5 font-mono text-sm font-black tracking-[0.18em] text-primary" aria-label="Copy HUNGRY Z Canteen Code"><span>CANTEEN CODE</span><span aria-hidden="true">·</span><span data-no-translate>{canteen.code}</span><span className="font-sans text-[10px] tracking-normal">{canteenCodeCopied ? "COPIED" : "COPY"}</span></button>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs leading-snug text-muted-foreground sm:text-sm"><span data-no-translate className="break-words">{canteen.university_name}</span><span aria-hidden="true">·</span><span className="capitalize">{canteen.visibility}</span></p>
            </div>
          </div>
          <div className="hz-canteen-actions flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-3 lg:justify-self-end">
            <ThemeToggle />
            <LanguageSelect language={language} onChange={onLanguageChange} />
            <button onClick={onSignOut} className="flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground"><LogOut className="h-3.5 w-3.5" /> Log out</button>
          </div>
        </header>
        {canteen.visibility === "maintenance" && <p className="mt-4 rounded-2xl border border-primary/40 bg-primary/10 p-3 text-sm text-primary-bright">Your canteen is in maintenance mode — customers can't place orders.</p>}
        {tab === "overview" && <section className="hz-canteen-overview-banner"><CanteenTemplateBanner layout="dashboard" imageUrl={template.banner_image_url} heading={template.heading} description={template.description} canteenName={canteen.name} universityName={canteen.university_name} cropX={template.banner_crop_x} cropY={template.banner_crop_y} cropZoom={template.banner_crop_zoom} /></section>}
        {tab === "overview" && <div id="canteen-availability"><CanteenAvailabilityPanel
          isActive={availability.is_active}
          visibility={availability.visibility}
          settings={{ availability_mode: availability.availability_mode, operating_hours: availability.operating_hours }}
          saving={availabilitySaving}
          onSave={updateAvailability}
        /></div>}
        {tab === "orders" && <div className="mt-4 flex justify-end"><button type="button" onClick={() => { setPrinterSettingsOpen((open) => !open); setPrinterSettingsMsg(""); }} aria-expanded={printerSettingsOpen} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground transition hover:border-primary/50 hover:text-foreground"><Settings className="h-3.5 w-3.5" /> Printer Settings</button></div>}

        {tab === "overview" && <section className="hz-canteen-overview" aria-label="Dashboard overview">
          <div className="hz-canteen-metric-grid">
            <button type="button" onClick={() => selectSection("orders")} className="hz-canteen-metric hz-metric-online"><span className="hz-canteen-metric-icon"><ShoppingBag aria-hidden="true" /></span><span><small>ONLINE ACTIVE ORDERS</small><strong>{activeOrderCount.toLocaleString(language === "hi" ? "hi-IN" : language === "kn" ? "kn-IN" : "en-IN")}</strong></span><ArrowUpRight aria-hidden="true" className="hz-canteen-metric-arrow" /></button>
            <button type="button" onClick={() => selectSection("pos")} className="hz-canteen-metric hz-metric-offline"><span className="hz-canteen-metric-icon"><Receipt aria-hidden="true" /></span><span><small>OFFLINE POS BILLS - TODAY</small><strong>{todayOfflineBills.length.toLocaleString(language === "hi" ? "hi-IN" : language === "kn" ? "kn-IN" : "en-IN")}</strong></span><ArrowUpRight aria-hidden="true" className="hz-canteen-metric-arrow" /></button>
            <button type="button" onClick={() => { setAnalyticsMode("online"); selectSection("analytics"); }} className="hz-canteen-metric hz-metric-sales"><span className="hz-canteen-metric-icon"><ChartNoAxesCombined aria-hidden="true" /></span><span><small>ONLINE REVENUE - TODAY</small><strong>{todayOnlineCollected === null ? "?" : `${"\u20b9"}${todayOnlineCollected.toLocaleString("en-IN")}`}</strong></span><ArrowUpRight aria-hidden="true" className="hz-canteen-metric-arrow" /></button>
            <button type="button" onClick={() => { setAnalyticsMode("offline"); selectSection("analytics"); }} className="hz-canteen-metric hz-metric-offline-sales"><span className="hz-canteen-metric-icon"><Store aria-hidden="true" /></span><span><small>OFFLINE REVENUE - TODAY</small><strong>{`\u20b9${todayOfflineRevenue.toLocaleString("en-IN")}`}</strong></span><ArrowUpRight aria-hidden="true" className="hz-canteen-metric-arrow" /></button>
          </div>
          <div className="hz-canteen-overview-panels">
            <section className="hz-canteen-overview-panel hz-canteen-sales-panel" aria-labelledby="online-sales-heading">
              <div className="hz-canteen-panel-heading"><div><p className="hz-canteen-eyebrow">ONLINE SALES</p><h2 id="online-sales-heading">Today's Sales</h2></div><div className="hz-canteen-chart-total"><strong>{todayOnlineCollected === null ? "?" : `\u20b9${todayOnlineCollected.toLocaleString("en-IN")}`}</strong><span>ONLINE - TODAY</span></div></div>
              {todayOnlineSales === null ? <p className="hz-canteen-chart-state">{todayOnlineSalesError ? "Could not load online sales." : "Online sales are loading."}</p> : <div className="hz-canteen-sales-chart" role="img" aria-label="Online collected sales by time today">
                <div className="hz-canteen-chart-axis"><span>{`\u20b9${maxOnlineSales.toLocaleString("en-IN")}`}</span><span>{`\u20b9${Math.round(maxOnlineSales * .5).toLocaleString("en-IN")}`}</span><span>{`\u20b9${Math.round(maxOnlineSales * .25).toLocaleString("en-IN")}`}</span><span>0</span></div>
                {onlineSalesBuckets.map(({ hour, start, revenue }) => <div key={hour} className="hz-canteen-sales-column"><div className="hz-canteen-sales-track"><i style={{ height: `${Math.max(revenue ? revenue / maxOnlineSales * 100 : 2, 2)}%` }} /></div><small>{start.toLocaleTimeString(language === "hi" ? "hi-IN" : language === "kn" ? "kn-IN" : "en-IN", { hour: "numeric", hour12: true }).replace(" ", "")}</small></div>)}
              </div>}
            </section>
            <section className="hz-canteen-overview-panel hz-canteen-orders-panel" aria-labelledby="recent-online-heading">
              <div className="hz-canteen-panel-heading"><div><p className="hz-canteen-eyebrow">ONLINE</p><h2 id="recent-online-heading">Recent Online Orders</h2></div><button type="button" onClick={() => selectSection("orders")} className="hz-canteen-text-action">View all <ArrowUpRight aria-hidden="true" /></button></div>
              {!orders.length ? <div className="hz-canteen-empty"><ShoppingBag aria-hidden="true" /><p>No online orders yet.</p><span>New customer orders will appear here.</span></div> : <div className="hz-canteen-recent-orders">{orders.slice(0, 4).map((order) => <button key={order.id} type="button" onClick={() => selectSection("orders")} className="hz-canteen-recent-order"><span className="hz-canteen-recent-id">{order.order_number}</span><span className="hz-canteen-recent-items" data-no-translate>{order.lines.slice(0, 2).map((line) => `${line.qty} \u00d7 ${line.name}`).join(", ")}{order.lines.length > 2 ? ` +${order.lines.length - 2}` : ""}</span><strong>{`\u20b9${order.total.toLocaleString("en-IN")}`}</strong><span className={cn("hz-canteen-order-status", `is-${order.status}`)}>{ORDER_LABELS[order.status] ?? order.status}</span><time dateTime={order.created_at}>{new Date(order.created_at).toLocaleTimeString(language === "hi" ? "hi-IN" : language === "kn" ? "kn-IN" : "en-IN", { hour: "numeric", minute: "2-digit" })}</time></button>)}</div>}
            </section>
          </div>
        </section>}

        {orderMsg && tab === "orders" && <p className="mt-4 rounded-2xl border border-primary/40 bg-primary/10 p-3 text-sm">{orderMsg}</p>}
        {tab === "orders" && printerSettingsOpen && (
          <section className="glass-red mt-4 grid gap-4 rounded-3xl p-5" aria-labelledby="printer-settings-title">
            <div>
              <h2 id="printer-settings-title" className="display text-lg">Printer Settings</h2>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">Choose your installed Epson printer in the browser print dialog. Automatic uses the paper size selected by that printer driver; browser pages cannot read printer capabilities directly. If the driver does not provide the expected width, select 58mm or 80mm and match the driver paper setting. Windows Epson drivers and supported ESC/POS printers use the standard print interface.</p>
            </div>
            <fieldset className="flex flex-wrap items-center gap-3">
              <legend className="mb-2 text-xs font-semibold text-foreground">Receipt paper width</legend>
              {(["auto", "58", "80"] as const).map((width) => (
                <label key={width} className={cn("inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold", printerPaperWidth === width ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground")}>
                  <input type="radio" name="receipt-paper-width" value={width} checked={printerPaperWidth === width} onChange={() => { setPrinterPaperWidth(width); setPrinterSettingsMsg(""); }} />
                  {width === "auto" ? "Printer default (Auto)" : `${width}mm`}
                </label>
              ))}
            </fieldset>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={savePrinterPreferences} className="rounded-full border border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/50 hover:text-foreground">Save Printer Preferences</button>
              <button type="button" disabled={printing} onClick={() => startReceiptPrint({ kind: "test", counterName: canteen.name, createdAt: new Date().toISOString() })} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"><Printer className="h-3.5 w-3.5" /> Print Test Receipt</button>
              {printerSettingsMsg && <p className="text-xs text-muted-foreground" role="status">{printerSettingsMsg}</p>}
            </div>
          </section>
        )}
        {tab === "pos" ? <OfflinePOSTab canteenName={canteen.name} menu={menu} current={posState.current} held={posState.held} pendingSyncCount={posState.completed.filter((sale) => sale.syncStatus !== "synced").length} search={posSearch} category={posCategory} message={posMessage} printing={printing} paymentMethod={posState.paymentMethod} paymentStatus={posState.paymentStatus} onPaymentMethod={(paymentMethod) => setPOSState((current) => ({ ...current, paymentMethod }))} onPaymentStatus={(paymentStatus) => setPOSState((current) => ({ ...current, paymentStatus }))} onSearch={setPOSSearch} onCategory={setPOSCategory} onAdd={addPOSItem} onQuantity={setPOSQuantity} onHold={holdPOSOrder} onResume={resumePOSOrder} onClear={clearPOSOrder} onPrint={printPOSBill} /> : tab === "orders" ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <section className="rounded-3xl border border-primary/25 bg-primary/5 p-5 sm:col-span-2"><h2 className="display text-xl">ONLINE ORDERS</h2><p className="mt-2 text-sm text-muted-foreground">Customers must enter this canteen’s correct seven-character HUNGRY Z Canteen Code to access its menu and place orders here.</p><p className="mt-2 font-mono text-sm font-black tracking-[0.18em] text-primary">{canteen.code}</p></section>
            {!orders.length && <p className="rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground sm:col-span-2">No orders yet. New orders appear here instantly.</p>}
            {orders.map((o) => (
              <div key={o.id} className={cn("rounded-3xl border bg-card p-5", orderStatusBorderClass(o.status))}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-4 py-2 text-sm font-black tracking-wider ${o.order_type === "parcel" ? "border-amber-500/40 bg-amber-500/10 text-amber-600" : "border-sky-500/40 bg-sky-500/10 text-sky-600"}`}>{o.order_type === "parcel" ? "PARCEL" : "DINE-IN"}</span>
                    <OrderStatusBadge status={o.status} className="max-w-none text-left text-[10px] tracking-widest" />
                  </div>
                  <div className="text-right"><p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Order ID</p><p className="font-mono text-sm font-bold text-foreground">{o.order_number}</p></div>
                </div>
                <div className="mt-4 grid gap-2 rounded-2xl bg-ink-soft p-3 text-sm sm:grid-cols-2">
                  <p><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer </span><strong>{o.customer_name}</strong></p>
                  <p><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pickup code </span><strong className="font-mono text-base tracking-widest">{o.pickup_code}</strong></p>
                  <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>
                  <p className="text-xs font-semibold text-foreground">{orderPaymentMethodLabel(o.payment_method)} · {orderPaymentStatusLabel(o.payment_status)}{o.payment_method === "counter" && o.payment_status !== "paid" ? ` · ₹${o.total} due` : ""}</p>
                </div>
                <div className="mt-4 space-y-2 border-b border-border pb-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Food items</p>
                  {o.lines.map((line, index) => <div key={`${line.name}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                    <span data-no-translate className="font-semibold text-foreground">{line.qty} × {line.name}</span>
                    <span className="shrink-0 text-muted-foreground">₹{line.price} each · <strong className="text-foreground">₹{line.price * line.qty}</strong></span>
                  </div>)}
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total amount</span>
                  <strong className="text-2xl font-black tabular-nums text-foreground">₹{o.total}</strong>
                </div>
                {o.completion_workflow === "printed" && <p className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-semibold text-amber-700 dark:text-amber-300">{o.food_received_confirmed_at ? "Customer confirmed that food was received." : "Printed bill confirmed; waiting for customer to confirm food receipt."}</p>}
                {o.status !== "cancelled" && o.completion_workflow !== "manual" && (o.bill_print_confirmed_at ? <div className="mt-4 flex gap-2"><button type="button" disabled className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-black tracking-widest text-emerald-600 disabled:opacity-100">BILL PRINTED ✓</button><button type="button" disabled={printing || busyOrder === o.id} onClick={() => { if (window.confirm(`Authorized reprint for ${o.order_number}? This will not create another print record or customer notification.`)) void startReceiptPrint({ kind: "order", order: o }); }} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border px-4 py-3 text-xs font-bold text-muted-foreground disabled:opacity-50"><Printer className="h-4 w-4" /> REPRINT</button></div> : <button type="button" disabled={printing || busyOrder === o.id} onClick={() => void startReceiptPrint({ kind: "order", order: o })} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black tracking-widest text-primary-foreground transition hover:brightness-110 disabled:opacity-50"><Printer className="h-5 w-5" /> PRINT BILL</button>)}
                {NEXT[o.status] && o.completion_workflow !== "printed" && (
                  <div className="mt-3 flex gap-2">
                    <button disabled={busyOrder === o.id} onClick={() => setStatus(o, NEXT[o.status] as "preparing" | "ready" | "collected")} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">{o.status === "ready" && o.payment_method === "counter" ? "Mark paid & collected" : `Mark ${ORDER_LABELS[NEXT[o.status]!]}`}</button>
                    {o.status === "placed" && <button disabled={busyOrder === o.id} onClick={() => setStatus(o, "cancelled")} className="rounded-full border border-border px-4 py-2 text-xs text-muted-foreground disabled:opacity-50">Cancel</button>}
                  </div>
                )}
                {o.status === "placed" && o.completion_workflow === "printed" && <button disabled={busyOrder === o.id} onClick={() => setStatus(o, "cancelled")} className="mt-3 rounded-full border border-border px-4 py-2 text-xs text-muted-foreground disabled:opacity-50">Cancel</button>}
              </div>
            ))}
          </div>
        ) : tab === "template" ? (
          <form onSubmit={saveTemplate} className="glass-red mt-6 grid gap-4 rounded-3xl p-5">
            <div>
              <h2 className="display text-xl">Student Home Banner</h2>
              <p className="mt-1 text-sm text-muted-foreground">Customize the banner students see on this canteen's Home page.</p>
            </div>
            <label className="space-y-2">
              <span className="block text-xs font-semibold text-foreground">Banner image (JPG, PNG, WebP, or AVIF; max 8 MB)</span>
              <input
                type="file"
                name="templateImage"
                accept="image/jpeg,image/png,image/webp,image/avif"
                aria-label="Choose canteen banner image"
                onChange={(event) => {
                  setTemplateImage(event.currentTarget.files?.[0] ?? null);
                  setBannerCrop(DEFAULT_BANNER_CROP);
                }}
                className={cn(field, "file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground")}
              />
            </label>
            <input name="templateHeading" maxLength={120} value={templateHeading} onChange={(event) => setTemplateHeading(event.currentTarget.value)} placeholder="Heading (optional)" className={field} />
            <textarea name="templateDescription" maxLength={500} value={templateDescription} onChange={(event) => setTemplateDescription(event.currentTarget.value)} placeholder="Description (optional)" rows={3} className={field} />
            <CanteenTemplatePreview imageUrl={templatePreview ?? template.banner_image_url} heading={templateHeading} description={templateDescription} canteenName={canteen.name} universityName={canteen.university_name} crop={bannerCrop} onCropChange={setBannerCrop} />
            {templateError && <p role="alert" className="text-sm text-primary-bright">{templateError}</p>}
            <div className="flex gap-2">
              <button disabled={savingTemplate} className="rounded-full bg-primary px-6 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-60">{savingTemplate ? "Saving template…" : "Save template"}</button>
              <button type="button" disabled={savingTemplate} onClick={() => { setTemplateImage(null); setTemplateError(""); setTab("menu"); }} className="rounded-full border border-border px-6 py-2.5 text-xs text-muted-foreground disabled:opacity-60">Cancel</button>
            </div>
          </form>
        ) : tab === "analytics" ? (
          <section className="mt-5" aria-label="Select analytics mode">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3">
              <div><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Separate reports</p><p className="mt-1 text-xs text-muted-foreground">Choose one sales channel to view its statistics and order history.</p></div>
              <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
                {(["online", "offline"] as const).map((mode) => <button key={mode} type="button" aria-pressed={analyticsMode === mode} onClick={() => setAnalyticsMode(mode)} className={cn("min-h-11 rounded-xl border px-5 text-xs font-black tracking-wider", analyticsMode === mode ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground")}>{mode.toUpperCase()} ANALYTICS</button>)}
              </div>
            </div>
            {analyticsMode === "online" ? <CanteenAnalytics canteenId={canteen.id} canteenName={canteen.name} /> : <OfflinePOSAnalytics sales={posState.completed} />}
          </section>
        ) : tab === "events" ? (
          <div className="mt-6"><EventCapacityPanel mode="canteen" canteenId={canteen.id} canteenName={canteen.name} /></div>
        ) : tab === "menu" ? (
          <div className="mt-6">
            <button onClick={() => { setFoodImageFile(null); setFoodImagePreview(null); setEditing({ veg: true, available: true }); }} className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> Add item</button>
            {editing && (
              <form key={editing.id ?? "new"} onSubmit={save} className="glass-red mt-4 grid gap-3 rounded-3xl p-5 sm:grid-cols-2">
                <input name="name" defaultValue={editing.name} placeholder="Item name" className={field} />
                <input name="price" type="number" min={0} defaultValue={editing.price} placeholder="Price (₹)" className={field} />
                <input name="category" defaultValue={editing.category} placeholder="Category (e.g. Meals)" className={field} />
                <input name="prep_minutes" type="number" min={1} max={180} defaultValue={editing.prep_minutes ?? ""} placeholder="Preparation minutes" className={field} />
                <input name="counter" defaultValue={editing.counter} placeholder="Counter (e.g. Counter 1)" className={field} />
                <input name="tag" defaultValue={editing.tag ?? ""} placeholder="Tag (optional, e.g. Bestseller)" className={field} />
                <input name="stock" type="number" min={0} max={100000} defaultValue={editing.stock ?? ""} placeholder="Stock (empty = unlimited)" aria-label="Stock" className={field} />
                <textarea name="description" defaultValue={editing.description} placeholder="Description" rows={2} className={cn(field, "sm:col-span-2")} />
                <div className="space-y-2 sm:col-span-2">
                  <label htmlFor="food-image-upload" className="block text-xs font-semibold text-foreground">Upload Food Image</label>
                  <input
                    id="food-image-upload"
                    name="food_image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    aria-label="Choose food image file"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0] ?? null;
                      setFoodImageFile(file);
                      setFoodImagePreview(file ? URL.createObjectURL(file) : null);
                    }}
                    className={cn(field, "file:mr-4 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-xs file:font-semibold file:text-primary-foreground")}
                  />
                  {(foodImagePreview || editing.image) && <img src={foodImagePreview ?? foodImage(editing.image)} alt={foodImagePreview ? "Selected food image preview" : "Current food image"} className="h-32 w-32 rounded-2xl border border-border object-cover" />}
                  <p className="text-xs text-muted-foreground">Choose a JPG, PNG, WEBP, or AVIF image (up to 8 MB).</p>
                </div>
                <div className="flex items-center gap-5 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" name="veg" defaultChecked={editing.veg} /> Veg</label>
                  <label className="flex items-center gap-2"><input type="checkbox" name="available" defaultChecked={editing.available} /> Available</label>
                </div>
                {err && <p className="text-xs text-primary-bright sm:col-span-2">{err}</p>}
                <div className="flex gap-2 sm:col-span-2">
                  <button className="rounded-full bg-primary px-6 py-2.5 text-xs font-semibold text-primary-foreground">Save</button>
                  <button type="button" onClick={() => { setEditing(null); setFoodImageFile(null); setFoodImagePreview(null); }} className="rounded-full border border-border px-6 py-2.5 text-xs text-muted-foreground">Cancel</button>
                </div>
              </form>
            )}
            <div className="mt-5 space-y-3">
              {!menu.length && <p className="rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Your menu is empty. Add your first item — it goes live for customers instantly.</p>}
              {menu.map((m) => (
                <div key={m.id} className={cn("flex items-center gap-4 rounded-3xl border border-border bg-card p-4", !m.available && "opacity-60")}>
                  <img src={foodImage(m.image)} alt="" className="h-14 w-14 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{m.name}</p>
                    <p className="text-xs text-muted-foreground"><span>{m.category}</span> · ₹{m.price} · {m.prep_minutes}m{m.stock != null && <> · {m.stock} <span>in stock</span></>}</p>
                  </div>
                  <button onClick={() => supabase.from("menu_items").update({ available: !m.available }).eq("id", m.id).then(() => {})} className={cn("rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest", m.available ? "bg-chart-4/20 text-chart-4" : "bg-muted text-muted-foreground")}>{m.available ? "Available" : "Sold out"}</button>
                  <button aria-label="Edit" onClick={() => { setFoodImageFile(null); setFoodImagePreview(null); setEditing(m); }} className="grid h-8 w-8 place-items-center rounded-full border border-border"><Pencil className="h-3.5 w-3.5" /></button>
                  <button aria-label="Delete" onClick={() => { if (confirm(`Remove ${m.name}?`)) void supabase.from("menu_items").delete().eq("id", m.id).then(() => {}); }} className="grid h-8 w-8 place-items-center rounded-full border border-border"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <section className="mt-4 rounded-3xl border border-border bg-card p-4 sm:p-5" aria-label="Canteen owner support and legal information">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="display text-base">Owner Help &amp; Legal</h2><p className="mt-1 text-[11px] text-muted-foreground">For order, payment and canteen operations support.</p></div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setOwnerLegalPage("privacy")} className="rounded-full border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground">Privacy Policy</button><button type="button" onClick={() => setOwnerLegalPage("terms")} className="rounded-full border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground">Terms &amp; Conditions</button><button type="button" onClick={() => setOwnerFeedbackOpen(true)} className="rounded-full border border-primary/50 px-3 py-2 text-xs font-semibold text-foreground hover:bg-primary/10">Feedback &amp; Report</button></div>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">Payment support: <a href="mailto:hungryofficialx@gmail.com" className="text-primary-bright underline">hungryofficialx@gmail.com</a>. Include the Order ID and payment reference.</p>
      </section>
        </div></main>
      </div>

      {ownerFeedbackOpen && <FeedbackDialog mode="canteen-report" onClose={() => setOwnerFeedbackOpen(false)} />}
      {ownerLegalPage && <LegalDialog legalDocument={ownerLegalPage === "privacy" ? privacyPolicy : termsConditions} onClose={() => setOwnerLegalPage(null)} />}
      {printJob && <ThermalReceipt job={printJob} paperWidth={printerPaperWidth} />}
    </div>
  );
}
