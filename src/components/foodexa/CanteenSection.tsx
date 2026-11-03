import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Store, KeyRound, CheckCircle2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getCanteenOwnerAccess, submitCanteenApplication } from "@/lib/hungry.functions";
import { applicationSchema } from "@/lib/access";
import { cn } from "@/lib/utils";
import { backendConfigured } from "@/lib/backend-config";
import { CanteenOwnerLoginForm } from "@/components/foodexa/CanteenOwnerLoginForm";

const field =
  "w-full rounded-2xl border border-input bg-ink-soft px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition focus:border-primary";

const fields: [keyof typeof labels, string, string?][] = [
  ["ownerName", "text"],
  ["ownerPhone", "tel"],
  ["contactEmail", "email"],
  ["canteenName", "text"],
  ["universityName", "text"],
  ["campusLocation", "text"],
  ["fssaiLicense", "text"],
  ["ownerIdProof", "text"],
];
const labels = {
  ownerName: "Owner full name",
  ownerPhone: "Owner phone number",
  contactEmail: "Contact email",
  canteenName: "Canteen name",
  universityName: "University / campus name",
  campusLocation: "Campus address / city",
  fssaiLicense: "FSSAI licence number",
  ownerIdProof: "Owner government ID (Aadhaar / PAN no.)",
};

export function CanteenSection() {
  const [mode, setMode] = useState<"register" | "login">("register");
  return (
    <section id="canteens" className="relative isolate overflow-hidden bg-background pb-24 pt-32">
      <div aria-hidden className="ember pointer-events-none absolute -right-40 top-10 -z-10 h-[420px] w-[420px] opacity-40" />
      <div className="mx-auto max-w-5xl px-5">
        <p className="text-[10px] tracking-[0.3em] text-primary-bright">FOR CANTEENS</p>
        <h2 className="display mt-3 text-4xl sm:text-6xl">Register your canteen.</h2>
        <p className="mt-4 max-w-xl text-sm text-muted-foreground">
          Bring your campus canteen to HUNGRY. Every canteen is verified by our team before it can accept orders.
        </p>
        <div className="mt-10 grid max-w-md grid-cols-2 rounded-full bg-ink p-1">
          {([["register", "Register a Canteen", Store], ["login", "Canteen Login", KeyRound]] as const).map(([k, l, Icon]) => (
            <button key={k} onClick={() => setMode(k)} className={cn("flex items-center justify-center gap-2 rounded-full py-2.5 text-xs font-semibold transition sm:text-sm", mode === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              <Icon className="h-4 w-4" /> {l}
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={mode} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="glass-red mt-6 rounded-[2rem] p-6 sm:p-8">
            {mode === "register" ? <RegisterForm /> : <DashboardLogin onRegister={() => setMode("register")} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

function RegisterForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [formErr, setFormErr] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormErr("");
    const parsed = applicationSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
      return setErrors(errs);
    }
    setErrors({});
    if (!backendConfigured) return setFormErr("Canteen registration opens once the HUNGRY database is connected. Please try again soon.");
    setBusy(true);
    try {
      await submitCanteenApplication({ data: parsed.data });
      setDone(true);
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : "Could not submit. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <div className="py-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary-bright" />
        <p className="display mt-4 text-2xl">Application submitted!</p>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          Verification usually takes 1–8 hours. We'll email you when your application is reviewed.
        </p>
      </div>
    );

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      {fields.map(([name, type]) => (
        <div key={name}>
          <input name={name} type={type} placeholder={labels[name]} aria-label={labels[name]} className={field} />
          {errors[name] && <p className="mt-1.5 text-xs text-primary-bright">{errors[name]}</p>}
        </div>
      ))}
      <div className="sm:col-span-2">
        <textarea name="notes" rows={3} maxLength={500} placeholder="Anything else we should know? (optional)" className={field} />
      </div>
      {formErr && <p className="text-sm text-primary-bright sm:col-span-2">{formErr}</p>}
      <button disabled={busy} className="rounded-full bg-primary py-4 text-sm font-semibold text-primary-foreground transition hover:shadow-[0_0_40px_-6px_var(--primary-bright)] disabled:opacity-60 sm:col-span-2">
        {busy ? "Submitting…" : "Submit application"}
      </button>
    </form>
  );
}

function DashboardLogin({ onRegister }: { onRegister: () => void }) {
  const ownerAccess = useServerFn(getCanteenOwnerAccess);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;
    const restoreOwnerDashboard = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) return;
        const access = await ownerAccess({ data: {} });
        if (active && access.linked && access.status === "approved") {
          window.location.replace("/canteen");
        }
      } catch {
        // If the saved session cannot be verified as an approved owner, keep the login form available.
      } finally {
        if (active) setCheckingSession(false);
      }
    };
    void restoreOwnerDashboard();
    return () => { active = false; };
  }, [ownerAccess]);

  if (checkingSession) {
    return <p role="status" className="text-sm text-muted-foreground">Checking for an existing owner session…</p>;
  }

  return (
    <div className="mx-auto max-w-md space-y-4 text-center">
      <p className="text-sm text-muted-foreground">
        Sign in with the Canteen Owner ID and Password Code sent after approval.
      </p>
      <CanteenOwnerLoginForm submitLabel="Open dashboard" onRegister={onRegister} />
    </div>
  );
}
