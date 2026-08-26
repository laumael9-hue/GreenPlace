-- ============================================================
-- GreenPlace Database Schema - Phase 2 Full Implementation
-- Tables, Relationships, Constraints, Indexes, RLS Policies
-- ============================================================

-- Bump schema version
INSERT INTO schema_version (version, description)
VALUES (2, 'Full schema - all tables, RLS, indexes, constraints')
ON CONFLICT (version) DO NOTHING;

-- ============================================================
-- CUSTOM TYPES / ENUMS
-- ============================================================

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('resident', 'business', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE business_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE listing_status AS ENUM ('draft', 'active', 'sold', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'processing', 'ready_for_pickup', 'completed', 'cancelled', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('cash_on_pickup', 'paymongo_gcash', 'paymongo_maya', 'paymongo_card');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE drop_off_status AS ENUM ('scheduled', 'in_transit', 'received', 'processed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM ('order', 'message', 'drop_off', 'forum', 'review', 'system', 'business');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE report_target AS ENUM ('listing', 'post', 'review', 'user', 'message');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE report_status AS ENUM ('pending', 'reviewed', 'resolved', 'dismissed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE day_of_week AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 1. PROFILES (extends Supabase auth.users)
-- ============================================================

CREATE TABLE profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role            user_role NOT NULL DEFAULT 'resident',
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    phone           VARCHAR(20),
    avatar_url      TEXT,
    address         TEXT,
    city            VARCHAR(100) DEFAULT 'Cebu City',
    province        VARCHAR(100) DEFAULT 'Cebu',
    latitude        DECIMAL(10, 8),
    longitude       DECIMAL(11, 8),
    bio             TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_city ON profiles(city);
CREATE INDEX idx_profiles_location ON profiles(latitude, longitude);

-- ============================================================
-- 2. BUSINESSES (waste management establishments)
-- ============================================================

CREATE TABLE businesses (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    slug                VARCHAR(255) NOT NULL UNIQUE,
    description         TEXT,
    category            VARCHAR(100) NOT NULL,
    address             TEXT NOT NULL,
    city                VARCHAR(100) NOT NULL DEFAULT 'Cebu City',
    province            VARCHAR(100) NOT NULL DEFAULT 'Cebu',
    latitude            DECIMAL(10, 8) NOT NULL,
    longitude           DECIMAL(11, 8) NOT NULL,
    phone               VARCHAR(20),
    email               VARCHAR(255),
    website             TEXT,
    logo_url            TEXT,
    cover_image_url     TEXT,
    status              business_status NOT NULL DEFAULT 'pending',
    is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    accepts_drop_offs   BOOLEAN NOT NULL DEFAULT FALSE,
    has_marketplace     BOOLEAN NOT NULL DEFAULT FALSE,
    rating_avg          DECIMAL(3, 2) DEFAULT 0.00,
    rating_count        INTEGER DEFAULT 0,
    total_drop_offs     INTEGER DEFAULT 0,
    total_orders        INTEGER DEFAULT 0,
    rejection_reason    TEXT,
    approved_at         TIMESTAMP WITH TIME ZONE,
    approved_by         UUID REFERENCES profiles(id),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_businesses_slug ON businesses(slug);
CREATE INDEX idx_businesses_owner ON businesses(owner_id);
CREATE INDEX idx_businesses_status ON businesses(status);
CREATE INDEX idx_businesses_category ON businesses(category);
CREATE INDEX idx_businesses_city ON businesses(city);
CREATE INDEX idx_businesses_location ON businesses(latitude, longitude);
CREATE INDEX idx_businesses_drop_offs ON businesses(accepts_drop_offs) WHERE accepts_drop_offs = TRUE;
CREATE INDEX idx_businesses_marketplace ON businesses(has_marketplace) WHERE has_marketplace = TRUE;

-- ============================================================
-- 3. BUSINESS HOURS
-- ============================================================

CREATE TABLE business_hours (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    day             day_of_week NOT NULL,
    open_time       TIME NOT NULL,
    close_time      TIME NOT NULL,
    is_closed       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT chk_hours_order CHECK (open_time < close_time),
    CONSTRAINT uq_business_hours UNIQUE (business_id, day)
);

CREATE INDEX idx_business_hours_business ON business_hours(business_id);

-- ============================================================
-- 4. BUSINESS MATERIALS (accepted recyclables)
-- ============================================================

CREATE TABLE business_materials (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    material_name   VARCHAR(100) NOT NULL,
    price_per_kg    DECIMAL(10, 2),
    unit            VARCHAR(20) DEFAULT 'kg',
    description     TEXT,
    is_accepted     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT uq_business_material UNIQUE (business_id, material_name)
);

CREATE INDEX idx_business_materials_business ON business_materials(business_id);

-- ============================================================
-- 5. BUSINESS DOCUMENTS (verification uploads)
-- ============================================================

CREATE TABLE business_documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    document_type   VARCHAR(50) NOT NULL,
    file_url        TEXT NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    file_size       INTEGER,
    mime_type       VARCHAR(100),
    uploaded_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT uq_business_document UNIQUE (business_id, document_type, file_name)
);

CREATE INDEX idx_business_documents_business ON business_documents(business_id);

-- ============================================================
-- 6. CATEGORIES
-- ============================================================

CREATE TABLE categories (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    icon            VARCHAR(50),
    parent_id       UUID REFERENCES categories(id) ON DELETE SET NULL,
    sort_order      INTEGER DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(slug);

-- ============================================================
-- 7. LISTINGS (marketplace items)
-- ============================================================

CREATE TABLE listings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    business_id     UUID REFERENCES businesses(id) ON DELETE SET NULL,
    category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
    title           VARCHAR(255) NOT NULL,
    slug            VARCHAR(255) NOT NULL UNIQUE,
    description     TEXT NOT NULL,
    price           DECIMAL(10, 2) NOT NULL,
    original_price  DECIMAL(10, 2),
    unit            VARCHAR(20) DEFAULT 'piece',
    quantity_available INTEGER NOT NULL DEFAULT 1,
    condition       VARCHAR(50) DEFAULT 'new',
    material_type   VARCHAR(100),
    weight_kg       DECIMAL(10, 2),
    status          listing_status NOT NULL DEFAULT 'draft',
    is_featured     BOOLEAN NOT NULL DEFAULT FALSE,
    view_count      INTEGER DEFAULT 0,
    sold_count      INTEGER DEFAULT 0,
    latitude        DECIMAL(10, 8),
    longitude       DECIMAL(11, 8),
    city            VARCHAR(100),
    published_at    TIMESTAMP WITH TIME ZONE,
    expires_at      TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT chk_price CHECK (price >= 0),
    CONSTRAINT chk_quantity CHECK (quantity_available >= 0)
);

CREATE INDEX idx_listings_seller ON listings(seller_id);
CREATE INDEX idx_listings_business ON listings(business_id);
CREATE INDEX idx_listings_category ON listings(category_id);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_price ON listings(price);
CREATE INDEX idx_listings_featured ON listings(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_listings_location ON listings(latitude, longitude);
CREATE INDEX idx_listings_city ON listings(city);
CREATE INDEX idx_listings_slug ON listings(slug);

-- ============================================================
-- 8. LISTING IMAGES
-- ============================================================

CREATE TABLE listing_images (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id      UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    image_url       TEXT NOT NULL,
    alt_text        VARCHAR(255),
    sort_order      INTEGER DEFAULT 0,
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_listing_images_listing ON listing_images(listing_id);

-- ============================================================
-- 9. CART ITEMS
-- ============================================================

CREATE TABLE cart_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    listing_id      UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    quantity        INTEGER NOT NULL DEFAULT 1,
    added_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT chk_cart_quantity CHECK (quantity > 0),
    CONSTRAINT uq_cart_item UNIQUE (user_id, listing_id)
);

CREATE INDEX idx_cart_items_user ON cart_items(user_id);

-- ============================================================
-- 10. ORDERS
-- ============================================================

CREATE TABLE orders (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    buyer_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    business_id         UUID REFERENCES businesses(id) ON DELETE SET NULL,
    order_number        VARCHAR(50) NOT NULL UNIQUE,
    status              order_status NOT NULL DEFAULT 'pending',
    subtotal            DECIMAL(10, 2) NOT NULL,
    shipping_fee        DECIMAL(10, 2) DEFAULT 0.00,
    total               DECIMAL(10, 2) NOT NULL,
    payment_method      payment_method NOT NULL DEFAULT 'cash_on_pickup',
    payment_status      payment_status NOT NULL DEFAULT 'pending',
    pickup_address      TEXT,
    pickup_latitude     DECIMAL(10, 8),
    pickup_longitude    DECIMAL(11, 8),
    notes               TEXT,
    confirmed_at        TIMESTAMP WITH TIME ZONE,
    completed_at        TIMESTAMP WITH TIME ZONE,
    cancelled_at        TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT chk_order_total CHECK (total >= 0)
);

CREATE INDEX idx_orders_buyer ON orders(buyer_id);
CREATE INDEX idx_orders_business ON orders(business_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- ============================================================
-- 11. ORDER ITEMS
-- ============================================================

CREATE TABLE order_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    listing_id      UUID NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
    seller_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    title           VARCHAR(255) NOT NULL,
    price           DECIMAL(10, 2) NOT NULL,
    quantity        INTEGER NOT NULL DEFAULT 1,
    total           DECIMAL(10, 2) NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT chk_order_item_quantity CHECK (quantity > 0),
    CONSTRAINT chk_order_item_total CHECK (total >= 0)
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_listing ON order_items(listing_id);

-- ============================================================
-- 12. PAYMENTS
-- ============================================================

CREATE TABLE payments (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    paymongo_payment_id VARCHAR(255),
    amount              DECIMAL(10, 2) NOT NULL,
    currency            VARCHAR(3) DEFAULT 'PHP',
    method              payment_method NOT NULL,
    status              payment_status NOT NULL DEFAULT 'pending',
    raw_response        JSONB,
    paid_at             TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_paymongo_id ON payments(paymongo_payment_id);

-- ============================================================
-- 13. DROP-OFFS
-- ============================================================

CREATE TABLE drop_offs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    reference_number    VARCHAR(50) NOT NULL UNIQUE,
    status              drop_off_status NOT NULL DEFAULT 'scheduled',
    total_weight_kg     DECIMAL(10, 2),
    estimated_value     DECIMAL(10, 2),
    actual_value        DECIMAL(10, 2),
    scheduled_date      TIMESTAMP WITH TIME ZONE,
    received_at         TIMESTAMP WITH TIME ZONE,
    processed_at        TIMESTAMP WITH TIME ZONE,
    notes               TEXT,
    business_notes      TEXT,
    receipt_url         TEXT,
    latitude            DECIMAL(10, 8),
    longitude           DECIMAL(11, 8),
    address             TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT chk_drop_off_weight CHECK (total_weight_kg IS NULL OR total_weight_kg >= 0)
);

CREATE INDEX idx_drop_offs_user ON drop_offs(user_id);
CREATE INDEX idx_drop_offs_business ON drop_offs(business_id);
CREATE INDEX idx_drop_offs_status ON drop_offs(status);
CREATE INDEX idx_drop_offs_reference ON drop_offs(reference_number);
CREATE INDEX idx_drop_offs_scheduled ON drop_offs(scheduled_date);
CREATE INDEX idx_drop_offs_created ON drop_offs(created_at DESC);

-- ============================================================
-- 14. DROP-OFF ITEMS
-- ============================================================

CREATE TABLE drop_off_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    drop_off_id     UUID NOT NULL REFERENCES drop_offs(id) ON DELETE CASCADE,
    material_name   VARCHAR(100) NOT NULL,
    quantity        DECIMAL(10, 2) NOT NULL,
    unit            VARCHAR(20) DEFAULT 'kg',
    estimated_value DECIMAL(10, 2),
    actual_value    DECIMAL(10, 2),
    notes           TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT chk_drop_off_item_quantity CHECK (quantity > 0)
);

CREATE INDEX idx_drop_off_items_drop_off ON drop_off_items(drop_off_id);

-- ============================================================
-- 15. FORUM CATEGORIES
-- ============================================================

CREATE TABLE forum_categories (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    color           VARCHAR(7),
    icon            VARCHAR(50),
    sort_order      INTEGER DEFAULT 0,
    thread_count    INTEGER DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_forum_categories_slug ON forum_categories(slug);

-- ============================================================
-- 16. FORUM THREADS
-- ============================================================

CREATE TABLE forum_threads (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    category_id     UUID NOT NULL REFERENCES forum_categories(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    slug            VARCHAR(300) NOT NULL UNIQUE,
    body            TEXT NOT NULL,
    is_pinned       BOOLEAN NOT NULL DEFAULT FALSE,
    is_locked       BOOLEAN NOT NULL DEFAULT FALSE,
    view_count      INTEGER DEFAULT 0,
    reply_count     INTEGER DEFAULT 0,
    last_reply_at   TIMESTAMP WITH TIME ZONE,
    last_reply_by   UUID REFERENCES profiles(id),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_forum_threads_author ON forum_threads(author_id);
CREATE INDEX idx_forum_threads_category ON forum_threads(category_id);
CREATE INDEX idx_forum_threads_pinned ON forum_threads(is_pinned) WHERE is_pinned = TRUE;
CREATE INDEX idx_forum_threads_last_reply ON forum_threads(last_reply_at DESC);
CREATE INDEX idx_forum_threads_slug ON forum_threads(slug);

-- ============================================================
-- 17. FORUM POSTS (replies)
-- ============================================================

CREATE TABLE forum_posts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id       UUID NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
    author_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    parent_id       UUID REFERENCES forum_posts(id) ON DELETE CASCADE,
    body            TEXT NOT NULL,
    is_edited       BOOLEAN NOT NULL DEFAULT FALSE,
    like_count      INTEGER DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_forum_posts_thread ON forum_posts(thread_id);
CREATE INDEX idx_forum_posts_author ON forum_posts(author_id);
CREATE INDEX idx_forum_posts_parent ON forum_posts(parent_id);
CREATE INDEX idx_forum_posts_created ON forum_posts(created_at);

-- ============================================================
-- 18. FORUM POST LIKES
-- ============================================================

CREATE TABLE forum_post_likes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id         UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT uq_post_like UNIQUE (post_id, user_id)
);

CREATE INDEX idx_forum_post_likes_post ON forum_post_likes(post_id);
CREATE INDEX idx_forum_post_likes_user ON forum_post_likes(user_id);

-- ============================================================
-- 19. CONVERSATIONS
-- ============================================================

CREATE TABLE conversations (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_1_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    participant_2_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    last_message_at     TIMESTAMP WITH TIME ZONE,
    last_message_preview TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT chk_different_participants CHECK (participant_1_id <> participant_2_id),
    CONSTRAINT uq_conversation_participants UNIQUE (participant_1_id, participant_2_id)
);

CREATE INDEX idx_conversations_participant_1 ON conversations(participant_1_id);
CREATE INDEX idx_conversations_participant_2 ON conversations(participant_2_id);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);

-- ============================================================
-- 20. MESSAGES
-- ============================================================

CREATE TABLE messages (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id     UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    body                TEXT NOT NULL,
    is_read             BOOLEAN NOT NULL DEFAULT FALSE,
    read_at             TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_unread ON messages(conversation_id, is_read) WHERE is_read = FALSE;

-- ============================================================
-- 21. NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type            notification_type NOT NULL,
    title           VARCHAR(255) NOT NULL,
    body            TEXT NOT NULL,
    data            JSONB,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_type ON notifications(type);

-- ============================================================
-- 22. REVIEWS
-- ============================================================

CREATE TABLE reviews (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reviewer_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,
    drop_off_id     UUID REFERENCES drop_offs(id) ON DELETE SET NULL,
    rating          SMALLINT NOT NULL,
    title           VARCHAR(255),
    body            TEXT,
    is_anonymous    BOOLEAN NOT NULL DEFAULT FALSE,
    business_reply  TEXT,
    business_replied_at TIMESTAMP WITH TIME ZONE,
    is_visible      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT chk_rating CHECK (rating >= 1 AND rating <= 5),
    CONSTRAINT uq_review_per_order UNIQUE (reviewer_id, order_id),
    CONSTRAINT uq_review_per_drop_off UNIQUE (reviewer_id, drop_off_id)
);

CREATE INDEX idx_reviews_business ON reviews(business_id);
CREATE INDEX idx_reviews_reviewer ON reviews(reviewer_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_created ON reviews(created_at DESC);

-- ============================================================
-- 23. REPORTS (content moderation)
-- ============================================================

CREATE TABLE reports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    target_type     report_target NOT NULL,
    target_id       UUID NOT NULL,
    reason          VARCHAR(100) NOT NULL,
    description     TEXT,
    status          report_status NOT NULL DEFAULT 'pending',
    reviewed_by     UUID REFERENCES profiles(id),
    resolution_note TEXT,
    reviewed_at     TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_target ON reports(target_type, target_id);
CREATE INDEX idx_reports_reporter ON reports(reporter_id);

-- ============================================================
-- 24. SYSTEM SETTINGS (admin-configurable)
-- ============================================================

CREATE TABLE system_settings (
    key             VARCHAR(100) PRIMARY KEY,
    value           TEXT NOT NULL,
    description     TEXT,
    updated_by      UUID REFERENCES profiles(id),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 25. ADMIN AUDIT LOG
-- ============================================================

CREATE TABLE admin_audit_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    action          VARCHAR(100) NOT NULL,
    target_type     VARCHAR(50) NOT NULL,
    target_id       UUID,
    details         JSONB,
    ip_address      INET,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_admin ON admin_audit_log(admin_id);
CREATE INDEX idx_admin_audit_action ON admin_audit_log(action);
CREATE INDEX idx_admin_audit_target ON admin_audit_log(target_type, target_id);
CREATE INDEX idx_admin_audit_created ON admin_audit_log(created_at DESC);

-- ============================================================
-- AUTO-UPDATE TRIGGERS (updated_at)
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_businesses_updated_at
    BEFORE UPDATE ON businesses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_listings_updated_at
    BEFORE UPDATE ON listings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_drop_offs_updated_at
    BEFORE UPDATE ON drop_offs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_forum_threads_updated_at
    BEFORE UPDATE ON forum_threads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_forum_posts_updated_at
    BEFORE UPDATE ON forum_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_reviews_updated_at
    BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- BUSINESS RATING AUTO-UPDATE TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_business_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE businesses
    SET rating_avg = COALESCE(
        (SELECT ROUND(AVG(rating)::numeric, 2)
         FROM reviews
         WHERE business_id = COALESCE(NEW.business_id, OLD.business_id)
         AND is_visible = TRUE),
        0.00
    ),
    rating_count = (
        SELECT COUNT(*)
        FROM reviews
        WHERE business_id = COALESCE(NEW.business_id, OLD.business_id)
        AND is_visible = TRUE
    )
    WHERE id = COALESCE(NEW.business_id, OLD.business_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reviews_rating_update
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_business_rating();

-- ============================================================
-- FORUM REPLY COUNT AUTO-UPDATE TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_forum_thread_reply_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE forum_threads
        SET reply_count = reply_count + 1,
            last_reply_at = NEW.created_at,
            last_reply_by = NEW.author_id
        WHERE id = NEW.thread_id;

        UPDATE forum_categories
        SET thread_count = (
            SELECT COUNT(*) FROM forum_threads WHERE category_id = NEW.category_id
        )
        WHERE id = NEW.category_id;

        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE forum_threads
        SET reply_count = reply_count - 1
        WHERE id = OLD.thread_id;
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_forum_post_count
    AFTER INSERT OR DELETE ON forum_posts
    FOR EACH ROW EXECUTE FUNCTION update_forum_thread_reply_count();

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE drop_offs ENABLE ROW LEVEL SECURITY;
ALTER TABLE drop_off_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES RLS
-- ============================================================

CREATE POLICY "Public profiles are viewable by everyone"
    ON profiles FOR SELECT
    USING (TRUE);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
    ON profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can delete profiles"
    ON profiles FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================
-- BUSINESSES RLS
-- ============================================================

CREATE POLICY "Approved businesses are viewable by everyone"
    ON businesses FOR SELECT
    USING (status = 'approved' OR owner_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        ));

CREATE POLICY "Business owners can insert their business"
    ON businesses FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Business owners can update own business"
    ON businesses FOR UPDATE
    USING (
        owner_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can delete businesses"
    ON businesses FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================
-- BUSINESS HOURS RLS
-- ============================================================

CREATE POLICY "Business hours viewable by everyone"
    ON business_hours FOR SELECT
    USING (TRUE);

CREATE POLICY "Business owners can manage own hours"
    ON business_hours FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM businesses
            WHERE businesses.id = business_hours.business_id
            AND businesses.owner_id = auth.uid()
        )
    );

-- ============================================================
-- BUSINESS MATERIALS RLS
-- ============================================================

CREATE POLICY "Business materials viewable by everyone"
    ON business_materials FOR SELECT
    USING (TRUE);

CREATE POLICY "Business owners can manage own materials"
    ON business_materials FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM businesses
            WHERE businesses.id = business_materials.business_id
            AND businesses.owner_id = auth.uid()
        )
    );

-- ============================================================
-- BUSINESS DOCUMENTS RLS
-- ============================================================

CREATE POLICY "Business owners can view own documents"
    ON business_documents FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM businesses
            WHERE businesses.id = business_documents.business_id
            AND businesses.owner_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all documents"
    ON business_documents FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Business owners can manage own documents"
    ON business_documents FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM businesses
            WHERE businesses.id = business_documents.business_id
            AND businesses.owner_id = auth.uid()
        )
    );

CREATE POLICY "Business owners can delete own documents"
    ON business_documents FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM businesses
            WHERE businesses.id = business_documents.business_id
            AND businesses.owner_id = auth.uid()
        )
    );

-- ============================================================
-- CATEGORIES RLS
-- ============================================================

CREATE POLICY "Categories viewable by everyone"
    ON categories FOR SELECT
    USING (TRUE);

CREATE POLICY "Admins can manage categories"
    ON categories FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================
-- LISTINGS RLS
-- ============================================================

CREATE POLICY "Active listings viewable by everyone"
    ON listings FOR SELECT
    USING (
        status = 'active'
        OR seller_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Users can insert own listings"
    ON listings FOR INSERT
    WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers can update own listings"
    ON listings FOR UPDATE
    USING (
        seller_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Sellers can delete own listings"
    ON listings FOR DELETE
    USING (
        seller_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================
-- LISTING IMAGES RLS
-- ============================================================

CREATE POLICY "Listing images viewable by everyone"
    ON listing_images FOR SELECT
    USING (TRUE);

CREATE POLICY "Sellers can manage own listing images"
    ON listing_images FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM listings
            WHERE listings.id = listing_images.listing_id
            AND listings.seller_id = auth.uid()
        )
    );

-- ============================================================
-- CART ITEMS RLS
-- ============================================================

CREATE POLICY "Users can view own cart"
    ON cart_items FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage own cart"
    ON cart_items FOR ALL
    USING (user_id = auth.uid());

-- ============================================================
-- ORDERS RLS
-- ============================================================

CREATE POLICY "Buyers can view own orders"
    ON orders FOR SELECT
    USING (
        buyer_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM businesses
            WHERE businesses.id = orders.business_id
            AND businesses.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Users can create orders"
    ON orders FOR INSERT
    WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Buyers and sellers can update order status"
    ON orders FOR UPDATE
    USING (
        buyer_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM businesses
            WHERE businesses.id = orders.business_id
            AND businesses.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================
-- ORDER ITEMS RLS
-- ============================================================

CREATE POLICY "Order items viewable by order participants"
    ON order_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
            AND (
                orders.buyer_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM businesses
                    WHERE businesses.id = orders.business_id
                    AND businesses.owner_id = auth.uid()
                )
            )
        )
        OR EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Order items created with order"
    ON order_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
            AND orders.buyer_id = auth.uid()
        )
    );

