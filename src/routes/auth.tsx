import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { loginSchema, signupSchema, roles, type Role } from "@/lib/access";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { ensureWelcomeEmail } from "@/lib/hungry.functions";
import { backendConfigured } from "@/lib/backend-config";
import { SetupNotice } from "@/components/SetupNotice";
import { Eye, EyeOff } from "lucide-react";
import { useBackNavigationEnabled } from "@/lib/back-nav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SocialIconLinks } from "@/components/foodexa/SocialIconLinks";
import { readStoredDashboardLanguage, translateDashboardText } from "@/lib/dashboard-language";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ mode: z.enum(["login", "signup"]).optional(), orderId: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: "Sign in to HUNGRY Z — Campus Food Ordering" },
      { name: "description", content: "Create your HUNGRY Z account as a student, faculty member or guest, or log in." },
      { property: "og:title", content: "Sign in to HUNGRY Z" },
      { property: "og:description", content: "Create your HUNGRY Z account or log in to order campus food." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "manifest", href: "/manifest-student.webmanifest" }, { rel: "icon", href: "/HUNGRY%20Z%20Q%20LOGO.png", type: "image/png" }],
  }),
  component: AuthPage,
});

const field =
  "w-full rounded-2xl border border-input bg-ink-soft px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_25%,transparent)]";

