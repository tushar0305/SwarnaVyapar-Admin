import { getServiceRoleClient } from '@/lib/supabase/admin';

/**
 * Drop refresh tokens so the next request cannot stay signed in.
 * GoTrue's admin logout is used when the project supports it.
 * Otherwise a one-second ban is applied and cleared, which revokes sessions
 * without leaving the account banned.
 */
export async function revokeUserSessions(userIds: string[]): Promise<{
  revoked: number;
  failed: number;
}> {
  const ids = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return { revoked: 0, failed: 0 };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let revoked = 0;
  let failed = 0;

  for (const id of ids) {
    const loggedOut = url && key ? await logoutViaAdminApi(url, key, id) : false;
    if (loggedOut) {
      revoked += 1;
      continue;
    }
    const banned = await revokeViaBriefBan(id);
    if (banned) revoked += 1;
    else failed += 1;
  }

  return { revoked, failed };
}

async function logoutViaAdminApi(url: string, key: string, userId: string): Promise<boolean> {
  const response = await fetch(`${url}/auth/v1/admin/users/${userId}/logout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ scope: 'global' }),
  });
  return response.ok;
}

async function revokeViaBriefBan(userId: string): Promise<boolean> {
  const admin = getServiceRoleClient().auth.admin;
  const banned = await admin.updateUserById(userId, { ban_duration: '1s' });
  if (banned.error) return false;
  const cleared = await admin.updateUserById(userId, { ban_duration: 'none' });
  return !cleared.error;
}

/** Users who should be signed out: no other active membership on a live shop. */
export function userIdsWithNoOtherLiveShop(
  memberIds: string[],
  otherLiveUserIds: string[]
): string[] {
  const stillLive = new Set(otherLiveUserIds);
  return [...new Set(memberIds)].filter((id) => id && !stillLive.has(id));
}

/**
 * Sign out members who no longer have an active role on an unsuspended shop.
 * People who still belong to another live shop keep their session.
 */
export async function revokeUsersWithoutLiveShop(
  userIds: string[],
  exceptShopId?: string
): Promise<{ revoked: number; failed: number }> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return { revoked: 0, failed: 0 };

  const supabase = getServiceRoleClient();
  let rolesQuery = supabase
    .from('user_shop_roles')
    .select('user_id, shop_id')
    .in('user_id', ids)
    .eq('is_active', true);
  if (exceptShopId) rolesQuery = rolesQuery.neq('shop_id', exceptShopId);

  const { data: roles, error } = await rolesQuery;
  if (error) return { revoked: 0, failed: ids.length };

  const shopIds = [...new Set((roles || []).map((row) => row.shop_id).filter(Boolean))];
  const liveShops = new Set<string>();
  if (shopIds.length > 0) {
    const { data: shops } = await supabase
      .from('shops')
      .select('id, is_suspended')
      .in('id', shopIds);
    for (const shop of shops || []) {
      if (!shop.is_suspended) liveShops.add(shop.id);
    }
  }

  const stillLive = (roles || [])
    .filter((row) => liveShops.has(row.shop_id))
    .map((row) => row.user_id as string);

  return revokeUserSessions(userIdsWithNoOtherLiveShop(ids, stillLive));
}
