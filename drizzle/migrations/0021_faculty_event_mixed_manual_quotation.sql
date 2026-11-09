-- Allow manual quotation lines alongside selected menu dishes.
-- Existing event, ownership, quantity, price, and total checks remain enforced.
CREATE OR REPLACE FUNCTION public.hungry_submit_faculty_event_quotation(
  p_event_id uuid,
  p_canteen_owner_id uuid,
  p_quantities jsonb,
  p_prices jsonb,
  p_note text DEFAULT ''
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event public.faculty_events%ROWTYPE;
  v_budget numeric;
BEGIN
  SELECT * INTO v_event
  FROM public.faculty_events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND OR v_event.status NOT IN ('accepted', 'changes_requested') THEN
    RAISE EXCEPTION 'EVENT:quotation_not_allowed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.canteens c
    WHERE c.id = v_event.canteen_id
      AND c.owner_user_id = p_canteen_owner_id
      AND c.is_active
  ) THEN
    RAISE EXCEPTION 'EVENT:not_canteen_owner';
  END IF;

  IF jsonb_typeof(p_quantities) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_prices) IS DISTINCT FROM 'object'
    OR p_quantities = '{}'::jsonb
    OR EXISTS (
      SELECT key FROM jsonb_object_keys(p_quantities) q(key)
      EXCEPT
      SELECT key FROM jsonb_object_keys(p_prices) p(key)
    )
    OR EXISTS (
      SELECT key FROM jsonb_object_keys(p_prices) p(key)
      EXCEPT
      SELECT key FROM jsonb_object_keys(p_quantities) q(key)
    ) THEN
    RAISE EXCEPTION 'EVENT:invalid_quotation';
  END IF;

  -- Quantity and price keys must be clean, valid values. Names can be existing
  -- menu dishes or free-text additions supplied by the canteen owner.
  IF EXISTS (
    SELECT 1
    FROM jsonb_each_text(p_quantities) q
    WHERE char_length(btrim(q.key)) NOT BETWEEN 1 AND 120
      OR q.key <> btrim(q.key)
      OR q.value !~ '^([1-9][0-9]{0,4}|100000)$'
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_each_text(p_prices) p
    WHERE p.value !~ '^(0|[1-9][0-9]{0,6}|10000000)$'
  ) OR EXISTS (
    SELECT lower(btrim(key))
    FROM jsonb_object_keys(p_quantities) AS q(key)
    GROUP BY lower(btrim(key))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'EVENT:invalid_quotation';
  END IF;

  SELECT sum((p_prices->>q.key)::numeric * q.value::numeric)
  INTO v_budget
  FROM jsonb_each_text(p_quantities) q;

  IF v_budget > 2147483647 THEN
    RAISE EXCEPTION 'EVENT:quotation_too_large';
  END IF;

  UPDATE public.faculty_events
  SET food_confirmation = jsonb_build_object('quantities', p_quantities, 'prices', p_prices),
      estimated_budget = v_budget::integer,
      canteen_note = left(coalesce(p_note, ''), 500),
      status = 'quotation_received',
      updated_at = now()
  WHERE id = p_event_id;

  RETURN v_budget::integer;
END;
$$;

REVOKE ALL ON FUNCTION public.hungry_submit_faculty_event_quotation(uuid, uuid, jsonb, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hungry_submit_faculty_event_quotation(uuid, uuid, jsonb, jsonb, text)
  TO service_role;
