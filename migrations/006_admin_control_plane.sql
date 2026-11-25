-- Admin control plane (idempotent). Safe to re-run.
-- Fixes: missing tables, shops suspension columns, RLS via SECURITY DEFINER helpers.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SUPER ADMINS
-- ============================================

CREATE TABLE IF NOT EXISTS public.super_admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  permissions JSONB DEFAULT '{
    "manage_shops": true,
    "manage_users": true,
    "manage_limits": true,
    "manage_features": true,
    "view_analytics": true,
    "system_settings": false
  }'::jsonb,
  is_active BOOLEAN DEFAULT true,
  mfa_enabled BOOLEAN DEFAULT false,
  mfa_secret TEXT,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.super_admins(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.super_admin_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES public.super_admins(id) NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  changes JSONB,
  reason TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON public.super_admin_audit_log(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON public.super_admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.super_admin_audit_log(action, created_at DESC);

-- Helpers after table exists (SECURITY DEFINER bypasses RLS → no login chicken-egg)
CREATE OR REPLACE FUNCTION public.is_super_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.super_admins
    WHERE user_id = user_uuid AND is_active = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.has_admin_permission(
  permission_key TEXT,
  user_uuid UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.super_admins
    WHERE user_id = user_uuid
      AND is_active = true
      AND COALESCE((permissions ->> permission_key)::boolean, false) = true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_admin_permission(TEXT, UUID) TO authenticated;

-- ============================================
-- SHOPS: suspension / health
-- ============================================

ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES public.super_admins(id);
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS health_score NUMERIC(3,2) DEFAULT 1.0;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.shops SET is_suspended = false WHERE is_suspended IS NULL;

CREATE TABLE IF NOT EXISTS public.shop_suspensions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES public.shops NOT NULL,
  suspended_by UUID REFERENCES public.super_admins(id) NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  suspended_at TIMESTAMPTZ DEFAULT NOW(),
  unsuspended_at TIMESTAMPTZ,
  unsuspended_by UUID REFERENCES public.super_admins(id)
);

CREATE INDEX IF NOT EXISTS idx_shop_suspensions_shop ON public.shop_suspensions(shop_id);

-- ============================================
-- LIMITS + FEATURE FLAGS
-- ============================================

CREATE TABLE IF NOT EXISTS public.shop_limit_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES public.shops NOT NULL,
  limit_key TEXT NOT NULL,
  override_value INTEGER NOT NULL,
  reason TEXT NOT NULL,
  is_temporary BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.super_admins(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, limit_key)
);

CREATE INDEX IF NOT EXISTS idx_limit_overrides_shop ON public.shop_limit_overrides(shop_id);

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feature_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_enabled_globally BOOLEAN DEFAULT false,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.shop_feature_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES public.shops NOT NULL,
  feature_key TEXT REFERENCES public.feature_flags(feature_key) NOT NULL,
  is_enabled BOOLEAN NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES public.super_admins(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(shop_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_feature_overrides_shop ON public.shop_feature_overrides(shop_id);

-- ============================================
-- ANNOUNCEMENTS + HEALTH
-- ============================================

CREATE TABLE IF NOT EXISTS public.platform_announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('info', 'warning', 'critical', 'maintenance')),
  target_audience TEXT DEFAULT 'all',
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.super_admins(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.announcement_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  announcement_id UUID REFERENCES public.platform_announcements NOT NULL,
  shop_id UUID REFERENCES public.shops,
  user_id UUID REFERENCES auth.users,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_health_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  total_shops INTEGER,
  active_shops INTEGER,
  suspended_shops INTEGER,
  total_users INTEGER,
  active_users_24h INTEGER,
  total_invoices_today INTEGER,
  gmv_30d NUMERIC(12,2),
  error_rate NUMERIC(5,2),
  avg_response_time_ms INTEGER,
  snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RLS
-- ============================================

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_limit_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_feature_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_suspensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_health_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_views ENABLE ROW LEVEL SECURITY;

-- Drop legacy / broken policies
DROP POLICY IF EXISTS "super_admins_manage_admins" ON public.super_admins;
DROP POLICY IF EXISTS "super_admins_manage_all_admins" ON public.super_admins;
DROP POLICY IF EXISTS "users_can_view_own_admin_record" ON public.super_admins;
DROP POLICY IF EXISTS "allow_authenticated_users_to_check_own_status" ON public.super_admins;
DROP POLICY IF EXISTS "super_admins_select_own" ON public.super_admins;
DROP POLICY IF EXISTS "super_admins_manage_via_fn" ON public.super_admins;
DROP POLICY IF EXISTS "super_admins_view_audit_log" ON public.super_admin_audit_log;
DROP POLICY IF EXISTS "super_admins_insert_audit_log" ON public.super_admin_audit_log;
DROP POLICY IF EXISTS "super_admins_view_all_shops" ON public.shops;
DROP POLICY IF EXISTS "super_admins_update_shops" ON public.shops;

-- Login: user can read own admin row (no recursion)
CREATE POLICY "super_admins_select_own" ON public.super_admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Full manage via SECURITY DEFINER helper (avoids RLS recursion)
CREATE POLICY "super_admins_manage_via_fn" ON public.super_admins
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "super_admins_select_audit" ON public.super_admin_audit_log
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "super_admins_insert_audit" ON public.super_admin_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "super_admins_select_shops" ON public.shops
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "super_admins_update_shops" ON public.shops
  FOR UPDATE TO authenticated
  USING (public.has_admin_permission('manage_shops'))
  WITH CHECK (public.has_admin_permission('manage_shops'));

-- Limit overrides: admins all; members read own shop
DROP POLICY IF EXISTS "super_admins_manage_limit_overrides" ON public.shop_limit_overrides;
DROP POLICY IF EXISTS "members_read_limit_overrides" ON public.shop_limit_overrides;
CREATE POLICY "super_admins_manage_limit_overrides" ON public.shop_limit_overrides
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
CREATE POLICY "members_read_limit_overrides" ON public.shop_limit_overrides
  FOR SELECT TO authenticated
  USING (public.is_shop_member(shop_id));

DROP POLICY IF EXISTS "super_admins_manage_feature_overrides" ON public.shop_feature_overrides;
DROP POLICY IF EXISTS "members_read_feature_overrides" ON public.shop_feature_overrides;
CREATE POLICY "super_admins_manage_feature_overrides" ON public.shop_feature_overrides
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
CREATE POLICY "members_read_feature_overrides" ON public.shop_feature_overrides
  FOR SELECT TO authenticated
  USING (public.is_shop_member(shop_id));

DROP POLICY IF EXISTS "authenticated_read_feature_flags" ON public.feature_flags;
DROP POLICY IF EXISTS "super_admins_manage_feature_flags" ON public.feature_flags;
CREATE POLICY "authenticated_read_feature_flags" ON public.feature_flags
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "super_admins_manage_feature_flags" ON public.feature_flags
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "super_admins_manage_announcements" ON public.platform_announcements;
DROP POLICY IF EXISTS "members_read_published_announcements" ON public.platform_announcements;
CREATE POLICY "super_admins_manage_announcements" ON public.platform_announcements
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
CREATE POLICY "members_read_published_announcements" ON public.platform_announcements
  FOR SELECT TO authenticated
  USING (is_published = true AND (expires_at IS NULL OR expires_at > NOW()));

DROP POLICY IF EXISTS "super_admins_manage_suspensions" ON public.shop_suspensions;
CREATE POLICY "super_admins_manage_suspensions" ON public.shop_suspensions
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "super_admins_manage_health" ON public.system_health_snapshots;
CREATE POLICY "super_admins_manage_health" ON public.system_health_snapshots
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "super_admins_manage_announcement_views" ON public.announcement_views;
DROP POLICY IF EXISTS "members_own_announcement_views" ON public.announcement_views;
CREATE POLICY "super_admins_manage_announcement_views" ON public.announcement_views
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
CREATE POLICY "members_own_announcement_views" ON public.announcement_views
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE public.super_admins IS 'Platform super-admins; RLS on; is_super_admin() is SECURITY DEFINER';
