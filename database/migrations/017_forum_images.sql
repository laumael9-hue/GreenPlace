-- ============================================================
-- GreenPlace Migration 017 — Forum Images
-- Photos on forum threads and replies (up to 4 each)
-- ============================================================

INSERT INTO schema_version (version, description)
VALUES (17, 'Forum images - photo uploads on threads and posts')
ON CONFLICT (version) DO NOTHING;

-- ============================================================
-- 1. STORAGE BUCKET
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'forum-images',
    'forum-images',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. IMAGES COLUMNS (JSONB array of public URLs)
-- ============================================================

ALTER TABLE forum_threads ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]';
ALTER TABLE forum_posts   ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]';

-- ============================================================
-- 3. STORAGE RLS POLICIES
-- ============================================================

CREATE POLICY "Forum images public read" ON storage.objects
    FOR SELECT USING (bucket_id = 'forum-images');

CREATE POLICY "Forum images authenticated upload" ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'forum-images'
        AND (storage.foldername(name))[1] = 'forum'
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Forum images authenticated delete" ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'forum-images'
        AND (storage.foldername(name))[1] = 'forum'
        AND auth.role() = 'authenticated'
    );
