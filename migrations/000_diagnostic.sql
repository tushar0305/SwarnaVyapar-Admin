-- ============================================
-- DIAGNOSTIC: Check Super Admin Setup
-- Run this to verify everything is configured correctly
-- ============================================

-- 1. Check if super_admins table exists and has data
SELECT 
  'super_admins table' as check_name,
  COUNT(*) as count,
  STRING_AGG(email, ', ') as emails
FROM super_admins;

-- 2. Check auth users
SELECT 
  'auth users' as check_name,
  COUNT(*) as count,
  STRING_AGG(email, ', ') as emails
FROM auth.users;

-- 3. Check if there's a matching user_id in both tables
SELECT 
  'matched super admins' as check_name,
  COUNT(*) as count,
  STRING_AGG(sa.email, ', ') as emails
FROM super_admins sa
INNER JOIN auth.users au ON sa.user_id = au.id;

-- 4. Check RLS policies on super_admins
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'super_admins';

-- 5. Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'super_admins';

-- 6. List all super admins with their details
SELECT 
  sa.id,
  sa.user_id,
  sa.email,
  sa.name,
  sa.is_active,
  sa.permissions,
  au.email as auth_email
FROM super_admins sa
LEFT JOIN auth.users au ON sa.user_id = au.id;
