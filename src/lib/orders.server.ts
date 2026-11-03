// Server-only order, payment and refund workflows shared by server functions and the
// Razorpay webhook. Every state change is idempotent so duplicate callbacks are harmless.
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { sendEmail, sendEmailOnce } from "@/lib/mailer.server";
import * as T from "@/lib/email-templates";
import {
  RazorpayError,
  captureRazorpayPayment,
  createRazorpayOrder,
  createRazorpayRefund,
  fetchRazorpayPayment,
  razorpayKeys,
  type RzpPayment,
} from "@/lib/razorpay.server";
import { rupeesToPaise } from "@/lib/order-rules";

type Order = Database["public"]["Tables"]["orders"]["Row"];
type OrderLine = { id: string; name: string; price: number; qty: number };

export async function getOrder(id: string): Promise<Order | null> {
  const { data } = await db.from("orders").select("*").eq("id", id).maybeSingle();
  return data;
}

async function customer(userId: string) {
  const { data } = await db.from("profiles").select("full_name, email").eq("id", userId).maybeSingle();
  if (data) return { name: data.full_name, email: data.email };
  const { data: u } = await db.auth.admin.getUserById(userId);
  return { name: u.user?.email ?? "there", email: u.user?.email ?? "" };
}

async function canteenName(id: string) {
  const { data } = await db.from("canteens").select("name").eq("id", id).maybeSingle();
  return data?.name ?? "your canteen";
}