-- ============================================================
-- PAYMENTS RLS
-- ============================================================

CREATE POLICY "Payments viewable by order participants"
    ON payments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = payments.order_id
            AND (
                orders.buyer_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM businesses
                    WHERE businesses.id = orders.business_id
                    AND businesses.owner_id = auth.uid()
                )
            )
        )
        OR EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Authenticated users can create payments"
    ON payments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = payments.order_id
            AND orders.buyer_id = auth.uid()
        )
    );

CREATE POLICY "Admins can update payments"
    ON payments FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================
-- DROP-OFFS RLS
-- ============================================================

CREATE POLICY "Drop-offs viewable by participants"
    ON drop_offs FOR SELECT
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM businesses
            WHERE businesses.id = drop_offs.business_id
            AND businesses.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Users can create own drop-offs"
    ON drop_offs FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users and business owners can update drop-offs"
    ON drop_offs FOR UPDATE
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM businesses
            WHERE businesses.id = drop_offs.business_id
            AND businesses.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================
-- DROP-OFF ITEMS RLS
-- ============================================================

CREATE POLICY "Drop-off items viewable by participants"
    ON drop_off_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM drop_offs
            WHERE drop_offs.id = drop_off_items.drop_off_id
            AND (
                drop_offs.user_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM businesses
                    WHERE businesses.id = drop_offs.business_id
                    AND businesses.owner_id = auth.uid()
                )
            )
        )
        OR EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Users can manage drop-off items"
    ON drop_off_items FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM drop_offs
            WHERE drop_offs.id = drop_off_items.drop_off_id
            AND drop_offs.user_id = auth.uid()
        )
    );

