-- Google/Facebook sign-ins provide full_name / name instead of first_name / last_name.
-- Fall back to splitting that so OAuth users get a populated profile.
-- Role handling is unchanged: it comes from user metadata and defaults to 'resident'.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'resident'),
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'first_name', ''), fallback_first),
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'last_name', ''), fallback_last),
        COALESCE((NEW.email_confirmed_at IS NOT NULL), FALSE)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
