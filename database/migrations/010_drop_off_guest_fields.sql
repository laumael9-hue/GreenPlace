-- ============================================================
-- 010: Add guest fields to drop_offs for walk-in residents
-- ============================================================

-- Make user_id nullable for walk-in guests
ALTER TABLE drop_offs ALTER COLUMN user_id DROP NOT NULL;

-- Add guest fields
ALTER TABLE drop_offs ADD COLUMN guest_name VARCHAR(100);
ALTER TABLE drop_offs ADD COLUMN guest_phone VARCHAR(20);

-- Update schema version
INSERT INTO schema_version (version, description)
VALUES (10, 'Add guest fields to drop_offs');
