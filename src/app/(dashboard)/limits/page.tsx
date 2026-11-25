import { Suspense } from 'react';
import { getAllLimitOverrides, getLimitStatistics } from '@/services/limit-management.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';
import { TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { CreateLimitOverride } from './_components/create-limit-override';
import { LimitActions } from './_components/limit-actions';
import { PageHeader } from '../_components/page-header';

interface LimitsPageProps {
  searchParams: Promise<{
    shopId?: string;
    active?: string;
    page?: string;
  }>;
}

type LimitsFilters = Awaited<LimitsPageProps['searchParams']>;

async function LimitStats() {
  const stats = await getLimitStatistics();

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Overrides</CardTitle>
          <TrendingUp className="h-4 w-4 text-ink-600" />
        </CardHeader>
        <CardContent>
          <div className="tnum text-xl font-semibold">{stats.total}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active</CardTitle>
          <TrendingUp className="h-4 w-4 text-emerald-600" />
        </CardHeader>
        <CardContent>
          <div className="tnum text-xl font-semibold text-emerald-600">{stats.active}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Expired</CardTitle>
          <TrendingDown className="h-4 w-4 text-ink-600" />
        </CardHeader>
        <CardContent>
          <div className="tnum text-xl font-semibold text-ink-600">{stats.expired}</div>
        </CardContent>
      </Card>
    </div>
  );
}

async function LimitsTable({ searchParams }: { searchParams: LimitsFilters }) {
  const page = Number(searchParams.page) || 1;
  const limit = 50;
  const offset = (page - 1) * limit;

  const { data: overrides, count } = await getAllLimitOverrides({
    shopId: searchParams.shopId,
    active:
      searchParams.active === 'true'
        ? true
        : searchParams.active === 'false'
          ? false
          : undefined,
    limit,
    offset,
  });

  const totalPages = count ? Math.ceil(count / limit) : 0;

  const isActive = (expiresAt: string | null) => {
    if (!expiresAt) return true;
    return new Date(expiresAt) > new Date();
  };

  if (!overrides || overrides.length === 0) {
    return (
      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-12 w-12 text-ink-400 mb-4" />
            <p className="text-ink-600">No limit overrides found</p>
            <p className="text-sm text-ink-500 mt-2">
              Create custom limits for specific shops
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-ink-50 border-b">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                    Shop
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                    Limit
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                    Value
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                    Status
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                    Expires
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                    Reason
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-ink-50">
                {overrides.map((override: any) => (
                  <tr key={override.id} className="hover:bg-ink-50">
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="text-sm font-medium text-ink-900">
                        {override.shop?.shop_name || 'Unknown'}
                      </div>
                      {override.shop?.gst_number && (
                        <div className="text-sm text-ink-500">
                          {override.shop.gst_number}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-sm text-ink-900">
                      {override.limit_key}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-sm text-ink-900">
                      {override.override_value === -1
                        ? '∞'
                        : override.override_value}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <Badge
                        variant={isActive(override.expires_at) ? 'default' : 'secondary'}
                      >
                        {isActive(override.expires_at) ? 'Active' : 'Expired'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-sm text-ink-500">
                      {override.expires_at
                        ? formatDateTime(override.expires_at)
                        : 'Never'}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-ink-600 max-w-md">
                      <p className="truncate">{override.reason}</p>
                      {override.notes && (
                        <p className="text-xs text-ink-500 truncate mt-1">
                          {override.notes}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-sm">
                      <LimitActions
                        overrideId={override.id}
                        shopName={override.shop?.name || 'Unknown'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-600">
            Showing {offset + 1} to {Math.min(offset + limit, count || 0)} of{' '}
            {count} overrides
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`/limits?page=${page - 1}${
                  searchParams?.active ? `&active=${searchParams.active}` : ''
                }`}
                className="px-4 py-2 text-sm border rounded-md hover:bg-ink-50"
              >
                Previous
              </a>
            )}
            <span className="px-4 py-2 text-sm border rounded-md bg-ink-50">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <a
                href={`/limits?page=${page + 1}${
                  searchParams?.active ? `&active=${searchParams.active}` : ''
                }`}
                className="px-4 py-2 text-sm border rounded-md hover:bg-ink-50"
              >
                Next
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default async function LimitsPage({ searchParams }: LimitsPageProps) {
  const params = await searchParams;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Product"
        title="Limit overrides"
        subtitle="Custom quotas and limits for specific shops."
        actions={<CreateLimitOverride />}
      />

      <Suspense
        fallback={
          <div className="grid gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent>
                  <div className="h-20 bg-ink-100 animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        }
      >
        <LimitStats />
      </Suspense>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter limit overrides</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" action="/limits" className="flex gap-4">
            <select
              name="active"
              defaultValue={params.active || ''}
              className="px-4 py-2 border rounded-md text-sm"
            >
              <option value="">All Status</option>
              <option value="true">Active Only</option>
              <option value="false">Expired Only</option>
            </select>
            <button
              type="submit"
              className="px-6 py-2 bg-ink-900 text-white rounded-md hover:bg-ink-800"
            >
              Apply
            </button>
            {params.active && (
              <a
                href="/limits"
                className="px-6 py-2 border rounded-md hover:bg-ink-50"
              >
                Clear
              </a>
            )}
          </form>
        </CardContent>
      </Card>

      <Suspense
        fallback={
          <Card>
            <CardContent>
              <p className="text-center text-ink-600">Loading overrides...</p>
            </CardContent>
          </Card>
        }
      >
        <LimitsTable searchParams={params} />
      </Suspense>
    </div>
  );
}
