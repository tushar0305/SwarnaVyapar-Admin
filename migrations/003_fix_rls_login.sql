-- ============================================
-- FIX: Allow users to check their own super admin status during login
-- ============================================

-- Drop existing policy
DROP POLICY IF EXISTS "super_admins_manage_admins" ON super_admins;

-- Allow users to view their own super admin record (for login check)
CREATE POLICY "users_can_view_own_admin_record" ON super_admins
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow existing super admins to manage all admin records
CREATE POLICY "super_admins_manage_all_admins" ON super_admins
  FOR ALL
  USING (
    auth.uid() IN (SELECT user_id FROM super_admins WHERE is_active = true)
  );

COMMENT ON POLICY "users_can_view_own_admin_record" ON super_admins IS 'Allow users to check if they are super admins during login';
