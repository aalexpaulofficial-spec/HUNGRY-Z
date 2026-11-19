import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

function allowedPushEndpoint(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length > 4096) return false;
  try {
    const endpoint = new URL(raw);
    const host = endpoint.hostname.toLowerCase();
    return (
      endpoint.protocol === "https:" &&
      !endpoint.username &&
      !endpoint.password &&
      (host === "fcm.googleapis.com" ||
        host === "web.push.apple.com" ||
        host === "push.services.mozilla.com" ||
        host.endsWith(".push.services.mozilla.com") ||
        host.endsWith(".notify.windows.com"))
    );
  } catch {
    return false;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!supabaseUrl || !serviceRoleKey || !token) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "Unauthorized" }, 401);

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return json({ error: "Invalid request" }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (body.action === "subscribe") {
    const subscription = body.subscription as
      { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | undefined;
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const authSecret = subscription?.keys?.auth;
    if (
      !allowedPushEndpoint(endpoint) ||
      typeof p256dh !== "string" ||
      p256dh.length > 256 ||
      typeof authSecret !== "string" ||
      authSecret.length > 128
    ) {
      return json({ error: "Invalid push subscription" }, 400);
    }

    const { error } = await admin.from("push_subscriptions").upsert(
      {
        user_id: auth.user.id,
        endpoint,
        p256dh,
        auth: authSecret,
        user_agent: (request.headers.get("user-agent") ?? "").slice(0, 1000),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
    if (error) {
      console.error("[push-subscription] registration failed", error.code);
      return json({ error: "Could not save this device" }, 500);
    }
    return json({ ok: true });
  }

  if (body.action === "unsubscribe") {
    if (!allowedPushEndpoint(body.endpoint)) return json({ error: "Invalid push endpoint" }, 400);
    const { error } = await admin
      .from("push_subscriptions")
      .delete()
      .eq("user_id", auth.user.id)
      .eq("endpoint", body.endpoint);
    if (error) {
      console.error("[push-subscription] removal failed", error.code);
      return json({ error: "Could not remove this device" }, 500);
    }
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
});
