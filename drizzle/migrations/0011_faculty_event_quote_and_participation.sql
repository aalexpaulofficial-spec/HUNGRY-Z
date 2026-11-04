-- Faculty event details, quote approval, standalone participation tokens and serving.
-- Existing normal orders and old order-linked event tokens remain intact.

ALTER TABLE public.faculty_events
  ADD COLUMN IF NOT EXISTS event_date date,
  ADD COLUMN IF NOT EXISTS venue text NOT NULL DEFAULT '' CHECK (char_length(venue) <= 200),
  ADD COLUMN IF NOT EXISTS faculty_note text NOT NULL DEFAULT '' CHECK (char_length(faculty_note) <= 500),
  ADD COLUMN IF NOT EXISTS estimated_budget integer NOT NULL DEFAULT 0 CHECK (estimated_budget >= 0),
  ADD COLUMN IF NOT EXISTS served_food_quantities jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(served_food_quantities) = 'object');

ALTER TABLE public.faculty_events DROP CONSTRAINT IF EXISTS faculty_events_status_check;
ALTER TABLE public.faculty_events ADD CONSTRAINT faculty_events_status_check
  CHECK (status IN ('requested','accepted','quotation_received','changes_requested','approved','published','rejected','closed'));

ALTER TABLE public.faculty_event_tokens ALTER COLUMN order_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.hungry_audit_faculty_event_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.faculty_event_audit(event_id, actor_id, action, details)
      VALUES (NEW.id, coalesce(auth.uid(), NEW.faculty_user_id), 'created', jsonb_build_object('initial_capacity', NEW.initial_capacity));
  ELSIF (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
    INSERT INTO public.faculty_event_audit(event_id, actor_id, action, details)
      VALUES (NEW.id, coalesce(auth.uid(), NEW.faculty_user_id), 'details_changed', jsonb_build_object('previous', to_jsonb(OLD), 'current', to_jsonb(NEW)));
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.hungry_submit_faculty_event_quotation(
  p_event_id uuid,
  p_canteen_owner_id uuid,
  p_quantities jsonb,
  p_prices jsonb,
  p_note text DEFAULT ''
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event public.faculty_events%ROWTYPE; v_budget numeric;
BEGIN
  SELECT * INTO v_event FROM public.faculty_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND OR v_event.status NOT IN ('accepted','changes_requested') THEN RAISE EXCEPTION 'EVENT:quotation_not_allowed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.canteens c WHERE c.id = v_event.canteen_id AND c.owner_user_id = p_canteen_owner_id AND c.is_active)
    THEN RAISE EXCEPTION 'EVENT:not_canteen_owner'; END IF;
  IF jsonb_typeof(p_quantities) <> 'object' OR jsonb_typeof(p_prices) <> 'object' OR p_quantities = '{}'::jsonb
    OR EXISTS (SELECT key FROM jsonb_object_keys(p_quantities) q(key) EXCEPT SELECT key FROM jsonb_object_keys(p_prices) p(key))
    OR EXISTS (SELECT key FROM jsonb_object_keys(p_prices) p(key) EXCEPT SELECT key FROM jsonb_object_keys(p_quantities) q(key)) THEN
    RAISE EXCEPTION 'EVENT:invalid_quotation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each_text(p_quantities) q
    WHERE q.value !~ '^[1-9][0-9]{0,5}$'
      OR NOT EXISTS (SELECT 1 FROM public.menu_items m WHERE m.canteen_id = v_event.canteen_id AND m.name = q.key AND m.available)
  ) OR EXISTS (
    SELECT 1 FROM jsonb_each_text(p_prices) p
    WHERE p.value !~ '^[0-9]{1,8}$'
  ) THEN RAISE EXCEPTION 'EVENT:invalid_quotation'; END IF;
  SELECT sum((p_prices->>q.key)::numeric * q.value::numeric) INTO v_budget FROM jsonb_each_text(p_quantities) q;
  IF v_budget > 2147483647 THEN RAISE EXCEPTION 'EVENT:quotation_too_large'; END IF;
  UPDATE public.faculty_events
    SET food_confirmation = jsonb_build_object('quantities', p_quantities, 'prices', p_prices),
        estimated_budget = v_budget::integer,
        canteen_note = left(coalesce(p_note, ''), 500),
        status = 'quotation_received', updated_at = now()
    WHERE id = p_event_id;
  RETURN v_budget::integer;
END;
$$;

CREATE OR REPLACE FUNCTION public.hungry_review_faculty_event_quotation(
  p_event_id uuid,
  p_faculty_user_id uuid,
  p_approve boolean,
  p_note text DEFAULT ''
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event public.faculty_events%ROWTYPE; v_status text;
BEGIN
  SELECT * INTO v_event FROM public.faculty_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND OR v_event.status <> 'quotation_received' THEN RAISE EXCEPTION 'EVENT:quotation_not_pending'; END IF;
  IF v_event.faculty_user_id <> p_faculty_user_id THEN RAISE EXCEPTION 'EVENT:not_faculty_owner'; END IF;
  v_status := CASE WHEN p_approve THEN 'approved' ELSE 'changes_requested' END;
  UPDATE public.faculty_events SET status = v_status, faculty_note = left(coalesce(p_note, ''), 500), updated_at = now() WHERE id = p_event_id;
  RETURN v_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.hungry_publish_faculty_event(
  p_event_id uuid, p_canteen_owner_id uuid, p_confirmed_food_quantities jsonb, p_confirmed_food_prices jsonb, p_note text DEFAULT ''
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event public.faculty_events%ROWTYPE;
BEGIN
  SELECT * INTO v_event FROM public.faculty_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND OR v_event.status <> 'approved' THEN RAISE EXCEPTION 'EVENT:faculty_approval_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.canteens c WHERE c.id = v_event.canteen_id AND c.owner_user_id = p_canteen_owner_id AND c.is_active)
    THEN RAISE EXCEPTION 'EVENT:not_canteen_owner'; END IF;
  IF p_confirmed_food_quantities IS DISTINCT FROM v_event.food_confirmation->'quantities'
    OR p_confirmed_food_prices IS DISTINCT FROM v_event.food_confirmation->'prices' THEN
    RAISE EXCEPTION 'EVENT:quotation_changed_after_approval';
  END IF;
  UPDATE public.faculty_events SET status = 'published', canteen_note = left(coalesce(p_note, canteen_note), 500), updated_at = now() WHERE id = p_event_id;
  RETURN 'published';
END;
$$;

CREATE OR REPLACE FUNCTION public.hungry_issue_faculty_event_token(
  p_event_id uuid, p_event_code text, p_customer_user_id uuid, p_canteen_id uuid
) RETURNS TABLE(token_number text, approved_capacity integer, issued_tokens integer, tokens_remaining integer, already_issued boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event public.faculty_events%ROWTYPE; v_token public.faculty_event_tokens%ROWTYPE; v_sequence integer; v_issued integer;
BEGIN
  SELECT * INTO v_event FROM public.faculty_events
    WHERE id = p_event_id AND event_code = p_event_code AND status = 'published' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EVENT:invalid_or_closed'; END IF;
  IF v_event.canteen_id <> p_canteen_id OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = p_customer_user_id AND p.current_canteen_id = v_event.canteen_id AND p.role IN ('student','faculty','guest')
  ) THEN RAISE EXCEPTION 'EVENT:not_participant'; END IF;
  SELECT * INTO v_token FROM public.faculty_event_tokens
    WHERE event_id = p_event_id AND customer_id = p_customer_user_id AND status <> 'cancelled'
    ORDER BY sequence_number LIMIT 1;
  IF FOUND THEN
    SELECT count(*) FILTER (WHERE status <> 'cancelled')::integer INTO v_issued FROM public.faculty_event_tokens WHERE event_id = p_event_id;
    RETURN QUERY SELECT v_token.token_number, v_event.approved_capacity, v_issued,
      greatest(0, v_event.approved_capacity - (SELECT count(*)::integer FROM public.faculty_event_tokens WHERE event_id = p_event_id)), true;
    RETURN;
  END IF;
  SELECT count(*)::integer INTO v_issued FROM public.faculty_event_tokens WHERE event_id = p_event_id;
  IF v_issued >= v_event.approved_capacity THEN RAISE EXCEPTION 'EVENT:full'; END IF;
  v_sequence := v_event.next_token_sequence;
  IF v_sequence > 9999 THEN RAISE EXCEPTION 'EVENT:four_digit_capacity_limit'; END IF;
  INSERT INTO public.faculty_event_tokens(event_id, sequence_number, token_number, customer_id, canteen_id, order_id)
    VALUES (p_event_id, v_sequence, lpad(v_sequence::text, 4, '0'), p_customer_user_id, v_event.canteen_id, NULL)
    RETURNING * INTO v_token;
  UPDATE public.faculty_events SET next_token_sequence = v_sequence + 1, updated_at = now() WHERE id = p_event_id;
  v_issued := v_issued + 1;
  RETURN QUERY SELECT v_token.token_number, v_event.approved_capacity, v_issued,
    greatest(0, v_event.approved_capacity - v_issued), false;
END;
$$;

CREATE OR REPLACE FUNCTION public.hungry_collect_faculty_event_token(p_token_id uuid, p_canteen_owner_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_token public.faculty_event_tokens%ROWTYPE;
BEGIN
  SELECT * INTO v_token FROM public.faculty_event_tokens WHERE id = p_token_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.canteens c WHERE c.id = v_token.canteen_id AND c.owner_user_id = p_canteen_owner_id AND c.is_active
  ) THEN RAISE EXCEPTION 'EVENT:not_canteen_owner'; END IF;
  IF v_token.status <> 'issued' THEN RAISE EXCEPTION 'EVENT:token_not_issued'; END IF;
  UPDATE public.faculty_event_tokens SET status = 'collected', collected_at = now() WHERE id = p_token_id;
  RETURN 'collected';
END;
$$;

CREATE OR REPLACE FUNCTION public.hungry_update_faculty_event_served_quantities(
  p_event_id uuid, p_canteen_owner_id uuid, p_quantities jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event public.faculty_events%ROWTYPE;
BEGIN
  SELECT * INTO v_event FROM public.faculty_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND OR v_event.status <> 'published' OR NOT EXISTS (
    SELECT 1 FROM public.canteens c WHERE c.id = v_event.canteen_id AND c.owner_user_id = p_canteen_owner_id AND c.is_active
  ) THEN RAISE EXCEPTION 'EVENT:not_canteen_owner'; END IF;
  IF jsonb_typeof(p_quantities) <> 'object' OR EXISTS (
    SELECT 1 FROM jsonb_each_text(p_quantities) q
    WHERE q.value !~ '^[0-9]{1,6}$'
      OR NOT (v_event.food_confirmation->'quantities' ? q.key)
      OR q.value::integer > (v_event.food_confirmation->'quantities'->>q.key)::integer
  ) THEN RAISE EXCEPTION 'EVENT:invalid_served_quantities'; END IF;
  UPDATE public.faculty_events SET served_food_quantities = p_quantities, updated_at = now() WHERE id = p_event_id;
  RETURN p_quantities;
END;
$$;

REVOKE ALL ON FUNCTION public.hungry_submit_faculty_event_quotation(uuid, uuid, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hungry_review_faculty_event_quotation(uuid, uuid, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hungry_issue_faculty_event_token(uuid, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hungry_collect_faculty_event_token(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hungry_update_faculty_event_served_quantities(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hungry_publish_faculty_event(uuid, uuid, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hungry_submit_faculty_event_quotation(uuid, uuid, jsonb, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hungry_review_faculty_event_quotation(uuid, uuid, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hungry_issue_faculty_event_token(uuid, text, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.hungry_collect_faculty_event_token(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.hungry_update_faculty_event_served_quantities(uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.hungry_publish_faculty_event(uuid, uuid, jsonb, jsonb, text) TO service_role;

