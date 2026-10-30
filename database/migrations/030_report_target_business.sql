-- ============================================================
-- Migration 030: Add 'business' to report_target enum
-- Lets residents report a business establishment from its
-- public profile page. Reuses the existing reports table.
-- ============================================================

INSERT INTO schema_version (version, description)
VALUES (30, 'Add business to report_target enum')
ON CONFLICT (version) DO NOTHING;

ALTER TYPE report_target ADD VALUE IF NOT EXISTS 'business';
