-- ============================================
-- COMPLETE FIX: Super Admin Login Issues
-- ============================================

-- Step 1: Drop all existing policies on super_admins
DROP POLICY IF EXISTS "super_admins_manage_admins" ON super_admins;
DROP POLICY IF EXISTS "super_admins_manage_all_admins" ON super_admins;
DROP POLICY IF EXISTS "users_can_view_own_admin_record" ON super_admins;

-- Step 2: Temporarily disable RLS for easier debugging (can re-enable later)
ALTER TABLE super_admins DISABLE ROW LEVEL SECURITY;

-- Alternative Step 2 (if you want to keep RLS enabled):
-- CREATE POLICY "allow_authenticated_users_to_check_own_status" ON super_admins
--   FOR SELECT
--   USING (auth.uid() = user_id);

-- Step 3: Verify/Fix helper function to work without RLS issues
CREATE OR REPLACE FUNCTION is_super_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM super_admins
    WHERE user_id = user_uuid AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Grant necessary permissions
GRANT SELECT ON super_admins TO authenticated;

-- Step 5: Verify your super admin exists and is active
-- Run this separately with your actual user_id:
-- SELECT * FROM super_admins WHERE email = 'admin@swarnavyapar.in';

COMMENT ON TABLE super_admins IS 'RLS temporarily disabled for initial setup - re-enable after first successful login';
