import Link from 'next/link';
import { AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getActivationSnapshot, type ActivationRow } from '@/services/onboarding.service';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '../_components/page-header';
import { OutreachActions } from './_components/outreach-actions';

const COHORT_LABEL: Record<ActivationRow['primary'], string> = {
  never_started: 'Never started',
  stalled_billing: 'Stocked, never billed',
  activated: 'Activated',
  quiet: 'Quiet after billing',
};

function ShopList({
  title,
  hint,
  rows,
  cohort,
  showGoogleReviewsUnlock = false,
}: {
  title: string;
  hint: string;
  rows: ActivationRow[];
  cohort?: string;
  showGoogleReviewsUnlock?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {title}{' '}
          <span className="text-ink-500 font-normal">({rows.length})</span>
        </CardTitle>
        <p className="text-sm text-ink-500">{hint}</p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-ink-500">None in this window.</p>
        ) : (
          <div className="space-y-2">
            {rows.slice(0, 25).map((row) => (
              <div
                key={row.shopId}
                className="flex flex-col gap-3 rounded-lg bg-ink-50 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <Link href={`/shops/${row.shopId}`} className="min-w-0 hover:underline">
                  <p className="text-sm font-medium text-ink-900">{row.shopName}</p>
                  <p className="text-xs text-ink-500">
                    {row.counts.invoices} invoices · {row.counts.customers} customers ·{' '}
                    {row.counts.inventory} stock
                    {row.planId ? ` · ${row.planId}` : ''}
                    {row.googleReviewsUnlocked ? ' · reviews unlocked' : ''}
                    {row.phone ? ` · ${row.phone}` : ''}
                    {row.email ? ` · ${row.email}` : ''}
                  </p>
                </Link>
                <div className="space-y-2 sm:text-right">
                  <div className="flex items-center gap-2 sm:justify-end">
                    <Badge variant="secondary">{COHORT_LABEL[row.primary]}</Badge>
                    <p className="text-xs text-ink-500">{formatDate(row.createdAt)}</p>
                  </div>
                  <OutreachActions
                    shopId={row.shopId}
                    shopName={row.shopName}
                    phone={row.phone}
                    email={row.email}
                    cohort={cohort || row.primary}
                    googleReviewsUnlocked={row.googleReviewsUnlocked}
                    showGoogleReviewsUnlock={showGoogleReviewsUnlock}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function ActivationPage() {
  const snap = await getActivationSnapshot();
  const neverStarted = snap.shops.filter((s) => s.primary === 'never_started');
  const stalled = snap.shops.filter((s) => s.primary === 'stalled_billing');
  const quiet = snap.shops.filter((s) => s.primary === 'quiet');
  const upgradeReady = snap.shops.filter((s) => s.upgradeReady);
  const whatsappOff = snap.shops.filter((s) => s.tags.includes('whatsapp_off'));
  const needsHelp = snap.shops.filter((s) => s.needsAssistance);
  const reviewsLocked = snap.shops.filter((s) => s.activated && !s.googleReviewsUnlocked);
  const reviewsUnlocked = snap.shops.filter((s) => s.googleReviewsUnlocked).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Command"
        title="Shop activation"
        subtitle="First invoice is activated. Grant the ₹499 Google review QR here when you want to unlock it without payment."
      />
      {snap.truncated ? (
        <p className="text-xs text-amber-800">
          Showing the {snap.shops.length} newest shops of {snap.stats.total}.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">
              Activated
            </CardTitle>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <p className="tnum text-xl font-semibold text-emerald-600">{snap.stats.completed}</p>
            <p className="text-xs text-ink-500 mt-1">At least one invoice</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">
              Never billed
            </CardTitle>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <p className="tnum text-xl font-semibold text-amber-600">
              {snap.stats.inProgress + snap.stats.notStarted}
            </p>
            <p className="text-xs text-ink-500 mt-1">
              {snap.stats.needsHelp} older than 7 days
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">
              Upgrade-ready
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-gold-700" />
          </CardHeader>
          <CardContent>
            <p className="tnum text-xl font-semibold">{upgradeReady.length}</p>
            <p className="text-xs text-ink-500 mt-1">Free shops at ≥80% of a cap</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-ink-600">
              Google reviews
            </CardTitle>
            <Clock className="w-4 h-4 text-ink-500" />
          </CardHeader>
          <CardContent>
            <p className="tnum text-xl font-semibold">{reviewsUnlocked}</p>
            <p className="text-xs text-ink-500 mt-1">
              Unlocked · {reviewsLocked.length} billed shops still locked
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ShopList
          title="Need help"
          hint="No invoice after 7 days. WhatsApp, email, or nudge the owner."
          rows={needsHelp}
          cohort="needs_help"
        />
        <ShopList
          title="Stocked, never billed"
          hint="They added inventory or customers but never made a bill."
          rows={stalled}
          cohort="stalled_billing"
        />
        <ShopList
          title="Never started"
          hint="Shop exists, nothing else."
          rows={neverStarted}
          cohort="never_started"
        />
        <ShopList
          title="Quiet after billing"
          hint="Billed at least once, then silent for 14+ days."
          rows={quiet}
          cohort="quiet"
        />
        <ShopList
          title="Upgrade-ready"
          hint="Free plan near customer, stock, loan, or scheme cap."
          rows={upgradeReady}
          cohort="upgrade_ready"
        />
        <ShopList
          title="Billed, WhatsApp off"
          hint="They can invoice but cannot share from the counter."
          rows={whatsappOff}
          cohort="whatsapp_off"
        />
        <ShopList
          title="Billed, Google reviews locked"
          hint="₹499 one-time add-on. Unlock here to give the counter QR without payment."
          rows={reviewsLocked}
          cohort="google_reviews"
          showGoogleReviewsUnlock
        />
      </div>
    </div>
  );
}
