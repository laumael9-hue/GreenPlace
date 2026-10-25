-- ============================================================
-- GreenPlace Migration 026 — Profile role self-update protection
--
-- Residents can convert to business via admin-approved applications.
-- Role changes are performed server-side with the service role only.
-- This migration blocks authenticated Postgres clients from changing
-- profiles.role on their own row (privilege-escalation guard).
-- ============================================================

INSERT INTO schema_version (version, description)
VALUES (26, 'Prevent authenticated users from self-updating profiles.role')
ON CONFLICT (version) DO NOTHING;

-- ============================================================
-- Trigger: reject role changes coming from an authenticated JWT.
-- The API's service-role connection sets auth.role() to
-- 'service_role', and SQL-editor sessions run as postgres — both
-- bypass this guard. Only end-user clients are blocked.
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_role_self_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role
       AND COALESCE(auth.role(), '') = 'authenticated' THEN
        RAISE EXCEPTION 'profiles.role cannot be changed by the account owner';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_self_change ON profiles;
CREATE TRIGGER trg_prevent_role_self_change
    BEFORE UPDATE OF role ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION prevent_role_self_change();
