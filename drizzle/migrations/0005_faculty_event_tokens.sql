-- Faculty events, canteen-confirmed capacity changes, and atomic event tokens.
-- Existing orders and payment flows are unchanged; event checkout wraps the
-- existing order transaction and rolls it back if a token cannot be issued.

CREATE TABLE public.faculty_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  canteen_id uuid NOT NULL REFERENCES public.canteens(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  event_code text NOT NULL UNIQUE CHECK (event_code ~ '^[0-9]{7}$'),
  token_prefix text NOT NULL CHECK (token_prefix ~ '^[A-Z]$'),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  food_requirements jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(food_requirements) = 'object'),
  initial_capacity integer NOT NULL CHECK (initial_capacity BETWEEN 1 AND 100000),
  approved_capacity integer NOT NULL CHECK (approved_capacity BETWEEN 1 AND 100000),
  next_token_sequence integer NOT NULL DEFAULT 1 CHECK (next_token_sequence > 0),
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (approved_capacity >= initial_capacity)
);

CREATE INDEX faculty_events_canteen_status ON public.faculty_events(canteen_id, status, created_at DESC);
CREATE INDEX faculty_events_faculty_created ON public.faculty_events(faculty_user_id, created_at DESC);
ALTER TABLE public.faculty_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.faculty_events TO authenticated;
GRANT ALL ON public.faculty_events TO service_role;
CREATE POLICY "Faculty and participating canteen read events" ON public.faculty_events
  FOR SELECT TO authenticated USING (
    faculty_user_id = auth.uid()
    OR public.owns_canteen(canteen_id)
    OR (status = 'published' AND canteen_id = public.current_canteen())
  );

CREATE TABLE public.faculty_event_capacity_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.faculty_events(id) ON DELETE CASCADE,
  faculty_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  additional_tokens integer NOT NULL CHECK (additional_tokens BETWEEN 1 AND 100000),
  proposed_capacity integer NOT NULL CHECK (proposed_capacity BETWEEN 1 AND 200000),
  revised_food_quantities jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(revised_food_quantities) = 'object'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  canteen_note text NOT NULL DEFAULT '' CHECK (char_length(canteen_note) <= 500),
  responded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);
CREATE UNIQUE INDEX faculty_event_one_pending_capacity_request
  ON public.faculty_event_capacity_requests(event_id) WHERE status = 'pending';
CREATE INDEX faculty_event_capacity_by_event ON public.faculty_event_capacity_requests(event_id, created_at DESC);
ALTER TABLE public.faculty_event_capacity_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.faculty_event_capacity_requests TO authenticated;
GRANT ALL ON public.faculty_event_capacity_requests TO service_role;
CREATE POLICY "Faculty and participating canteen read capacity requests" ON public.faculty_event_capacity_requests
  FOR SELECT TO authenticated USING (
    faculty_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.faculty_events e
      WHERE e.id = event_id AND public.owns_canteen(e.canteen_id)
    )
  );

CREATE TABLE public.faculty_event_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.faculty_events(id) ON DELETE RESTRICT,
  sequence_number integer NOT NULL CHECK (sequence_number > 0),
  token_number text NOT NULL,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  canteen_id uuid NOT NULL REFERENCES public.canteens(id) ON DELETE CASCADE,
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','collected','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  collected_at timestamptz,
  cancelled_at timestamptz,
  UNIQUE(event_id, sequence_number),
  UNIQUE(event_id, token_number)
);
CREATE INDEX faculty_event_tokens_customer ON public.faculty_event_tokens(customer_id, created_at DESC);
CREATE INDEX faculty_event_tokens_event ON public.faculty_event_tokens(event_id, sequence_number);
CREATE INDEX faculty_event_tokens_canteen ON public.faculty_event_tokens(canteen_id, status, created_at DESC);
ALTER TABLE public.faculty_event_tokens ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.faculty_event_tokens TO authenticated;
GRANT ALL ON public.faculty_event_tokens TO service_role;
CREATE POLICY "Customers faculty and canteen read event tokens" ON public.faculty_event_tokens
  FOR SELECT TO authenticated USING (
    customer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.faculty_events e WHERE e.id = event_id AND e.faculty_user_id = auth.uid())
    OR public.owns_canteen(canteen_id)
  );

