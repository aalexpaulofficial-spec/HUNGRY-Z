// Razorpay REST client (server-only). Keys are read from backend secrets at call time.
const API = "https://api.razorpay.com/v1";

export class RazorpayError extends Error {
  constructor(public status: number, public body: string) {
    super(`Razorpay request failed [${status}]: ${body.slice(0, 300)}`);
  }
}

export function razorpayKeys() {
  const keyId = (process.env["RAZORPAY_KEY_ID"] ?? "").trim();
  const keySecret = (process.env["RAZORPAY_KEY_SECRET"] ?? "").trim();
  return { keyId, keySecret, configured: Boolean(keyId && keySecret), testMode: keyId.startsWith("rzp_test_") };
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const { keyId, keySecret, configured } = razorpayKeys();
  if (!configured) throw new Error("Online payments aren't configured yet (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).");
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : null,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[razorpay] ${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
    throw new RazorpayError(res.status, text);
  }
  return JSON.parse(text) as T;
}

export type RzpOrder = { id: string; amount: number; currency: string; receipt: string; status: string };
export type RzpPayment = {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method?: string;
  email?: string;
  error_code?: string | null;
  error_description?: string | null;
  amount_refunded?: number;
};
export type RzpRefund = { id: string; payment_id: string; amount: number; status: "pending" | "processed" | "failed" };

export function createRazorpayOrder(p: { amountPaise: number; receipt: string; notes: Record<string, string> }) {
  return call<RzpOrder>("POST", "/orders", { amount: p.amountPaise, currency: "INR", receipt: p.receipt.slice(0, 40), notes: p.notes });
}

export function fetchRazorpayPayment(paymentId: string) {
  return call<RzpPayment>("GET", `/payments/${encodeURIComponent(paymentId)}`);
}

export function captureRazorpayPayment(paymentId: string, amountPaise: number) {
  return call<RzpPayment>("POST", `/payments/${encodeURIComponent(paymentId)}/capture`, { amount: amountPaise, currency: "INR" });
}

export function createRazorpayRefund(paymentId: string, amountPaise: number, notes: Record<string, string>) {
  return call<RzpRefund>("POST", `/payments/${encodeURIComponent(paymentId)}/refund`, { amount: amountPaise, speed: "normal", notes });
}
