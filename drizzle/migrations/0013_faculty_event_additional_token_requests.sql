-- Student requests for more event participation tokens. Uses the existing
-- faculty_events and faculty_event_tokens records; no second event system.
CREATE TABLE IF NOT EXISTS public.faculty_event_token_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.faculty_events(id) ON DELETE CASCADE,
  requester_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_count integer NOT NULL CHECK (requested_count BETWEEN 1 AND 9999),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  canteen_note text NOT NULL DEFAULT '' CHECK (char_length(canteen_note) <= 500),
  responded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

CREATE INDEX IF NOT EXISTS faculty_event_token_requests_event_created
  ON public.faculty_event_token_requests(event_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS faculty_event_one_pending_token_request
  ON public.faculty_event_token_requests(event_id, requester_user_id) WHERE status = 'pending';

ALTER TABLE public.faculty_event_token_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.faculty_event_token_requests TO authenticated;
GRANT ALL ON public.faculty_event_token_requests TO service_role;
DROP POLICY IF EXISTS "Participants faculty and canteen read token requests" ON public.faculty_event_token_requests;
CREATE POLICY "Participants faculty and canteen read token requests"
  ON public.faculty_event_token_requests FOR SELECT TO authenticated
  USING (
    requester_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.faculty_events e
      WHERE e.id = event_id
        AND (e.faculty_user_id = auth.uid() OR public.owns_canteen(e.canteen_id))
    )
  );

CREATE OR REPLACE FUNCTION public.hungry_request_faculty_event_tokens(
  p_event_id uuid, p_requester_user_id uuid, p_requested_count integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event public.faculty_events%ROWTYPE;
  v_issued integer;
  v_reserved integer;
  v_remaining integer;
  v_request public.faculty_event_token_requests%ROWTYPE;
BEGIN
  IF p_requested_count IS NULL OR p_requested_count < 1 OR p_requested_count > 9999 THEN
    RAISE EXCEPTION 'EVENT:invalid_token_count';
  END IF;
  SELECT * INTO v_event FROM public.faculty_events
    WHERE id = p_event_id AND status = 'published' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EVENT:invalid_or_closed'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_requester_user_id
      AND p.current_canteen_id = v_event.canteen_id
      AND p.role IN ('student','faculty','guest')
  ) THEN RAISE EXCEPTION 'EVENT:not_participant'; END IF;
  SELECT count(*) FILTER (WHERE status <> 'cancelled')::integer INTO v_issued
    FROM public.faculty_event_tokens WHERE event_id = p_event_id;
  SELECT coalesce(sum(requested_count), 0)::integer INTO v_reserved
    FROM public.faculty_event_token_requests WHERE event_id = p_event_id AND status = 'pending';
  v_remaining := greatest(0, v_event.approved_capacity - v_issued - v_reserved);
  IF p_requested_count > v_remaining THEN RAISE EXCEPTION 'EVENT:insufficient_capacity'; END IF;
  INSERT INTO public.faculty_event_token_requests(event_id, requester_user_id, requested_count)
    VALUES (p_event_id, p_requester_user_id, p_requested_count) RETURNING * INTO v_request;
  RETURN jsonb_build_object('request_id', v_request.id, 'status', v_request.status,
    'requested_count', v_request.requested_count, 'tokens_remaining', v_remaining - p_requested_count);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'EVENT:request_pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.hungry_resolve_faculty_event_token_request(
  p_request_id uuid, p_canteen_owner_id uuid, p_approve boolean, p_note text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_request public.faculty_event_token_requests%ROWTYPE;
  v_event public.faculty_events%ROWTYPE;
  v_issued integer;
  v_reserved integer;
  v_sequence integer;
  v_token_number text;
  v_tokens jsonb := '[]'::jsonb;
  v_index integer;
BEGIN
  SELECT * INTO v_request FROM public.faculty_event_token_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR v_request.status <> 'pending' THEN RAISE EXCEPTION 'EVENT:request_not_pending'; END IF;
  SELECT * INTO v_event FROM public.faculty_events WHERE id = v_request.event_id FOR UPDATE;
  IF NOT FOUND OR v_event.status <> 'published' OR NOT EXISTS (
    SELECT 1 FROM public.canteens c
    WHERE c.id = v_event.canteen_id AND c.owner_user_id = p_canteen_owner_id AND c.is_active
  ) THEN RAISE EXCEPTION 'EVENT:not_canteen_owner'; END IF;

  IF p_approve THEN
    SELECT count(*) FILTER (WHERE status <> 'cancelled')::integer INTO v_issued
      FROM public.faculty_event_tokens WHERE event_id = v_event.id;
    SELECT coalesce(sum(requested_count), 0)::integer INTO v_reserved
      FROM public.faculty_event_token_requests
      WHERE event_id = v_event.id AND status = 'pending' AND id <> v_request.id;
    IF v_issued + v_reserved + v_request.requested_count > v_event.approved_capacity
      OR v_event.next_token_sequence + v_request.requested_count - 1 > 9999 THEN
      RAISE EXCEPTION 'EVENT:insufficient_capacity';
    END IF;
    FOR v_index IN 1..v_request.requested_count LOOP
      v_sequence := v_event.next_token_sequence + v_index - 1;
      INSERT INTO public.faculty_event_tokens(event_id, sequence_number, token_number, customer_id, canteen_id, order_id)
        VALUES (v_event.id, v_sequence, lpad(v_sequence::text, 4, '0'), v_request.requester_user_id, v_event.canteen_id, NULL)
        RETURNING token_number INTO v_token_number;
      v_tokens := v_tokens || jsonb_build_array(jsonb_build_object('token_number', v_token_number));
    END LOOP;
    UPDATE public.faculty_events SET next_token_sequence = next_token_sequence + v_request.requested_count, updated_at = now()
      WHERE id = v_event.id;
  END IF;

  UPDATE public.faculty_event_token_requests
    SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
        canteen_note = left(coalesce(p_note, ''), 500), responded_by = p_canteen_owner_id, responded_at = now()
    WHERE id = v_request.id;
  RETURN jsonb_build_object('status', CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    'requester_user_id', v_request.requester_user_id, 'tokens', v_tokens);
