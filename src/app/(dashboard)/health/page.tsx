import { Suspense } from 'react';
import { Activity, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  getDatabaseHealth,
  getServiceStatuses,
  getHealthSnapshots,
  getErrorRateMetrics,
} from '@/services/system-health.service';
import { getRecentJobRuns } from '@/services/tenant.service';
import { formatDateTime } from '@/lib/utils';
import { PageHeader } from '../_components/page-header';
import { PageSkeleton } from '../_components/page-skeleton';

const statusColors = {
  healthy: 'bg-emerald-100 text-emerald-700',
  operational: 'bg-emerald-100 text-emerald-700',
  degraded: 'bg-amber-100 text-amber-700',
  down: 'bg-red-100 text-red-700',
};

const statusIcons = {
  healthy: CheckCircle,
  operational: CheckCircle,
  degraded: AlertCircle,
  down: AlertCircle,
};

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

async function HealthBody() {
  const [dbHealth, services, snapshots, errorMetrics, jobRuns] = await Promise.all([
    safe(() => getDatabaseHealth(), {
      status: 'down' as const,
      latency: 0,
      lastChecked: new Date().toISOString(),
    }),
    safe(() => getServiceStatuses(), []),
    safe(() => getHealthSnapshots(10), []),
    safe(() => getErrorRateMetrics(), {
      totalActions: 0,
      errorActions: 0,
      errorRate: 0,
      period: '24h',
    }),
    safe(() => getRecentJobRuns(200), []),
  ]);

  const latestByJob = new Map<string, (typeof jobRuns)[number]>();
  for (const run of jobRuns) {
    if (!latestByJob.has(run.job_name)) latestByJob.set(run.job_name, run);
  }
  const jobs = [...latestByJob.values()].sort((a, b) => a.job_name.localeCompare(b.job_name));
  const failures = jobRuns.filter((run) => run.status !== 'success').slice(0, 10);

  return (
    <div className="space-y-6">
<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">
              Database
            </CardTitle>
            <Activity className="w-4 h-4 text-ink-500" />
          </CardHeader>
          <CardContent>
            <Badge
              className={
                statusColors[dbHealth.status] || 'bg-ink-100 text-ink-700'
              }
            >
              {dbHealth.status}
            </Badge>
            <p className="tnum text-xl font-semibold mt-2">{dbHealth.latency}ms</p>
            <p className="text-xs text-ink-500 mt-1">Query latency</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">
              Error rate (24h)
            </CardTitle>
            <AlertCircle className="w-4 h-4 text-ink-500" />
          </CardHeader>
          <CardContent>
            <p className="tnum text-xl font-semibold">
              {errorMetrics.errorRate.toFixed(2)}%
            </p>
            <p className="text-xs text-ink-500 mt-1">
              {errorMetrics.errorActions} / {errorMetrics.totalActions} admin
              actions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">
              Services checked
            </CardTitle>
            <CheckCircle className="w-4 h-4 text-ink-500" />
          </CardHeader>
          <CardContent>
            <p className="tnum text-xl font-semibold">{services.length}</p>
            <p className="text-xs text-ink-500 mt-1">
              {
                services.filter((s) => s.status === 'operational').length
              }{' '}
              operational
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scheduled jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-ink-500">No job runs recorded in cron_job_runs.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="py-2 font-medium">Job</th>
                    <th className="py-2 font-medium">Last status</th>
                    <th className="py-2 text-right font-medium">Rows</th>
                    <th className="py-2 text-right font-medium">Last run</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {jobs.map((job) => (
                    <tr key={job.job_name}>
                      <td className="py-2 font-medium text-ink-900">{job.job_name}</td>
                      <td className="py-2">
                        <Badge
                          className={
                            job.status === 'success'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-700'
                          }
                        >
                          {job.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-right tabular-nums">{job.affected ?? 0}</td>
                      <td className="py-2 text-right text-ink-500">
                        {job.started_at ? formatDateTime(job.started_at) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {failures.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                Recent failures
              </p>
              {failures.map((run, index) => (
                <div key={`${run.job_name}-${index}`} className="rounded-lg bg-red-50 p-3 text-sm">
                  <p className="font-medium text-red-800">
                    {run.job_name} · {run.started_at ? formatDateTime(run.started_at) : ''}
                  </p>
                  <p className="mt-1 text-xs text-red-700">{run.error ?? 'No error text'}</p>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Service status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {services.map((service) => {
              const Icon =
                statusIcons[service.status as keyof typeof statusIcons] ||
                AlertCircle;
              return (
                <div
                  key={service.name}
                  className="flex items-center justify-between p-3 bg-ink-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-ink-500" />
                    <span className="text-sm font-medium">{service.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {service.latency != null && (
                      <span className="text-xs text-ink-500">
                        {service.latency}ms
                      </span>
                    )}
                    <Badge
                      className={
                        statusColors[
                          service.status as keyof typeof statusColors
                        ] || 'bg-ink-100 text-ink-700'
                      }
                    >
                      {service.status}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent health snapshots</CardTitle>
        </CardHeader>
        <CardContent>
          {snapshots.length === 0 ? (
            <p className="text-sm text-ink-500">
              No snapshots yet. Snapshots are written by createHealthSnapshot().
            </p>
          ) : (
            <div className="space-y-3">
              {snapshots.map((snapshot) => (
                <div
                  key={snapshot.id}
                  className="flex items-center justify-between p-3 bg-ink-50 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <Activity className="w-4 h-4 text-ink-400" />
                    <div>
                      <p className="text-sm font-medium">
                        Avg response:{' '}
                        {snapshot.avg_response_time_ms ?? '—'}ms
                      </p>
                      <p className="text-xs text-ink-500">
                        {snapshot.active_shops ?? 0} active shops ·{' '}
                        {snapshot.suspended_shops ?? 0} suspended ·{' '}
                        {snapshot.total_users ?? 0} users
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-ink-500">
                    {snapshot.snapshot_at
                      ? new Date(snapshot.snapshot_at).toLocaleString()
                      : '—'}
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

export default function HealthPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="System health"
        subtitle="Live database, services, cron jobs, and recent failures."
      />
      <Suspense fallback={<PageSkeleton hideHeader metrics={3} panels={2} />}>
        <HealthBody />
      </Suspense>
    </div>
  );
}
