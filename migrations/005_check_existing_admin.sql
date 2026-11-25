-- Check your existing super admin record
SELECT 
  sa.id,
  sa.user_id,
  sa.email,
  sa.name,
  sa.is_active,
  sa.permissions,
  sa.created_at
FROM super_admins sa
WHERE sa.user_id = '8b53886b-3876-4622-b2ed-c167f60bafe6';

-- If the above shows is_active = false, run this to activate it:
-- UPDATE super_admins 
-- SET is_active = true 
-- WHERE user_id = '8b53886b-3876-4622-b2ed-c167f60bafe6';
