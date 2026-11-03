import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Camera,
  ImageUp,
  Loader2,
  ScanLine,
  Trash2,
  Sparkles,
  Lock,
  SwitchCamera,
  X,
  Upload,
} from "lucide-react";
import {
  deleteFoodScan,
  getScannerAccess,
  listFoodScans,
  scanFood,
  updateFoodScan,
} from "@/lib/scanner.functions";
import { STUDENT_SCANNER_PLANS, trialDaysLeft } from "@/lib/scanner";
import { cn } from "@/lib/utils";

type Scan = {
  id: string;
  food_name: string;
  portion: string;
  portion_g: number | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fibre_g: number | null;
  sugar_g: number | null;
  confidence: string;
  notes: string;
  created_at: string;
  nutrition_source: string | null;
  nutrition_reference: string | null;
  scan_group_id: string | null;
};
type Access =
  | { ok: true; startedAt: string; expiresAt: string; version: string; active: boolean }
  | { ok: false; message: string };

async function toJpegDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("This file isn't a readable image."));
      image.src = url;
    });
    const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the photo.");
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const fmtDate = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const fmt = (value: number | null, unit = " g") =>
  value === null ? "Not available" : `${value}${unit}`;

export function ScannerTab() {
  const getAccess = useServerFn(getScannerAccess);
  const listScans = useServerFn(listFoodScans);
  const runScan = useServerFn(scanFood);
  const removeScan = useServerFn(deleteFoodScan);
  const saveFoodCorrection = useServerFn(updateFoodScan);
  const [access, setAccess] = useState<Access | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [results, setResults] = useState<Scan[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraOpening, setCameraOpening] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [foodInputs, setFoodInputs] = useState<Record<string, string>>({});
  const [portionInputs, setPortionInputs] = useState<Record<string, string>>({});
  const [correctionBusy, setCorrectionBusy] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraFallbackRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpening(false);
  }, []);

  const load = useCallback(async () => {
    try {
      const value = await getAccess();
      setAccess(value);
      if (value.ok) setScans((await listScans()) as Scan[]);
    } catch (e) {
      setAccess({
        ok: false,
        message: e instanceof Error ? e.message : "Could not load the scanner.",
      });
    }
  }, [getAccess, listScans]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );
  useEffect(() => {
    if (!videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current
      .play()
      .catch(() =>
        setCameraError("Camera preview could not start. Check browser permissions and try again."),
      );
  }, [cameraOpen, cameraOpening]);

  async function openCamera(nextFacing = facingMode) {
    setCameraOpen(true);
    setCameraOpening(true);
    setCameraError("");
    stopCamera();
    setCameraOpen(true);
    setCameraOpening(true);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraOpening(false);
      setCameraError(
        "Live camera is unavailable in this browser. You can open the device camera or upload a photo.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: nextFacing },
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpening(false);
    } catch (e) {
      setCameraOpening(false);
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotAllowedError" || name === "SecurityError")
        setCameraError(
          "Camera permission is blocked. Allow camera access in your browser settings, or use the device camera or gallery.",
        );
      else if (name === "NotFoundError" || name === "OverconstrainedError")
        setCameraError(
          "No compatible camera was found. You can use the device camera or upload a photo.",
        );
      else if (name === "NotReadableError")
        setCameraError("The camera is being used by another app. Close that app and try again.");
      else
        setCameraError(
          "Camera could not start. Check permissions, then try again or upload a photo.",
        );
    }
  }

  async function processImage(dataUrl: string) {
    setPreview(dataUrl);
    setError("");
    setResults([]);
    setBusy(true);
    try {
      const response = await runScan({ data: { image: dataUrl } });
      if (!response.ok) setError(response.message);
      else {
        const saved = response.scans as Scan[];
        setResults(saved);
        setFoodInputs(Object.fromEntries(saved.map((scan) => [scan.id, scan.food_name])));
        setPortionInputs(
          Object.fromEntries(saved.map((scan) => [scan.id, String(scan.portion_g ?? "")])),
        );
        setScans((items) => [...saved, ...items]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setCameraOpen(false);
    stopCamera();
    try {
      await processImage(await toJpegDataUrl(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this photo.");
    } finally {
      if (cameraFallbackRef.current) cameraFallbackRef.current.value = "";
      if (uploadRef.current) uploadRef.current.value = "";
    }
  }

  async function captureFood() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError(
        "Camera preview is still starting. Please wait a moment and try Capture Food again.",
      );
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("This browser could not capture the photo.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCameraOpen(false);
    stopCamera();
    await processImage(canvas.toDataURL("image/jpeg", 0.88));
  }

  async function onDelete(id: string) {
    await removeScan({ data: { id } });
    setScans((items) => items.filter((item) => item.id !== id));
    setResults((items) => items.filter((item) => item.id !== id));
  }

  async function correctFood(scan: Scan) {
    const foodName = (foodInputs[scan.id] ?? scan.food_name).trim();
    const portionG = Number(portionInputs[scan.id]);
    if (!foodName || portionG < 1 || portionG > 3000) return;
    setCorrectionBusy(scan.id);
    setError("");
    try {
      const response = await saveFoodCorrection({
        data: { id: scan.id, foodName, portionG },
      });
      if (!response.ok) setError(response.message);
      else {
        const updated = response.scan as Scan;
        setResults((items) => items.map((item) => (item.id === updated.id ? updated : item)));
        setFoodInputs((items) => ({ ...items, [updated.id]: updated.food_name }));
        setPortionInputs((items) => ({ ...items, [updated.id]: String(updated.portion_g ?? "") }));
        setScans((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the food and portion.");
    } finally {
      setCorrectionBusy(null);
    }
  }

  if (!access)
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  if (!access.ok)
    return (
      <div className="scanner-card p-6 text-center text-sm text-muted-foreground">
        {access.message}
      </div>
    );

  const days = trialDaysLeft(access.expiresAt);

  return (
    <div className="flex flex-col gap-5 pb-6">
      <section className="scanner-card relative overflow-hidden p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="scanner-pill">VERSION 1.0</span>
          <span className="scanner-pill scanner-pill-accent">STUDENT · FREE 1 MONTH</span>
        </div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight">HUNGRY SCANNER</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Snap your plate. Get calories and macros in seconds.
        </p>
        <p
          className={cn(
            "mt-4 text-xs font-medium",
            access.active ? "text-foreground/80" : "text-destructive",
          )}
        >
          {access.active
            ? `Free access active · ${days} ${days === 1 ? "day" : "days"} left (until ${fmtDate(access.expiresAt)})`
            : `Your free month ended on ${fmtDate(access.expiresAt)}.`}
        </p>
        {access.active && (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={busy || cameraOpen}
              onClick={() => void openCamera()}
              className="scanner-action scanner-action-primary"
            >
              <Camera className="h-5 w-5" /> Scan with camera
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => uploadRef.current?.click()}
              className="scanner-action"
            >
              <ImageUp className="h-5 w-5" /> Upload photo
            </button>
            <input
              ref={uploadRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              aria-label="Upload food photo from gallery"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            <input
              ref={cameraFallbackRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              aria-label="Open device camera"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </div>
        )}
      </section>

      {cameraOpen && (
        <section className="scanner-card overflow-hidden">
          <div className="relative bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="aspect-[4/3] w-full object-cover"
              aria-label="Live food camera preview"
            />
            {cameraOpening && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-sm text-white">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting camera…
              </div>
            )}
            <button
              type="button"
              aria-label="Close camera"
              onClick={() => {
                setCameraOpen(false);
                stopCamera();
              }}
              className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 p-4">
            <button
              type="button"
              disabled={cameraOpening || !streamRef.current}
              onClick={() => void captureFood()}
              className="scanner-action scanner-action-primary"
            >
              <Camera className="h-5 w-5" /> Capture Food
            </button>
            <button
              type="button"
              disabled={cameraOpening}
              onClick={() => {
                const next = facingMode === "environment" ? "user" : "environment";
                setFacingMode(next);
                void openCamera(next);
              }}
              className="scanner-action"
            >
              <SwitchCamera className="h-5 w-5" /> Switch camera
            </button>
          </div>
          {cameraError && (
            <div className="px-5 pb-5 text-center">
              <p role="alert" className="text-sm text-destructive">
                {cameraError}
              </p>
              <button
                type="button"
                onClick={() => cameraFallbackRef.current?.click()}
                className="scanner-action mt-3"
              >
                <Camera className="h-4 w-4" /> Open device camera
              </button>
            </div>
          )}
        </section>
      )}

      {(preview || busy || error || results.length > 0) && (
        <section className="scanner-card overflow-hidden">
          {preview && (
            <img src={preview} alt="Scanned food" className="aspect-[4/3] w-full object-cover" />
          )}
          <div className="p-5">
            {busy && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ScanLine className="h-4 w-4 animate-pulse" /> Identifying food and looking up
                nutrition…
              </p>
            )}
            {error && !busy && (
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
                {preview && (
                  <button
                    type="button"
                    onClick={() => void processImage(preview)}
                    className="scanner-action"
                  >
                    Retry scan
                  </button>
                )}
              </div>
            )}
            {results.length > 0 && !busy && (
              <div className="flex flex-col gap-5">
                {results.map((scan) => (
                  <ScanResult
                    key={scan.id}
                    scan={scan}
                    foodInput={foodInputs[scan.id] ?? scan.food_name}
                    setFoodInput={(value) =>
                      setFoodInputs((items) => ({ ...items, [scan.id]: value }))
                    }
                    portionInput={portionInputs[scan.id] ?? String(scan.portion_g ?? "")}
                    setPortionInput={(value) =>
                      setPortionInputs((items) => ({ ...items, [scan.id]: value }))
                    }
                    onCorrect={() => void correctFood(scan)}
                    correctionBusy={correctionBusy === scan.id}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-3 text-xs font-semibold tracking-[0.2em] text-muted-foreground">
          SCAN HISTORY
        </h3>
        {scans.length === 0 ? (
          <p className="scanner-card p-5 text-sm text-muted-foreground">
            No scans yet. Your scanned meals will appear here.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {scans.map((scan) => (
              <li key={scan.id} className="scanner-card flex items-center gap-3 p-4">
                <button
                  type="button"
                  onClick={() => {
                    const group = scan.scan_group_id
                      ? scans.filter((item) => item.scan_group_id === scan.scan_group_id)
                      : [scan];
                    setResults(group);
                    setFoodInputs(
                      Object.fromEntries(group.map((item) => [item.id, item.food_name])),
                    );
                    setPortionInputs(
                      Object.fromEntries(
                        group.map((item) => [item.id, String(item.portion_g ?? "")]),
                      ),
                    );
                    setPreview(null);
                    setError("");
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-sm font-semibold">{scan.food_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {scan.nutrition_source === null || scan.calories === null
                      ? "Nutrition unavailable"
                      : `${scan.calories} kcal · P ${scan.protein_g}g · C ${scan.carbs_g}g · F ${scan.fat_g}g`}{" "}
                    · {fmtDate(scan.created_at)}
                  </p>
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${scan.food_name} scan`}
                  onClick={() => void onDelete(scan.id)}
                  className="rounded-full p-2 text-muted-foreground transition hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold tracking-[0.2em] text-muted-foreground">
          COMING SOON
        </h3>
        {STUDENT_SCANNER_PLANS.filter((plan) => plan.status === "coming_soon").map((plan) => (
          <div key={plan.version} className="scanner-card p-5 opacity-80">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                Version {plan.version} — {plan.name}
              </p>
              <span className="scanner-pill">
                <Lock className="mr-1 inline h-3 w-3" />
                Coming soon
              </span>
            </div>
            <ul className="mt-2 text-xs text-muted-foreground">
              {plan.features.map((feature) => (
                <li key={feature}>· {feature}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}

function ScanResult({
  scan,
  foodInput,
  setFoodInput,
  portionInput,
  setPortionInput,
  onCorrect,
  correctionBusy,
}: {
  scan: Scan;
  foodInput: string;
  setFoodInput: (value: string) => void;
  portionInput: string;
  setPortionInput: (value: string) => void;
  onCorrect: () => void;
  correctionBusy: boolean;
}) {
  const matched = scan.nutrition_source !== null;
  const stats: [string, string][] = [
    ["Protein", fmt(scan.protein_g)],
    ["Carbohydrates", fmt(scan.carbs_g)],
    ["Total fat", fmt(scan.fat_g)],
    ["Fibre", fmt(scan.fibre_g)],
    ["Sugar", fmt(scan.sugar_g)],
  ];
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> AI identified · {scan.confidence}{" "}
            confidence
          </p>
          <p className="mt-1 text-xl font-semibold tracking-tight">{scan.food_name}</p>
          <p className="text-xs text-muted-foreground">
            Estimated serving weight: {fmt(scan.portion_g)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-semibold leading-none text-primary">
            {fmt(scan.calories, "")}
          </p>
          <p className="text-[10px] tracking-widest text-muted-foreground">CALORIES (KCAL)</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {stats.map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-border bg-background/60 px-3 py-2 text-center"
          >
            <p className="text-sm font-semibold">{value}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      {!matched ? (
        <p className="mt-4 rounded-xl border border-border bg-background/60 p-3 text-sm text-muted-foreground">
          {scan.notes.includes("IFCT 2017 data cannot be stored")
            ? "Verified nutrition is unavailable until IFCT 2017 electronic-use permission is granted and its dataset is added. No nutrition values were estimated."
            : "Verified nutrition data is unavailable for this food. Values remain unavailable until a verified database match is found."}
        </p>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Verified source: {scan.nutrition_source} · {scan.nutrition_reference}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted-foreground">
          Correct food name
          <input
            type="text"
            maxLength={120}
            value={foodInput}
            onChange={(event) => setFoodInput(event.target.value)}
            className="mt-1 block w-56 max-w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Correct serving (g)
          <input
            type="number"
            min="1"
            max="3000"
            step="1"
            value={portionInput}
            onChange={(event) => setPortionInput(event.target.value)}
            className="mt-1 block w-32 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <button
          type="button"
          disabled={
            correctionBusy ||
            !foodInput.trim() ||
            !portionInput ||
            Number(portionInput) < 1 ||
            Number(portionInput) > 3000 ||
            (foodInput.trim() === scan.food_name && Number(portionInput) === scan.portion_g)
          }
          onClick={onCorrect}
          className="scanner-action"
        >
          <Upload className="h-4 w-4" />
          {correctionBusy ? "Updating…" : "Update food and serving"}
        </button>
      </div>
      {scan.notes && <p className="mt-3 text-xs text-muted-foreground">{scan.notes}</p>}
      <p className="mt-2 text-[10px] text-muted-foreground">Estimates only — not medical advice.</p>
    </div>
  );
}
