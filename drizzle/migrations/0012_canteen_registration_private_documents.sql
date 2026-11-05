-- Store registration PDFs privately. Reuses the existing canteen_applications table.
ALTER TABLE public.canteen_applications
  ADD COLUMN IF NOT EXISTS fssai_license_document_path text,
  ADD COLUMN IF NOT EXISTS owner_id_document_path text;

-- This is a dedicated bucket because existing menu/banner buckets are public.
-- Upsert makes this safe to run if the bucket was already created manually.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'canteen-registration-documents',
  'canteen-registration-documents',
  false,
  10485760,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Admins can read/create short-lived signed links. Uploads are issued by the
-- server using the service role; no public or authenticated user upload policy
-- is granted on storage.objects.
DROP POLICY IF EXISTS "Admins read canteen registration documents" ON storage.objects;
CREATE POLICY "Admins read canteen registration documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'canteen-registration-documents'
    AND public.has_role(auth.uid(), 'admin')
  );

-- A restrictive policy prevents any pre-existing broad/public SELECT policy
-- from exposing this bucket. It has no effect on rows in other buckets.
DROP POLICY IF EXISTS "Restrict canteen registration document reads" ON storage.objects;
CREATE POLICY "Restrict canteen registration document reads"
  ON storage.objects
  AS RESTRICTIVE
  FOR SELECT
  TO public
  USING (
    bucket_id <> 'canteen-registration-documents'
    OR public.has_role(auth.uid(), 'admin')
  );
