// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyCheckoutSignature, verifyWebhookSignature } from "@/lib/razorpay-signature";

const secret = "test_secret_value";

describe("Razorpay signature verification", () => {
  it("accepts a genuine checkout signature", async () => {
    const sig = createHmac("sha256", secret).update("order_ABC123|pay_XYZ789").digest("hex");
    expect(await verifyCheckoutSignature({ orderId: "order_ABC123", paymentId: "pay_XYZ789", signature: sig, secret })).toBe(true);
  });
  it("rejects a signature for a different payment", async () => {
    const sig = createHmac("sha256", secret).update("order_ABC123|pay_OTHER").digest("hex");
    expect(await verifyCheckoutSignature({ orderId: "order_ABC123", paymentId: "pay_XYZ789", signature: sig, secret })).toBe(false);
  });
  it("rejects when the secret is missing", async () => {
    expect(await verifyCheckoutSignature({ orderId: "order_A", paymentId: "pay_B", signature: "00", secret: "" })).toBe(false);
  });
  it("accepts a genuine webhook and rejects a tampered body", async () => {
    const body = JSON.stringify({ event: "payment.captured", payload: {} });
    const sig = createHmac("sha256", secret).update(body).digest("hex");
    expect(await verifyWebhookSignature(body, sig, secret)).toBe(true);
    expect(await verifyWebhookSignature(body.replace("captured", "failed"), sig, secret)).toBe(false);
    expect(await verifyWebhookSignature(body, null, secret)).toBe(false);
  });
});
