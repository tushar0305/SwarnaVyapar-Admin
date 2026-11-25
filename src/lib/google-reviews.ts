/** Matches the shop app one-time Google review QR unlock price. */
export const GOOGLE_REVIEWS_UNLOCK_INR = 499;

export type GoogleReviewsUnlockState = {
  shopId: string;
  unlocked: boolean;
  unlockedAt: string | null;
  unlockOrderId: string | null;
  unlockPaymentId: string | null;
  placeId: string | null;
  reviewUrl: string | null;
  publicCode: string | null;
  priceInr: number;
};
