import { Suspense } from 'react';
import Link from 'next/link';
import { getAuditLog } from '@/services/admin-auth.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatDateTime } from '@/lib/utils';
import { Activity, Search } from 'lucide-react';
import { PageHeader } from '../_components/page-header';

interface AuditPageProps {
  searchParams: Promise<{
    action?: string;
    page?: string;
    search?: string;
  }>;
}

type AuditFilters = Awaited<AuditPageProps['searchParams']>;

async function AuditLogTable({ searchParams }: { searchParams: AuditFilters }) {
  const page = Number(searchParams?.page) || 1;
  const limit = 50;
  const offset = (page - 1) * limit;

  const { data: logs, count } = await getAuditLog({
    action: searchParams?.action,
    search: searchParams?.search,
    limit,
    offset,
  });

  const totalPages = count ? Math.ceil(count / limit) : 0;

  const getActionColor = (action: string) => {
    switch (action) {
      case 'shop_suspended':
        return 'destructive';
      case 'shop_unsuspended':
        return 'default';
      case 'limit_updated':
        return 'secondary';
      case 'feature_toggled':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getActionLabel = (action: string) => {
    return action
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  function targetHref(log: {
    target_type?: string | null;
    target_id?: string | null;
    changes?: Record<string, unknown> | null;
  }) {
    const changes = log.changes || {};
    const shopId =
      (typeof changes.shop_id === 'string' && changes.shop_id) ||
      (log.target_type === 'shop' ? log.target_id : null);
    if (shopId) return `/shops/${shopId}`;
    if (log.target_type === 'user') return '/users';
    if (log.target_type === 'subscription') return '/subscriptions';
    if (log.target_type === 'announcement') return '/announcements';
    return null;
  }

  if (!logs || logs.length === 0) {
    return (
      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Activity className="h-12 w-12 text-ink-400 mb-4" />
            <p className="text-ink-600">No audit entries found</p>
            <p className="text-sm text-ink-500 mt-2">
              Admin actions will appear here
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
                    Timestamp
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                    Admin
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                    Action
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                    Target
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-ink-50">
                {logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-ink-50">
                    <td className="px-3 py-2.5 whitespace-nowrap text-sm text-ink-900">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="text-sm font-medium text-ink-900">
                        {log.admin?.name ||
                          log.changes?.actor_name ||
                          (log.changes?.actor === 'local_bypass' ? 'Local bypass' : 'System')}
                      </div>
                      <div className="text-sm text-ink-500">
                        {log.admin?.email || log.changes?.actor_email || ''}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <Badge variant={getActionColor(log.action)}>
                        {getActionLabel(log.action)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-sm text-ink-900">
                      <div className="font-medium">{log.target_type || '—'}</div>
                      {(() => {
                        const href = targetHref(log);
                        if (!log.target_id && !href) return null;
                        const label = log.target_id
                          ? `${String(log.target_id).slice(0, 8)}…`
                          : 'Open';
                        return href ? (
                          <Link href={href} className="font-mono text-xs text-gold-700 hover:underline">
                            {label}
                          </Link>
                        ) : (
                          <div className="font-mono text-xs text-ink-500">{label}</div>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-ink-600 max-w-md">
                      <p className="truncate">{log.reason || '—'}</p>
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
            {count} entries
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`/audit?page=${page - 1}${
                  searchParams?.action ? `&action=${searchParams.action}` : ''
                }${searchParams?.search ? `&search=${searchParams.search}` : ''}`}
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
                href={`/audit?page=${page + 1}${
                  searchParams?.action ? `&action=${searchParams.action}` : ''
                }${searchParams?.search ? `&search=${searchParams.search}` : ''}`}
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

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const params = await searchParams;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Audit log"
        subtitle="Complete trail of super-admin actions."
      />

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter audit log entries</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" action="/audit" className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
              <Input
                type="text"
                name="search"
                placeholder="Search details, shop names..."
                defaultValue={params.search}
                className="pl-10"
              />
            </div>
            <select
              name="action"
              defaultValue={params.action || ''}
              className="px-4 py-2 border rounded-md text-sm"
            >
              <option value="">All Actions</option>
              <option value="shop_suspended">Shop Suspended</option>
              <option value="shop_unsuspended">Shop Unsuspended</option>
              <option value="limit_updated">Limit Updated</option>
              <option value="feature_toggled">Feature Toggled</option>
              <option value="subscription_updated">Subscription Updated</option>
              <option value="notification_sent">Notification Sent</option>
              <option value="activation_nudge_sent">Activation Nudge</option>
              <option value="announcement_created">Announcement Created</option>
            </select>
            <button
              type="submit"
              className="px-6 py-2 bg-ink-900 text-white rounded-md hover:bg-ink-800"
            >
              Apply
            </button>
            {(params.action || params.search) && (
              <a
                href="/audit"
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
              <p className="text-center text-ink-600">Loading audit log...</p>
            </CardContent>
          </Card>
        }
      >
        <AuditLogTable searchParams={params} />
      </Suspense>
    </div>
  );
}
