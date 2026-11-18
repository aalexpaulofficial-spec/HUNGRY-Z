-- Restore the public-read, owner-write policies for customer home banner images.
-- Banner uploads are also issued as short-lived server-authorized upload tokens.
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
