import { Download, ReceiptText } from "lucide-react";

type Sale = {
  id: string;
  createdAt: string;
  lines: { name: string; qty: number; price: number }[];
  subtotal: number;
  total: number;
  paymentMethod: "cash" | "upi" | "card";
  paymentStatus: "paid" | "unpaid";
};

const money = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

export function OfflinePOSAnalytics({ sales }: { sales: Sale[] }) {
  const bills = sales.length;
  const billedSales = sales.reduce((sum, sale) => sum + sale.total, 0);
  const paidSales = sales.filter((sale) => sale.paymentStatus === "paid");
  const revenue = paidSales.reduce((sum, sale) => sum + sale.total, 0);
  const outstanding = sales.filter((sale) => sale.paymentStatus === "unpaid").reduce((sum, sale) => sum + sale.total, 0);
  const methods = (["cash", "upi", "card"] as const).map((method) => {
    const rows = paidSales.filter((sale) => sale.paymentMethod === method);
    return { method, count: rows.length, amount: rows.reduce((sum, sale) => sum + sale.total, 0) };
  });

  function downloadReport() {
    const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["OFFLINE POS Report", ""],
      ["OFFLINE Bill Count", bills],
      ["OFFLINE Billed Sales", billedSales],
      ["OFFLINE Collected Revenue", revenue],
      ["OFFLINE Outstanding", outstanding],
      ["OFFLINE Cash Paid Bills", methods.find((row) => row.method === "cash")?.count ?? 0],
      ["OFFLINE Cash Paid Amount", methods.find((row) => row.method === "cash")?.amount ?? 0],
      ["OFFLINE UPI Paid Bills", methods.find((row) => row.method === "upi")?.count ?? 0],
      ["OFFLINE UPI Paid Amount", methods.find((row) => row.method === "upi")?.amount ?? 0],
      ["OFFLINE Card Paid Bills", methods.find((row) => row.method === "card")?.count ?? 0],
      ["OFFLINE Card Paid Amount", methods.find((row) => row.method === "card")?.amount ?? 0],
      [],
      ["OFFLINE Bill ID", "OFFLINE Date", "OFFLINE Items", "OFFLINE Total", "OFFLINE Payment Method", "OFFLINE Payment Status"],
      ...sales.map((sale) => [sale.id, new Date(sale.createdAt).toLocaleString(), sale.lines.map((line) => `${line.qty} x ${line.name}`).join(", "), sale.total, sale.paymentMethod.toUpperCase(), sale.paymentStatus.toUpperCase()]),
    ];
    const csv = rows.map((row) => row.map(quote).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "HUNGRY-Z-OFFLINE-POS-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const cards = [
    ["OFFLINE · Bill count", bills.toLocaleString("en-IN")],
    ["OFFLINE · Billed sales", money(billedSales)],
    ["OFFLINE · Collected revenue", money(revenue)],
    ["OFFLINE · Outstanding", money(outstanding)],
  ];

  return (
    <section className="mt-5 space-y-4" aria-label="OFFLINE POS analytics">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-3xl border border-border bg-card p-4 sm:p-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">OFFLINE POS REPORT</p>
          <h2 className="display mt-1 text-2xl">Counter analytics</h2>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">Only confirmed OFFLINE POS bills from this browser are shown. Paid bills count as collected revenue; unpaid bills remain outstanding.</p>
        </div>
        <button type="button" onClick={downloadReport} disabled={!sales.length} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-40"><Download className="h-4 w-4" /> Export OFFLINE report</button>
      </header>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map(([label, value]) => <article key={label} className="min-w-0 rounded-3xl border border-border bg-card p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="display mt-2 truncate text-xl sm:text-2xl">{value}</p></article>)}
      </div>

      <section className="rounded-3xl border border-border bg-card p-4 sm:p-5" aria-label="OFFLINE payment statistics">
        <h3 className="display text-lg">OFFLINE payment statistics</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {methods.map((row) => <article key={row.method} className="rounded-2xl bg-ink-soft p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">OFFLINE {row.method} · paid</p><p className="mt-1 text-sm font-bold">{row.count} bills · {money(row.amount)}</p></article>)}
          <article className="rounded-2xl bg-ink-soft p-3 sm:col-span-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">OFFLINE unpaid bills</p><p className="mt-1 text-sm font-bold">{sales.filter((sale) => sale.paymentStatus === "unpaid").length} bills · {money(outstanding)} due</p></article>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-4 sm:p-5" aria-label="OFFLINE bill history">
        <div className="flex items-center gap-2"><ReceiptText className="h-4 w-4 text-primary" /><h3 className="display text-lg">OFFLINE bill history</h3></div>
        {sales.length ? <div className="mt-3 space-y-3">{sales.map((sale) => <article key={sale.id} className="rounded-2xl border border-border bg-background p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-mono text-xs font-bold">{sale.id} <span className="ml-1 rounded-full bg-primary/10 px-2 py-1 text-[9px] font-black tracking-wider text-primary">OFFLINE</span></p><p className="mt-1 text-[11px] text-muted-foreground">{new Date(sale.createdAt).toLocaleString()}</p></div><div className="text-right"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">OFFLINE total</p><p className="text-lg font-black tabular-nums">{money(sale.total)}</p></div></div>
          <div className="mt-3 space-y-1 border-t border-border pt-3">{sale.lines.map((line, index) => <div key={`${sale.id}-${index}`} className="flex justify-between gap-3 text-xs"><span className="min-w-0 truncate">{line.qty} × {line.name}</span><span className="shrink-0 tabular-nums">{money(line.qty * line.price)}</span></div>)}</div>
          <div className="mt-3 flex flex-wrap justify-between gap-2 text-[10px] font-bold uppercase tracking-wider"><span>OFFLINE {sale.paymentMethod} · {sale.paymentStatus}</span>{sale.paymentStatus === "unpaid" ? <span>OFFLINE amount due {money(sale.total)}</span> : <span>OFFLINE collected {money(sale.total)}</span>}</div>
        </article>)}</div> : <div className="mt-3 rounded-2xl border border-dashed border-border px-4 py-10 text-center"><ReceiptText className="mx-auto h-6 w-6 text-muted-foreground" /><p className="mt-2 text-sm font-bold">No confirmed OFFLINE POS bills</p><p className="mt-1 text-xs text-muted-foreground">Confirmed counter bills will appear here. These records stay in this browser.</p></div>}
      </section>
    </section>
  );
}
