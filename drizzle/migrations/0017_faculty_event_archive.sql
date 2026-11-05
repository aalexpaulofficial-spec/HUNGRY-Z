-- Archive faculty events without removing event tokens, linked orders, or audit history.
-- Student token issuance remains closed by changing the archived event status to 'closed'.
ALTER TABLE public.faculty_events
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS faculty_events_active_canteen_status
  ON public.faculty_events (canteen_id, status, created_at DESC)
  WHERE archived_at IS NULL;
