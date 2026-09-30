-- ============================================================
-- GreenPlace Migration 023 — Reviews
-- Duplicate prevention at the database level and rating
-- aggregation backfill for businesses.
--
-- Rules enforced:
--   * One review per (reviewer, business) — Google-style
--   * One review per (reviewer, order)
--   * One review per (reviewer, drop-off)
-- ============================================================

INSERT INTO schema_version (version, description)
VALUES (23, 'Reviews - duplicate prevention indexes and rating aggregation backfill')
ON CONFLICT (version) DO NOTHING;

-- A reviewer may only review a given business once. This is the
-- primary duplicate-prevention guard (the per-order / per-drop-off
-- UNIQUE constraints already exist from migration 002).
CREATE UNIQUE INDEX IF NOT EXISTS uq_review_per_reviewer_business
    ON reviews(reviewer_id, business_id);

-- Standalone reviews (no order, no drop-off) are also covered by the
-- index above; this partial index documents the intent and supports
-- fast lookups of "does this user have a standalone review?".
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_business_standalone
    ON reviews(reviewer_id, business_id)
    WHERE order_id IS NULL AND drop_off_id IS NULL;

-- Hot-path index: paginated public review feed per business.
CREATE INDEX IF NOT EXISTS idx_reviews_business_visible
    ON reviews(business_id, is_visible, created_at DESC);

-- ============================================================
-- Rating aggregation backfill
-- The trg_reviews_rating_update trigger keeps businesses.rating_avg
-- and businesses.rating_count in sync going forward; this backfill
-- repairs any drift from data created before it existed.
-- ============================================================

UPDATE businesses b
SET rating_avg = agg.avg_rating,
    rating_count = agg.review_count
FROM (
    SELECT business_id,
           ROUND(AVG(rating)::numeric, 2) AS avg_rating,
           COUNT(*)::integer AS review_count
    FROM reviews
    WHERE is_visible = TRUE
    GROUP BY business_id
) agg
WHERE b.id = agg.business_id
  AND (b.rating_avg IS DISTINCT FROM agg.avg_rating
       OR b.rating_count IS DISTINCT FROM agg.review_count);

UPDATE businesses b
SET rating_avg = 0.00,
    rating_count = 0
WHERE b.rating_count <> 0
  AND NOT EXISTS (
    SELECT 1 FROM reviews r
    WHERE r.business_id = b.id AND r.is_visible = TRUE
  );
