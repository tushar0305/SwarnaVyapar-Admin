'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { grantShopCredits, setShopWalletFrozen } from '@/services/tenant.service';

export function CreditControls({ shopId, frozen }: { shopId: string; frozen: boolean }) {
  const router = useRouter();
  const [credits, setCredits] = useState('100');
  const [kind, setKind] = useState<'promo' | 'paid'>('promo');
  const [days, setDays] = useState('30');
  const [reason, setReason] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [loading, setLoading] = useState(false);

  async function grant() {
    if (!reason.trim()) {
      toast.error('Write why you are granting credits');
      return;
    }
    setLoading(true);
    try {
      const result = await grantShopCredits({
        shopId,
        credits: Number(credits),
        kind,
        expiresInDays: kind === 'promo' ? Number(days) || null : null,
        reason,
        requestId,
      });
      toast.success(
        result.duplicate ? 'Already granted' : `Granted. Wallet now ${result.availableMc / 500} credits.`
      );
      setReason('');
      setRequestId(crypto.randomUUID());
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Grant failed');
    } finally {
      setLoading(false);
    }
  }

  async function toggleFreeze() {
    if (!reason.trim()) {
      toast.error(`Write why you are ${frozen ? 'unfreezing' : 'freezing'} this wallet`);
      return;
    }
    setLoading(true);
    try {
      await setShopWalletFrozen({ shopId, frozen: !frozen, reason });
      toast.success(frozen ? 'Wallet unfrozen' : 'Wallet frozen');
      setReason('');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  }

  const field =
    'mt-1 h-9 w-full rounded-md border border-ink-300 bg-white px-3 text-sm text-ink-900';

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm text-ink-600">
          Credits
          <input
            type="number"
            min={1}
            max={20000}
            value={credits}
            onChange={(event) => setCredits(event.target.value)}
            className={field}
          />
        </label>
        <label className="text-sm text-ink-600">
          Type
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as 'promo' | 'paid')}
            className={field}
          >
            <option value="promo">Promo (spent first, can expire)</option>
            <option value="paid">Paid adjustment (never expires)</option>
          </select>
        </label>
        <label className="text-sm text-ink-600">
          Expires in days
          <input
            type="number"
            min={1}
            value={days}
            disabled={kind !== 'promo'}
            onChange={(event) => setDays(event.target.value)}
            className={`${field} disabled:bg-ink-100`}
          />
        </label>
      </div>
      <label className="block text-sm text-ink-600">
        Reason (saved to the ledger and audit log)
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className={field}
          placeholder="Diwali WhatsApp promo, 100 credits"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={grant}
          disabled={loading}
          className="h-9 rounded-md bg-ink-900 px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          Grant {Number(credits) > 0 ? `${credits} credits (₹${Number(credits) / 2})` : 'credits'}
        </button>
        <button
          type="button"
          onClick={toggleFreeze}
          disabled={loading}
          className="h-9 rounded-md border border-ink-300 px-4 text-sm font-medium text-ink-800 disabled:opacity-50"
        >
          {frozen ? 'Unfreeze wallet' : 'Freeze wallet'}
        </button>
      </div>
    </div>
  );
}
