-- ============================================================
-- Migration 022: Normalize conversation participants
-- conversations allows participant_1/participant_2 in any order,
-- so (A,B) and (B,A) could both be inserted. Canonicalize rows
-- to always store the smaller UUID first, drop reversed
-- duplicates, then enforce ordering with a CHECK constraint.
-- ============================================================

INSERT INTO schema_version (version, description)
VALUES (22, 'Normalize conversation participant order')
ON CONFLICT (version) DO NOTHING;

-- Swap rows stored in reverse order (only when no duplicate exists)
UPDATE conversations c
SET participant_1_id = c.participant_2_id,
    participant_2_id = c.participant_1_id
WHERE c.participant_1_id > c.participant_2_id
  AND NOT EXISTS (
    SELECT 1 FROM conversations d
    WHERE d.participant_1_id = c.participant_2_id
      AND d.participant_2_id = c.participant_1_id
  );

-- Remove reversed duplicates left behind by the swap above
DELETE FROM conversations c
WHERE c.participant_1_id > c.participant_2_id
  AND EXISTS (
    SELECT 1 FROM conversations d
    WHERE d.participant_1_id = c.participant_2_id
      AND d.participant_2_id = c.participant_1_id
  );

-- Enforce canonical order so UNIQUE (participant_1_id, participant_2_id)
-- truly deduplicates each participant pair
ALTER TABLE conversations
  ADD CONSTRAINT chk_participant_order CHECK (participant_1_id < participant_2_id);
