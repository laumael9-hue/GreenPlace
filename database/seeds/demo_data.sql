-- ============================================================
-- GreenPlace demo data (optional; run AFTER all migrations)
-- Sample approved businesses, active listings, and forum threads.
-- Owner/seller/author is an existing profile (first 'business' user,
-- else first 'admin', else first profile). No auth.users changes.
-- Safe to re-run: every insert is keyed on a unique slug.
-- ============================================================

DO $$
DECLARE
    v_owner UUID;
BEGIN
    SELECT id INTO v_owner FROM profiles WHERE role = 'business' ORDER BY created_at LIMIT 1;
    IF v_owner IS NULL THEN
        SELECT id INTO v_owner FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
    END IF;
    IF v_owner IS NULL THEN
        SELECT id INTO v_owner FROM profiles ORDER BY created_at LIMIT 1;
    END IF;
    IF v_owner IS NULL THEN
        RAISE EXCEPTION 'No profiles found. Register at least one user first.';
    END IF;

    -- --------------------------------------------------------
    -- BUSINESSES
    -- --------------------------------------------------------
    INSERT INTO businesses
        (owner_id, name, slug, description, category, address, city, province,
         latitude, longitude, phone, status, is_verified, accepts_drop_offs,
         has_marketplace, approved_at, approved_by)
    VALUES
        (v_owner, 'Cebu Green Recycling Center', 'cebu-green-recycling-center',
         'Accepts paper, plastic, glass and metal recyclables. Walk-in drop-offs welcome.',
         'Recycling Center', 'Osmena Blvd, Cebu City', 'Cebu City', 'Cebu',
         10.31570000, 123.88540000, '0917 000 0001', 'approved', TRUE, TRUE, TRUE, NOW(), v_owner),
        (v_owner, 'Mandaue Junk Shop & Scrap', 'mandaue-junk-shop-scrap',
         'Buys scrap metal, used cartons and PET bottles at fair per-kilo prices.',
         'Junk Shop', 'A.C. Cortes Ave, Mandaue City', 'Mandaue City', 'Cebu',
         10.32360000, 123.92230000, '0917 000 0002', 'approved', TRUE, TRUE, TRUE, NOW(), v_owner),
        (v_owner, 'Talisay Compost Hub', 'talisay-compost-hub',
         'Community composting facility. Drop off kitchen and garden waste; buy finished compost.',
         'Composting Facility', 'Poblacion, Talisay City', 'Talisay City', 'Cebu',
         10.24470000, 123.84940000, '0917 000 0003', 'approved', TRUE, TRUE, TRUE, NOW(), v_owner),
        (v_owner, 'Lapu-Lapu Upcycle Workshop', 'lapu-lapu-upcycle-workshop',
         'Turns discarded materials into furniture, bags and home decor.',
         'Upcycling Workshop', 'Pajo, Lapu-Lapu City', 'Lapu-Lapu City', 'Cebu',
         10.31030000, 123.94940000, '0917 000 0004', 'approved', TRUE, FALSE, TRUE, NOW(), v_owner)
    ON CONFLICT (slug) DO NOTHING;

    -- --------------------------------------------------------
    -- LISTINGS (status 'active' = visible in the marketplace)
    -- --------------------------------------------------------
    INSERT INTO listings
        (seller_id, business_id, category_id, title, slug, description, price, unit,
         quantity_available, condition, material_type, status, is_featured, city, published_at)
    VALUES
        (v_owner, (SELECT id FROM businesses WHERE slug = 'cebu-green-recycling-center'),
         'a1000000-0000-0000-0000-000000000001', 'Sorted Cardboard Bales (10 kg)', 'sorted-cardboard-bales-10kg',
         'Clean, flattened cardboard sorted and baled, ready for recycling.', 120.00, 'bale', 25, 'used', 'Paper', 'active', TRUE, 'Cebu City', NOW()),
        (v_owner, (SELECT id FROM businesses WHERE slug = 'mandaue-junk-shop-scrap'),
         'a1000000-0000-0000-0000-000000000001', 'Crushed PET Bottles (5 kg)', 'crushed-pet-bottles-5kg',
         'Washed and crushed PET bottles for recyclers.', 85.00, 'bag', 40, 'used', 'Plastic', 'active', FALSE, 'Mandaue City', NOW()),
        (v_owner, (SELECT id FROM businesses WHERE slug = 'cebu-green-recycling-center'),
         'a1000000-0000-0000-0000-000000000002', 'Bamboo Utensil Set', 'bamboo-utensil-set',
         'Reusable bamboo fork, spoon, knife and straw in a cloth pouch.', 180.00, 'set', 60, 'new', NULL, 'active', TRUE, 'Cebu City', NOW()),
        (v_owner, (SELECT id FROM businesses WHERE slug = 'cebu-green-recycling-center'),
         'a1000000-0000-0000-0000-000000000002', 'Beeswax Food Wraps (3-pack)', 'beeswax-food-wraps-3pack',
         'Washable alternative to plastic wrap.', 250.00, 'pack', 35, 'new', NULL, 'active', FALSE, 'Cebu City', NOW()),
        (v_owner, (SELECT id FROM businesses WHERE slug = 'talisay-compost-hub'),
         'a1000000-0000-0000-0000-000000000003', 'Finished Compost (5 kg sack)', 'finished-compost-5kg',
         'Nutrient-rich compost made from local kitchen and garden waste.', 150.00, 'sack', 50, 'new', 'Organic', 'active', TRUE, 'Talisay City', NOW()),
        (v_owner, (SELECT id FROM businesses WHERE slug = 'talisay-compost-hub'),
         'a1000000-0000-0000-0000-000000000003', 'Kitchen Compost Bin (10 L)', 'kitchen-compost-bin-10l',
         'Countertop bin with charcoal filter lid.', 420.00, 'piece', 20, 'new', NULL, 'active', FALSE, 'Talisay City', NOW()),
        (v_owner, (SELECT id FROM businesses WHERE slug = 'lapu-lapu-upcycle-workshop'),
         'a1000000-0000-0000-0000-000000000004', 'Tire Planter', 'tire-planter',
         'Painted upcycled tire planter for patios and gardens.', 650.00, 'piece', 8, 'used', 'Rubber', 'active', TRUE, 'Lapu-Lapu City', NOW()),
        (v_owner, (SELECT id FROM businesses WHERE slug = 'lapu-lapu-upcycle-workshop'),
         'a1000000-0000-0000-0000-000000000004', 'Tarpaulin Tote Bag', 'tarpaulin-tote-bag',
         'Sturdy tote sewn from used tarpaulin banners.', 300.00, 'piece', 30, 'new', 'Plastic', 'active', FALSE, 'Lapu-Lapu City', NOW()),
        (v_owner, (SELECT id FROM businesses WHERE slug = 'cebu-green-recycling-center'),
         'a1000000-0000-0000-0000-000000000005', 'Stainless Steel Water Bottle', 'stainless-steel-water-bottle',
         '750 ml insulated reusable bottle.', 550.00, 'piece', 45, 'new', NULL, 'active', FALSE, 'Cebu City', NOW()),
        (v_owner, (SELECT id FROM businesses WHERE slug = 'talisay-compost-hub'),
         'a1000000-0000-0000-0000-000000000006', 'Herb Starter Seeds Pack', 'herb-starter-seeds-pack',
         'Basil, oregano, mint and lemongrass seeds with planting guide.', 95.00, 'pack', 100, 'new', NULL, 'active', FALSE, 'Talisay City', NOW())
    ON CONFLICT (slug) DO NOTHING;

    -- --------------------------------------------------------
    -- FORUM THREADS (category_id was removed in migration 016)
    -- --------------------------------------------------------
    INSERT INTO forum_threads (author_id, title, slug, body, last_reply_at)
    VALUES
        (v_owner, 'Welcome to GreenPlace!', 'welcome-to-greenplace',
         'Introduce yourself and share what you want to recycle or reuse in Metro Cebu.', NOW()),
        (v_owner, 'Tips for segregating household waste', 'tips-segregating-household-waste',
         'Biodegradable, recyclable, residual, special: what are your best tips for keeping them apart at home?', NOW()),
        (v_owner, 'Where can I recycle e-waste in Cebu?', 'where-recycle-e-waste-cebu',
         'Looking for drop-off points for old phones and chargers. Any recommendations?', NOW())
    ON CONFLICT (slug) DO NOTHING;
END $$;

-- Check:
-- select count(*) from businesses where status = 'approved';
-- select count(*) from listings where status = 'active';
