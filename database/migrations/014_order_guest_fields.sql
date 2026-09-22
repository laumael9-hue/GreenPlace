-- Make buyer_id nullable for walk-in guests
ALTER TABLE orders ALTER COLUMN buyer_id DROP NOT NULL;

-- Add guest fields
ALTER TABLE orders ADD COLUMN guest_name VARCHAR(100);
ALTER TABLE orders ADD COLUMN guest_phone VARCHAR(20);

-- Update schema version
INSERT INTO schema_version (version, description)
VALUES (14, 'Add guest fields to orders for walk-in support');
