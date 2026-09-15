-- ============================================================
-- 009: Add preferred pickup date and time to orders
-- ============================================================

ALTER TABLE orders ADD COLUMN preferred_pickup_date DATE;
ALTER TABLE orders ADD COLUMN preferred_pickup_time VARCHAR(20);
