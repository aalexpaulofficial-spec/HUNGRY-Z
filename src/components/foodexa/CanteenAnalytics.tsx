import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useSessionState } from "@/lib/session-state";
import { buildXlsx } from "@/lib/xlsx";
import { buildSimplePdf } from "@/lib/simple-pdf";

type OrderLine = { id?: string; name: string; price?: number; qty: number };
export type AnalyticsOrder = {
  id: string;
  order_number: string;
  created_at: string;
  total: number;
  discount: number;
  subtotal: number;
  status: string;
  payment_status: string;
  payment_method: string;
  lines: OrderLine[];
  paid_at?: string | null;
  prep_minutes?: number;
};
type MenuRow = { id: string; name: string; category: string; price: number };
type Preset = "today" | "yesterday" | "7days" | "30days" | "month" | "custom";
type Grain = "daily" | "weekly" | "monthly";

const PAGE_SIZE = 1000;
const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const money = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;
const dateInput = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
function TrendChart({ data }: { data: { label: string; revenue: number; orders: number }[] }) {
  if (!data.length)
    return (
      <p className="grid h-full place-content-center text-xs text-muted-foreground">
        No orders in this period.
      </p>
    );
  const maxRevenue = Math.max(1, ...data.map((row) => row.revenue));
  const maxOrders = Math.max(1, ...data.map((row) => row.orders));
  const x = (index: number) => 48 + index * (620 / Math.max(1, data.length - 1));
  const line = data
    .map((row, index) => `${x(index)},${195 - (row.orders / maxOrders) * 145}`)
    .join(" ");
  const step = 620 / data.length;
  return (
    <svg
      viewBox="0 0 710 245"
      className="h-full w-full"
      role="img"
      aria-label="ONLINE revenue bars and ONLINE order trend line"
    >
      {[0, 1, 2, 3].map((tick) => (
        <g key={tick}>
          <line
            x1="44"
            x2="680"
            y1={50 + tick * 48}
            y2={50 + tick * 48}
            stroke="var(--border)"
            strokeDasharray="4 4"
          />
          <text x="3" y={54 + tick * 48} fill="var(--muted-foreground)" fontSize="9">
            {currencyTick((maxRevenue * (3 - tick)) / 3)}
          </text>
        </g>
      ))}
      {data.map((row, index) => {
        const height = (row.revenue / maxRevenue) * 145;
        return (
          <g key={row.label}>
            <rect
              x={x(index) - Math.min(16, step * 0.3)}
              y={195 - height}
              width={Math.max(3, Math.min(32, step * 0.6))}
              height={height}
              rx="3"
              fill="var(--chart-1)"
            >
              <title>
                {row.label}: ₹{Math.round(row.revenue)} · {row.orders} orders
              </title>
            </rect>
            <text x={x(index)} y="222" textAnchor="middle" fill="var(--muted-foreground)" fontSize="9">
              {data.length > 16 && index % Math.ceil(data.length / 12) !== 0 ? "" : row.label}
            </text>
          </g>
        );
      })}
      <polyline points={line} fill="none" stroke="var(--chart-3)" strokeWidth="2.5" />
      {data.map((row, index) => (
        <circle
          key={`dot-${row.label}`}
          cx={x(index)}
          cy={195 - (row.orders / maxOrders) * 145}
          r="3"
          fill="var(--chart-3)"
        >
          <title>
            {row.label}: {row.orders} orders
          </title>
        </circle>
      ))}
      <text x="48" y="240" fill="var(--muted-foreground)" fontSize="9">
        ONLINE revenue (bars) · ONLINE orders (line)
      </text>
    </svg>
  );
}

function currencyTick(value: number) {
  return value >= 1000 ? `₹${Math.round(value / 1000)}k` : `₹${Math.round(value)}`;
}

function rangeFor(preset: Preset, from: string, to: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start = today;
  let end = new Date(today.getTime() + 86_400_000);
  if (preset === "yesterday") {
    start = new Date(today.getTime() - 86_400_000);
    end = today;
  }
  if (preset === "7days") start = new Date(today.getTime() - 6 * 86_400_000);
  if (preset === "30days") start = new Date(today.getTime() - 29 * 86_400_000);
  if (preset === "month") start = new Date(today.getFullYear(), today.getMonth(), 1);
  if (preset === "custom") {
    start = from ? new Date(`${from}T00:00:00`) : today;
    end = to
      ? new Date(new Date(`${to}T00:00:00`).getTime() + 86_400_000)
      : new Date(today.getTime() + 86_400_000);
  }
  return { start, end };
}

