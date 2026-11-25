'use server';

import { getServiceRoleClient } from '@/lib/supabase/admin';
import {
  requireAdminPermission,
  requireSuperAdmin,
} from './admin-auth.service';

export type TimelineEvent = {
  at: string;
  kind: string;
  title: string;
  detail: string;
};

export type ShopMember = {
  userId: string;
  role: string;
  active: boolean;
  email: string | null;
  lastSignInAt: string | null;
  createdAt: string;
};

export type ShopPulse = {
  planId: string;
  planName: string;
  subscriptionStatus: string;
  gmv30d: number;
  collected30d: number;
  balanceDue: number;
  invoices30d: number;
  availableMc: number;
  heldMc: number;
  frozen: boolean;
  lowCredits: boolean;
};

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** One shop's sales and wallet. Does not load the platform snapshot. */
export async function getShopPulse(shopId: string): Promise<ShopPulse> {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();

  // Prepaid shop_wallets were removed from the product. Pulse still exposes
  // zero credit fields so existing shop UI keeps a stable shape.
  const [subscription, invoices, payments] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('plan_id, status, created_at')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('invoices')
      .select('grand_total, balance_due, invoice_date, status')
      .eq('shop_id', shopId)
      .is('deleted_at', null)
      .neq('status', 'cancelled'),
    supabase
      .from('invoice_payments')
      .select('amount')
      .eq('shop_id', shopId)
      .gte('payment_date', since),
  ]);

  const rows = invoices.data || [];
  const cutoff = since.slice(0, 10);
  let gmv30d = 0;
  let invoices30d = 0;
  let balanceDue = 0;
  for (const row of rows) {
    balanceDue += num(row.balance_due);
    const day = String(row.invoice_date ?? '').slice(0, 10);
    if (day >= cutoff) {
      gmv30d += num(row.grand_total);
      invoices30d += 1;
    }
  }

  const planId = subscription.data?.plan_id ? String(subscription.data.plan_id) : 'none';
  let planName = planId === 'none' ? 'No plan' : planId;
  if (planId !== 'none') {
    const { data: plan } = await supabase
      .from('plans')
      .select('name')
      .eq('id', planId)
      .maybeSingle();
    if (plan?.name) planName = String(plan.name);
  }

  return {
    planId,
    planName,
    subscriptionStatus: subscription.data?.status ? String(subscription.data.status) : 'none',
    gmv30d,
    collected30d: (payments.data || []).reduce((sum, row) => sum + num(row.amount), 0),
    balanceDue,
    invoices30d,
    availableMc: 0,
    heldMc: 0,
    frozen: false,
    lowCredits: false,
  };
}

export async function getShopTimeline(shopId: string, limit = 60): Promise<TimelineEvent[]> {
  await requireSuperAdmin();
  const { data, error } = await getServiceRoleClient().rpc('admin_shop_timeline', {
    p_shop_id: shopId,
    p_limit: limit,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map((row: Record<string, unknown>) => ({
    at: String(row.at ?? ''),
    kind: String(row.kind ?? ''),
    title: String(row.title ?? ''),
    detail: String(row.detail ?? ''),
  }));
}

export async function getShopMembers(shopId: string): Promise<ShopMember[]> {
  await requireSuperAdmin();
  const { data, error } = await getServiceRoleClient().rpc('admin_shop_members', {
    p_shop_id: shopId,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map((row: Record<string, unknown>) => ({
    userId: String(row.userId ?? ''),
    role: String(row.role ?? ''),
    active: Boolean(row.active),
    email: row.email ? String(row.email) : null,
    lastSignInAt: row.lastSignInAt ? String(row.lastSignInAt) : null,
    createdAt: String(row.createdAt ?? ''),
  }));
}

/** Prepaid wallets were removed from the product. Kept so old UI actions fail clearly. */
export async function grantShopCredits(_input: {
  shopId: string;
  credits: number;
  kind: 'promo' | 'paid';
  expiresInDays: number | null;
  reason: string;
  requestId: string;
}): Promise<{ availableMc: number; duplicate: boolean }> {
  await requireAdminPermission('manage_shops');
  throw new Error('Prepaid shop wallets were removed. Meta bills WhatsApp; AI is plan-gated.');
}

export async function setShopWalletFrozen(_input: {
  shopId: string;
  frozen: boolean;
  reason: string;
}): Promise<void> {
  await requireAdminPermission('manage_shops');
  throw new Error('Prepaid shop wallets were removed. There is nothing to freeze.');
}

export async function getRecentJobRuns(limit = 40) {
  await requireSuperAdmin();
  const { data, error } = await getServiceRoleClient()
    .from('cron_job_runs')
    .select('job_name, run_date, status, affected, error, started_at, finished_at')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
