import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, ImageUp, Loader2, ScanLine, Trash2, Sparkles, Lock } from "lucide-react";
import { deleteFoodScan, getScannerAccess, listFoodScans, scanFood } from "@/lib/scanner.functions";
import { STUDENT_SCANNER_PLANS, trialDaysLeft } from "@/lib/scanner";
import { cn } from "@/lib/utils";

type Scan = {
  id: string; food_name: string; portion: string; calories: number; protein_g: number; carbs_g: number;
  fat_g: number; fibre_g: number; sugar_g: number; confidence: string; notes: string; created_at: string;
};
type Access = { ok: true; startedAt: string; expiresAt: string; version: string; active: boolean } | { ok: false; message: string };

async function toJpegDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("This file isn't a readable image."));
      i.src = url;
    });
    const max = 1280;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function ScannerTab() {
  const getAccess = useServerFn(getScannerAccess);
  const listScans = useServerFn(listFoodScans);
  const runScan = useServerFn(scanFood);
  const removeScan = useServerFn(deleteFoodScan);
  const [access, setAccess] = useState<Access | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<Scan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const a = await getAccess();
      setAccess(a);
      if (a.ok) setScans((await listScans()) as Scan[]);
    } catch (e) {
      setAccess({ ok: false, message: e instanceof Error ? e.message : "Could not load the scanner." });
    }
  }, [getAccess, listScans]);
  useEffect(() => { void load(); }, [load]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setResult(null);
    setBusy(true);
    try {
      const dataUrl = await toJpegDataUrl(file);
      setPreview(dataUrl);
      const r = await runScan({ data: { image: dataUrl } });
      if (!r.ok) setError(r.message);
      else {
        setResult(r.scan as Scan);
        setScans((s) => [r.scan as Scan, ...s]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed. Please try again.");
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (uploadRef.current) uploadRef.current.value = "";
    }
  }

  async function onDelete(id: string) {
    await removeScan({ data: { id } });
    setScans((s) => s.filter((x) => x.id !== id));
    if (result?.id === id) setResult(null);
  }

  if (!access) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!access.ok) return <div className="scanner-card p-6 text-center text-sm text-muted-foreground">{access.message}</div>;

  const days = trialDaysLeft(access.expiresAt);

  return (
    <div className="flex flex-col gap-5 pb-6">
      <section className="scanner-card relative overflow-hidden p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="scanner-pill">VERSION 1.0</span>
          <span className="scanner-pill scanner-pill-accent">STUDENT · FREE 1 MONTH</span>
        </div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight">HUNGRY SCANNER</h2>
        <p className="mt-1 text-sm text-muted-foreground">Snap your plate. Get calories and macros in seconds.</p>
        <p className={cn("mt-4 text-xs font-medium", access.active ? "text-foreground/80" : "text-destructive")}>
          {access.active
            ? `Free access active · ${days} ${days === 1 ? "day" : "days"} left (until ${fmtDate(access.expiresAt)})`
            : `Your free month ended on ${fmtDate(access.expiresAt)}.`}
        </p>

        {access.active && (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button type="button" disabled={busy} onClick={() => cameraRef.current?.click()} className="scanner-action scanner-action-primary">
              <Camera className="h-5 w-5" /> Scan with camera
            </button>
            <button type="button" disabled={busy} onClick={() => uploadRef.current?.click()} className="scanner-action">
              <ImageUp className="h-5 w-5" /> Upload photo
            </button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Take food photo" onChange={(e) => onFile(e.target.files?.[0])} />
            <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Upload food photo" onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
        )}
      </section>

      {(preview || busy || error || result) && (
        <section className="scanner-card overflow-hidden">
          {preview && <img src={preview} alt="Scanned food" className="aspect-[4/3] w-full object-cover" />}
          <div className="p-5">
            {busy && <p className="flex items-center gap-2 text-sm text-muted-foreground"><ScanLine className="h-4 w-4 animate-pulse" /> Identifying food and estimating nutrition…</p>}
            {error && !busy && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {result && !busy && <ScanResult scan={result} />}
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-3 text-xs font-semibold tracking-[0.2em] text-muted-foreground">SCAN HISTORY</h3>
        {scans.length === 0 ? (
          <p className="scanner-card p-5 text-sm text-muted-foreground">No scans yet. Your scanned meals will appear here.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {scans.map((s) => (
              <li key={s.id} className="scanner-card flex items-center gap-3 p-4">
                <button type="button" onClick={() => { setResult(s); setPreview(null); setError(""); }} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-semibold">{s.food_name}</p>
                  <p className="text-xs text-muted-foreground">{s.calories} kcal · P {s.protein_g}g · C {s.carbs_g}g · F {s.fat_g}g · {fmtDate(s.created_at)}</p>
                </button>
                <button type="button" aria-label={`Delete ${s.food_name} scan`} onClick={() => onDelete(s.id)} className="rounded-full p-2 text-muted-foreground transition hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold tracking-[0.2em] text-muted-foreground">COMING SOON</h3>
        {STUDENT_SCANNER_PLANS.filter((p) => p.status === "coming_soon").map((p) => (
          <div key={p.version} className="scanner-card p-5 opacity-80">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Version {p.version} — {p.name}</p>
              <span className="scanner-pill"><Lock className="mr-1 inline h-3 w-3" />Coming soon</span>
            </div>
            <ul className="mt-2 text-xs text-muted-foreground">{p.features.map((f) => <li key={f}>· {f}</li>)}</ul>
          </div>
        ))}
      </section>
    </div>
  );
}

function ScanResult({ scan }: { scan: Scan }) {
  const stats: [string, string][] = [
    ["Protein", `${scan.protein_g} g`], ["Carbs", `${scan.carbs_g} g`], ["Fats", `${scan.fat_g} g`],
    ["Fibre", `${scan.fibre_g} g`], ["Sugar", `${scan.sugar_g} g`],
  ];
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Sparkles className="h-3.5 w-3.5 text-primary" /> AI identified · {scan.confidence} confidence</p>
          <p className="mt-1 text-xl font-semibold tracking-tight">{scan.food_name}</p>
          {scan.portion && <p className="text-xs text-muted-foreground">Portion: {scan.portion}</p>}
        </div>
        <div className="text-right">
          <p className="text-3xl font-semibold leading-none text-primary">{scan.calories}</p>
          <p className="text-[10px] tracking-widest text-muted-foreground">KCAL</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-border bg-background/60 px-3 py-2 text-center">
            <p className="text-sm font-semibold">{v}</p>
            <p className="text-[10px] text-muted-foreground">{k}</p>
          </div>
        ))}
      </div>
      {scan.notes && <p className="mt-3 text-xs text-muted-foreground">{scan.notes}</p>}
      <p className="mt-2 text-[10px] text-muted-foreground">Estimates only — not medical advice.</p>
    </div>
  );
}