function orderRevenue(order: AnalyticsOrder) {
  return order.payment_status === "paid" && order.status !== "cancelled"
    ? Number(order.total) || 0
    : 0;
}

function keyForDate(date: Date, grain: Grain) {
  if (grain === "monthly")
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  if (grain === "weekly") {
    const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return dateInput(monday);
  }
  return dateInput(date);
}

function displayBucket(key: string, grain: Grain) {
  const date = new Date(`${key}T00:00:00`);
  return grain === "monthly"
    ? date.toLocaleDateString(undefined, { month: "short", year: "2-digit" })
    : grain === "weekly"
      ? `Week ${date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
      : date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function CanteenAnalytics({
  canteenId,
  canteenName,
  liveOrders,
}: {
  canteenId: string;
  canteenName: string;
  liveOrders: AnalyticsOrder[];
}) {
  const [orders, setOrders] = useState<AnalyticsOrder[]>([]);
  const [menu, setMenu] = useState<MenuRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preset, setPreset] = useSessionState<Preset>(`hungry-canteen-analytics-${canteenId}-preset`, "30days");
  const [customFrom, setCustomFrom] = useSessionState(`hungry-canteen-analytics-${canteenId}-from`, dateInput(new Date(Date.now() - 29 * 86_400_000)));
  const [customTo, setCustomTo] = useSessionState(`hungry-canteen-analytics-${canteenId}-to`, dateInput(new Date()));
  const [grain, setGrain] = useSessionState<Grain>(`hungry-canteen-analytics-${canteenId}-grain`, "daily");
  const [itemSearch, setItemSearch] = useSessionState(`hungry-canteen-analytics-${canteenId}-item-search`, "");
  const [reportMenu, setReportMenu] = useState(false);
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    setOrders((current) => Array.from(new Map([...current, ...liveOrders].map((order) => [order.id, order])).values()).sort((a, b) => b.created_at.localeCompare(a.created_at)));
  }, [liveOrders]);

  const loadData = useCallback(async () => {
    setError("");
    try {
      const allOrders: AnalyticsOrder[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error: queryError } = await supabase
          .from("orders")
          .select(
            "id,order_number,created_at,total,discount,subtotal,status,payment_status,payment_method,lines,paid_at,prep_minutes",
          )
          .eq("canteen_id", canteenId)
          .order("created_at", { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);
        if (queryError) throw queryError;
        const page = (data ?? []) as unknown as AnalyticsOrder[];
        allOrders.push(...page);
        if (page.length < PAGE_SIZE) break;
      }
      const allMenu: MenuRow[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error: queryError } = await supabase
          .from("menu_items")
          .select("id,name,category,price")
          .eq("canteen_id", canteenId)
          .order("name")
          .range(offset, offset + PAGE_SIZE - 1);
        if (queryError) throw queryError;
        const page = (data ?? []) as MenuRow[];
        allMenu.push(...page);
        if (page.length < PAGE_SIZE) break;
      }
      setOrders(Array.from(new Map(allOrders.map((order) => [order.id, order])).values()));
      setMenu(allMenu);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load canteen analytics.");
    } finally {
      setLoading(false);
    }
  }, [canteenId]);

  useEffect(() => {
    void loadData();
    const channel = supabase
      .channel(`analytics-${canteenId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `canteen_id=eq.${canteenId}` },
        () => {
          void loadData();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "menu_items", filter: `canteen_id=eq.${canteenId}` },
        () => {
          void loadData();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [canteenId, loadData]);

  const { start, end } = useMemo(
    () => rangeFor(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );
  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const time = new Date(order.created_at).getTime();
        return time >= start.getTime() && time < end.getTime();
      }),
    [orders, start, end],
  );
  const revenueOrders = useMemo(
    () => filteredOrders.filter((order) => orderRevenue(order) > 0),
    [filteredOrders],
  );
  const revenue = useMemo(
    () => revenueOrders.reduce((sum, order) => sum + orderRevenue(order), 0),
    [revenueOrders],
  );
  const todayOrders = useMemo(() => {
    const today = new Date();
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    return orders.filter(
      (order) =>
        new Date(order.created_at).getTime() >= dayStart &&
        new Date(order.created_at).getTime() < dayStart + 86_400_000,
    );
  }, [orders]);
  const todayRevenue = useMemo(
    () => todayOrders.reduce((sum, order) => sum + orderRevenue(order), 0),
    [todayOrders],
  );

  const { itemRows, categoryRows } = useMemo(() => {
    const menuById = new Map(menu.map((item) => [item.id, item]));
    const items = new Map<
      string,
      { id: string; name: string; category: string; quantity: number; revenue: number }
    >();
    for (const item of menu)
      items.set(item.id, {
        id: item.id,
        name: item.name,
        category: item.category || "Uncategorized",
        quantity: 0,
        revenue: 0,
      });
    const categories = new Map<string, { revenue: number; quantity: number }>();
    for (const order of revenueOrders) {
      const lines = (Array.isArray(order.lines) ? order.lines : []).filter(
        (line) => line && Number(line.qty) > 0,
      );
      const gross = lines.reduce(
        (sum, line) => sum + Math.max(0, Number(line.price) || 0) * Number(line.qty),
        0,
      );
      for (const line of lines) {
        const id = line.id || `${line.name}`;
        const menuItem = line.id ? menuById.get(line.id) : undefined;
        const category = menuItem?.category || "Uncategorized";
        const lineGross = Math.max(0, Number(line.price) || 0) * Number(line.qty);
        const allocatedDiscount =
          gross > 0 ? ((Number(order.discount) || 0) * lineGross) / gross : 0;
        const lineRevenue = Math.max(0, lineGross - allocatedDiscount);
        const item = items.get(id) ?? {
          id,
          name: line.name || "Unnamed item",
          category,
          quantity: 0,
          revenue: 0,
        };
        item.quantity += Number(line.qty);
        item.revenue += lineRevenue;
        items.set(id, item);
        const categoryTotal = categories.get(category) ?? { revenue: 0, quantity: 0 };
        categoryTotal.revenue += lineRevenue;
        categoryTotal.quantity += Number(line.qty);
        categories.set(category, categoryTotal);
      }
    }
    const itemRows = [...items.values()].sort(
      (a, b) => b.quantity - a.quantity || b.revenue - a.revenue || a.name.localeCompare(b.name),
    );
    const categoryRows = [...categories.entries()]
      .map(([name, totals]) => ({ name, ...totals }))
      .sort((a, b) => b.revenue - a.revenue);
    return { itemRows, categoryRows };
  }, [menu, revenueOrders]);

  const trendRows = useMemo(() => {
    const grouped = new Map<
      string,
      { key: string; label: string; revenue: number; orders: number }
    >();
    for (const order of filteredOrders) {
      const key = keyForDate(new Date(order.created_at), grain);
      const row = grouped.get(key) ?? {
        key,
        label: displayBucket(key, grain),
        revenue: 0,
        orders: 0,
      };
      row.orders += order.status === "cancelled" || order.payment_status === "failed" ? 0 : 1;
      row.revenue += orderRevenue(order);
      grouped.set(key, row);
    }
    return [...grouped.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [filteredOrders, grain]);
  const dailyRows = useMemo(() => {
    const grouped = new Map<string, { key: string; orders: number; revenue: number }>();
    for (const order of filteredOrders) {
      const key = dateInput(new Date(order.created_at));
      const row = grouped.get(key) ?? { key, orders: 0, revenue: 0 };
      row.orders += order.status === "cancelled" || order.payment_status === "failed" ? 0 : 1;
      row.revenue += orderRevenue(order);
      grouped.set(key, row);
    }
    return [...grouped.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [filteredOrders]);
  const monthlyRows = useMemo(() => {
    const grouped = new Map<string, { key: string; orders: number; revenue: number }>();
    for (const order of filteredOrders) {
      const key = keyForDate(new Date(order.created_at), "monthly");
      const row = grouped.get(key) ?? { key, orders: 0, revenue: 0 };
      row.orders += order.status === "cancelled" || order.payment_status === "failed" ? 0 : 1;
      row.revenue += orderRevenue(order);
      grouped.set(key, row);
    }
    return [...grouped.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [filteredOrders]);
  const hourRows = useMemo(
    () =>
      Array.from({ length: 24 }, (_, hour) => ({
        hour: `${String(hour).padStart(2, "0")}:00`,
        orders: 0,
      })).map((row, hour) => ({
        ...row,
        orders: filteredOrders.filter(
          (order) =>
            order.status !== "cancelled" &&
            order.status !== "pending_payment" &&
            order.payment_status !== "failed" &&
            new Date(order.created_at).getHours() === hour,
        ).length,
      })),
    [filteredOrders],
  );
  const paymentRows = useMemo(() => {
    const counts = { Paid: 0, Pending: 0, Failed: 0 };
    for (const order of filteredOrders) {
      if (order.payment_status === "paid") counts.Paid++;
      else if (order.payment_status === "failed") counts.Failed++;
      else if (["pending", "unpaid", "refund_pending"].includes(order.payment_status))
        counts.Pending++;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0);
  }, [filteredOrders]);
  const monthComparison = useMemo(() => {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const previousStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const previousEnd = new Date(previousStart);
    previousEnd.setDate(
      Math.min(today.getDate(), new Date(today.getFullYear(), today.getMonth(), 0).getDate()),
    );
    previousEnd.setHours(
      today.getHours(),
      today.getMinutes(),
      today.getSeconds(),
      today.getMilliseconds(),
    );
    const sum = (from: Date, to: Date) =>
      orders.reduce((total, order) => {
        const time = new Date(order.created_at).getTime();
        return total + (time >= from.getTime() && time < to.getTime() ? orderRevenue(order) : 0);
      }, 0);
    const current = sum(monthStart, new Date());
    const previous = sum(previousStart, previousEnd);
    const growth = previous > 0 ? ((current - previous) / previous) * 100 : null;
    return { current, previous, growth };
  }, [orders]);

  const searchedItems = useMemo(
    () =>
      itemRows.filter((item) => item.name.toLowerCase().includes(itemSearch.trim().toLowerCase())),
    [itemRows, itemSearch],
  );
  const best = itemRows.filter((item) => item.quantity > 0).slice(0, 5);
  const least = itemRows
    .filter((item) => item.quantity > 0)
    .slice()
    .sort((a, b) => a.quantity - b.quantity || a.revenue - b.revenue)
    .slice(0, 5);
  const mostPopularCategory = categoryRows.slice().sort((a, b) => b.quantity - a.quantity)[0];
  const zeroSales = itemRows.filter((item) => item.quantity === 0);
  const completed = filteredOrders.filter((order) => order.status === "collected").length;
  const cancelled = filteredOrders.filter((order) => order.status === "cancelled").length;
  const pending = filteredOrders.filter((order) =>
    ["pending_payment", "placed", "preparing", "ready"].includes(order.status),
  ).length;
  const average = revenueOrders.length ? revenue / revenueOrders.length : 0;
  const currency = (value: number) => money(value);

  function downloadExcel() {
    setExportError("");
    setReportMenu(false);
    try {
      const round = (value: number) => Math.round(value * 100) / 100;
      const workbook = buildXlsx([
        {
          name: "ONLINE Summary",
          widths: [42, 28],
          rows: [
            ["HUNGRY Z ONLINE Canteen Analytics", ""],
            ["Canteen", canteenName],
            [
              "Period",
              `${start.toLocaleDateString()} – ${new Date(end.getTime() - 1).toLocaleDateString()}`,
            ],
            [],
            ["Metric", "Value"],
            ["ONLINE Total Orders", filteredOrders.length],
            ["ONLINE Revenue (paid, excluding cancelled/refunded)", round(revenue)],
            ["ONLINE Today's Orders", todayOrders.length],
            ["ONLINE Today's Revenue", round(todayRevenue)],
            ["ONLINE Average Order Value", round(average)],
            ["ONLINE Completed Orders", completed],
            ["ONLINE Cancelled Orders", cancelled],
            ["ONLINE Pending Orders", pending],
            ["ONLINE This Month Revenue to Date", round(monthComparison.current)],
            ["ONLINE Previous Month Revenue (same period)", round(monthComparison.previous)],
            [
              "Month Growth %",
              monthComparison.growth === null ? "N/A" : round(monthComparison.growth),
            ],
          ],
        },
        {
          name: "ONLINE Food Items",
          widths: [34, 22, 16, 20, 16],
          filter: true,
          rows: [
            ["Item", "Category", "Quantity Sold", "Net Revenue (₹)", "Sales Status"],
            ...itemRows.map((item) => [
              item.name,
              item.category,
              item.quantity,
              round(item.revenue),
              item.quantity ? "Sold" : "Zero sales",
            ]),
            [
              "TOTAL",
              "",
              itemRows.reduce((sum, item) => sum + item.quantity, 0),
              round(itemRows.reduce((sum, item) => sum + item.revenue, 0)),
              "",
            ],
          ],
        },
        {
          name: "ONLINE Best & Least",
          widths: [14, 34, 18, 20],
          filter: true,
          rows: [
            ["Ranking", "Item", "Quantity Sold", "Net Revenue (₹)"],
            ...best.map((item, index) => [
              `Best ${index + 1}`,
              item.name,
              item.quantity,
              round(item.revenue),
            ]),
            ...least.map((item, index) => [
              `Least ${index + 1}`,
              item.name,
              item.quantity,
              round(item.revenue),
            ]),
          ],
        },
        {
          name: "ONLINE Categories",
          widths: [28, 16, 20],
          filter: true,
          rows: [
            ["Category", "Quantity Sold", "Net Revenue (₹)"],
            ...categoryRows.map((row) => [row.name, row.quantity, round(row.revenue)]),
            [
              "TOTAL",
              categoryRows.reduce((sum, row) => sum + row.quantity, 0),
              round(categoryRows.reduce((sum, row) => sum + row.revenue, 0)),
            ],
          ],
        },
        {
          name: "ONLINE Daily",
          widths: [16, 14, 20],
          filter: true,
          rows: [
            ["Date", "Orders", "Net Revenue (₹)"],
            ...dailyRows.map((row) => [row.key, row.orders, round(row.revenue)]),
            [
              "TOTAL",
              dailyRows.reduce((sum, row) => sum + row.orders, 0),
              round(dailyRows.reduce((sum, row) => sum + row.revenue, 0)),
            ],
          ],
        },
        {
          name: "ONLINE Monthly",
          widths: [16, 14, 20],
          filter: true,
          rows: [
            ["Month", "Orders", "Net Revenue (₹)"],
            ...monthlyRows.map((row) => [row.key, row.orders, round(row.revenue)]),
            [
              "TOTAL",
              monthlyRows.reduce((sum, row) => sum + row.orders, 0),
              round(monthlyRows.reduce((sum, row) => sum + row.revenue, 0)),
            ],
          ],
        },
        {
          name: "ONLINE Payments",
          widths: [18, 14],
          filter: true,
          rows: [
            ["Payment", "Orders"],
            ...paymentRows.map((row) => [row.name, row.value]),
            ["TOTAL", paymentRows.reduce((sum, row) => sum + row.value, 0)],
          ],
        },
        {
          name: "ONLINE Orders",
          widths: [18, 24, 16, 16, 20, 23, 60],
          filter: true,
          rows: [
            [
              "Order ID",
              "Order Date",
              "Status",
              "Payment",
              "Order Total (₹)",
              "Recognized Revenue (₹)",
              "Items",
            ],
            ...filteredOrders.map((order) => [
              order.order_number,
              new Date(order.created_at).toLocaleString(),
              order.status,
              order.payment_status,
              Number(order.total),
              orderRevenue(order),
              (order.lines ?? []).map((line) => `${line.qty} × ${line.name}`).join(", "),
            ]),
            [
              "TOTAL",
              "",
              "",
              "",
              filteredOrders.reduce((sum, order) => sum + Number(order.total), 0),
              round(revenue),
              "",
            ],
          ],
        },
      ]);
      const url = URL.createObjectURL(workbook);
      const link = document.createElement("a");
      link.href = url;
      link.download = `HUNGRY-Z-${canteenName.replace(/[^a-z0-9]+/gi, "-")}-ONLINE-analytics.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      setExportError("Could not create the Excel report. Please try again.");
    }
  }

  function downloadPdf() {
    setReportMenu(false);
    setExportError("");
    const period = `${start.toLocaleDateString()} - ${new Date(end.getTime() - 1).toLocaleDateString()}`;
    try {
      const lines = [
        "HUNGRY Z | ONLINE ANALYTICS REPORT",
        canteenName,
        `Report period: ${period}`,
        "",
        `Total online orders: ${filteredOrders.length}`,
        `Paid online revenue: INR ${Math.round(revenue)}`,
        `Average order value: INR ${Math.round(average)}`,
        `Completed / cancelled / pending: ${completed} / ${cancelled} / ${pending}`,
        "",
        "DAILY PERFORMANCE",
        ...dailyRows.map((row) => `${row.key} | ${row.orders} orders | INR ${Math.round(row.revenue)}`),
        "",
        "PAYMENT BREAKDOWN",
        ...paymentRows.map((row) => `${row.name}: ${row.value}`),
        "",
        "ONLINE ORDER DETAILS",
        ...filteredOrders.map((order) => `${order.order_number} | ${new Date(order.created_at).toLocaleString()} | ${order.status} | ${order.payment_status} | INR ${Number(order.total)} | ${(order.lines ?? []).map((line) => `${line.qty} x ${line.name}`).join(", ")}`),
        "",
        "Revenue includes paid orders only and excludes cancelled orders.",
      ];
      const url = URL.createObjectURL(buildSimplePdf(lines));
      const link = document.createElement("a");
      link.href = url;
      link.download = `HUNGRY-Z-${canteenName.replace(/[^a-z0-9]+/gi, "-")}-ONLINE-analytics.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      setExportError("Could not create the PDF report. Please try again.");
    }
  }
  const cardClass = "rounded-3xl border border-border bg-card p-4 sm:p-5";
  if (loading)
    return (
      <div className="glass-red mt-6 rounded-3xl p-8 text-center text-sm text-muted-foreground">
        Loading canteen analytics…
      </div>
    );
  if (error)
    return (
      <div className="glass-red mt-6 rounded-3xl p-6">
        <p role="alert" className="text-sm text-primary-bright">
          Could not load analytics: {error}
        </p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void loadData();
          }}
          className="mt-3 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          Try again
        </button>
      </div>
    );

  return (
    <section className="mt-6 space-y-5" aria-label="Canteen analytics">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-primary-bright">
            ONLINE BUSINESS INSIGHTS
          </p>
          <h2 className="display mt-1 text-2xl">ONLINE Analytics</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            ONLINE orders for {canteenName}. ONLINE revenue includes paid orders only.
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setReportMenu((open) => !open)}
            aria-expanded={reportMenu}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground"
          >
            <Download className="h-4 w-4" /> Download Report
          </button>
          {reportMenu && (
            <div className="absolute right-0 z-20 mt-2 w-52 rounded-2xl border border-border bg-card p-2 shadow-xl">
              <button
                type="button"
                onClick={downloadExcel}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs hover:bg-muted"
              >
                <FileSpreadsheet className="h-4 w-4 text-chart-4" /> Download Excel (.xlsx)
              </button>
              <button
                type="button"
                onClick={downloadPdf}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs hover:bg-muted"
              >
                <FileText className="h-4 w-4 text-primary-bright" /> Download PDF (.pdf)
              </button>
            </div>
          )}
        </div>
        {exportError && (
          <p role="status" className="w-full text-right text-xs text-primary-bright">
            {exportError}
          </p>
        )}
      </header>

      <section className={`${cardClass} grid gap-3`} aria-label="Analytics date filters">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["today", "Today"],
              ["yesterday", "Yesterday"],
              ["7days", "Last 7 Days"],
              ["30days", "Last 30 Days"],
              ["month", "This Month"],
              ["custom", "Custom Range"],
            ] as [Preset, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPreset(key)}
              className={cn(
                "rounded-full border px-3 py-2 text-[11px] font-semibold transition",
                preset === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="grid gap-1">
              From
              <input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(event) => setCustomFrom(event.target.value)}
                className="rounded-xl border border-input bg-ink-soft px-3 py-2"
              />
            </label>
            <label className="grid gap-1">
              To
              <input
                type="date"
                value={customTo}
                min={customFrom}
                onChange={(event) => setCustomTo(event.target.value)}
                className="rounded-xl border border-input bg-ink-soft px-3 py-2"
              />
            </label>
          </div>
        )}
      </section>

      {!filteredOrders.length && (
        <div className={`${cardClass} py-10 text-center`}>
          <p className="display text-xl">No sales for this period yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Try a wider date range. New orders update this dashboard automatically.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["ONLINE · Total orders", filteredOrders.length.toLocaleString("en-IN")],
          ["ONLINE · Revenue", currency(revenue)],
          ["ONLINE · Today's orders", todayOrders.length.toLocaleString("en-IN")],
          ["ONLINE · Today's revenue", currency(todayRevenue)],
          ["ONLINE · Average order value", currency(average)],
          ["ONLINE · Completed orders", completed.toLocaleString("en-IN")],
          ["ONLINE · Cancelled orders", cancelled.toLocaleString("en-IN")],
          ["ONLINE · Pending orders", pending.toLocaleString("en-IN")],
        ].map(([label, value]) => (
          <article key={label} className={`${cardClass} min-w-0`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className="display mt-2 truncate text-xl sm:text-2xl">{value}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <article className={cardClass}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
          <h3 className="display text-lg">ONLINE Revenue & Orders</h3>
              <p className="mt-1 text-[11px] text-muted-foreground">Grouped by selected interval</p>
            </div>
            <div className="flex gap-1">
              {(["daily", "weekly", "monthly"] as Grain[]).map((unit) => (
                <button
                  type="button"
                  key={unit}
                  onClick={() => setGrain(unit)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[10px] font-semibold capitalize",
                    grain === unit
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {unit}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 h-64">
            <TrendChart data={trendRows} />
          </div>
        </article>
        <article className={cardClass}>
          <h3 className="display text-lg">ONLINE Revenue by Category</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {mostPopularCategory
              ? `Most popular: ${mostPopularCategory.name} (${mostPopularCategory.quantity} items sold)`
              : "No paid item sales in this period."}{" "}
            · Revenue uses current menu categories.
          </p>
          <div className="mt-5 space-y-4">
            {categoryRows.length ? (
              categoryRows
                .slice()
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 8)
                .map((row, index, visible) => (
                  <div
                    key={row.name}
                    className="grid grid-cols-[95px_1fr_auto] items-center gap-2 text-[11px]"
                  >
                    <span className="truncate text-muted-foreground">{row.name}</span>
                    <div className="h-3 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(1, (row.revenue / (visible[0]?.revenue || 1)) * 100)}%`,
                          background:
                            CHART_COLORS[index % CHART_COLORS.length],
                        }}
                      />
                    </div>
                    <b>{currency(row.revenue)}</b>
                  </div>
                ))
            ) : (
              <p className="py-12 text-center text-xs text-muted-foreground">
                No paid food sales in this period.
              </p>
            )}
          </div>
        </article>
        <article className={cardClass}>
          <h3 className="display text-lg">ONLINE Peak Ordering Hours</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Local time · excludes cancelled and failed orders
          </p>
          <div className="mt-4 h-56">
            <svg
              viewBox="0 0 710 230"
              className="h-full w-full"
              role="img"
              aria-label="Orders by hour of day"
            >
              {[0, 1, 2, 3].map((tick) => (
                <line
                  key={tick}
                  x1="35"
                  x2="690"
                  y1={30 + tick * 48}
                  y2={30 + tick * 48}
                  stroke="var(--border)"
                  strokeDasharray="4 4"
                />
              ))}
              <polyline
                points={hourRows
                  .map(
                    (row, index) =>
                      `${42 + index * (640 / 23)},${170 - (row.orders / Math.max(1, ...hourRows.map((item) => item.orders))) * 130}`,
                  )
                  .join(" ")}
                fill="none"
                stroke="var(--chart-1)"
                strokeWidth="3"
              />
              {hourRows.map((row, index) => (
                <g key={row.hour}>
                  <circle
                    cx={42 + index * (640 / 23)}
                    cy={
                      170 - (row.orders / Math.max(1, ...hourRows.map((item) => item.orders))) * 130
                    }
                    r="3.5"
                    fill="var(--chart-1)"
                  >
                    <title>
                      {row.hour}: {row.orders} orders
                    </title>
                  </circle>
                  {index % 3 === 0 && (
                    <text
                      x={42 + index * (640 / 23)}
                      y="200"
                      fill="var(--muted-foreground)"
                      fontSize="9"
                      textAnchor="middle"
                    >
                      {row.hour}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>
        </article>
        <article className={cardClass}>
          <h3 className="display text-lg">ONLINE Payment Breakdown</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Paid, unpaid/pending and failed orders
          </p>
          <div className="mt-5 space-y-4">
            {paymentRows.length ? (
              paymentRows.map((row) => {
                const totalPayments = paymentRows.reduce((sum, item) => sum + item.value, 0);
                const color =
                  row.name === "Paid" ? "var(--chart-2)" : row.name === "Pending" ? "var(--chart-4)" : "var(--chart-5)";
                return (
                  <div key={row.name}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span>{row.name}</span>
                      <b>
                        {row.value}{" "}
                        <span className="font-normal text-muted-foreground">
                          ({Math.round((row.value / totalPayments) * 100)}%)
                        </span>
                      </b>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(row.value / totalPayments) * 100}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="py-12 text-center text-xs text-muted-foreground">
                No payment records for this period.
              </p>
            )}
          </div>
        </article>
      </div>

      <section className={`${cardClass} grid gap-4 md:grid-cols-3`}>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            ONLINE This Month Revenue
          </p>
          <p className="display mt-2 text-2xl">{currency(monthComparison.current)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            ONLINE Previous Month (same period)
          </p>
          <p className="display mt-2 text-2xl">{currency(monthComparison.previous)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            ONLINE Revenue Growth
          </p>
          <p className="display mt-2 text-2xl">
            {monthComparison.growth === null
              ? "—"
              : `${monthComparison.growth > 0 ? "+" : ""}${monthComparison.growth.toFixed(1)}%`}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Like-for-like month-to-date paid orders. No reliable preparation completion timestamp is
            recorded for average prep time.
          </p>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {[
          { title: "ONLINE Top 5 Best-Selling Food Items", rows: best },
          { title: "ONLINE Top 5 Least-Selling Food Items", rows: least },
        ].map(({ title, rows }) => (
          <article key={title} className={cardClass}>
            <h3 className="display text-lg">{title}</h3>
            {rows.length ? (
              <div className="mt-3 divide-y divide-border">
                {rows.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-3 py-3">
                    <span className="grid h-7 w-7 shrink-0 place-content-center rounded-full bg-primary/15 text-xs font-bold text-primary-bright">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {item.category} · {currency(item.revenue)}
                      </p>
                    </div>
                    <b className="text-sm">{item.quantity} sold</b>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                No paid item sales in the selected period.
              </p>
            )}
          </article>
        ))}
      </div>

      <article className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="display text-lg">ONLINE Food Item Sales</h3>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Quantities and revenue from paid orders in the selected period
            </p>
          </div>
          <label className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={itemSearch}
              onChange={(event) => setItemSearch(event.target.value)}
              placeholder="Search food items"
              className="w-56 rounded-full border border-input bg-ink-soft py-2 pl-9 pr-3 text-xs outline-none focus:border-primary"
            />
          </label>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[540px] text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="pb-2">Item</th>
                <th className="pb-2">Category</th>
                <th className="pb-2 text-right">Quantity</th>
                <th className="pb-2 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {searchedItems.map((item) => (
                <tr key={item.id}>
                  <td className="py-2.5 font-semibold">{item.name}</td>
                  <td className="py-2.5 text-muted-foreground">{item.category}</td>
                  <td className="py-2.5 text-right">{item.quantity}</td>
                  <td className="py-2.5 text-right">{currency(item.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!searchedItems.length && (
            <p className="py-5 text-center text-xs text-muted-foreground">
              No matching food items.
            </p>
          )}
        </div>
      </article>

      <article className={cardClass}>
        <h3 className="display text-lg">ONLINE Items with Zero Sales</h3>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Menu items with no paid quantity in this period
        </p>
        <p className="mt-3 text-sm">
          {zeroSales.length
            ? zeroSales.map((item) => item.name).join(" · ")
            : "Every current menu item has recorded sales."}
        </p>
      </article>
    </section>
  );
}
