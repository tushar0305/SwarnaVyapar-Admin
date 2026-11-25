-- One-row-per-shop activation counts for the admin control plane.
-- Service-role / super-admin only. No PII in the result.

CREATE OR REPLACE FUNCTION public.admin_shop_activation_counts()
RETURNS TABLE (
  shop_id uuid,
  invoices bigint,
  customers bigint,
  inventory bigint,
  staff bigint,
  schemes bigint,
  loans bigint,
  khata bigint,
  whatsapp_connected boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    (SELECT count(*) FROM invoices i WHERE i.shop_id = s.id AND i.deleted_at IS NULL),
    (SELECT count(*) FROM customers c WHERE c.shop_id = s.id AND c.deleted_at IS NULL),
    (SELECT count(*) FROM inventory_items inv WHERE inv.shop_id = s.id AND inv.deleted_at IS NULL),
    (SELECT count(*) FROM user_shop_roles r WHERE r.shop_id = s.id AND r.is_active = true),
    (SELECT count(*) FROM schemes sch WHERE sch.shop_id = s.id),
    (SELECT count(*) FROM loans l WHERE l.shop_id = s.id),
    (SELECT count(*) FROM khatabook_contacts k WHERE k.shop_id = s.id AND k.deleted_at IS NULL),
    EXISTS (
      SELECT 1 FROM whatsapp_configs w
      WHERE w.shop_id = s.id
        AND (w.status = 'connected' OR w.onboarding_status = 'connected')
    )
  FROM shops s;
$$;

REVOKE ALL ON FUNCTION public.admin_shop_activation_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_shop_activation_counts() TO service_role;

CREATE OR REPLACE FUNCTION public.update_shop_health_score(shop_uuid uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  health numeric;
BEGIN
  SELECT
    CASE
      WHEN s.is_suspended THEN 0
      WHEN NOT EXISTS (
        SELECT 1 FROM invoices i WHERE i.shop_id = s.id AND i.deleted_at IS NULL
      ) THEN 0.25
      WHEN COALESCE(s.last_activity_at, s.created_at) < now() - interval '14 days' THEN 0.50
      ELSE 0.85
    END
  INTO health
  FROM shops s
  WHERE s.id = shop_uuid;

  IF health IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE shops SET health_score = health WHERE id = shop_uuid;
  RETURN health;
END;
$$;