function AuthPage() {
  const { mode: initial, orderId } = Route.useSearch();
  const [mode, setMode] = useState<"login" | "signup">(initial ?? "signup");
  const [language, setLanguage] = useState<"en" | "hi" | "kn">("en");
  const standaloneApp = !useBackNavigationEnabled();
  const navigate = useNavigate();
  const t = (value: string) => translateDashboardText(value, language);

  useEffect(() => {
    setLanguage(readStoredDashboardLanguage());
    const updateLanguage = () => setLanguage(readStoredDashboardLanguage());
    window.addEventListener("storage", updateLanguage);
    return () => window.removeEventListener("storage", updateLanguage);
  }, []);

  useEffect(() => {
    if (!backendConfigured) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/app", search: orderId ? { orderId } : {}, replace: true });
    });
  }, [navigate, orderId]);

  if (!backendConfigured) return <SetupNotice />;

  const brand = (
    <>
      <img src="/HUNGRY%20Z%20Q%20LOGO.png" alt="" className="h-8 w-8 rounded-lg object-contain" />
      <span className="display text-[15px] tracking-[0.3em]">HUNGRY Z</span>
    </>
  );

  return (
    <div className="grain relative min-h-screen overflow-x-hidden bg-background px-4 py-10">
      <ThemeToggle className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6" />
      <div className="ember anim-pulse-glow pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2" />
      <div className="relative mx-auto w-full max-w-md">
        {standaloneApp ? (
          <div aria-label="HUNGRY Z" className="mb-8 flex items-center justify-center gap-2.5">{brand}</div>
        ) : (
          <a href="/" className="mb-8 flex items-center justify-center gap-2.5">{brand}</a>
        )}

        <div className="glass-red anim-rise rounded-[2rem] p-6 sm:p-8">
          <div className="mb-6 grid grid-cols-2 rounded-full bg-ink p-1">
            {(["signup", "login"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-full py-2.5 text-sm font-semibold transition",
                  mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "signup" ? t("Create Account") : t("Login")}
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              {mode === "signup" ? <SignupForm orderId={orderId} language={language} onDone={() => setMode("login")} /> : <LoginForm orderId={orderId} language={language} />}
            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}

function ErrorText({ msg }: { msg?: string | undefined }) {
  return msg ? <p className="mt-1.5 text-xs text-primary-bright">{msg}</p> : null;
}

function SignupForm({ onDone, orderId, language }: { onDone: () => void; orderId?: string; language: "en" | "hi" | "kn" }) {
  const t = (value: string) => translateDashboardText(value, language);
  const [role, setRole] = useState<Role>("student");
  const [errors, setErrors] = useState<Partial<Record<"fullName"|"registrationNumber"|"email"|"password"|"accessCode"|"role", string>>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const welcome = useServerFn(ensureWelcomeEmail);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    const fd = new FormData(e.currentTarget);
    const parsed = signupSchema.safeParse({ ...Object.fromEntries(fd), role });
    if (!parsed.success) {
      const errs: Record<string, string> = {} as Record<string, string>;
      parsed.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
      setErrors(errs as never);
      return;
    }
    setErrors({});
    const v = parsed.data;
    setBusy(true);
    const emailRedirect = new URL("/app", window.location.origin);
    if (orderId) emailRedirect.searchParams.set("orderId", orderId);
    const { data: signed, error } = await supabase.auth.signUp({
      email: v.email,
      password: v.password,
      options: {
        emailRedirectTo: emailRedirect.toString(),
        data: {
          role: v.role,
          full_name: v.fullName,
          registration_number: v.registrationNumber,
        },
      },
    });
    if (error) {
      setBusy(false);
      return setFormError(error.message);
    }
    // Registration succeeded. Send the welcome email now if we have a session;
    // otherwise it is sent on the first login (after email confirmation).
    if (signed.session) await welcome().catch(() => {});
    setBusy(false);
    await supabase.auth.signOut();
    setSent(v.email);
  }

  if (sent)
    return (
      <div className="py-6 text-center">
        <div className="display text-2xl">Account created</div>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("Log in with")} <span className="text-foreground">{sent}</span> {t("and your password to continue.")}
        </p>
        <button onClick={onDone} className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">
          {t("Go to Login")}
        </button>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground">{t("I am a")}</label>
        <div className="grid grid-cols-3 gap-2">
          {roles.map((r) => (
            <button
              type="button"
              key={r}
              onClick={() => setRole(r)}
              className={cn(
                "rounded-2xl border py-3 text-sm font-semibold capitalize transition",
                role === r ? "border-primary bg-primary/15 text-foreground" : "border-input text-muted-foreground hover:border-primary/50",
              )}
            >
              {t(r)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <input name="fullName" placeholder={t("Full name")} className={field} autoComplete="name" />
        <ErrorText msg={errors.fullName} />
      </div>
      <div>
        <input
          name="registrationNumber"
          placeholder={t(role === "guest" ? "Registration number (optional)" : "Registration number")}
          className={field}
        />
        <ErrorText msg={errors.registrationNumber} />
      </div>
      <div>
        <input name="email" type="email" placeholder={t("Email")} className={field} autoComplete="email" />
        <ErrorText msg={errors.email} />
      </div>
      <div>
        <div className="relative">
          <input name="password" type={showPassword ? "text" : "password"} placeholder={t("Password (8+ characters)")} className={`${field} pr-12`} autoComplete="new-password" />
          <button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        <ErrorText msg={errors.password} />
      </div>
      {formError && <p className="text-sm text-primary-bright">{t(formError)}</p>}
      <button disabled={busy} className="w-full rounded-full bg-primary py-4 text-sm font-semibold text-primary-foreground transition hover:shadow-[0_0_40px_-6px_var(--primary-bright)] disabled:opacity-60">
          {busy ? t("Creating account…") : t("Create Account")}
      </button>
    </form>
  );
}

function LoginForm({ orderId, language }: { orderId?: string; language: "en" | "hi" | "kn" }) {
  const navigate = useNavigate();
  const [errors, setErrors] = useState<Partial<Record<"fullName"|"registrationNumber"|"email"|"password"|"accessCode"|"role", string>>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const t = (value: string) => translateDashboardText(value, language);

  useEffect(() => {
    if (!helpOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setHelpOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [helpOpen]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    const parsed = loginSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!parsed.success) {
      const errs: Record<string, string> = {} as Record<string, string>;
      parsed.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
      return setErrors(errs as never);
    }
    setErrors({});
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (error) return setFormError(error.message === "Email not confirmed" ? "Please confirm your email first." : "Wrong email or password.");
    navigate({ to: "/app", search: orderId ? { orderId } : {}, replace: true });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <input name="email" type="email" placeholder={t("Email")} className={field} autoComplete="email" />
        <ErrorText msg={errors.email} />
      </div>
      <div>
        <div className="relative">
          <input name="password" type={showPassword ? "text" : "password"} placeholder={t("Password")} className={`${field} pr-12`} autoComplete="current-password" />
          <button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        <ErrorText msg={errors.password} />
      </div>
      {formError && <p className="text-sm text-primary-bright">{t(formError)}</p>}
      <button disabled={busy} className="w-full rounded-full bg-primary py-4 text-sm font-semibold text-primary-foreground transition hover:shadow-[0_0_40px_-6px_var(--primary-bright)] disabled:opacity-60">
        {busy ? t("Logging in…") : t("Login")}
      </button>
      <button type="button" onClick={() => setHelpOpen(true)} className="-mt-1 block w-full text-center text-xs text-muted-foreground underline decoration-primary/50 underline-offset-4 transition hover:text-primary-bright">
        {t("Forgot your password or having trouble logging in?")}
      </button>
      <div className="border-t border-border/70 pt-4 text-center">
        <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground">{t("Follow & Join HUNGRY Z")}</p>
        <SocialIconLinks />
      </div>
      {helpOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setHelpOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="login-help-title" className="glass-red relative w-full max-w-sm rounded-3xl border border-primary/30 p-6 shadow-[0_24px_80px_-20px_rgba(220,20,40,0.55)]">
            <button type="button" onClick={() => setHelpOpen(false)} aria-label={t("Close")} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-xl text-muted-foreground transition hover:bg-primary/10 hover:text-foreground">×</button>
            <h2 id="login-help-title" className="display pr-8 text-lg">{t("Login help")}</h2>
            <p className="mt-4 text-sm leading-relaxed text-foreground">
              {t("Please contact our support team at")} <a href="mailto:hungryofficialx@gmail.com" className="font-bold text-primary-bright underline underline-offset-2">hungryofficialx@gmail.com</a> {t("for assistance.")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{t("We're happy to help!")}</p>
            <button type="button" onClick={() => setHelpOpen(false)} className="mt-6 w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:shadow-[0_0_32px_-8px_var(--primary-bright)]">{t("OK")}</button>
          </section>
        </div>
      )}
    </form>
  );
}
