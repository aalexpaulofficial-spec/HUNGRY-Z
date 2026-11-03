-- Publicly readable food images, with upload/delete restricted to the owner of the canteen.
-- Run after database/004_canteen_owner_credential_guard.sql.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'canteen-menu-images',
  'canteen-menu-images',
  true,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read canteen menu images" ON storage.objects;
CREATE POLICY "Public read canteen menu images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'canteen-menu-images');

DROP POLICY IF EXISTS "Canteen owners upload menu images" ON storage.objects;
CREATE POLICY "Canteen owners upload menu images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'canteen-menu-images'
  AND EXISTS (
    SELECT 1
    FROM public.canteens c
    WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
      AND public.owns_canteen(c.id)
  )
);

DROP POLICY IF EXISTS "Canteen owners delete menu images" ON storage.objects;
CREATE POLICY "Canteen owners delete menu images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'canteen-menu-images'
  AND EXISTS (
    SELECT 1
    FROM public.canteens c
    WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
      AND public.owns_canteen(c.id)
  )
);
