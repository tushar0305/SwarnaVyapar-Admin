'use server';

import { getServiceRoleClient } from '@/lib/supabase/admin';
import { requireSuperAdmin } from './admin-auth.service';

interface DatabaseHealthMetrics {
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  lastChecked: string;
}

interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down';
  latency?: number;
}

export async function getDatabaseHealth(): Promise<DatabaseHealthMetrics> {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();
  const startTime = Date.now();

  try {
    const { error } = await supabase.from('shops').select('id').limit(1);
    const latency = Date.now() - startTime;
    if (error) throw error;

    return {
      status: latency < 100 ? 'healthy' : latency < 500 ? 'degraded' : 'down',
      latency,
      lastChecked: new Date().toISOString(),
    };
  } catch {
    return {
      status: 'down',
      latency: Date.now() - startTime,
      lastChecked: new Date().toISOString(),
    };
  }
}

export async function getServiceStatuses(): Promise<ServiceStatus[]> {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();
  const services: ServiceStatus[] = [];

  const dbHealth = await getDatabaseHealth();
  services.push({
    name: 'Database',
    status:
      dbHealth.status === 'healthy'
        ? 'operational'
        : dbHealth.status === 'degraded'
          ? 'degraded'
          : 'down',
    latency: dbHealth.latency,
  });

  try {
    const startTime = Date.now();
    const { error } = await supabase.from('super_admins').select('id').limit(1);
    const latency = Date.now() - startTime;
    services.push({
      name: 'Admin auth tables',
      status: error ? 'down' : latency < 200 ? 'operational' : 'degraded',
      latency,
    });
  } catch {
    services.push({
      name: 'Admin auth tables',
      status: 'down',
      latency: 0,
    });
  }

  try {
    const startTime = Date.now();
    const { error } = await supabase
      .from('subscriptions')
      .select('id')
      .limit(1);
    const latency = Date.now() - startTime;
    services.push({
      name: 'Subscriptions',
      status: error ? 'down' : latency < 300 ? 'operational' : 'degraded',
      latency,
    });
  } catch {
    services.push({
      name: 'Subscriptions',
      status: 'down',
      latency: 0,
    });
  }

  try {
    const startTime = Date.now();
    const { error } = await supabase
      .from('billing_events')
      .select('id')
      .limit(1);
    const latency = Date.now() - startTime;
    services.push({
      name: 'Billing events',
      status: error ? 'down' : latency < 300 ? 'operational' : 'degraded',
      latency,
    });
  } catch {
    services.push({
      name: 'Billing events',
      status: 'down',
      latency: 0,
    });
  }

  return services;
}

/** Columns match migration: snapshot_at, total_shops, active_shops, … */
export async function getHealthSnapshots(limit = 20) {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase
    .from('system_health_snapshots')
    .select(
      'id, total_shops, active_shops, suspended_shops, total_users, active_users_24h, total_invoices_today, gmv_30d, error_rate, avg_response_time_ms, snapshot_at'
    )
    .order('snapshot_at', { ascending: false })
    .limit(limit);

  if (error) {
    // Table empty / RLS — don't crash the page
    console.error('getHealthSnapshots:', error.message);
    return [];
  }
  return data || [];
}

export async function createHealthSnapshot() {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();
  const dbHealth = await getDatabaseHealth();

  const [{ count: shopCount }, { count: suspendedCount }, { count: userCount }] =
    await Promise.all([
      supabase.from('shops').select('id', { count: 'exact', head: true }),
      supabase
        .from('shops')
        .select('id', { count: 'exact', head: true })
        .eq('is_suspended', true),
      supabase
        .from('user_shop_roles')
        .select('id', { count: 'exact', head: true }),
    ]);

  const { error } = await supabase.from('system_health_snapshots').insert({
    total_shops: shopCount || 0,
    active_shops: (shopCount || 0) - (suspendedCount || 0),
    suspended_shops: suspendedCount || 0,
    total_users: userCount || 0,
    active_users_24h: 0,
    total_invoices_today: 0,
    gmv_30d: 0,
    error_rate: 0,
    avg_response_time_ms: dbHealth.latency,
    snapshot_at: new Date().toISOString(),
  });

  if (error) throw error;
}

export async function getErrorRateMetrics() {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();

  const { data: auditLogs } = await supabase
    .from('super_admin_audit_log')
    .select('action, created_at')
    .gte(
      'created_at',
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    )
    .order('created_at', { ascending: false });

  const totalActions = auditLogs?.length || 0;
  const errorActions =
    auditLogs?.filter(
      (log) =>
        log.action.includes('error') || log.action.includes('failed')
    ).length || 0;

  return {
    totalActions,
    errorActions,
    errorRate: totalActions > 0 ? (errorActions / totalActions) * 100 : 0,
    period: '24h',
  };
}
