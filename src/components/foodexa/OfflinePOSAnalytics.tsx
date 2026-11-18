import { useState } from "react";
import { Download, FileSpreadsheet, FileText, ReceiptText } from "lucide-react";
import { buildSimplePdf } from "@/lib/simple-pdf";
import { buildXlsx } from "@/lib/xlsx";

type Sale = {
  id: string;
  createdAt: string;
  lines: { name: string; qty: number; price: number }[];
  subtotal: number;
  total: number;
  paymentMethod: "cash" | "upi" | "card";
  paymentStatus: "paid" | "unpaid";
};

const money = (value: number) => `?${Math.round(value).toLocaleString("en-IN")}`;
const filenameDate = () => new Date().toISOString().slice(0, 10);

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function OfflinePOSAnalytics({ sales }: { sales: Sale[] }) {
  const [reportMenu, setReportMenu] = useState(false);
  const [exportError, setExportError] = useState("");
  const bills = sales.length;
  const billedSales = sales.reduce((sum, sale) => sum + sale.total, 0);
  const paidSales = sales.filter((sale) => sale.paymentStatus === "paid");
  const revenue = paidSales.reduce((sum, sale) => sum + sale.total, 0);
  const outstanding = sales.filter((sale) => sale.paymentStatus === "unpaid").reduce((sum, sale) => sum + sale.total, 0);
  const methods = (["cash", "upi", "card"] as const).map((method) => {
    const rows = paidSales.filter((sale) => sale.paymentMethod === method);
    return { method, count: rows.length, amount: rows.reduce((sum, sale) => sum + sale.total, 0) };
  });

  function downloadExcel() {
    setReportMenu(false);
    setExportError("");
    try {
      const round = (value: number) => Math.round(value * 100) / 100;
      downloadBlob(buildXlsx([
        {
          name: "OFFLINE Summary",
          widths: [34, 24],
          rows: [
            ["HUNGRY Z OFFLINE POS REPORT", ""],
            ["Generated", new Date().toLocaleString()],
            ["Bill count", bills],
            ["Billed sales", round(billedSales)],
            ["Collected revenue (paid)", round(revenue)],
            ["Outstanding (unpaid)", round(outstanding)],
            ...methods.map((row) => [`${row.method.toUpperCase()} paid bills`, row.count]),
            ...methods.map((row) => [`${row.method.toUpperCase()} paid amount`, round(row.amount)]),
          ],
        },
        {
          name: "OFFLINE Bills",
          widths: [26, 23, 16, 16, 16, 16, 70],
          filter: true,
          rows: [
            ["Bill ID", "Date", "Payment status", "Method", "Subtotal", "Total", "Items"],
            ...sales.map((sale) => [sale.id, new Date(sale.createdAt).toLocaleString(), sale.paymentStatus.toUpperCase(), sale.paymentMethod.toUpperCase(), round(sale.subtotal), round(sale.total), sale.lines.map((line) => `${line.qty} x ${line.name}`).join(", ")]),
            ["TOTAL", "", "", "", round(sales.reduce((sum, sale) => sum + sale.subtotal, 0)), round(billedSales), ""],
          ],
        },
        {
          name: "OFFLINE Items",
          widths: [26, 36, 14, 16, 18],
          filter: true,
          rows: [
            ["Bill ID", "Item", "Quantity", "Unit price", "Line total"],
            ...sales.flatMap((sale) => sale.lines.map((line) => [sale.id, line.name, line.qty, round(line.price), round(line.qty * line.price)])),
          ],
        },
      ]), `HUNGRY-Z-OFFLINE-POS-${filenameDate()}.xlsx`);
    } catch {
      setExportError("Could not create the offline Excel report. Please try again.");
    }
  }

  function downloadPdf() {
    setReportMenu(false);
    setExportError("");
    try {
      const lines = [
        "HUNGRY Z | OFFLINE POS REPORT",
        `Generated: ${new Date().toLocaleString()}`,
        "",
        `Bill count: ${bills}`,
        `Billed sales: INR ${Math.round(billedSales)}`,
        `Collected revenue (paid): INR ${Math.round(revenue)}`,
        `Outstanding (unpaid): INR ${Math.round(outstanding)}`,
        ...methods.map((row) => `${row.method.toUpperCase()} paid: ${row.count} bills | INR ${Math.round(row.amount)}`),
        "",
        "OFFLINE BILL DETAILS",
        ...sales.map((sale) => `${sale.id} | ${new Date(sale.createdAt).toLocaleString()} | ${sale.paymentStatus} | ${sale.paymentMethod} | INR ${sale.total} | ${sale.lines.map((line) => `${line.qty} x ${line.name}`).join(", ")}`),
        "",
        "Collected revenue includes paid POS bills only. Unpaid bills are listed as outstanding.",
      ];
      downloadBlob(buildSimplePdf(lines), `HUNGRY-Z-OFFLINE-POS-${filenameDate()}.pdf`);
    } catch {
      setExportError("Could not create the offline PDF report. Please try again.");
    }
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
        <div className="relative">
          <button type="button" onClick={() => setReportMenu((open) => !open)} aria-expanded={reportMenu} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground"><Download className="h-4 w-4" /> Download Report</button>
          {reportMenu && <div className="absolute right-0 z-20 mt-2 w-56 rounded-2xl border border-border bg-card p-2 shadow-xl">
            <button type="button" onClick={downloadExcel} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs hover:bg-muted"><FileSpreadsheet className="h-4 w-4" /> Download Excel (.xlsx)</button>
            <button type="button" onClick={downloadPdf} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs hover:bg-muted"><FileText className="h-4 w-4" /> Download PDF (.pdf)</button>
          </div>}
        </div>
      </header>
      {exportError && <p role="alert" className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm text-primary">{exportError}</p>}
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
