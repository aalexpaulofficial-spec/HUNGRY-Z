// Client-safe order and payment rules shared by the UI and server code.

export const ORDER_TYPES = ["dine_in", "parcel"] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const PAYMENT_METHODS = ["razorpay", "counter"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  dine_in: "Dine In",
  parcel: "Parcel",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  razorpay: "UPI / Online Payment (Razorpay)",
  counter: "Pay at counter",
};

export function orderPaymentMethodLabel(method: string): string {
  return method === "razorpay" ? "UPI / Online Payment" : "Pay at Counter";
}

export function orderPaymentStatusLabel(status: string): string {
  if (status === "paid") return "Paid";
  if (["unpaid", "pending"].includes(status)) return "Pending";
  if (status === "failed") return "Failed";
  if (status === "refund_pending") return "Refund Pending";
  if (status === "refunded") return "Refunded";
  return "Pending";
}

/** Parcel orders are always paid at the counter; dine-in can pay online or at the counter. */
export function allowedPaymentMethods(orderType: OrderType): PaymentMethod[] {
  return orderType === "parcel" ? ["counter"] : ["razorpay", "counter"];
}

export function isPaymentAllowed(orderType: OrderType, method: PaymentMethod): boolean {
  return allowedPaymentMethods(orderType).includes(method);
}

export function rupeesToPaise(rupees: number): number {
  if (!Number.isInteger(rupees) || rupees < 0) throw new Error("Amount must be a whole number of rupees");
  return rupees * 100;
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "Pay at counter",
  pending: "Awaiting payment",
  paid: "Paid",
  failed: "Payment failed",
  refund_pending: "Refund in progress",
  refunded: "Refunded",
};

export const REFUND_STATUS_LABELS: Record<string, string> = {
  requested: "Refund requested",
  processing: "Refund processing",
  processed: "Refunded",
  rejected: "Refund declined",
  failed: "Refund failed — our team is on it",
};

/** Customers can ask for a refund on online-paid orders that haven't been collected yet. */
export function canRequestRefund(o: { payment_method: string; payment_status: string; status: string }): boolean {
  return o.payment_method === "razorpay" && o.payment_status === "paid" && ["placed", "preparing", "ready"].includes(o.status);
}

/** Kitchen status flow; cancelling is only possible before preparation starts. */
export const OWNER_TRANSITIONS: Record<string, string[]> = {
  placed: ["preparing", "cancelled"],
  preparing: ["ready"],
  ready: ["collected"],
};

export function canOwnerMove(from: string, to: string): boolean {
  return (OWNER_TRANSITIONS[from] ?? []).includes(to);
}

/** Merges duplicate cart lines so each menu item appears once. */
export function mergeLines(lines: { id: string; qty: number }[]): { id: string; qty: number }[] {
  const m = new Map<string, number>();
  for (const l of lines) m.set(l.id, (m.get(l.id) ?? 0) + l.qty);
  return [...m.entries()].map(([id, qty]) => ({ id, qty }));
}

const SQL_ERRORS: Record<string, string> = {
  invalid_order_type: "Choose dine-in or parcel.",
  invalid_payment_method: "Choose a payment method.",
  parcel_counter_only: "Parcel orders are paid at the counter.",
  invalid_cart: "Your cart is empty or too large.",
  invalid_quantity: "Each item can be ordered 1–20 times.",
  canteen_closed: "This canteen isn't accepting orders right now.",
  item_unavailable: "Some items are no longer available. Please review your cart.",
  out_of_stock: "Some items just sold out. Please review your cart.",
  prices_changed: "Prices changed while you were ordering. Please review your cart.",
  coupon_invalid: "This coupon can't be used.",
  coupon_min_order: "Your order doesn't meet this coupon's minimum value.",
  coupon_exhausted: "This coupon has reached its usage limit.",
  coupon_already_used: "You've already used this coupon.",
};

/** Turns a database rule violation ("HUNGRY Z:code") into a friendly message. */
export function friendlyOrderError(message: string | undefined | null): string | null {
  const m = /HUNGRY Z:([a-z_]+)/.exec(message ?? "");
  return m ? (SQL_ERRORS[m[1]!] ?? "Could not place order.") : null;
}
