-- Canteen registration no longer collects FSSAI numbers or owner identity data.
-- Keep the legacy columns for existing application records, but allow new rows
-- to omit these values.
BEGIN;

ALTER TABLE public.canteen_applications
  ALTER COLUMN fssai_license DROP NOT NULL,
  ALTER COLUMN owner_id_proof DROP NOT NULL;

COMMIT;
