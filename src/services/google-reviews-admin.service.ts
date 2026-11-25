'use server';

import { revalidatePath } from 'next/cache';
import { LOCAL_BYPASS_ADMIN_ID } from '@/lib/admin-ids';
import {
  GOOGLE_REVIEWS_UNLOCK_INR,
  type GoogleReviewsUnlockState,
} from '@/lib/google-reviews';
import { getServiceRoleClient } from '@/lib/supabase/admin';
import { logAdminAction, requireAdminPermission, requireSuperAdmin } from './admin-auth.service';
import { fanOutShopNotifications } from './shop-inbox.service';

export async function getGoogleReviewsUnlockState(shopId: string): Promise<GoogleReviewsUnlockState> {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();
  const [{ data: shop, error }, { data: review }] = await Promise.all([
    supabase
      .from('shops')
      .select(
        'id, google_reviews_unlocked_at, google_reviews_unlock_order_id, google_reviews_unlock_payment_id'
      )
      .eq('id', shopId)
      .maybeSingle(),
    supabase
      .from('shop_google_reviews')
      .select('place_id, review_url, public_code')
      .eq('shop_id', shopId)
      .maybeSingle(),
  ]);
  if (error) throw new Error(error.message);
  if (!shop) throw new Error('Shop not found');

  const unlockedAt = (shop.google_reviews_unlocked_at as string | null) ?? null;
  return {
    shopId,
    unlocked: Boolean(unlockedAt),
    unlockedAt,
    unlockOrderId: (shop.google_reviews_unlock_order_id as string | null) ?? null,
    unlockPaymentId: (shop.google_reviews_unlock_payment_id as string | null) ?? null,
    placeId: (review?.place_id as string | null) ?? null,
    reviewUrl: (review?.review_url as string | null) ?? null,
    publicCode: (review?.public_code as string | null) ?? null,
    priceInr: GOOGLE_REVIEWS_UNLOCK_INR,
  };
}

/**
 * Comp the ₹499 one-time Google review QR unlock.
 * Same shop columns the Razorpay webhook sets — no payment required.
 */
export async function grantGoogleReviewsUnlock(input: {
  shopId: string;
  reason: string;
  notify?: boolean;
}): Promise<{ alreadyUnlocked: boolean; unlockedAt: string }> {
  const admin = await requireAdminPermission('manage_shops');
  const reason = input.reason.trim();
  if (!reason) throw new Error('A reason is required');

  const supabase = getServiceRoleClient();
  const { data: shop, error } = await supabase
    .from('shops')
    .select('id, shop_name, google_reviews_unlocked_at')
    .eq('id', input.shopId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!shop) throw new Error('Shop not found');

  const existing = shop.google_reviews_unlocked_at as string | null;
  if (existing) {
    return { alreadyUnlocked: true, unlockedAt: existing };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('shops')
    .update({
      google_reviews_unlocked_at: now,
      google_reviews_unlock_order_id: `admin-comp:${admin.id === LOCAL_BYPASS_ADMIN_ID ? 'local' : admin.id}`,
      google_reviews_unlock_payment_id: `admin-comp:${Date.now()}`,
      updated_at: now,
    })
    .eq('id', input.shopId)
    .is('google_reviews_unlocked_at', null);
  if (updateError) throw new Error(updateError.message);

  await logAdminAction(
    'google_reviews_unlock_granted',
    'shop',
    input.shopId,
    {
      shopName: shop.shop_name,
      priceInr: GOOGLE_REVIEWS_UNLOCK_INR,
      comp: true,
    },
    reason
  );

  if (input.notify !== false) {
    try {
      await fanOutShopNotifications({
        shopIds: [input.shopId],
        title: 'Google review QR unlocked',
        message:
          'SwarnaVyapar unlocked Google reviews for your shop (₹499 add-on). Open Google reviews to set your Place and print the counter QR.',
        type: 'system',
      });
    } catch {
      // Unlock still succeeded if the inbox write fails.
    }
  }

  revalidatePath('/activation');
  revalidatePath(`/shops/${input.shopId}`);
  revalidatePath('/overview');
  return { alreadyUnlocked: false, unlockedAt: now };
}

/** Rare: pull a mistaken comp. Does not refund Razorpay payments. */
export async function revokeGoogleReviewsUnlock(input: {
  shopId: string;
  reason: string;
}): Promise<void> {
  await requireAdminPermission('manage_shops');
  const reason = input.reason.trim();
  if (!reason) throw new Error('A reason is required');

  const supabase = getServiceRoleClient();
  const { data: shop, error } = await supabase
    .from('shops')
    .select('id, shop_name, google_reviews_unlocked_at, google_reviews_unlock_order_id')
    .eq('id', input.shopId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!shop) throw new Error('Shop not found');
  if (!shop.google_reviews_unlocked_at) throw new Error('Google reviews is not unlocked');

  const { error: updateError } = await supabase
    .from('shops')
    .update({
      google_reviews_unlocked_at: null,
      google_reviews_unlock_order_id: null,
      google_reviews_unlock_payment_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.shopId);
  if (updateError) throw new Error(updateError.message);

  await logAdminAction(
    'google_reviews_unlock_revoked',
    'shop',
    input.shopId,
    {
      shopName: shop.shop_name,
      previousOrderId: shop.google_reviews_unlock_order_id,
    },
    reason
  );

  revalidatePath('/activation');
  revalidatePath(`/shops/${input.shopId}`);
}
