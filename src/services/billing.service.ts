'use server';

import { revalidatePath } from 'next/cache';
import { getServiceRoleClient } from '@/lib/supabase/admin';
import {
  requireSuperAdmin,
  requireAdminPermission,
  logAdminAction,
  assertAnyAdminPermission,
} from './admin-auth.service';
import { planMonthlyPrice } from '@/lib/plan-prices';
import { amountFromPayload, classifyBillingEvent } from '@/lib/billing-events';

export type BillingEventRow = {
  id: string;
  shop_id: string;
  razorpay_subscription_id: string | null;
  razorpay_payment_id: string | null;
  event_type: string;
  source: string;
  payload: Record<string, unknown> | null;
  created_at: string;
  shop?: { id: string; shop_name: string; email: string | null } | null;
};

/**
 * Payment/billing timeline from Razorpay webhooks (real table: billing_events).
 * RLS is service-only — always use service role after requireSuperAdmin().
 */
export async function getAllPaymentHistory(filters?: {
  eventType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<BillingEventRow[]> {
  await requireAdminPermission('view_analytics');
  const supabase = getServiceRoleClient();

  let query = supabase
    .from('billing_events')
    .select(
      `
      id,
      shop_id,
      razorpay_subscription_id,
      razorpay_payment_id,
      event_type,
      source,
      payload,
      created_at,
      shop:shops(id, shop_name, email)
    `
    )
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(filters?.limit ?? 100, 1), 500));

  if (filters?.eventType) query = query.eq('event_type', filters.eventType);
  if (filters?.startDate) query = query.gte('created_at', filters.startDate);
  if (filters?.endDate) query = query.lte('created_at', filters.endDate);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => ({
    ...row,
    shop: Array.isArray(row.shop) ? (row.shop[0] ?? null) : row.shop,
  })) as BillingEventRow[];
}

export async function getShopPaymentHistory(shopId: string) {
  await requireAdminPermission('view_analytics');
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase
    .from('billing_events')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return data || [];
}

/**
 * Platform billing KPIs from subscriptions + billing_events.
 */
export async function getBillingStatistics() {
  await requireAdminPermission('view_analytics');
  const supabase = getServiceRoleClient();

  const [subsResult, eventsResult] = await Promise.all([
    supabase.from('subscriptions').select('plan_id, status'),
    supabase
      .from('billing_events')
      .select('event_type, payload, created_at')
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  const subscriptions = subsResult.data || [];
  const events = eventsResult.data || [];

  const active = subscriptions.filter((s) => s.status === 'active');
  const mrr = active.reduce((sum, s) => sum + planMonthlyPrice(s.plan_id), 0);

  const classified = events.map((e) => ({
    kind: classifyBillingEvent(e.event_type),
    amount: amountFromPayload(e.payload as Record<string, unknown> | null),
  }));

  const payments = classified.filter((e) => e.kind === 'payment');
  const refunds = events.filter((e) => /refund/i.test(e.event_type));
  const failed = classified.filter((e) => e.kind === 'failed');
  const abandoned = classified.filter((e) => e.kind === 'abandoned');
  const canceled = classified.filter((e) => e.kind === 'canceled');

  const capturedVolume = payments.reduce((sum, e) => sum + (e.amount ?? 0), 0);
  const totalRefunds = refunds.reduce(
    (sum, e) => sum + (amountFromPayload(e.payload as Record<string, unknown> | null) ?? 0),
    0
  );

  return {
    capturedVolume,
    capturedPaymentCount: payments.length,
    totalRevenue: capturedVolume,
    totalRefunds,
    netRevenue: capturedVolume - totalRefunds,
    activeSubscriptions: active.length,
    mrr,
    avgRevenuePerSubscription: active.length > 0 ? mrr / active.length : 0,
    failedPayments: failed.length,
    abandonedCheckouts: abandoned.length,
    canceledSignals: canceled.length,
    followUpCount: failed.length + abandoned.length + canceled.length,
    lifecycleEventCount: classified.filter((e) => e.kind === 'lifecycle').length,
    eventCount: events.length,
    hasCapturedPayments: payments.length > 0,
  };
}

function endOfDayIst(dateYmd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
    throw new Error('Pick a valid applicable-until date');
  }
  const end = new Date(`${dateYmd}T23:59:59.999+05:30`);
  if (Number.isNaN(end.getTime())) throw new Error('Pick a valid applicable-until date');
  const startOfTodayIst = new Date(
    new Date().toLocaleString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 10) +
      'T00:00:00.000+05:30'
  );
  if (end < startOfTodayIst) throw new Error('Applicable until must be today or later');
  return end.toISOString();
}

/** Local plan override. Does not call Razorpay. Inserts a row when the shop has none. */
export async function setShopPlan(input: {
  shopId: string;
  planId: 'free' | 'pro' | 'business';
  status?: 'active' | 'past_due' | 'canceled' | 'trialing' | 'unpaid';
  applicableUntil?: string | null;
  reason: string;
}) {
  const admin = await assertAnyAdminPermission(['manage_shops', 'system_settings']);
  if (!input.reason.trim()) throw new Error('A reason is required');

  const supabase = getServiceRoleClient();
  const now = new Date().toISOString();
  const status = input.status ?? 'active';
  const periodEnd = input.applicableUntil?.trim()
    ? endOfDayIst(input.applicableUntil.trim())
    : null;
  const patch = {
    plan_id: input.planId,
    status,
    current_period_end: periodEnd,
    updated_at: now,
  };

  const { data: existing, error: readError } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('shop_id', input.shopId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readError) throw readError;

  let id = existing?.id as string | undefined;
  if (id) {
    const { error } = await supabase.from('subscriptions').update(patch).eq('id', id);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from('subscriptions')
      .insert({
        shop_id: input.shopId,
        ...patch,
        current_period_start: now,
      })
      .select('id')
      .single();
    if (error) throw error;
    id = data.id;
  }

  await logAdminAction(
    'subscription_plan_set',
    'subscription',
    id ?? input.shopId,
    { shopId: input.shopId, planId: input.planId, status, applicableUntil: periodEnd },
    input.reason.trim()
  );

  revalidatePath('/subscriptions');
  revalidatePath('/overview');
  revalidatePath(`/shops/${input.shopId}`);
  return { id };
}
