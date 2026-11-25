import Link from 'next/link';
import type { AreaAnalyticsRow } from '@/lib/lead-discovery';

export function AreaAnalytics({ rows }: { rows: AreaAnalyticsRow[] }) {
  if (!rows.length) {
    return (
      <p className="text-xs text-ink-400">
        Area opportunity map fills after you discover shops across neighbourhoods.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-xs">
        <thead>
          <tr className="border-b border-ink-100 text-[10px] uppercase tracking-wide text-ink-400">
            <th className="px-2 py-2 font-medium">Area</th>
            <th className="px-2 py-2 font-medium">Shops</th>
            <th className="px-2 py-2 font-medium">Digital gap</th>
            <th className="px-2 py-2 font-medium">High score</th>
            <th className="px-2 py-2 font-medium">Avg score</th>
            <th className="px-2 py-2 font-medium">Opportunity</th>
            <th className="px-2 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const params = new URLSearchParams();
            params.set('city', row.city);
            if (row.digitalGap > 0) params.set('digitalGap', 'yes');
            params.set('sort', 'score');
            return (
              <tr key={row.key} className="border-b border-ink-50 text-ink-700">
                <td className="px-2 py-2">
                  <span className="font-medium text-ink-900">{row.city}</span>
                  <div className="text-ink-400">{row.neighbourhood || 'City-wide / mixed'}</div>
                </td>
                <td className="px-2 py-2">
                  {row.total}
                  <div className="text-ink-400">{row.withPhone} phone</div>
                </td>
                <td className="px-2 py-2">
                  {row.digitalGap}
                  <div className="text-ink-400">
                    {row.total ? Math.round((row.digitalGap / row.total) * 100) : 0}%
                  </div>
                </td>
                <td className="px-2 py-2">{row.highScore}</td>
                <td className="px-2 py-2">{row.avgScore}</td>
                <td className="px-2 py-2">
                  <span className="font-serif text-base text-ink-900">{row.opportunity}</span>
                  <div className="text-ink-400">
                    {row.contacted} in pipeline · {row.converted} converted
                  </div>
                </td>
                <td className="px-2 py-2">
                  <Link
                    href={`/leads/discover?${params.toString()}`}
                    className="text-gold-700 hover:underline"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-ink-400">
        Opportunity ranks areas with uncontacted independent shops that look offline-strong /
        digitally weak — best places to pitch Catalogue + billing.
      </p>
    </div>
  );
}
