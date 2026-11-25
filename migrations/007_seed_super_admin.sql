-- Seed the first super admin (run once in SQL editor).
-- Replace email with your Auth user email.

INSERT INTO public.super_admins (user_id, name, email, permissions, is_active)
SELECT
  id,
  COALESCE(raw_user_meta_data->>'full_name', email),
  email,
  '{
    "manage_shops": true,
    "manage_users": true,
    "manage_limits": true,
    "manage_features": true,
    "view_analytics": true,
    "system_settings": true
  }'::jsonb,
  true
FROM auth.users
WHERE email = 'YOUR_EMAIL@example.com'
ON CONFLICT (user_id) DO UPDATE
SET is_active = true,
    permissions = EXCLUDED.permissions,
    updated_at = NOW();
