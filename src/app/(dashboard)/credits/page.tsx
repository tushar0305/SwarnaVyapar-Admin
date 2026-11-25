import { Suspense } from 'react';
import { getCommandCenter } from '@/services/command-center.service';
import { formatNumber } from '@/lib/utils';
import { Metric } from '../_components/metric';
import { PageHeader } from '../_components/page-header';
import { PageSkeleton } from '../_components/page-skeleton';
import { EmptyState } from '../_components/empty-state';

export const dynamic = 'force-dynamic';

async function CreditsBody() {
  const data = await getCommandCenter();

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <Metric
          label="AI usage this month"
          value={formatNumber(data.product.aiUsageMonth)}
          scope="Summed from shop plan counters"
        />
        <Metric
          label="WhatsApp connected"
          value={formatNumber(data.product.whatsappConnected)}
          scope="Shops with a connected WABA"
        />
        <Metric
          label="WhatsApp messages, 30 days"
          value={formatNumber(data.product.whatsappMessages30d)}
          scope={`${formatNumber(data.product.whatsappFailed)} failed or errored`}
        />
      </section>

      <EmptyState
        title="Prepaid wallets are gone"
        description="Meta bills each shop’s WhatsApp number. AI stops at the plan limit. There is no shop credit balance to grant or freeze."
      />
    </div>
  );
}

export default function CreditsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Money"
        title="Credits"
        subtitle="Wallet balances are retired. Use this page for AI and WhatsApp usage signals instead."
      />
      <Suspense fallback={<PageSkeleton hideHeader metrics={3} panels={1} />}>
        <CreditsBody />
      </Suspense>
    </div>
  );
}
