-- Optional private event logos. Access follows the existing faculty event
-- visibility rules: requesting faculty, the linked canteen owner, or members
-- of the canteen while the event is published.
ALTER TABLE public.faculty_events
  ADD COLUMN IF NOT EXISTS event_logo_path text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.faculty_events'::regclass
      AND conname = 'faculty_events_event_logo_path_format'
  ) THEN
    ALTER TABLE public.faculty_events
      ADD CONSTRAINT faculty_events_event_logo_path_format
      CHECK (event_logo_path IS NULL OR event_logo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|avif)$');
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('faculty-event-logos', 'faculty-event-logos', false, 8388608,
  ARRAY['image/jpeg','image/png','image/webp','image/avif']::text[])
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Faculty event participants read event logos" ON storage.objects;
CREATE POLICY "Faculty event participants read event logos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'faculty-event-logos'
    AND EXISTS (
      SELECT 1 FROM public.faculty_events e
      WHERE e.event_logo_path = storage.objects.name
        AND (
          e.faculty_user_id = auth.uid()
          OR public.owns_canteen(e.canteen_id)
          OR (e.status = 'published' AND e.canteen_id = public.current_canteen())
        )
    )
  );

DROP POLICY IF EXISTS "Faculty upload logos for own events" ON storage.objects;
CREATE POLICY "Faculty upload logos for own events"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'faculty-event-logos'
    AND (storage.foldername(storage.objects.name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.faculty_events e
      WHERE e.id::text = (storage.foldername(storage.objects.name))[2]
        AND e.faculty_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Faculty delete logos for own events" ON storage.objects;
CREATE POLICY "Faculty delete logos for own events"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'faculty-event-logos'
    AND (storage.foldername(storage.objects.name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.faculty_events e
      WHERE e.id::text = (storage.foldername(storage.objects.name))[2]
        AND e.faculty_user_id = auth.uid()
    )
  );
