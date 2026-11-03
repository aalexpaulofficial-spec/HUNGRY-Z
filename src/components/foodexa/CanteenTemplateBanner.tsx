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
  cropX = 50,
  cropY = 50,
  cropZoom = 1,
  onCropChange,
}: CanteenTemplateBannerProps) {
  const drag = useRef<{ pointerId: number; startX: number; startY: number; cropX: number; cropY: number; width: number; height: number } | null>(null);

  return (
    <div
      className={`relative overflow-hidden rounded-[2rem] border border-primary/30 ${onCropChange ? "cursor-grab touch-none active:cursor-grabbing" : ""}`}
      onPointerDown={(event) => {
        if (!onCropChange || !preview) return;
        const bounds = event.currentTarget.getBoundingClientRect();
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
      <img src={imageUrl || foodImage("food-indian")} alt="" className="h-52 w-full object-cover opacity-70" style={bannerCropStyle({ x: cropX, y: cropY, zoom: cropZoom })} />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      <div className="absolute bottom-5 left-5 right-5">
        <p data-no-translate className="text-xs font-semibold uppercase tracking-widest text-primary-bright">{canteenName} · {universityName}</p>
        <h2 data-no-translate={heading?.trim() ? "" : undefined} className="display mt-1 text-3xl">{heading?.trim() || "Skip the queue."}</h2>
        {description?.trim() && <p data-no-translate className="mt-2 max-w-xl text-sm text-foreground/90">{description.trim()}</p>}
        <button type="button" onClick={onOrder} disabled={preview} className="mt-3 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground disabled:cursor-default">
          Order now ↗
        </button>
      </div>
    </div>
  );
}
