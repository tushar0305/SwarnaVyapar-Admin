'use server';

import { getServiceRoleClient } from '@/lib/supabase/admin';

export type ShopInboxType = 'info' | 'success' | 'warning' | 'error' | 'order' | 'payment';

const ALLOWED_TYPES = new Set<ShopInboxType>([
  'info',
  'success',
  'warning',
  'error',
  'order',
  'payment',
]);

function toShopInboxType(value: string | null | undefined): ShopInboxType {
  if (value && ALLOWED_TYPES.has(value as ShopInboxType)) return value as ShopInboxType;
  if (value === 'critical') return 'error';
  if (value === 'maintenance') return 'warning';
  return 'info';
}

/**
 * Shop Notification Center reads public.notifications.
 * Admin must fan-out here — platform_announcements is admin-only catalog.
 */
export async function fanOutShopNotifications(input: {
  shopIds: string[];
  title: string;
  message: string;
  type?: string;
  link?: string | null;
}): Promise<number> {
  const shopIds = [...new Set(input.shopIds.filter(Boolean))];
  if (shopIds.length === 0) return 0;

  const title = input.title.trim().slice(0, 200);
  const message = input.message.trim().slice(0, 2000);
  if (!title || !message) throw new Error('Title and message are required');

  const supabase = getServiceRoleClient();
  const type = toShopInboxType(input.type);
  const rows = shopIds.map((shop_id) => ({
    shop_id,
    title,
    message,
    type,
    link: input.link?.trim() || null,
    read: false,
  }));

  const chunkSize = 200;
  let sent = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from('notifications').insert(chunk);
    if (error) throw error;
    sent += chunk.length;
  }
  return sent;
}

export async function listActiveShopIds(): Promise<string[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('shops')
    .select('id')
    .eq('is_active', true)
    .or('is_suspended.eq.false,is_suspended.is.null');
  if (error) throw error;
  return (data || []).map((row) => row.id);
}

const AUDIENCE_PLANS: Record<string, string[]> = {
  starter: ['free', 'none'],
  professional: ['pro'],
  business: ['business'],
};

/** Active shops whose latest plan matches the announcement audience. Unknown values mean every active shop. */
export async function listShopIdsForAudience(audience: string | null | undefined): Promise<string[]> {
  const shopIds = await listActiveShopIds();
  const key = (audience || 'all').trim().toLowerCase();
  const plans = AUDIENCE_PLANS[key];
  if (!plans || shopIds.length === 0) return shopIds;

  const { data, error } = await getServiceRoleClient()
    .from('subscriptions')
    .select('shop_id, plan_id, created_at')
    .in('shop_id', shopIds)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const latest = new Map<string, string>();
  for (const row of data || []) {
    const id = String(row.shop_id);
    if (!latest.has(id)) latest.set(id, String(row.plan_id || 'none'));
  }

  return shopIds.filter((id) => plans.includes(latest.get(id) || 'none'));
}
