import { useEffect, useState, type PointerEvent } from "react";

type LogoCrop = { zoom: number; x: number; y: number; aspect: "original" | "square" | "wide" };

export function EventLogoImage({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return <div className={`flex min-h-28 max-h-56 w-full items-center justify-center overflow-hidden rounded-2xl border border-border bg-ink-soft p-2 sm:min-h-36 sm:p-3 ${className}`}>
    <img src={src} alt={alt} loading="lazy" className="block max-h-52 max-w-full rounded-xl object-contain" />
  </div>;
}

export function EventLogoCropAdjust({ src, onCropChange }: { src: string; onCropChange: (crop: LogoCrop | null) => void }) {
  const [enabled, setEnabled] = useState(false);
  const [crop, setCrop] = useState<LogoCrop>({ zoom: 1, x: 0.5, y: 0.5, aspect: "original" });
  const [drag, setDrag] = useState<{ pointerId: number; x: number; y: number } | null>(null);

  useEffect(() => onCropChange(enabled ? crop : null), [crop, enabled, onCropChange]);

  function update(next: Partial<LogoCrop>) {
    setCrop((current) => ({ ...current, ...next }));
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setCrop((current) => ({
      ...current,
      x: clamp(current.x - (event.clientX - drag.x) / Math.max(1, bounds.width) / current.zoom, 0, 1),
      y: clamp(current.y - (event.clientY - drag.y) / Math.max(1, bounds.height) / current.zoom, 0, 1),
    }));
    setDrag({ pointerId: drag.pointerId, x: event.clientX, y: event.clientY });
  }

  return <section className="space-y-3 rounded-xl border border-border bg-background/70 p-3" aria-label="Crop or adjust event logo">
    <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-foreground">
      <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.currentTarget.checked)} className="h-4 w-4 accent-primary" />
      Crop / Adjust Image (optional)
    </label>
    {enabled && <>
      <p className="text-xs text-muted-foreground">Drag the image to reposition it. The original upload is kept unchanged.</p>
      <div
        className={`relative mx-auto w-full max-w-xl touch-none overflow-hidden rounded-xl border border-primary/40 bg-ink-soft ${crop.aspect === "square" ? "aspect-square max-h-72" : "aspect-video max-h-64"}`}
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDrag({ pointerId: event.pointerId, x: event.clientX, y: event.clientY }); }}
        onPointerMove={move}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
        role="img"
        aria-label="Draggable event logo crop preview"
      >
        <img
          src={src}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full select-none object-cover"
          style={{ objectPosition: `${crop.x * 100}% ${crop.y * 100}%`, transform: `scale(${crop.zoom})` }}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-muted-foreground">Crop shape
          <select value={crop.aspect} onChange={(event) => update({ aspect: event.currentTarget.value as LogoCrop["aspect"] })} aria-label="Logo crop shape" className="min-h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground">
            <option value="original">Original proportions</option><option value="wide">Wide (16:9)</option><option value="square">Square (1:1)</option>
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">Zoom: {crop.zoom.toFixed(1)}×
          <input type="range" min={1} max={3} step={0.1} value={crop.zoom} onChange={(event) => update({ zoom: Number(event.currentTarget.value) })} aria-label="Logo zoom" className="block min-h-10 w-full accent-primary" />
        </label>
      </div>
    </>}
  </section>;
}

export type EventLogoCrop = { zoom: number; x: number; y: number; aspect: "original" | "square" | "wide" };

export async function createCroppedEventLogoFile(file: File, crop: EventLogoCrop) {
  const bitmap = await createImageBitmap(file);
  const targetRatio = crop.aspect === "square" ? 1 : crop.aspect === "wide" ? 16 / 9 : bitmap.width / bitmap.height;
  let cropWidth = bitmap.width;
  let cropHeight = bitmap.height;
  if (cropWidth / cropHeight > targetRatio) cropWidth = cropHeight * targetRatio;
  else cropHeight = cropWidth / targetRatio;
  cropWidth /= crop.zoom;
  cropHeight /= crop.zoom;
  const sx = (bitmap.width - cropWidth) * crop.x;
  const sy = (bitmap.height - cropHeight) * crop.y;
  const outputWidth = Math.min(2000, Math.round(cropWidth));
  const outputHeight = Math.min(2000, Math.round(cropHeight));
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");
  if (!context) { bitmap.close(); throw new Error("Could not prepare the adjusted logo image."); }
  context.drawImage(bitmap, sx, sy, cropWidth, cropHeight, 0, 0, outputWidth, outputHeight);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not prepare the adjusted logo image.")), file.type, 0.96));
  return new File([blob], file.name, { type: file.type, lastModified: file.lastModified });
}

function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
