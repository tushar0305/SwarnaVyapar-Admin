import Link from 'next/link';
import { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SERPAPI_FREE_WARN_AT } from '@/lib/lead-discovery';
import { formatNumber } from '@/lib/utils';
import {
  getAiSalesConfig,
  getDiscoveryAreaAnalytics,
  getDiscoveryFunnelStats,
  getSerpApiUsage,
  listDiscoveredLeads,
  listDiscoveryCities,
  listDiscoveryRuns,
  listMarketMapPoints,
  listSavedDiscoverySearches,
  type DiscoveryListFilters,
} from '@/services/lead-discovery.service';
import { Metric } from '../../_components/metric';
import { PageFrame } from '../../_components/page-frame';
import { PageHeader } from '../../_components/page-header';
import { AreaAnalytics } from './_components/area-analytics';
import { DiscoverFilters } from './_components/discover-filters';
import { DiscoverForm } from './_components/discover-form';
import { DiscoverToolbar } from './_components/discover-toolbar';
import { DiscoveredLeadsTable } from './_components/discovered-leads-table';
import { FunnelAnalytics } from './_components/funnel-analytics';
import { MarketMapDynamic } from './_components/map-dynamic';
import { RunHistory } from './_components/run-history';

export const dynamic = 'force-dynamic';

function readParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed || undefined;
}

export default async function LeadDiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters: DiscoveryListFilters = {
    q: readParam(params.q),
    city: readParam(params.city),
    status: readParam(params.status),
    contact: readParam(params.contact),
    band: readParam(params.band),
    digitalGap: readParam(params.digitalGap),
    due: readParam(params.due),
    sort: readParam(params.sort),
    page: readParam(params.page),
  };

  const [usage, board, runs, areas, mapPoints, aiConfig, cities, funnel, savedSearches] =
    await Promise.all([
      getSerpApiUsage(),
      listDiscoveredLeads(filters),
      listDiscoveryRuns(8),
      getDiscoveryAreaAnalytics(),
      listMarketMapPoints(),
      getAiSalesConfig(),
      listDiscoveryCities(),
      getDiscoveryFunnelStats(),
      listSavedDiscoverySearches(),
    ]);

  const pageCount = Math.max(1, Math.ceil(board.total / board.pageSize));
  const usageTone = usage.used >= SERPAPI_FREE_WARN_AT ? 'attention' : 'default';

  const lastRun = runs[0];
  const lastEfficiency =
    lastRun && lastRun.billed > 0
      ? Math.round((lastRun.upserted / lastRun.billed) * 10) / 10
      : null;

  return (
    <PageFrame>
      <PageHeader
        eyebrow="People"
        title="Jewellery prospecting"
        subtitle="Pick an area on the OSM map (free config), scrape with SerpApi only on Discover, score digital-gap fit, and generate Gemini Hinglish scripts. Staging expires in 90 days — human outreach only."
        actions={
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex h-9 items-center rounded-md border border-ink-200 px-3 text-xs text-ink-500">
              AI {aiConfig.configured ? 'Gemini ready' : 'needs GEMINI_API_KEY'}
            </span>
            <Link
              href="/leads"
              className="inline-flex h-9 items-center rounded-md border border-ink-300 bg-white px-3 text-sm text-ink-700 hover:bg-ink-50"
            >
              Back to user leads
            </Link>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric
          label="SerpApi this month"
          value={`${usage.used}/${usage.limit}`}
          scope="Tracked billed searches (Free budget)"
          tone={usageTone}
        />
        <Metric
          label="Remaining"
          value={formatNumber(usage.remaining)}
          scope={`${usage.enrichRemainingToday} enrich left today`}
        />
        <Metric
          label="High-score"
          value={formatNumber(board.counts.high || 0)}
          scope={`${formatNumber(board.counts.digital_gap || 0)} with digital gap`}
          tone={(board.counts.high || 0) > 0 ? 'attention' : 'default'}
        />
        <Metric
          label="Follow-ups due"
          value={formatNumber(board.dueCount)}
          scope={
            lastEfficiency != null
              ? `Last run ${lastEfficiency} shops/credit`
              : `${formatNumber(board.counts.with_phone || 0)} with phone`
          }
          href="/leads/discover?due=1"
          tone={board.dueCount > 0 ? 'attention' : 'default'}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run discovery</CardTitle>
        </CardHeader>
        <CardContent>
          <DiscoverForm
            remaining={usage.remaining}
            configured={usage.configured}
            savedSearches={savedSearches}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funnel · pipeline & cost</CardTitle>
        </CardHeader>
        <CardContent>
          <FunnelAnalytics stats={funnel} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Market map · density & digital gap</CardTitle>
        </CardHeader>
        <CardContent>
          <MarketMapDynamic points={mapPoints} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Area opportunity ranking</CardTitle>
        </CardHeader>
        <CardContent>
          <AreaAnalytics rows={areas} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent runs · cost efficiency</CardTitle>
        </CardHeader>
        <CardContent>
          <RunHistory runs={runs} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">
              Prospects ({formatNumber(board.total)})
            </CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs text-ink-400">
                New {board.counts.new || 0} · Contacted {board.counts.contacted || 0} · Demo{' '}
                {board.counts.demo || 0} · Qualified {board.counts.qualified || 0}
              </p>
              <DiscoverToolbar />
            </div>
          </div>
          <Suspense fallback={<p className="text-xs text-ink-400">Loading filters…</p>}>
            <DiscoverFilters cities={cities.length ? cities : ['Lucknow']} />
          </Suspense>
        </CardHeader>
        <CardContent>
          <DiscoveredLeadsTable rows={board.rows} filters={filters} />
          {pageCount > 1 ? (
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => {
                const next = new URLSearchParams();
                for (const [key, value] of Object.entries(filters)) {
                  if (value && key !== 'page') next.set(key, value);
                }
                if (page > 1) next.set('page', String(page));
                const href = next.toString()
                  ? `/leads/discover?${next.toString()}`
                  : '/leads/discover';
                return (
                  <Link
                    key={page}
                    href={href}
                    className={
                      page === board.page
                        ? 'rounded-md bg-ink-900 px-2.5 py-1 text-white'
                        : 'rounded-md border border-ink-200 px-2.5 py-1 text-ink-600 hover:bg-ink-50'
                    }
                  >
                    {page}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </PageFrame>
  );
}
