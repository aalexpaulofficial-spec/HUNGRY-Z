import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { QRCodeCanvas } from "qrcode.react";
import { useServerFn } from "@tanstack/react-start";
import { Home, UtensilsCrossed, Receipt, User, Plus, Minus, ShoppingBag, Clock, X, Check, LogOut, Repeat, MapPin, Store, Download } from "lucide-react";
import { LogoMark } from "@/components/foodexa/LogoMark";
import { CanteenTemplateBanner } from "@/components/foodexa/CanteenTemplateBanner";
import { FeedbackDialog } from "@/components/foodexa/FeedbackDialog";
import { LegalDialog } from "@/components/foodexa/LegalDialog";
import { BackButton, useBackStep } from "@/lib/back-nav";
import { supabase } from "@/integrations/supabase/client";
import { foodImage } from "@/lib/foodexa-images";
import { bannerCropStyle } from "@/lib/banner-crop";
import { ORDER_LABELS, ORDER_STATUSES, canAcceptOrders, type MenuItem } from "@/lib/access";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  cancelPendingOrder,
  ensureWelcomeEmail,
  getOwnOrderDetails,
  getPaymentConfig,
  joinCanteenByCode,
  joinPublicCanteen,
  listPublicCanteens,
  placeOrder,
  quoteOrder,
  reportPaymentFailure,
  requestRefund,
  resumePayment,
  verifyRazorpayPayment,
} from "@/lib/hungry.functions";
import {
  ORDER_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  REFUND_STATUS_LABELS,
  allowedPaymentMethods,
  canRequestRefund,
  isPaymentAllowed,
  orderPaymentMethodLabel,
  orderPaymentStatusLabel,
  type OrderType,
  type PaymentMethod,
} from "@/lib/order-rules";
import { openRazorpay, type CheckoutParams } from "@/lib/razorpay-checkout";
import { cn } from "@/lib/utils";
import { LanguageSelect, localizeDashboard, useDashboardLanguage } from "@/lib/dashboard-language";
import { clearSessionState, useSessionState } from "@/lib/session-state";
import { privacyPolicy, termsConditions } from "@/content/legal";
import { downloadOrderBillPdf } from "@/lib/order-bill-pdf";
import { describeTodayHours, formatCanteenTime, nextScheduledOpening, type WeeklyHours } from "@/lib/canteen-availability";
import { createOrderQrUrl } from "@/lib/order-qr";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/app")({
  validateSearch: z.object({ orderId: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: "HUNGRY — Order Food on Campus" },
      { name: "description", content: "Browse your canteen menu, order, track and pick up with a QR code." },
      { property: "og:title", content: "HUNGRY — Order Food on Campus" },
      { property: "og:description", content: "Browse, order, track and pick up campus food." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrderingApp,
});

type Profile = { id: string; full_name: string; role: string; registration_number: string | null; email: string; current_canteen_id: string | null; welcome_email_sent_at: string | null };
type Canteen = { id: string; name: string; university_name: string; campus_location: string; visibility: string; is_active: boolean; availability_mode: "schedule" | "open" | "closed"; operating_hours: WeeklyHours; timezone: string };
type CanteenTemplate = { canteen_id: string; banner_image_url: string | null; heading: string; description: string; banner_crop_x: number; banner_crop_y: number; banner_crop_zoom: number; updated_at?: string };
type CartLine = { item: MenuItem; qty: number };
type Order = {
  id: string; user_id: string; order_number: string; pickup_code: string; customer_name: string; canteen_name?: string; lines: { name: string; qty: number; price: number }[];
  subtotal: number; discount: number; total: number; coupon_code: string | null; payment: string; payment_method: string; payment_status: string;
  order_type: string; created_at: string; prep_minutes: number; counter: string; status: string; canteen_id: string;
};
type Refund = { id: string; order_id: string; amount: number; status: string; admin_note: string | null; created_at: string };
type Tab = "home" | "menu" | "orders" | "you";

const uid = () => Math.random().toString(36).slice(2);

