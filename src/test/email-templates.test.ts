import { describe, expect, it } from "vitest";
import { canteenOrderEmail, orderConfirmationEmail, orderStatusEmail, paymentPendingEmail, refundFailedEmail, refundProcessingEmail, supportRequestEmail } from "@/lib/email-templates";

const order = {
  customerName: "Asha Student",
  orderNumber: "HG-123456",
  canteenName: "Campus Cafe",
  lines: [{ id: "item-1", name: "Masala Dosa", price: 60, qty: 2 }],
  subtotal: 120,
  discount: 10,
  total: 110,
  orderType: "dine_in",
  paymentMethod: "counter",
  paymentStatus: "unpaid",
  pickupCode: "4821",
  counter: "Counter 2",
  prepMinutes: 8,
};

describe("HUNGRY order email content", () => {
  it("clearly states Dine In and pending Pay at Counter in the student confirmation", () => {
    const email = orderConfirmationEmail(order);
    expect(email.text).toContain("Type: Dine In");
    expect(email.text).toContain("Payment method: Pay at Counter");
    expect(email.text).toContain("Payment status: Payment Pending — Pay at Counter");
    expect(email.text).toContain("110");
    expect(email.html).toContain("Payment method:");
  });

  it("shows only verified paid status for a captured online payment", () => {
    const email = orderConfirmationEmail({ ...order, orderType: "parcel", paymentMethod: "razorpay", paymentStatus: "paid" });
    expect(email.text).toContain("Type: Parcel");
    expect(email.text).toContain("Payment method: UPI / Online Payment");
    expect(email.text).toContain("Paid (verified by Razorpay)");
  });

  it("reports a pending online payment without implying that the canteen received it", () => {
    const email = paymentPendingEmail({ ...order, paymentMethod: "razorpay", paymentStatus: "pending" });
    expect(email.text).toContain("Payment status: Pending - awaiting Razorpay confirmation");
    expect(email.text.toLowerCase()).toContain("do not pay again");
  });

  it("includes event status and payment state in both student and canteen messages", () => {
    const status = orderStatusEmail({ customerName: order.customerName, orderNumber: order.orderNumber, canteenName: order.canteenName, status: "ready", lines: order.lines, total: order.total, orderType: order.orderType, paymentMethod: order.paymentMethod, paymentStatus: order.paymentStatus, pickupCode: order.pickupCode, counter: order.counter });
    const owner = canteenOrderEmail({ customerName: order.customerName, orderNumber: order.orderNumber, canteenName: order.canteenName, lines: order.lines, total: order.total, orderType: order.orderType, paymentMethod: order.paymentMethod, paymentStatus: order.paymentStatus, pickupCode: order.pickupCode, counter: order.counter, status: "ready" });
    expect(status.text).toContain("now Ready");
    expect(status.text).toContain("Payment Pending - Pay at Counter");
    expect(status.text).toContain("2x Masala Dosa");
    expect(status.text).toContain("Total: ₹110");
    expect(status.text).toContain("Collection code: 4821");
    expect(owner.text).toContain("Order status: ready");
    expect(owner.text).toContain("Payment status: Payment Pending - Pay at Counter");
  });

  it("only includes the pickup code in the ready notification and gives qualified refund timing", () => {
    const placed = orderStatusEmail({ customerName: order.customerName, orderNumber: order.orderNumber, canteenName: order.canteenName, status: "preparing", lines: order.lines, total: order.total, orderType: order.orderType, paymentMethod: order.paymentMethod, paymentStatus: order.paymentStatus, pickupCode: order.pickupCode, counter: order.counter });
    expect(placed.text).not.toContain("4821");
    const refund = refundProcessingEmail({ customerName: order.customerName, orderNumber: order.orderNumber, amount: 110 });
    expect(refund.text).toContain("5–7 working days");
    expect(refund.text).toContain("Razorpay, your bank and payment method");
    const failed = refundFailedEmail({ customerName: order.customerName, orderNumber: order.orderNumber, amount: 110 });
    expect(failed.text).toContain("could not be completed automatically");
  });

  it("escapes user submitted support content in the HTML email", () => {
    const email = supportRequestEmail({ senderName: "<script>", senderEmail: "a@example.com", role: "student", canteen: "Campus Cafe", category: "Payment issue", orderId: "HG-123456", description: "<script>alert(1)</script>", submittedAt: "2026-11-02T10:00:00.000Z" });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.text).toContain("HG-123456");
  });
});
