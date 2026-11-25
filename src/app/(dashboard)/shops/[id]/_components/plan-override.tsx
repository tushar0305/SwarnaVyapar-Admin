'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setShopPlan } from '@/services/billing.service';
import { toast } from 'sonner';

const PLANS = [
  { id: 'free', label: 'Starter' },
  { id: 'pro', label: 'Professional' },
  { id: 'business', label: 'Business' },
] as const;

type PlanId = (typeof PLANS)[number]['id'];

function toPlanId(value: string): PlanId {
  if (value === 'pro' || value === 'business' || value === 'free') return value;
  return 'free';
}

function planLabel(id: PlanId) {
  return PLANS.find((plan) => plan.id === id)?.label || id;
}

function toDateInput(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
}

export function PlanOverride({
  shopId,
  planId,
  status,
  periodEnd,
}: {
  shopId: string;
  planId: string;
  status: string;
  periodEnd?: string | null;
}) {
  const router = useRouter();
  const [nextPlan, setNextPlan] = useState<PlanId>(toPlanId(planId));
  const [nextStatus, setNextStatus] = useState(
    status && status !== 'none' ? status : 'active'
  );
  const [reason, setReason] = useState('');
  const [until, setUntil] = useState(toDateInput(periodEnd));
  const [loading, setLoading] = useState(false);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!reason.trim()) {
      toast.error('Write why you are changing this plan');
      return;
    }
    setLoading(true);
    try {
      await setShopPlan({
        shopId,
        planId: nextPlan,
        status: nextStatus as 'active' | 'past_due' | 'canceled' | 'trialing' | 'unpaid',
        applicableUntil: until || null,
        reason,
      });
      toast.success(
        `Saved ${planLabel(nextPlan)} (${nextPlan}). This does not charge Razorpay.`
      );
      setReason('');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Plan update failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-ink-600">
          Plan
          <select
            name="planId"
            value={nextPlan}
            onChange={(event) => setNextPlan(toPlanId(event.target.value))}
            className="mt-1 h-9 w-full rounded-md border border-ink-300 bg-white px-3 text-sm text-ink-900"
          >
            {PLANS.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-ink-600">
          Status
          <select
            name="status"
            value={nextStatus}
            onChange={(event) => setNextStatus(event.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-ink-300 bg-white px-3 text-sm text-ink-900"
          >
            <option value="active">Active</option>
            <option value="trialing">Trialing</option>
            <option value="past_due">Past due</option>
            <option value="unpaid">Unpaid</option>
            <option value="canceled">Canceled</option>
          </select>
        </label>
        <label className="text-sm text-ink-600 sm:col-span-2">
          Applicable until
          <input
            type="date"
            name="applicableUntil"
            min={today}
            value={until}
            onChange={(event) => setUntil(event.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-ink-300 bg-white px-3 text-sm text-ink-900"
          />
          <span className="mt-1 block text-xs text-ink-500">
            Opens a calendar. Leave empty for no end date.
          </span>
        </label>
      </div>
      <label className="block text-sm text-ink-600">
        Reason (saved to the audit log)
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-1 h-9 w-full rounded-md border border-ink-300 px-3 text-sm text-ink-900"
          placeholder="Comp Business for onboarding, 30 days"
        />
      </label>
      <p className="rounded-md border border-ink-100 bg-ink-50 px-3 py-2 text-xs text-ink-700">
        Will save: <strong>{planLabel(nextPlan)}</strong> · {nextStatus}
        {until ? ` · until ${until}` : ' · no end date'}
      </p>
      <button
        type="submit"
        disabled={loading}
        className="h-9 rounded-md bg-ink-900 px-4 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? 'Saving…' : `Save ${planLabel(nextPlan)} override`}
      </button>
      <p className="text-xs text-ink-500">
        Current in DB: {planId === 'none' ? 'no plan' : planId} ·{' '}
        {status === 'none' ? 'no subscription row' : status}
        {periodEnd ? ` · until ${toDateInput(periodEnd)}` : ''}
        . Razorpay is not updated.
      </p>
    </form>
  );
}
