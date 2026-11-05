import { describe, expect, it } from "vitest";
import { canteenDecisionEmail, canteenOrderEmail, orderConfirmationEmail, orderStatusEmail, paymentPendingEmail, refundFailedEmail, refundProcessingEmail, supportRequestEmail, withEmailTextFooter } from "@/lib/email-templates";

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

describe("HUNGRY Z order email content", () => {
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
    expect(refund.text).toContain("5–7 business working days after approval and successful initiation");
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

  it("adds the same logo, icon-only social links and legal footer to transactional emails", () => {
    const emails = [
      orderConfirmationEmail({ ...order, paymentMethod: "razorpay", paymentStatus: "paid" }),
      paymentPendingEmail({ ...order, paymentMethod: "razorpay", paymentStatus: "pending" }),
      supportRequestEmail({ senderName: "Asha", senderEmail: "asha@example.com", role: "student", canteen: "Campus Cafe", category: "General", orderId: "", description: "Help", submittedAt: "2026-11-04T10:00:00.000Z" }),
      canteenDecisionEmail("approved", { canteenName: "Campus Cafe", university: "Campus University", code: "ABC1234", ownerLoginId: "OWNER01", ownerLoginCode: "PASS123" }),
    ];
    for (const email of emails) {
      expect(email.html.match(/alt="Official HUNGRY Z logo"/g)).toHaveLength(2);
      expect(email.html.indexOf("Official HUNGRY Z logo")).toBeLessThan(email.html.indexOf("<h1"));
      expect(email.html).toContain("HUNGRY Z</p>");
      expect(email.html).toContain('href="https://www.instagram.com/hungryz___?obrf=MTBoOHp3ZjJzZW9tdg=="');
      expect(email.html).toContain('href="https://whatsapp.com/channel/0029Vb9EpYJ0G0XmfZmSme1H"');
      expect(email.html).toContain('href="https://www.linkedin.com/company/hungryz/"');
      expect(email.html).toContain('href="https://hungryz.vercel.app/" style="color:#555;text-decoration:underline">Privacy Policy</a>');
      expect(email.html).toContain('href="https://hungryz.vercel.app/" style="color:#555;text-decoration:underline">Terms &amp; Conditions</a>');
      expect(email.html).toContain('aria-label="Instagram"');
      expect(email.html).toContain('aria-label="WhatsApp Community"');
      expect(email.html).toContain('aria-label="LinkedIn"');
      expect(email.html).toContain("https://hungryz.vercel.app/email-instagram.png");
      expect(email.html).toContain("https://hungryz.vercel.app/email-whatsapp.png");
      expect(email.html).toContain("https://hungryz.vercel.app/email-linkedin.png");
      expect(email.html).not.toContain("background-image");
      expect(email.html).toContain('width="32" height="32"');
      expect(email.html).toContain('width="64" height="64"');
      expect(email.html).toContain('width="42" height="42"');
    }
  });

  it("adds social and legal destinations to plain-text email fallbacks only once", () => {
    const email = withEmailTextFooter({ subject: "Order", text: "Order confirmed", html: "<p>Order confirmed</p>" });
    expect(email.text).toContain("Instagram: https://www.instagram.com/hungryz___?obrf=MTBoOHp3ZjJzZW9tdg==");
    expect(email.text).toContain("WhatsApp Community: https://whatsapp.com/channel/0029Vb9EpYJ0G0XmfZmSme1H");
    expect(email.text).toContain("Privacy Policy: https://hungryz.vercel.app/");
    expect(email.text).toContain("Terms & Conditions: https://hungryz.vercel.app/");
    expect(email.text).toContain("LinkedIn: https://www.linkedin.com/company/hungryz/");
    expect(withEmailTextFooter(email).text).toBe(email.text);
  });
});
