-- Stable sequential event identifiers and order-earned HUNGRY AI usage.
-- Safe for existing event records: each event is assigned exactly one serial.
BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.faculty_event_serial_number_seq AS bigint;
ALTER TABLE public.faculty_events
  ADD COLUMN IF NOT EXISTS serial_number bigint;

SELECT setval(
  'public.faculty_event_serial_number_seq',
  COALESCE(MAX(serial_number), 1),
  COALESCE(MAX(serial_number), 0) > 0
)
FROM public.faculty_events;

WITH unnumbered AS (
  SELECT id, nextval('public.faculty_event_serial_number_seq') AS next_serial
  FROM public.faculty_events
  WHERE serial_number IS NULL
  ORDER BY created_at, id
)
UPDATE public.faculty_events AS event
SET serial_number = unnumbered.next_serial
FROM unnumbered
WHERE event.id = unnumbered.id;

SELECT setval(
  'public.faculty_event_serial_number_seq',
  GREATEST(COALESCE(MAX(serial_number), 1), 1),
  COALESCE(MAX(serial_number), 0) > 0
)
FROM public.faculty_events;

ALTER SEQUENCE public.faculty_event_serial_number_seq
  OWNED BY public.faculty_events.serial_number;
ALTER TABLE public.faculty_events
  ALTER COLUMN serial_number SET DEFAULT nextval('public.faculty_event_serial_number_seq'),
  ALTER COLUMN serial_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS faculty_events_serial_number_unique
  ON public.faculty_events (serial_number);

CREATE OR REPLACE FUNCTION public.hungry_keep_faculty_event_serial_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.serial_number IS DISTINCT FROM OLD.serial_number THEN
    RAISE EXCEPTION 'Faculty event serial numbers cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS faculty_events_serial_number_immutable ON public.faculty_events;
CREATE TRIGGER faculty_events_serial_number_immutable
  BEFORE UPDATE OF serial_number ON public.faculty_events
  FOR EACH ROW EXECUTE FUNCTION public.hungry_keep_faculty_event_serial_immutable();

