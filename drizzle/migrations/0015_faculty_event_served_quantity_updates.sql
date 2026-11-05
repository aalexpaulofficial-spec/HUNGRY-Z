-- Track the time at which actual food quantities were last saved. The names
-- and quoted quantities remain the event's historical food snapshot, so no
-- lookup against the current canteen menu is needed.
ALTER TABLE public.faculty_events
  ADD COLUMN IF NOT EXISTS served_food_updated_at timestamptz;

CREATE OR REPLACE FUNCTION public.hungry_update_faculty_event_served_quantities(
  p_event_id uuid, p_canteen_owner_id uuid, p_quantities jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event public.faculty_events%ROWTYPE;
BEGIN
  SELECT * INTO v_event FROM public.faculty_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND OR v_event.status <> 'published' OR NOT EXISTS (
    SELECT 1 FROM public.canteens c
    WHERE c.id = v_event.canteen_id AND c.owner_user_id = p_canteen_owner_id AND c.is_active
  ) THEN RAISE EXCEPTION 'EVENT:not_canteen_owner'; END IF;

  IF jsonb_typeof(p_quantities) <> 'object' OR EXISTS (
    SELECT 1 FROM jsonb_each_text(p_quantities) q
    WHERE q.value !~ '^[0-9]{1,6}$'
      OR NOT (v_event.food_confirmation->'quantities' ? q.key)
  ) THEN RAISE EXCEPTION 'EVENT:invalid_served_quantities'; END IF;

  UPDATE public.faculty_events
    SET served_food_quantities = p_quantities,
        served_food_updated_at = now(),
        updated_at = now()
    WHERE id = p_event_id;
  RETURN p_quantities;
END;
$$;

REVOKE ALL ON FUNCTION public.hungry_update_faculty_event_served_quantities(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hungry_update_faculty_event_served_quantities(uuid, uuid, jsonb) TO service_role;
