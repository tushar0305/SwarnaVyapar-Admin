'use server';

import { revalidatePath } from 'next/cache';
import { getServiceRoleClient } from '@/lib/supabase/admin';
import { requireSuperAdmin, logAdminAction } from './admin-auth.service';
import { planMonthlyPrice } from '@/lib/plan-prices';

interface SubscriptionFilters {
  shopId?: string;
  status?: string;
  planId?: string;
}

export async function getAllSubscriptions(filters?: SubscriptionFilters) {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();

  let query = supabase
    .from('subscriptions')
    .select(
      `
      id,
      shop_id,
      plan_id,
      status,
      razorpay_subscription_id,
      current_period_start,
      current_period_end,
      cancel_at_period_end,
      created_at,
      updated_at,
      shop:shops(id, shop_name, email)
    `
    )
    .order('created_at', { ascending: false });

  if (filters?.shopId) query = query.eq('shop_id', filters.shopId);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.planId) query = query.eq('plan_id', filters.planId);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => ({
    ...row,
    shop: (Array.isArray(row.shop) ? (row.shop[0] ?? null) : row.shop) as {
      id: string;
      shop_name: string;
      email: string | null;
    } | null,
  }));
}

export async function getSubscriptionById(subscriptionId: string) {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase
    .from('subscriptions')
    .select(
      `
      *,
      shop:shops(id, shop_name, email, phone_number)
    `
    )
    .eq('id', subscriptionId)
    .single();

  if (error) throw error;
  return data;
}

export async function updateSubscription(
  subscriptionId: string,
  updates: {
    plan_id?: 'free' | 'pro' | 'business' | 'enterprise';
    status?: 'active' | 'past_due' | 'canceled' | 'trialing' | 'unpaid';
    cancel_at_period_end?: boolean;
  },
  reason?: string
) {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase
    .from('subscriptions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', subscriptionId)
    .select()
    .single();

  if (error) throw error;

  await logAdminAction(
    'subscription_updated',
    'subscription',
    subscriptionId,
    updates,
    reason || `Updated subscription ${subscriptionId}`
  );

  revalidatePath('/subscriptions');
  if (data?.shop_id) revalidatePath(`/shops/${data.shop_id}`);

  return data;
}

export async function cancelSubscription(
  subscriptionId: string,
  reason?: string
) {
  return updateSubscription(
    subscriptionId,
    { status: 'canceled', cancel_at_period_end: false },
    reason || `Cancelled subscription ${subscriptionId}`
  );
}

export async function reactivateSubscription(subscriptionId: string) {
  return updateSubscription(
    subscriptionId,
    { status: 'active', cancel_at_period_end: false },
    `Reactivated subscription ${subscriptionId}`
  );
}

export async function getSubscriptionStatistics() {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();

  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('id, status, plan_id');

  const rows = subscriptions || [];
  const total = rows.length;
  const active = rows.filter((s) => s.status === 'active').length;
  const canceled = rows.filter((s) => s.status === 'canceled').length;
  const pastDue = rows.filter(
    (s) => s.status === 'past_due' || s.status === 'unpaid'
  ).length;
  const trialing = rows.filter((s) => s.status === 'trialing').length;

  const byPlanType: Record<string, number> = {};
  let mrr = 0;
  for (const sub of rows) {
    const plan = sub.plan_id || 'unknown';
    byPlanType[plan] = (byPlanType[plan] || 0) + 1;
    if (sub.status === 'active') mrr += planMonthlyPrice(sub.plan_id);
  }

  return {
    total,
    active,
    cancelled: canceled, // page still uses cancelled key
    expired: pastDue,
    trialing,
    mrr,
    byPlanType,
  };
}
