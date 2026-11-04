-- Adds the canteen review -> acceptance -> pricing/quantity confirmation ->
-- publication stages to the event/token schema from 0005.
ALTER TABLE public.faculty_events
  DROP CONSTRAINT IF EXISTS faculty_events_status_check,
  ADD COLUMN IF NOT EXISTS canteen_note text NOT NULL DEFAULT '' CHECK (char_length(canteen_note) <= 500),
  ADD COLUMN IF NOT EXISTS food_confirmation jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(food_confirmation) = 'object');
ALTER TABLE public.faculty_events ALTER COLUMN status SET DEFAULT 'requested';
UPDATE public.faculty_events SET status = 'requested' WHERE status = 'draft';
ALTER TABLE public.faculty_events ADD CONSTRAINT faculty_events_status_check
  CHECK (status IN ('requested','accepted','published','rejected','closed'));
ALTER TABLE public.faculty_events DROP CONSTRAINT IF EXISTS faculty_events_approved_capacity_check;
ALTER TABLE public.faculty_events ADD CONSTRAINT faculty_events_approved_capacity_check
  CHECK (approved_capacity BETWEEN 1 AND 200000);

-- Preserve any events already published under migration 0005 by snapshotting
-- their existing requested quantities and current canteen menu prices.
UPDATE public.faculty_events e SET food_confirmation = jsonb_build_object(
  'quantities', e.food_requirements,
  'prices', coalesce((
    SELECT jsonb_object_agg(menu.name, menu.price)
    FROM public.menu_items menu
    WHERE menu.canteen_id = e.canteen_id AND menu.name IN (SELECT key FROM jsonb_each(e.food_requirements))
  ), '{}'::jsonb)
)
WHERE e.status = 'published' AND e.food_confirmation = '{}'::jsonb AND e.food_requirements <> '{}'::jsonb
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_each(e.food_requirements) requested
    WHERE (SELECT count(*) FROM public.menu_items menu WHERE menu.canteen_id = e.canteen_id AND menu.name = requested.key AND menu.available) <> 1
  );

ALTER TABLE public.faculty_event_capacity_requests
  ADD COLUMN IF NOT EXISTS confirmed_food_quantities jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(confirmed_food_quantities) = 'object'),
  ADD COLUMN IF NOT EXISTS confirmed_food_prices jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(confirmed_food_prices) = 'object');

DROP FUNCTION IF EXISTS public.hungry_resolve_faculty_event_capacity_request(uuid, uuid, boolean, text);
CREATE OR REPLACE FUNCTION public.hungry_resolve_faculty_event_capacity_request(
  p_request_id uuid,
  p_canteen_owner_id uuid,
  p_approve boolean,
  p_confirmed_food_quantities jsonb DEFAULT '{}'::jsonb,
  p_confirmed_food_prices jsonb DEFAULT '{}'::jsonb,
  p_note text DEFAULT ''
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_request public.faculty_event_capacity_requests%ROWTYPE; v_event public.faculty_events%ROWTYPE;
BEGIN
  SELECT * INTO v_request FROM public.faculty_event_capacity_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR v_request.status <> 'pending' THEN RAISE EXCEPTION 'EVENT:request_not_pending'; END IF;
  SELECT * INTO v_event FROM public.faculty_events WHERE id = v_request.event_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.canteens c WHERE c.id = v_event.canteen_id AND c.owner_user_id = p_canteen_owner_id AND c.is_active
  ) THEN RAISE EXCEPTION 'EVENT:not_canteen_owner'; END IF;
  IF p_approve THEN
    IF jsonb_typeof(p_confirmed_food_quantities) <> 'object' OR jsonb_typeof(p_confirmed_food_prices) <> 'object' THEN
      RAISE EXCEPTION 'EVENT:invalid_food_confirmation';
    END IF;
    IF EXISTS (SELECT key FROM jsonb_object_keys(p_confirmed_food_quantities) AS q(key) EXCEPT SELECT key FROM jsonb_object_keys(p_confirmed_food_prices) AS p(key))
      OR EXISTS (SELECT key FROM jsonb_object_keys(p_confirmed_food_prices) AS p(key) EXCEPT SELECT key FROM jsonb_object_keys(p_confirmed_food_quantities) AS q(key))
      OR EXISTS (
        SELECT 1 FROM jsonb_each_text(p_confirmed_food_prices) price
        LEFT JOIN public.menu_items menu ON menu.canteen_id = v_event.canteen_id AND menu.name = price.key AND menu.available
        WHERE menu.id IS NULL OR price.value !~ '^[0-9]{1,7}$' OR menu.price::text <> price.value
      ) THEN RAISE EXCEPTION 'EVENT:invalid_food_prices'; END IF;
    UPDATE public.faculty_events
      SET approved_capacity = v_request.proposed_capacity,
          food_confirmation = jsonb_build_object('quantities', p_confirmed_food_quantities, 'prices', p_confirmed_food_prices),
          canteen_note = left(coalesce(p_note, ''), 500), updated_at = now()
      WHERE id = v_event.id;
    UPDATE public.faculty_event_capacity_requests
      SET status = 'approved', confirmed_food_quantities = p_confirmed_food_quantities,
          confirmed_food_prices = p_confirmed_food_prices, canteen_note = left(coalesce(p_note, ''), 500),
          responded_by = p_canteen_owner_id, responded_at = now()
      WHERE id = p_request_id;
    RETURN 'approved';
  END IF;
  UPDATE public.faculty_event_capacity_requests
    SET status = 'rejected', canteen_note = left(coalesce(p_note, ''), 500), responded_by = p_canteen_owner_id, responded_at = now()
    WHERE id = p_request_id;
  RETURN 'rejected';
