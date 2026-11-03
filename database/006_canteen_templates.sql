-- Per-canteen student home banners and owner-scoped image storage.
CREATE TABLE public.canteen_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canteen_id uuid NOT NULL UNIQUE REFERENCES public.canteens(id) ON DELETE CASCADE,
  banner_image_url text,
  heading text NOT NULL DEFAULT '' CHECK (char_length(heading) <= 120),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.canteen_templates TO authenticated;
GRANT ALL ON public.canteen_templates TO service_role;
ALTER TABLE public.canteen_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Canteen members read their template"
ON public.canteen_templates FOR SELECT TO authenticated
USING (canteen_id = public.current_canteen() OR public.owns_canteen(canteen_id));

CREATE POLICY "Canteen owners create their template"
ON public.canteen_templates FOR INSERT TO authenticated
WITH CHECK (public.owns_canteen(canteen_id));

CREATE POLICY "Canteen owners update their template"
ON public.canteen_templates FOR UPDATE TO authenticated
USING (public.owns_canteen(canteen_id))
WITH CHECK (public.owns_canteen(canteen_id));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'canteen-home-banners',
  'canteen-home-banners',
  true,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read canteen home banners" ON storage.objects;
CREATE POLICY "Public read canteen home banners"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'canteen-home-banners');

DROP POLICY IF EXISTS "Canteen owners upload home banners" ON storage.objects;
CREATE POLICY "Canteen owners upload home banners"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'canteen-home-banners'
  AND EXISTS (
    SELECT 1
    FROM public.canteens c
    WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
      AND public.owns_canteen(c.id)
  )
);

DROP POLICY IF EXISTS "Canteen owners delete home banners" ON storage.objects;
CREATE POLICY "Canteen owners delete home banners"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'canteen-home-banners'
  AND EXISTS (
    SELECT 1
    FROM public.canteens c
    WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
      AND public.owns_canteen(c.id)
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'canteen_templates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.canteen_templates;
  END IF;
END;
$$;
