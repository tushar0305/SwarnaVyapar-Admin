import { Suspense } from 'react';
import { TrendingUp, Users, Store, Activity, Flag, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getPlatformStats,
  getShopGrowth,
  getUserActivityMetrics,
  getSubscriptionDistribution,
  getRecentActivity,
} from '@/services/analytics.service';
import { getUsageMetrics } from '@/services/shop-analytics.service';
import { PageHeader } from '../_components/page-header';
import { PageSkeleton } from '../_components/page-skeleton';

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

async function AnalyticsBody() {
  const emptyDist = { byStatus: [] as { status: string; count: number }[], byPlan: [] as { plan: string; count: number }[] };
  const emptyUsage = {
    totalInvoices: 0,
    totalCustomers: 0,
    totalInventory: 0,
    totalUsers: 0,
    shopCount: 0,
    avgInvoicesPerShop: 0,
    avgCustomersPerShop: 0,
    periodAiTokens: 0,
    periodInvoices: 0,
    periodCustomers: 0,
    totalProducts: 0,
  };

  const [
    platformStats,
    shopGrowth,
    userMetrics,
    subscriptions,
    recentActivity,
    usage,
  ] = await Promise.all([
    safe(() => getPlatformStats(), {
      totalShops: 0,
      activeShops: 0,
      suspendedShops: 0,
      totalUsers: 0,
      totalAuditLogs: 0,
      totalFeatureFlags: 0,
      enabledFeatureFlags: 0,
    }),
    safe(() => getShopGrowth(), []),
    safe(() => getUserActivityMetrics(), {
      totalUserRoles: 0,
      activeUserRoles: 0,
      inactiveUserRoles: 0,
      avgUsersPerShop: 0,
    }),
    safe(() => getSubscriptionDistribution(), emptyDist),
    safe(() => getRecentActivity(), { recentShops: [], recentActions: [] }),
    safe(() => getUsageMetrics(), emptyUsage),
  ]);

  return (
    <div className="space-y-6">
<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">
              Total Shops
            </CardTitle>
            <Store className="w-4 h-4 text-gold-700" />
          </CardHeader>
          <CardContent>
            <div className="tnum text-xl font-semibold">{platformStats.totalShops}</div>
            <p className="text-xs text-ink-500 mt-1">
              {platformStats.activeShops} active ·{' '}
              {platformStats.suspendedShops} suspended
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">
              Total User Roles
            </CardTitle>
            <Users className="w-4 h-4 text-gold-700" />
          </CardHeader>
          <CardContent>
            <div className="tnum text-xl font-semibold">{platformStats.totalUsers}</div>
            <p className="text-xs text-ink-500 mt-1">
              Avg {userMetrics.avgUsersPerShop} per shop
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">
              Feature Flags
            </CardTitle>
            <Flag className="w-4 h-4 text-gold-700" />
          </CardHeader>
          <CardContent>
            <div className="tnum text-xl font-semibold">
              {platformStats.totalFeatureFlags}
            </div>
            <p className="text-xs text-ink-500 mt-1">
              {platformStats.enabledFeatureFlags} enabled globally
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-gold-700" />
            Usage totals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-ink-500">Invoices</p>
              <p className="tnum text-xl font-semibold">{usage.totalInvoices}</p>
            </div>
            <div>
              <p className="text-sm text-ink-500">Customers</p>
              <p className="tnum text-xl font-semibold">{usage.totalCustomers}</p>
            </div>
            <div>
              <p className="text-sm text-ink-500">Inventory</p>
              <p className="tnum text-xl font-semibold">{usage.totalInventory}</p>
            </div>
            <div>
              <p className="text-sm text-ink-500">Avg inv / shop</p>
              <p className="tnum text-xl font-semibold">{usage.avgInvoicesPerShop}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-gold-700" />
            User Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-ink-500">Total User Roles</p>
              <p className="tnum text-xl font-semibold text-gold-700">
                {userMetrics.totalUserRoles}
              </p>
            </div>
            <div>
              <p className="text-sm text-ink-500">Active</p>
              <p className="tnum text-xl font-semibold text-emerald-600">
                {userMetrics.activeUserRoles}
              </p>
            </div>
            <div>
              <p className="text-sm text-ink-500">Inactive</p>
              <p className="tnum text-xl font-semibold text-ink-600">
                {userMetrics.inactiveUserRoles}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gold-700" />
            Shop Growth (by month)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {shopGrowth.length === 0 ? (
            <p className="text-sm text-ink-500">No data available</p>
          ) : (
            <div className="space-y-2">
              {shopGrowth.map((item) => (
                <div
                  key={item.month}
                  className="flex items-center justify-between p-3 bg-ink-50 rounded"
                >
                  <span className="text-sm font-medium">{item.month}</span>
                  <span className="text-sm text-gold-700 font-semibold">
                    {item.count} shops
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-gold-700" />
              Subscription status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subscriptions.byStatus.length === 0 ? (
              <p className="text-sm text-ink-500">No subscriptions found</p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {subscriptions.byStatus.map((item) => (
                  <div key={item.status} className="text-center">
                    <p className="tnum text-xl font-semibold text-gold-700">
                      {item.count}
                    </p>
                    <p className="text-sm text-ink-500 capitalize">
                      {item.status}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plan mix</CardTitle>
          </CardHeader>
          <CardContent>
            {subscriptions.byPlan.length === 0 ? (
              <p className="text-sm text-ink-500">No plans</p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {subscriptions.byPlan.map((item) => (
                  <div key={item.plan} className="text-center">
                    <p className="tnum text-xl font-semibold text-gold-700">
                      {item.count}
                    </p>
                    <p className="text-sm text-ink-500 capitalize">{item.plan}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader>
            <CardTitle>Recent Shops</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.recentShops.length === 0 ? (
              <p className="text-sm text-ink-500">No recent shops</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.recentShops.map(
                  (shop: { id: string; shop_name: string; created_at: string }) => (
                    <div
                      key={shop.id}
                      className="flex items-center justify-between p-2 hover:bg-ink-50 rounded"
                    >
                      <div>
                        <p className="text-sm font-medium">{shop.shop_name}</p>
                        <p className="text-xs text-ink-500">
                          {new Date(shop.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Admin Actions</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.recentActions.length === 0 ? (
              <p className="text-sm text-ink-500">No recent actions</p>
            ) : (
              <div className="space-y-2">
                {recentActivity.recentActions
                  .slice(0, 5)
                  .map((action: { id: string; action: string; created_at: string }) => (
                    <div
                      key={action.id}
                      className="flex items-center justify-between p-2 hover:bg-ink-50 rounded text-sm"
                    >
                      <span className="font-medium">{action.action}</span>
                      <span className="text-ink-500 text-xs">
                        {new Date(action.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Analytics"
        subtitle="Growth and mix. Day-to-day sales, dues, and wallets are on Overview and each shop workspace."
      />
      <Suspense fallback={<PageSkeleton hideHeader metrics={3} panels={2} />}>
        <AnalyticsBody />
      </Suspense>
    </div>
  );
}