-- ============================================================
-- FORUM CATEGORIES RLS
-- ============================================================

CREATE POLICY "Forum categories viewable by everyone"
    ON forum_categories FOR SELECT
    USING (TRUE);

CREATE POLICY "Admins can manage forum categories"
    ON forum_categories FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================
-- FORUM THREADS RLS
-- ============================================================

CREATE POLICY "Forum threads viewable by everyone"
    ON forum_threads FOR SELECT
    USING (TRUE);

CREATE POLICY "Authenticated users can create threads"
    ON forum_threads FOR INSERT
    WITH CHECK (author_id = auth.uid());

CREATE POLICY "Authors can update own threads"
    ON forum_threads FOR UPDATE
    USING (
        author_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Authors and admins can delete threads"
    ON forum_threads FOR DELETE
    USING (
        author_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================
-- FORUM POSTS RLS
-- ============================================================

CREATE POLICY "Forum posts viewable by everyone"
    ON forum_posts FOR SELECT
    USING (TRUE);

CREATE POLICY "Authenticated users can create posts"
    ON forum_posts FOR INSERT
    WITH CHECK (author_id = auth.uid());

CREATE POLICY "Authors can update own posts"
    ON forum_posts FOR UPDATE
    USING (
        author_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Authors and admins can delete posts"
    ON forum_posts FOR DELETE
    USING (
        author_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================
-- FORUM POST LIKES RLS
-- ============================================================

CREATE POLICY "Likes viewable by everyone"
    ON forum_post_likes FOR SELECT
    USING (TRUE);

CREATE POLICY "Users can manage own likes"
    ON forum_post_likes FOR ALL
    USING (user_id = auth.uid());

-- ============================================================
-- CONVERSATIONS RLS
-- ============================================================

CREATE POLICY "Users can view own conversations"
    ON conversations FOR SELECT
    USING (
        participant_1_id = auth.uid()
        OR participant_2_id = auth.uid()
    );

CREATE POLICY "Authenticated users can create conversations"
    ON conversations FOR INSERT
    WITH CHECK (
        participant_1_id = auth.uid()
        OR participant_2_id = auth.uid()
    );

CREATE POLICY "Participants can update conversations"
    ON conversations FOR UPDATE
    USING (
        participant_1_id = auth.uid()
        OR participant_2_id = auth.uid()
    );

-- ============================================================
-- MESSAGES RLS
-- ============================================================

CREATE POLICY "Participants can view conversation messages"
    ON messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND (
                conversations.participant_1_id = auth.uid()
                OR conversations.participant_2_id = auth.uid()
            )
        )
    );

CREATE POLICY "Participants can send messages"
    ON messages FOR INSERT
    WITH CHECK (
        sender_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND (
                conversations.participant_1_id = auth.uid()
                OR conversations.participant_2_id = auth.uid()
            )
        )
    );

CREATE POLICY "Participants can update messages (read status)"
    ON messages FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND (
                conversations.participant_1_id = auth.uid()
                OR conversations.participant_2_id = auth.uid()
            )
        )
    );

