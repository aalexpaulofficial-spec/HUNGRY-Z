-- Hide published event details and participant tokens from joined canteen
-- members until the access code is verified through the authenticated server.
BEGIN;

DROP POLICY IF EXISTS "Faculty and participating canteen read events" ON public.faculty_events;
CREATE POLICY "Faculty and canteen owners read event details"
  ON public.faculty_events FOR SELECT TO authenticated
  USING (faculty_user_id = auth.uid() OR public.owns_canteen(canteen_id));

DROP POLICY IF EXISTS "Customers faculty and canteen read event tokens" ON public.faculty_event_tokens;
CREATE POLICY "Faculty and canteen owners read event tokens"
  ON public.faculty_event_tokens FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.faculty_events e
      WHERE e.id = event_id
        AND (e.faculty_user_id = auth.uid() OR public.owns_canteen(e.canteen_id))
    )
  );

-- Capacity is also event detail. Only event managers may call this directly;
-- participants receive it from the server only after code verification.
CREATE OR REPLACE FUNCTION public.hungry_get_event_capacity(p_event_id uuid)
RETURNS TABLE (
  approved_capacity integer,
  issued_tokens integer,
  tokens_remaining integer,
  collected_tokens integer,
  cancelled_tokens integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event public.faculty_events%ROWTYPE;
  v_reserved integer;
BEGIN
  SELECT * INTO v_event
  FROM public.faculty_events
  WHERE id = p_event_id AND status = 'published' AND archived_at IS NULL;

  IF NOT FOUND OR NOT (
    v_event.faculty_user_id = auth.uid()
    OR public.owns_canteen(v_event.canteen_id)
  ) THEN
    RAISE EXCEPTION 'EVENT:not_available';
  END IF;

  SELECT coalesce(sum(requested_count), 0)::integer INTO v_reserved
  FROM public.faculty_event_token_requests
  WHERE event_id = p_event_id AND status = 'pending';

  RETURN QUERY
  SELECT v_event.approved_capacity,
    count(*) FILTER (WHERE t.status <> 'cancelled')::integer,
    greatest(0, v_event.approved_capacity - count(*) FILTER (WHERE t.status <> 'cancelled')::integer - v_reserved),
    count(*) FILTER (WHERE t.status = 'collected')::integer,
    count(*) FILTER (WHERE t.status = 'cancelled')::integer
  FROM public.faculty_event_tokens t
  WHERE t.event_id = p_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.hungry_get_event_capacity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hungry_get_event_capacity(uuid) TO authenticated, service_role;

COMMIT;
