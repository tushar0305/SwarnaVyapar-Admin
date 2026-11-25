-- ============================================
-- SEED DATA FOR SWARNAVYAPAR ADMIN
-- Optional: Run after 001_admin_infrastructure.sql
-- ============================================

-- ============================================
-- SAMPLE FEATURE FLAGS
-- ============================================
-- These are examples - customize based on your needs

INSERT INTO feature_flags (feature_key, name, description, is_enabled_globally, rollout_percentage) VALUES
  -- Core Features
  ('advanced_reports', 'Advanced Reports', 'Access to advanced analytics and custom reports with exports', false, 0),
  ('ai_assistant', 'AI Business Assistant', 'AI-powered business insights, recommendations, and chat support', false, 0),
  ('whatsapp_marketing', 'WhatsApp Marketing', 'WhatsApp campaign management and customer automation', false, 0),
  
  -- Inventory Features
  ('inventory_transfers', 'Inventory Transfers', 'Inter-branch inventory transfer and tracking', false, 0),
  ('purchase_orders', 'Purchase Orders', 'Purchase order and GRN (Goods Receipt Note) management', false, 0),
  ('barcode_scanning', 'Barcode Scanning', 'Mobile barcode scanning for inventory', false, 0),
  
  -- Business Features
  ('multi_location', 'Multi-Location Support', 'Manage multiple shop locations from single account', false, 0),
  ('advanced_schemes', 'Advanced Schemes', 'Enhanced gold savings scheme features with flexible plans', false, 0),
  ('loan_management', 'Gold Loan Management', 'Gold loan tracking and repayment management', false, 0),
  
  -- Technical Features
  ('bulk_operations', 'Bulk Operations', 'Bulk import/export and mass data operations', false, 10),
  ('api_access', 'API Access', 'REST API access for third-party integrations', false, 0),
  ('custom_fields', 'Custom Fields', 'User-defined custom fields for invoices and customers', false, 0),
  ('webhooks', 'Webhooks', 'Real-time webhook notifications for events', false, 0),
  
  -- Beta Features
  ('dark_mode', 'Dark Mode', 'Dark theme UI option', false, 50),
  ('mobile_app', 'Mobile App Access', 'Native mobile app (Android/iOS) access', false, 0)
ON CONFLICT (feature_key) DO NOTHING;

-- ============================================
-- SAMPLE PLATFORM ANNOUNCEMENT
-- ============================================

INSERT INTO platform_announcements (
  title,
  message,
  type,
  target_audience,
  is_published,
  published_at,
  expires_at,
  created_by
) VALUES (
  'Welcome to SwarnaVyapar Admin',
  'You have successfully set up the admin control panel. Start by managing shops, users, and feature flags.',
  'info',
  'all',
  true,
  NOW(),
  NOW() + INTERVAL '30 days',
  (SELECT id FROM super_admins LIMIT 1)
);

-- ============================================
-- SYSTEM HEALTH BASELINE
-- ============================================

-- Create first health snapshot
SELECT capture_system_health_snapshot();

-- ============================================
-- HELPFUL QUERIES FOR ADMINS
-- ============================================

-- View all super admins
-- SELECT * FROM super_admins WHERE is_active = true;

-- View recent audit log
-- SELECT 
--   al.*,
--   sa.name as admin_name,
--   sa.email as admin_email
-- FROM super_admin_audit_log al
-- JOIN super_admins sa ON al.admin_id = sa.id
-- ORDER BY al.created_at DESC
-- LIMIT 20;

-- View all feature flags and their status
-- SELECT * FROM feature_flags ORDER BY name;

-- View shops with custom limit overrides
-- SELECT 
--   s.name as shop_name,
--   slo.limit_key,
--   slo.override_value,
--   slo.reason,
--   slo.expires_at
-- FROM shop_limit_overrides slo
-- JOIN shops s ON slo.shop_id = s.id
-- WHERE slo.is_temporary = false OR slo.expires_at > NOW()
-- ORDER BY s.name;

-- View suspended shops
-- SELECT 
--   s.name,
--   s.suspension_reason,
--   s.suspended_at,
--   sa.name as suspended_by
-- FROM shops s
-- LEFT JOIN super_admins sa ON s.suspended_by = sa.id
-- WHERE s.is_suspended = true
-- ORDER BY s.suspended_at DESC;

COMMENT ON SCHEMA public IS 'SwarnaVyapar Admin Infrastructure - Seeded';
