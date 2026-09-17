-- ============================================================
-- GreenPlace Migration 016 — Drop Forum Categories
-- Remove forum_categories table and category_id from forum_threads
-- ============================================================

INSERT INTO schema_version (version, description)
VALUES (16, 'Drop forum categories - flat social media feed')
ON CONFLICT (version) DO NOTHING;

-- ============================================================
-- 1. MAKE category_id NULLABLE ON forum_threads
-- ============================================================

ALTER TABLE forum_threads ALTER COLUMN category_id DROP NOT NULL;

-- ============================================================
-- 2. DROP FOREIGN KEY AND SET NULL
-- ============================================================

-- Set all category_id values to NULL
UPDATE forum_threads SET category_id = NULL;

-- Drop the foreign key constraint (find the constraint name first)
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'forum_threads'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'category_id'
    LIMIT 1;

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE forum_threads DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;

-- ============================================================
-- 3. DROP INDEXES
-- ============================================================

DROP INDEX IF EXISTS idx_forum_threads_category;
DROP INDEX IF EXISTS idx_forum_categories_slug;

-- ============================================================
-- 4. DROP RLS POLICIES AND TABLE
-- ============================================================

DROP POLICY IF EXISTS "Forum categories viewable by everyone" ON forum_categories;
DROP POLICY IF EXISTS "Admins can manage forum categories" ON forum_categories;
DROP TABLE IF EXISTS forum_categories;

-- ============================================================
-- 5. DROP TRIGGER FUNCTION THAT REFERENCES forum_categories
-- ============================================================

-- Drop the trigger and function that updated forum_categories thread_count
DROP TRIGGER IF EXISTS trg_forum_thread_counts ON forum_threads;
DROP FUNCTION IF EXISTS update_forum_thread_counts();

-- ============================================================
-- 6. CLEAN UP: DROP category_id COLUMN (optional, keeps schema clean)
-- ============================================================

-- Uncomment if you want to fully remove the column:
-- ALTER TABLE forum_threads DROP COLUMN category_id;
