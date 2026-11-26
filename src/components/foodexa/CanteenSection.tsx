import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Store, KeyRound, CheckCircle2, FileUp } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createCanteenApplicationPhotoUploadUrl, getCanteenOwnerAccess, submitCanteenApplication } from "@/lib/hungry.functions";
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
];
const labels = {
  ownerName: "Owner full name",
  ownerPhone: "Owner phone number",
  contactEmail: "Contact email",
  canteenName: "Canteen name",
  universityName: "University / campus name",
  campusLocation: "Campus address / city",
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
          Bring your campus canteen to HUNGRY Z. Our team reviews every application before the canteen can accept orders.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <p className="inline-flex rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-[10px] font-bold tracking-[0.16em] text-primary-bright">
            FREE FOR CANTEEN OWNERS
          </p>
          <p className="inline-flex rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-[10px] font-bold tracking-[0.12em] text-primary-bright">
            OWNER CREDENTIALS EMAILED WITHIN 1 MINUTE OF APPROVAL
          </p>
        </div>
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
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [canteenPhoto, setCanteenPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const uploadPhotoUrl = useServerFn(createCanteenApplicationPhotoUploadUrl);
  const submitApplication = useServerFn(submitCanteenApplication);

  useEffect(() => {
    if (!canteenPhoto) {
      setPhotoPreview("");
      return;
    }
    const preview = URL.createObjectURL(canteenPhoto);
    setPhotoPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [canteenPhoto]);

  function selectCanteenPhoto(file?: File) {
    setPhotoError("");
    if (!file) {
      setCanteenPhoto(null);
      return;
    }
    if (!(file.type in CANTEEN_PHOTO_TYPES)) {
      setCanteenPhoto(null);
      setPhotoError("Choose a JPG, PNG, WebP, or AVIF image.");
      return;
    }
    if (file.size === 0 || file.size > 8 * 1024 * 1024) {
      setCanteenPhoto(null);
      setPhotoError("The canteen photo must be 8 MB or smaller.");
      return;
    }
    setCanteenPhoto(file);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormErr("");
    const formValues = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = applicationSchema.safeParse(formValues);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
      return setErrors(errs);
    }
    setErrors({});
    if (!backendConfigured) return setFormErr("Canteen registration opens once the HUNGRY Z database is connected. Please try again soon.");
    setBusy(true);
    let photoPath: string | null = null;
    try {
      if (canteenPhoto) {
        const target = await uploadPhotoUrl({ data: { contentType: canteenPhoto.type as keyof typeof CANTEEN_PHOTO_TYPES } });
        photoPath = target.path;
        const { error } = await supabase.storage.from("canteen-registration-documents").uploadToSignedUrl(target.path, target.token, canteenPhoto, {
          cacheControl: "3600",
          contentType: canteenPhoto.type,
        });
        if (error) throw new Error("Could not upload the canteen photo. Please try again.");
      }
      const result = await submitApplication({ data: { application: parsed.data, photoPath } });
      setConfirmationEmailSent(result.emailSent === true);
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
        {confirmationEmailSent ? (
          <p role="status" className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Thank you for registering with HUNGRY Z! A confirmation email has been sent to your registered email address. Please check your Inbox. If you cannot find it, kindly check your Spam or Junk folder.
          </p>
        ) : (
          <p role="status" className="mx-auto mt-3 max-w-md text-sm text-amber-700 dark:text-amber-300">
            Your application was submitted successfully, but delivery of the confirmation email could not be confirmed. Your application is awaiting admin verification. Please check your email later or contact HUNGRY Z support.
          </p>
        )}
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
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-foreground">Canteen photo <span className="text-muted-foreground">(optional)</span></span>
          <span className="flex flex-wrap items-center gap-3">
            <input type="file" name="canteenPhoto" accept="image/jpeg,image/png,image/webp,image/avif" aria-label="Upload canteen photo" onChange={(event) => selectCanteenPhoto(event.currentTarget.files?.[0])} disabled={busy} className="sr-only" />
            <span className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-5 py-3 text-sm font-semibold text-foreground transition hover:border-primary hover:bg-primary/15">
              <FileUp aria-hidden="true" className="h-4 w-4 text-primary-bright" /> Choose canteen photo
            </span>
            <span className="min-w-0 break-all text-sm text-muted-foreground" aria-live="polite">{canteenPhoto?.name ?? "No photo selected"}</span>
          </span>
        </label>
        <p className="mt-1.5 text-xs text-muted-foreground">JPG, PNG, WebP, or AVIF · Maximum 8 MB</p>
        {photoError && <p role="alert" className="mt-1.5 text-xs text-primary-bright">{photoError}</p>}
        {photoPreview && <img src={photoPreview} alt="Canteen photo preview" className="mt-3 max-h-48 max-w-full rounded-2xl border border-border object-cover" />}
      </div>
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

const CANTEEN_PHOTO_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
} as const;

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
        Sign in with your 7-character Canteen Owner ID and Password Code. We’ll email both within one minute after your canteen is approved.
      </p>
      <CanteenOwnerLoginForm submitLabel="Open dashboard" onRegister={onRegister} />
    </div>
  );
}