/* ---------------- Order confirmation (sent once, only for confirmed orders) ---------------- */
export async function sendOrderConfirmation(orderId: string) {
  const { data: claimed } = await db
    .from("orders")
    .update({ confirmation_email_sent_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("confirmation_email_sent_at", null)
    .in("payment_status", ["unpaid", "paid"])
    .in("status", ["placed", "preparing", "ready", "collected"])
    .select("*")
    .maybeSingle();
  const o = claimed ?? await getOrder(orderId);
  if (!o || !["unpaid", "paid"].includes(o.payment_status) || !["placed", "preparing", "ready", "collected"].includes(o.status)) return { sent: false, ownerSent: false, reason: "not_eligible" };
  const who = await customer(o.user_id);
  const canteen = await db.from("canteens").select("name,contact_email").eq("id", o.canteen_id).maybeSingle();
  const res = who.email ? await sendEmailOnce(
    "order_confirmation",
    who.email,
    T.orderConfirmationEmail({
      customerName: o.customer_name,
      orderNumber: o.order_number,
      canteenName: canteen.data?.name ?? "your canteen",
      lines: o.lines as unknown as OrderLine[],
      subtotal: o.subtotal,
      discount: o.discount,
      total: o.total,
      orderType: o.order_type,
      paymentMethod: o.payment_method,
      paymentStatus: o.payment_status,
      pickupCode: o.pickup_code,
      counter: o.counter,
      prepMinutes: o.prep_minutes,
    }),
    `order:${o.id}:confirmed`,
  ) : { sent: false, reason: "no_email" };
  let ownerSent = false;
  if (canteen.data?.contact_email) {
    const ownerResult = await sendEmailOnce("canteen_order", canteen.data.contact_email, T.canteenOrderEmail({
      customerName: o.customer_name,
      orderNumber: o.order_number,
      canteenName: canteen.data.name,
      lines: o.lines as unknown as OrderLine[],
      total: o.total,
      orderType: o.order_type,
      paymentMethod: o.payment_method,
      paymentStatus: o.payment_status,
      pickupCode: o.pickup_code,
      counter: o.counter,
    }), `order:${o.id}:received`);
    ownerSent = ownerResult.sent;
  }
  // Let a later retry (e.g. a repeated webhook) try again if delivery failed.
  if (!res.sent && claimed) await db.from("orders").update({ confirmation_email_sent_at: null }).eq("id", o.id);
  return { ...res, ownerSent };
}

export async function sendPaymentPendingNotice(orderId: string) {
  const order = await getOrder(orderId);
  if (!order || order.payment_method !== "razorpay" || order.payment_status !== "pending") return { sent: false, reason: "not_pending" };
  const who = await customer(order.user_id);
  if (!who.email) return { sent: false, reason: "no_email" };
  const canteen = await canteenName(order.canteen_id);
  return sendEmailOnce("payment_pending", who.email, T.paymentPendingEmail({
    customerName: order.customer_name,
    orderNumber: order.order_number,
    canteenName: canteen,
    lines: order.lines as unknown as OrderLine[],
    subtotal: order.subtotal,
    discount: order.discount,
    total: order.total,
    orderType: order.order_type,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    pickupCode: order.pickup_code,
    counter: order.counter,
    prepMinutes: order.prep_minutes,
  }), `order:${order.id}:payment-pending`);
}

export async function sendOrderStatusUpdate(orderId: string, status: string) {
  const order = await getOrder(orderId);
  if (!order || order.status !== status) return { sent: false, results: [] as Awaited<ReturnType<typeof sendEmailOnce>>[] };
  const [who, canteen] = await Promise.all([
    customer(order.user_id),
    db.from("canteens").select("name,contact_email").eq("id", order.canteen_id).maybeSingle(),
  ]);
  const ref = `order:${order.id}:status:${status}`;
  const tasks = [];
  if (who.email) tasks.push(sendEmailOnce("order_status", who.email, T.orderStatusEmail({
    customerName: order.customer_name,
    orderNumber: order.order_number,
    canteenName: canteen.data?.name ?? "your canteen",
    status,
    lines: order.lines as unknown as OrderLine[],
    total: order.total,
    orderType: order.order_type,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    pickupCode: order.pickup_code,
    counter: order.counter,
  }), ref));
  if (canteen.data?.contact_email) tasks.push(sendEmailOnce("canteen_order_status", canteen.data.contact_email, T.canteenOrderEmail({
    customerName: order.customer_name,
    orderNumber: order.order_number,
    canteenName: canteen.data.name,
    lines: order.lines as unknown as OrderLine[],
    total: order.total,
    orderType: order.order_type,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    pickupCode: order.pickup_code,
    counter: order.counter,
    status,
  }), ref));
  const results = await Promise.all(tasks);
  return { sent: results.every((result) => result.sent), results };
}

/* ---------------- Razorpay checkout ---------------- */
export async function ensureRazorpayOrder(order: Order): Promise<string> {
  if (order.razorpay_order_id) return order.razorpay_order_id;
  const rzp = await createRazorpayOrder({
    amountPaise: rupeesToPaise(order.total),
    receipt: order.order_number,
    notes: { hungry_order_id: order.id, order_number: order.order_number },
  });
  const { data } = await db
    .from("orders")
    .update({ razorpay_order_id: rzp.id })
    .eq("id", order.id)
    .is("razorpay_order_id", null)
    .select("razorpay_order_id")
    .maybeSingle();
  if (data?.razorpay_order_id) return data.razorpay_order_id;
  const fresh = await getOrder(order.id);
  if (!fresh?.razorpay_order_id) throw new Error("Could not start payment");
  return fresh.razorpay_order_id;
}

export async function checkoutParams(order: Order) {
  const razorpayOrderId = await ensureRazorpayOrder(order);
  const who = await customer(order.user_id);
  const { keyId, testMode } = razorpayKeys();
  return {
    orderId: order.id,
    orderNumber: order.order_number,
    razorpayOrderId,
    amount: rupeesToPaise(order.total),
    currency: "INR" as const,
    keyId,
    testMode,
    prefill: { name: who.name, email: who.email },
  };
}

async function upsertPayment(order: Order, p: RzpPayment, signatureVerified: boolean) {
  const row: Database["public"]["Tables"]["payments"]["Insert"] = {
    order_id: order.id,
    user_id: order.user_id,
    razorpay_order_id: p.order_id ?? order.razorpay_order_id ?? "",
    razorpay_payment_id: p.id,
    amount_paise: p.amount,
    currency: p.currency,
    status: p.status === "refunded" ? "refunded" : p.status,
    method: p.method ?? null,
    error_code: p.error_code ?? null,
    error_description: p.error_description ?? null,
    ...(signatureVerified ? { signature_verified: true } : {}),
  };
  const { data, error } = await db.from("payments").upsert(row, { onConflict: "razorpay_payment_id" }).select("id").single();
  if (error) throw new Error(`Could not record payment: ${error.message}`);
  return data.id;
}

export type PaymentOutcome = { state: "paid" | "processing" | "failed" | "refunding"; orderId: string; emailSent?: boolean; notificationsSent?: boolean };

/**
 * Confirms a payment with Razorpay itself (never trusting the browser), captures it if
 * needed, and marks the order paid exactly once. Safe to call repeatedly.
 */
export async function confirmOnlinePayment(p: { razorpayOrderId: string; razorpayPaymentId: string; signatureVerified: boolean }): Promise<PaymentOutcome> {
  const { data: order } = await db.from("orders").select("*").eq("razorpay_order_id", p.razorpayOrderId).maybeSingle();
  if (!order) throw new Error("No HUNGRY Z order matches this payment.");
  let pay = await fetchRazorpayPayment(p.razorpayPaymentId);
  if (pay.order_id !== p.razorpayOrderId) throw new Error("This payment does not belong to the order.");

  const expected = rupeesToPaise(order.total);
  if (pay.amount !== expected || pay.currency !== "INR") {
    await upsertPayment(order, { ...pay, error_description: `Amount mismatch: expected ${expected} paise` }, p.signatureVerified);
    const who = await customer(order.user_id);
    await sendEmail(
      "admin_payment_failed",
      T.ADMIN_ALERT_EMAIL,
      T.adminPaymentFailedEmail({ orderNumber: order.order_number, canteenName: await canteenName(order.canteen_id), customerEmail: who.email, total: order.total, paymentId: pay.id, reason: `Amount mismatch (got ${pay.amount} paise)` }),
      order.id,
    );
    throw new Error("Payment amount didn't match the order. Our team has been alerted.");
  }

  if (pay.status === "authorized") {
    try {
      pay = await captureRazorpayPayment(pay.id, expected);
    } catch (e) {
      // Another request (or auto-capture) may have captured it already.
      if (!(e instanceof RazorpayError)) throw e;
      pay = await fetchRazorpayPayment(pay.id);
    }
  }

  if (pay.status === "failed") {
    await recordFailedPayment({ razorpayOrderId: p.razorpayOrderId, razorpayPaymentId: pay.id, payment: pay });
    return { state: "failed", orderId: order.id };
  }
  const paymentRowId = await upsertPayment(order, pay, p.signatureVerified);
  if (pay.status !== "captured") return { state: "processing", orderId: order.id };

  const { data: result, error } = await db.rpc("hungry_mark_order_paid", { p_order: order.id });
  if (error) throw new Error(`Could not update order: ${error.message}`);
  if (result === "paid" || result === "already_paid") {
    const email = await sendOrderConfirmation(order.id);
    return { state: "paid", orderId: order.id, emailSent: email.sent && email.ownerSent };
  }
  if (result === "order_cancelled") {
    // Paid after the order expired or was cancelled — return the money automatically.
    await refundLatePayment(order, paymentRowId);
    return { state: "refunding", orderId: order.id };
  }
  throw new Error("Order could not be confirmed.");
}

/** Records a failed attempt (confirmed with Razorpay) and notifies the customer and admin once. */
export async function recordFailedPayment(p: { razorpayOrderId: string; razorpayPaymentId: string; payment?: RzpPayment }) {
  const pay = p.payment ?? (await fetchRazorpayPayment(p.razorpayPaymentId));
  if (pay.order_id !== p.razorpayOrderId) throw new Error("This payment does not belong to the order.");
  if (pay.status === "captured" || pay.status === "authorized") {
    return confirmOnlinePayment({ razorpayOrderId: p.razorpayOrderId, razorpayPaymentId: pay.id, signatureVerified: false });
  }
  if (pay.status !== "failed") return { state: "processing" as const };
  const { data: order } = await db.from("orders").select("*").eq("razorpay_order_id", p.razorpayOrderId).maybeSingle();
  if (!order) throw new Error("No HUNGRY Z order matches this payment.");

  const row = {
    order_id: order.id,
    user_id: order.user_id,
    razorpay_order_id: p.razorpayOrderId,
    razorpay_payment_id: pay.id,
    amount_paise: pay.amount,
    currency: pay.currency,
    status: "failed",
    method: pay.method ?? null,
    error_code: pay.error_code ?? null,
    error_description: pay.error_description ?? null,
  };
  const ins = await db.from("payments").insert(row).select("id").maybeSingle();
  let firstTime = !ins.error;
  if (ins.error) {
    const upd = await db
      .from("payments")
      .update({ status: "failed", error_code: row.error_code, error_description: row.error_description })
      .eq("razorpay_payment_id", pay.id)
      .not("status", "in", "(failed,captured,refunded)")
      .select("id")
      .maybeSingle();
    firstTime = !!upd.data;
  }
  if (!firstTime) return { state: "failed" as const, orderId: order.id, notificationsSent: true };

  await db.from("orders").update({ payment_status: "failed" }).eq("id", order.id).eq("payment_status", "pending");
  const who = await customer(order.user_id);
  const reason = pay.error_description || pay.error_code || "Payment was declined";
  const notifications = await Promise.all([
    who.email ? sendEmailOnce("payment_failed", who.email, T.paymentFailedEmail({ customerName: order.customer_name, orderNumber: order.order_number, total: order.total, reason }), `payment:${pay.id}:customer-failed`) : Promise.resolve({ sent: true }),
    sendEmailOnce(
      "admin_payment_failed",
      T.ADMIN_ALERT_EMAIL,
      T.adminPaymentFailedEmail({ orderNumber: order.order_number, canteenName: await canteenName(order.canteen_id), customerEmail: who.email, total: order.total, paymentId: pay.id, reason }),
      `payment:${pay.id}:admin-failed`,
    ),
  ]);
  return { state: "failed" as const, orderId: order.id, notificationsSent: notifications.every((notification) => notification.sent) };
}

/* ---------------- Refunds ---------------- */
export async function createRefundRequest(p: { order: Order; amount: number; reason: string; requestedBy: "customer" | "canteen" | "admin" | "system" }) {
  const { data, error } = await db
    .from("refunds")
    .insert({ order_id: p.order.id, user_id: p.order.user_id, amount: p.amount, reason: p.reason, requested_by: p.requestedBy })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("A refund is already in progress for this order.");
    throw new Error("Could not create refund request.");
  }
  let customerEmailSent = false;
  if (p.requestedBy === "customer") {
    const who = await customer(p.order.user_id);
    if (who.email) {
      const result = await sendEmailOnce("refund_requested", who.email, T.refundRequestedEmail({ customerName: p.order.customer_name, orderNumber: p.order.order_number, amount: p.amount }), data.id);
      customerEmailSent = result.sent;
    }
    await sendEmail(
      "admin_refund_requested",
      T.ADMIN_ALERT_EMAIL,
      T.adminRefundEmail({ stage: "requested", orderNumber: p.order.order_number, canteenName: await canteenName(p.order.canteen_id), customerEmail: who.email, amount: p.amount, reason: p.reason }),
      data.id,
    );
  }
  return { ...data, customerEmailSent };
}

/** Sends the refund to Razorpay. Only one caller can move a refund into processing. */
export async function startRefund(refundId: string) {
  const { data: r } = await db.from("refunds").update({ status: "processing" }).eq("id", refundId).in("status", ["requested", "failed"]).select("*").maybeSingle();
  if (!r) throw new Error("This refund isn't waiting to be processed.");
  const order = await getOrder(r.order_id);
  if (!order) throw new Error("Order not found");
  const { data: pay } = await db
    .from("payments")
    .select("*")
    .eq("order_id", order.id)
    .eq("status", "captured")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const who = await customer(order.user_id);
  const cName = await canteenName(order.canteen_id);
  if (!pay) {
    await db.from("refunds").update({ status: "failed", admin_note: "No captured payment found for this order" }).eq("id", r.id);
    if (who.email) await sendEmailOnce("refund_failed", who.email, T.refundFailedEmail({ customerName: order.customer_name, orderNumber: order.order_number, amount: r.amount }), r.id);
    throw new Error("No captured payment found for this order.");
  }
  try {
    const rf = await createRazorpayRefund(pay.razorpay_payment_id, rupeesToPaise(r.amount), { hungry_refund_id: r.id, order_number: order.order_number });
    await db.from("refunds").update({ razorpay_refund_id: rf.id, payment_id: pay.id }).eq("id", r.id);
    // Stop the kitchen and return stock/coupon if the food wasn't collected yet.
    await db.rpc("hungry_release_order", { p_order: order.id });
    await db.from("orders").update({ payment_status: "refund_pending" }).eq("id", order.id);
    if (who.email)
      await sendEmailOnce("refund_processing", who.email, T.refundProcessingEmail({ customerName: order.customer_name, orderNumber: order.order_number, amount: r.amount }), r.id);
    await sendEmailOnce(
      "admin_refund_update",
      T.ADMIN_ALERT_EMAIL,
      T.adminRefundEmail({ stage: "initiated", orderNumber: order.order_number, canteenName: cName, customerEmail: who.email, amount: r.amount, reason: r.reason, refundId: rf.id }),
      r.id,
    );
    if (rf.status === "processed") await finalizeRefund(rf.id, "processed");
    if (rf.status === "failed") await finalizeRefund(rf.id, "failed");
    return { razorpayRefundId: rf.id, status: rf.status };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.from("refunds").update({ status: "failed", admin_note: msg.slice(0, 480) }).eq("id", r.id).eq("status", "processing");
    if (who.email) await sendEmailOnce("refund_failed", who.email, T.refundFailedEmail({ customerName: order.customer_name, orderNumber: order.order_number, amount: r.amount }), r.id);
    await sendEmailOnce(
      "admin_refund_update",
      T.ADMIN_ALERT_EMAIL,
      T.adminRefundEmail({ stage: "failed", orderNumber: order.order_number, canteenName: cName, customerEmail: who.email, amount: r.amount, reason: msg.slice(0, 200) }),
      r.id,
    );
    throw new Error("Razorpay couldn't start this refund. It's marked failed so it can be retried.");
  }
}

/** Applies the final refund result reported by Razorpay. Idempotent. */
export async function finalizeRefund(razorpayRefundId: string, outcome: "processed" | "failed") {
  const { data: r } = await db
    .from("refunds")
    .update({ status: outcome })
    .eq("razorpay_refund_id", razorpayRefundId)
    .eq("status", "processing")
    .select("*")
    .maybeSingle();
  if (!r) return false;
  const order = await getOrder(r.order_id);
  if (!order) return false;
  const who = await customer(order.user_id);
  const cName = await canteenName(order.canteen_id);
  if (outcome === "processed") {
    await db.from("orders").update({ payment_status: "refunded" }).eq("id", order.id);
    if (r.payment_id) {
      const { data: pay } = await db.from("payments").select("amount_paise").eq("id", r.payment_id).maybeSingle();
      await db
        .from("payments")
        .update({ status: pay && rupeesToPaise(r.amount) < pay.amount_paise ? "partially_refunded" : "refunded" })
        .eq("id", r.payment_id);
    }
    if (who.email)
      await sendEmailOnce("refund_processed", who.email, T.refundProcessedEmail({ customerName: order.customer_name, orderNumber: order.order_number, amount: r.amount }), r.id);
  } else if (who.email) {
    await sendEmailOnce("refund_failed", who.email, T.refundFailedEmail({ customerName: order.customer_name, orderNumber: order.order_number, amount: r.amount }), r.id);
  }
  await sendEmail(
    "admin_refund_update",
    T.ADMIN_ALERT_EMAIL,
    T.adminRefundEmail({ stage: outcome, orderNumber: order.order_number, canteenName: cName, customerEmail: who.email, amount: r.amount, refundId: razorpayRefundId }),
    r.id,
  );
  return true;
}

async function refundLatePayment(order: Order, paymentRowId: string) {
  let refundId: string | null = null;
  try {
    const r = await createRefundRequest({ order, amount: order.total, reason: "Paid after the order expired or was cancelled", requestedBy: "system" });
    refundId = r.id;
  } catch {
    return; // a refund already exists for this order
  }
  await db.from("refunds").update({ payment_id: paymentRowId }).eq("id", refundId);
  try {
    await startRefund(refundId);
  } catch (e) {
    console.error("[orders] automatic refund failed", e instanceof Error ? e.message : e);
  }
}

export async function sendWelcomeOnce(userId: string) {
  const { data: p } = await db
    .from("profiles")
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq("id", userId)
    .is("welcome_email_sent_at", null)
    .select("full_name, email")
    .maybeSingle();
  if (!p) return { sent: false, reason: "already_sent_or_not_customer" };
  const res = await sendEmail("welcome", p.email, T.welcomeEmail({ name: p.full_name }), userId);
  if (!res.sent) await db.from("profiles").update({ welcome_email_sent_at: null }).eq("id", userId);
  return res;
}
