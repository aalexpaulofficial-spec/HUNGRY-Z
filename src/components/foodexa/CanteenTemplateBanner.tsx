import { foodImage } from "@/lib/foodexa-images";
import { bannerCropStyle, moveBannerCrop } from "@/lib/banner-crop";
import { useRef } from "react";

type CanteenTemplateBannerProps = {
  imageUrl?: string | null;
  heading?: string | null;
  description?: string | null;
  canteenName: string;
  universityName: string;
  onOrder?: () => void;
  preview?: boolean;
  layout?: "overlay" | "dashboard";
  cropX?: number;
  cropY?: number;
  cropZoom?: number;
  onCropChange?: (crop: { x: number; y: number; zoom: number }) => void;
};

export function CanteenTemplateBanner({
  imageUrl,
  heading,
  description,
  canteenName,
  universityName,
  onOrder,
  preview = false,
  layout = "overlay",
  cropX = 50,
  cropY = 50,
  cropZoom = 1,
  onCropChange,
}: CanteenTemplateBannerProps) {
  const drag = useRef<{ pointerId: number; startX: number; startY: number; cropX: number; cropY: number; width: number; height: number } | null>(null);
  const resolvedImageUrl = imageUrl || foodImage("food-indian");

  return (
    <div
      data-testid="canteen-template-banner"
      className={`relative overflow-hidden rounded-[2rem] border border-primary/30 ${layout === "dashboard" ? "hz-template-banner-dashboard" : ""} ${preview ? "hz-template-banner-preview" : ""} ${onCropChange ? "cursor-grab touch-none active:cursor-grabbing" : ""}`}
      onPointerDown={(event) => {
        if (!onCropChange || !preview) return;
        const bounds = event.currentTarget.querySelector("img")?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
        drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, cropX, cropY, width: bounds.width, height: bounds.height };
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Some browsers do not support pointer capture for every pointer type.
          // Dragging still works while the pointer remains over the preview.
        }
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (!start || start.pointerId !== event.pointerId || !onCropChange) return;
        onCropChange(moveBannerCrop(
          { x: start.cropX, y: start.cropY, zoom: cropZoom },
          event.clientX - start.startX,
          event.clientY - start.startY,
          start.width,
          start.height,
        ));
      }}
      onPointerUp={(event) => { if (drag.current?.pointerId === event.pointerId) drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
      onLostPointerCapture={() => { drag.current = null; }}
    >
      {layout === "dashboard" && <div aria-hidden="true" className="hz-template-dashboard-backdrop" style={{ backgroundImage: `url("${resolvedImageUrl}")` }} />}
      <img src={resolvedImageUrl} alt="" className={`block h-auto w-full object-contain ${layout === "dashboard" ? "hz-template-dashboard-image" : ""}`} style={bannerCropStyle({ x: cropX, y: cropY, zoom: cropZoom })} />
      <div className={layout === "dashboard" ? "hz-template-dashboard-copy" : "absolute bottom-5 left-5 right-5"}>
        <p data-no-translate className="text-xs font-semibold uppercase tracking-widest text-primary-bright">{canteenName} · {universityName}</p>
        <h2 data-no-translate={heading?.trim() ? "" : undefined} className="display mt-1 text-3xl">{heading?.trim() || "Browse campus food."}</h2>
        {description?.trim() && <p data-no-translate className="mt-2 max-w-xl text-sm text-foreground/90">{description.trim()}</p>}
        <button type="button" onClick={onOrder} disabled={preview} className="mt-3 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground disabled:cursor-default">
          Order now ↗
        </button>
      </div>
    </div>
  );
}