CREATE TABLE public.faculty_event_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.faculty_events(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('created','details_changed','capacity_requested','capacity_approved','capacity_rejected','token_issued','token_collected','token_cancelled')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX faculty_event_audit_event_created ON public.faculty_event_audit(event_id, created_at DESC);
ALTER TABLE public.faculty_event_audit ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.faculty_event_audit TO authenticated;
GRANT ALL ON public.faculty_event_audit TO service_role;
CREATE POLICY "Faculty and participating canteen read event audit" ON public.faculty_event_audit
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.faculty_events e
      WHERE e.id = event_id AND (e.faculty_user_id = auth.uid() OR public.owns_canteen(e.canteen_id))
    )
  );

CREATE OR REPLACE FUNCTION public.hungry_audit_faculty_event_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.faculty_event_audit(event_id, actor_id, action, details)
      VALUES (NEW.id, coalesce(auth.uid(), NEW.faculty_user_id), 'created', jsonb_build_object('initial_capacity', NEW.initial_capacity));
  ELSIF (NEW.name, NEW.description, NEW.food_requirements, NEW.status) IS DISTINCT FROM (OLD.name, OLD.description, OLD.food_requirements, OLD.status) THEN
    INSERT INTO public.faculty_event_audit(event_id, actor_id, action, details)
      VALUES (NEW.id, coalesce(auth.uid(), NEW.faculty_user_id), 'details_changed', jsonb_build_object('previous', to_jsonb(OLD), 'current', to_jsonb(NEW)));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER faculty_events_audit_change AFTER INSERT OR UPDATE ON public.faculty_events
  FOR EACH ROW EXECUTE FUNCTION public.hungry_audit_faculty_event_change();

CREATE OR REPLACE FUNCTION public.hungry_audit_faculty_event_capacity_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_action text; v_actor uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'capacity_requested';
    v_actor := coalesce(auth.uid(), NEW.faculty_user_id);
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','rejected') THEN
    v_action := CASE WHEN NEW.status = 'approved' THEN 'capacity_approved' ELSE 'capacity_rejected' END;
    v_actor := coalesce(auth.uid(), NEW.responded_by);
  ELSE
    RETURN NEW;
  END IF;
  INSERT INTO public.faculty_event_audit(event_id, actor_id, action, details)
    VALUES (NEW.event_id, v_actor, v_action, jsonb_build_object('request_id', NEW.id, 'additional_tokens', NEW.additional_tokens, 'proposed_capacity', NEW.proposed_capacity, 'food_quantities', NEW.revised_food_quantities, 'note', NEW.canteen_note));
  RETURN NEW;
END;
$$;
CREATE TRIGGER faculty_event_capacity_audit_change AFTER INSERT OR UPDATE ON public.faculty_event_capacity_requests
  FOR EACH ROW EXECUTE FUNCTION public.hungry_audit_faculty_event_capacity_change();

CREATE OR REPLACE FUNCTION public.hungry_audit_faculty_event_token_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_action text; v_actor uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'token_issued';
    v_actor := NEW.customer_id;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    v_action := CASE NEW.status WHEN 'collected' THEN 'token_collected' WHEN 'cancelled' THEN 'token_cancelled' ELSE NULL END;
    IF v_action IS NULL THEN RETURN NEW; END IF;
    SELECT c.owner_user_id INTO v_actor FROM public.canteens c WHERE c.id = NEW.canteen_id;
  ELSE
    RETURN NEW;
  END IF;
  INSERT INTO public.faculty_event_audit(event_id, actor_id, action, details)
    VALUES (NEW.event_id, coalesce(auth.uid(), v_actor), v_action, jsonb_build_object('token_number', NEW.token_number, 'order_id', NEW.order_id, 'customer_id', NEW.customer_id, 'canteen_id', NEW.canteen_id));
  RETURN NEW;
END;
$$;
CREATE TRIGGER faculty_event_tokens_audit_change AFTER INSERT OR UPDATE ON public.faculty_event_tokens
  FOR EACH ROW EXECUTE FUNCTION public.hungry_audit_faculty_event_token_change();

