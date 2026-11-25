import { formatDateTime } from '@/lib/utils';
import type { DiscoveryRunRow } from '@/services/lead-discovery.service';

export function RunHistory({ runs }: { runs: DiscoveryRunRow[] }) {
  if (!runs.length) {
    return (
      <p className="text-xs text-ink-400">No discovery runs yet. Cost-per-lead appears after the first run.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead>
          <tr className="border-b border-ink-100 text-[10px] uppercase tracking-wide text-ink-400">
            <th className="px-2 py-2 font-medium">When</th>
            <th className="px-2 py-2 font-medium">Where</th>
            <th className="px-2 py-2 font-medium">Credits</th>
            <th className="px-2 py-2 font-medium">Saved</th>
            <th className="px-2 py-2 font-medium">Shops / credit</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const per =
              run.billed > 0 ? Math.round((run.upserted / run.billed) * 10) / 10 : null;
            return (
              <tr key={run.id} className="border-b border-ink-50 text-ink-700">
                <td className="px-2 py-2">{formatDateTime(run.created_at)}</td>
                <td className="px-2 py-2">
                  {run.city}
                  {run.neighbourhood ? ` · ${run.neighbourhood}` : ''}
                  <div className="text-ink-400">{(run.keywords || []).join(', ')}</div>
                </td>
                <td className="px-2 py-2">
                  {run.billed} billed
                  {run.cached ? ` · ${run.cached} cached` : ''}
                </td>
                <td className="px-2 py-2">{run.upserted}</td>
                <td className="px-2 py-2">{per != null ? per : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
