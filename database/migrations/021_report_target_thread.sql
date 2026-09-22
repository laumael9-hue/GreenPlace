-- ============================================================
-- Migration 021: Add 'thread' to report_target enum
-- Forum thread reports were rejected because the enum only
-- had ('listing', 'post', 'review', 'user', 'message').
-- ============================================================

INSERT INTO schema_version (version, description)
VALUES (21, 'Add thread to report_target enum')
ON CONFLICT (version) DO NOTHING;

ALTER TYPE report_target ADD VALUE IF NOT EXISTS 'thread';
