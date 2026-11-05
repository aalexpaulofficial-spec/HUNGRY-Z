import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Check, ChevronDown, ImageUp, Loader2, Lock, ScanLine, Sparkles, SwitchCamera, Upload, X } from "lucide-react";
import { getScannerAccess, scanFood, updateFoodScan } from "@/lib/scanner.functions";
import { STUDENT_SCANNER_PLANS } from "@/lib/scanner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type Scan = {
  id: string; food_name: string; portion: string; portion_g: number; calories: number | null;
  protein_g: number | null; carbs_g: number | null; fat_g: number | null; fibre_g: number | null;
  sugar_g: number | null; confidence: "low" | "medium" | "high"; notes: string;
  nutrition_source: string | null; nutrition_reference: string | null;
};
type Usage = { completed_orders: number; total_usages: number; used_usages: number; remaining_usages: number };
type Access = ({ ok: true } & Usage) | { ok: false; message: string };
type Stage = "received" | "recognizing" | "nutrition" | "calculating";

async function toJpegDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a food photo in an image format.");
  if (file.size > 20 * 1024 * 1024) throw new Error("Choose a photo smaller than 20 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error("This file isn't a readable image.")); image.src = url;
    });
    const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas"); canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
    const context = canvas.getContext("2d"); if (!context) throw new Error("This browser could not prepare the photo.");
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    if (Math.floor((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75) > 6 * 1024 * 1024) throw new Error("This photo is too large to scan. Choose a smaller image.");
    return dataUrl;
  } finally { URL.revokeObjectURL(url); }
}

const fmt = (value: number | null, unit = " g") => value === null ? "—" : `${value}${unit}`;
const stages: { id: Stage; label: string }[] = [
  { id: "received", label: "Image received" }, { id: "recognizing", label: "Recognizing food" },
  { id: "nutrition", label: "Fetching nutrition" }, { id: "calculating", label: "Calculating results" },
];

