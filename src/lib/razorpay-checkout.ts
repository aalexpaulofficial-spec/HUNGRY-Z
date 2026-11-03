// Browser-side Razorpay Checkout loader. The result is only a hint — the server
// verifies every payment with Razorpay before an order is confirmed.

export type CheckoutParams = {
  orderId: string;
  orderNumber: string;
  razorpayOrderId: string;
  amount: number;
  currency: "INR";
  keyId: string;
  testMode: boolean;
  prefill: { name: string; email: string };
};

type RazorpaySuccess = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RazorpayFailure = { error?: { description?: string; metadata?: { payment_id?: string; order_id?: string } } };
type RazorpayInstance = { open: () => void; on: (event: "payment.failed", cb: (r: RazorpayFailure) => void) => void };
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let loading: Promise<void> | null = null;
export function loadRazorpay(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Payments run in the browser"));
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load the payment window. Check your connection and try again."));
    };
    document.body.appendChild(s);
  });
  return loading;
}

export async function openRazorpay(
  p: CheckoutParams,
  h: { onSuccess: (r: RazorpaySuccess) => void; onFailed: (paymentId: string | undefined, reason: string) => void; onDismiss: () => void },
) {
  await loadRazorpay();
  const rzp = new window.Razorpay!({
    key: p.keyId,
    amount: p.amount,
    currency: p.currency,
    order_id: p.razorpayOrderId,
    name: "HUNGRY",
    description: `Order ${p.orderNumber}`,
    prefill: { name: p.prefill.name, email: p.prefill.email },
    notes: { hungry_order_id: p.orderId },
    theme: { color: "#d1121b" },
    handler: h.onSuccess,
    modal: { ondismiss: h.onDismiss, confirm_close: true },
  });
  rzp.on("payment.failed", (r) => h.onFailed(r.error?.metadata?.payment_id, r.error?.description ?? "Payment failed"));
  rzp.open();
}
