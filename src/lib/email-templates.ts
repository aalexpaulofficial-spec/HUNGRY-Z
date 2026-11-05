// Email content for every HUNGRY Z notification. Pure functions: all dynamic values are HTML-escaped.
import { HUNGRY_SOCIAL_LINKS } from "@/lib/social-links";

export const ADMIN_ALERT_EMAIL = "hungryofficialx@gmail.com";

export type EmailKind =
  | "welcome"
  | "order_confirmation"
  | "payment_pending"
  | "order_status"
  | "canteen_order"
  | "canteen_order_status"
  | "support_request"
  | "support_confirmation"
  | "payment_failed"
  | "admin_payment_failed"
  | "refund_requested"
  | "admin_refund_requested"
  | "refund_processing"
  | "refund_processed"
  | "refund_failed"
  | "refund_rejected"
  | "admin_refund_update"
  | "canteen_approved"
  | "canteen_rejected";

export type EmailContent = { subject: string; text: string; html: string };

export const HUNGRY_Z_SITE_URL = "https://hungryz.vercel.app";
const HUNGRY_Z_LOGO_URL = `${HUNGRY_Z_SITE_URL}/HUNGRY%20Z%20Q%20LOGO.png`;

export function withEmailTextFooter(content: EmailContent): EmailContent {
  const footer = [
    "— Team HUNGRY Z",
    "Instagram: https://www.instagram.com/hungryz___?obrf=MTBoOHp3ZjJzZW9tdg==",
    `WhatsApp Community: ${HUNGRY_SOCIAL_LINKS.whatsapp}`,
    "LinkedIn: https://www.linkedin.com/company/hungryz/",
    `Privacy Policy: ${HUNGRY_Z_SITE_URL}/`,
    `Terms & Conditions: ${HUNGRY_Z_SITE_URL}/`,
  ].join("\n");
  if (content.text.includes("Instagram: https://www.instagram.com/hungryz___")) return content;
  const message = content.text.replace(/(?:\r?\n)+\s*(?:—)?\s*Team HUNGRY Z\s*$/u, "").trimEnd();
  return { ...content, text: `${message}\n\n${footer}` };
}

