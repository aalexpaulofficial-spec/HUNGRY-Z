import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Star, X } from "lucide-react";
import { submitSupportRequest } from "@/lib/hungry.functions";
import { useModalDismiss } from "@/lib/use-modal-dismiss";

const SUPPORT_EMAIL = "hungryofficialx@gmail.com";
const REPORT_CATEGORIES = ["Feedback", "Report an issue", "Order issue", "Payment issue", "Other"] as const;
const CANTEEN_CATEGORIES = ["Feedback", "Order issue", "Payment issue", "Operational issue", "Other"] as const;
type ReportCategory = (typeof REPORT_CATEGORIES)[number] | "Operational issue";

function createSubmissionUuid() {
  if (typeof window.crypto?.randomUUID === "function") return window.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof window.crypto?.getRandomValues === "function") window.crypto.getRandomValues(bytes);
  else bytes.forEach((_, index) => { bytes[index] = Math.floor(Math.random() * 256); });
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("").replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
}

type FeedbackDialogProps = {
  mode: "rate" | "student-report" | "canteen-report";
  onClose: () => void;
};

export function FeedbackDialog({ mode, onClose }: FeedbackDialogProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [orderId, setOrderId] = useState("");
  const [category, setCategory] = useState<ReportCategory>(mode === "canteen-report" ? "Order issue" : "Feedback");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmationWarning, setConfirmationWarning] = useState(false);
  const submissionId = useRef<string | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const close = useModalDismiss(onClose);
  const sendSupport = useServerFn(submitSupportRequest);
  const title = mode === "rate" ? "Rate HUNGRY" : mode === "canteen-report" ? "Canteen Feedback & Report" : "Feedback & Report";

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !sending) close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [close, sending]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "rate" && rating === 0) return setError("Choose a rating before sending.");
    if (comment.trim().length < 3) return setError("Please add a few details before sending.");
    setSending(true);
    setError("");
    submissionId.current ??= createSubmissionUuid();
    try {
      const result = await sendSupport({ data: {
        submissionId: submissionId.current,
        category: mode === "rate" ? "Rate Us" : category,
        description: comment.trim(),
        orderId: orderId.trim(),
        ...(mode === "rate" ? { rating } : {}),
      } });
      setConfirmationWarning(!result.confirmationSent);
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send this request. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-background/85 px-4 py-6 backdrop-blur-md" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !sending) close(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="feedback-dialog-title" className="glass-red max-h-[calc(100dvh-3rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-[2rem] p-6 shadow-[var(--shadow-cinema)] sm:p-8">
      <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary-bright">HUNGRY SUPPORT</p><h2 id="feedback-dialog-title" className="display mt-2 text-2xl">{title}</h2></div><button ref={closeButton} type="button" onClick={close} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button></div>
      {sent ? <div className="mt-6 space-y-4 text-sm"><p>Your request was emailed to <a className="font-semibold text-primary-bright underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>{confirmationWarning && <p role="status" className="text-xs text-amber-300">We could not send your confirmation email. Your support request was delivered.</p>}<p className="text-xs text-muted-foreground">For payment issues, include your Order ID and payment reference in any follow-up. Never email passwords, OTPs or full card details.</p><button type="button" onClick={close} className="rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground">Done</button></div> : <form onSubmit={submit} className="mt-5 space-y-4">
        {mode === "rate" ? <fieldset><legend className="text-xs font-semibold">Your rating</legend><div className="mt-2 flex gap-2">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" aria-label={`${value} star${value === 1 ? "" : "s"}`} aria-pressed={rating === value} onClick={() => setRating(value)} className="rounded-lg p-1 text-primary-bright"><Star className="h-7 w-7" fill={value <= rating ? "currentColor" : "none"} /></button>)}</div></fieldset> : <label className="grid gap-1.5 text-xs font-semibold">What is this about?<select value={category} onChange={(event) => setCategory(event.target.value as ReportCategory)} className="rounded-2xl border border-input bg-ink-soft px-4 py-3 text-sm font-normal outline-none focus:border-primary">{(mode === "canteen-report" ? CANTEEN_CATEGORIES : REPORT_CATEGORIES).map((value) => <option key={value}>{value}</option>)}</select></label>}
        {mode !== "rate" && <label className="grid gap-1.5 text-xs font-semibold">Order ID <span className="font-normal text-muted-foreground">(optional; recommended for order or payment issues)</span><input value={orderId} onChange={(event) => setOrderId(event.target.value.slice(0, 80))} maxLength={80} className="rounded-2xl border border-input bg-ink-soft px-4 py-3 text-sm font-normal outline-none focus:border-primary" /></label>}
        <label className="grid gap-1.5 text-xs font-semibold">{mode === "rate" ? "Comments" : "Details"}<textarea required minLength={3} maxLength={2000} rows={5} value={comment} onChange={(event) => setComment(event.target.value)} placeholder={mode === "rate" ? "What worked well? What could be better?" : "Describe what happened. For payment issues, include your payment reference."} className="rounded-2xl border border-input bg-ink-soft px-4 py-3 text-sm font-normal outline-none focus:border-primary" /></label>
        {error && <p role="alert" className="text-xs text-primary-bright">{error}</p>}
        <p className="text-[11px] leading-relaxed text-muted-foreground">Submit emails this request directly to <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary-bright underline">{SUPPORT_EMAIL}</a> and sends a confirmation when your email address is available. Never include passwords, OTPs or full card details.</p>
        <div className="flex flex-wrap gap-2"><button type="submit" disabled={sending} className="rounded-full bg-primary px-5 py-3 text-xs font-semibold text-primary-foreground disabled:opacity-60">{sending ? "Sending..." : "Send to HUNGRY Support"}</button><button type="button" disabled={sending} onClick={close} className="rounded-full border border-border px-5 py-3 text-xs text-muted-foreground">Cancel</button></div>
      </form>}
    </section>
  </div>;
}
