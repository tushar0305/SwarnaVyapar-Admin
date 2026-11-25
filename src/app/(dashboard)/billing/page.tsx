import { DollarSign, TrendingUp, CreditCard, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  getAllPaymentHistory,
  getBillingStatistics,
} from '@/services/billing.service';
import { classifyBillingEvent, type BillingKind } from '@/lib/billing-events';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { PageHeader } from '../_components/page-header';

const KIND_LABEL: Record<BillingKind, string> = {
  payment: 'Captured',
  failed: 'Failed',
  abandoned: 'Abandoned',
  canceled: 'Canceled',
  lifecycle: 'Lifecycle',
};

export default async function BillingPage() {
  let payments: Awaited<ReturnType<typeof getAllPaymentHistory>> = [];
  let stats = {
    capturedVolume: 0,
    capturedPaymentCount: 0,
    totalRevenue: 0,
    totalRefunds: 0,
    netRevenue: 0,
    activeSubscriptions: 0,
    mrr: 0,
    avgRevenuePerSubscription: 0,
    failedPayments: 0,
    abandonedCheckouts: 0,
    canceledSignals: 0,
    followUpCount: 0,
    lifecycleEventCount: 0,
    eventCount: 0,
    hasCapturedPayments: false,
  };

  try {
    [payments, stats] = await Promise.all([
      getAllPaymentHistory({ limit: 50 }),
      getBillingStatistics(),
    ]);
  } catch (e) {
    console.error('Billing page load failed:', e);
  }

  const followUps = payments.filter((event) => {
    const kind = classifyBillingEvent(event.event_type);
    return kind === 'abandoned' || kind === 'canceled' || kind === 'failed';
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & Payments"
        subtitle="Captured volume only when a webhook payload has an amount. Checkout and cancel events are follow-ups, not revenue."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">
              Captured volume
            </CardTitle>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="tnum text-xl font-semibold text-emerald-600">
              {stats.hasCapturedPayments ? formatCurrency(stats.capturedVolume) : '—'}
            </div>
            <p className="mt-1 text-xs text-ink-500">
              {stats.hasCapturedPayments
                ? `${stats.capturedPaymentCount} captured payment events`
                : 'No captured payments in billing_events yet'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">MRR</CardTitle>
            <TrendingUp className="w-4 h-4 text-gold-700" />
          </CardHeader>
          <CardContent>
            <div className="tnum text-xl font-semibold text-gold-700">
              {formatCurrency(stats.mrr)}
            </div>
            <p className="mt-1 text-xs text-ink-500">Active plans × list price</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">
              Active subscriptions
            </CardTitle>
            <CreditCard className="w-4 h-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="tnum text-xl font-semibold text-sky-600">
              {stats.activeSubscriptions}
            </div>
            <p className="mt-1 text-xs text-ink-500">
              Avg {formatCurrency(Math.round(stats.avgRevenuePerSubscription))} / sub
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">
              Follow-up needed
            </CardTitle>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="tnum text-xl font-semibold text-red-600">
              {stats.followUpCount}
            </div>
            <p className="mt-1 text-xs text-ink-500">
              {stats.abandonedCheckouts} abandoned · {stats.canceledSignals} canceled ·{' '}
              {stats.failedPayments} failed
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Follow-up queue</CardTitle>
        </CardHeader>
        <CardContent>
          {followUps.length === 0 ? (
            <p className="text-sm text-ink-500">
              No abandoned, canceled, or failed payment events in the recent window.
            </p>
          ) : (
            <div className="space-y-2">
              {followUps.map((event) => {
                const kind = classifyBillingEvent(event.event_type);
                return (
                  <div
                    key={event.id}
                    className="flex flex-col gap-1 rounded-lg bg-ink-50 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink-900">
                        {event.shop_id ? (
                          <Link href={`/shops/${event.shop_id}`} className="hover:text-gold-700">
                            {event.shop?.shop_name || 'Unknown shop'}
                          </Link>
                        ) : (
                          event.shop?.shop_name || 'Unknown shop'
                        )}
                      </p>
                      <p className="text-xs text-ink-500">
                        {event.shop?.email || 'No shop email'} · {event.event_type}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">{KIND_LABEL[kind]}</Badge>
                      <span className="text-xs text-ink-500">
                        {formatDateTime(event.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent billing events</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="py-8 text-center">
              <DollarSign className="mx-auto mb-4 h-12 w-12 text-ink-400" />
              <p className="text-ink-600">No billing_events yet</p>
              <p className="mt-1 text-sm text-ink-500">
                Events appear when Razorpay webhooks hit the shop app
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-ink-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-ink-500">
                      Shop
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-ink-500">
                      Kind
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-ink-500">
                      Event
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-ink-500">
                      Source
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-ink-500">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50">
                  {payments.map((event) => {
                    const kind = classifyBillingEvent(event.event_type);
                    return (
                      <tr key={event.id} className="hover:bg-ink-50">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-ink-900">
                            {event.shop_id ? (
                              <Link href={`/shops/${event.shop_id}`} className="hover:text-gold-700">
                                {event.shop?.shop_name || 'Unknown'}
                              </Link>
                            ) : (
                              event.shop?.shop_name || 'Unknown'
                            )}
                          </p>
                          <p className="text-xs text-ink-500">{event.shop?.email || '—'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              kind === 'payment'
                                ? 'success'
                                : kind === 'lifecycle'
                                  ? 'secondary'
                                  : 'destructive'
                            }
                          >
                            {KIND_LABEL[kind]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-ink-600">{event.event_type}</td>
                        <td className="px-4 py-3 text-sm text-ink-600">{event.source}</td>
                        <td className="px-4 py-3 text-sm text-ink-600">
                          {formatDateTime(event.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
