// Razorpay signature checks using Web Crypto (works on the server runtime).
// Server-only in practice: callers must pass secrets read from process.env.

const enc = new TextEncoder();

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Checkout success signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export async function verifyCheckoutSignature(p: { orderId: string; paymentId: string; signature: string; secret: string }) {
  if (!p.secret || !p.signature) return false;
  const expected = await hmacSha256Hex(p.secret, `${p.orderId}|${p.paymentId}`);
  return timingSafeEqual(expected, p.signature.trim().toLowerCase());
}

/** Webhook signature = HMAC_SHA256(raw request body, webhook_secret). */
export async function verifyWebhookSignature(rawBody: string, signature: string | null, secret: string) {
  if (!secret || !signature) return false;
  const expected = await hmacSha256Hex(secret, rawBody);
  return timingSafeEqual(expected, signature.trim().toLowerCase());
}
