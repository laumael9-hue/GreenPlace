-- ============================================================
-- GreenPlace Migration 024 — Product (listing) reviews
-- Extends reviews to marketplace listings while keeping product
-- ratings separate from establishment ratings.
--
-- Rules enforced:
--   * One review per (reviewer, listing)
--   * One establishment review per (reviewer, business)
--   * One establishment review per (reviewer, order)
--   * Product reviews keep business_id NULL so establishment
--     aggregation and review lists stay untouched
-- ============================================================

INSERT INTO schema_version (version, description)
VALUES (24, 'Product reviews - listing_id, duplicate prevention, listing rating aggregation')
ON CONFLICT (version) DO NOTHING;

-- Product reviews are listing-scoped; establishment reviews keep business_id
ALTER TABLE reviews ALTER COLUMN business_id DROP NOT NULL;

ALTER TABLE reviews
    ADD COLUMN IF NOT EXISTS listing_id UUID REFERENCES listings(id) ON DELETE CASCADE;

-- ============================================================
-- Duplicate prevention
-- ============================================================

-- One establishment review per order (must not block a product
-- review of the same order, hence listing_id IS NULL)
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS uq_review_per_order;
CREATE UNIQUE INDEX IF NOT EXISTS uq_review_business_per_order
    ON reviews(reviewer_id, order_id)
    WHERE order_id IS NOT NULL AND listing_id IS NULL;

-- Establishment rule now only covers establishment reviews
-- (recreates the migration 023 index with a partial predicate)
DROP INDEX IF EXISTS uq_review_per_reviewer_business;
CREATE UNIQUE INDEX IF NOT EXISTS uq_review_per_reviewer_business
    ON reviews(reviewer_id, business_id)
    WHERE listing_id IS NULL AND business_id IS NOT NULL;

-- One review per user per product
CREATE UNIQUE INDEX IF NOT EXISTS uq_review_per_reviewer_listing
    ON reviews(reviewer_id, listing_id)
    WHERE listing_id IS NOT NULL;

-- Hot-path index: paginated public product review feed
CREATE INDEX IF NOT EXISTS idx_reviews_listing
    ON reviews(listing_id, is_visible, created_at DESC);

-- ============================================================
-- Listing rating aggregation columns
-- ============================================================

ALTER TABLE listings ADD COLUMN IF NOT EXISTS rating_avg DECIMAL(3, 2) DEFAULT 0.00;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;

-- ============================================================
-- Aggregation trigger (mirrors update_business_rating)
-- ============================================================

CREATE OR REPLACE FUNCTION update_listing_rating()
RETURNS TRIGGER AS $$
DECLARE
    target_listing UUID;
BEGIN
    target_listing := COALESCE(NEW.listing_id, OLD.listing_id);

    IF target_listing IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    UPDATE listings
    SET rating_avg = COALESCE(
        (SELECT ROUND(AVG(rating)::numeric, 2)
         FROM reviews
         WHERE listing_id = target_listing
         AND is_visible = TRUE),
        0.00
    ),
    rating_count = (
        SELECT COUNT(*) FROM reviews
        WHERE listing_id = target_listing
        AND is_visible = TRUE
    )
    WHERE id = target_listing;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reviews_listing_rating_update ON reviews;
CREATE TRIGGER trg_reviews_listing_rating_update
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_listing_rating();

-- ============================================================
-- Backfill listing aggregates from existing reviews
-- ============================================================

UPDATE listings l
SET rating_avg = agg.avg_rating,
    rating_count = agg.review_count
FROM (
    SELECT listing_id,
           ROUND(AVG(rating)::numeric, 2) AS avg_rating,
           COUNT(*)::integer AS review_count
    FROM reviews
    WHERE is_visible = TRUE
      AND listing_id IS NOT NULL
    GROUP BY listing_id
) agg
WHERE l.id = agg.listing_id
  AND (l.rating_avg IS DISTINCT FROM agg.avg_rating
       OR l.rating_count IS DISTINCT FROM agg.review_count);

UPDATE listings l
SET rating_avg = 0.00,
    rating_count = 0
WHERE l.rating_count <> 0
  AND NOT EXISTS (
    SELECT 1 FROM reviews r
    WHERE r.listing_id = l.id AND r.is_visible = TRUE
  );

-- ============================================================
-- RLS: allow the listing seller to reply to product reviews
-- (server enforces this via supabaseAdmin; policy is the safety net)
-- ============================================================

DROP POLICY IF EXISTS "Listing sellers can update reviews on their listings" ON reviews;
CREATE POLICY "Listing sellers can update reviews on their listings"
    ON reviews FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM listings
                WHERE listings.id = reviews.listing_id
                AND listings.seller_id = auth.uid())
    );
