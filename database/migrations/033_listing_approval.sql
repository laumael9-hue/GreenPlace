-- ============================================================
-- Migration 033: Listing approval
-- Publishing a listing now sends it to 'pending'; an admin approves it ('active')
-- or rejects it ('rejected', with a note the seller can read and fix).
-- Listings that are already live are not affected.
-- ============================================================

INSERT INTO schema_version (version, description)
VALUES (33, 'Listing approval: pending/rejected statuses and moderation note')
ON CONFLICT (version) DO NOTHING;

ALTER TYPE listing_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE listing_status ADD VALUE IF NOT EXISTS 'rejected';

ALTER TABLE listings
    ADD COLUMN IF NOT EXISTS moderation_note TEXT;
