-- Adds grouping for multiple foods detected in one photo and permits safe food-name corrections.
-- Existing scan rows remain intact and are kept as ungrouped history entries.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.food_scans') IS NULL THEN
    RAISE EXCEPTION 'public.food_scans does not exist; apply the existing scanner bootstrap migration first.';
  END IF;
  IF to_regclass('public.scanner_access') IS NULL THEN
    RAISE EXCEPTION 'public.scanner_access does not exist; apply the existing scanner bootstrap migration first.';
  END IF;
END $$;

ALTER TABLE public.food_scans
  ADD COLUMN IF NOT EXISTS scan_group_id uuid;

CREATE INDEX IF NOT EXISTS food_scans_group_created
  ON public.food_scans (scan_group_id, created_at)
  WHERE scan_group_id IS NOT NULL;

-- Existing RLS policies continue to restrict UPDATE to the student's own active scans.
-- This column grant only allows correcting food identity and its verified nutrition result.
REVOKE UPDATE ON public.food_scans FROM authenticated;
GRANT UPDATE (
  food_name,
  portion,
  portion_g,
  calories,
  protein_g,
  carbs_g,
  fat_g,
  fibre_g,
  sugar_g,
  fdc_id,
  nutrition_source,
  nutrition_reference
) ON public.food_scans TO authenticated;

ALTER TABLE public.food_scans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'food_scans'
      AND policyname = 'Active students update own scans'
  ) THEN
    CREATE POLICY "Active students update own scans" ON public.food_scans
      FOR UPDATE TO authenticated
      USING (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.scanner_access a
          WHERE a.user_id = auth.uid() AND a.expires_at > now()
        )
      )
      WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.scanner_access a
          WHERE a.user_id = auth.uid() AND a.expires_at > now()
        )
      );
  END IF;
END $$;

COMMIT;