-- ============================================================
-- NOTIFICATIONS RLS
-- ============================================================

CREATE POLICY "Users can view own notifications"
    ON notifications FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
    ON notifications FOR INSERT
    WITH CHECK (TRUE);

CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
    ON notifications FOR DELETE
    USING (user_id = auth.uid());

-- ============================================================
-- REVIEWS RLS
-- ============================================================

CREATE POLICY "Reviews viewable by everyone"
    ON reviews FOR SELECT
    USING (TRUE);

CREATE POLICY "Users can create reviews"
    ON reviews FOR INSERT
    WITH CHECK (reviewer_id = auth.uid());

CREATE POLICY "Reviewers can update own reviews"
    ON reviews FOR UPDATE
    USING (
        reviewer_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM businesses
            WHERE businesses.id = reviews.business_id
            AND businesses.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Reviewers and admins can delete reviews"
    ON reviews FOR DELETE
    USING (
        reviewer_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================
-- REPORTS RLS
-- ============================================================

CREATE POLICY "Users can view own reports"
    ON reports FOR SELECT
    USING (
        reporter_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Authenticated users can create reports"
    ON reports FOR INSERT
    WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Admins can manage reports"
    ON reports FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================
-- SYSTEM SETTINGS RLS
-- ============================================================

CREATE POLICY "System settings viewable by everyone"
    ON system_settings FOR SELECT
    USING (TRUE);

CREATE POLICY "Admins can manage system settings"
    ON system_settings FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================
-- ADMIN AUDIT LOG RLS
-- ============================================================

CREATE POLICY "Admins can view audit log"
    ON admin_audit_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can create audit entries"
    ON admin_audit_log FOR INSERT
    WITH CHECK (
        admin_id = auth.uid()
    );

-- ============================================================
-- SUPABASE AUTH HOOK: Auto-create profile on signup
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, role, first_name, last_name, email_verified)
    VALUES (
        NEW.id,
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'resident'),
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        COALESCE((NEW.email_confirmed_at IS NOT NULL), FALSE)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
