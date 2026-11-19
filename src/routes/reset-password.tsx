import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — HUNGRY Z" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

const inputClass = "w-full rounded-2xl border border-input bg-ink-soft px-4 py-3.5 text-sm text-foreground outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_25%,transparent)]";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let recoveryAccepted = false;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const callbackError = hash.get("error_description") || hash.get("error") || query.get("error_description") || query.get("error");
    const isRecoveryCallback = hash.get("type") === "recovery" || query.get("type") === "recovery" || query.has("code") || query.has("token_hash");
    if (callbackError) {
      setError("This reset link is invalid, expired, or has already been used. Request a new password reset email.");
      setReady(true);
      return () => { active = false; };
    }
    const finishCheck = window.setTimeout(() => {
      if (!active || recoveryAccepted) return;
      setError("We couldn't verify this reset link. It may be invalid, expired, or already used. Request a new password reset email.");
      setReady(true);
    }, 12000);
    const acceptRecoverySession = () => {
      recoveryAccepted = true;
      setError("");
      setHasSession(true);
      setReady(true);
      // Remove one-time tokens from the address bar after Supabase has established
      // the recovery session, while keeping the reset screen and session intact.
      window.history.replaceState(window.history.state, "", window.location.pathname);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (session && (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && isRecoveryCallback))) acceptRecoverySession();
    });
    const tokenHash = query.get("token_hash");
    if (tokenHash && query.get("type") === "recovery") {
      void supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" }).then(({ data, error: verifyError }) => {
        if (!active || recoveryAccepted) return;
        if (!verifyError && data.session) acceptRecoverySession();
        else {
          setError("This reset link is invalid, expired, or has already been used. Request a new password reset email.");
          setReady(true);
        }
      }).catch(() => {
        if (!active) return;
        setError("We couldn't verify this reset link. Check your connection or request a new password reset email.");
        setReady(true);
      });
    } else {
      void supabase.auth.getSession().then(({ data, error: sessionError }) => {
        if (!active || recoveryAccepted) return;
        const callbackAccessToken = hash.get("access_token");
        if (!sessionError && data.session && hash.get("type") === "recovery" && callbackAccessToken === data.session.access_token) acceptRecoverySession();
        else {
          setError("This reset link is invalid, expired, or has already been used. Request a new password reset email.");
          setReady(true);
        }
      }).catch(() => {
        if (!active) return;
        setError("We couldn't verify this reset link. Check your connection or request a new password reset email.");
        setReady(true);
      });
    }
    return () => {
      active = false;
      window.clearTimeout(finishCheck);
      subscription.unsubscribe();
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const passwordSchema = z.string().min(8, "Use at least 8 characters.").max(72, "Use 72 characters or fewer.");
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Enter a valid password.");
    if (password !== confirmPassword) return setError("The passwords do not match.");
    setBusy(true);
    let updateError: { code?: string; message?: string } | null = null;
    try {
      updateError = (await supabase.auth.updateUser({ password })).error;
    } catch {
      setBusy(false);
      return setError("We couldn't update your password. Check your connection and try again.");
    }
    if (updateError) {
      setBusy(false);
      const code = "code" in updateError ? String(updateError.code) : "";
      if (["session_not_found", "bad_jwt", "otp_expired", "flow_state_expired"].includes(code)) {
        return setError("This reset link is invalid, expired, or has already been used. Request a new password reset email.");
      }
      return setError(updateError.message || "We couldn't update your password. Please try again.");
    }
    // A local sign-out prevents the login page from sending the recovered user
    // straight into the app with the recovery session.
    await Promise.resolve(supabase.auth.signOut({ scope: "local" })).catch(() => undefined);
    setBusy(false);
    setMessage("Your password has been updated. Redirecting you to Login…");
    window.setTimeout(() => {
      void navigate({ to: "/auth", search: { mode: "login" }, replace: true });
    }, 1600);
  }

  return (
    <main className="hz-auth-page grain relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <ThemeToggle className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6" />
      <div className="ember anim-pulse-glow pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2" />
      <section className="hz-auth-panel glass-red anim-rise relative w-full max-w-md rounded-[2rem] p-6 sm:p-8">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2.5">
          <img src="/HUNGRY%20Z%20Q%20LOGO.png" alt="" className="h-8 w-8 rounded-lg object-contain" />
          <span className="display text-[15px] tracking-[0.3em]">HUNGRY Z</span>
        </Link>
        <h1 className="display text-center text-2xl">Set a new password</h1>
        {!ready ? <p role="status" className="mt-5 text-center text-sm text-muted-foreground">Checking your secure reset link…</p> : hasSession ? (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block space-y-2 text-sm text-muted-foreground">
              <span>New Password</span>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} name="password" autoComplete="new-password" minLength={8} maxLength={72} required value={password} onChange={(event) => setPassword(event.currentTarget.value)} className={`${inputClass} pr-12`} />
                <button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "Hide new password" : "Show new password"} aria-pressed={showPassword} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground">
                  {showPassword ? <EyeOff aria-hidden="true" className="h-5 w-5" /> : <Eye aria-hidden="true" className="h-5 w-5" />}
                </button>
              </div>
            </label>
            <label className="block space-y-2 text-sm text-muted-foreground">
              <span>Confirm Password</span>
              <div className="relative">
                <input type={showConfirmPassword ? "text" : "password"} name="confirmPassword" autoComplete="new-password" minLength={8} maxLength={72} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.currentTarget.value)} className={`${inputClass} pr-12`} />
                <button type="button" onClick={() => setShowConfirmPassword((shown) => !shown)} aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"} aria-pressed={showConfirmPassword} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground">
                  {showConfirmPassword ? <EyeOff aria-hidden="true" className="h-5 w-5" /> : <Eye aria-hidden="true" className="h-5 w-5" />}
                </button>
              </div>
            </label>
            {error && <p role="alert" className="text-sm text-primary-bright">{error}</p>}
            {message && <p role="status" className="text-sm text-emerald-500">{message}</p>}
            {!message && <button disabled={busy} className="w-full rounded-full bg-primary py-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{busy ? "Updating…" : "Update Password"}</button>}
          </form>
        ) : <p role="alert" className="mt-5 text-center text-sm leading-relaxed text-muted-foreground">{error || "This reset link is invalid, expired, or has already been used. Request a new password reset email from the login page."}</p>}
        {ready && <p className="mt-5 text-center text-sm text-muted-foreground"><Link to="/auth" search={{ mode: "login" }} className="text-primary-bright underline underline-offset-2">Return to Login</Link></p>}
      </section>
    </main>
  );
}