export const esc = (s: string | number | null | undefined) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const wrap = (title: string, body: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#fff;color:#171717;font-family:Arial,Helvetica,sans-serif"><tr><td align="center" style="padding:28px 14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;border-collapse:collapse"><tr><td align="center" style="padding:0 0 26px"><img src="${HUNGRY_Z_LOGO_URL}" alt="Official HUNGRY Z logo" width="64" height="64" style="display:block;width:64px;height:64px;max-width:64px;border:0;outline:none;text-decoration:none;object-fit:contain;margin:0 auto 10px"><p style="margin:0;color:#151515;font-size:20px;font-weight:700;letter-spacing:5px;line-height:1.3">HUNGRY Z</p></td></tr><tr><td style="padding:0 0 26px"><h1 style="color:#c8101e;margin:0 0 16px;font-size:23px;line-height:1.3;font-weight:700">${esc(title)}</h1>${body}</td></tr><tr><td align="center" style="border-top:1px solid #e6e6e6;padding:22px 8px 0"><img src="${HUNGRY_Z_LOGO_URL}" alt="Official HUNGRY Z logo" width="42" height="42" style="display:block;width:42px;height:42px;max-width:42px;border:0;outline:none;text-decoration:none;object-fit:contain;margin:0 auto 9px"><p style="margin:0 0 14px;color:#555;font-size:13px;line-height:1.5">— Team HUNGRY Z</p><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 auto"><tr><td style="padding:0 8px"><a href="https://www.instagram.com/hungryz___?obrf=MTBoOHp3ZjJzZW9tdg==" aria-label="Instagram"><img src="${HUNGRY_Z_SITE_URL}/email-instagram.png" alt="Instagram" width="32" height="32" style="display:block;width:32px;height:32px;max-width:32px;border:0;outline:none;text-decoration:none;object-fit:contain"></a></td><td style="padding:0 8px"><a href="${HUNGRY_SOCIAL_LINKS.whatsapp}" aria-label="WhatsApp Community"><img src="${HUNGRY_Z_SITE_URL}/email-whatsapp.png" alt="WhatsApp Community" width="32" height="32" style="display:block;width:32px;height:32px;max-width:32px;border:0;outline:none;text-decoration:none;object-fit:contain"></a></td><td style="padding:0 8px"><a href="https://www.linkedin.com/company/hungryz/" aria-label="LinkedIn"><img src="${HUNGRY_Z_SITE_URL}/email-linkedin.png" alt="LinkedIn" width="32" height="32" style="display:block;width:32px;height:32px;max-width:32px;border:0;outline:none;text-decoration:none;object-fit:contain"></a></td></tr></table><p style="margin:15px 0 0;font-size:12px;line-height:1.6"><a href="${HUNGRY_Z_SITE_URL}/" style="color:#555;text-decoration:underline">Privacy Policy</a><span style="color:#999"> &nbsp;|&nbsp; </span><a href="${HUNGRY_Z_SITE_URL}/" style="color:#555;text-decoration:underline">Terms &amp; Conditions</a></p></td></tr></table></td></tr></table>`;

const rupee = (n: number) => `₹${n}`;

export type OrderEmailData = {
  customerName: string;
  orderNumber: string;
  canteenName: string;
  lines: { name: string; qty: number; price: number }[];
  subtotal: number;
  discount: number;
  total: number;
  orderType: string;
  paymentMethod: string;
  paymentStatus: string;
  pickupCode: string;
  counter: string;
  prepMinutes: number;
};

function linesHtml(lines: OrderEmailData["lines"]) {
  return `<table style="width:100%;border-collapse:collapse;margin:12px 0">${lines
    .map((l) => `<tr><td style="padding:4px 0">${esc(l.qty)}× ${esc(l.name)}</td><td style="text-align:right">${esc(rupee(l.price * l.qty))}</td></tr>`)
    .join("")}</table>`;
}

export function welcomeEmail(d: { name: string }): EmailContent {
  const first = d.name.split(" ")[0] ?? d.name;
  return {
    subject: "Welcome to HUNGRY Z 🍽️",
    text: `Hi ${first},\n\nYour HUNGRY Z account is ready. Log in and enter your campus canteen's 7-character code to browse its menu. Place an available order, follow its status and show your pickup code at the counter when it is ready. HUNGRY Z charges ₹0 platform fee on orders.\n\n— Team HUNGRY Z`,
    html: wrap(`Welcome, ${esc(first)}!`, `<p>Your HUNGRY Z account is ready.</p><ol><li>Log in to HUNGRY Z.</li><li>Enter your campus canteen's 7-character code.</li><li>Browse the menu, place an available order and track its status.</li><li>When it is ready, show your pickup code at the listed counter.</li></ol><p>HUNGRY Z charges ₹0 platform fee on orders.</p>`),
  };
}

export function orderConfirmationEmail(d: OrderEmailData): EmailContent {
  const method = d.paymentMethod === "razorpay" ? "UPI / Online Payment" : "Pay at Counter";
  const paymentStatus = d.paymentStatus === "paid"
    ? "Paid (verified by Razorpay)"
    : d.paymentMethod === "counter"
      ? "Payment Pending \u2014 Pay at Counter"
      : "Payment Pending - awaiting Razorpay confirmation";
  const paid = `Payment method: ${method}\\nPayment status: ${paymentStatus}`;
  const type = d.orderType === "parcel" ? "Parcel" : "Dine In";
  return {
    subject: `Order ${d.orderNumber} confirmed — pickup code ${d.pickupCode}`,
    text: `Hi ${d.customerName},\n\nYour order ${d.orderNumber} at ${d.canteenName} is confirmed.\n\n${d.lines.map((l) => `${l.qty}x ${l.name} — ₹${l.price * l.qty}`).join("\n")}\n\nSubtotal: ₹${d.subtotal}\nDiscount: ₹${d.discount}\nTotal: ₹${d.total}\nType: ${type}\nPayment: ${paid}\n\nPickup code: ${d.pickupCode} at ${d.counter} (about ${d.prepMinutes} min).\n\n— Team HUNGRY Z`,
    html: wrap(
      `Order ${esc(d.orderNumber)} confirmed`,
      `<p>Hi ${esc(d.customerName)}, your order at <b>${esc(d.canteenName)}</b> is confirmed.</p>${linesHtml(d.lines)}<p>Subtotal: ${esc(rupee(d.subtotal))}${d.discount ? `<br/>Discount: −${esc(rupee(d.discount))}` : ""}<br/><b>Total: ${esc(rupee(d.total))}</b></p><p>${esc(type)} · ${esc(paid)}</p><p>Pickup code:</p><p style="font-size:28px;letter-spacing:8px;font-family:monospace;background:#111;color:#fff;padding:14px 20px;border-radius:12px;display:inline-block">${esc(d.pickupCode)}</p><p>${esc(d.counter)} · ready in about ${esc(d.prepMinutes)} min.</p>`,
    ),
  };
}

export function paymentPendingEmail(d: OrderEmailData): EmailContent {
  const type = d.orderType === "parcel" ? "Parcel" : "Dine In";
  return {
    subject: `Payment pending for order ${d.orderNumber}`,
    text: `Hi ${d.customerName},\n\nYour order ${d.orderNumber} at ${d.canteenName} is awaiting UPI / online payment confirmation.\nOrder type: ${type}\nPayment method: UPI / Online Payment\nPayment status: Pending - awaiting Razorpay confirmation\nTotal: Rs ${d.total}\n\nDo not pay again if you were already charged. Contact hungryofficialx@gmail.com with your Order ID and payment reference if the status does not update.\n\nTeam HUNGRY Z`,
    html: wrap("Payment pending", `<p>Hi ${esc(d.customerName)}, your order <b>${esc(d.orderNumber)}</b> at <b>${esc(d.canteenName)}</b> is awaiting payment confirmation.</p><p>Order type: ${esc(type)}<br/>Payment method: UPI / Online Payment<br/><b>Payment status: Pending - awaiting Razorpay confirmation</b><br/>Total: ${esc(rupee(d.total))}</p><p>If you were charged, do not pay again. Contact <a href="mailto:hungryofficialx@gmail.com">hungryofficialx@gmail.com</a> with your Order ID and payment reference.</p>`),
  };
}

export function orderStatusEmail(d: { customerName: string; orderNumber: string; canteenName: string; status: string; lines: OrderEmailData["lines"]; total: number; orderType: string; paymentMethod: string; paymentStatus: string; pickupCode: string; counter: string }): EmailContent {
  const status = d.status.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
  const type = d.orderType === "parcel" ? "Parcel" : "Dine In";
  const method = d.paymentMethod === "razorpay" ? "UPI / Online Payment" : "Pay at Counter";
  const payment = d.paymentStatus === "paid" ? "Paid" : d.paymentMethod === "counter" ? "Payment Pending - Pay at Counter" : "Pending";
  const pickup = d.status === "ready" ? `\nCollection code: ${d.pickupCode}\nCounter: ${d.counter}` : "";
  return {
    subject: `Order ${d.orderNumber}: ${status}`,
    text: `Hi ${d.customerName},\n\nYour order ${d.orderNumber} at ${d.canteenName} is now ${status}.\n${d.lines.map((line) => `${line.qty}x ${line.name} — ₹${line.price * line.qty}`).join("\n")}\nTotal: ₹${d.total}\nOrder type: ${type}\nPayment method: ${method}\nPayment status: ${payment}${pickup ? `\n${pickup}` : ""}\n\nTeam HUNGRY Z`,
    html: wrap(`Order ${esc(d.orderNumber)}: ${esc(status)}`, `<p>Hi ${esc(d.customerName)}, your order at <b>${esc(d.canteenName)}</b> is now <b>${esc(status)}</b>.</p>${linesHtml(d.lines)}<p><b>Total: ${esc(rupee(d.total))}</b><br/>Order type: ${esc(type)}<br/>Payment method: ${esc(method)}<br/>Payment status: <b>${esc(payment)}</b></p>${d.status === "ready" ? `<p>Collection code: <b>${esc(d.pickupCode)}</b><br/>Counter: ${esc(d.counter)}</p>` : ""}`),
  };
}

export function canteenOrderEmail(d: { customerName: string; orderNumber: string; canteenName: string; lines: OrderEmailData["lines"]; total: number; orderType: string; paymentMethod: string; paymentStatus: string; pickupCode: string; counter: string; status?: string }): EmailContent {
  const type = d.orderType === "parcel" ? "Parcel" : "Dine In";
  const method = d.paymentMethod === "razorpay" ? "UPI / Online Payment" : "Pay at Counter";
  const payment = d.paymentStatus === "paid" ? "Paid" : d.paymentMethod === "counter" ? "Payment Pending - Pay at Counter" : "Pending";
  return {
    subject: `HUNGRY Z order ${d.orderNumber}${d.status ? ` - ${d.status}` : " received"}`,
    text: `New order update for ${d.canteenName}.\nOrder: ${d.orderNumber}\nCustomer: ${d.customerName}\nItems:\n${d.lines.map((line) => `${line.qty}x ${line.name} - Rs ${line.price * line.qty}`).join("\n")}\nTotal: Rs ${d.total}\nOrder type: ${type}\nPayment method: ${method}\nPayment status: ${payment}\nCode: ${d.pickupCode}\nCounter: ${d.counter}${d.status ? `\nOrder status: ${d.status}` : ""}`,
    html: wrap(`Order ${esc(d.orderNumber)}${d.status ? ` - ${esc(d.status)}` : " received"}`, `<p>Customer: <b>${esc(d.customerName)}</b><br/>Order type: ${esc(type)}<br/>Payment method: ${esc(method)}<br/>Payment status: <b>${esc(payment)}</b></p>${linesHtml(d.lines)}<p><b>Total: ${esc(rupee(d.total))}</b><br/>Collection code: <b>${esc(d.pickupCode)}</b><br/>Counter: ${esc(d.counter)}${d.status ? `<br/>Order status: ${esc(d.status)}` : ""}</p>`),
  };
}

export function supportRequestEmail(d: { senderName: string; senderEmail: string; role: string; canteen: string; category: string; orderId: string; description: string; submittedAt: string; rating?: number }): EmailContent {
  const title = d.category === "Rate Us" ? `HUNGRY Z rating - ${d.rating ?? ""}/5` : `HUNGRY Z support - ${d.category}`;
  const details = `<p>Submitted: ${esc(d.submittedAt)}<br/>Name: ${esc(d.senderName)}<br/>Email: ${esc(d.senderEmail)}<br/>Role: ${esc(d.role)}<br/>Canteen: ${esc(d.canteen || "N/A")}<br/>Order ID: ${esc(d.orderId || "N/A")}${d.rating ? `<br/>Rating: ${esc(d.rating)}/5` : ""}</p><p>${esc(d.description).replaceAll("\n", "<br/>")}</p>`;
  return { subject: title, text: `${title}\nSubmitted: ${d.submittedAt}\nName: ${d.senderName}\nEmail: ${d.senderEmail}\nRole: ${d.role}\nCanteen: ${d.canteen || "N/A"}\nOrder ID: ${d.orderId || "N/A"}${d.rating ? `\nRating: ${d.rating}/5` : ""}\n\n${d.description}`, html: wrap(title, details) };
}

export function supportConfirmationEmail(d: { senderName: string; category: string; submittedAt: string; orderId: string }): EmailContent {
  return { subject: `HUNGRY Z received your ${d.category.toLowerCase()}`, text: `Hi ${d.senderName},\n\nWe received your ${d.category.toLowerCase()} on ${d.submittedAt}.${d.orderId ? `\nOrder ID: ${d.orderId}` : ""}\nOur support team will review it.\n\nTeam HUNGRY Z`, html: wrap("We received your message", `<p>Hi ${esc(d.senderName)}, we received your ${esc(d.category.toLowerCase())} on ${esc(d.submittedAt)}.</p>${d.orderId ? `<p>Order ID: <b>${esc(d.orderId)}</b></p>` : ""}<p>Our support team will review it.</p>`) };
}

export function paymentFailedEmail(d: { customerName: string; orderNumber: string; total: number; reason: string }): EmailContent {
  return {
    subject: `Payment failed for order ${d.orderNumber}`,
    text: `Hi ${d.customerName},\n\nYour payment of ₹${d.total} for order ${d.orderNumber} didn't go through (${d.reason}). No money was taken for this attempt. You can retry from the Orders tab in HUNGRY Z, or cancel the order.\n\nIf money was debited, it will be returned automatically by your bank or reach out to us by replying to this email.\n\n— Team HUNGRY Z`,
    html: wrap(
      "Payment didn't go through",
      `<p>Hi ${esc(d.customerName)}, your payment of <b>${esc(rupee(d.total))}</b> for order <b>${esc(d.orderNumber)}</b> failed.</p><p>Reason: ${esc(d.reason)}</p><p>You can retry from the <b>Orders</b> tab, or cancel the order. If money was debited, it will be returned automatically — or reply to this email.</p>`,
    ),
  };
}

export function adminPaymentFailedEmail(d: { orderNumber: string; canteenName: string; customerEmail: string; total: number; paymentId: string; reason: string }): EmailContent {
  return {
    subject: `[HUNGRY Z alert] Payment failed — ${d.orderNumber}`,
    text: `Payment failed.\nOrder: ${d.orderNumber}\nCanteen: ${d.canteenName}\nCustomer: ${d.customerEmail}\nAmount: ₹${d.total}\nRazorpay payment: ${d.paymentId}\nReason: ${d.reason}`,
    html: wrap(
      "Payment failed",
      `<p>Order: <b>${esc(d.orderNumber)}</b><br/>Canteen: ${esc(d.canteenName)}<br/>Customer: ${esc(d.customerEmail)}<br/>Amount: ${esc(rupee(d.total))}<br/>Razorpay payment: ${esc(d.paymentId)}<br/>Reason: ${esc(d.reason)}</p>`,
    ),
  };
}

type RefundData = { customerName: string; orderNumber: string; amount: number; reason?: string; note?: string };

export function refundRequestedEmail(d: RefundData): EmailContent {
  return {
    subject: `Refund request received — ${d.orderNumber}`,
    text: `Hi ${d.customerName},\n\nWe've received your refund request of ₹${d.amount} for order ${d.orderNumber}. Our team will review it shortly and email you once it's processed.\n\n— Team HUNGRY Z`,
    html: wrap("Refund request received", `<p>Hi ${esc(d.customerName)}, we've received your refund request of <b>${esc(rupee(d.amount))}</b> for order <b>${esc(d.orderNumber)}</b>.</p><p>We'll email you as soon as it's processed.</p>`),
  };
}

export function refundProcessingEmail(d: RefundData): EmailContent {
  return {
    subject: `Your refund for ${d.orderNumber} is being processed`,
    text: `Hi ${d.customerName},\n\nYour refund of ₹${d.amount} for order ${d.orderNumber} has been approved and successfully initiated with Razorpay. Eligible refunds generally take 5–7 business working days after approval and successful initiation to appear in the original payment method. Processing time can vary by Razorpay, your bank and payment method. Your order details show the latest refund status; we will email you when it changes.\n\n— Team HUNGRY Z`,
    html: wrap("Refund initiated", `<p>Hi ${esc(d.customerName)}, your refund of <b>${esc(rupee(d.amount))}</b> for order <b>${esc(d.orderNumber)}</b> has been approved and successfully initiated with Razorpay.</p><p>Eligible refunds generally take <b>5–7 business working days after approval and successful initiation</b> to appear in the original payment method. Processing time can vary by Razorpay, your bank and payment method. Your order details show the latest refund status; we will email you when it changes.</p>`),
  };
}

export function refundFailedEmail(d: RefundData): EmailContent {
  return {
    subject: `Refund update for ${d.orderNumber}`,
    text: `Hi ${d.customerName},\n\nThe refund of ₹${d.amount} for order ${d.orderNumber} could not be completed automatically. Our team has been notified and will review it. Your order details will show the latest refund status. Contact hungryofficialx@gmail.com with your Order ID if you need help.\n\n— Team HUNGRY Z`,
    html: wrap("Refund needs review", `<p>Hi ${esc(d.customerName)}, the refund of <b>${esc(rupee(d.amount))}</b> for order <b>${esc(d.orderNumber)}</b> could not be completed automatically.</p><p>Our team has been notified and will review it. Your order details will show the latest refund status. Contact <a href="mailto:hungryofficialx@gmail.com">hungryofficialx@gmail.com</a> with your Order ID if you need help.</p>`),
  };
}

export function refundProcessedEmail(d: RefundData): EmailContent {
  return {
    subject: `Refund completed — ${d.orderNumber}`,
    text: `Hi ${d.customerName},\n\nYour refund of ₹${d.amount} for order ${d.orderNumber} has been processed to your original payment method.\n\n— Team HUNGRY Z`,
    html: wrap("Refund completed", `<p>Hi ${esc(d.customerName)}, your refund of <b>${esc(rupee(d.amount))}</b> for order <b>${esc(d.orderNumber)}</b> has been processed to your original payment method.</p>`),
  };
}

export function refundRejectedEmail(d: RefundData): EmailContent {
  return {
    subject: `Update on your refund request — ${d.orderNumber}`,
    text: `Hi ${d.customerName},\n\nAfter review, we couldn't approve the refund for order ${d.orderNumber}.${d.note ? `\nNote: ${d.note}` : ""}\n\nReply to this email if you have questions.\n\n— Team HUNGRY Z`,
    html: wrap("Refund request update", `<p>Hi ${esc(d.customerName)}, after review we couldn't approve the refund for order <b>${esc(d.orderNumber)}</b>.</p>${d.note ? `<p>Note: ${esc(d.note)}</p>` : ""}<p>Reply to this email if you have questions.</p>`),
  };
}

export function adminRefundEmail(d: { stage: string; orderNumber: string; canteenName: string; customerEmail: string; amount: number; reason?: string; refundId?: string }): EmailContent {
  return {
    subject: `[HUNGRY Z alert] Refund ${d.stage} — ${d.orderNumber}`,
    text: `Refund ${d.stage}.\nOrder: ${d.orderNumber}\nCanteen: ${d.canteenName}\nCustomer: ${d.customerEmail}\nAmount: ₹${d.amount}${d.reason ? `\nReason: ${d.reason}` : ""}${d.refundId ? `\nRazorpay refund: ${d.refundId}` : ""}`,
    html: wrap(
      `Refund ${esc(d.stage)}`,
      `<p>Order: <b>${esc(d.orderNumber)}</b><br/>Canteen: ${esc(d.canteenName)}<br/>Customer: ${esc(d.customerEmail)}<br/>Amount: ${esc(rupee(d.amount))}${d.reason ? `<br/>Reason: ${esc(d.reason)}` : ""}${d.refundId ? `<br/>Razorpay refund: ${esc(d.refundId)}` : ""}</p>`,
    ),
  };
}

export function canteenDecisionEmail(kind: "approved" | "rejected", d: { canteenName: string; university: string; code?: string; ownerLoginId?: string; ownerLoginCode?: string; installUrl?: string }): EmailContent {
  const name = esc(d.canteenName);
  const uni = esc(d.university);
  if (kind === "approved") {
    const code = esc(d.code ?? "");
    const ownerLoginId = esc(d.ownerLoginId ?? "");
    const ownerLoginCode = esc(d.ownerLoginCode ?? "");
    const installUrl = esc(d.installUrl ?? "https://hungryz.vercel.app/install/canteen");
    const installLink = `<p><a href="${installUrl}" style="display:inline-block;background:#d1121b;color:#fff;padding:14px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Download HUNGRY Z Canteen Dashboard</a></p>`;
    return {
      subject: `Your HUNGRY Z canteen is approved — owner login credentials inside`,
      text: `Great news! ${d.canteenName} (${d.university}) has been approved on HUNGRY Z.\n\nDownload HUNGRY Z Canteen Dashboard: ${d.installUrl ?? "https://hungryz.vercel.app/install/canteen"}\n\nCanteen Owner ID (7 characters): ${d.ownerLoginId}\nUse this ID to identify your owner account at Canteen Owner Login.\n\nCanteen Owner Password Code (7 characters): ${d.ownerLoginCode}\nThis is your separate secret code for signing in to your owner dashboard. Keep it private. No account signup, password creation, or email verification is required.\n\nStudent/Faculty/Guest Canteen Code (7 characters): ${d.code}\nStudents, faculty, and guests enter this shared code in their HUNGRY Z account to join your canteen. It cannot access the owner dashboard.\n\n— Team HUNGRY Z`,
      html: wrap(
        "You're approved on HUNGRY Z!",
        `<p><b>${name}</b> (${uni}) has been verified.</p>${installLink}<p><b>Canteen Owner ID (7 characters)</b></p><p style="font-size:22px;letter-spacing:3px;font-family:monospace;background:#111;color:#fff;padding:14px 20px;border-radius:12px;display:inline-block">${ownerLoginId}</p><p>Use this ID to identify your owner account at Canteen Owner Login.</p><p><b>Canteen Owner Password Code (7 characters)</b></p><p style="font-size:28px;letter-spacing:8px;font-family:monospace;background:#111;color:#fff;padding:14px 20px;border-radius:12px;display:inline-block">${ownerLoginCode}</p><p>This is your separate secret code for signing in to your owner dashboard. Keep it private. No account signup, password creation, or email verification is required.</p><hr style="border-color:#333;margin:24px 0"/><p><b>Student/Faculty/Guest Canteen Code (7 characters)</b></p><p style="font-size:24px;letter-spacing:7px;font-family:monospace;background:#111;color:#fff;padding:12px 18px;border-radius:12px;display:inline-block">${code}</p><p>Students, faculty, and guests enter this shared code in their HUNGRY Z account to join your canteen. It cannot access the owner dashboard.</p>`,
      ),
    };
  }
  return {
    subject: `Update on your HUNGRY Z canteen application`,
    text: `Thank you for applying to HUNGRY Z with ${d.canteenName} (${d.university}).\n\nAfter review, we're unable to approve your application at this time. You're welcome to re-apply with updated details.\n\n— Team HUNGRY Z`,
    html: wrap("Application update", `<p>Thank you for applying to HUNGRY Z with <b>${name}</b> (${uni}).</p><p>After review, we're unable to approve your application at this time. You're welcome to re-apply with updated details.</p>`),
  };
}
