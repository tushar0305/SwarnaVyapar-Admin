'use server';

import { getServiceRoleClient } from '@/lib/supabase/admin';
import { requireAdminPermission } from './admin-auth.service';

export async function getShopGrowth() {
  await requireAdminPermission('view_analytics');
  const supabase = getServiceRoleClient();

  const { data: shops } = await supabase
    .from('shops')
    .select('created_at')
    .order('created_at', { ascending: true });

  const monthlyGrowth = new Map<string, number>();
  shops?.forEach((shop) => {
    const month = new Date(shop.created_at).toISOString().slice(0, 7);
    monthlyGrowth.set(month, (monthlyGrowth.get(month) || 0) + 1);
  });

  return Array.from(monthlyGrowth.entries()).map(([month, count]) => ({
    month,
    count,
  }));
}

export async function getUserActivityMetrics() {
  await requireAdminPermission('view_analytics');
  const supabase = getServiceRoleClient();

  const [rolesResult, activeRoles, shopsResult] = await Promise.all([
    supabase.from('user_shop_roles').select('id', { count: 'exact', head: true }),
    supabase
      .from('user_shop_roles')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase.from('shops').select('id', { count: 'exact', head: true }),
  ]);

  const totalUserRoles = rolesResult.count || 0;
  const activeUserRoles = activeRoles.count || 0;
  const totalShops = shopsResult.count || 0;

  return {
    totalUserRoles,
    activeUserRoles,
    inactiveUserRoles: totalUserRoles - activeUserRoles,
    avgUsersPerShop:
      totalShops > 0
        ? Math.round((totalUserRoles / totalShops) * 10) / 10
        : 0,
  };
}

export async function getSubscriptionDistribution() {
  await requireAdminPermission('view_analytics');
  const supabase = getServiceRoleClient();

  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('status, plan_id');

  const byStatus = new Map<string, number>();
  const byPlan = new Map<string, number>();

  subscriptions?.forEach((sub) => {
    byStatus.set(sub.status || 'unknown', (byStatus.get(sub.status) || 0) + 1);
    byPlan.set(sub.plan_id || 'unknown', (byPlan.get(sub.plan_id) || 0) + 1);
  });

  return {
    byStatus: Array.from(byStatus.entries()).map(([status, count]) => ({
      status,
      count,
    })),
    byPlan: Array.from(byPlan.entries()).map(([plan, count]) => ({
      plan,
      count,
    })),
  };
}

export async function getPlatformStats() {
  await requireAdminPermission('view_analytics');
  const supabase = getServiceRoleClient();

  const [shopsResult, userRolesResult, auditsResult, flagsResult] =
    await Promise.all([
      supabase.from('shops').select('id, is_suspended', { count: 'exact' }),
      supabase.from('user_shop_roles').select('id', { count: 'exact' }),
      supabase.from('super_admin_audit_log').select('id', { count: 'exact' }),
      supabase.from('feature_flags').select('id, is_enabled_globally'),
    ]);

  const shops = shopsResult.data || [];
  const flags = flagsResult.data || [];

  return {
    totalShops: shopsResult.count || 0,
    activeShops: shops.filter((s) => !s.is_suspended).length,
    suspendedShops: shops.filter((s) => s.is_suspended).length,
    totalUsers: userRolesResult.count || 0,
    totalAuditLogs: auditsResult.count || 0,
    totalFeatureFlags: flags.length,
    enabledFeatureFlags: flags.filter((f) => f.is_enabled_globally).length,
  };
}

export async function getRecentActivity() {
  await requireAdminPermission('view_analytics');
  const supabase = getServiceRoleClient();

  const [{ data: recentShops }, { data: recentAudits }] = await Promise.all([
    supabase
      .from('shops')
      .select('id, shop_name, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('super_admin_audit_log')
      .select('id, action, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  return {
    recentShops: recentShops || [],
    recentActions: recentAudits || [],
  };
}
