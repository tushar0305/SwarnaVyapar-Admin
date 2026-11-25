import { Suspense } from 'react';
import Link from 'next/link';
import { getAllShops } from '@/services/shop-management.service';
import { ShopsTable } from './_components/shops-table';
import { PageHeader } from '../_components/page-header';
import { PageFrame } from '../_components/page-frame';
import { PageSkeleton } from '../_components/page-skeleton';

export const dynamic = 'force-dynamic';

async function ShopsData({
  q,
  status,
  page,
}: {
  q?: string;
  status?: 'active' | 'suspended' | 'all';
  page: number;
}) {
  const pageSize = 50;
  const { shops, total } = await getAllShops({
    limit: pageSize,
    offset: (page - 1) * pageSize,
    search: q,
    status: status && status !== 'all' ? status : undefined,
  });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-600">
        Showing {shops.length} of {total} shops
      </p>
      <ShopsTable shops={shops} />
      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink-600">
            Page {page} of {pageCount}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={shopQuery(q, status, page - 1)}
                className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm hover:bg-ink-50"
              >
                Previous
              </Link>
            ) : null}
            {page < pageCount ? (
              <Link
                href={shopQuery(q, status, page + 1)}
                className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm hover:bg-ink-50"
              >
                Next
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function shopQuery(q: string | undefined, status: string | undefined, page: number) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status && status !== 'all') params.set('status', status);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/shops?${query}` : '/shops';
}

export default async function ShopsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const status =
    params.status === 'active' || params.status === 'suspended' ? params.status : 'all';
  const page = Math.max(1, Number(params.page) || 1);

  return (
    <PageFrame>
      <PageHeader
        title="Shops"
        subtitle="Find a tenant, then open it to change access or plan."
        actions={
          <>
            <a
              href="/api/export/tenants"
              className="inline-flex h-9 items-center rounded-md border border-ink-300 bg-white px-3 text-sm font-medium text-ink-800 hover:border-ink-500 hover:bg-ink-50"
            >
              Export CSV
            </a>
            <Link
              href="/activation"
              className="inline-flex h-9 items-center text-sm font-medium text-gold-700 hover:underline"
            >
              Activation cohorts
            </Link>
          </>
        }
      />

      <form action="/shops" className="flex w-full flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Name, phone, or email"
          className="h-9 min-w-[220px] flex-1 rounded-md border border-ink-300 bg-white px-3 text-sm"
        />
        <select
          name="status"
          defaultValue={status}
          className="h-9 rounded-md border border-ink-300 bg-white px-3 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <button
          type="submit"
          className="h-9 rounded-md bg-ink-900 px-4 text-sm font-medium text-white"
        >
          Search
        </button>
      </form>

      <Suspense fallback={<PageSkeleton hideHeader metrics={0} panels={1} />}>
        <ShopsData q={q} status={status} page={page} />
      </Suspense>
    </PageFrame>
  );
}
