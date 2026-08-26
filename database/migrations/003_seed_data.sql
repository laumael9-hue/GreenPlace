-- ============================================================
-- GreenPlace Seed Data - Phase 2
-- Reference data, demo users, sample businesses, and listings
-- ============================================================

INSERT INTO schema_version (version, description)
VALUES (3, 'Seed data - categories, system settings, demo data')
ON CONFLICT (version) DO NOTHING;

-- ============================================================
-- SYSTEM SETTINGS
-- ============================================================

INSERT INTO system_settings (key, value, description) VALUES
    ('site_name', 'GreenPlace', 'Application name'),
    ('site_tagline', 'Sustainable Living for Metro Cebu', 'Application tagline'),
    ('max_upload_size_mb', '50', 'Maximum file upload size in MB'),
    ('business_auto_approve', 'false', 'Auto-approve new business registrations'),
    ('maintenance_mode', 'false', 'Enable maintenance mode'),
    ('default_currency', 'PHP', 'Default currency code'),
    ('min_drop_off_weight_kg', '1', 'Minimum weight for scheduled drop-offs'),
    ('forum_max_posts_per_day', '50', 'Max forum posts per user per day'),
    ('listing_max_images', '10', 'Max images per listing'),
    ('review_min_length', '10', 'Minimum review body length'),
    ('notification_retention_days', '90', 'Days to keep notifications'),
    ('paymongo_test_mode', 'true', 'Use PayMongo test environment')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- MARKETPLACE CATEGORIES
-- ============================================================

INSERT INTO categories (id, name, slug, description, icon, sort_order) VALUES
    ('a1000000-0000-0000-0000-000000000001', 'Recyclable Materials', 'recyclable-materials', 'Paper, plastic, glass, metal recyclables', 'recycle', 1),
    ('a1000000-0000-0000-0000-000000000002', 'Eco-Friendly Products', 'eco-friendly-products', 'Sustainable and environmentally friendly products', 'leaf', 2),
    ('a1000000-0000-0000-0000-000000000003', 'Composting Supplies', 'composting-supplies', 'Tools and materials for composting', 'seedling', 3),
    ('a1000000-0000-0000-0000-000000000004', 'Upcycled Goods', 'upcycled-goods', 'Products made from repurposed materials', 'refresh-cw', 4),
    ('a1000000-0000-0000-0000-000000000005', 'Reusable Items', 'reusable-items', 'Bags, bottles, containers and other reusables', 'package', 5),
    ('a1000000-0000-0000-0000-000000000006', 'Garden & Outdoor', 'garden-outdoor', 'Plants, seeds, and garden supplies', 'flower', 6),
    ('a1000000-0000-0000-0000-000000000007', 'Household', 'household', 'Eco-friendly household items', 'home', 7),
    ('a1000000-0000-0000-0000-000000000008', 'Electronics & Repair', 'electronics-repair', 'Refurbished electronics and repair services', 'smartphone', 8)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- FORUM CATEGORIES
-- ============================================================

INSERT INTO forum_categories (id, name, slug, description, color, icon, sort_order) VALUES
    ('b1000000-0000-0000-0000-000000000001', 'General Discussion', 'general-discussion', 'General sustainability topics', '#10B981', 'message-circle', 1),
    ('b1000000-0000-0000-0000-000000000002', 'Waste Segregation Tips', 'waste-segregation-tips', 'Tips on proper waste segregation', '#3B82F6', 'trash-2', 2),
    ('b1000000-0000-0000-0000-000000000003', 'Recycling Guide', 'recycling-guide', 'Recycling how-tos and best practices', '#F59E0B', 'recycle', 3),
    ('b1000000-0000-0000-0000-000000000004', 'Composting', 'composting', 'Composting methods and troubleshooting', '#8B5CF6', 'seedling', 4),
    ('b1000000-0000-0000-0000-000000000005', 'Local News & Events', 'local-news-events', 'Sustainability events in Metro Cebu', '#EF4444', 'calendar', 5),
    ('b1000000-0000-0000-0000-000000000006', 'Business Spotlight', 'business-spotlight', 'Featured waste management businesses', '#06B6D4', 'building', 6),
    ('b1000000-0000-0000-0000-000000000007', 'Marketplace Help', 'marketplace-help', 'Questions about buying/selling on GreenPlace', '#EC4899', 'help-circle', 7),
    ('b1000000-0000-0000-0000-000000000008', 'Off-Topic', 'off-topic', 'Non-sustainability chat', '#6B7280', 'coffee', 8)
ON CONFLICT (id) DO NOTHING;