END;
$$;

CREATE OR REPLACE FUNCTION public.hungry_review_faculty_event_request(
  p_event_id uuid, p_canteen_owner_id uuid, p_accept boolean, p_note text DEFAULT ''
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event public.faculty_events%ROWTYPE;
BEGIN
  SELECT * INTO v_event FROM public.faculty_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND OR v_event.status <> 'requested' THEN RAISE EXCEPTION 'EVENT:request_not_pending'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.canteens c WHERE c.id = v_event.canteen_id AND c.owner_user_id = p_canteen_owner_id AND c.is_active)
    THEN RAISE EXCEPTION 'EVENT:not_canteen_owner'; END IF;
  UPDATE public.faculty_events SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END,
    canteen_note = left(coalesce(p_note, ''), 500), updated_at = now() WHERE id = p_event_id;
  RETURN CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END;
END;
$$;

CREATE OR REPLACE FUNCTION public.hungry_publish_faculty_event(
  p_event_id uuid, p_canteen_owner_id uuid, p_confirmed_food_quantities jsonb, p_confirmed_food_prices jsonb, p_note text DEFAULT ''
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event public.faculty_events%ROWTYPE;
BEGIN
  SELECT * INTO v_event FROM public.faculty_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND OR v_event.status <> 'accepted' THEN RAISE EXCEPTION 'EVENT:not_accepted'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.canteens c WHERE c.id = v_event.canteen_id AND c.owner_user_id = p_canteen_owner_id AND c.is_active)
    THEN RAISE EXCEPTION 'EVENT:not_canteen_owner'; END IF;
  IF jsonb_typeof(p_confirmed_food_quantities) <> 'object' OR jsonb_typeof(p_confirmed_food_prices) <> 'object'
    OR p_confirmed_food_quantities = '{}'::jsonb THEN RAISE EXCEPTION 'EVENT:invalid_food_confirmation'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each_text(p_confirmed_food_quantities) q
    WHERE q.value !~ '^[1-9][0-9]{0,5}$' OR NOT (v_event.food_requirements ? q.key)
  ) OR EXISTS (
    SELECT 1 FROM jsonb_each_text(v_event.food_requirements) requested
    WHERE NOT (p_confirmed_food_quantities ? requested.key)
  ) THEN RAISE EXCEPTION 'EVENT:invalid_food_quantities'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each_text(p_confirmed_food_prices) p
    LEFT JOIN public.menu_items m ON m.canteen_id = v_event.canteen_id AND m.name = p.key
    WHERE m.id IS NULL OR p.value !~ '^[0-9]{1,7}$' OR m.price::text <> p.value
  ) OR EXISTS (SELECT key FROM jsonb_object_keys(p_confirmed_food_quantities) AS q(key) EXCEPT SELECT key FROM jsonb_object_keys(p_confirmed_food_prices) AS p(key))
    OR EXISTS (SELECT key FROM jsonb_object_keys(p_confirmed_food_prices) AS p(key) EXCEPT SELECT key FROM jsonb_object_keys(p_confirmed_food_quantities) AS q(key))
    THEN RAISE EXCEPTION 'EVENT:invalid_food_prices'; END IF;
  UPDATE public.faculty_events SET status = 'published',
    food_confirmation = jsonb_build_object('quantities', p_confirmed_food_quantities, 'prices', p_confirmed_food_prices),
    canteen_note = left(coalesce(p_note, ''), 500), updated_at = now() WHERE id = p_event_id;
  RETURN 'published';
END;
$$;

