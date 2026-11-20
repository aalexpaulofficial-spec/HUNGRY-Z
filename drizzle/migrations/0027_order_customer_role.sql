-- Snapshot the customer's campus role onto each order so canteen staff can
-- identify student, faculty, and guest orders without reading profile data.
BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_role text NOT NULL DEFAULT 'guest'
  CHECK (customer_role IN ('student', 'faculty', 'guest'));

UPDATE public.orders AS o
SET customer_role = p.role
FROM public.profiles AS p
WHERE p.id = o.user_id
  AND p.role IN ('student', 'faculty', 'guest');

CREATE OR REPLACE FUNCTION public.hz_set_order_customer_role()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = NEW.user_id;
  IF v_role NOT IN ('student', 'faculty', 'guest') THEN
    RAISE EXCEPTION 'HUNGRY:invalid_order_customer_role';
  END IF;
  NEW.customer_role := v_role;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.hz_set_order_customer_role() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS hz_set_order_customer_role_before_insert ON public.orders;
CREATE TRIGGER hz_set_order_customer_role_before_insert
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.hz_set_order_customer_role();

COMMIT;
