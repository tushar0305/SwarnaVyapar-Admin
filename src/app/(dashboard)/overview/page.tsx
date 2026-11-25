import { Suspense } from 'react';
import Link from 'next/link';
import { getCommandCenter, type TenantPulse } from '@/services/command-center.service';
import { listMarketingInquiries } from '@/services/marketing-inquiries.service';
import { formatCurrency, formatNumber, getRelativeTime } from '@/lib/utils';
import { UpdatedAt } from '../_components/updated-at';
import { Metric } from '../_components/metric';
import { PageHeader } from '../_components/page-header';
import { PageFrame } from '../_components/page-frame';
import { PageSkeleton } from '../_components/page-skeleton';
import { SectionPanel } from '../_components/section-panel';
import { EmptyState } from '../_components/empty-state';

export const dynamic = 'force-dynamic';

function ShopRow({
  shop,
  primary,
  secondary,
}: {
  shop: TenantPulse;
  primary: string;
  secondary: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="min-w-0">
        <Link
          href={`/shops/${shop.id}`}
          className="block truncate font-medium text-ink-900 hover:text-gold-700"
        >
          {shop.name}
        </Link>
        <p className="truncate text-xs text-ink-500">
          {shop.plan} · {shop.subscriptionStatus}
          {shop.lastActivityAt ? ` · ${getRelativeTime(shop.lastActivityAt)}` : ''}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-medium tabular-nums text-ink-900">{primary}</p>
        <p className="text-xs text-ink-500">{secondary}</p>
      </div>
    </li>
  );
}

function StatTile({
  label,
  value,
  hint,
  href,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint: string;
  href: string;
  tone?: 'default' | 'attention';
}) {
  return (
    <Link
      href={href}
      className={`flex h-full min-h-[5.5rem] flex-col rounded-lg border bg-white px-3.5 py-3 transition hover:border-gold-400 ${
        tone === 'attention' ? 'border-amber-300' : 'border-ink-100'
      }`}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-500">{label}</p>
      <p className="tnum mt-1 font-serif text-xl leading-tight text-ink-900 sm:text-[1.35rem]">
        {value}
      </p>
      <p className="mt-auto pt-1.5 text-xs leading-snug text-ink-500">{hint}</p>
    </Link>
  );
}

