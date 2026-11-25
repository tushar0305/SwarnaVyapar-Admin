import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  formatInquiryPhone,
  INQUIRY_INTEREST_LABEL,
  INQUIRY_STATUS_LABEL,
  type InquiryStatus,
  waMeHref,
} from '@/lib/marketing-inquiries';
import { formatDate, formatDateTime, formatNumber, getRelativeTime } from '@/lib/utils';
import {
  listMarketingInquiries,
  type InquiryListFilters,
  type MarketingInquiry,
} from '@/services/marketing-inquiries.service';
import { EmptyState } from '../../_components/empty-state';
import { Metric } from '../../_components/metric';
import { PageFrame } from '../../_components/page-frame';
import { PageHeader } from '../../_components/page-header';
import { InquiryFilters } from './_components/inquiry-filters';

export const dynamic = 'force-dynamic';

const STATUS_VARIANT: Record<
  InquiryStatus,
  'outline' | 'secondary' | 'info' | 'gold' | 'warning' | 'success' | 'destructive'
> = {
  new: 'secondary',
  contacted: 'info',
  demo_scheduled: 'warning',
  converted: 'success',
  lost: 'destructive',
};

function readParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed || undefined;
}

function queryHref(filters: InquiryListFilters, page?: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (!value || key === 'page') continue;
    params.set(key, value);
  }
  if (page && page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/leads/inquiries?${query}` : '/leads/inquiries';
}

function displayName(row: MarketingInquiry) {
  return row.name || row.shopName || formatInquiryPhone(row.phone);
}

function placeLine(row: MarketingInquiry) {
  return [row.city, row.state].filter(Boolean).join(', ') || 'Location not given';
}

export default async function MarketingInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters: InquiryListFilters = {
    q: readParam(params.q),
    status: readParam(params.status),
    interest: readParam(params.interest),
    assigned: readParam(params.assigned),
    due: readParam(params.due),
    page: readParam(params.page),
  };

  const board = await listMarketingInquiries(filters);
  const pageCount = Math.max(1, Math.ceil(board.total / board.pageSize));
  const filtered = Boolean(
    filters.q || filters.status || filters.interest || filters.assigned || filters.due
  );

  return (
    <PageFrame>
      <PageHeader
        eyebrow="People"
        title="Website inquiries"
        subtitle="Visitors who submitted the public site form. Separate from signed-up accounts and Discover prospects."
        actions={
          <>
            <Link
              href="/leads"
              className="inline-flex h-9 items-center rounded-md border border-ink-300 bg-white px-3 text-sm text-ink-700 hover:bg-ink-50"
            >
              User leads
            </Link>
            <Link
              href="/leads/discover"
              className="inline-flex h-9 items-center rounded-md border border-ink-300 bg-white px-3 text-sm text-ink-700 hover:bg-ink-50"
            >
              Discover
            </Link>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric
          label="Total"
          value={formatNumber(board.overview.total)}
          scope="All website inquiries"
          href="/leads/inquiries"
        />
        <Metric
          label="New"
          value={formatNumber(board.overview.newCount)}
          scope="Not contacted yet"
          href="/leads/inquiries?status=new"
        />
        <Metric
          label="Demo scheduled"
          value={formatNumber(board.overview.demoScheduled)}
          scope="Waiting on a demo"
          href="/leads/inquiries?status=demo_scheduled"
        />
        <Metric
          label="Follow-up due"
          value={formatNumber(board.overview.dueToday)}
          scope="Due today or overdue"
          href="/leads/inquiries?due=1"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <InquiryFilters filters={filters} assignees={board.assignees} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle>
            {filtered ? 'Filtered inquiries' : 'All inquiries'}
            <span className="ml-2 text-sm font-normal text-ink-500">
              {formatNumber(board.total)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {board.rows.length === 0 ? (
            <EmptyState
              title={filtered ? 'No inquiries match these filters' : 'No website inquiries yet'}
              description={
                filtered
                  ? 'Try clearing filters or widening the search.'
                  : 'When someone submits the public site form, they will show up here.'
              }
            />
          ) : (
            <>
              <ul className="space-y-3 lg:hidden">
                {board.rows.map((row) => {
                  const wa = waMeHref(row.phone);
                  return (
                    <li key={row.id} className="rounded-lg border border-ink-100 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={`/leads/inquiries/${row.id}`}
                            className="font-medium text-ink-900 hover:text-gold-700"
                          >
                            {displayName(row)}
                          </Link>
                          <p className="truncate text-xs text-ink-500">
                            {row.shopName && row.name ? row.shopName : placeLine(row)}
                          </p>
                        </div>
                        <Badge variant={STATUS_VARIANT[row.status]}>
                          {INQUIRY_STATUS_LABEL[row.status]}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-ink-700">{formatInquiryPhone(row.phone)}</p>
                      <p className="mt-1 text-xs text-ink-500">
                        {INQUIRY_INTEREST_LABEL[row.interest]} · {getRelativeTime(row.createdAt)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          href={`/leads/inquiries/${row.id}`}
                          className="inline-flex h-8 items-center rounded-md border border-ink-300 px-2.5 text-xs text-ink-700"
                        >
                          Open
                        </Link>
                        {wa ? (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 items-center rounded-md border border-ink-300 px-2.5 text-xs text-ink-700"
                          >
                            WhatsApp
                          </a>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[880px] text-left text-sm">
                  <thead className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                    <tr>
                      <th className="px-2 py-2 font-medium">Contact</th>
                      <th className="px-2 py-2 font-medium">Shop</th>
                      <th className="px-2 py-2 font-medium">Phone</th>
                      <th className="px-2 py-2 font-medium">Place</th>
                      <th className="px-2 py-2 font-medium">Interest</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                      <th className="px-2 py-2 font-medium">Assignee</th>
                      <th className="px-2 py-2 font-medium">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.rows.map((row) => {
                      const wa = waMeHref(row.phone);
                      return (
                        <tr key={row.id} className="border-b border-ink-50 align-top">
                          <td className="px-2 py-3">
                            <Link
                              href={`/leads/inquiries/${row.id}`}
                              className="font-medium text-ink-900 hover:text-gold-700"
                            >
                              {row.name || 'No name'}
                            </Link>
                            {row.pagePath ? (
                              <p className="mt-0.5 truncate text-xs text-ink-500">{row.pagePath}</p>
                            ) : null}
                          </td>
                          <td className="px-2 py-3 text-ink-700">{row.shopName || '—'}</td>
                          <td className="px-2 py-3">
                            <p className="text-ink-800">{formatInquiryPhone(row.phone)}</p>
                            {wa ? (
                              <a
                                href={wa}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-gold-700 hover:underline"
                              >
                                WhatsApp
                              </a>
                            ) : null}
                          </td>
                          <td className="px-2 py-3 text-ink-600">{placeLine(row)}</td>
                          <td className="px-2 py-3 text-ink-700">
                            {INQUIRY_INTEREST_LABEL[row.interest]}
                          </td>
                          <td className="px-2 py-3">
                            <Badge variant={STATUS_VARIANT[row.status]}>
                              {INQUIRY_STATUS_LABEL[row.status]}
                            </Badge>
                            {row.followUpOn ? (
                              <p className="mt-1 text-xs text-ink-500">
                                Follow-up {formatDate(row.followUpOn)}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-2 py-3 text-ink-600">{row.assignedTo || '—'}</td>
                          <td className="px-2 py-3">
                            <p className="text-ink-700">{getRelativeTime(row.createdAt)}</p>
                            <p className="text-xs text-ink-500">{formatDateTime(row.createdAt)}</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {pageCount > 1 ? (
                <div className="flex items-center justify-between gap-3 text-sm text-ink-600">
                  <p>
                    Page {board.page} of {pageCount}
                  </p>
                  <div className="flex gap-2">
                    {board.page > 1 ? (
                      <Link
                        href={queryHref(filters, board.page - 1)}
                        className="rounded-md border border-ink-300 px-3 py-1.5 hover:bg-ink-50"
                      >
                        Previous
                      </Link>
                    ) : null}
                    {board.page < pageCount ? (
                      <Link
                        href={queryHref(filters, board.page + 1)}
                        className="rounded-md border border-ink-300 px-3 py-1.5 hover:bg-ink-50"
                      >
                        Next
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </PageFrame>
  );
}
