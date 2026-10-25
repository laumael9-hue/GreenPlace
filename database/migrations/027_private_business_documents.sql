-- ============================================================
-- 027: Make business-documents bucket private
-- Verification documents must not be readable by URL alone.
-- The API serves short-lived signed URLs (service role) to owners/admins.
-- ============================================================

UPDATE storage.buckets SET public = false WHERE id = 'business-documents';

DROP POLICY IF EXISTS "Business documents public read" ON storage.objects;

CREATE POLICY "Business documents owner or admin read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'business-documents'
    AND (
      EXISTS (
        SELECT 1 FROM businesses
        WHERE businesses.id::text = (storage.foldername(name))[2]
        AND businesses.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
      )
    )
  );
