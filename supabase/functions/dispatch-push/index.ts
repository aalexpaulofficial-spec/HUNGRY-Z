import { send } from "@portable/web-push";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:hungryofficialx@gmail.com";
  if (!url || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    console.error("[push-dispatch] required Edge Function secrets are not configured");
    return json({ error: "Push service is not configured" }, 503);
  }

  let notificationId = "";
  try {
    const body = (await request.json()) as { notification_id?: unknown };
    if (typeof body.notification_id === "string" && /^[0-9a-f-]{36}$/i.test(body.notification_id)) {
      notificationId = body.notification_id;
    }
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!notificationId) return json({ error: "Invalid notification ID" }, 400);

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: notification, error: notificationError } = await admin
    .from("notifications")
    .select("id,recipient_user_id,title,body,href")
    .eq("id", notificationId)
    .maybeSingle();
  if (notificationError || !notification) return json({ error: "Notification not found" }, 404);

  const { data: subscriptions, error: subscriptionsError } = await admin
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .eq("user_id", notification.recipient_user_id);
  if (subscriptionsError) {
    console.error("[push-dispatch] subscription lookup failed", subscriptionsError.code);
    return json({ error: "Could not load subscriptions" }, 500);
  }

  const result = { delivered: 0, expired: 0, failed: 0, skipped: 0 };
  await Promise.all(
    (subscriptions ?? []).map(async (row) => {
      const { data: deliveryId, error: claimError } = await admin.rpc("hz_claim_push_delivery", {
        p_notification_id: notification.id,
        p_subscription_id: row.id,
      });
      if (claimError || !deliveryId) {
        result.skipped++;
        return;
      }

      const subscription = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };
      try {
        const response = await send({
          subscription,
          payload: JSON.stringify({
            title: notification.title,
            body: notification.body,
            href: notification.href,
            notificationId: notification.id,
          }),
          vapid: { subject: vapidSubject, publicKey: vapidPublicKey, privateKey: vapidPrivateKey },
          ttl: 60 * 60 * 24,
          urgency: "normal",
        });
        if (response.kind === "gone") {
          await admin.from("push_subscriptions").delete().eq("id", row.id);
          result.expired++;
          return;
        }
        await admin
          .from("push_notification_deliveries")
          .update({
            status: "sent",
            last_status: response.status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", deliveryId);
        result.delivered++;
      } catch (error) {
        const status =
          error &&
          typeof error === "object" &&
          "status" in error &&
          typeof error.status === "number"
            ? error.status
            : null;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", row.id);
          result.expired++;
          return;
        }
        // Avoid storing provider response bodies or endpoint URLs in database/logs.
        await admin
          .from("push_notification_deliveries")
          .update({ status: "failed", last_status: status, updated_at: new Date().toISOString() })
          .eq("id", deliveryId);
        console.error("[push-dispatch] delivery failed", status ?? "network_error");
        result.failed++;
      }
    }),
  );

  return json({ ok: true, ...result });
});
