export type BannerCrop = { x: number; y: number; zoom: number };

export const DEFAULT_BANNER_CROP: BannerCrop = { x: 50, y: 50, zoom: 1 };

const boundedNumber = (value: unknown, fallback: number, minimum: number, maximum: number) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
};

export function normalizeBannerCrop(value?: Partial<BannerCrop> | null): BannerCrop {
  return {
    x: boundedNumber(value?.x, DEFAULT_BANNER_CROP.x, 0, 100),
    y: boundedNumber(value?.y, DEFAULT_BANNER_CROP.y, 0, 100),
    zoom: boundedNumber(value?.zoom, DEFAULT_BANNER_CROP.zoom, 1, 3),
  };
}

export function moveBannerCrop(start: BannerCrop, deltaX: number, deltaY: number, width: number, height: number): BannerCrop {
  if (width <= 0 || height <= 0 || ![deltaX, deltaY, width, height].every(Number.isFinite)) {
    return normalizeBannerCrop(start);
  }
  const safeStart = normalizeBannerCrop(start);
  const startMaxShiftX = ((safeStart.zoom - 1) / 2) * width;
  const startMaxShiftY = ((safeStart.zoom - 1) / 2) * height;
  const desiredShiftX = ((50 - safeStart.x) / 50) * startMaxShiftX + deltaX;
  const desiredShiftY = ((50 - safeStart.y) / 50) * startMaxShiftY + deltaY;
  const zoom = boundedNumber(Math.max(safeStart.zoom, 1 + (2 * Math.abs(desiredShiftX)) / width, 1 + (2 * Math.abs(desiredShiftY)) / height), safeStart.zoom, 1, 3);
  const maxShiftX = ((zoom - 1) / 2) * width;
  const maxShiftY = ((zoom - 1) / 2) * height;
  return {
    x: maxShiftX === 0 ? 50 : boundedNumber(50 - (desiredShiftX / maxShiftX) * 50, 50, 0, 100),
    y: maxShiftY === 0 ? 50 : boundedNumber(50 - (desiredShiftY / maxShiftY) * 50, 50, 0, 100),
    zoom,
  };
}

export function bannerCropStyle(value: Partial<BannerCrop> | null | undefined) {
  const crop = normalizeBannerCrop(value);
  const translateX = Number((((50 - crop.x) / 50) * ((crop.zoom - 1) / 2) * 100).toFixed(4));
  const translateY = Number((((50 - crop.y) / 50) * ((crop.zoom - 1) / 2) * 100).toFixed(4));
  return {
    objectPosition: "center",
    transform: `translate(${translateX}%, ${translateY}%) scale(${crop.zoom})`,
    transformOrigin: "center",
  };
}
