import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  JOIN_LABEL,
  PIPELINE_LABEL,
  planLabel,
  type LeadSortKey,
  type PipelineStatus,
} from '@/lib/lead-score';
import { cn, formatDate, formatDateTime, formatNumber, getRelativeTime } from '@/lib/utils';
import {
  getLeadBoard,
  type LeadListFilters,
  type LeadRow,
} from '@/services/lead-intelligence.service';
import { Metric } from '../_components/metric';
import { PageHeader } from '../_components/page-header';
import { PageFrame } from '../_components/page-frame';
import { EmptyState } from '../_components/empty-state';
import { LeadFilters } from './_components/lead-filters';

export const dynamic = 'force-dynamic';

const PIPELINE_VARIANT: Record<
  PipelineStatus,
  'outline' | 'secondary' | 'info' | 'gold' | 'warning' | 'success' | 'destructive'
> = {
  unreviewed: 'outline',
  new: 'secondary',
  contacted: 'info',
  callback: 'warning',
  no_answer: 'secondary',
  interested: 'gold',
  not_interested: 'destructive',
  demo: 'warning',
  converted: 'success',
  lost: 'destructive',
};

const TABLE_COLUMNS: { key: LeadSortKey; label: string; className?: string }[] = [
  { key: 'person', label: 'Person' },
  { key: 'shop', label: 'Shop' },
  { key: 'signed_up', label: 'Signed up' },
  { key: 'last_active', label: 'Last active' },
  { key: 'score', label: 'Score' },
  { key: 'status', label: 'Status' },
  { key: 'note', label: 'Note', className: 'min-w-[180px]' },
  { key: 'next', label: 'Next' },
];

function readParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

