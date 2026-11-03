-- Upgrade legacy HC-prefixed owner IDs while issuing exactly 7-character IDs going forward.
-- Run after 003_canteen_owner_credentials.sql.

ALTER TABLE public.canteen_owner_credentials
  DROP CONSTRAINT IF EXISTS canteen_owner_credentials_login_id_check;
ALTER TABLE public.canteen_owner_credentials
  ADD CONSTRAINT canteen_owner_credentials_login_id_check
  CHECK (login_id ~ '^[A-Z2-9]{7}$' OR login_id ~ '^HC-[A-Z2-9]{8}$');

CREATE OR REPLACE FUNCTION public.hungry_owner_credentials_require_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT application.status
    INTO v_status
    FROM public.canteens AS canteen
    JOIN public.canteen_applications AS application ON application.id = canteen.application_id
   WHERE canteen.id = NEW.canteen_id
     AND canteen.is_active;

  IF v_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Owner credentials require an active, approved canteen';
  END IF;

  IF EXISTS (SELECT 1 FROM public.canteens WHERE code = NEW.login_id) THEN
    RAISE EXCEPTION 'Canteen Owner ID must be distinct from every customer canteen code';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.hungry_owner_credentials_require_approved() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS canteen_owner_credentials_approved_guard ON public.canteen_owner_credentials;
CREATE TRIGGER canteen_owner_credentials_approved_guard
  BEFORE INSERT OR UPDATE ON public.canteen_owner_credentials
  FOR EACH ROW EXECUTE FUNCTION public.hungry_owner_credentials_require_approved();

CREATE OR REPLACE FUNCTION public.hungry_canteen_code_not_owner_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.canteen_owner_credentials
     WHERE login_id = NEW.code
  ) THEN
    RAISE EXCEPTION 'Customer canteen code must be distinct from every Canteen Owner ID';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.hungry_canteen_code_not_owner_id() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS canteen_code_owner_id_guard ON public.canteens;
CREATE TRIGGER canteen_code_owner_id_guard
  BEFORE INSERT OR UPDATE OF code ON public.canteens
  FOR EACH ROW EXECUTE FUNCTION public.hungry_canteen_code_not_owner_id();
