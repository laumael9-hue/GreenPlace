-- ============================================================
-- Phase 5b: Soft Delete & Account Suspension Support
-- Adds deleted_at, suspension tracking, and audit columns
-- ============================================================

INSERT INTO schema_version (version, description)
VALUES (5, 'Phase 5b - Soft delete, suspension, audit support')
ON CONFLICT (version) DO NOTHING;

-- Add soft delete and suspension columns to profiles
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS pending_deletion_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by UUID DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS suspension_reason TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS suspended_by UUID DEFAULT NULL;

-- Add soft delete column to businesses
ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Indexes for soft delete
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON profiles(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_businesses_deleted_at ON businesses(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================
-- Admin Audit Log enhancements (already exists, just adding index)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON admin_audit_log(target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON admin_audit_log(created_at DESC);
