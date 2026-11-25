import { Suspense } from 'react';
import Link from 'next/link';
import { getCommandCenter } from '@/services/command-center.service';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { Metric } from '../_components/metric';
import { PageHeader } from '../_components/page-header';
import { PageFrame } from '../_components/page-frame';
import { PageSkeleton } from '../_components/page-skeleton';
import { EmptyState } from '../_components/empty-state';

export const dynamic = 'force-dynamic';

async function CommerceBody() {
  const data = await getCommandCenter();
  const rows = [...data.tenants].sort((a, b) => b.gmv30d - a.gmv30d);

  return (
    <div className="flex w-full flex-col gap-6">
      <section className="grid w-full grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric
          label="Invoice value"
          value={formatCurrency(data.commerce.gmv30d)}
          scope={`${formatNumber(data.commerce.invoices30d)} invoices · today ${formatNumber(data.commerce.invoicesToday)}`}
        />
        <Metric
          label="Collected"
          value={formatCurrency(data.commerce.collected30d)}
          scope="Payments in the last 30 days"
        />
        <Metric
          label="Balance due"
          value={formatCurrency(data.commerce.balanceDue)}
          scope="Still unpaid on open invoices"
          tone={data.commerce.balanceDue > 0 ? 'attention' : 'default'}
        />
        <Metric
          label="SwarnaVyapar MRR"
          value={formatCurrency(data.subscriptions.mrrInr)}
          scope="Active plan prices, separate from shop sales"
          href="/billing"
        />
      </section>

      <div className="overflow-hidden rounded-lg border border-ink-100 bg-white">
        <div className="overflow-x-auto">
          {rows.length === 0 ? (
            <EmptyState
              title="No shop sales yet"
              description="Invoice totals will show here once shops bill customers."
            />
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Shop</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 text-right font-medium">Sales 30d</th>
                  <th className="px-4 py-3 text-right font-medium">Collected</th>
                  <th className="px-4 py-3 text-right font-medium">Due</th>
                  <th className="px-4 py-3 text-right font-medium">Invoices</th>
                  <th className="px-4 py-3 text-right font-medium">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {rows.map((shop) => (
                  <tr key={shop.id} className="hover:bg-ink-50/80">
                    <td className="px-4 py-3">
                      <Link
                        href={`/shops/${shop.id}`}
                        className="font-medium text-ink-900 hover:text-gold-700"
                      >
                        {shop.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-600">
                      {shop.plan}
                      <span className="block text-xs text-ink-400">{shop.subscriptionStatus}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrency(shop.gmv30d)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrency(shop.collected30d)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrency(shop.balanceDue)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{shop.invoices30d}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/shops/${shop.id}`} className="text-sm font-medium text-gold-700 hover:underline">
                        Workspace
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CommercePage() {
  return (
    <PageFrame>
      <PageHeader
        eyebrow="Money"
        title="Commerce"
        subtitle="What shops sold and collected in the last 30 days. This is customer money, not SwarnaVyapar revenue."
      />
      <Suspense fallback={<PageSkeleton hideHeader metrics={4} panels={1} />}>
        <CommerceBody />
      </Suspense>
    </PageFrame>
  );
}
