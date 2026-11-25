'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  GOOGLE_REVIEWS_UNLOCK_INR,
  type GoogleReviewsUnlockState,
} from '@/lib/google-reviews';
import {
  grantGoogleReviewsUnlock,
  revokeGoogleReviewsUnlock,
} from '@/services/google-reviews-admin.service';
import { formatDateTime } from '@/lib/utils';

export function GoogleReviewsControls({ initial }: { initial: GoogleReviewsUnlockState }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState(initial);

  async function grant() {
    if (!reason.trim()) {
      toast.error('Write why you are unlocking Google reviews');
      return;
    }
    setLoading(true);
    try {
      const result = await grantGoogleReviewsUnlock({ shopId: state.shopId, reason });
      toast.success(
        result.alreadyUnlocked
          ? 'Already unlocked'
          : `Unlocked (₹${GOOGLE_REVIEWS_UNLOCK_INR} waived). Shop can set Place and print the QR.`
      );
      setReason('');
      setState((prev) => ({
        ...prev,
        unlocked: true,
        unlockedAt: result.unlockedAt,
        unlockOrderId: `admin-comp`,
      }));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unlock failed');
    } finally {
      setLoading(false);
    }
  }

  async function revoke() {
    if (!reason.trim()) {
      toast.error('Write why you are locking Google reviews again');
      return;
    }
    setLoading(true);
    try {
      await revokeGoogleReviewsUnlock({ shopId: state.shopId, reason });
      toast.success('Google reviews locked again');
      setReason('');
      setState((prev) => ({
        ...prev,
        unlocked: false,
        unlockedAt: null,
        unlockOrderId: null,
        unlockPaymentId: null,
      }));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Revoke failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-600">
        One-time ₹{GOOGLE_REVIEWS_UNLOCK_INR} add-on (not included in any plan). Grant it when you
        want the shop to get the counter QR without paying.
      </p>
      <p className="text-sm text-ink-800">
        Status:{' '}
        <strong>{state.unlocked ? 'Unlocked' : 'Locked'}</strong>
        {state.unlockedAt ? ` · since ${formatDateTime(state.unlockedAt)}` : ''}
      </p>
      {state.publicCode ? (
        <p className="text-xs text-ink-500">
          Public code {state.publicCode}
          {state.placeId ? ` · place ${state.placeId}` : ' · Place not set yet'}
        </p>
      ) : (
        <p className="text-xs text-ink-500">
          No review card yet — after unlock the owner sets Google Place in the shop app.
        </p>
      )}
      <label className="block text-sm text-ink-600">
        Reason (audit log)
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-1 h-9 w-full rounded-md border border-ink-300 px-3 text-sm text-ink-900"
          placeholder="Comp for activation call / Diwali push"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {!state.unlocked ? (
          <Button type="button" size="sm" disabled={loading} onClick={() => void grant()}>
            {loading ? 'Unlocking…' : `Unlock Google reviews · ₹${GOOGLE_REVIEWS_UNLOCK_INR}`}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => void revoke()}
          >
            {loading ? 'Saving…' : 'Lock again'}
          </Button>
        )}
      </div>
    </div>
  );
}
