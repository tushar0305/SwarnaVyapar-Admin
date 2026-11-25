-- ============================================
-- SWARNAVYAPAR ADMIN CONTROL SYSTEM
-- Migration: Super Admin Infrastructure
-- Date: 2026-06-24
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SUPER ADMIN TABLES
-- ============================================

-- Super admin users table
CREATE TABLE IF NOT EXISTS super_admins (
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
  created_by UUID REFERENCES super_admins(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Super admin audit log
CREATE TABLE IF NOT EXISTS super_admin_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES super_admins(id) NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  changes JSONB,
  reason TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON super_admin_audit_log(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON super_admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON super_admin_audit_log(action, created_at DESC);

-- ============================================
-- SHOP CONTROL ENHANCEMENTS
-- ============================================

-- Add admin control fields to shops table
ALTER TABLE shops ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES super_admins(id);
ALTER TABLE shops ADD COLUMN IF NOT EXISTS health_score NUMERIC(3,2) DEFAULT 1.0;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();

-- Shop suspension history
CREATE TABLE IF NOT EXISTS shop_suspensions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES shops NOT NULL,
  suspended_by UUID REFERENCES super_admins(id) NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  suspended_at TIMESTAMPTZ DEFAULT NOW(),
  unsuspended_at TIMESTAMPTZ,
  unsuspended_by UUID REFERENCES super_admins(id)
);

CREATE INDEX IF NOT EXISTS idx_shop_suspensions_shop ON shop_suspensions(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_suspensions_date ON shop_suspensions(suspended_at DESC);

-- ============================================
-- LIMIT OVERRIDES
-- ============================================

CREATE TABLE IF NOT EXISTS shop_limit_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES shops NOT NULL,
  limit_key TEXT NOT NULL,
  override_value INTEGER NOT NULL,
  reason TEXT NOT NULL,
  is_temporary BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES super_admins(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, limit_key)
);

CREATE INDEX IF NOT EXISTS idx_limit_overrides_shop ON shop_limit_overrides(shop_id);
CREATE INDEX IF NOT EXISTS idx_limit_overrides_expires ON shop_limit_overrides(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================
-- FEATURE FLAGS
-- ============================================

CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feature_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_enabled_globally BOOLEAN DEFAULT false,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shop_feature_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES shops NOT NULL,
  feature_key TEXT REFERENCES feature_flags(feature_key) NOT NULL,
  is_enabled BOOLEAN NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES super_admins(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(shop_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_feature_overrides_shop ON shop_feature_overrides(shop_id);
CREATE INDEX IF NOT EXISTS idx_feature_overrides_key ON shop_feature_overrides(feature_key);

-- ============================================
-- PLATFORM ANNOUNCEMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS platform_announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('info', 'warning', 'critical', 'maintenance')),
  target_audience TEXT DEFAULT 'all',
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES super_admins(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_published ON platform_announcements(is_published, published_at, expires_at);

CREATE TABLE IF NOT EXISTS announcement_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  announcement_id UUID REFERENCES platform_announcements NOT NULL,
  shop_id UUID REFERENCES shops,
  user_id UUID REFERENCES auth.users,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcement_views_announcement ON announcement_views(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_views_shop ON announcement_views(shop_id);

-- ============================================
-- SYSTEM HEALTH METRICS
-- ============================================

CREATE TABLE IF NOT EXISTS system_health_snapshots (
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

CREATE INDEX IF NOT EXISTS idx_health_snapshots_date ON system_health_snapshots(snapshot_at DESC);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS on admin tables
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_limit_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_feature_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_announcements ENABLE ROW LEVEL SECURITY;

-- Super admins can view all shops (add to existing shops policies)
DROP POLICY IF EXISTS "super_admins_view_all_shops" ON shops;
CREATE POLICY "super_admins_view_all_shops" ON shops
  FOR SELECT
  USING (
    auth.uid() IN (SELECT user_id FROM super_admins WHERE is_active = true)
  );

-- Super admins can update shops
DROP POLICY IF EXISTS "super_admins_update_shops" ON shops;
CREATE POLICY "super_admins_update_shops" ON shops
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM super_admins 
      WHERE is_active = true 
      AND (permissions->>'manage_shops')::boolean = true
    )
  );

-- Super admins can manage admin records
DROP POLICY IF EXISTS "super_admins_manage_admins" ON super_admins;
CREATE POLICY "super_admins_manage_admins" ON super_admins
  FOR ALL
  USING (
    auth.uid() IN (SELECT user_id FROM super_admins WHERE is_active = true)
  );

-- Super admins can view audit logs
DROP POLICY IF EXISTS "super_admins_view_audit_log" ON super_admin_audit_log;
CREATE POLICY "super_admins_view_audit_log" ON super_admin_audit_log
  FOR SELECT
  USING (
    auth.uid() IN (SELECT user_id FROM super_admins WHERE is_active = true)
  );

-- Super admins can insert audit logs
DROP POLICY IF EXISTS "super_admins_insert_audit_log" ON super_admin_audit_log;
CREATE POLICY "super_admins_insert_audit_log" ON super_admin_audit_log
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM super_admins WHERE is_active = true)
  );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM super_admins
    WHERE user_id = user_uuid AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check specific admin permission
CREATE OR REPLACE FUNCTION has_admin_permission(permission_key TEXT, user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM super_admins
    WHERE user_id = user_uuid 
      AND is_active = true
      AND (permissions->>permission_key)::boolean = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update shop health score
CREATE OR REPLACE FUNCTION update_shop_health_score(shop_uuid UUID)
RETURNS NUMERIC AS $$
DECLARE
  health NUMERIC;
BEGIN
  -- Calculate health score based on:
  -- - Recent activity
  -- - Error rate
  -- - Payment status
  -- - User engagement
  
  WITH metrics AS (
    SELECT
      CASE 
        WHEN s.last_activity_at > NOW() - INTERVAL '7 days' THEN 0.4
        WHEN s.last_activity_at > NOW() - INTERVAL '30 days' THEN 0.2
        ELSE 0
      END as activity_score,
      CASE
        WHEN s.is_suspended THEN 0
        ELSE 0.3
      END as suspension_score,
      0.3 as engagement_score -- Placeholder
    FROM shops s
    WHERE s.id = shop_uuid
  )
  SELECT 
    activity_score + suspension_score + engagement_score
  INTO health
  FROM metrics;
  
  UPDATE shops SET health_score = health WHERE id = shop_uuid;
  
  RETURN health;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SEED DATA
-- ============================================

-- Insert initial feature flags
INSERT INTO feature_flags (feature_key, name, description, is_enabled_globally, rollout_percentage) VALUES
  ('advanced_reports', 'Advanced Reports', 'Access to advanced analytics and custom reports', false, 0),
  ('ai_assistant', 'AI Assistant', 'AI-powered business insights and recommendations', false, 0),
  ('whatsapp_marketing', 'WhatsApp Marketing', 'WhatsApp campaign management and automation', false, 0),
  ('inventory_transfers', 'Inventory Transfers', 'Inter-branch inventory transfer management', false, 0),
  ('purchase_orders', 'Purchase Orders', 'Purchase order and GRN management', false, 0),
  ('multi_location', 'Multi-Location', 'Multiple shop locations management', false, 0),
  ('advanced_schemes', 'Advanced Schemes', 'Advanced gold savings scheme features', false, 0),
  ('bulk_operations', 'Bulk Operations', 'Bulk import/export and mass operations', false, 0)
ON CONFLICT (feature_key) DO NOTHING;

-- ============================================
-- AUTOMATED JOBS (TO BE SCHEDULED)
-- ============================================

-- Function to clean up expired overrides
CREATE OR REPLACE FUNCTION cleanup_expired_overrides()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM shop_limit_overrides
  WHERE is_temporary = true 
    AND expires_at IS NOT NULL 
    AND expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to capture system health snapshot
CREATE OR REPLACE FUNCTION capture_system_health_snapshot()
RETURNS UUID AS $$
DECLARE
  snapshot_id UUID;
BEGIN
  INSERT INTO system_health_snapshots (
    total_shops,
    active_shops,
    suspended_shops,
    total_users,
    active_users_24h,
    total_invoices_today,
    gmv_30d
  )
  SELECT
    COUNT(DISTINCT s.id) as total_shops,
    COUNT(DISTINCT s.id) FILTER (WHERE s.is_suspended = false) as active_shops,
    COUNT(DISTINCT s.id) FILTER (WHERE s.is_suspended = true) as suspended_shops,
    (SELECT COUNT(DISTINCT id) FROM auth.users) as total_users,
    (SELECT COUNT(DISTINCT id) FROM auth.users WHERE last_sign_in_at > NOW() - INTERVAL '24 hours') as active_users_24h,
    COALESCE(COUNT(DISTINCT i.id) FILTER (WHERE i.created_at::date = CURRENT_DATE), 0) as total_invoices_today,
    COALESCE(SUM(i.grand_total) FILTER (WHERE i.created_at > NOW() - INTERVAL '30 days'), 0) as gmv_30d
  FROM shops s
  LEFT JOIN invoices i ON i.shop_id = s.id
  RETURNING id INTO snapshot_id;
  
  RETURN snapshot_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMPLETE
-- ============================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

COMMENT ON TABLE super_admins IS 'Super administrator accounts with platform-wide access';
COMMENT ON TABLE super_admin_audit_log IS 'Audit trail of all super admin actions';
COMMENT ON TABLE shop_limit_overrides IS 'Custom limit overrides per shop';
COMMENT ON TABLE feature_flags IS 'Feature flag definitions for gradual rollouts';
COMMENT ON TABLE platform_announcements IS 'Platform-wide announcements and notifications';