CREATE TABLE IF NOT EXISTS public.scanner_usage (
  request_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS scanner_usage_user_status
  ON public.scanner_usage (user_id, status, created_at DESC);
ALTER TABLE public.scanner_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scanner_usage FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.scanner_usage TO service_role;

CREATE OR REPLACE FUNCTION public.hungry_get_scanner_usage()
RETURNS TABLE(completed_orders integer, total_usages integer, used_usages integer, remaining_usages integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_role text;
  v_orders integer;
  v_used integer;
  v_processing integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_user FOR UPDATE;
  IF v_role IS DISTINCT FROM 'student' THEN RAISE EXCEPTION 'HUNGRY:students_only'; END IF;

  DELETE FROM public.scanner_usage
  WHERE user_id = v_user AND status = 'processing' AND created_at < now() - interval '15 minutes';

  SELECT count(*)::integer INTO v_orders
  FROM public.orders o
  WHERE o.user_id = v_user
    AND ((o.completion_workflow = 'printed' AND o.food_received_confirmed_at IS NOT NULL)
      OR (o.completion_workflow IS DISTINCT FROM 'printed' AND o.status = 'collected'));
  SELECT count(*) FILTER (WHERE status = 'completed')::integer,
         count(*) FILTER (WHERE status = 'processing')::integer
    INTO v_used, v_processing
  FROM public.scanner_usage WHERE user_id = v_user;
  RETURN QUERY SELECT v_orders, v_orders, v_used, greatest(0, v_orders - v_used - v_processing);
END;
$$;

CREATE OR REPLACE FUNCTION public.hungry_reserve_scanner_usage(p_request_id uuid)
RETURNS TABLE(reserved boolean, completed_orders integer, total_usages integer, used_usages integer, remaining_usages integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_role text;
  v_owner uuid;
  v_status text;
  v_orders integer;
  v_used integer;
  v_processing integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_user FOR UPDATE;
  IF v_role IS DISTINCT FROM 'student' THEN RAISE EXCEPTION 'HUNGRY:students_only'; END IF;

  DELETE FROM public.scanner_usage
  WHERE user_id = v_user AND status = 'processing' AND created_at < now() - interval '15 minutes';

  SELECT user_id, status INTO v_owner, v_status
  FROM public.scanner_usage WHERE request_id = p_request_id;
  IF FOUND THEN
    IF v_owner <> v_user THEN RAISE EXCEPTION 'HUNGRY:invalid_request'; END IF;
    SELECT count(*)::integer INTO v_orders
    FROM public.orders o
    WHERE o.user_id = v_user
      AND ((o.completion_workflow = 'printed' AND o.food_received_confirmed_at IS NOT NULL)
        OR (o.completion_workflow IS DISTINCT FROM 'printed' AND o.status = 'collected'));
    SELECT count(*) FILTER (WHERE status = 'completed')::integer,
           count(*) FILTER (WHERE status = 'processing')::integer
      INTO v_used, v_processing
    FROM public.scanner_usage WHERE user_id = v_user;
    RETURN QUERY SELECT false, v_orders, v_orders, v_used, greatest(0, v_orders - v_used - v_processing);
    RETURN;
  END IF;

  SELECT count(*)::integer INTO v_orders
  FROM public.orders o
  WHERE o.user_id = v_user
    AND ((o.completion_workflow = 'printed' AND o.food_received_confirmed_at IS NOT NULL)
      OR (o.completion_workflow IS DISTINCT FROM 'printed' AND o.status = 'collected'));
  SELECT count(*) FILTER (WHERE status = 'completed')::integer,
         count(*) FILTER (WHERE status = 'processing')::integer
    INTO v_used, v_processing
  FROM public.scanner_usage WHERE user_id = v_user;
  IF v_used + v_processing >= v_orders THEN RAISE EXCEPTION 'HUNGRY:usage_limit_reached'; END IF;

  INSERT INTO public.scanner_usage(request_id, user_id, status)
  VALUES (p_request_id, v_user, 'processing');
  RETURN QUERY SELECT true, v_orders, v_orders, v_used, greatest(0, v_orders - v_used - v_processing - 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.hungry_complete_scanner_usage(p_request_id uuid)
RETURNS TABLE(completed_orders integer, total_usages integer, used_usages integer, remaining_usages integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_role text;
  v_orders integer;
  v_used integer;
  v_processing integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_user FOR UPDATE;
  IF v_role IS DISTINCT FROM 'student' THEN RAISE EXCEPTION 'HUNGRY:students_only'; END IF;
  UPDATE public.scanner_usage
  SET status = 'completed', completed_at = coalesce(completed_at, now())
  WHERE request_id = p_request_id AND user_id = v_user AND status = 'processing';
  IF NOT FOUND AND NOT EXISTS (
    SELECT 1 FROM public.scanner_usage WHERE request_id = p_request_id AND user_id = v_user AND status = 'completed'
  ) THEN RAISE EXCEPTION 'HUNGRY:usage_reservation_missing'; END IF;

  SELECT count(*)::integer INTO v_orders
  FROM public.orders o
  WHERE o.user_id = v_user
    AND ((o.completion_workflow = 'printed' AND o.food_received_confirmed_at IS NOT NULL)
      OR (o.completion_workflow IS DISTINCT FROM 'printed' AND o.status = 'collected'));
  SELECT count(*) FILTER (WHERE status = 'completed')::integer,
         count(*) FILTER (WHERE status = 'processing')::integer
    INTO v_used, v_processing
  FROM public.scanner_usage WHERE user_id = v_user;
  RETURN QUERY SELECT v_orders, v_orders, v_used, greatest(0, v_orders - v_used - v_processing);
END;
$$;

-- Only the server can release an unsuccessful in-flight analysis.
CREATE OR REPLACE FUNCTION public.hungry_release_scanner_usage(p_request_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.scanner_usage
  WHERE request_id = p_request_id AND user_id = p_user_id AND status = 'processing';
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.hungry_get_scanner_usage() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hungry_reserve_scanner_usage(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hungry_complete_scanner_usage(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hungry_release_scanner_usage(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hungry_get_scanner_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.hungry_reserve_scanner_usage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hungry_complete_scanner_usage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hungry_release_scanner_usage(uuid, uuid) TO service_role;

COMMIT;
