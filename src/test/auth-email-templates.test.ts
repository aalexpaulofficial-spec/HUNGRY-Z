import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const templateRoot = path.resolve(__dirname, "../../supabase/templates");
const authTemplates = [
  "confirmation.html",
  "recovery.html",
  "invite.html",
  "magic_link.html",
  "email_change.html",
  "reauthentication.html",
  "password_changed_notification.html",
  "email_changed_notification.html",
];

describe("branded Supabase Auth email templates", () => {
  it.each(authTemplates)("includes the full HUNGRY Z identity in %s", (file) => {
    const html = readFileSync(path.join(templateRoot, file), "utf8");
    expect(html).toContain("https://hungryz.vercel.app/HUNGRY%20Z%20Q%20LOGO.png");
    expect(html).toContain("HUNGRY Z</p>");
    expect(html).toContain("— Team HUNGRY Z");
    expect(html).toContain("https://hungryz.vercel.app/email-instagram.png");
    expect(html).toContain("https://hungryz.vercel.app/email-whatsapp.png");
    expect(html).toContain("https://hungryz.vercel.app/email-linkedin.png");
    expect(html).toContain('href="https://hungryz.vercel.app/" style="color:#555;text-decoration:underline">Privacy Policy</a>');
    expect(html).toContain('href="https://hungryz.vercel.app/" style="color:#555;text-decoration:underline">Terms &amp; Conditions</a>');
    expect(html).toContain('href="https://whatsapp.com/channel/0029Vb9EpYJ0G0XmfZmSme1H" aria-label="WhatsApp Community"');
    expect(html).not.toMatch(/hungryofficial\.vercel\.app|hungryzq\.vercel\.app/i);
  });

  it("keeps Supabase verification and recovery token URLs intact", () => {
    expect(readFileSync(path.join(templateRoot, "confirmation.html"), "utf8")).toContain("{{ .ConfirmationURL }}");
    expect(readFileSync(path.join(templateRoot, "recovery.html"), "utf8")).toContain("{{ .ConfirmationURL }}");
  });
});
