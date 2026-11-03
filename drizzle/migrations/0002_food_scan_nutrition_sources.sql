-- HUNGRYZ SCAN bootstrap + nutrition provenance/portion correction.
-- Safe to rerun. Requires the existing HUNGRYZ core `profiles` table and Supabase auth.uid().
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'HUNGRYZ core profiles table is missing. Stop and confirm this is the correct Supabase project before applying scanner SQL.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) THEN
    RAISE EXCEPTION 'public.profiles.role is missing. Stop and confirm this is the correct HUNGRYZ Supabase schema.';
  END IF;
  IF to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'Supabase auth.uid() is missing. Stop and confirm this is the correct Supabase project.';
  END IF;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.scanner_access (
  user_id uuid PRIMARY KEY,
  version text NOT NULL DEFAULT '1.0',
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
--> statement-breakpoint

GRANT SELECT ON public.scanner_access TO authenticated;
GRANT ALL ON public.scanner_access TO service_role;
ALTER TABLE public.scanner_access ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scanner_access'
      AND policyname = 'Users read own scanner access'
  ) THEN
    CREATE POLICY "Users read own scanner access" ON public.scanner_access
      FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.hungry_start_scanner_trial()
RETURNS public.scanner_access
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.scanner_access;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student'
  ) THEN
    RAISE EXCEPTION 'HUNGRY:students_only';
  END IF;
  INSERT INTO public.scanner_access (user_id, started_at, expires_at)
  VALUES (auth.uid(), now(), now() + interval '1 month')
  ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO r FROM public.scanner_access WHERE user_id = auth.uid();
  RETURN r;
END $$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.hungry_start_scanner_trial() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hungry_start_scanner_trial() TO authenticated;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.food_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  food_name text NOT NULL CHECK (char_length(food_name) BETWEEN 1 AND 120),
  portion text NOT NULL DEFAULT '',
  calories integer,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fibre_g numeric,
  sugar_g numeric,
  confidence text NOT NULL DEFAULT 'medium',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS food_scans_user_created
  ON public.food_scans (user_id, created_at DESC);
--> statement-breakpoint

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

-- Existing values are preserved. New unmatched/legacy rows may store unknowns as NULL.
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

GRANT SELECT, INSERT, DELETE ON public.food_scans TO authenticated;
GRANT ALL ON public.food_scans TO service_role;
REVOKE UPDATE ON public.food_scans FROM authenticated;
GRANT UPDATE (portion, portion_g, calories, protein_g, carbs_g, fat_g, fibre_g, sugar_g)
  ON public.food_scans TO authenticated;
ALTER TABLE public.food_scans ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'food_scans'
      AND policyname = 'Users read own scans'
  ) THEN
    CREATE POLICY "Users read own scans" ON public.food_scans
      FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'food_scans'
      AND policyname = 'Users delete own scans'
  ) THEN
    CREATE POLICY "Users delete own scans" ON public.food_scans
      FOR DELETE TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'food_scans'
      AND policyname = 'Active students insert scans'
  ) THEN
    CREATE POLICY "Active students insert scans" ON public.food_scans
      FOR INSERT TO authenticated WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.scanner_access a
          WHERE a.user_id = auth.uid() AND a.expires_at > now()
        )
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'food_scans'
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
