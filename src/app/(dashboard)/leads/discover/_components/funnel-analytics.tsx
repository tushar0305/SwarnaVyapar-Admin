import Link from 'next/link';
import {
  DISCOVERED_LEAD_CLOSED_STATUSES,
  DISCOVERED_LEAD_STATUSES,
  DISCOVERED_LEAD_STATUS_LABEL,
} from '@/lib/lead-discovery';
import { formatNumber } from '@/lib/utils';
import type { DiscoveryFunnelStats } from '@/services/lead-discovery.service';

export function FunnelAnalytics({ stats }: { stats: DiscoveryFunnelStats }) {
  const stages = DISCOVERED_LEAD_STATUSES.filter(
    (s) => !DISCOVERED_LEAD_CLOSED_STATUSES.includes(s)
  );
  const max = Math.max(1, ...stages.map((s) => stats.byStatus[s]));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Active prospects" value={formatNumber(stats.totalActive)} hint={`${stats.withPhone} with phone`} />
        <Stat
          label="Contact rate"
          value={stats.contactRate != null ? `${stats.contactRate}%` : '—'}
          hint={`${stats.contactedPlus} moved past new`}
        />
        <Stat
          label="Demo rate"
          value={stats.demoRate != null ? `${stats.demoRate}%` : '—'}
          hint="Of contacted+"
        />
        <Stat
          label="Month shops/credit"
          value={stats.shopsPerCredit != null ? String(stats.shopsPerCredit) : '—'}
          hint={`${stats.monthUpserted} saved · ${stats.monthBilled} billed`}
        />
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
          Pipeline
        </p>
        <ul className="space-y-2">
          {stages.map((status) => {
            const count = stats.byStatus[status];
            const width = Math.max(4, Math.round((count / max) * 100));
            return (
              <li key={status} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 text-ink-600">
                  {DISCOVERED_LEAD_STATUS_LABEL[status]}
                </span>
                <div className="h-2 min-w-0 flex-1 rounded-full bg-ink-100">
                  <div
                    className="h-2 rounded-full bg-ink-800"
                    style={{ width: `${width}%` }}
                  />
                </div>
                <Link
                  href={`/leads/discover?status=${status}`}
                  className="w-10 shrink-0 text-right tabular-nums text-ink-700 hover:text-gold-700"
                >
                  {count}
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[11px] text-ink-400">
          Not interested {stats.byStatus.not_interested} · Lost {stats.byStatus.lost} · Dismissed{' '}
          {stats.byStatus.dismissed} · High-score {stats.highScore} · Digital gap {stats.digitalGap}
        </p>
      </div>

      {stats.topAreas.length ? (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            Top areas by high-score
          </p>
          <ul className="divide-y divide-ink-50 text-sm">
            {stats.topAreas.map((area) => (
              <li
                key={`${area.city}-${area.area}`}
                className="flex items-center justify-between gap-3 py-1.5"
              >
                <span className="min-w-0 truncate text-ink-700">
                  {area.area}
                  <span className="text-ink-400"> · {area.city}</span>
                </span>
                <span className="shrink-0 text-xs text-ink-500">
                  {area.high} high / {area.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-md border border-ink-100 bg-ink-50/60 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">{label}</p>
      <p className="mt-0.5 font-serif text-xl text-ink-900">{value}</p>
      <p className="text-[11px] text-ink-500">{hint}</p>
    </div>
  );
}