function OrderingApp() {
  const navigate = useNavigate();
  const { orderId: qrOrderId } = Route.useSearch();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const { language, saveLanguage } = useDashboardLanguage(profile?.id);
  useEffect(() => localizeDashboard(document.body, language), [language]);
  const [canteen, setCanteen] = useState<Canteen | null>(null);
  const [menuLoadedFor, setMenuLoadedFor] = useState<string | null>(null);
  const [canteenTemplate, setCanteenTemplate] = useState<CanteenTemplate | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [collectedOrder, setCollectedOrder] = useState<Order | null>(null);
  const orderSnapshot = useRef(new Map<string, Order>());
  const ordersInitialized = useRef(false);
  const pendingCollectionEvents = useRef(new Map<string, Order>());
  const [tab, setTab] = useSessionState<Tab>("hungry-student-dashboard-tab", "home");
  const [cart, setCart] = useSessionState<CartLine[]>("hungry-student-dashboard-cart", []);
  const [detail, setDetail] = useState<MenuItem | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [openOrderId, setOpenOrderId] = useSessionState<string | null>("hungry-student-dashboard-order", null);
  const [switching, setSwitching] = useState(false);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [notice, setNotice] = useState("");
  const [qrOrderMessage, setQrOrderMessage] = useState("");
  const [qrOrder, setQrOrder] = useState<Order | null>(null);
  const [availabilityNow, setAvailabilityNow] = useState(() => new Date());
  useBackStep(tab !== "home", () => setTab("home"));
  useBackStep(!!detail, () => setDetail(null));
  useBackStep(checkout, () => setCheckout(false));
  function closeOrderDetails() {
    setOpenOrderId(null);
    setNotice("");
    setQrOrder(null);
    setQrOrderMessage("");
    if (qrOrderId) navigate({ to: "/app", search: {}, replace: true });
  }
  useBackStep(!!openOrderId, closeOrderDetails);
  useBackStep(switching, () => setSwitching(false));
  const welcome = useServerFn(ensureWelcomeEmail);
  const getOwnOrder = useServerFn(getOwnOrderDetails);

  useEffect(() => {
    const timer = window.setInterval(() => setAvailabilityNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const loadProfile = useCallback(async () => {
    // The protected layout already verified the user with the auth server; reuse the local session.
    const { data: s } = await supabase.auth.getSession();
    const uidv = s.session?.user.id;
    if (!uidv) return navigate({ to: "/auth", replace: true });
    // Profile and joined canteen in a single request.
    const { data: p } = await supabase
      .from("profiles")
      .select("*, canteen:canteens!profiles_current_canteen_id_fkey(id, name, university_name, campus_location, visibility, is_active, availability_mode, operating_hours, timezone)")
      .eq("id", uidv)
      .maybeSingle();
    if (!p) {
      // Not a customer account: send admins and canteen owners to their own dashboards.
      const [{ data: isAdmin }, { data: owned }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: uidv, _role: "admin" }),
        supabase.from("canteens").select("id").eq("owner_user_id", uidv).limit(1),
      ]);
      if (isAdmin) return navigate({ to: "/admin", replace: true });
      if (owned?.length) return navigate({ to: "/canteen", replace: true });
      setProfile(null);
      return;
    }
    const { canteen: c, ...rest } = p as typeof p & { canteen: Canteen | null };
    setCanteen(c ?? null);
    setProfile(rest as unknown as Profile);
    // One-time welcome email (the server makes sure it is only ever sent once).
    if (!rest.welcome_email_sent_at) welcome().catch(() => {});
  }, [welcome, navigate]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const canteenId = canteen?.id;
  useEffect(() => {
    if (!canteenId) return;
    let alive = true;
    const loadMenu = async () => {
      const { data } = await supabase.from("menu_items").select("*").eq("canteen_id", canteenId).order("category").order("name");
      if (alive) {
        setMenu((data as MenuItem[]) ?? []);
        setMenuLoadedFor(canteenId);
      }
    };
    const loadTemplate = async () => {
      const { data } = await supabase.from("canteen_templates").select("canteen_id,banner_image_url,heading,description,banner_crop_x,banner_crop_y,banner_crop_zoom,updated_at").eq("canteen_id", canteenId).maybeSingle();
      if (alive) setCanteenTemplate(data);
    };
    loadMenu();
    loadTemplate();
    const ch = supabase
      .channel(`menu-${canteenId}-${uid()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items", filter: `canteen_id=eq.${canteenId}` }, loadMenu)
      .on("postgres_changes", { event: "*", schema: "public", table: "canteen_templates", filter: `canteen_id=eq.${canteenId}` }, loadTemplate)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "canteens", filter: `id=eq.${canteenId}` }, (p) => setCanteen((c) => (c ? { ...c, ...(p.new as Canteen) } : c)))
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [canteenId]);

  const userId = profile?.id;
  useEffect(() => {
    orderSnapshot.current = new Map();
    ordersInitialized.current = false;
    pendingCollectionEvents.current.clear();
    setCollectedOrder(null);
    if (!userId) return;
    const load = async () => {
      const { data } = await supabase.from("orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
      const nextOrders = (data as unknown as Order[]) ?? [];
      if (ordersInitialized.current) {
        const newlyCollected = nextOrders.find((order) => order.status === "collected" && orderSnapshot.current.get(order.id)?.status !== "collected");
        if (newlyCollected) setCollectedOrder(newlyCollected);
      } else {
        const pending = Array.from(pendingCollectionEvents.current.keys()).find((id) => nextOrders.some((order) => order.id === id && order.status === "collected"));
        if (pending) {
          const matchingOrder = nextOrders.find((order) => order.id === pending);
          if (matchingOrder) setCollectedOrder(matchingOrder);
        }
        pendingCollectionEvents.current.clear();
        ordersInitialized.current = true;
      }
      orderSnapshot.current = new Map(nextOrders.map((order) => [order.id, order]));
      setOrders(nextOrders);
    };
    const loadRefunds = async () => {
      const { data } = await supabase.from("refunds").select("id, order_id, amount, status, admin_note, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
      setRefunds((data as Refund[]) ?? []);
    };
    load();
    loadRefunds();
    const ch = supabase
      .channel(`my-orders-${uid()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${userId}` }, (payload) => {
        const updatedOrder = payload.new as Order;
        if (payload.eventType === "UPDATE") setQrOrder((current) => current?.id === updatedOrder.id ? { ...current, ...updatedOrder } : current);
        if (payload.eventType === "UPDATE" && updatedOrder.user_id === userId && updatedOrder.status === "collected") {
          if (!ordersInitialized.current) pendingCollectionEvents.current.set(updatedOrder.id, updatedOrder);
          else if (orderSnapshot.current.get(updatedOrder.id)?.status !== "collected") {
            orderSnapshot.current.set(updatedOrder.id, updatedOrder);
            setCollectedOrder(updatedOrder);
          }
        }
        void load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "refunds", filter: `user_id=eq.${userId}` }, loadRefunds)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId]);

  useEffect(() => {
    if (!qrOrderId || !userId) return;
    let active = true;
    setTab("orders");
    setOpenOrderId(qrOrderId);
    setQrOrderMessage("");
    setQrOrder(null);
    getOwnOrder({ data: { orderId: qrOrderId } })
      .then(({ order }) => {
        if (active && order.user_id === userId) setQrOrder(order as Order);
      })
      .catch(() => {
        if (active) setQrOrderMessage("Order not found or unavailable for this account.");
      });
    return () => { active = false; };
  }, [getOwnOrder, qrOrderId, setOpenOrderId, setTab, userId]);

  // Drop items that became unavailable or were removed.
  useEffect(() => {
    if (!canteenId || menuLoadedFor !== canteenId) return;
    setCart((c) => c.flatMap((l) => {
      const fresh = menu.find((m) => m.id === l.item.id && m.available);
      return fresh ? [{ item: fresh, qty: l.qty }] : [];
    }));
  }, [canteenId, menu, menuLoadedFor, setCart]);

  const liveMenu = useMemo(() => menu.filter((m) => m.available), [menu]);
  const count = cart.reduce((s, l) => s + l.qty, 0);
  const subtotal = cart.reduce((s, l) => s + l.qty * l.item.price, 0);
  const openOrder = (qrOrder?.id === openOrderId ? qrOrder : null) ?? orders.find((o) => o.id === openOrderId) ?? null;

  function add(item: MenuItem, d = 1) {
    setCart((c) => {
      const ex = c.find((l) => l.item.id === item.id);
      const next = (ex?.qty ?? 0) + d;
      if (d > 0 && (next > 20 || (item.stock != null && next > item.stock))) return c;
      if (!ex) return d > 0 ? [...c, { item, qty: d }] : c;
      return c.map((l) => (l.item.id === item.id ? { ...l, qty: l.qty + d } : l)).filter((l) => l.qty > 0);
    });
  }

  async function signOut() {
    clearSessionState("hungry-student-dashboard-tab", "hungry-student-dashboard-cart", "hungry-student-dashboard-order");
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (profile === undefined) return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Loading…</div>;
  if (profile === null)
    return (
      <div className="grid min-h-screen place-items-center bg-background px-5">
        <div className="max-w-sm text-center">
          <p className="display text-2xl">This account isn't a customer account</p>
          <p className="mt-2 text-sm text-muted-foreground">Canteen owners use the Canteen Dashboard. Students, faculty and guests create an account from the sign-up page.</p>
          <button onClick={signOut} className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">Log out</button>
        </div>
      </div>
    );
  if (!canteen) {
    if (qrOrderId) return <QrOrderPage orderId={qrOrderId} order={qrOrder} message={qrOrderMessage} />;
    return <CodeGate name={profile.full_name} onJoined={loadProfile} onSignOut={signOut} />;
  }

  const ordering = canAcceptOrders(canteen, availabilityNow);
  const nextOpen = canteen.availability_mode === "open" ? null : nextScheduledOpening(canteen, availabilityNow);

  return (
    <div className="min-h-screen bg-background">
      <div className="relative mx-auto min-h-screen w-full max-w-3xl pb-32">
        <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-2 bg-background/80 px-4 py-3 backdrop-blur-xl sm:flex-nowrap sm:justify-between sm:gap-3 sm:px-5 sm:py-4">
          <div className="flex min-w-0 basis-full items-center gap-2 sm:basis-auto sm:gap-3">
            <BackButton inline />
            <div className="min-w-0 flex-1">
              <p className="truncate whitespace-nowrap text-xs text-muted-foreground">{`Hi, ${profile.full_name} 👋`}</p>
              <p className="display truncate whitespace-nowrap text-lg tracking-[0.2em]">HUNGRY?</p>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-initial">
            <ThemeToggle />
            <button onClick={() => setSwitching(true)} className="glass flex min-w-0 flex-1 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold sm:max-w-[55%] sm:flex-initial">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary-bright" />
              <span className="min-w-0 truncate text-left"><span data-no-translate className="block truncate">{canteen.name}</span><span className={cn("mt-0.5 block text-[9px] font-bold", ordering ? "text-emerald-500" : "text-red-500")}>{ordering ? "OPEN — Accepting Orders" : "CLOSED — Not Accepting Orders"}</span></span>
            </button>
            <LanguageSelect language={language} onChange={saveLanguage} />
          </div>
        </header>

        <div className={cn("mx-5 mb-3 rounded-2xl border px-4 py-3 text-xs", ordering ? "border-border bg-card text-muted-foreground" : "border-red-500/30 bg-red-500/10 text-red-500")}>
          <p>{ordering ? `Today's operating hours: ${describeTodayHours(canteen, availabilityNow)}` : canteen.availability_mode === "closed" ? "The owner has temporarily closed the canteen." : canteen.visibility === "maintenance" ? "The canteen is under maintenance." : nextOpen ? `Next opening: ${formatCanteenTime(nextOpen)}` : "The canteen is outside its operating hours."}</p>
        </div>

        <AnimatePresence mode="wait">
          <motion.main key={tab} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="px-5">
            {tab === "home" && <HomeTab menu={liveMenu} canteen={canteen} template={canteenTemplate} onOpen={setDetail} onAdd={add} goMenu={() => setTab("menu")} />}
            {tab === "menu" && <MenuTab menu={liveMenu} onOpen={setDetail} onAdd={add} />}
            {tab === "orders" && <OrdersTab orders={orders} onOpen={(o) => setOpenOrderId(o.id)} />}
            {tab === "you" && <YouTab profile={profile} canteen={canteen} onSwitch={() => setSwitching(true)} onSignOut={signOut} />}
          </motion.main>
        </AnimatePresence>

        {count > 0 && !checkout && (
          <motion.button initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={() => setCheckout(true)} className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-[calc(48rem-2rem)] min-w-0 items-center justify-between gap-3 rounded-full bg-primary px-4 py-4 text-primary-foreground shadow-[var(--shadow-cinema)] sm:px-6">
            <span className="flex shrink-0 items-center gap-2 text-xs font-semibold sm:text-sm"><ShoppingBag className="h-4 w-4" /> {`${count} ${count === 1 ? "item" : "items"}`}</span>
            <span className="min-w-0 break-words text-right text-xs font-bold sm:text-sm">View cart · ₹{subtotal}</span>
          </motion.button>
        )}

        <nav className="glass fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-3xl justify-around rounded-t-3xl px-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3">
          {([["home", "HOME", Home], ["menu", "MENU", UtensilsCrossed], ["orders", "ORDERS", Receipt], ["you", "YOU", User]] as const).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k)} className={cn("flex min-w-0 flex-1 flex-col items-center gap-1 py-1 text-[9px] font-bold tracking-normal transition sm:text-[10px] sm:tracking-widest", tab === k ? "text-primary-bright" : "text-muted-foreground")}>
              <Icon className={cn("h-5 w-5 transition", tab === k && "scale-110")} />
              {label}
            </button>
          ))}
        </nav>
      </div>

      <Sheet open={!!detail} onClose={() => setDetail(null)}>
        {detail && <ItemDetail item={detail} qty={cart.find((l) => l.item.id === detail.id)?.qty ?? 0} onAdd={(d) => add(detail, d)} />}
      </Sheet>
      <Sheet open={checkout} onClose={() => setCheckout(false)}>
        <Checkout
          cart={cart}
          subtotal={subtotal}
          ordering={ordering}
          closedMessage={canteen.availability_mode === "closed" ? "The owner has temporarily closed this canteen." : canteen.visibility === "maintenance" ? "The canteen is under maintenance." : `The canteen is outside its operating hours (${describeTodayHours(canteen, availabilityNow)} IST).`}
          onAdd={add}
          onPlaced={(id, msg) => {
            setCart([]);
            setCheckout(false);
            setNotice(msg ?? "");
            setTab("orders");
            setOpenOrderId(id);
          }}
        />
      </Sheet>
      <Sheet open={!!openOrderId} onClose={closeOrderDetails}>
        {openOrder ? <OrderDetail order={openOrder} canteenName={openOrder.canteen_name ?? (openOrder.canteen_id === canteen.id ? canteen.name : "Canteen")} refund={refunds.find((r) => r.order_id === openOrder.id) ?? null} notice={notice} onNotice={setNotice} /> : (
          <div className="p-8 text-center text-sm text-muted-foreground" role="status">{qrOrderMessage || "Loading order details…"}</div>
        )}
      </Sheet>
      <Sheet open={switching} onClose={() => setSwitching(false)}>
        <SwitchCampus
          current={canteen}
          onJoined={async () => {
            setSwitching(false);
            setTab("home");
            setCart([]);
            setOpenOrderId(null);
            await loadProfile();
          }}
        />
      </Sheet>
      <AnimatePresence>
        {collectedOrder && <CollectionCelebration onContinue={() => { setCollectedOrder(null); setOpenOrderId(null); setNotice(""); setTab("menu"); }} />}
      </AnimatePresence>
    </div>
  );
}

