-- ============================================================
-- GreenPlace Storage Buckets & Policies
-- ============================================================

-- Bump schema version
INSERT INTO schema_version (version, description)
VALUES (6, 'Storage buckets - profile-images, business-documents, product-images')
ON CONFLICT (version) DO NOTHING;

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

-- Profile images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-images',
  'profile-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Business documents bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-documents',
  'business-documents',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Product images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STORAGE RLS POLICIES
-- ============================================================

-- Profile images: anyone can read, owner can upload
CREATE POLICY "Profile images public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-images');

CREATE POLICY "Profile images owner upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'profile-images'
    AND (storage.foldername(name))[1] = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );

CREATE POLICY "Profile images owner update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'profile-images'
    AND (storage.foldername(name))[1] = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );

CREATE POLICY "Profile images owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'profile-images'
    AND (storage.foldername(name))[1] = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );

-- Business documents: owner can manage, admin can read all
CREATE POLICY "Business documents public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'business-documents');

CREATE POLICY "Business documents owner upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'business-documents'
    AND EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id::text = (storage.foldername(name))[2]
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Business documents owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'business-documents'
    AND EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id::text = (storage.foldername(name))[2]
      AND businesses.owner_id = auth.uid()
    )
  );

-- Business logos and covers
CREATE POLICY "Business images public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-images' AND (storage.foldername(name))[1] IN ('logos', 'covers'));

CREATE POLICY "Business images owner upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'profile-images'
    AND (storage.foldername(name))[1] IN ('logos', 'covers')
    AND EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id::text = (storage.foldername(name))[2]
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Business images owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'profile-images'
    AND (storage.foldername(name))[1] IN ('logos', 'covers')
    AND EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id::text = (storage.foldername(name))[2]
      AND businesses.owner_id = auth.uid()
    )
  );

-- Product images: seller can manage
CREATE POLICY "Product images public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "Product images seller upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = 'listings'
    AND EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id::text = (storage.foldername(name))[2]
      AND listings.seller_id = auth.uid()
    )
  );

CREATE POLICY "Product images seller delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = 'listings'
    AND EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id::text = (storage.foldername(name))[2]
      AND listings.seller_id = auth.uid()
    )
  );
