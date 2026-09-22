-- ============================================================
-- GreenPlace Migration 018 — Forum Announcements
-- Admin can mark threads as announcements; shown atop the feed
-- ============================================================

INSERT INTO schema_version (version, description)
VALUES (18, 'Forum announcements - is_announcement flag on threads')
ON CONFLICT (version) DO NOTHING;

-- ============================================================
-- 1. ANNOUNCEMENT FLAG
-- ============================================================

ALTER TABLE forum_threads ADD COLUMN IF NOT EXISTS is_announcement BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
-- 2. PARTIAL INDEX (same pattern as pinned)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_forum_threads_announcement
    ON forum_threads (created_at DESC)
    WHERE is_announcement = TRUE;
