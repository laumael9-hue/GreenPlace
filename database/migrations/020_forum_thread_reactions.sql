-- ============================================================
-- GreenPlace Migration 020 — Forum Thread Reactions
-- React to threads from the feed (one reaction per user per thread)
-- ============================================================

INSERT INTO schema_version (version, description)
VALUES (20, 'Forum thread reactions - react to threads from the feed')
ON CONFLICT (version) DO NOTHING;

-- ============================================================
-- 1. TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS forum_thread_reactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id       UUID NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reaction_type   forum_reaction_type NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT uq_forum_thread_reaction UNIQUE (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_forum_thread_reactions_thread ON forum_thread_reactions(thread_id);
CREATE INDEX IF NOT EXISTS idx_forum_thread_reactions_user ON forum_thread_reactions(user_id);

-- ============================================================
-- 2. RLS (mirror forum_reactions)
-- ============================================================

ALTER TABLE forum_thread_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Forum thread reactions are viewable by everyone"
    ON forum_thread_reactions FOR SELECT USING (TRUE);

CREATE POLICY "Users can insert own forum thread reactions"
    ON forum_thread_reactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own forum thread reactions"
    ON forum_thread_reactions FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own forum thread reactions"
    ON forum_thread_reactions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