export function ScannerTab({ userId }: { userId?: string }) {
  const getAccess = useServerFn(getScannerAccess); const runScan = useServerFn(scanFood); const correctScan = useServerFn(updateFoodScan);
  const [access, setAccess] = useState<Access | null>(null); const [preview, setPreview] = useState<string | null>(null);
  const [results, setResults] = useState<Scan[]>([]); const [busy, setBusy] = useState(false); const [stage, setStage] = useState<Stage>("received");
  const [personalizedInsight, setPersonalizedInsight] = useState("");
  const [error, setError] = useState(""); const [cameraOpen, setCameraOpen] = useState(false); const [cameraOpening, setCameraOpening] = useState(false);
  const [cameraError, setCameraError] = useState(""); const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [foodInputs, setFoodInputs] = useState<Record<string, string>>({}); const [portionInputs, setPortionInputs] = useState<Record<string, string>>({});
  const [correctionBusy, setCorrectionBusy] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null); const streamRef = useRef<MediaStream | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null); const cameraFallbackRef = useRef<HTMLInputElement>(null); const busyRef = useRef(false);
  const currentAnalysisId = useRef<string | null>(null);

  const stopCamera = useCallback(() => { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; if (videoRef.current) videoRef.current.srcObject = null; setCameraOpening(false); }, []);
  const refreshAccess = useCallback(async () => {
    try { setAccess(await getAccess()); }
    catch (e) { setAccess({ ok: false, message: e instanceof Error ? e.message : "Could not load the scanner." }); }
  }, [getAccess]);
  useEffect(() => {
    void refreshAccess();
    if (!userId) return;
    const channel = supabase.channel(`hungry-ai-usage-${userId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `user_id=eq.${userId}` }, refreshAccess)
      .subscribe();
    const retry = window.setInterval(() => void refreshAccess(), 15000);
    return () => { window.clearInterval(retry); void supabase.removeChannel(channel); };
  }, [refreshAccess, userId]);
  useEffect(() => () => { streamRef.current?.getTracks().forEach((track) => track.stop()); }, []);
  useEffect(() => { if (!videoRef.current || !streamRef.current) return; videoRef.current.srcObject = streamRef.current; void videoRef.current.play().catch(() => setCameraError("Camera preview could not start. Check browser permissions and try again.")); }, [cameraOpen, cameraOpening]);
  useEffect(() => {
    if (!busy) return;
    const order: Stage[] = ["received", "recognizing", "nutrition", "calculating"];
    const timer = window.setInterval(() => setStage((current) => order[Math.min(order.indexOf(current) + 1, order.length - 1)]), 1800);
    return () => window.clearInterval(timer);
  }, [busy]);

  async function openCamera(nextFacing = facingMode) {
    setCameraOpen(true); setCameraOpening(true); setCameraError(""); stopCamera(); setCameraOpen(true); setCameraOpening(true);
    if (!navigator.mediaDevices?.getUserMedia) { setCameraOpening(false); setCameraError("Live camera is unavailable here. Use the device camera or upload a photo."); return; }
    try { streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: nextFacing }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false }); setCameraOpening(false); }
    catch (e) {
      setCameraOpening(false); const name = e instanceof DOMException ? e.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") setCameraError("Camera permission is blocked. Allow camera access in browser settings, or use the device camera or gallery.");
      else if (name === "NotFoundError" || name === "OverconstrainedError") setCameraError("No compatible camera was found. Use the device camera or upload a photo.");
      else if (name === "NotReadableError") setCameraError("The camera is being used by another app. Close that app and try again.");
      else setCameraError("Camera could not start. Check permissions, then try again or upload a photo.");
    }
  }

  async function processImage(dataUrl: string) {
    if (busyRef.current) return; busyRef.current = true; currentAnalysisId.current ??= crypto.randomUUID(); setPreview(dataUrl); setError(""); setResults([]); setPersonalizedInsight(""); setStage("received"); setBusy(true);
    try {
      const response = await runScan({ data: { image: dataUrl, requestId: currentAnalysisId.current } });
      if (!response.ok) setError(response.message);
      else { const scans = response.scans as Scan[]; setResults(scans); setPersonalizedInsight(response.personalizedInsight ?? ""); if (response.usage) setAccess({ ok: true, ...response.usage }); setFoodInputs(Object.fromEntries(scans.map((scan) => [scan.id, scan.food_name]))); setPortionInputs(Object.fromEntries(scans.map((scan) => [scan.id, String(scan.portion_g)]))); }
    } catch (e) { setError(e instanceof Error ? e.message : "Scan failed. Please try again."); }
    finally { busyRef.current = false; setBusy(false); await refreshAccess(); }
  }
  async function onFile(file: File | undefined) {
    if (!file) return; setError(""); setCameraOpen(false); stopCamera();
    try { await processImage(await toJpegDataUrl(file)); } catch (e) { setError(e instanceof Error ? e.message : "Could not read this photo."); }
    finally { if (uploadRef.current) uploadRef.current.value = ""; if (cameraFallbackRef.current) cameraFallbackRef.current.value = ""; }
  }
  async function captureFood() {
    const video = videoRef.current; if (!video || !video.videoWidth || !video.videoHeight) { setCameraError("Camera preview is still starting. Wait a moment, then capture again."); return; }
    const canvas = document.createElement("canvas"); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const context = canvas.getContext("2d"); if (!context) { setCameraError("This browser could not capture the photo."); return; }
    context.drawImage(video, 0, 0, canvas.width, canvas.height); const photo = canvas.toDataURL("image/jpeg", 0.88); setCameraOpen(false); stopCamera(); await processImage(photo);
  }
  function clearCurrentScan() { busyRef.current = false; currentAnalysisId.current = null; setBusy(false); setPreview(null); setResults([]); setPersonalizedInsight(""); setError(""); setFoodInputs({}); setPortionInputs({}); setStage("received"); }
  async function updateFood(scan: Scan) {
    const foodName = (foodInputs[scan.id] ?? scan.food_name).trim(); const portionG = Number(portionInputs[scan.id]);
    if (!foodName || portionG < 1 || portionG > 3000) return; setCorrectionBusy(scan.id); setError("");
    try { const response = await correctScan({ data: { foodName, portionG, confidence: scan.confidence, notes: scan.notes } }); if (!response.ok) setError(response.message); else { const updated = response.scan as Scan; setResults((items) => items.map((item) => item.id === scan.id ? { ...updated, id: scan.id } : item)); } }
    catch (e) { setError(e instanceof Error ? e.message : "Could not update food and portion."); }
    finally { setCorrectionBusy(null); }
  }

  if (!access) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!access.ok) return <div className="scanner-card p-6 text-center text-sm text-muted-foreground">{access.message}</div>;
  const livePlan = STUDENT_SCANNER_PLANS.find((plan) => plan.status === "live")!;
  return <div className="scanner-shell mx-auto flex w-full max-w-3xl flex-col gap-5 pb-6">
    <section className="scanner-card relative overflow-hidden p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="scanner-pill scanner-pill-accent">{livePlan.brand}</span><span className="scanner-pill"><span>Version {livePlan.version}</span><span aria-hidden="true"> · </span><span>AVAILABLE NOW</span></span></div>
      <h2 className="mt-7 text-center text-2xl font-semibold tracking-tight sm:text-3xl">Scan Any Food,<br /><span className="text-primary">Know Its Nutrition</span></h2>
      <p className="mx-auto mt-2 max-w-sm text-center text-sm text-muted-foreground">{livePlan.description}</p>
      <div className="mx-auto mt-3 max-w-2xl rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3 text-center text-xs leading-relaxed text-foreground">
        <p>Available to Students, Faculty and Guests with eligible completed food orders.</p>
        <p className="mt-1">One HUNGRY AI usage is available for each completed food order.</p>
      </div>
      <p className="mx-auto mt-3 flex max-w-2xl flex-wrap justify-center gap-x-1 text-center text-xs leading-relaxed text-muted-foreground"><span className="font-semibold text-foreground">Features:</span>{livePlan.features.map((feature, index) => <span key={feature}>{index > 0 && <span aria-hidden="true"> · </span>}{feature}</span>)}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="HUNGRY AI usage">
        <UsageMetric label="Completed orders" value={access.completed_orders} />
        <UsageMetric label="Total AI usages" value={access.total_usages} />
        <UsageMetric label="Used usages" value={access.used_usages} />
        <UsageMetric label="Usages remaining" value={access.remaining_usages} highlight />
      </div>
      <p className="mt-3 text-center text-xs font-medium text-muted-foreground">One HUNGRY AI usage is available for each completed food order.</p>
      {access.remaining_usages > 0 && !preview && !cameraOpen && <div className="mx-auto mt-6 grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => void openCamera()} className="scanner-action scanner-action-primary scanner-start"><Camera className="h-5 w-5" /><span><b>Scan Food</b><small>Capture with camera</small></span></button>
        <button type="button" onClick={() => uploadRef.current?.click()} className="scanner-action scanner-start"><ImageUp className="h-5 w-5" /><span><b>Upload Image</b><small>Choose from Gallery</small></span></button>
        <input ref={uploadRef} type="file" accept="image/*" className="hidden" aria-label="Upload food photo from gallery" onChange={(e) => void onFile(e.target.files?.[0])} />
        <input ref={cameraFallbackRef} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Open device camera" onChange={(e) => void onFile(e.target.files?.[0])} />
      </div>}
      {access.remaining_usages < 1 && !preview && !cameraOpen && <p className="mx-auto mt-5 max-w-md rounded-2xl border border-primary/30 bg-primary/5 p-4 text-center text-sm font-semibold text-foreground">Complete a food order to unlock another HUNGRY AI usage.</p>}
    </section>

    {cameraOpen && <section className="scanner-card overflow-hidden">
      <div className="relative bg-black"><video ref={videoRef} autoPlay playsInline muted className="aspect-[4/3] w-full object-cover" aria-label="Live food camera preview" />
        {cameraOpening && <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-sm text-white"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Starting camera…</div>}
        <button type="button" aria-label="Close camera" onClick={() => { setCameraOpen(false); stopCamera(); }} className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white"><X className="h-5 w-5" /></button></div>
      <div className="flex flex-wrap items-center justify-center gap-3 p-4"><button type="button" disabled={cameraOpening || !streamRef.current} onClick={() => void captureFood()} className="scanner-action scanner-action-primary"><Camera className="h-5 w-5" /> Capture Food</button>
        <button type="button" disabled={cameraOpening} onClick={() => { const next = facingMode === "environment" ? "user" : "environment"; setFacingMode(next); void openCamera(next); }} className="scanner-action"><SwitchCamera className="h-5 w-5" /> Switch camera</button>
        <button type="button" onClick={() => uploadRef.current?.click()} className="scanner-action"><ImageUp className="h-5 w-5" /> Gallery</button></div>
      {cameraError && <div className="px-5 pb-5 text-center"><p role="alert" className="text-sm text-destructive">{cameraError}</p><button type="button" onClick={() => cameraFallbackRef.current?.click()} className="scanner-action mt-3"><Camera className="h-4 w-4" /> Open device camera</button></div>}
    </section>}

    {(preview || busy || error || results.length > 0) && <section className="scanner-card overflow-hidden">
      {preview && <div className={cn("scanner-image-frame", busy && "scanner-image-frame-active")}><img src={preview} alt="Your captured or uploaded food" className="aspect-[4/3] w-full rounded-[1.15rem] object-cover" />{busy && <div className="scanner-sweep" aria-hidden="true" />}</div>}
      {busy && <div className="px-5 pb-5 pt-4 text-center"><h3 className="text-xl font-semibold">{stage === "calculating" ? "Calculating nutrition..." : "Identifying your food..."}</h3><p className="mt-1 text-sm text-muted-foreground">Analysing with HUNGRY AI...</p>
        <div className="scanner-progress mt-5"><span style={{ width: `${(stages.findIndex((item) => item.id === stage) + 1) * 25}%` }} /></div>
        <ol className="mx-auto mt-4 flex max-w-sm flex-col gap-2 text-left">{stages.map((item, index) => { const current = stages.findIndex((entry) => entry.id === stage); const done = index < current; const active = index === current; return <li key={item.id} className={cn("flex items-center gap-3 text-xs transition-colors", done || active ? "text-foreground" : "text-muted-foreground/60")}>{done ? <span className="scanner-step-done"><Check className="h-3 w-3" /></span> : active ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <span className="scanner-step-idle" />}{item.label}</li>; })}</ol>
      </div>}
      {error && !busy && <div className="p-5"><p role="alert" className="text-sm text-destructive">{error}</p><div className="mt-4 flex flex-wrap gap-2">{preview && <button type="button" onClick={() => void processImage(preview)} className="scanner-action"><ScanLine className="h-4 w-4" /> Retry scan</button>}<button type="button" onClick={clearCurrentScan} className="scanner-action">Close</button></div></div>}
      {results.length > 0 && !busy && <div className="space-y-4 p-4 sm:p-5"><div className="flex items-center justify-between"><h3 className="text-lg font-semibold">Scan results</h3><span className="scanner-pill">ESTIMATES</span></div>
        {personalizedInsight && <aside className="rounded-2xl border border-primary/30 bg-primary/5 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Personalized food insight</p><p className="mt-1 text-sm leading-relaxed text-foreground">{personalizedInsight}</p></aside>}
        {results.map((scan) => <ScanResult key={scan.id} scan={scan} foodInput={foodInputs[scan.id] ?? scan.food_name} setFoodInput={(value) => setFoodInputs((items) => ({ ...items, [scan.id]: value }))} portionInput={portionInputs[scan.id] ?? String(scan.portion_g)} setPortionInput={(value) => setPortionInputs((items) => ({ ...items, [scan.id]: value }))} onCorrect={() => void updateFood(scan)} correctionBusy={correctionBusy === scan.id} />)}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <button type="button" onClick={() => { clearCurrentScan(); }} className="scanner-action scanner-action-primary w-full"><ScanLine className="h-4 w-4" /> Scan Another</button>
        <button type="button" onClick={clearCurrentScan} className="scanner-action w-full">Close</button>
      </div>}
    </section>}

    <section className="flex flex-col gap-3"><h3 className="text-xs font-semibold tracking-[0.2em] text-muted-foreground">COMING SOON</h3>{STUDENT_SCANNER_PLANS.filter((plan) => plan.status === "coming_soon").map((plan) => <article key={plan.version} className="scanner-card p-5 opacity-90"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold">{plan.brand}</p><p className="mt-1 text-xs text-muted-foreground">Version {plan.version}</p></div><span className="scanner-pill"><Lock className="mr-1 inline h-3 w-3" />COMING SOON</span></div><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{plan.description}</p><ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">{plan.features.map((feature) => <li key={feature} className="before:mr-1 before:text-primary before:content-['·']">{feature}</li>)}</ul></article>)}</section>

  </div>;
}

function ScanResult({ scan, foodInput, setFoodInput, portionInput, setPortionInput, onCorrect, correctionBusy }: { scan: Scan; foodInput: string; setFoodInput: (value: string) => void; portionInput: string; setPortionInput: (value: string) => void; onCorrect: () => void; correctionBusy: boolean }) {
  const matched = scan.nutrition_source !== null;
  const stats: [string, string][] = [["Protein", fmt(scan.protein_g)], ["Carbs", fmt(scan.carbs_g)], ["Fat", fmt(scan.fat_g)], ["Fibre", fmt(scan.fibre_g)], ["Sugar", fmt(scan.sugar_g)]];
  return <article className="scanner-result-card rounded-2xl border border-border p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Sparkles className="h-3.5 w-3.5 text-primary" />AI identified · {scan.confidence} confidence</p><p className="mt-1 text-xl font-semibold">{scan.food_name}</p><p className="text-xs text-muted-foreground">Estimated serving · {scan.portion_g} g</p></div><div className="text-right"><p className="text-3xl font-semibold leading-none text-primary">{fmt(scan.calories, "")}</p><p className="mt-1 text-[10px] tracking-widest text-muted-foreground">KCAL</p></div></div>
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">{stats.map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-background/60 px-2 py-2 text-center"><p className="text-sm font-semibold">{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>)}</div>
    <div className="mt-3 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">{matched ? <>Values are estimates calculated from a verified nutrition database match. <span className="block pt-1">Source: {scan.nutrition_source} · {scan.nutrition_reference}</span></> : scan.notes || "No verified nutrition match was found. Nutrient values are not available; none were invented."}</div>
    {matched && <p className="mt-2 text-right text-[10px] text-muted-foreground"><a href="https://fdc.nal.usda.gov/" target="_blank" rel="noreferrer" className="underline underline-offset-2">Source: USDA FoodData Central</a></p>}
    <details className="mt-4"><summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">Correct food or serving<ChevronDown className="h-4 w-4" /></summary><div className="mt-3 flex flex-wrap items-end gap-2"><label className="text-xs text-muted-foreground">Food name<input type="text" maxLength={120} value={foodInput} onChange={(event) => setFoodInput(event.target.value)} className="mt-1 block w-56 max-w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground" /></label><label className="text-xs text-muted-foreground">Serving (g)<input type="number" min="1" max="3000" value={portionInput} onChange={(event) => setPortionInput(event.target.value)} className="mt-1 block w-32 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground" /></label><button type="button" disabled={correctionBusy || !foodInput.trim() || !portionInput || Number(portionInput) < 1 || Number(portionInput) > 3000 || (foodInput.trim() === scan.food_name && Number(portionInput) === scan.portion_g)} onClick={onCorrect} className="scanner-action"><Upload className="h-4 w-4" />{correctionBusy ? "Updating…" : "Update"}</button></div></details>
    {scan.notes && matched && <p className="mt-2 text-xs text-muted-foreground">{scan.notes}</p>}<p className="mt-2 text-[10px] text-muted-foreground">Estimated values for guidance only.</p>
  </article>;
}

function UsageMetric({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return <div className={cn("rounded-xl bg-ink-soft px-2 py-2 text-center", highlight && "border border-primary/35")}><p className="text-base font-bold tabular-nums text-foreground">{value}</p><p className="text-[10px] leading-tight text-muted-foreground">{label}</p></div>;
}
