-- Persist canteen-local weekly hours and an owner-controlled override.
ALTER TABLE public.canteens
  ADD COLUMN availability_mode text NOT NULL DEFAULT 'schedule'
    CHECK (availability_mode IN ('schedule','open','closed')),
  ADD COLUMN timezone text NOT NULL DEFAULT 'Asia/Kolkata'
    CHECK (char_length(timezone) BETWEEN 1 AND 80),
  ADD COLUMN operating_hours jsonb NOT NULL DEFAULT '{
    "mon":{"open":"00:00","close":"24:00"},
    "tue":{"open":"00:00","close":"24:00"},
    "wed":{"open":"00:00","close":"24:00"},
    "thu":{"open":"00:00","close":"24:00"},
    "fri":{"open":"00:00","close":"24:00"},
    "sat":{"open":"00:00","close":"24:00"},
    "sun":{"open":"00:00","close":"24:00"}
  }'::jsonb;

CREATE OR REPLACE FUNCTION public.valid_canteen_hours(p_hours jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v_day text; v_hours jsonb; v_open text; v_close text; v_open_min integer; v_close_min integer;
BEGIN
  IF jsonb_typeof(p_hours) <> 'object' THEN RETURN false; END IF;
  FOREACH v_day IN ARRAY ARRAY['mon','tue','wed','thu','fri','sat','sun'] LOOP
    IF NOT (p_hours ? v_day) THEN RETURN false; END IF;
    v_hours := p_hours -> v_day;
    IF v_hours = 'null'::jsonb THEN CONTINUE; END IF;
    IF jsonb_typeof(v_hours) <> 'object' THEN RETURN false; END IF;
    v_open := v_hours ->> 'open';
    v_close := v_hours ->> 'close';
    IF v_open IS NULL OR v_close IS NULL
       OR v_open !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       OR v_close !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$|^24:00$' THEN RETURN false; END IF;
    IF v_open = '00:00' AND v_close = '24:00' THEN CONTINUE; END IF;
    v_open_min := split_part(v_open,':',1)::integer * 60 + split_part(v_open,':',2)::integer;
    v_close_min := CASE WHEN v_close = '24:00' THEN 1440 ELSE split_part(v_close,':',1)::integer * 60 + split_part(v_close,':',2)::integer END;
    IF v_close_min <= v_open_min THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END $$;

ALTER TABLE public.canteens ADD CONSTRAINT canteens_operating_hours_valid CHECK (public.valid_canteen_hours(operating_hours));

-- Every order insert, including retries and direct service-role writes, is
-- serialized against owner availability edits and checked in the same transaction.
CREATE OR REPLACE FUNCTION public.guard_order_canteen_availability()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_canteen public.canteens%ROWTYPE;
  v_local timestamp;
  v_day text;
  v_hours jsonb;
  v_open text;
  v_close text;
  v_minute integer;
  v_open_min integer;
  v_close_min integer;
BEGIN
  SELECT * INTO v_canteen FROM public.canteens WHERE id = NEW.canteen_id FOR UPDATE;
  IF NOT FOUND OR NOT v_canteen.is_active OR v_canteen.visibility = 'maintenance' THEN
    RAISE EXCEPTION 'HUNGRY:canteen_closed';
  END IF;
  IF v_canteen.availability_mode = 'closed' THEN RAISE EXCEPTION 'HUNGRY:canteen_closed'; END IF;
  IF v_canteen.availability_mode = 'open' THEN RETURN NEW; END IF;

  v_local := clock_timestamp() AT TIME ZONE v_canteen.timezone;
  v_day := lower(to_char(v_local, 'Dy'));
  v_hours := v_canteen.operating_hours -> v_day;
  IF v_hours IS NULL OR v_hours = 'null'::jsonb THEN RAISE EXCEPTION 'HUNGRY:canteen_closed'; END IF;
  v_open := v_hours ->> 'open';
  v_close := v_hours ->> 'close';
  v_minute := extract(hour FROM v_local)::integer * 60 + extract(minute FROM v_local)::integer;
  v_open_min := split_part(v_open,':',1)::integer * 60 + split_part(v_open,':',2)::integer;
  v_close_min := CASE WHEN v_close = '24:00' THEN 1440 ELSE split_part(v_close,':',1)::integer * 60 + split_part(v_close,':',2)::integer END;
  IF NOT (v_open_min = 0 AND v_close_min = 1440) AND (v_minute < v_open_min OR v_minute >= v_close_min) THEN
    RAISE EXCEPTION 'HUNGRY:canteen_closed';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER orders_check_canteen_availability
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_canteen_availability();

GRANT EXECUTE ON FUNCTION public.valid_canteen_hours(jsonb) TO authenticated, service_role;
