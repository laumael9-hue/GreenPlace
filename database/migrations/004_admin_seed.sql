-- ============================================================
-- Admin Seed Script - Creates admin user for GreenPlace
-- Run this in Supabase SQL Editor
-- ============================================================

DO $$
DECLARE
    admin_id UUID;
BEGIN
    -- Check if admin already exists
    SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@greenplace.com';

    IF admin_id IS NOT NULL THEN
        RAISE NOTICE 'Admin user already exists with ID: %', admin_id;
        RETURN;
    END IF;

    -- Create auth user
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change,
        raw_user_meta_data
    )
    VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        'admin@greenplace.com',
        crypt('admin123456', gen_salt('bf')),
        now(),
        now(),
        now(),
        '',
        '',
        '',
        '',
        '{"first_name": "Admin", "last_name": "User", "role": "admin"}'::jsonb
    )
    RETURNING id INTO admin_id;

    -- Create admin profile
    INSERT INTO profiles (id, role, first_name, last_name, email_verified)
    VALUES (admin_id, 'admin', 'Admin', 'User', true);

    RAISE NOTICE 'Admin user created with ID: %', admin_id;
END
$$;
