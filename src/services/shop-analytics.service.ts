'use server';

import { getServiceRoleClient } from '@/lib/supabase/admin';
import { requireSuperAdmin } from './admin-auth.service';
import { planMonthlyPrice } from '@/lib/plan-prices';
import { getActivationSnapshot } from './onboarding.service';
import { classifyShopHealth, type ShopHealthCounts } from '@/lib/shop-health';

async function countRows(
  table: string,
  filters?: { shopId?: string; softDelete?: boolean; activeOnly?: boolean }
): Promise<number> {
  const supabase = getServiceRoleClient();
  let q = supabase.from(table).select('id', { count: 'exact', head: true });
  if (filters?.shopId) q = q.eq('shop_id', filters.shopId);
  if (filters?.softDelete) q = q.is('deleted_at', null);
  if (filters?.activeOnly) q = q.eq('is_active', true);
  const { count, error } = await q;
  if (error) return 0;
  return count || 0;
}

export async function getShopAnalytics(shopId: string) {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();

  const { data: shop } = await supabase
    .from('shops')
    .select('id, shop_name, is_suspended, last_activity_at, created_at, gst_number')
    .eq('id', shopId)
    .single();

  if (!shop) throw new Error('Shop not found');

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan_id, status')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const [
    invoicesCount,
    customersCount,
    inventoryCount,
    activeUsers,
    schemesCount,
    loansCount,
    khataCount,
    wa,
  ] = await Promise.all([
    countRows('invoices', { shopId, softDelete: true }),
    countRows('customers', { shopId, softDelete: true }),
    countRows('inventory_items', { shopId, softDelete: true }),
    countRows('user_shop_roles', { shopId, activeOnly: true }),
    countRows('schemes', { shopId }),
    countRows('loans', { shopId }),
    countRows('khatabook_contacts', { shopId, softDelete: true }),
    supabase
      .from('whatsapp_configs')
      .select('status, onboarding_status')
      .eq('shop_id', shopId)
      .maybeSingle(),
  ]);

  const whatsappConnected =
    wa.data?.status === 'connected' || wa.data?.onboarding_status === 'connected';

  const counts: ShopHealthCounts = {
    invoices: invoicesCount,
    customers: customersCount,
    inventory: inventoryCount,
    staff: activeUsers,
    schemes: schemesCount,
    loans: loansCount,
    khata: khataCount,
    whatsappConnected,
    hasGst: Boolean(shop.gst_number?.trim()),
    planId: subscription?.plan_id ?? null,
    lastActivityAt: shop.last_activity_at,
    createdAt: shop.created_at,
    isSuspended: Boolean(shop.is_suspended),
  };
  const health = classifyShopHealth(counts);
  const monthly = planMonthlyPrice(subscription?.plan_id);

  return {
    shopId: shop.id,
    shopName: shop.shop_name,
    revenue: { total: monthly, monthly, growth: 0 },
    usage: {
      invoicesCount,
      customersCount,
      productsCount: inventoryCount,
      activeUsers,
      schemesCount,
      loansCount,
      khataCount,
      whatsappConnected,
    },
    health: {
      score: health.score,
      status:
        shop.is_suspended || health.primary === 'never_started'
          ? ('churned' as const)
          : health.primary === 'quiet' || health.primary === 'stalled_billing'
            ? ('at-risk' as const)
            : ('healthy' as const),
      churnProbability: Math.max(0, (100 - health.score) / 100),
      cohort: health.primary,
      tags: health.tags,
    },
    featureAdoption: {
      invoices: { enabled: invoicesCount > 0 },
      inventory: { enabled: inventoryCount > 0 },
      customers: { enabled: customersCount > 0 },
      schemes: { enabled: schemesCount > 0 },
      loans: { enabled: loansCount > 0 },
      khata: { enabled: khataCount > 0 },
      whatsapp: { enabled: whatsappConnected },
    },
    subscription,
  };
}

export async function getShopActivityLogs(shopId: string, limit = 20) {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, action, entity_type, entity_id, created_at')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data || []).map((log) => ({
    id: log.id,
    action: log.action,
    description: [log.entity_type, log.entity_id].filter(Boolean).join(' '),
    created_at: log.created_at,
  }));
}

export async function getFeatureAdoptionRates() {
  const snap = await getActivationSnapshot();
  const n = snap.shops.length || 1;
  const used = (fn: (s: (typeof snap.shops)[0]) => boolean) =>
    Math.round((snap.shops.filter(fn).length / n) * 100);
  return {
    invoices: used((s) => s.counts.invoices > 0),
    inventory: used((s) => s.counts.inventory > 0),
    customers: used((s) => s.counts.customers > 0),
    whatsapp: used((s) => s.counts.whatsappConnected),
    schemes: used((s) => s.counts.schemes > 0),
    loans: used((s) => s.counts.loans > 0),
  };
}

export async function getRevenueMetrics() {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();

  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('plan_id, status')
    .eq('status', 'active');

  const activeSubscriptions = subscriptions?.length || 0;
  const mrr =
    subscriptions?.reduce((sum, s) => sum + planMonthlyPrice(s.plan_id), 0) || 0;

  return {
    totalRevenue: mrr,
    activeSubscriptions,
    mrr,
    currency: '₹',
    avgRevenuePerShop: activeSubscriptions > 0 ? mrr / activeSubscriptions : 0,
  };
}

export async function getUsageMetrics() {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();

  const [
    totalInvoices,
    totalCustomers,
    totalInventory,
    totalUsers,
    shopCount,
    usageRows,
  ] = await Promise.all([
    countRows('invoices', { softDelete: true }),
    countRows('customers', { softDelete: true }),
    countRows('inventory_items', { softDelete: true }),
    countRows('user_shop_roles'),
    countRows('shops'),
    supabase
      .from('shop_usage_limits')
      .select(
        'shop_id, invoices_created, customers_added, staff_seats_occupied, ai_tokens_used, period_start'
      )
      .order('period_start', { ascending: false })
      .limit(200),
  ]);

  const usage = usageRows.data || [];
  return {
    totalInvoices,
    totalCustomers,
    totalProducts: totalInventory,
    totalInventory,
    totalUsers,
    shopCount,
    periodInvoices: usage.reduce((s, r) => s + (r.invoices_created || 0), 0),
    periodCustomers: usage.reduce((s, r) => s + (r.customers_added || 0), 0),
    periodAiTokens: usage.reduce((s, r) => s + Number(r.ai_tokens_used || 0), 0),
    avgInvoicesPerShop:
      shopCount > 0 ? Math.round(totalInvoices / shopCount) : 0,
    avgCustomersPerShop:
      shopCount > 0 ? Math.round(totalCustomers / shopCount) : 0,
  };
}

export async function getChurnPredictions() {
  const snap = await getActivationSnapshot();
  return snap.shops
    .map((row) => ({
      shopId: row.shopId,
      shopName: row.shopName,
      churnProbability: Math.max(0, (100 - row.score) / 100),
      status:
        row.primary === 'activated'
          ? 'healthy'
          : row.primary === 'never_started'
            ? 'churned'
            : 'at-risk',
      healthScore: row.score,
    }))
    .sort((a, b) => b.churnProbability - a.churnProbability);
}