CREATE OR REPLACE FUNCTION public.hungry_resolve_faculty_event_capacity_request(
  p_request_id uuid, p_canteen_owner_id uuid, p_approve boolean, p_note text DEFAULT ''
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
    UPDATE public.faculty_events SET approved_capacity = v_request.proposed_capacity, updated_at = now() WHERE id = v_event.id;
    UPDATE public.faculty_event_capacity_requests
      SET status = 'approved', canteen_note = left(coalesce(p_note, ''), 500), responded_by = p_canteen_owner_id, responded_at = now()
      WHERE id = p_request_id;
    RETURN 'approved';
  END IF;
  UPDATE public.faculty_event_capacity_requests
    SET status = 'rejected', canteen_note = left(coalesce(p_note, ''), 500), responded_by = p_canteen_owner_id, responded_at = now()
    WHERE id = p_request_id;
  RETURN 'rejected';
END;
$$;

CREATE OR REPLACE FUNCTION public.hungry_place_event_order(
  p_event_id uuid, p_event_code text,
  p_user uuid, p_canteen uuid, p_customer_name text, p_lines jsonb, p_order_type text, p_payment_method text,
  p_expected_subtotal integer, p_coupon_id uuid, p_discount integer, p_idempotency_key text, p_order_number text, p_pickup_code text
) RETURNS TABLE (order_id uuid, already_existed boolean, token_number text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event public.faculty_events%ROWTYPE; v_order_id uuid; v_existing boolean; v_token text; v_used integer; v_sequence integer;
BEGIN
  SELECT * INTO v_event FROM public.faculty_events
    WHERE id = p_event_id AND event_code = p_event_code AND status = 'published'
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EVENT:invalid_or_closed'; END IF;
  IF v_event.canteen_id <> p_canteen OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = p_user AND p.current_canteen_id = v_event.canteen_id AND p.role IN ('student','faculty','guest')
  ) THEN RAISE EXCEPTION 'EVENT:not_participant'; END IF;
  IF p_payment_method <> 'counter' THEN RAISE EXCEPTION 'EVENT:counter_payment_required'; END IF;

  SELECT t.token_number INTO v_token FROM public.faculty_event_tokens t
    JOIN public.orders o ON o.id = t.order_id
    WHERE o.user_id = p_user AND o.idempotency_key = p_idempotency_key AND t.event_id = p_event_id;
  IF FOUND THEN
    SELECT o.id, true INTO v_order_id, v_existing FROM public.orders o WHERE o.user_id = p_user AND o.idempotency_key = p_idempotency_key;
    RETURN QUERY SELECT v_order_id, v_existing, v_token;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.orders o WHERE o.user_id = p_user AND o.idempotency_key = p_idempotency_key) THEN
    RAISE EXCEPTION 'EVENT:order_already_used';
  END IF;

  SELECT count(*)::integer INTO v_used FROM public.faculty_event_tokens WHERE event_id = p_event_id;
  IF v_used >= v_event.approved_capacity THEN RAISE EXCEPTION 'EVENT:full'; END IF;

  SELECT o.order_id, o.already_existed INTO v_order_id, v_existing
    FROM public.hungry_place_order(
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

CREATE OR REPLACE FUNCTION public.hungry_get_event_capacity(p_event_id uuid)
RETURNS TABLE (approved_capacity integer, issued_tokens integer, tokens_remaining integer, collected_tokens integer, cancelled_tokens integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event public.faculty_events%ROWTYPE;
BEGIN
  SELECT * INTO v_event FROM public.faculty_events WHERE id = p_event_id AND status = 'published';
  IF NOT FOUND OR NOT (
    v_event.canteen_id = public.current_canteen()
    OR v_event.faculty_user_id = auth.uid()
    OR public.owns_canteen(v_event.canteen_id)
  ) THEN RAISE EXCEPTION 'EVENT:not_available'; END IF;
  RETURN QUERY SELECT
    v_event.approved_capacity,
    count(*) FILTER (WHERE t.status <> 'cancelled')::integer,
    greatest(0, v_event.approved_capacity - count(*)::integer),
    count(*) FILTER (WHERE t.status = 'collected')::integer,
    count(*) FILTER (WHERE t.status = 'cancelled')::integer
  FROM public.faculty_event_tokens t WHERE t.event_id = p_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.hungry_sync_event_token_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'collected' THEN
      UPDATE public.faculty_event_tokens SET status = 'collected', collected_at = coalesce(collected_at, now()) WHERE order_id = NEW.id AND status = 'issued';
    ELSIF NEW.status = 'cancelled' THEN
      UPDATE public.faculty_event_tokens SET status = 'cancelled', cancelled_at = coalesce(cancelled_at, now()) WHERE order_id = NEW.id AND status = 'issued';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER orders_sync_faculty_event_token AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.hungry_sync_event_token_status();

REVOKE ALL ON FUNCTION public.hungry_resolve_faculty_event_capacity_request(uuid, uuid, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hungry_place_event_order(uuid, text, uuid, uuid, text, jsonb, text, text, integer, uuid, integer, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hungry_get_event_capacity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hungry_resolve_faculty_event_capacity_request(uuid, uuid, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hungry_place_event_order(uuid, text, uuid, uuid, text, jsonb, text, text, integer, uuid, integer, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hungry_get_event_capacity(uuid) TO authenticated, service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.faculty_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.faculty_event_capacity_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.faculty_event_tokens;
