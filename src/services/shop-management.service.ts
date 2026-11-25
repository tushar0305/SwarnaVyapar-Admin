'use server';

import { revalidatePath } from 'next/cache';
import { getServiceRoleClient } from '@/lib/supabase/admin';
import { requireAdminPermission, requireSuperAdmin, logAdminAction } from './admin-auth.service';
import { revokeUsersWithoutLiveShop } from '@/lib/auth-sessions';
import { success, failure } from '@/lib/utils';
import type { ServiceResult, Shop } from '@/types';

export interface ShopSuspensionInput {
  shopId: string;
  reason: string;
  notes?: string;
}

/**
 * Get all shops with admin view (no RLS filtering)
 */
export async function getAllShops(filters?: {
  status?: 'active' | 'suspended' | 'all';
  plan?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();

  let query = supabase
    .from('shops')
    .select(
      `
      *,
      subscriptions (
        plan_id,
        status,
        current_period_start,
        current_period_end
      )
    `,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false });

  if (filters?.status === 'suspended') {
    query = query.eq('is_suspended', true);
  } else if (filters?.status === 'active') {
    query = query.eq('is_suspended', false);
  }

  if (filters?.search) {
    const term = filters.search.replace(/[%_,.()"'\\]/g, ' ').trim().slice(0, 80);
    if (term) {
      query = query.or(
        `shop_name.ilike.%${term}%,phone_number.ilike.%${term}%,email.ilike.%${term}%`
      );
    }
  }

  if (filters?.limit || filters?.offset) {
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error, count } = await query;

  if (error) throw error;
  
  return { shops: data as Shop[], total: count || 0 };
}

export async function searchShops(query: string): Promise<{ id: string; name: string }[]> {
  await requireSuperAdmin();
  const term = query.replace(/[%_,.()"'\\]/g, ' ').trim().slice(0, 80);
  if (term.length < 2) return [];
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('shops')
    .select('id, shop_name')
    .or(`shop_name.ilike.%${term}%,phone_number.ilike.%${term}%,email.ilike.%${term}%`)
    .order('shop_name')
    .limit(8);
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id as string,
    name: (row.shop_name as string) || 'Unnamed shop',
  }));
}

/**
 * Get single shop details
 */
export async function getShopById(shopId: string) {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase
    .from('shops')
    .select(`
      *,
      subscriptions (
        *
      )
    `)
    .eq('id', shopId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Suspend a shop (blocks all access)
 */
export async function suspendShop(
  input: ShopSuspensionInput
): Promise<ServiceResult<{ sessionsRevoked: number; sessionsFailed: number }>> {
  try {
    const admin = await requireAdminPermission('manage_shops');
    const supabase = getServiceRoleClient();

    // Get shop details for audit log
    const { data: shop } = await supabase
      .from('shops')
      .select('shop_name')
      .eq('id', input.shopId)
      .single();

    // Update shop
    const { error: updateError } = await supabase
      .from('shops')
      .update({
        is_suspended: true,
        suspension_reason: input.reason,
        suspended_at: new Date().toISOString(),
        suspended_by: admin.id,
        health_score: 0,
      })
      .eq('id', input.shopId);

    if (updateError) throw updateError;

    const { data: members } = await supabase
      .from('user_shop_roles')
      .select('user_id')
      .eq('shop_id', input.shopId)
      .eq('is_active', true);
    const sessions = await revokeUsersWithoutLiveShop(
      (members || []).map((row) => row.user_id as string),
      input.shopId
    );

    // Log suspension
    await supabase.from('shop_suspensions').insert({
      shop_id: input.shopId,
      suspended_by: admin.id,
      reason: input.reason,
      notes: input.notes,
    });

    // Audit trail
    await logAdminAction(
      'shop_suspended',
      'shop',
      input.shopId,
      { 
        shop_name: shop?.shop_name,
        reason: input.reason, 
        notes: input.notes,
        sessions_revoked: sessions.revoked,
        sessions_failed: sessions.failed,
      },
      input.reason
    );

    revalidatePath('/shops');
    revalidatePath(`/shops/${input.shopId}`);

    return success({
      sessionsRevoked: sessions.revoked,
      sessionsFailed: sessions.failed,
    });
  } catch (error) {
    console.error('Suspend shop error:', error);
    return failure(error instanceof Error ? error.message : 'Failed to suspend shop');
  }
}

/**
 * Unsuspend a shop (restore access)
 */
export async function unsuspendShop(shopId: string, notes?: string): Promise<ServiceResult<void>> {
  try {
    const admin = await requireAdminPermission('manage_shops');
    const supabase = getServiceRoleClient();

    // Get shop details
    const { data: shop } = await supabase
      .from('shops')
      .select('shop_name, health_score')
      .eq('id', shopId)
      .single();

    // Update shop
    const { error: updateError } = await supabase
      .from('shops')
      .update({
        is_suspended: false,
        suspension_reason: null,
        suspended_at: null,
        suspended_by: null,
        health_score: shop?.health_score || 1.0,
      })
      .eq('id', shopId);

    if (updateError) throw updateError;

    // Update suspension record
    await supabase
      .from('shop_suspensions')
      .update({
        unsuspended_at: new Date().toISOString(),
        unsuspended_by: admin.id,
      })
      .eq('shop_id', shopId)
      .is('unsuspended_at', null);

    // Audit trail
    await logAdminAction(
      'shop_unsuspended',
      'shop',
      shopId,
      { shop_name: shop?.shop_name, notes },
      'Shop access restored'
    );

    // TODO: Send email to shop owner

    revalidatePath('/shops');
    revalidatePath(`/shops/${shopId}`);
    
    return success(undefined);
  } catch (error) {
    console.error('Unsuspend shop error:', error);
    return failure(error instanceof Error ? error.message : 'Failed to unsuspend shop');
  }
}

/**
 * Get shop activity summary
 */
export async function getShopActivity(shopId: string) {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase.rpc('get_shop_activity', {
    p_shop_id: shopId
  });

  if (error) {
    // Fallback if function doesn't exist
    const [invoices, customers, users] = await Promise.all([
      supabase.from('invoices').select('id, created_at').eq('shop_id', shopId).limit(10),
      supabase.from('customers').select('id').eq('shop_id', shopId),
      supabase.from('user_shop_roles').select('user_id').eq('shop_id', shopId),
    ]);

    return {
      recent_invoices_count: invoices.data?.length || 0,
      total_customers: customers.data?.length || 0,
      total_users: users.data?.length || 0,
    };
  }

  return data;
}

/**
 * Update shop health score
 */
export async function updateShopHealthScore(shopId: string): Promise<ServiceResult<number>> {
  try {
    await requireAdminPermission('manage_shops');
    const supabase = getServiceRoleClient();

    const { data, error } = await supabase.rpc('update_shop_health_score', {
      shop_uuid: shopId
    });

    if (error) throw error;

    revalidatePath(`/shops/${shopId}`);
    
    return success(data);
  } catch (error) {
    return failure(error instanceof Error ? error.message : 'Failed to update health score');
  }
}

/**
 * Get platform-wide shop statistics
 */
export async function getShopStatistics() {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();

  const { data: shops } = await supabase
    .from('shops')
    .select('id, is_suspended, created_at');

  if (!shops) return null;

  const total = shops.length;
  const active = shops.filter(s => !s.is_suspended).length;
  const suspended = shops.filter(s => s.is_suspended).length;
  
  // New shops in last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const newShops = shops.filter(s => new Date(s.created_at) > thirtyDaysAgo).length;

  return {
    total,
    active,
    suspended,
    newShops,
    activePercentage: total > 0 ? (active / total) * 100 : 0,
  };
}
