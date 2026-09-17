-- 013_refund_images.sql
-- Add refund images support

-- Add images column to refunds table
ALTER TABLE refunds
  ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- Refund images storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'refund-images',
  'refund-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "Refund images public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'refund-images');

-- Authenticated users can upload
CREATE POLICY "Refund images authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'refund-images'
    AND (storage.foldername(name))[1] = 'refunds'
    AND auth.role() = 'authenticated'
  );

-- Add schema version
INSERT INTO schema_version (version, description)
VALUES (13, 'Add refund images support')
ON CONFLICT (version) DO NOTHING;
