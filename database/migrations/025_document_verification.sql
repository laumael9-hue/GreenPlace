-- ============================================================
-- GreenPlace Migration 025 — Business document verification
-- Adds an admin verification workflow for uploaded business
-- documents (permit, business registration, ID, etc.).
--
-- Rules enforced:
--   * New uploads start as 'pending'
--   * Admin approves or rejects with notes
--   * Verified-by / verified-at record who decided and when
--   * Existing documents of approved businesses are backfilled
--     as 'approved' so the queue only holds real work
-- ============================================================

INSERT INTO schema_version (version, description)
VALUES (25, 'Business document verification - status, notes, verifier, queue index')
ON CONFLICT (version) DO NOTHING;

-- ============================================================
-- Status type + columns
-- ============================================================

DO $$ BEGIN
    CREATE TYPE document_verification_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE business_documents
    ADD COLUMN IF NOT EXISTS verification_status document_verification_status NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS verification_notes TEXT,
    ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

-- ============================================================
-- Backfill: documents already backing approved businesses are
-- considered verified; everything else needs review
-- ============================================================

UPDATE business_documents bd
SET verification_status = 'approved',
    verified_at = b.approved_at
FROM businesses b
WHERE bd.business_id = b.id
  AND b.status = 'approved'
  AND bd.verification_status = 'pending'
  AND bd.verified_at IS NULL;

-- ============================================================
-- Queue index: admin document review list
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_business_documents_status
    ON business_documents(verification_status, uploaded_at DESC);

-- ============================================================
-- RLS: admin can read and update verification metadata
-- (server bypasses RLS via supabaseAdmin; policy is the safety net)
-- ============================================================

DROP POLICY IF EXISTS "Admins can update business documents" ON business_documents;
CREATE POLICY "Admins can update business documents"
    ON business_documents FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM profiles
                WHERE profiles.id = auth.uid()
                AND profiles.role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles
                WHERE profiles.id = auth.uid()
                AND profiles.role = 'admin')
    );
