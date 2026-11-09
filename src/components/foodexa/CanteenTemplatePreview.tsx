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
    <div className="hz-template-preview-control">
      <div className="hz-template-preview-toolbar">
        <p><span>Preview</span><small>Drag the image to reposition</small></p>
        <div className="flex gap-1" aria-label="Banner preview size">
          {(["mobile", "tablet", "laptop"] as const).map((previewSize) => (
            <button key={previewSize} type="button" onClick={() => setSize(previewSize)} aria-pressed={size === previewSize} className={cn("hz-template-preview-size", size === previewSize && "is-active")}>
              {previewSize}
            </button>
          ))}
        </div>
      </div>
      <div className="hz-template-preview-frame mx-auto w-full transition-[max-width,aspect-ratio]" style={{ maxWidth: PREVIEW_WIDTHS[size] }} data-preview-size={size} data-testid="banner-preview-frame">
        <CanteenTemplateBanner
          imageUrl={imageUrl}
          heading={heading}
          description={description}
          canteenName={canteenName}
          universityName={universityName}
          cropX={safeCrop.x}
          cropY={safeCrop.y}
          cropZoom={safeCrop.zoom}
          layout="dashboard"
          onCropChange={onCropChange}
          preview
        />
      </div>
      <label className="hz-template-zoom-control">
        <span><b>Image zoom</b><small>{safeCrop.zoom.toFixed(2)}×</small></span>
        <input type="range" min="1" max="3" step="0.05" value={safeCrop.zoom} onChange={(event) => onCropChange(normalizeBannerCrop({ ...safeCrop, zoom: Number(event.currentTarget.value) }))} aria-label="Banner image zoom" className="w-full accent-primary" />
      </label>
    </div>
  );
}