async function OverviewBody() {
  const [data, inquiries] = await Promise.all([
    getCommandCenter(),
    listMarketingInquiries({ page: '1' }),
  ]);

  const sellingWithoutPlan = data.tenants
    .filter((shop) => shop.gmv30d > 0 && shop.subscriptionStatus !== 'active')
    .sort((a, b) => b.gmv30d - a.gmv30d);

  const quietSellers = data.tenants.filter(
    (shop) =>
      shop.gmv30d > 0 &&
      (!shop.lastActivityAt ||
        Date.now() - new Date(shop.lastActivityAt).getTime() > 14 * 86400000)
  );

  const topBalanceDue = [...data.tenants]
    .filter((shop) => shop.balanceDue > 0)
    .sort((a, b) => b.balanceDue - a.balanceDue)
    .slice(0, 6);

  const topSellers = [...data.tenants]
    .filter((shop) => shop.gmv30d > 0)
    .sort((a, b) => b.gmv30d - a.gmv30d)
    .slice(0, 6);

  const topMrr = [...data.tenants]
    .filter((shop) => shop.mrrInr > 0 && shop.subscriptionStatus === 'active')
    .sort((a, b) => b.mrrInr - a.mrrInr)
    .slice(0, 6);

  const planMix = data.subscriptions.byPlan
    .filter((row) => row.status === 'active' && row.count > 0)
    .sort((a, b) => b.count - a.count);

  const collectionRate =
    data.commerce.gmv30d > 0
      ? Math.round((data.commerce.collected30d / data.commerce.gmv30d) * 100)
      : null;

  const inquiryNew = inquiries.overview.newCount;
  const inquiryDue = inquiries.overview.dueToday;

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-500">
          <UpdatedAt iso={data.generatedAt} />
        </p>
        <p className="text-xs text-ink-500">
          {formatNumber(data.shops.active)} active of {formatNumber(data.shops.total)} shops
          {collectionRate != null ? ` · ${collectionRate}% collected vs sales` : ''}
        </p>
      </div>

      <section className="grid w-full grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric
          label="Shop sales"
          value={formatCurrency(data.commerce.gmv30d)}
          scope="Invoice value, last 30 days"
          href="/commerce"
        />
        <Metric
          label="Collected"
          value={formatCurrency(data.commerce.collected30d)}
          scope={
            collectionRate != null
              ? `${collectionRate}% of sales · payments in 30 days`
              : 'Customer payments in 30 days'
          }
          href="/commerce"
        />
        <Metric
          label="Still due"
          value={formatCurrency(data.commerce.balanceDue)}
          scope="Open balance on non-cancelled invoices"
          href="/commerce"
          tone={data.commerce.balanceDue > 0 ? 'attention' : 'default'}
        />
        <Metric
          label="Our MRR"
          value={formatCurrency(data.subscriptions.mrrInr)}
          scope={`${formatNumber(data.subscriptions.active)} active paid plan${data.subscriptions.active === 1 ? '' : 's'}`}
          href="/subscriptions"
          tone={sellingWithoutPlan.length > 0 ? 'attention' : 'default'}
        />
      </section>

      <section className="grid w-full grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric
          label="Invoices today"
          value={formatNumber(data.commerce.invoicesToday)}
          scope={`${formatNumber(data.commerce.invoices30d)} in the last 30 days`}
          href="/commerce"
        />
        <Metric
          label="New shops"
          value={formatNumber(data.shops.new30d)}
          scope="Created in the last 30 days"
          href="/shops"
        />
        <Metric
          label="Quiet shops"
          value={formatNumber(data.shops.quiet14d)}
          scope={
            quietSellers.length > 0
              ? `No activity in 14 days · ${quietSellers.length} still sold this month`
              : 'No activity in 14 days'
          }
          href="/activation"
          tone={data.shops.quiet14d > 0 ? 'attention' : 'default'}
        />
        <Metric
          label="Open support"
          value={formatNumber(data.ops.openTickets)}
          scope={data.tickets[0]?.title || 'No open tickets'}
          href="/communications"
          tone={data.ops.openTickets > 0 ? 'attention' : 'default'}
        />
      </section>

      <section className="grid w-full grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          label="Website inquiries"
          value={formatNumber(inquiryNew)}
          hint={
            inquiryDue > 0
              ? `${formatNumber(inquiryDue)} follow-up due · ${formatNumber(inquiries.overview.total)} total`
              : `${formatNumber(inquiries.overview.total)} total from the public site`
          }
          href="/leads/inquiries?status=new"
          tone={inquiryNew > 0 || inquiryDue > 0 ? 'attention' : 'default'}
        />
        <StatTile
          label="Catalogue leads"
          value={formatNumber(data.product.catalogueLeads)}
          hint={`${formatNumber(data.product.catalogueProducts)} products · ${formatNumber(data.product.catalogueEvents7d)} views, 7d`}
          href="/commerce"
        />
        <StatTile
          label="WhatsApp"
          value={formatNumber(data.product.whatsappConnected)}
          hint={`${formatNumber(data.product.whatsappMessages30d)} messages, 30d · ${formatNumber(data.product.whatsappFailed)} failed`}
          href="/whatsapp"
          tone={data.product.whatsappFailed > 0 ? 'attention' : 'default'}
        />
        <StatTile
          label="AI this month"
          value={formatNumber(data.product.aiUsageMonth)}
          hint="Plan-gated usage · prepaid wallets removed"
          href="/credits"
        />
      </section>

      <section className="grid w-full items-stretch gap-3 lg:grid-cols-2">
        <SectionPanel
          className="min-w-0"
          title="Selling without a paid plan"
          description={
            sellingWithoutPlan.length === 0
              ? 'Every shop with sales this month is on an active plan.'
              : `${sellingWithoutPlan.length} shops invoiced in 30 days without an active subscription.`
          }
          action={
            <Link href="/shops" className="text-xs font-medium text-gold-700 hover:underline">
              All shops
            </Link>
          }
          bodyClassName="p-0"
          tone={sellingWithoutPlan.length > 0 ? 'attention' : 'default'}
        >
          {sellingWithoutPlan.length === 0 ? (
            <EmptyState title="No leakage right now" description="Selling shops are on active plans." />
          ) : (
            <ul className="divide-y divide-ink-50">
              {sellingWithoutPlan.slice(0, 6).map((shop) => (
                <ShopRow
                  key={shop.id}
                  shop={shop}
                  primary={formatCurrency(shop.gmv30d)}
                  secondary={`${shop.invoices30d} invoice${shop.invoices30d === 1 ? '' : 's'}`}
                />
              ))}
            </ul>
          )}
        </SectionPanel>

        <SectionPanel
          className="min-w-0"
          title="Highest open dues"
          description="Shops with the largest unpaid invoice balance."
          action={
            <Link href="/commerce" className="text-xs font-medium text-gold-700 hover:underline">
              Commerce
            </Link>
          }
          bodyClassName="p-0"
          tone={topBalanceDue.length > 0 ? 'attention' : 'default'}
        >
          {topBalanceDue.length === 0 ? (
            <EmptyState title="Nothing overdue in this view" description="No open balances on tenant shops." />
          ) : (
            <ul className="divide-y divide-ink-50">
              {topBalanceDue.map((shop) => (
                <ShopRow
                  key={shop.id}
                  shop={shop}
                  primary={formatCurrency(shop.balanceDue)}
                  secondary={`${formatCurrency(shop.gmv30d)} sales, 30d`}
                />
              ))}
            </ul>
          )}
        </SectionPanel>
      </section>

      <section className="grid w-full items-stretch gap-3 lg:grid-cols-3">
        <SectionPanel
          className="min-w-0"
          title="Top sellers"
          description="Highest invoice value in 30 days."
          action={
            <Link href="/commerce" className="text-xs font-medium text-gold-700 hover:underline">
              Commerce
            </Link>
          }
          bodyClassName="p-0"
        >
          {topSellers.length === 0 ? (
            <EmptyState title="No sales yet" description="Invoices in the last 30 days will show here." />
          ) : (
            <ul className="divide-y divide-ink-50">
              {topSellers.map((shop) => (
                <ShopRow
                  key={shop.id}
                  shop={shop}
                  primary={formatCurrency(shop.gmv30d)}
                  secondary={`${shop.invoices30d} invoice${shop.invoices30d === 1 ? '' : 's'}`}
                />
              ))}
            </ul>
          )}
        </SectionPanel>

        <SectionPanel
          className="min-w-0"
          title="Highest MRR"
          description="Active paid plans by monthly value."
          action={
            <Link href="/subscriptions" className="text-xs font-medium text-gold-700 hover:underline">
              Plans
            </Link>
          }
          bodyClassName="p-0"
        >
          {topMrr.length === 0 ? (
            <EmptyState title="No paid MRR yet" description="Active subscriptions will rank here." />
          ) : (
            <ul className="divide-y divide-ink-50">
              {topMrr.map((shop) => (
                <ShopRow
                  key={shop.id}
                  shop={shop}
                  primary={formatCurrency(shop.mrrInr)}
                  secondary={`${formatCurrency(shop.gmv30d)} sales, 30d`}
                />
              ))}
            </ul>
          )}
        </SectionPanel>

        <SectionPanel
          className="min-w-0"
          title="Plan mix"
          description="Active subscriptions by plan."
          action={
            <Link href="/subscriptions" className="text-xs font-medium text-gold-700 hover:underline">
              Manage
            </Link>
          }
        >
          {planMix.length === 0 ? (
            <EmptyState title="No active plans" description="Paid plan counts will appear here." />
          ) : (
            <ul className="space-y-2.5">
              {planMix.map((row) => {
                const share =
                  data.subscriptions.active > 0
                    ? Math.round((row.count / data.subscriptions.active) * 100)
                    : 0;
                return (
                  <li key={`${row.plan}-${row.status}`}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium text-ink-800">{row.name || row.plan}</span>
                      <span className="tabular-nums text-ink-600">
                        {formatNumber(row.count)} · {share}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className="h-full rounded-full bg-gold-500"
                        style={{ width: `${Math.min(share, 100)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionPanel>
      </section>

      <SectionPanel title="Product in use" description="What shops are actually using across the platform.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[
            { label: 'Invoices, 30d', value: data.commerce.invoices30d, href: '/commerce' },
            { label: 'Customers', value: data.product.customers, href: '/shops' },
            { label: 'Inventory items', value: data.product.inventoryItems, href: '/shops' },
            { label: 'Catalogue products', value: data.product.catalogueProducts, href: '/commerce' },
            { label: 'Catalogue views, 7d', value: data.product.catalogueEvents7d, href: '/commerce' },
            { label: 'Buyer leads', value: data.product.catalogueLeads, href: '/commerce' },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-md border border-ink-50 px-3 py-2.5 transition hover:border-gold-400"
            >
              <p className="text-xs text-ink-500">{item.label}</p>
              <p className="tnum mt-0.5 text-lg font-semibold text-ink-900">
                {formatNumber(item.value)}
              </p>
            </Link>
          ))}
        </div>
      </SectionPanel>

      <section className="grid w-full grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Suspended"
          value={formatNumber(data.shops.suspended)}
          hint="Shops currently suspended"
          href="/shops"
          tone={data.shops.suspended > 0 ? 'attention' : 'default'}
        />
        <StatTile
          label="Cron issues, 7d"
          value={formatNumber(data.ops.cronFailures7d)}
          hint="Failed scheduled jobs"
          href="/health"
          tone={data.ops.cronFailures7d > 0 ? 'attention' : 'default'}
        />
        <StatTile
          label="Billing events"
          value={formatNumber(data.ops.billingEvents)}
          hint="Recent provider / plan events"
          href="/billing"
        />
        <StatTile
          label="Demo scheduled"
          value={formatNumber(inquiries.overview.demoScheduled)}
          hint="Website inquiries waiting on a demo"
          href="/leads/inquiries?status=demo_scheduled"
          tone={inquiries.overview.demoScheduled > 0 ? 'attention' : 'default'}
        />
      </section>
    </div>
  );
}

export default function OverviewPage() {
  return (
    <PageFrame>
      <PageHeader
        eyebrow="Today"
        title="Control center"
        subtitle="Money, product usage, and who needs a decision — aligned for a quick scan."
      />
      <Suspense fallback={<PageSkeleton hideHeader metrics={8} panels={3} />}>
        <OverviewBody />
      </Suspense>
    </PageFrame>
  );
}
