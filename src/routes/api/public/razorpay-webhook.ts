import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Razorpay → Dashboard → Settings → Webhooks → URL: https://<your-site>/api/public/razorpay-webhook
// Events: payment.authorized, payment.captured, payment.failed, order.paid, refund.processed, refund.failed
// Every request must carry a valid X-Razorpay-Signature (HMAC of the raw body with RAZORPAY_WEBHOOK_SECRET).

const eventSchema = z.object({
  event: z.string().max(80),
  payload: z.object({
    payment: z.object({ entity: z.object({ id: z.string().max(60), order_id: z.string().max(60).nullable().optional() }).passthrough() }).optional(),
    refund: z.object({ entity: z.object({ id: z.string().max(60), payment_id: z.string().max(60).optional(), status: z.string().optional() }).passthrough() }).optional(),
  }).passthrough(),
});

export const Route = createFileRoute("/api/public/razorpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = (process.env["RAZORPAY_WEBHOOK_SECRET"] ?? "").trim();
        if (!secret) return new Response("Webhook not configured", { status: 503 });
        const raw = await request.text();
        if (raw.length > 512_000) return new Response("Payload too large", { status: 413 });

        const { verifyWebhookSignature } = await import("@/lib/razorpay-signature");
        if (!(await verifyWebhookSignature(raw, request.headers.get("x-razorpay-signature"), secret))) {
          return new Response("Invalid signature", { status: 401 });
        }

        let parsed: z.infer<typeof eventSchema>;
        try {
          parsed = eventSchema.parse(JSON.parse(raw));
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const pay = parsed.payload.payment?.entity;
        const refund = parsed.payload.refund?.entity;
        const eventId = request.headers.get("x-razorpay-event-id") ?? `${parsed.event}:${pay?.id ?? refund?.id ?? "unknown"}`;

        // Deduplicate repeated deliveries.
        const { error: insErr } = await db.from("payment_events").insert({
          event_id: eventId.slice(0, 120),
          event_type: parsed.event,
          razorpay_order_id: pay?.order_id ?? null,
          razorpay_payment_id: pay?.id ?? refund?.payment_id ?? null,
          payload: JSON.parse(raw),
        });
        if (insErr) {
          const { data: prev } = await db.from("payment_events").select("processed_at").eq("event_id", eventId.slice(0, 120)).maybeSingle();
          if (prev?.processed_at) return Response.json({ ok: true, duplicate: true });
        }

        try {
          const orders = await import("@/lib/orders.server");
          switch (parsed.event) {
            case "payment.authorized":
            case "payment.captured":
            case "order.paid":
              if (pay?.order_id) await orders.confirmOnlinePayment({ razorpayOrderId: pay.order_id, razorpayPaymentId: pay.id, signatureVerified: false });
              break;
            case "payment.failed":
              if (pay?.order_id) await orders.recordFailedPayment({ razorpayOrderId: pay.order_id, razorpayPaymentId: pay.id });
              break;
            case "refund.processed":
              if (refund) await orders.finalizeRefund(refund.id, "processed");
              break;
            case "refund.failed":
              if (refund) await orders.finalizeRefund(refund.id, "failed");
              break;
            default:
              break;
          }
          await db.from("payment_events").update({ processed_at: new Date().toISOString(), error: null }).eq("event_id", eventId.slice(0, 120));
          return Response.json({ ok: true });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`[razorpay-webhook] ${parsed.event} failed: ${msg}`);
          await db.from("payment_events").update({ error: msg.slice(0, 500) }).eq("event_id", eventId.slice(0, 120));
          // Non-2xx makes Razorpay retry later; handlers are idempotent.
          return new Response("Processing failed", { status: 500 });
        }
      },
    },
  },
});