-- Event orders are limited to the published menu and quantities the canteen
-- confirmed. Prices must still match the published confirmation.
CREATE OR REPLACE FUNCTION public.hungry_place_event_order(
  p_event_id uuid, p_event_code text,
  p_user uuid, p_canteen uuid, p_customer_name text, p_lines jsonb, p_order_type text, p_payment_method text,
  p_expected_subtotal integer, p_coupon_id uuid, p_discount integer, p_idempotency_key text, p_order_number text, p_pickup_code text
) RETURNS TABLE (order_id uuid, already_existed boolean, token_number text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event public.faculty_events%ROWTYPE; v_order_id uuid; v_existing boolean; v_token text; v_used integer; v_sequence integer;
  v_line jsonb; v_item public.menu_items%ROWTYPE; v_consumed integer; v_limit integer; v_confirmed_price integer;
BEGIN
  SELECT * INTO v_event FROM public.faculty_events
    WHERE id = p_event_id AND event_code = p_event_code AND status = 'published' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EVENT:invalid_or_closed'; END IF;
  IF v_event.canteen_id <> p_canteen OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = p_user AND p.current_canteen_id = v_event.canteen_id AND p.role IN ('student','faculty','guest')
  ) THEN RAISE EXCEPTION 'EVENT:not_participant'; END IF;
  IF p_payment_method <> 'counter' THEN RAISE EXCEPTION 'EVENT:counter_payment_required'; END IF;
  SELECT t.token_number INTO v_token FROM public.faculty_event_tokens t
    JOIN public.orders o ON o.id = t.order_id WHERE o.user_id = p_user AND o.idempotency_key = p_idempotency_key AND t.event_id = p_event_id;
  IF FOUND THEN
    SELECT o.id, true INTO v_order_id, v_existing FROM public.orders o WHERE o.user_id = p_user AND o.idempotency_key = p_idempotency_key;
    RETURN QUERY SELECT v_order_id, v_existing, v_token; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.orders o WHERE o.user_id = p_user AND o.idempotency_key = p_idempotency_key) THEN RAISE EXCEPTION 'EVENT:order_already_used'; END IF;
  SELECT count(*)::integer INTO v_used FROM public.faculty_event_tokens WHERE event_id = p_event_id;
  IF v_used >= v_event.approved_capacity THEN RAISE EXCEPTION 'EVENT:full'; END IF;
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    SELECT * INTO v_item FROM public.menu_items WHERE id = (v_line->>'id')::uuid AND canteen_id = p_canteen AND available;
    IF NOT FOUND OR NOT (v_event.food_confirmation->'quantities' ? v_item.name) THEN RAISE EXCEPTION 'EVENT:item_not_in_event_menu'; END IF;
    v_limit := (v_event.food_confirmation->'quantities'->>v_item.name)::integer;
    v_confirmed_price := (v_event.food_confirmation->'prices'->>v_item.name)::integer;
    IF v_item.price <> v_confirmed_price THEN RAISE EXCEPTION 'EVENT:published_price_changed'; END IF;
    SELECT coalesce(sum((line->>'qty')::integer), 0)::integer INTO v_consumed
      FROM public.faculty_event_tokens t JOIN public.orders o ON o.id = t.order_id
      CROSS JOIN LATERAL jsonb_array_elements(o.lines) line
      WHERE t.event_id = p_event_id AND t.status <> 'cancelled' AND line->>'id' = v_item.id::text;
    IF v_consumed + (v_line->>'qty')::integer > v_limit THEN RAISE EXCEPTION 'EVENT:food_quantity_full'; END IF;
  END LOOP;
  SELECT o.order_id, o.already_existed INTO v_order_id, v_existing FROM public.hungry_place_order(
    p_user, p_canteen, p_customer_name, p_lines, p_order_type, p_payment_method,
    p_expected_subtotal, p_coupon_id, p_discount, p_idempotency_key, p_order_number, p_pickup_code
  ) o;
  IF NOT FOUND THEN RAISE EXCEPTION 'EVENT:order_failed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = v_order_id AND o.user_id = p_user AND o.canteen_id = v_event.canteen_id AND o.status = 'placed')
    THEN RAISE EXCEPTION 'EVENT:order_incomplete'; END IF;
  v_sequence := v_event.next_token_sequence;
  v_token := v_event.token_prefix || lpad(v_sequence::text, 3, '0');
  INSERT INTO public.faculty_event_tokens(event_id, sequence_number, token_number, customer_id, canteen_id, order_id)
    VALUES (p_event_id, v_sequence, v_token, p_user, v_event.canteen_id, v_order_id);
  UPDATE public.faculty_events SET next_token_sequence = v_sequence + 1, updated_at = now() WHERE id = p_event_id;
  RETURN QUERY SELECT v_order_id, v_existing, v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.hungry_resolve_faculty_event_capacity_request(uuid, uuid, boolean, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hungry_review_faculty_event_request(uuid, uuid, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hungry_publish_faculty_event(uuid, uuid, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hungry_resolve_faculty_event_capacity_request(uuid, uuid, boolean, jsonb, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hungry_review_faculty_event_request(uuid, uuid, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hungry_publish_faculty_event(uuid, uuid, jsonb, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hungry_get_event_capacity(uuid) TO authenticated, service_role;

