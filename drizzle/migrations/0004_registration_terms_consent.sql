-- Require explicit Privacy Policy and Terms & Conditions acceptance on every
-- Student, Faculty, and Guest signup. The auth.users trigger rejects signups
-- without consent; the profile stores a server-timestamped audit record.
-- Existing accounts and their profile data are preserved.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_version text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text;

CREATE OR REPLACE FUNCTION public.require_customer_signup_consent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  signup_role text := lower(coalesce(NEW.raw_user_meta_data->>'role', ''));
  accepted boolean := coalesce(NEW.raw_user_meta_data->>'accepted_terms', 'false') = 'true';
  version text := coalesce(NEW.raw_user_meta_data->>'terms_version', '');
BEGIN
  IF signup_role IN ('student', 'faculty', 'guest') THEN
    IF NOT accepted OR version <> '2026-11-04' THEN
      RAISE EXCEPTION 'Privacy Policy and Terms & Conditions acceptance is required';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_customer_signup_consent ON auth.users;
CREATE TRIGGER require_customer_signup_consent
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.require_customer_signup_consent();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r text := lower(coalesce(NEW.raw_user_meta_data->>'role',''));
  n text := left(trim(coalesce(NEW.raw_user_meta_data->>'full_name','')), 100);
  reg text := nullif(left(trim(coalesce(NEW.raw_user_meta_data->>'registration_number','')), 40), '');
BEGIN
  IF r NOT IN ('student','faculty','guest') THEN RETURN NEW; END IF;
  IF char_length(n) < 2 THEN RAISE EXCEPTION 'Full name required'; END IF;
  IF r <> 'guest' AND reg IS NULL THEN RAISE EXCEPTION 'Registration number required'; END IF;
  INSERT INTO public.profiles (
    id, role, full_name, registration_number, email,
    privacy_accepted_at, privacy_version, terms_accepted_at, terms_version
  ) VALUES (
    NEW.id, r, n, reg, NEW.email,
    now(), '2026-11-04', now(), '2026-11-04'
  );
  RETURN NEW;
END;
$$;
