-- ============================================================
-- GreenPlace Migration 029 — Required business documents
--
-- A waste management establishment must submit exactly 3 documents
-- before an admin can approve it:
--   DTI_SEC          DTI / SEC Registration
--   BUSINESS_PERMIT  Mayor's / Business Permit
--   BIR_COR          BIR Certificate of Registration
--
-- Builds on the existing tables:
--   businesses          -> the business profile (adds verification_status)
--   business_documents  -> the documents table. Column mapping:
--       document_name   = document_type
--       document_file   = file_url (public-style URL; path is after /business-documents/)
--       approval_status = verification_status (pending | approved | rejected)
--       reviewed_by     = verified_by
--       submitted_at    = uploaded_at
--
-- Other document_type values ('registration', 'general') stay as
-- optional supplementary uploads and are not subject to the 3-slot rules.
-- ============================================================

INSERT INTO schema_version (version, description)
VALUES (29, 'Required business documents - verification_status, 3-slot uniqueness, private 5MB bucket, RLS guards')
ON CONFLICT (version) DO NOTHING;

-- ============================================================
-- 1. businesses.verification_status
-- ============================================================

DO $$ BEGIN
    CREATE TYPE business_verification_status AS ENUM ('Pending', 'Verified', 'Rejected');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS verification_status business_verification_status NOT NULL DEFAULT 'Pending',
    -- NULL = still collecting documents (draft); set when the owner submits for review
    ADD COLUMN IF NOT EXISTS submitted_for_review_at TIMESTAMP WITH TIME ZONE;

-- Backfill from the existing approval state (only touches untouched defaults)
UPDATE businesses
SET verification_status = 'Verified'
WHERE verification_status = 'Pending'
  AND (status = 'approved' OR approved_at IS NOT NULL);

UPDATE businesses
SET verification_status = 'Rejected'
WHERE verification_status = 'Pending'
  AND status = 'rejected';

CREATE INDEX IF NOT EXISTS idx_businesses_verification
    ON businesses(verification_status, submitted_for_review_at);

-- ============================================================
-- 2. One document per required type per business
--    (a re-upload replaces the old row). Partial so supplementary
--    document types keep allowing multiple rows.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_required_document
    ON business_documents(business_id, document_type)
    WHERE document_type IN ('DTI_SEC', 'BUSINESS_PERMIT', 'BIR_COR');

-- ============================================================
-- 3. Guard: who may change which columns of a document
--    API (service role) and SQL-editor sessions bypass; only end-user
--    JWT clients are constrained.
--      admin -> review columns only (status, notes, reviewer)
--      owner -> may replace the file; the review always restarts
-- ============================================================

CREATE OR REPLACE FUNCTION guard_business_document_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF COALESCE(auth.role(), '') <> 'authenticated' THEN
        RETURN NEW;
    END IF;

    IF NEW.business_id IS DISTINCT FROM OLD.business_id
       OR NEW.document_type IS DISTINCT FROM OLD.document_type THEN
        RAISE EXCEPTION 'A document cannot be moved to another business or type';
    END IF;

    IF EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
        IF NEW.file_url IS DISTINCT FROM OLD.file_url
           OR NEW.file_name IS DISTINCT FROM OLD.file_name
           OR NEW.file_size IS DISTINCT FROM OLD.file_size
           OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
           OR NEW.uploaded_at IS DISTINCT FROM OLD.uploaded_at THEN
            RAISE EXCEPTION 'Admins can only change the review status of a document';
        END IF;
        NEW.verified_by := auth.uid();
        NEW.verified_at := NOW();
    ELSE
        NEW.verification_status := 'pending';
        NEW.verification_notes := NULL;
        NEW.verified_by := NULL;
        NEW.verified_at := NULL;
        NEW.uploaded_at := NOW();
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_business_document_update ON business_documents;
CREATE TRIGGER trg_guard_business_document_update
    BEFORE UPDATE ON business_documents
    FOR EACH ROW
    EXECUTE FUNCTION guard_business_document_update();

-- ============================================================
-- 4. Guard: owners cannot grant themselves approval
--    RLS lets an owner insert/update their own business row, so approval
--    columns are locked for non-admin JWT clients.
-- ============================================================

CREATE OR REPLACE FUNCTION guard_business_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_admin BOOLEAN;
BEGIN
    IF COALESCE(auth.role(), '') <> 'authenticated' THEN
        RETURN NEW;
    END IF;

    SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') INTO v_is_admin;
    IF v_is_admin THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.status := 'pending';
        NEW.verification_status := 'Pending';
        NEW.submitted_for_review_at := NULL;
        NEW.is_verified := FALSE;
        NEW.approved_at := NULL;
        NEW.approved_by := NULL;
    ELSE
        IF NEW.status IS DISTINCT FROM OLD.status
           OR NEW.verification_status IS DISTINCT FROM OLD.verification_status
           OR NEW.submitted_for_review_at IS DISTINCT FROM OLD.submitted_for_review_at
           OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
           OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
           OR NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
            RAISE EXCEPTION 'Business verification can only be changed by an admin';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_business_verification ON businesses;
CREATE TRIGGER trg_guard_business_verification
    BEFORE INSERT OR UPDATE ON businesses
    FOR EACH ROW
    EXECUTE FUNCTION guard_business_verification();

-- ============================================================
-- 5. business_documents RLS
--    Owner: insert, select, replace (update) own rows. Admin: select + update.
--    Residents (non-owners) match no policy, so they have no access.
--    Existing policies kept: owner select / insert (002), admin select (002),
--    admin update (025). Owner delete is dropped (replace, don't delete);
--    the API uses the service role for supplementary-document deletes.
-- ============================================================

DROP POLICY IF EXISTS "Business owners can delete own documents" ON business_documents;

DROP POLICY IF EXISTS "Business owners can replace own documents" ON business_documents;
CREATE POLICY "Business owners can replace own documents"
    ON business_documents FOR UPDATE
    USING (
        verification_status <> 'approved'
        AND EXISTS (
            SELECT 1 FROM businesses
            WHERE businesses.id = business_documents.business_id
            AND businesses.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM businesses
            WHERE businesses.id = business_documents.business_id
            AND businesses.owner_id = auth.uid()
        )
    );

-- ============================================================
-- 6. Storage: private bucket, PDF/JPG/PNG, 5 MB
--    Existing objects (including older webp / >5 MB uploads) stay readable;
--    the limits apply to new uploads.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-documents',
  'business-documents',
  false,
  5242880,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'];

-- Read: owner or admin (027). Insert/delete: owner (006). Replace: owner.
DROP POLICY IF EXISTS "Business documents owner update" ON storage.objects;
CREATE POLICY "Business documents owner update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'business-documents'
    AND EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id::text = (storage.foldername(name))[2]
      AND businesses.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'business-documents'
    AND EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id::text = (storage.foldername(name))[2]
      AND businesses.owner_id = auth.uid()
    )
  );
