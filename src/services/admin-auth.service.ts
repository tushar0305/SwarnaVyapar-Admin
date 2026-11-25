'use server';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';
import { getServiceRoleClient } from '@/lib/supabase/admin';
import { clientIp, isAdminAuthBypassed } from '@/lib/admin-security';
import {
  LOCAL_BYPASS_ADMIN_ID,
  auditTargetId,
  isLocalBypassAdminId,
} from '@/lib/admin-ids';
import type { SuperAdmin } from '@/types';

const BYPASS_PERMISSIONS = {
  manage_shops: true,
  manage_users: true,
  manage_limits: true,
  manage_features: true,
  view_analytics: true,
  system_settings: true,
} as const;

async function bypassAdmin(): Promise<SuperAdmin> {
  const supabase = getServiceRoleClient();
  const { data } = await supabase
    .from('super_admins')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (data) return data as SuperAdmin;
  return {
    id: LOCAL_BYPASS_ADMIN_ID,
    user_id: LOCAL_BYPASS_ADMIN_ID,
    name: 'Local bypass',
    email: 'dev@localhost',
    permissions: { ...BYPASS_PERMISSIONS },
    is_active: true,
    mfa_enabled: false,
    last_login_at: null,
    created_at: new Date().toISOString(),
  };
}

/**
 * Require super admin authentication.
 * Cached per request to avoid multiple DB calls.
 */
export const requireSuperAdmin = cache(async (): Promise<SuperAdmin> => {
  if (isAdminAuthBypassed()) return bypassAdmin();

  const supabase = await createServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  const { data: admin, error } = await supabase
    .from('super_admins')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (error || !admin) {
    redirect('/unauthorized');
  }

  // Fire-and-forget last login (don't block page)
  void supabase
    .from('super_admins')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', admin.id);

  return admin as SuperAdmin;
});

export async function checkAdminPermission(
  permission: keyof SuperAdmin['permissions']
): Promise<boolean> {
  const admin = await requireSuperAdmin();
  return admin.permissions[permission] === true;
}

/** Fail closed: redirect instead of throwing a 500. */
export async function requireAdminPermission(
  permission: keyof SuperAdmin['permissions']
): Promise<SuperAdmin> {
  const admin = await requireSuperAdmin();
  if (admin.permissions[permission] !== true) {
    redirect('/unauthorized');
  }
  return admin;
}

export async function logAdminAction(
  action: string,
  targetType: string | null,
  targetId: string | null,
  changes: Record<string, unknown>,
  reason?: string
): Promise<void> {
  const admin = await requireSuperAdmin();
  const bypass = isLocalBypassAdminId(admin.id);

  const h = await headers();
  const ip = clientIp(h) || null;
  const ua = h.get('user-agent');

  // Local bypass has no super_admins row (user_id FK). Store actor on the row.
  const supabase = getServiceRoleClient();
  const { error } = await supabase.from('super_admin_audit_log').insert({
    admin_id: bypass ? null : admin.id,
    action,
    target_type: targetType,
    target_id: auditTargetId(targetId),
    changes: {
      ...changes,
      ...(bypass
        ? { actor: 'local_bypass', actor_name: admin.name, actor_email: admin.email }
        : {}),
      ...(targetId && !auditTargetId(targetId) ? { target_key: targetId } : {}),
    },
    reason,
    ip_address: ip || null,
    user_agent: ua,
  });
  if (error) {
    console.error('Failed to write admin audit log:', error.message);
  }
}

export async function getAuditLog(filters?: {
  adminId?: string;
  targetType?: string;
  targetId?: string;
  action?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();

  let query = supabase
    .from('super_admin_audit_log')
    .select(
      `
      *,
      admin:super_admins!admin_id (
        name,
        email
      )
    `,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false });

  if (filters?.adminId) query = query.eq('admin_id', filters.adminId);
  if (filters?.targetType) query = query.eq('target_type', filters.targetType);
  if (filters?.targetId) query = query.eq('target_id', filters.targetId);
  if (filters?.action) query = query.eq('action', filters.action);
  if (filters?.fromDate) query = query.gte('created_at', filters.fromDate);
  if (filters?.toDate) query = query.lte('created_at', filters.toDate);
  if (filters?.search) {
    query = query.or(
      `reason.ilike.%${filters.search}%,action.ilike.%${filters.search}%`
    );
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
