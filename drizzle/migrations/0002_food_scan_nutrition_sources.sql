-- Add database provenance and portion correction to existing food scans.
-- Existing scan rows are preserved and remain unverified because they have no FDC reference.
ALTER TABLE public.food_scans
  ADD COLUMN IF NOT EXISTS portion_g integer,
  ADD COLUMN IF NOT EXISTS fdc_id bigint,
  ADD COLUMN IF NOT EXISTS nutrition_source text,
  ADD COLUMN IF NOT EXISTS nutrition_reference text;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'food_scans_portion_g_range'
      AND conrelid = 'public.food_scans'::regclass
  ) THEN
    ALTER TABLE public.food_scans
      ADD CONSTRAINT food_scans_portion_g_range
      CHECK (portion_g IS NULL OR portion_g BETWEEN 1 AND 3000) NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE public.food_scans VALIDATE CONSTRAINT food_scans_portion_g_range;
--> statement-breakpoint

-- Unmatched or legacy scans must be represented as unknown, never as zero nutrients.
ALTER TABLE public.food_scans
  ALTER COLUMN calories DROP NOT NULL,
  ALTER COLUMN calories DROP DEFAULT,
  ALTER COLUMN protein_g DROP NOT NULL,
  ALTER COLUMN protein_g DROP DEFAULT,
  ALTER COLUMN carbs_g DROP NOT NULL,
  ALTER COLUMN carbs_g DROP DEFAULT,
  ALTER COLUMN fat_g DROP NOT NULL,
  ALTER COLUMN fat_g DROP DEFAULT,
  ALTER COLUMN fibre_g DROP NOT NULL,
  ALTER COLUMN fibre_g DROP DEFAULT,
  ALTER COLUMN sugar_g DROP NOT NULL,
  ALTER COLUMN sugar_g DROP DEFAULT;
--> statement-breakpoint

GRANT UPDATE (portion, portion_g, calories, protein_g, carbs_g, fat_g, fibre_g, sugar_g)
  ON public.food_scans TO authenticated;
--> statement-breakpoint

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
