import { useEffect, useState, type PointerEvent } from "react";

type LogoCrop = { zoom: number; x: number; y: number };

export function EventLogoImage({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return <div className={`relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-border bg-ink-soft ${className}`}>
    <img src={src} alt={alt} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
  </div>;
}

export function EventLogoCropAdjust({ src, onCropChange }: { src: string; onCropChange: (crop: LogoCrop | null) => void }) {
  const [enabled, setEnabled] = useState(true);
  // A small default crop margin gives horizontal and vertical controls room
  // to move even when the uploaded image already matches the 16:10 frame.
  const [crop, setCrop] = useState<LogoCrop>({ zoom: 1.2, x: 0.5, y: 0.5 });
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

  return <section className="space-y-2 rounded-xl border border-border bg-background/70 p-2.5" aria-label="Crop or adjust event logo">
    <label className="flex min-h-9 items-center gap-2 text-sm font-medium text-foreground">
      <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.currentTarget.checked)} className="h-4 w-4 accent-primary" />
      Adjust event image
    </label>
    {enabled && <>
      <p className="text-xs text-muted-foreground">Drag to reposition, or use the controls. Preview uses the 16:10 event image frame.</p>
      <div
        className="relative mx-auto aspect-[16/10] w-full max-w-xs touch-none overflow-hidden rounded-xl border border-border bg-ink-soft"
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
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1 text-xs text-muted-foreground">
          <label htmlFor="event-image-horizontal-position" className="font-medium text-foreground">Move left or right</label>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Move event image left" onClick={() => update({ x: clamp(crop.x + 0.08, 0, 1) })} className="min-h-8 shrink-0 rounded-lg border border-border bg-card px-2 text-[10px] font-semibold text-foreground">Left</button>
            <input id="event-image-horizontal-position" type="range" min={0} max={1} step={0.01} value={1 - crop.x} onChange={(event) => update({ x: 1 - Number(event.currentTarget.value) })} aria-label="Event image horizontal position" className="min-h-8 w-full accent-primary" />
            <button type="button" aria-label="Move event image right" onClick={() => update({ x: clamp(crop.x - 0.08, 0, 1) })} className="min-h-8 shrink-0 rounded-lg border border-border bg-card px-2 text-[10px] font-semibold text-foreground">Right</button>
          </div>
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          <label htmlFor="event-image-zoom" className="font-medium text-foreground">Zoom: {crop.zoom.toFixed(1)}x</label>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Zoom event image out" disabled={crop.zoom <= 1} onClick={() => update({ zoom: Math.max(1, Math.round((crop.zoom - 0.1) * 10) / 10) })} className="min-h-8 shrink-0 rounded-lg border border-border bg-card px-2 text-xs font-semibold text-foreground disabled:opacity-40">-</button>
            <input id="event-image-zoom" type="range" min={1} max={3} step={0.1} value={crop.zoom} onChange={(event) => update({ zoom: Number(event.currentTarget.value) })} aria-label="Event image zoom" className="min-h-8 w-full accent-primary" />
            <button type="button" aria-label="Zoom event image in" disabled={crop.zoom >= 3} onClick={() => update({ zoom: Math.min(3, Math.round((crop.zoom + 0.1) * 10) / 10) })} className="min-h-8 shrink-0 rounded-lg border border-border bg-card px-2 text-xs font-semibold text-foreground disabled:opacity-40">+</button>
          </div>
        </div>
      </div>
    </>}
  </section>;
}

export type EventLogoCrop = { zoom: number; x: number; y: number };

export async function createCroppedEventLogoFile(file: File, crop: EventLogoCrop) {
  const bitmap = await createImageBitmap(file);
  const targetRatio = 16 / 10;
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