function CodeEntry({ onJoined, cta = "Continue" }: { onJoined: () => void; cta?: string }) {
  const join = useServerFn(joinCanteenByCode);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!/^[A-Z0-9]{7}$/.test(code)) return setErr("Enter the 7-character code.");
    setBusy(true);
    try {
      await join({ data: { code } });
      onJoined();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That code isn't valid.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7))}
        placeholder="ABC1234"
        aria-label="University / Canteen code"
        className="w-full rounded-2xl border border-input bg-ink-soft px-4 py-4 text-center font-mono text-2xl uppercase tracking-[0.5em] text-foreground outline-none transition placeholder:text-muted-foreground/40 focus:border-primary"
      />
      {err && <p className="text-center text-xs text-primary-bright">{err}</p>}
      <button disabled={busy} className="w-full rounded-full bg-primary py-4 text-sm font-semibold text-primary-foreground transition hover:shadow-[0_0_40px_-6px_var(--primary-bright)] disabled:opacity-60">
        {busy ? "Verifying…" : cta}
      </button>
    </form>
  );
}

function CodeGate({ name, onJoined, onSignOut }: { name: string; onJoined: () => void; onSignOut: () => void }) {
  return (
    <div className="grain relative min-h-screen overflow-hidden bg-background px-4 py-10">
      <div className="ember anim-pulse-glow pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2" />
      <div className="relative mx-auto w-full max-w-md">
        <p className="mb-8 text-center display text-[15px] tracking-[0.3em]">HUNGRY</p>
        <div className="glass-red anim-rise rounded-[2rem] p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary-bright">Welcome, {name.split(" ")[0]}</p>
          <h1 className="display mt-2 text-3xl">Enter your campus code</h1>
          <p className="mb-6 mt-2 text-sm text-muted-foreground">Your university or canteen shares a verified 7-character HUNGRY code. It opens that canteen's live menu.</p>
          <CodeEntry onJoined={onJoined} />
        </div>
        <button onClick={onSignOut} className="mx-auto mt-6 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><LogOut className="h-3.5 w-3.5" /> Log out</button>
      </div>
    </div>
  );
}

