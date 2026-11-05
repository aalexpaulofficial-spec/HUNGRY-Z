import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Store, KeyRound, CheckCircle2, FileUp } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createCanteenDocumentUploadUrls, getCanteenOwnerAccess, submitCanteenApplicationWithDocuments } from "@/lib/hungry.functions";
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
          Bring your campus canteen to HUNGRY Z. Every canteen is verified by our team before it can accept orders.
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
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [fssaiDocument, setFssaiDocument] = useState<File | null>(null);
  const [ownerIdDocument, setOwnerIdDocument] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const uploadUrls = useServerFn(createCanteenDocumentUploadUrls);
  const submitApplication = useServerFn(submitCanteenApplicationWithDocuments);

  function selectDocument(key: "fssaiDocument" | "ownerIdDocument", file?: File) {
    setErrors((current) => ({ ...current, [key]: "" }));
    if (!file) {
      if (key === "fssaiDocument") setFssaiDocument(null);
      else setOwnerIdDocument(null);
      setUploadProgress((current) => ({ ...current, [key]: -1 }));
      return;
    }
    if (key === "fssaiDocument") setFssaiDocument(null);
    else setOwnerIdDocument(null);
    if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf")) {
      setErrors((current) => ({ ...current, [key]: "Choose a PDF file." }));
      return;
    }
    if (file.size === 0 || file.size > 10 * 1024 * 1024) {
      setErrors((current) => ({ ...current, [key]: "PDF must be 10 MB or smaller." }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const bytes = reader.result;
      if (bytes instanceof ArrayBuffer && String.fromCharCode(...new Uint8Array(bytes)) === "%PDF-") {
        if (key === "fssaiDocument") setFssaiDocument(file);
        else setOwnerIdDocument(file);
        setUploadProgress((current) => ({ ...current, [key]: -1 }));
      } else setErrors((current) => ({ ...current, [key]: "This file is not a valid PDF document." }));
    };
    reader.onerror = () => setErrors((current) => ({ ...current, [key]: "Could not read this PDF. Please select it again." }));
    reader.readAsArrayBuffer(file.slice(0, 5));
  }

  function uploadPdf(signedUrl: string, file: File, key: "fssaiDocument" | "ownerIdDocument") {
    return new Promise<void>((resolve, reject) => {
      const request = new XMLHttpRequest();
      setUploadProgress((current) => ({ ...current, [key]: 0 }));
      request.open("PUT", signedUrl);
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseKey) {
        reject(new Error("Secure upload is unavailable because the HUNGRY Z database is not configured."));
        return;
      }
      request.setRequestHeader("apikey", supabaseKey);
      request.setRequestHeader("Content-Type", "application/pdf");
      request.setRequestHeader("cache-control", "max-age=3600");
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) setUploadProgress((current) => ({ ...current, [key]: Math.round(event.loaded / event.total * 100) }));
      };
      request.onload = () => {
        if (request.status >= 200 && request.status < 300) {
          setUploadProgress((current) => ({ ...current, [key]: 100 }));
          resolve();
        } else reject(new Error("Secure upload failed. Please try again."));
      };
      request.onerror = () => reject(new Error("Network error while uploading. Please try again."));
      request.onabort = () => reject(new Error("Upload was interrupted. Please try again."));
      request.send(file);
    });
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormErr("");
    const formValues = Object.fromEntries([...new FormData(e.currentTarget)].filter(([key]) => !["fssaiDocument", "ownerIdDocument"].includes(key)));
    const parsed = applicationSchema.safeParse(formValues);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
      if (!fssaiDocument) errs.fssaiDocument = "Upload the FSSAI licence document PDF.";
      if (!ownerIdDocument) errs.ownerIdDocument = "Upload the owner's Aadhaar / PAN PDF.";
      return setErrors(errs);
    }
    if (!fssaiDocument || !ownerIdDocument) {
      setErrors({ fssaiDocument: fssaiDocument ? "" : "Upload the FSSAI licence document PDF.", ownerIdDocument: ownerIdDocument ? "" : "Upload the owner's Aadhaar / PAN PDF." });
      return;
    }
    setErrors({});
    if (!backendConfigured) return setFormErr("Canteen registration opens once the HUNGRY Z database is connected. Please try again soon.");
    setBusy(true);
    try {
      const urls = await uploadUrls({ data: {} });
      await Promise.all([
        uploadPdf(urls.fssai.signedUrl, fssaiDocument, "fssaiDocument"),
        uploadPdf(urls.ownerId.signedUrl, ownerIdDocument, "ownerIdDocument"),
      ]);
      const result = await submitApplication({ data: {
        application: parsed.data,
        fssaiDocumentPath: urls.fssai.path,
        ownerIdDocumentPath: urls.ownerId.path,
      } });
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
      {([
        ["fssaiDocument", "FSSAI Licence Document (PDF)", fssaiDocument],
        ["ownerIdDocument", "Owner Government ID – Aadhaar / PAN (PDF)", ownerIdDocument],
      ] as const).map(([name, label, file]) => (
        <div key={name} className="sm:col-span-2">
          <p className="mb-2 block text-sm font-medium text-foreground">{label} <span className="text-primary-bright">*</span></p>
          <div className="flex flex-wrap items-center gap-3">
            <input id={name} name={name} type="file" accept="application/pdf,.pdf" onChange={(event) => selectDocument(name, event.currentTarget.files?.[0])} aria-label={label} aria-describedby={`${name}-help`} aria-invalid={!!errors[name]} tabIndex={-1} className="sr-only" />
            <button type="button" onClick={() => document.getElementById(name)?.click()} disabled={busy} aria-controls={name} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-5 py-3 text-sm font-semibold text-foreground transition hover:border-primary hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
              <FileUp aria-hidden="true" className="h-4 w-4 text-primary-bright" />
              Choose PDF / Upload Document
            </button>
            <span className="min-w-0 break-all text-sm text-muted-foreground" aria-live="polite">{file ? file.name : "No file selected"}</span>
          </div>
          <p id={`${name}-help`} className="mt-1.5 text-xs text-muted-foreground">PDF only · Maximum 10 MB</p>
          {file && <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">{uploadProgress[name] === 100 ? "Uploaded securely" : uploadProgress[name] >= 0 ? `Uploading ${uploadProgress[name]}%` : "Selected · ready to upload"}</p>}
          {file && uploadProgress[name] >= 0 && uploadProgress[name] < 100 && <progress className="mt-2 h-2 w-full accent-primary" aria-label={`Uploading ${label}`} max={100} value={uploadProgress[name]} />}
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
