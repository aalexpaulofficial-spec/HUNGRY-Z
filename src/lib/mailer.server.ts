// Sends HUNGRY emails from the Gmail account over SMTP (TLS, port 465) and logs every
// attempt to public.email_logs. The App Password lives only in the GMAIL_APP_PASSWORD secret.
// Email failures never undo a confirmed order, payment or refund — they are logged for the admin.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { EmailContent, EmailKind } from "@/lib/email-templates";

export type SendResult = { sent: boolean; reason?: string };

function sender() {
  return (process.env["GMAIL_USER"] ?? "hungryofficialx@gmail.com").trim();
}

async function deliver(to: string, msg: EmailContent, user: string, pass: string) {
  const isWorker = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
  if (isWorker) {
    const { WorkerMailer } = await import("worker-mailer");
    await WorkerMailer.send(
      { host: "smtp.gmail.com", port: 465, secure: true, credentials: { username: user, password: pass }, authType: "plain" },
      { from: { name: "HUNGRY", email: user }, to: { email: to }, subject: msg.subject, text: msg.text, html: msg.html },
    );
  } else {
    const nodemailer = await import("nodemailer");
    const t = nodemailer.default.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
    await t.sendMail({ from: `"HUNGRY" <${user}>`, to, subject: msg.subject, text: msg.text, html: msg.html });
  }
}

async function log(row: { kind: string; recipient: string; subject: string; status: "sent" | "failed" | "skipped"; error?: string | undefined; attempts: number; ref_id?: string | undefined }) {
  try {
    await supabaseAdmin.from("email_logs").insert({ ...row, error: row.error?.slice(0, 500) ?? null, ref_id: row.ref_id ?? null });
  } catch (e) {
    console.error("[mailer] could not write email log", e instanceof Error ? e.message : e);
  }
}

export async function sendEmail(kind: EmailKind, to: string, msg: EmailContent, refId?: string): Promise<SendResult> {
  const recipient = to.trim().toLowerCase();
  const pass = (process.env["GMAIL_APP_PASSWORD"] ?? "").replace(/\s+/g, "");
  if (!pass) {
    console.warn(`[mailer] GMAIL_APP_PASSWORD not set; skipped ${kind} email`);
    await log({ kind, recipient, subject: msg.subject, status: "skipped", error: "GMAIL_APP_PASSWORD not configured", attempts: 0, ref_id: refId });
    return { sent: false, reason: "email_not_configured" };
  }
  const user = sender();
  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await deliver(recipient, msg, user, pass);
      await log({ kind, recipient, subject: msg.subject, status: "sent", attempts: attempt, ref_id: refId });
      return { sent: true };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      console.error(`[mailer] ${kind} attempt ${attempt} failed: ${lastError}`);
      if (attempt === 1) await new Promise((r) => setTimeout(r, 1200));
    }
  }
  await log({ kind, recipient, subject: msg.subject, status: "failed", error: lastError, attempts: 2, ref_id: refId });
  return { sent: false, reason: "send_failed" };
}

/** Sequential retries of the same business event do not send duplicate messages. */
export async function sendEmailOnce(kind: EmailKind, to: string, msg: EmailContent, refId: string): Promise<SendResult> {
  const recipient = to.trim().toLowerCase();
  const { data, error } = await supabaseAdmin.from("email_logs")
    .select("id")
    .eq("kind", kind)
    .eq("recipient", recipient)
    .eq("ref_id", refId)
    .eq("status", "sent")
    .limit(1)
    .maybeSingle();
  if (!error && data) return { sent: true, reason: "already_sent" };
  return sendEmail(kind, recipient, msg, refId);
}
