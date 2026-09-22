-- ============================================================
-- GreenPlace Migration 019 — Drop Broken Forum Posts Trigger
-- trg_forum_post_count still references dropped forum_categories,
-- which made every reply insert fail. The controller already
-- maintains reply_count / last_reply_at / last_reply_by.
-- ============================================================

INSERT INTO schema_version (version, description)
VALUES (19, 'Drop broken forum_posts trigger referencing dropped forum_categories')
ON CONFLICT (version) DO NOTHING;

DROP TRIGGER IF EXISTS trg_forum_post_count ON forum_posts;
DROP FUNCTION IF EXISTS update_forum_thread_reply_count();
