import { TrendingUp, AlertTriangle, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  getShopAnalytics,
  getShopActivityLogs,
} from '@/services/shop-analytics.service';
import { getShopOnboardingStatus } from '@/services/onboarding.service';
import { getShopPaymentHistory } from '@/services/billing.service';
import Link from 'next/link';
import { PageHeader } from '../../../_components/page-header';

export default async function ShopAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [analytics, activityLogs, onboarding, payments] = await Promise.all([
    getShopAnalytics(id),
    getShopActivityLogs(id, 20),
    getShopOnboardingStatus(id),
    getShopPaymentHistory(id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Shop"
        title={`${analytics.shopName} — activation`}
        subtitle="Usage from live tables."
        actions={
          <Link
            href={`/shops/${id}`}
            className="inline-flex h-9 items-center text-sm font-medium text-gold-700 hover:underline"
          >
            Shop details
          </Link>
        }
      />

      {/* Health Score */}
      <Card>
        <CardHeader>
          <CardTitle>Shop Health Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <p className="text-sm text-ink-500">Overall Health</p>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex-1 bg-ink-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${
                      analytics.health.score > 70
                        ? 'bg-emerald-500'
                        : analytics.health.score > 40
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${analytics.health.score}%` }}
                  />
                </div>
                <span className="tnum text-xl font-semibold">{Math.round(analytics.health.score)}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-ink-500">Status</p>
              <Badge
                className={`mt-2 ${
                  analytics.health.status === 'healthy'
                    ? 'bg-emerald-100 text-emerald-700'
                    : analytics.health.status === 'at-risk'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {analytics.health.status}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-ink-500">Churn Probability</p>
              <p className="tnum text-xl font-semibold text-ink-900 mt-2">
                {(analytics.health.churnProbability * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue & Usage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-500">Plan price / month</span>
                <span className="text-lg font-bold">₹{analytics.revenue.monthly}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-500">Plan</span>
                <span className="text-lg font-bold">
                  {analytics.subscription?.plan_id || 'none'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-500">Status</span>
                <span className="text-sm font-medium">
                  {analytics.subscription?.status || 'none'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-gold-700" />
              Usage Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-ink-500">Invoices</p>
                <p className="tnum text-xl font-semibold text-gold-700">
                  {analytics.usage.invoicesCount}
                </p>
              </div>
              <div>
                <p className="text-sm text-ink-500">Customers</p>
                <p className="tnum text-xl font-semibold text-gold-700">
                  {analytics.usage.customersCount}
                </p>
              </div>
              <div>
                <p className="text-sm text-ink-500">Products</p>
                <p className="tnum text-xl font-semibold text-gold-700">
                  {analytics.usage.productsCount}
                </p>
              </div>
              <div>
                <p className="text-sm text-ink-500">Active Users</p>
                <p className="tnum text-xl font-semibold text-gold-700">
                  {analytics.usage.activeUsers}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Onboarding Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Onboarding Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Completion</span>
                <span className="text-sm font-bold">{Math.round(onboarding.overallProgress)}%</span>
              </div>
              <div className="w-full bg-ink-200 rounded-full h-2">
                <div
                  className="bg-ink-900 h-2 rounded-full"
                  style={{ width: `${onboarding.overallProgress}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {onboarding.steps.map((step) => (
                <div
                  key={step.id}
                  className="flex items-center gap-3 p-3 bg-ink-50 rounded-lg"
                >
                  {step.isCompleted ? (
                    <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs">
                      ✓
                    </div>
                  ) : (
                    <div className="w-6 h-6 bg-ink-300 rounded-full" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{step.name}</p>
                    <p className="text-xs text-ink-500">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
            {onboarding.needsAssistance && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <p className="text-sm text-amber-800">
                  This shop may need onboarding assistance
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Feature Adoption */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Adoption</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(analytics.featureAdoption).length === 0 ? (
            <p className="text-sm text-ink-500">No feature overrides for this shop</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(analytics.featureAdoption).map(([key, data]) => (
                <div
                  key={key}
                  className="p-3 bg-ink-50 rounded-lg"
                >
                  <p className="text-sm font-medium capitalize">{key.replace(/_/g, ' ')}</p>
                  <Badge
                    className={`mt-1 ${
                      data.enabled
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-ink-100 text-ink-700'
                    }`}
                  >
                    {data.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-ink-500">No payment history available</p>
          ) : (
            <div className="space-y-2">
              {payments.slice(0, 5).map((payment: any) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 bg-ink-50 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {payment.currency} {payment.amount}
                    </p>
                    <p className="text-xs text-ink-500">
                      {new Date(payment.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    className={
                      payment.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-700'
                        : payment.status === 'pending'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                    }
                  >
                    {payment.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activityLogs.length === 0 ? (
            <p className="text-sm text-ink-500">No activity logs available</p>
          ) : (
            <div className="space-y-2">
              {activityLogs.slice(0, 10).map((log: any) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-2 hover:bg-ink-50 rounded"
                >
                  <div>
                    <p className="text-sm font-medium">{log.action}</p>
                    <p className="text-xs text-ink-500">{log.description}</p>
                  </div>
                  <p className="text-xs text-ink-400">
                    {new Date(log.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
