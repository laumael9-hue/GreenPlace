-- ============================================================
-- GreenPlace Migration 015 — Forum Social Features
-- Emoji reactions, bookmarks, trending support
-- ============================================================

INSERT INTO schema_version (version, description)
VALUES (15, 'Forum social features - reactions, bookmarks, trending')
ON CONFLICT (version) DO NOTHING;

-- ============================================================
-- 1. REACTION TYPE ENUM
-- ============================================================

CREATE TYPE forum_reaction_type AS ENUM (
    'thumbs_up',
    'heart',
    'celebrate',
    'insightful',
    'funny'
);

-- ============================================================
-- 2. FORUM REACTIONS (replaces forum_post_likes)
-- ============================================================

CREATE TABLE forum_reactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id         UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reaction_type   forum_reaction_type NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT uq_forum_reaction UNIQUE (post_id, user_id)
);

CREATE INDEX idx_forum_reactions_post ON forum_reactions(post_id);
CREATE INDEX idx_forum_reactions_user ON forum_reactions(user_id);

-- ============================================================
-- 3. FORUM BOOKMARKS
-- ============================================================

CREATE TABLE forum_bookmarks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    thread_id       UUID NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT uq_forum_bookmark UNIQUE (user_id, thread_id)
);

CREATE INDEX idx_forum_bookmarks_user ON forum_bookmarks(user_id);
CREATE INDEX idx_forum_bookmarks_thread ON forum_bookmarks(thread_id);

-- ============================================================
-- 4. ADD REACTION_COUNTS TO FORUM_POSTS
-- ============================================================

ALTER TABLE forum_posts ADD COLUMN reaction_counts JSONB DEFAULT '{}';

-- ============================================================
-- 5. RLS POLICIES
-- ============================================================

-- Forum reactions: public read, users manage own
ALTER TABLE forum_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Forum reactions are viewable by everyone"
    ON forum_reactions FOR SELECT USING (TRUE);

CREATE POLICY "Users can insert own forum reactions"
    ON forum_reactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own forum reactions"
    ON forum_reactions FOR DELETE
    USING (auth.uid() = user_id);

-- Forum bookmarks: users manage own
ALTER TABLE forum_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own forum bookmarks"
    ON forum_bookmarks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own forum bookmarks"
    ON forum_bookmarks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own forum bookmarks"
    ON forum_bookmarks FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================
-- 6. MIGRATE EXISTING LIKES TO REACTIONS
-- ============================================================

INSERT INTO forum_reactions (post_id, user_id, reaction_type, created_at)
SELECT post_id, user_id, 'thumbs_up', created_at
FROM forum_post_likes
ON CONFLICT (post_id, user_id) DO NOTHING;

-- Update reaction_counts on forum_posts
UPDATE forum_posts
SET reaction_counts = (
    SELECT jsonb_build_object('thumbs_up', COUNT(*))
    FROM forum_reactions
    WHERE forum_reactions.post_id = forum_posts.id
    AND forum_reactions.reaction_type = 'thumbs_up'
)
WHERE EXISTS (
    SELECT 1 FROM forum_reactions
    WHERE forum_reactions.post_id = forum_posts.id
);

-- ============================================================
-- 7. DROP OLD LIKES TABLE
-- ============================================================

DROP TABLE IF EXISTS forum_post_likes;
