-- Persist the banner crop selected by each canteen owner.
ALTER TABLE public.canteen_templates
  ADD COLUMN banner_crop_x double precision NOT NULL DEFAULT 50 CHECK (banner_crop_x BETWEEN 0 AND 100),
  ADD COLUMN banner_crop_y double precision NOT NULL DEFAULT 50 CHECK (banner_crop_y BETWEEN 0 AND 100),
  ADD COLUMN banner_crop_zoom double precision NOT NULL DEFAULT 1 CHECK (banner_crop_zoom BETWEEN 1 AND 3);
