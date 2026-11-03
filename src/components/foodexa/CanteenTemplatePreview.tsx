import { useState } from "react";
import { CanteenTemplateBanner } from "@/components/foodexa/CanteenTemplateBanner";
import { normalizeBannerCrop, type BannerCrop } from "@/lib/banner-crop";
import { cn } from "@/lib/utils";

type PreviewSize = "mobile" | "tablet" | "laptop";
const PREVIEW_WIDTHS: Record<PreviewSize, number> = { mobile: 360, tablet: 640, laptop: 900 };

type CanteenTemplatePreviewProps = {
  imageUrl?: string | null;
  heading: string;
  description: string;
  canteenName: string;
  universityName: string;
  crop: BannerCrop;
  onCropChange: (crop: BannerCrop) => void;
};

export function CanteenTemplatePreview({ imageUrl, heading, description, canteenName, universityName, crop, onCropChange }: CanteenTemplatePreviewProps) {
  const [size, setSize] = useState<PreviewSize>("laptop");
  const safeCrop = normalizeBannerCrop(crop);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">Preview · drag image to reposition</p>
        <div className="flex gap-1" aria-label="Banner preview size">
          {(["mobile", "tablet", "laptop"] as const).map((previewSize) => (
            <button key={previewSize} type="button" onClick={() => setSize(previewSize)} aria-pressed={size === previewSize} className={cn("rounded-full border px-3 py-1 text-[10px] capitalize", size === previewSize ? "border-primary bg-primary/15 text-primary-bright" : "border-border text-muted-foreground")}>
              {previewSize}
            </button>
          ))}
        </div>
      </div>
      <div className="mx-auto w-full transition-[max-width]" style={{ maxWidth: PREVIEW_WIDTHS[size] }} data-testid="banner-preview-frame">
        <CanteenTemplateBanner
          imageUrl={imageUrl}
          heading={heading}
          description={description}
          canteenName={canteenName}
          universityName={universityName}
          cropX={safeCrop.x}
          cropY={safeCrop.y}
          cropZoom={safeCrop.zoom}
          onCropChange={onCropChange}
          preview
        />
      </div>
      <label className="mt-3 block space-y-1.5 text-xs text-muted-foreground">
        <span className="flex justify-between"><span>Zoom</span><span>{safeCrop.zoom.toFixed(2)}×</span></span>
        <input type="range" min="1" max="3" step="0.05" value={safeCrop.zoom} onChange={(event) => onCropChange(normalizeBannerCrop({ ...safeCrop, zoom: Number(event.currentTarget.value) }))} aria-label="Banner image zoom" className="w-full accent-primary" />
      </label>
    </div>
  );
}