function queryHref(filters: LeadListFilters, page?: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (!value || key === 'page') continue;
    params.set(key, value);
  }
  if (page && page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/leads?${query}` : '/leads';
}

function sortHref(filters: LeadListFilters, key: LeadSortKey) {
  const active = filters.sort === key;
  const nextDir = active && filters.dir !== 'asc' ? 'asc' : 'desc';
  return queryHref({ ...filters, sort: key, dir: nextDir, page: undefined }, 1);
}

function displayName(row: LeadRow) {
  return row.name || row.email || 'Unnamed account';
}

function LeadIdentity({ row }: { row: LeadRow }) {
  return (
    <div className="min-w-0">
      <Link href={`/leads/${row.id}`} className="font-medium text-ink-900 hover:text-gold-700">
        {displayName(row)}
      </Link>
      <p className="truncate text-xs text-ink-500">
        {row.name && row.email ? row.email : row.role || 'No shop role'}
        {row.highIntent ? ' · High intent' : ''}
      </p>
      {row.reasons[0] ? (
        <p className="mt-1 line-clamp-2 text-xs text-ink-600">
          {row.reasons
            .slice(0, 2)
            .map((reason) => reason.text)
            .join(' · ')}
        </p>
      ) : (
        <p className="mt-1 text-xs text-ink-500">No scored actions yet</p>
      )}
    </div>
  );
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters: LeadListFilters = {
    q: readParam(params.q),
    joined: readParam(params.joined),
    pipeline: readParam(params.pipeline),
    band: readParam(params.band),
    intent: readParam(params.intent),
    joinedAs: readParam(params.joinedAs),
    cohort: readParam(params.cohort),
    plan: readParam(params.plan),
    whatsapp: readParam(params.whatsapp),
    owner: readParam(params.owner),
    live: readParam(params.live),
    converted: readParam(params.converted),
    due: readParam(params.due),
    page: readParam(params.page),
    sort: readParam(params.sort),
    dir: readParam(params.dir),
  };
  const board = await getLeadBoard(filters);
  const { overview } = board;
  const pageCount = Math.max(1, Math.ceil(board.total / board.pageSize));
  const filtered = Boolean(
    filters.q ||
      filters.joined ||
      filters.pipeline ||
      filters.band ||
      filters.intent ||
      filters.joinedAs ||
      filters.cohort ||
      filters.plan ||
      filters.whatsapp ||
      filters.owner ||
      filters.live ||
      filters.converted ||
      filters.due
  );

  return (
    <PageFrame>
      <PageHeader
        eyebrow="People"
        title="User & lead intelligence"
        subtitle="Who is new, who started real work, and who to message next. Shop actions are shared by everyone on that shop. There is no in-app page-view log."
        actions={
          <>
            <Link
              href="/leads/inquiries"
              className="inline-flex h-9 items-center rounded-md border border-ink-300 bg-white px-3 text-sm text-ink-700 hover:bg-ink-50"
            >
              Website inquiries
            </Link>
            <Link
              href="/leads/discover"
              className="inline-flex h-9 items-center rounded-md border border-ink-300 bg-white px-3 text-sm text-ink-700 hover:bg-ink-50"
            >
              Discover jewellery shops
            </Link>
          </>
        }
      />

      {overview.truncated ? (
        <p className="text-xs text-amber-800">
          Showing the first 5,000 memberships. Older rows are not in this view.
        </p>
      ) : null}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric label="Shops" value={formatNumber(overview.shops)} scope="Unique shops linked to people in this view" href="/shops" />
        <Metric
          label="Call back"
          value={formatNumber(overview.callback)}
          scope="Asked to be called again"
          href="/leads?pipeline=callback"
          tone={overview.callback > 0 ? 'attention' : 'default'}
        />
        <Metric
          label="Contacted"
          value={formatNumber(overview.contacted)}
          scope="Marked contacted in the pipeline"
          href="/leads?pipeline=contacted"
        />
        <Metric
          label="No answer"
          value={formatNumber(overview.noAnswer)}
          scope="Last outreach got no answer"
          href="/leads?pipeline=no_answer"
          tone={overview.noAnswer > 0 ? 'attention' : 'default'}
        />
        <Metric label="New today" value={formatNumber(overview.newToday)} scope="Accounts created since midnight IST" href="/leads?joined=today" />
        <Metric label="New, 7 days" value={formatNumber(overview.new7d)} scope="Accounts created in the last 7 days" href="/leads?joined=7d" />
        <Metric label="New, 30 days" value={formatNumber(overview.new30d)} scope="Accounts created in the last 30 days" href="/leads?joined=30d" />
        <Metric label="Active" value={formatNumber(overview.active)} scope="Signed in, or the shop moved, in 7 days" href="/leads?live=active" />
        <Metric label="Returning" value={formatNumber(overview.returning)} scope="Signed in on a later IST day than signup" href="/leads?live=returning" />
        <Metric label="WhatsApp connected" value={formatNumber(overview.whatsappConnected)} scope="At least one shop WhatsApp is connected" href="/leads?whatsapp=connected" />
        <Metric
          label="High-intent leads"
          value={formatNumber(overview.highIntent)}
          scope="Score 30+ from real actions, not yet converted"
          href="/leads?intent=high"
          tone={overview.highIntent > 0 ? 'attention' : 'default'}
        />
        <Metric label="Converted" value={formatNumber(overview.converted)} scope="An invoice, or an active Professional or Business plan" href="/leads?converted=yes" />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <Queue
          title="Follow-up due"
          hint="Scheduled time has passed, and the lead is not lost."
          href="/leads?due=1"
          rows={board.followUps}
          empty="No follow-ups are due."
        />
        <Queue
          title="High intent, not contacted"
          hint="They did meaningful shop work and nobody has marked them contacted."
          href="/leads?intent=high"
          rows={board.highIntentQueue}
          empty="No unreviewed high-intent shops right now."
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Find someone</CardTitle>
          <p className="text-xs text-ink-500">
            Campaign source is not stored. Source here means how they joined a shop. Metrics above count people. The list is one row per person per shop
            {overview.shopLess ? `, including ${overview.shopLess} without a shop` : ''}.
          </p>
        </CardHeader>
        <CardContent>
          <LeadFilters filters={filters} owners={board.owners} />
        </CardContent>
      </Card>

      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink-800">
          {filtered ? 'Matching people' : 'All people'}
        </h2>
        <p className="text-xs text-ink-500">
          {formatNumber(board.filteredPeople)} people · {formatNumber(board.total)} rows
        </p>
      </div>

      {board.rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No people match these filters"
            description="Try clearing filters or searching by name, email, or phone."
            action={
              <Link href="/leads" className="text-sm font-medium text-gold-700 hover:underline">
                Clear filters
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <ul className="space-y-2 md:hidden">
            {board.rows.map((row) => (
              <li key={row.id} className="rounded-lg border border-ink-100 bg-white p-3">
                <LeadIdentity row={row} />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant={PIPELINE_VARIANT[row.pipeline]}>{PIPELINE_LABEL[row.pipeline]}</Badge>
                  <Badge variant={row.band === 'high' ? 'gold' : row.band === 'medium' ? 'warning' : 'secondary'}>
                    Score {row.score}
                  </Badge>
                  {row.converted ? <Badge variant="success">Converted</Badge> : null}
                </div>
                <p className="mt-2 text-sm text-ink-800">{row.shopName || 'No shop yet'}</p>
                <p className="text-xs text-ink-500">
                  {row.phone || 'No phone'} · {JOIN_LABEL[row.joinSource]} · {planLabel(row.planId)}
                </p>
                {row.latestNote ? (
                  <p className="mt-2 line-clamp-2 text-xs text-ink-600">{row.latestNote}</p>
                ) : null}
                <p className={`mt-2 text-xs ${row.next.tone === 'attention' ? 'text-amber-800' : 'text-ink-500'}`}>
                  {row.next.label}
                </p>
              </li>
            ))}
          </ul>

          <Card className="hidden md:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b bg-ink-50">
                    <tr>
                      {TABLE_COLUMNS.map((column) => {
                        const active = filters.sort === column.key;
                        const marker = active ? (filters.dir === 'asc' ? ' ↑' : ' ↓') : '';
                        return (
                          <th
                            key={column.key}
                            className={cn(
                              'whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500',
                              column.className
                            )}
                          >
                            <Link
                              href={sortHref(filters, column.key)}
                              className={cn(
                                'inline-flex items-center gap-0.5 hover:text-ink-800',
                                active && 'text-ink-800'
                              )}
                            >
                              {column.label}
                              <span aria-hidden>{marker || ' ↕'}</span>
                            </Link>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-50 bg-white">
                    {board.rows.map((row) => (
                      <tr key={row.id} className="align-top hover:bg-ink-50">
                        <td className="px-3 py-2.5">
                          <LeadIdentity row={row} />
                        </td>
                        <td className="px-3 py-2.5">
                          {row.shopId ? (
                            <Link href={`/shops/${row.shopId}`} className="text-sm text-ink-900 hover:text-gold-700">
                              {row.shopName}
                            </Link>
                          ) : (
                            <p className="text-sm text-ink-700">No shop yet</p>
                          )}
                          <p className="text-xs text-ink-500">
                            {row.phone || 'No phone'} · {JOIN_LABEL[row.joinSource]}
                          </p>
                          <p className="text-xs text-ink-500">
                            {planLabel(row.planId)}
                            {row.planStatus ? ` · ${row.planStatus}` : ''}
                            {row.whatsappConnected ? ' · WhatsApp on' : ''}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-sm text-ink-700">
                          {formatDate(row.accountCreatedAt)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-sm text-ink-700">
                          {row.lastActiveAt ? getRelativeTime(row.lastActiveAt) : 'Never'}
                          {row.lastActiveAt ? (
                            <p className="text-xs text-ink-500">{formatDateTime(row.lastActiveAt)}</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant={row.band === 'high' ? 'gold' : row.band === 'medium' ? 'warning' : 'secondary'}>
                            {row.score}
                          </Badge>
                          {row.converted ? (
                            <p className="mt-1 text-[11px] text-emerald-700">Converted</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant={PIPELINE_VARIANT[row.pipeline]}>{PIPELINE_LABEL[row.pipeline]}</Badge>
                          {row.ownerName ? <p className="mt-1 text-xs text-ink-500">{row.ownerName}</p> : null}
                        </td>
                        <td className="max-w-[220px] px-3 py-2.5 text-xs text-ink-600">
                          {row.latestNote ? (
                            <>
                              <p className="line-clamp-3 whitespace-pre-wrap">{row.latestNote}</p>
                              {row.latestNoteAt ? (
                                <p className="mt-1 text-[11px] text-ink-400">
                                  {getRelativeTime(row.latestNoteAt)}
                                </p>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-ink-400">—</span>
                          )}
                        </td>
                        <td className="max-w-[220px] px-3 py-2.5 text-xs text-ink-700">
                          <p className={row.next.tone === 'attention' ? 'text-amber-800' : undefined}>{row.next.label}</p>
                          <Link href={`/leads/${row.id}`} className="mt-1 inline-block text-gold-700 hover:underline">
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {pageCount > 1 ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-ink-600">
                Page {board.page} of {pageCount}
              </p>
              <div className="flex gap-2">
                {board.page > 1 ? (
                  <Link href={queryHref(filters, board.page - 1)} className="rounded-md border px-3 py-2 text-sm hover:bg-ink-50">
                    Previous
                  </Link>
                ) : null}
                {board.page < pageCount ? (
                  <Link href={queryHref(filters, board.page + 1)} className="rounded-md border px-3 py-2 text-sm hover:bg-ink-50">
                    Next
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </PageFrame>
  );
}

function Queue({
  title,
  hint,
  href,
  rows,
  empty,
}: {
  title: string;
  hint: string;
  href: string;
  rows: LeadRow[];
  empty: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          <Link href={href} className="text-xs text-gold-700 hover:underline">
            View list
          </Link>
        </div>
        <p className="text-xs text-ink-500">{hint}</p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-ink-500">{empty}</p>
        ) : (
          <ul className="divide-y divide-ink-50">
            {rows.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <Link href={`/leads/${row.id}`} className="text-sm font-medium text-ink-900 hover:text-gold-700">
                    {displayName(row)}
                  </Link>
                  <p className="truncate text-xs text-ink-500">
                    {row.shopName || 'No shop'} · {row.reasons[0]?.text || row.next.label}
                  </p>
                </div>
                <Badge variant={PIPELINE_VARIANT[row.pipeline]}>{PIPELINE_LABEL[row.pipeline]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
