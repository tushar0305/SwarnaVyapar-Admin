'use server';

import { getServiceRoleClient } from '@/lib/supabase/admin';
import {
  requireSuperAdmin,
  requireAdminPermission,
  logAdminAction,
} from './admin-auth.service';
import { success, failure } from '@/lib/utils';
import type { ServiceResult } from '@/types';

export async function getAllLimitOverrides(filters?: {
  shopId?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
}) {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();

  let query = supabase
    .from('shop_limit_overrides')
    .select(
      `
      *,
      shop:shops (
        id,
        shop_name,
        gst_number
      )
    `,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false });

  if (filters?.shopId) query = query.eq('shop_id', filters.shopId);

  if (filters?.active !== undefined) {
    const now = new Date().toISOString();
    if (filters.active) {
      query = query.or(`expires_at.is.null,expires_at.gte.${now}`);
    } else {
      query = query.lt('expires_at', now);
    }
  }

  if (filters?.limit) query = query.limit(filters.limit);
  if (filters?.offset) {
    query = query.range(
      filters.offset,
      filters.offset + (filters.limit || 50) - 1
    );
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count };
}

export async function getLimitOverrideById(id: string) {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase
    .from('shop_limit_overrides')
    .select(
      `
      *,
      shop:shops (
        id,
        shop_name,
        gst_number
      )
    `
    )
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

/** Upsert one or more plan limit keys for a shop (invoices → invoices, staff → staff). */
export async function createLimitOverride(input: {
  shopId: string;
  maxInvoices?: number;
  maxUsers?: number;
  expiresAt?: string;
  reason: string;
  notes?: string;
}): Promise<ServiceResult<unknown>> {
  try {
    const admin = await requireAdminPermission('manage_limits');
    const supabase = getServiceRoleClient();

    const { data: shop } = await supabase
      .from('shops')
      .select('shop_name')
      .eq('id', input.shopId)
      .single();

    const rows: Array<{
      shop_id: string;
      limit_key: string;
      override_value: number;
      reason: string;
      is_temporary: boolean;
      expires_at: string | null;
      created_by: string;
    }> = [];

    const reason =
      input.notes?.trim()
        ? `${input.reason} — ${input.notes.trim()}`
        : input.reason;

    if (input.maxInvoices !== undefined) {
      rows.push({
        shop_id: input.shopId,
        limit_key: 'invoices',
        override_value: input.maxInvoices,
        reason,
        is_temporary: Boolean(input.expiresAt),
        expires_at: input.expiresAt || null,
        created_by: admin.id,
      });
    }
    if (input.maxUsers !== undefined) {
      rows.push({
        shop_id: input.shopId,
        limit_key: 'staff',
        override_value: input.maxUsers,
        reason,
        is_temporary: Boolean(input.expiresAt),
        expires_at: input.expiresAt || null,
        created_by: admin.id,
      });
    }

    if (rows.length === 0) {
      return failure('Provide at least one limit value');
    }

    const { data: overrides, error } = await supabase
      .from('shop_limit_overrides')
      .upsert(rows, { onConflict: 'shop_id,limit_key' })
      .select();

    if (error) throw error;

    await logAdminAction(
      'limit_updated',
      'shop_limit_override',
      input.shopId,
      {
        shop_name: shop?.shop_name,
        shop_id: input.shopId,
        rows,
      },
      `Limit override for ${shop?.shop_name}: ${input.reason}`
    );

    return success(overrides);
  } catch (error: unknown) {
    return failure(
      error instanceof Error ? error.message : 'Failed to create limit override'
    );
  }
}

export async function updateLimitOverride(
  id: string,
  input: {
    overrideValue?: number;
    expiresAt?: string | null;
    reason?: string;
  }
): Promise<ServiceResult<void>> {
  try {
    await requireAdminPermission('manage_limits');
    const supabase = getServiceRoleClient();
    const existing = await getLimitOverrideById(id);

    const patch: Record<string, unknown> = {};
    if (input.overrideValue !== undefined) patch.override_value = input.overrideValue;
    if (input.expiresAt !== undefined) {
      patch.expires_at = input.expiresAt;
      patch.is_temporary = Boolean(input.expiresAt);
    }
    if (input.reason !== undefined) patch.reason = input.reason;

    const { error } = await supabase
      .from('shop_limit_overrides')
      .update(patch)
      .eq('id', id);

    if (error) throw error;

    await logAdminAction(
      'limit_updated',
      'shop_limit_override',
      id,
      { shop_id: existing.shop_id, ...patch },
      `Updated limit override ${existing.limit_key}`
    );

    return success(undefined);
  } catch (error: unknown) {
    return failure(
      error instanceof Error ? error.message : 'Failed to update limit override'
    );
  }
}

export async function deleteLimitOverride(id: string): Promise<ServiceResult<void>> {
  try {
    await requireAdminPermission('manage_limits');
    const supabase = getServiceRoleClient();
    const existing = await getLimitOverrideById(id);

    const { error } = await supabase
      .from('shop_limit_overrides')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await logAdminAction(
      'limit_removed',
      'shop_limit_override',
      id,
      {
        shop_id: existing.shop_id,
        limit_key: existing.limit_key,
      },
      `Removed ${existing.limit_key} override`
    );

    return success(undefined);
  } catch (error: unknown) {
    return failure(
      error instanceof Error ? error.message : 'Failed to delete limit override'
    );
  }
}

export async function getLimitStatistics() {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();
  const { data } = await supabase
    .from('shop_limit_overrides')
    .select('id, expires_at');

  const now = Date.now();
  const total = data?.length || 0;
  const active =
    data?.filter((r) => !r.expires_at || new Date(r.expires_at).getTime() > now)
      .length || 0;

  return { total, active, expired: total - active };
}
