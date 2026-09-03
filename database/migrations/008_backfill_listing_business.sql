-- ============================================================
-- GreenPlace Phase 8 Fix - Backfill listing business_id
-- Links existing listings to their seller's approved business
-- ============================================================

INSERT INTO schema_version (version, description)
VALUES (8, 'Phase 8 fix - backfill listing business_id')
ON CONFLICT (version) DO NOTHING;

UPDATE listings l
SET business_id = b.id
FROM businesses b
WHERE l.seller_id = b.owner_id
  AND l.business_id IS NULL
  AND b.status = 'approved'
  AND b.deleted_at IS NULL;