END;
$$;

-- Keep the existing single-token action compatible while honoring capacity
-- reserved by student token requests.
CREATE OR REPLACE FUNCTION public.hungry_issue_faculty_event_token(
  p_event_id uuid, p_event_code text, p_customer_user_id uuid, p_canteen_id uuid
) RETURNS TABLE(token_number text, approved_capacity integer, issued_tokens integer, tokens_remaining integer, already_issued boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event public.faculty_events%ROWTYPE;
  v_token public.faculty_event_tokens%ROWTYPE;
  v_sequence integer;
  v_issued integer;
  v_reserved integer;
BEGIN
  SELECT * INTO v_event FROM public.faculty_events
    WHERE id = p_event_id AND event_code = p_event_code AND status = 'published' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EVENT:invalid_or_closed'; END IF;
  IF v_event.canteen_id <> p_canteen_id OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_customer_user_id AND p.current_canteen_id = v_event.canteen_id AND p.role IN ('student','faculty','guest')
  ) THEN RAISE EXCEPTION 'EVENT:not_participant'; END IF;
  SELECT * INTO v_token FROM public.faculty_event_tokens
    WHERE event_id = p_event_id AND customer_id = p_customer_user_id AND status <> 'cancelled'
    ORDER BY sequence_number LIMIT 1;
  SELECT count(*) FILTER (WHERE status <> 'cancelled')::integer INTO v_issued
    FROM public.faculty_event_tokens WHERE event_id = p_event_id;
  SELECT coalesce(sum(requested_count), 0)::integer INTO v_reserved
    FROM public.faculty_event_token_requests WHERE event_id = p_event_id AND status = 'pending';
  IF FOUND AND v_token.id IS NOT NULL THEN
    RETURN QUERY SELECT v_token.token_number, v_event.approved_capacity, v_issued,
      greatest(0, v_event.approved_capacity - v_issued - v_reserved), true;
    RETURN;
  END IF;
  IF v_issued + v_reserved >= v_event.approved_capacity THEN RAISE EXCEPTION 'EVENT:full'; END IF;
  v_sequence := v_event.next_token_sequence;
  IF v_sequence > 9999 THEN RAISE EXCEPTION 'EVENT:four_digit_capacity_limit'; END IF;
  INSERT INTO public.faculty_event_tokens(event_id, sequence_number, token_number, customer_id, canteen_id, order_id)
    VALUES (p_event_id, v_sequence, lpad(v_sequence::text, 4, '0'), p_customer_user_id, v_event.canteen_id, NULL)
    RETURNING * INTO v_token;
  UPDATE public.faculty_events SET next_token_sequence = v_sequence + 1, updated_at = now() WHERE id = p_event_id;
  v_issued := v_issued + 1;
  RETURN QUERY SELECT v_token.token_number, v_event.approved_capacity, v_issued,
    greatest(0, v_event.approved_capacity - v_issued - v_reserved), false;
END;
$$;

-- Capacity totals reserve seats for pending additional-token requests so
-- simultaneous requests and ordinary token issuance cannot over-allocate.
CREATE OR REPLACE FUNCTION public.hungry_get_event_capacity(p_event_id uuid)
RETURNS TABLE (approved_capacity integer, issued_tokens integer, tokens_remaining integer, collected_tokens integer, cancelled_tokens integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event public.faculty_events%ROWTYPE; v_reserved integer;
BEGIN
  SELECT * INTO v_event FROM public.faculty_events WHERE id = p_event_id AND status = 'published';
  IF NOT FOUND OR NOT (
    v_event.canteen_id = public.current_canteen()
    OR v_event.faculty_user_id = auth.uid()
    OR public.owns_canteen(v_event.canteen_id)
  ) THEN RAISE EXCEPTION 'EVENT:not_available'; END IF;
  SELECT coalesce(sum(requested_count), 0)::integer INTO v_reserved
    FROM public.faculty_event_token_requests WHERE event_id = p_event_id AND status = 'pending';
  RETURN QUERY SELECT v_event.approved_capacity,
    count(*) FILTER (WHERE t.status <> 'cancelled')::integer,
    greatest(0, v_event.approved_capacity - count(*) FILTER (WHERE t.status <> 'cancelled')::integer - v_reserved),
    count(*) FILTER (WHERE t.status = 'collected')::integer,
    count(*) FILTER (WHERE t.status = 'cancelled')::integer
  FROM public.faculty_event_tokens t WHERE t.event_id = p_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.hungry_request_faculty_event_tokens(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hungry_resolve_faculty_event_token_request(uuid, uuid, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hungry_get_event_capacity(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hungry_issue_faculty_event_token(uuid, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hungry_request_faculty_event_tokens(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.hungry_resolve_faculty_event_token_request(uuid, uuid, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hungry_get_event_capacity(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.hungry_issue_faculty_event_token(uuid, text, uuid, uuid) TO service_role;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'faculty_event_token_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.faculty_event_token_requests;
  END IF;
END $$;
