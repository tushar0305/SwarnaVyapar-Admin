'use server';

import { getServiceRoleClient } from '@/lib/supabase/admin';
import { revokeUsersWithoutLiveShop } from '@/lib/auth-sessions';
import { requireAdminPermission, logAdminAction } from './admin-auth.service';
import { success, failure } from '@/lib/utils';
import type { ServiceResult } from '@/types';

/**
 * Get all users across shops with optional filters
 */
export type PlatformUserRow = {
  id: string;
  user_id: string;
  shop_id: string;
  role: string;
  is_active: boolean;
  created_at: string;
  email: string | null;
  last_sign_in_at: string | null;
  shop: { id: string; shop_name: string | null; gst_number: string | null } | null;
};

export async function getAllUsers(filters?: {
  shopId?: string;
  role?: string;
  status?: 'active' | 'disabled';
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: PlatformUserRow[]; count: number }> {
  await requireAdminPermission('manage_users');
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase.rpc('admin_list_users', {
    p_search: filters?.search?.trim() || null,
    p_role: filters?.role?.trim() || null,
    p_shop_id: filters?.shopId || null,
    p_limit: filters?.limit ?? 50,
    p_offset: filters?.offset ?? 0,
  });

  if (error) throw error;

  const rows = (Array.isArray(data) ? data : []) as Array<{
    id: string;
    user_id: string;
    shop_id: string;
    role: string;
    is_active: boolean;
    created_at: string;
    shop_name: string | null;
    gst_number: string | null;
    email: string | null;
    last_sign_in_at: string | null;
    total_count: number | string | null;
  }>;

  const mapped = rows
    .filter((row) => {
      if (filters?.status === 'active') return row.is_active;
      if (filters?.status === 'disabled') return !row.is_active;
      return true;
    })
    .map((row) => ({
      id: row.id,
      user_id: row.user_id,
      shop_id: row.shop_id,
      role: row.role,
      is_active: row.is_active,
      created_at: row.created_at,
      email: row.email,
      last_sign_in_at: row.last_sign_in_at,
      shop: row.shop_id
        ? {
            id: row.shop_id,
            shop_name: row.shop_name,
            gst_number: row.gst_number,
          }
        : null,
    }));

  return {
    data: mapped,
    count: Number(rows[0]?.total_count ?? mapped.length) || 0,
  };
}

/**
 * Get user details by ID
 */
export async function getUserById(userId: string) {
  await requireAdminPermission('manage_users');
  const supabase = getServiceRoleClient();

  // Get all shop roles for this user
  const { data: roles, error: rolesError } = await supabase
    .from('user_shop_roles')
    .select(`
      *,
      shop:shops (
        id,
        shop_name,
        gst_number,
        is_active
      )
    `)
    .eq('user_id', userId);

  if (rolesError) throw rolesError;

  return {
    user_id: userId,
    roles,
  };
}

/**
 * Disable a user's shop role access
 */
export async function disableUser(
  userShopRoleId: string,
  reason: string
): Promise<ServiceResult<void>> {
  try {
    await requireAdminPermission('manage_users');
    const supabase = getServiceRoleClient();

    // Get role details for audit
    const { data: role } = await supabase
      .from('user_shop_roles')
      .select('user_id, shop_id, role')
      .eq('id', userShopRoleId)
      .single();

    // Disable the user-shop role
    const { error: updateError } = await supabase
      .from('user_shop_roles')
      .update({ is_active: false })
      .eq('id', userShopRoleId);

    if (updateError) throw updateError;

    const sessions = role?.user_id
      ? await revokeUsersWithoutLiveShop([role.user_id])
      : { revoked: 0, failed: 0 };

    // Audit trail
    await logAdminAction(
      'user_disabled',
      'user',
      role?.user_id || userShopRoleId,
      {
        user_shop_role_id: userShopRoleId,
        shop_id: role?.shop_id,
        role: role?.role,
        reason,
        sessions_revoked: sessions.revoked,
        sessions_failed: sessions.failed,
      },
      `Disabled user role: ${reason}`
    );

    return success(undefined);
  } catch (error: any) {
    return failure(error.message || 'Failed to disable user');
  }
}

/**
 * Enable a previously disabled user's shop role access
 */
export async function enableUser(
  userShopRoleId: string,
  notes?: string
): Promise<ServiceResult<void>> {
  try {
    await requireAdminPermission('manage_users');
    const supabase = getServiceRoleClient();

    // Get role details for audit
    const { data: role } = await supabase
      .from('user_shop_roles')
      .select('user_id, shop_id, role')
      .eq('id', userShopRoleId)
      .single();

    // Enable the user-shop role
    const { error: updateError } = await supabase
      .from('user_shop_roles')
      .update({ is_active: true })
      .eq('id', userShopRoleId);

    if (updateError) throw updateError;

    // Audit trail
    await logAdminAction(
      'user_enabled',
      'user',
      role?.user_id || userShopRoleId,
      {
        user_shop_role_id: userShopRoleId,
        shop_id: role?.shop_id,
        role: role?.role,
        notes,
      },
      `Enabled user role`
    );

    return success(undefined);
  } catch (error: any) {
    return failure(error.message || 'Failed to enable user');
  }
}

/**
 * Force password reset for a user (requires Auth Admin API)
 * Note: This function is disabled until Supabase Auth Admin API is configured
 */
export async function forcePasswordReset(userId: string): Promise<
  ServiceResult<{ emailed: boolean; recoveryLink: string | null }>
> {
  try {
    await requireAdminPermission('manage_users');
    const supabase = getServiceRoleClient();
    const { data: user, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError) return failure(userError.message);
    const email = user.user?.email;
    if (!email) return failure('This account has no email address');

    const shopUrl = process.env.NEXT_PUBLIC_SHOP_URL || process.env.NEXT_PUBLIC_APP_URL;
    const redirectTo = shopUrl ? `${shopUrl.replace(/\/$/, '')}/reset-password` : undefined;

    const link = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: redirectTo ? { redirectTo } : undefined,
    });
    if (link.error) return failure(link.error.message);

    const mailed = await supabase.auth.resetPasswordForEmail(
      email,
      redirectTo ? { redirectTo } : undefined
    );

    await logAdminAction(
      'password_reset_forced',
      'user',
      userId,
      { email, emailed: !mailed.error },
      `Issued a password reset for ${email}`
    );

    return success({
      emailed: !mailed.error,
      recoveryLink: mailed.error ? (link.data.properties?.action_link ?? null) : null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send password reset';
    return failure(message);
  }
}

/**
 * Get user statistics
 */
export async function getUserStatistics() {
  await requireAdminPermission('manage_users');
  const supabase = getServiceRoleClient();

  const [total, active] = await Promise.all([
    supabase.from('user_shop_roles').select('id', { count: 'exact', head: true }),
    supabase
      .from('user_shop_roles')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
  ]);

  const totalUsers = total.count || 0;
  const activeUsers = active.count || 0;

  return {
    totalUsers,
    activeUsers,
    disabledUsers: Math.max(totalUsers - activeUsers, 0),
  };
}
