-- ============================================================
-- Migration 031: Message options
-- Per-message edit/unsend (edited_at, deleted_at) and per-user
-- conversation settings (mute, archive, block).
-- ============================================================

INSERT INTO schema_version (version, description)
VALUES (31, 'Message edit/unsend and per-user conversation settings')
ON CONFLICT (version) DO NOTHING;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS edited_at  TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS conversation_settings (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    muted           BOOLEAN NOT NULL DEFAULT FALSE,
    archived        BOOLEAN NOT NULL DEFAULT FALSE,
    blocked         BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_settings_user ON conversation_settings(user_id);
