-- Fix signup failing with "Database error saving new user".
-- The auth trigger function ran without a fixed search_path and cast to an
-- unqualified user_role type, which can fail when Supabase fires it from the
-- auth schema context. Pin search_path and qualify the type.
-- Behavior is otherwise identical to 027_oauth_profile_names.sql.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    full_name TEXT := TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''));
    split_at INT := POSITION(' ' IN full_name);
    fallback_first TEXT;
    fallback_last TEXT;
BEGIN
    IF split_at > 0 THEN
        fallback_first := LEFT(full_name, split_at - 1);
        fallback_last := TRIM(SUBSTRING(full_name FROM split_at + 1));
    ELSE
        fallback_first := full_name;
        fallback_last := '';
    END IF;

    INSERT INTO public.profiles (id, role, first_name, last_name, email_verified)
    VALUES (
        NEW.id,
        COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'resident'),
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'first_name', ''), fallback_first),
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'last_name', ''), fallback_last),
        COALESCE((NEW.email_confirmed_at IS NOT NULL), FALSE)
    );
    RETURN NEW;
END;
$$;
