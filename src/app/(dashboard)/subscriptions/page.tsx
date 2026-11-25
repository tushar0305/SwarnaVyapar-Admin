import { CreditCard, TrendingUp, XCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  getAllSubscriptions,
  getSubscriptionStatistics,
} from '@/services/subscription-management.service';
import { planMonthlyPrice } from '@/lib/plan-prices';
import { PageHeader } from '../_components/page-header';
import { SubscriptionActions } from './_components/subscription-actions';

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  canceled: 'bg-red-100 text-red-700',
  past_due: 'bg-amber-100 text-amber-700',
  unpaid: 'bg-red-100 text-red-700',
  trialing: 'bg-sky-100 text-sky-700',
};

export default async function SubscriptionsPage() {
  let subscriptions: Awaited<ReturnType<typeof getAllSubscriptions>> = [];
  let stats = {
    total: 0,
    active: 0,
    cancelled: 0,
    expired: 0,
    trialing: 0,
    mrr: 0,
    byPlanType: {} as Record<string, number>,
  };

  try {
    [subscriptions, stats] = await Promise.all([
      getAllSubscriptions(),
      getSubscriptionStatistics(),
    ]);
  } catch (e) {
    console.error('Subscriptions page load failed:', e);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Money"
        title="Subscriptions"
        subtitle="Live plan rows across every shop."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">
              Total
            </CardTitle>
            <CreditCard className="w-4 h-4 text-ink-500" />
          </CardHeader>
          <CardContent>
            <div className="tnum text-xl font-semibold">{stats.total}</div>
            <p className="text-xs text-ink-500 mt-1">MRR ₹{stats.mrr}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">
              Active
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="tnum text-xl font-semibold text-emerald-600">
              {stats.active}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">
              Canceled
            </CardTitle>
            <XCircle className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="tnum text-xl font-semibold text-red-600">
              {stats.cancelled}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">
              Past due / unpaid
            </CardTitle>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="tnum text-xl font-semibold text-amber-600">
              {stats.expired}
            </div>
          </CardContent>
        </Card>
      </div>

      {Object.keys(stats.byPlanType).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Plan distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(stats.byPlanType).map(([plan, count]) => (
                <div
                  key={plan}
                  className="text-center p-4 bg-ink-50 rounded-lg"
                >
                  <p className="tnum text-xl font-semibold text-gold-700">{count}</p>
                  <p className="text-sm text-ink-600 capitalize">{plan}</p>
                  <p className="text-xs text-ink-400">
                    ₹{planMonthlyPrice(plan)}/mo
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          {subscriptions.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="w-12 h-12 text-ink-400 mx-auto mb-4" />
              <p className="text-ink-600 font-medium">No subscriptions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-ink-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-ink-500 uppercase">
                      Shop
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-ink-500 uppercase">
                      Plan
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-ink-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-ink-500 uppercase">
                      Period start
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-ink-500 uppercase">
                      Period end
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-ink-500 uppercase">
                      List price
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-ink-500 uppercase">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50">
                  {subscriptions.map((subscription) => (
                    <tr key={subscription.id} className="hover:bg-ink-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-ink-900">
                            {subscription.shop?.shop_name || 'Unknown'}
                          </p>
                          <p className="text-xs text-ink-500">
                            {subscription.shop?.email}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm capitalize font-medium text-ink-700">
                          {subscription.plan_id || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={
                            statusColors[subscription.status] ||
                            'bg-ink-100 text-ink-700'
                          }
                        >
                          {subscription.status}
                          {subscription.cancel_at_period_end
                            ? ' (ends period)'
                            : ''}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-ink-600">
                        {subscription.current_period_start
                          ? new Date(
                              subscription.current_period_start
                            ).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-ink-600">
                        {subscription.current_period_end
                          ? new Date(
                              subscription.current_period_end
                            ).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-ink-600">
                        ₹{planMonthlyPrice(subscription.plan_id)}/mo
                      </td>
                      <td className="px-4 py-3 text-right">
                        <SubscriptionActions id={subscription.id} status={subscription.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
