'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { GOOGLE_REVIEWS_UNLOCK_INR } from '@/lib/google-reviews';
import { grantGoogleReviewsUnlock } from '@/services/google-reviews-admin.service';

export function GoogleReviewUnlockButton({
  shopId,
  shopName,
  unlocked,
}: {
  shopId: string;
  shopName: string;
  unlocked: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (unlocked) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
        <Star className="h-3.5 w-3.5" />
        Reviews unlocked
      </span>
    );
  }

  async function unlock() {
    const reason = window.prompt(
      `Unlock Google review QR for ${shopName}? Normally ₹${GOOGLE_REVIEWS_UNLOCK_INR} one-time. Write why you are granting it:`
    );
    if (reason === null) return;
    if (!reason.trim()) {
      toast.error('A reason is required');
      return;
    }
    setLoading(true);
    try {
      const result = await grantGoogleReviewsUnlock({ shopId, reason });
      toast.success(
        result.alreadyUnlocked
          ? 'Already unlocked'
          : `Unlocked Google reviews for ${shopName} (₹${GOOGLE_REVIEWS_UNLOCK_INR} waived)`
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unlock failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" variant="outline" disabled={loading} onClick={() => void unlock()}>
      <Star className="mr-1 h-3.5 w-3.5" />
      {loading ? 'Unlocking…' : `Unlock reviews · ₹${GOOGLE_REVIEWS_UNLOCK_INR}`}
    </Button>
  );
}