function SwitchCampus({ current, onJoined }: { current: Canteen; onJoined: () => void }) {
  const list = useServerFn(listPublicCanteens);
  const joinPublic = useServerFn(joinPublicCanteen);
  const [pub, setPub] = useState<{ id: string; name: string; university_name: string; campus_location: string }[]>([]);
  const [err, setErr] = useState("");
  useEffect(() => {
    list().then(setPub).catch(() => {});
  }, [list]);
  return (
    <div className="p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary-bright">Switch Campus / Canteen</p>
      <h3 className="display mt-2 text-2xl">Where are you eating?</h3>
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4">
        <Store className="h-5 w-5 text-primary-bright" />
        <div className="min-w-0">
          <p data-no-translate className="truncate text-sm font-semibold">{current.name}</p>
          <p className="truncate text-xs text-muted-foreground">{current.university_name} · current</p>
        </div>
      </div>
      <p className="mb-3 mt-6 text-xs uppercase tracking-widest text-muted-foreground">Enter another approved code</p>
      <CodeEntry onJoined={onJoined} cta="Switch canteen" />
      {pub.filter((p) => p.id !== current.id).length > 0 && (
        <>
          <p className="mb-3 mt-7 text-xs uppercase tracking-widest text-muted-foreground">Public canteens</p>
          <div className="space-y-2">
            {pub.filter((p) => p.id !== current.id).map((p) => (
              <button
                key={p.id}
                onClick={async () => {
                  setErr("");
                  try {
                    await joinPublic({ data: { id: p.id } });
                    onJoined();
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : "Could not switch");
                  }
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-border p-4 text-left transition hover:border-primary/50"
              >
                <Repeat className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p data-no-translate className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.university_name} · {p.campus_location}</p>
                </div>
              </button>
            ))}
          </div>
          {err && <p className="mt-2 text-xs text-primary-bright">{err}</p>}
        </>
      )}
    </div>
  );
}

function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[92vh] max-h-[92dvh] max-w-xl overscroll-contain overflow-y-auto rounded-t-[2rem] border border-border bg-card pb-[calc(env(safe-area-inset-bottom)+1.5rem)]" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }}>
            <button onClick={onClose} aria-label="Close" className="glass absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full"><X className="h-4 w-4" /></button>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-10 rounded-3xl border border-border bg-card p-8 text-center">
      <p className="display text-xl">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

export function FoodCard({ item, onOpen, onAdd, wide }: { item: MenuItem; onOpen: (i: MenuItem) => void; onAdd: (i: MenuItem) => void; wide?: boolean }) {
  return (
    <motion.div whileTap={{ scale: 0.97 }} className={cn("group min-w-0 overflow-hidden rounded-3xl border border-border bg-card", wide && "w-60 shrink-0")}>
      <button onClick={() => onOpen(item)} className="relative block aspect-[4/3] w-full overflow-hidden">
        <img data-no-translate src={foodImage(item.image)} alt={item.name} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
        {item.tag && <span data-no-translate className="absolute left-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground">{item.tag}</span>}
      </button>
      <div className="flex min-w-0 items-end justify-between gap-2 p-3 sm:p-4">
        <button onClick={() => onOpen(item)} className="min-w-0 flex-1 text-left">
          <p data-no-translate className="line-clamp-2 break-words text-sm font-semibold leading-tight sm:line-clamp-none sm:break-normal">{item.name}</p>
          <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground sm:flex-nowrap sm:gap-2">
            <span className="flex shrink-0 items-center gap-0.5"><Clock className="h-3 w-3" />{item.prep_minutes}m</span>
            <span className="shrink-0">{item.veg ? "Veg" : "Non-veg"}</span>
            {item.stock != null && item.stock > 0 && item.stock <= 5 && <span className="max-w-full break-words text-primary-bright">{`Only ${item.stock} left`}</span>}
          </p>
          <p className="mt-1.5 whitespace-nowrap text-base font-bold">₹{item.price}</p>
        </button>
        {item.stock === 0 ? (
          <span className="max-w-[40%] shrink-0 break-words rounded-full border border-border px-2 py-1 text-center text-[9px] font-bold uppercase leading-tight tracking-normal text-muted-foreground sm:max-w-none sm:px-2.5 sm:text-[10px] sm:tracking-widest">Sold out</span>
        ) : (
          <button onClick={() => onAdd(item)} aria-label={`Add ${item.name}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition hover:scale-110"><Plus className="h-4 w-4" /></button>
        )}
      </div>
    </motion.div>
  );
}

function HomeTab({ menu, canteen, template, onOpen, onAdd, goMenu }: { menu: MenuItem[]; canteen: Canteen; template: CanteenTemplate | null; onOpen: (i: MenuItem) => void; onAdd: (i: MenuItem) => void; goMenu: () => void }) {
  if (!menu.length) return <div className="space-y-8 pt-2"><CanteenTemplateBanner imageUrl={template?.banner_image_url} heading={template?.heading} description={template?.description} canteenName={canteen.name} universityName={canteen.university_name} cropX={template?.banner_crop_x} cropY={template?.banner_crop_y} cropZoom={template?.banner_crop_zoom} onOrder={goMenu} /><Empty title="Your canteen is getting ready" text={`${canteen.name} hasn't published its menu yet. It will appear here live as soon as it does.`} /></div>;
  const featured = menu.filter((m) => m.tag);
  const quick = menu.filter((m) => m.prep_minutes <= 8);
  return (
    <div className="space-y-8 pt-2">
      <div className="relative overflow-hidden rounded-[2rem] border border-primary/30">
        <img src={template?.banner_image_url || foodImage("food-indian")} alt="" className="h-52 w-full object-cover opacity-70" style={bannerCropStyle({ x: template?.banner_crop_x, y: template?.banner_crop_y, zoom: template?.banner_crop_zoom })} />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-5 left-5 right-5">
          <p data-no-translate className="text-xs font-semibold uppercase tracking-widest text-primary-bright">{canteen.name} · {canteen.university_name}</p>
          <p data-no-translate={template?.heading?.trim() ? "" : undefined} className="display mt-1 break-words text-2xl sm:break-normal sm:text-3xl">{template?.heading?.trim() || "Skip the queue."}</p>
          {template?.description?.trim() && <p data-no-translate className="mt-2 max-w-xl text-sm text-foreground/90">{template.description.trim()}</p>}
          <button onClick={goMenu} className="mt-3 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground">Order now ↗</button>
        </div>
      </div>
      <section>
        <h2 className="mb-3 text-lg font-bold">{featured.length ? "Today's picks" : "On the menu"}</h2>
        <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-2">
          {(featured.length ? featured : menu.slice(0, 8)).map((m) => <FoodCard key={m.id} item={m} onOpen={onOpen} onAdd={onAdd} wide />)}
        </div>
      </section>
      {quick.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Quick bites</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {quick.map((m) => <FoodCard key={m.id} item={m} onOpen={onOpen} onAdd={onAdd} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function MenuTab({ menu, onOpen, onAdd }: { menu: MenuItem[]; onOpen: (i: MenuItem) => void; onAdd: (i: MenuItem) => void }) {
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const cats = useMemo(() => ["All", ...Array.from(new Set(menu.map((m) => m.category)))], [menu]);
  const list = useMemo(() => menu.filter((m) => (cat === "All" || m.category === cat) && m.name.toLowerCase().includes(q.toLowerCase())), [menu, cat, q]);
  if (!menu.length) return <Empty title="No menu yet" text="Your canteen hasn't published its menu on HUNGRY yet." />;
  return (
    <div className="pt-2">
      <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={50} placeholder="Search dishes…" className="w-full rounded-full border border-input bg-card px-5 py-3 text-sm outline-none focus:border-primary" />
      <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5">
        {cats.map((c) => (
          <button data-no-translate key={c} onClick={() => setCat(c)} className={cn("shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition", cat === c ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground")}>{c}</button>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {list.map((m) => <FoodCard key={m.id} item={m} onOpen={onOpen} onAdd={onAdd} />)}
      </div>
    </div>
  );
}

function ItemDetail({ item, qty, onAdd }: { item: MenuItem; qty: number; onAdd: (d: number) => void }) {
  return (
    <div>
      <img data-no-translate src={foodImage(item.image)} alt={item.name} className="aspect-[16/10] w-full object-cover" />
      <div className="p-6">
        <div className="flex items-center gap-2 text-xs">
          <span className={cn("rounded-full border px-2 py-0.5 font-semibold", item.veg ? "border-chart-4 text-chart-4" : "border-primary text-primary")}>{item.veg ? "VEG" : "NON-VEG"}</span>
          <span data-no-translate className="text-muted-foreground">{item.counter}</span>
        </div>
        <h3 data-no-translate className="display mt-3 text-3xl">{item.name}</h3>
        <p data-no-translate className="mt-3 text-sm text-muted-foreground">{item.description}</p>
        <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{item.prep_minutes} min</span>
        </div>
        <div className="mt-6 flex items-center justify-between">
          <p className="text-2xl font-bold">₹{item.price}</p>
          {item.stock === 0 ? (
            <span className="rounded-full border border-border px-6 py-3 text-sm font-semibold text-muted-foreground">Sold out</span>
          ) : qty === 0 ? (
            <button onClick={() => onAdd(1)} className="rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground">Add to cart</button>
          ) : (
            <Stepper qty={qty} onAdd={onAdd} />
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ qty, onAdd }: { qty: number; onAdd: (d: number) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-full bg-primary px-2 py-1.5 text-primary-foreground">
      <button aria-label="Remove one" onClick={() => onAdd(-1)} className="grid h-7 w-7 place-items-center"><Minus className="h-4 w-4" /></button>
      <span className="w-4 text-center text-sm font-bold">{qty}</span>
      <button aria-label="Add one" onClick={() => onAdd(1)} className="grid h-7 w-7 place-items-center"><Plus className="h-4 w-4" /></button>
    </div>
  );
}

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

type PayResult = { ok: boolean; message: string };

/** Opens Razorpay, then lets the server confirm the payment with Razorpay before showing success. */
function useRazorpayPay() {
  const verify = useServerFn(verifyRazorpayPayment);
  const reportFail = useServerFn(reportPaymentFailure);
  return useCallback(
    (p: CheckoutParams) =>
      new Promise<PayResult>((resolve) => {
        let settled = false;
        openRazorpay(p, {
          onSuccess: async (r) => {
            settled = true;
            try {
              const out = await verify({ data: { razorpayOrderId: r.razorpay_order_id, razorpayPaymentId: r.razorpay_payment_id, signature: r.razorpay_signature } });
              if (out.state === "paid") resolve({ ok: true, message: out.emailSent === false ? "Payment confirmed. Your order is with the kitchen, but an email update could not be delivered." : "Payment confirmed. Your order is with the kitchen." });
              else if (out.state === "processing") resolve({ ok: false, message: "Payment is processing. We'll confirm your order as soon as Razorpay does." });
              else if (out.state === "refunding") resolve({ ok: false, message: "This order had expired, so your payment is being refunded automatically." });
              else resolve({ ok: false, message: out.notificationsSent === false ? "Payment failed. The email update could not be delivered. Contact hungryofficialx@gmail.com if you need help." : "Payment failed. You can retry below." });
            } catch (e) {
              resolve({ ok: false, message: e instanceof Error ? e.message : "We couldn't verify the payment yet." });
            }
          },
          onFailed: async (paymentId) => {
            if (!paymentId) return;
            settled = true;
            try {
              const out = await reportFail({ data: { razorpayOrderId: p.razorpayOrderId, razorpayPaymentId: paymentId } });
              if (out.state === "paid") resolve({ ok: true, message: "Payment was confirmed by Razorpay. Your order is with the kitchen." });
              else if (out.state === "processing") resolve({ ok: false, message: "Payment is processing. We will confirm it as soon as Razorpay does." });
              else resolve({ ok: false, message: out.notificationsSent === false ? "Payment failed. The email update could not be delivered. Contact hungryofficialx@gmail.com if you need help." : "Payment failed. You can retry below." });
            } catch {
              resolve({ ok: false, message: "Payment failed. Check your order status before retrying; contact hungryofficialx@gmail.com if money was deducted." });
            }
          },
          onDismiss: () => {
            if (!settled) resolve({ ok: false, message: "Payment not completed. You can pay or cancel from this order." });
          },
        }).catch((e) => resolve({ ok: false, message: e instanceof Error ? e.message : "Couldn't open the payment window." }));
      }),
    [verify, reportFail],
  );
}

function Checkout({ cart, subtotal, ordering, closedMessage, onAdd, onPlaced }: { cart: CartLine[]; subtotal: number; ordering: boolean; closedMessage: string; onAdd: (i: MenuItem, d: number) => void; onPlaced: (id: string, message?: string) => void }) {
  const place = useServerFn(placeOrder);
  const quote = useServerFn(quoteOrder);
  const cfgFn = useServerFn(getPaymentConfig);
  const pay = useRazorpayPay();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [cfg, setCfg] = useState<{ onlineEnabled: boolean; testMode: boolean } | null>(null);
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [method, setMethod] = useState<PaymentMethod>("counter");
  const [couponInput, setCouponInput] = useState("");
  const [applied, setApplied] = useState<{ code: string; description: string; discount: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState("");
  const [checking, setChecking] = useState(false);
  const [idemKey, setIdemKey] = useState(newKey);

  const lines = useMemo(() => cart.map((l) => ({ id: l.item.id, qty: l.qty })), [cart]);
  const cartSig = lines.map((l) => `${l.id}:${l.qty}`).join(",");

  useEffect(() => {
    cfgFn()
      .then((c) => {
        setCfg(c);
        if (c.onlineEnabled) setMethod("razorpay");
      })
      .catch(() => setCfg({ onlineEnabled: false, testMode: false }));
  }, [cfgFn]);

  // Parcel orders are always paid at the counter.
  useEffect(() => {
    if (!isPaymentAllowed(orderType, method)) setMethod("counter");
  }, [orderType, method]);

  // A changed cart, type, method or coupon is a new checkout attempt.
  useEffect(() => {
    setIdemKey(newKey());
  }, [cartSig, orderType, method, applied?.code]);

  // Re-check an applied coupon whenever the cart changes.
  useEffect(() => {
    if (!applied || !lines.length) return;
    quote({ data: { lines, couponCode: applied.code } })
      .then((q) => {
        if (q.coupon) setApplied({ ...q.coupon, discount: q.discount });
        else {
          setApplied(null);
          setCouponMsg(q.couponError ?? "Coupon removed.");
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartSig]);

  if (!cart.length) return <Empty title="Cart is empty" text="Add something tasty from the menu." />;

  const discount = applied?.discount ?? 0;
  const total = subtotal - discount;
  const methods = allowedPaymentMethods(orderType).filter((m) => m !== "razorpay" || cfg?.onlineEnabled);

  async function applyCoupon() {
    const code = couponInput.trim().toUpperCase();
    setCouponMsg("");
    if (!/^[A-Z0-9_-]{3,20}$/.test(code)) return setCouponMsg("Enter a valid coupon code.");
    setChecking(true);
    try {
      const q = await quote({ data: { lines, couponCode: code } });
      if (q.coupon) {
        setApplied({ ...q.coupon, discount: q.discount });
        setCouponInput("");
      } else setCouponMsg(q.couponError ?? "This coupon can't be used.");
    } catch (e) {
      setCouponMsg(e instanceof Error ? e.message : "Couldn't check this coupon.");
    } finally {
      setChecking(false);
    }
  }

  async function submit() {
    setErr("");
    setBusy(true);
    try {
      const r = await place({ data: { lines, orderType, paymentMethod: method, couponCode: applied?.code ?? null, idempotencyKey: idemKey } });
      const emailNotice = r.emailSent === false ? " The email update could not be delivered yet; contact hungryofficialx@gmail.com if you need help." : "";
      if (!r.payment) return onPlaced(r.orderId, `Order placed. Pay at the counter when you pick it up.${emailNotice}`);
      const res = await pay(r.payment);
      onPlaced(r.orderId, `${res.message}${emailNotice}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not place order");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6">
      <h3 className="display text-2xl">Your cart</h3>
      <div className="mt-5 space-y-3">
        {cart.map((l) => (
          <div key={l.item.id} className="flex items-center gap-3 rounded-2xl bg-ink-soft p-3">
            <img src={foodImage(l.item.image)} alt="" className="h-14 w-14 rounded-xl object-cover" />
            <div className="min-w-0 flex-1"><p data-no-translate className="truncate text-sm font-semibold">{l.item.name}</p><p className="text-xs text-muted-foreground">₹{l.item.price}</p></div>
            <Stepper qty={l.qty} onAdd={(d) => onAdd(l.item, d)} />
          </div>
        ))}
      </div>

      <h4 className="mt-7 text-xs font-bold uppercase tracking-widest text-muted-foreground">Order type</h4>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(["dine_in", "parcel"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setOrderType(t)} aria-pressed={orderType === t} className={cn("rounded-2xl border p-3 text-sm font-semibold transition", orderType === t ? "border-primary bg-primary/10" : "border-border text-muted-foreground")}>
            {ORDER_TYPE_LABELS[t]}
          </button>
        ))}
      </div>
      {orderType === "parcel" && <p className="mt-2 text-xs text-muted-foreground">Parcel orders are paid at the counter.</p>}

      <h4 className="mt-7 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        Payment {cfg?.testMode && method === "razorpay" && <span className="rounded-full border border-primary/60 px-2 py-0.5 text-[9px] text-primary-bright">TEST MODE</span>}
      </h4>
      <div className="mt-3 space-y-2">
        {methods.map((m) => (
          <button key={m} type="button" onClick={() => setMethod(m)} aria-pressed={method === m} className={cn("flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition", method === m ? "border-primary bg-primary/10" : "border-border")}>
            <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full border", method === m ? "border-primary bg-primary text-primary-foreground" : "border-input")}>{method === m && <Check className="h-3 w-3" />}</span>
            <span className="flex-1 text-sm font-semibold">{PAYMENT_METHOD_LABELS[m]}</span>
          </button>
        ))}
        {cfg && !cfg.onlineEnabled && orderType === "dine_in" && <p className="text-xs text-muted-foreground">Online payment isn't available at the moment.</p>}
      </div>

      <h4 className="mt-7 text-xs font-bold uppercase tracking-widest text-muted-foreground">Coupon</h4>
      {applied ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4">
          <div className="min-w-0">
            <p className="font-mono text-sm font-bold tracking-widest">{applied.code}</p>
            <p className="truncate text-xs text-muted-foreground">{applied.description || "Coupon applied"} · −₹{applied.discount}</p>
          </div>
          <button type="button" onClick={() => setApplied(null)} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Remove</button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 20))} placeholder="Enter code" aria-label="Coupon code" className="min-w-0 flex-1 rounded-full border border-input bg-ink-soft px-4 py-3 font-mono text-sm uppercase tracking-widest outline-none focus:border-primary" />
          <button type="button" disabled={checking || !couponInput} onClick={applyCoupon} className="shrink-0 rounded-full border border-primary/60 px-5 text-xs font-semibold disabled:opacity-50">{checking ? "Checking…" : "Apply"}</button>
        </div>
      )}
      {couponMsg && <p className="mt-2 text-xs text-primary-bright">{couponMsg}</p>}

      <div className="mt-6 space-y-2 rounded-2xl bg-ink-soft p-4 text-sm">
        <Row k="Subtotal" v={`₹${subtotal}`} />
        {discount > 0 && <Row k="Coupon discount" v={`−₹${discount}`} />}
        <Row k="Platform fee" v="₹0" />
        <div className="hairline pt-2"><Row k="Total" v={`₹${total}`} bold /></div>
      </div>
      {err && <p className="mt-3 text-center text-xs text-primary-bright">{err}</p>}
      {!ordering && <p role="status" className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-center text-xs text-red-500">Orders are paused. {closedMessage}</p>}
      <button disabled={busy || !ordering || !cfg} onClick={submit} className="mt-5 w-full rounded-full bg-primary py-4 text-sm font-semibold text-primary-foreground hover:shadow-[0_0_40px_-6px_var(--primary-bright)] disabled:opacity-50">
        {!ordering ? "Canteen not accepting orders" : busy ? (method === "razorpay" ? "Opening payment…" : "Placing order…") : method === "razorpay" ? `Pay ₹${total}` : `Place order · ₹${total}`}
      </button>
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return <div className={cn("flex justify-between", bold ? "text-base font-bold" : "text-muted-foreground")}><span>{k}</span><span className={bold ? "" : "text-foreground"}>{v}</span></div>;
}

function OrdersTab({ orders, onOpen }: { orders: Order[]; onOpen: (o: Order) => void }) {
  if (!orders.length) return <Empty title="No orders yet" text="Your orders, tracking and pickup QR codes will show up here." />;
  return (
    <div className="space-y-3 pt-2">
        {orders.map((o) => (
        <button key={o.id} onClick={() => onOpen(o)} className="w-full rounded-3xl border border-border bg-card p-5 text-left transition hover:border-primary/50">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-mono text-sm font-bold">{o.order_number}</span>
            <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary-bright"><Clock className="h-3 w-3" />{o.prep_minutes} min</span>
          </div>
          <div className="mt-2 flex justify-end">
            <span className={cn("max-w-[65%] break-words rounded-full px-3 py-1 text-right text-[10px] font-bold uppercase leading-tight tracking-normal sm:max-w-none sm:text-left sm:leading-normal sm:tracking-widest", o.status === "ready" || o.status === "pending_payment" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{ORDER_LABELS[o.status]}</span>
          </div>
          <p data-no-translate className="mt-2 truncate text-sm text-muted-foreground">{o.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}</p>
          <p className="mt-2 flex items-center justify-between text-sm">
            <span className="font-bold">₹{o.total}</span>
            <span className="text-xs text-muted-foreground">{ORDER_TYPE_LABELS[o.order_type as OrderType] ?? "Dine In"} · {orderPaymentMethodLabel(o.payment_method)} · {orderPaymentStatusLabel(o.payment_status)}</span>
          </p>
        </button>
      ))}
    </div>
  );
}

function CollectionCelebration({ onContinue }: { onContinue: () => void }) {
  const colors = ["#ff3b3b", "#ff6961", "#f6c85f", "#f8f4f0", "#d91f2b"];
  return (
    <motion.div
      className="fixed inset-0 z-[80] grid place-items-center overflow-hidden px-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="collection-celebration-title"
    >
      <div className="absolute inset-0 bg-background/90 backdrop-blur-xl" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 34 }, (_, index) => (
          <motion.span
            key={index}
            className="absolute top-[-5vh] rounded-sm shadow-[0_0_12px_currentColor]"
            initial={{ y: "-5vh", opacity: 0, rotate: 0 }}
            animate={{ y: "110vh", opacity: [0, 1, 1, 0], rotate: 720 + index * 15 }}
            transition={{ duration: 3.4 + (index % 5) * 0.45, delay: (index % 9) * 0.12, repeat: Infinity, ease: "linear" }}
            style={{
              left: `${(index * 37) % 100}%`,
              width: index % 4 === 0 ? 5 : 8,
              height: index % 4 === 0 ? 12 : 7,
              color: colors[index % colors.length],
              backgroundColor: colors[index % colors.length],
            }}
          />
        ))}
      </div>
      <motion.div
        initial={{ y: 24, scale: 0.96, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 12, scale: 0.98, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        className="glass-red relative w-full max-w-md overflow-hidden rounded-[2rem] p-8 text-center shadow-[var(--shadow-cinema)] sm:p-10"
      >
        <div aria-hidden="true" className="ember pointer-events-none absolute -top-28 left-1/2 h-56 w-56 -translate-x-1/2 opacity-60" />
        <div className="relative mx-auto">
          <LogoMark className="h-16 w-16 text-2xl animate-none transition-none transform-none" />
        </div>
        <p className="relative mt-6 text-[10px] font-bold tracking-[0.32em] text-primary-bright">ORDER COLLECTED</p>
        <h2 id="collection-celebration-title" className="display relative mt-3 text-2xl leading-tight sm:text-3xl">THANK YOU FOR USING HUNGRY!</h2>
        <p className="relative mt-4 text-sm text-muted-foreground">Great food. Zero queues. See you hungry again!</p>
        <button onClick={onContinue} className="relative mt-8 w-full rounded-full bg-primary px-6 py-4 text-sm font-semibold text-primary-foreground transition hover:shadow-[0_0_40px_-6px_var(--primary-bright)]">
          Continue Exploring
        </button>
      </motion.div>
    </motion.div>
  );
}

function QrOrderPage({ orderId, order, message }: { orderId: string; order: Order | null; message: string }) {
  const navigate = useNavigate();
  const [currentOrder, setCurrentOrder] = useState(order);
  const [notice, setNotice] = useState("");

  useEffect(() => setCurrentOrder(order), [order]);
  useEffect(() => {
    if (!order?.user_id) return;
    const channel = supabase
      .channel(`qr-order-${orderId}-${uid()}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` }, (payload) => {
        const updated = payload.new as Order;
        if (updated.id === orderId) setCurrentOrder((previous) => previous ? { ...previous, ...updated } : updated);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [order?.user_id, orderId]);

  return (
    <div className="min-h-screen bg-background px-3 pb-8 pt-3 sm:px-5 sm:pt-5">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-4 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <button type="button" onClick={() => navigate({ to: "/app", replace: true })} className="rounded-full border border-border px-4 py-2 text-xs font-semibold">Back to HUNGRY</button>
          <h1 className="display min-w-0 truncate text-lg">Order Details</h1>
        </header>
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-cinema)]">
          {currentOrder ? (
            <OrderDetail order={currentOrder} canteenName={currentOrder.canteen_name ?? "Canteen"} refund={null} notice={notice} onNotice={setNotice} />
          ) : (
            <p className="p-8 text-center text-sm text-muted-foreground" role="status">{message || "Loading secure order details…"}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderDetail({ order, canteenName, refund, notice, onNotice }: { order: Order; canteenName: string; refund: Refund | null; notice: string; onNotice: (m: string) => void }) {
  const resume = useServerFn(resumePayment);
  const cancel = useServerFn(cancelPendingOrder);
  const askRefund = useServerFn(requestRefund);
  const pay = useRazorpayPay();
  const [busy, setBusy] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [reason, setReason] = useState("");
  const step = ORDER_STATUSES.indexOf(order.status as (typeof ORDER_STATUSES)[number]);
  const awaiting = order.status === "pending_payment";
  const placedAt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(order.created_at));

  function downloadBill() {
    const downloaded = downloadOrderBillPdf({
      orderNumber: order.order_number,
      customerName: order.customer_name,
      canteenName,
      createdAt: order.created_at,
      orderStatus: ORDER_LABELS[order.status] ?? order.status.replaceAll("_", " "),
      counter: order.counter,
      pickupCode: order.pickup_code,
      orderType: ORDER_TYPE_LABELS[order.order_type as OrderType] ?? "Dine In",
      paymentMethod: orderPaymentMethodLabel(order.payment_method),
      paymentStatus: orderPaymentStatusLabel(order.payment_status),
      lines: order.lines,
      subtotal: order.subtotal,
      discount: order.discount,
      couponCode: order.coupon_code,
      total: order.total,
    });
    onNotice(downloaded ? "Order bill downloaded as a PDF." : "Could not download the bill in this browser.");
  }

  async function run(fn: () => Promise<string>) {
    setBusy(true);
    try {
      onNotice(await fn());
    } catch (e) {
      onNotice(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Order ID</p>
          <p className="display mt-1 truncate font-mono text-2xl sm:text-3xl">{order.order_number}</p>
        </div>
        <div className="mb-1 flex shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary-bright">
          <Clock className="h-3.5 w-3.5" />
          {order.prep_minutes} min
        </div>
      </div>
      <p className="mt-1 flex flex-wrap gap-x-1 text-xs text-muted-foreground"><span>{ORDER_TYPE_LABELS[order.order_type as OrderType] ?? "Dine In"}</span><span aria-hidden="true">·</span><span>{orderPaymentMethodLabel(order.payment_method)}</span><span aria-hidden="true">·</span><span>{orderPaymentStatusLabel(order.payment_status)}</span></p>
      <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3 rounded-2xl border border-border bg-ink-soft p-4 text-xs sm:grid-cols-2">
        <div className="min-w-0"><dt className="text-muted-foreground">Customer</dt><dd className="mt-1 break-words font-semibold text-foreground">{order.customer_name}</dd></div>
        <div className="min-w-0"><dt className="text-muted-foreground">Canteen</dt><dd className="mt-1 break-words font-semibold text-foreground">{canteenName}</dd></div>
        <div className="min-w-0"><dt className="text-muted-foreground">Order status</dt><dd className="mt-1 break-words font-semibold capitalize text-foreground">{ORDER_LABELS[order.status] ?? order.status.replaceAll("_", " ")}</dd></div>
        <div className="min-w-0"><dt className="text-muted-foreground">Date and time</dt><dd className="mt-1 break-words font-semibold text-foreground">{placedAt} IST</dd></div>
      </dl>
      {notice && <p className="mt-4 rounded-2xl border border-primary/40 bg-primary/10 p-3 text-sm" role="status">{notice}</p>}

      {awaiting ? (
        <div className="mt-6 rounded-2xl border border-primary/40 bg-primary/10 p-4">
          <p className="text-sm font-semibold">{order.payment_status === "failed" ? "Your last payment attempt failed." : "This order is waiting for payment."}</p>
          <p className="mt-1 text-xs text-muted-foreground">The kitchen starts once Razorpay confirms your payment. Unpaid orders are cancelled after 30 minutes.</p>
          <p className="mt-2 text-xs text-muted-foreground">If money was deducted but this order is still not confirmed, do not pay again. Email <a href="mailto:hungryofficialx@gmail.com" className="text-primary-bright underline">hungryofficialx@gmail.com</a> with your Order ID and payment reference or UPI transaction ID.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => run(async () => (await pay(await resume({ data: { orderId: order.id } }))).message)} className="rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">Pay ₹{order.total} now</button>
            <button disabled={busy} onClick={() => run(async () => { const result = await cancel({ data: { orderId: order.id } }); return result.notificationsSent === false ? "Order cancelled. Nothing was charged, but an email update could not be delivered." : "Order cancelled. Nothing was charged."; })} className="rounded-full border border-border px-5 py-2.5 text-xs text-muted-foreground disabled:opacity-50">Cancel order</button>
          </div>
        </div>
      ) : order.status === "cancelled" ? (
        <p className="mt-6 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm text-primary-bright">This order was cancelled.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {ORDER_STATUSES.map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <span className={cn("grid h-7 w-7 place-items-center rounded-full border text-xs font-bold", i <= step ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground", i === step && "anim-pulse-glow")}>{i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
              <span className={cn("text-sm", i <= step ? "font-semibold" : "text-muted-foreground")}>{ORDER_LABELS[s]}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 space-y-3 rounded-2xl border border-border bg-ink-soft p-4 text-sm">
        <p className="font-semibold text-foreground">Food items</p>
        {order.lines.map((line, index) => (
          <div key={index} className="flex min-w-0 items-start justify-between gap-3">
            <span className="min-w-0 break-words" data-no-translate>
              <span className="block font-medium text-foreground">{line.name}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{line.qty} &times; &#8377;{line.price} each</span>
            </span>
            <span className="shrink-0 font-medium text-foreground">&#8377;{line.qty * line.price}</span>
          </div>
        ))}
        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex justify-between gap-3 text-muted-foreground"><span>Subtotal</span><span className="shrink-0">&#8377;{order.subtotal}</span></div>
          {order.discount > 0 && <div className="flex justify-between gap-3 text-muted-foreground"><span className="min-w-0 break-words">Coupon {order.coupon_code}</span><span className="shrink-0">-&#8377;{order.discount}</span></div>}
          <div className="flex justify-between gap-3 pt-1 font-bold text-foreground"><span>Total</span><span className="shrink-0">&#8377;{order.total}</span></div>
        </div>
      </div>

      {!awaiting && order.status !== "cancelled" && (
        <div className="mt-7 flex w-full flex-col items-center rounded-3xl border border-primary/30 bg-ink p-3 sm:p-4">
          <div className="w-fit max-w-full rounded-xl bg-white p-2">
            <QRCodeCanvas value={createOrderQrUrl(window.location.origin, order.id)} size={512} level="M" bgColor="#ffffff" fgColor="#050505" marginSize={4} title="Scan to view secure HUNGRY order details" className="block aspect-square h-auto w-32 max-w-full object-contain sm:w-36 md:w-40" />
          </div>
          <p className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">Pickup code</p>
          <p className="display text-3xl tracking-[0.3em]">{order.pickup_code}</p>
          <p className="mt-2 flex flex-wrap justify-center gap-x-1 text-center text-xs text-muted-foreground"><span>Show at</span> <span data-no-translate>{order.counter}</span><span aria-hidden="true">·</span><span>ready in ~{order.prep_minutes} min</span></p>
        </div>
      )}
      <button type="button" onClick={downloadBill} className="mt-5 w-full rounded-full border border-primary/50 px-5 py-3 text-xs font-semibold text-foreground hover:bg-primary/10"><Download className="mr-2 inline h-4 w-4" />Download Bill</button>

      {refund && (
        <div className="mt-5 rounded-2xl border border-border bg-card p-4 text-sm">
          <p className="font-semibold">{REFUND_STATUS_LABELS[refund.status] ?? refund.status} · ₹{refund.amount}</p>
          {refund.status === "processing" && <p className="mt-2 text-xs text-muted-foreground">Eligible refunds generally take 5–7 working days to appear, depending on Razorpay, your bank and payment method.</p>}
          {refund.status === "rejected" && refund.admin_note && <p className="mt-1 text-xs text-muted-foreground">{refund.admin_note}</p>}
        </div>
      )}


      {!refund && canRequestRefund(order) && (
        refundOpen ? (
          <div className="mt-6 space-y-3">
            <textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 500))} rows={3} placeholder="Why do you need a refund?" aria-label="Refund reason" className="w-full rounded-2xl border border-input bg-ink-soft px-4 py-3 text-sm outline-none focus:border-primary" />
            <div className="flex gap-2">
              <button disabled={busy || reason.trim().length < 3} onClick={() => run(async () => { const result = await askRefund({ data: { orderId: order.id, reason } }); setRefundOpen(false); return result.emailSent ? "Refund requested. Confirmation email sent." : "Refund request saved, but the confirmation email could not be delivered. Please check your email settings or contact support."; })} className="rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">Send request</button>
              <button onClick={() => setRefundOpen(false)} className="rounded-full border border-border px-5 py-2.5 text-xs text-muted-foreground">Back</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setRefundOpen(true)} className="mt-6 w-full rounded-full border border-border py-3 text-xs font-semibold text-muted-foreground hover:text-foreground">Request a refund</button>
        )
      )}
    </div>
  );
}


function YouTab({ profile, canteen, onSwitch, onSignOut }: { profile: Profile; canteen: Canteen; onSwitch: () => void; onSignOut: () => void }) {
  const [feedbackMode, setFeedbackMode] = useState<"rate" | "student-report" | null>(null);
  const [legalPage, setLegalPage] = useState<"privacy" | "terms" | null>(null);
  return (
    <div className="space-y-4 pt-2">
      <div className="glass-red rounded-[2rem] p-6">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">{profile.full_name[0]}</div>
        <p data-no-translate className="display mt-4 min-w-0 break-words text-2xl sm:break-normal">{profile.full_name}</p>
        <p className="text-sm capitalize text-muted-foreground">{profile.role}{profile.registration_number && <> · <span data-no-translate>{profile.registration_number}</span></>}</p>
        <p className="text-sm text-muted-foreground">{profile.email}</p>
      </div>
      <div className="rounded-3xl border border-border bg-card p-5 text-sm">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Current canteen</p>
        <p data-no-translate className="mt-1 font-semibold">{canteen.name}</p>
        <p className="text-xs text-muted-foreground">{canteen.university_name} · {canteen.campus_location}</p>
        <p className="mt-1 text-xs text-chart-4">Verified HUNGRY canteen</p>
      </div>
      <button onClick={onSwitch} className="group flex w-full items-center gap-4 rounded-3xl border border-primary/40 bg-gradient-to-r from-primary/20 to-transparent p-5 text-left transition hover:border-primary">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground transition group-hover:rotate-180"><Repeat className="h-5 w-5" /></span>
        <span className="flex-1">
          <span className="block text-sm font-bold">Switch Campus / Canteen</span>
          <span className="block text-xs text-muted-foreground">Enter another approved code to open its live menu</span>
        </span>
        <span className="text-primary-bright">↗</span>
      </button>
      <section className="rounded-3xl border border-border bg-card p-5" aria-label="Student support and legal information">
        <h2 className="display text-lg">Help &amp; Legal</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => setLegalPage("privacy")} className="rounded-2xl border border-border px-4 py-3 text-left text-sm font-semibold hover:border-primary/50">Privacy Policy</button>
          <button type="button" onClick={() => setLegalPage("terms")} className="rounded-2xl border border-border px-4 py-3 text-left text-sm font-semibold hover:border-primary/50">Terms &amp; Conditions</button>
          <button type="button" onClick={() => setFeedbackMode("rate")} className="rounded-2xl border border-border px-4 py-3 text-left text-sm font-semibold hover:border-primary/50">Rate Us <span className="block text-xs font-normal text-muted-foreground">Share a rating and comments</span></button>
          <button type="button" onClick={() => setFeedbackMode("student-report")} className="rounded-2xl border border-border px-4 py-3 text-left text-sm font-semibold hover:border-primary/50">Feedback &amp; Report <span className="block text-xs font-normal text-muted-foreground">Order, payment or account help</span></button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">Payment support: <a href="mailto:hungryofficialx@gmail.com" className="text-primary-bright underline">hungryofficialx@gmail.com</a>. Include your Order ID and payment reference if money was deducted but the order is not confirmed.</p>
      </section>
      <button onClick={onSignOut} className="flex w-full items-center justify-center gap-2 rounded-full border border-border py-3.5 text-sm font-semibold text-muted-foreground hover:text-foreground"><LogOut className="h-4 w-4" /> Log out</button>
      {feedbackMode && <FeedbackDialog mode={feedbackMode} onClose={() => setFeedbackMode(null)} />}
      {legalPage && <LegalDialog legalDocument={legalPage === "privacy" ? privacyPolicy : termsConditions} onClose={() => setLegalPage(null)} />}
    </div>
  );
}
