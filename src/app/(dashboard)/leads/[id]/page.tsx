import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  JOIN_LABEL,
  PIPELINE_LABEL,
  planLabel,
  signInLabel,
  type PipelineStatus,
} from '@/lib/lead-score';
import { normalizeWhatsAppPhone } from '@/lib/whatsapp/phone';
import { formatDateTime, formatNumber } from '@/lib/utils';
import { getLeadDetail } from '@/services/lead-intelligence.service';
import { PageHeader } from '../../_components/page-header';
import { LeadCrmForm } from '../_components/lead-crm-form';
import { LeadWhatsApp } from '../_components/lead-whatsapp';

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

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = id.length > 80 ? null : await getLeadDetail(id);
  if (!detail) {
    return (
      <div className="space-y-3">
        <PageHeader title="Lead not found" subtitle="This person is not in the current list." />
        <Link href="/leads" className="text-sm text-gold-700 hover:underline">
          Back to leads
        </Link>
      </div>
    );
  }

  const { row } = detail;
  const name = row.name || row.email || 'Unnamed account';
  const reachable = Boolean(normalizeWhatsAppPhone(row.phone));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Lead"
        title={name}
        subtitle={
          <>
            <Link href="/leads" className="text-gold-700 hover:underline">
              All leads
            </Link>
            {row.shopId ? (
              <>
                {' · '}
                <Link href={`/shops/${row.shopId}`} className="text-gold-700 hover:underline">
                  {row.shopName}
                </Link>
              </>
            ) : (
              ' · No shop yet'
            )}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={PIPELINE_VARIANT[row.pipeline]}>{PIPELINE_LABEL[row.pipeline]}</Badge>
            <Badge variant={row.band === 'high' ? 'gold' : row.band === 'medium' ? 'warning' : 'secondary'}>
              Score {row.score}
            </Badge>
            {row.highIntent ? <Badge variant="gold">High intent</Badge> : null}
            {row.converted ? <Badge variant="success">Converted</Badge> : null}
          </div>
        }
      />

      <div
        className={`rounded-md border px-3 py-3 text-sm ${
          row.next.tone === 'attention' ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-ink-100 bg-white text-ink-800'
        }`}
      >
        Next: {row.next.label}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="order-2 space-y-4 lg:order-1 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Why this score</CardTitle>
              <p className="text-xs text-ink-500">
                Personal points come from this account&apos;s sign-in. Shop points are shared by everyone on the shop.
                Score is capped at 100. High intent means 30 or more, a real shop action, and not yet converted.
              </p>
            </CardHeader>
            <CardContent>
              {row.conversionReason ? (
                <p className="mb-3 text-sm text-emerald-800">{row.conversionReason}</p>
              ) : null}
              {row.reasons.length === 0 ? (
                <p className="text-sm text-ink-500">Nothing scored yet. Signup alone is not treated as intent.</p>
              ) : (
                <ul className="space-y-2">
                  {row.reasons.map((reason) => (
                    <li key={reason.text} className="flex items-start justify-between gap-3 text-sm">
                      <span className="text-ink-800">
                        {reason.text}
                        <span className="ml-2 text-[11px] uppercase tracking-wide text-ink-400">
                          {reason.scope === 'person' ? 'This person' : 'Shop'}
                        </span>
                      </span>
                      <span className="tnum text-ink-500">{reason.points > 0 ? `+${reason.points}` : '0'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-2">
                <Fact label="Email" value={row.email || 'Not recorded'} />
                <Fact label="Shop phone" value={row.phone || 'Not recorded'} />
                <Fact label="Role" value={row.role || 'No shop role'} />
                <Fact label="Access" value={row.roleActive ? 'Active' : 'Disabled'} />
                <Fact label="Source" value={JOIN_LABEL[row.joinSource]} />
                <Fact label="Campaign source" value="Not recorded" />
                <Fact label="Sign-in" value={signInLabel(row.provider)} />
                <Fact label="Account created" value={formatDateTime(row.accountCreatedAt)} />
                <Fact label="Last sign-in" value={row.lastSignInAt ? formatDateTime(row.lastSignInAt) : 'Never'} />
                <Fact
                  label="Shop last activity"
                  value={row.lastShopActivityAt ? formatDateTime(row.lastShopActivityAt) : 'None recorded'}
                />
                <Fact
                  label="Plan"
                  value={row.planId ? `${planLabel(row.planId)}${row.planStatus ? ` · ${row.planStatus}` : ''}` : 'No subscription row'}
                />
                <Fact label="Shop WhatsApp" value={row.whatsappConnected ? 'Connected' : row.shopId ? 'Not connected' : 'No shop'} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Onboarding</CardTitle>
              <p className="text-xs text-ink-500">
                {row.onboardingProgress === null
                  ? 'No shop, so there is no setup trail.'
                  : `${row.onboardingProgress}% of GST, customer, stock, invoice, and WhatsApp.`}
                {row.onboardingCompleted === null
                  ? ''
                  : ` Preference flag onboarding completed: ${row.onboardingCompleted ? 'yes' : 'no'}.`}
                {row.onboardingStep !== null ? ` Saved step number ${row.onboardingStep}. Step names are not stored.` : ''}
              </p>
            </CardHeader>
            <CardContent>
              {row.steps.length === 0 ? (
                <p className="text-sm text-ink-500">Nothing to check until they create or join a shop.</p>
              ) : (
                <ol className="space-y-2">
                  {row.steps.map((step) => (
                    <li key={step.id} className="flex items-start justify-between gap-3 text-sm">
                      <span>
                        <span className="text-ink-900">{step.name}</span>
                        <span className="mt-0.5 block text-xs text-ink-500">{step.description}</span>
                      </span>
                      <Badge variant={step.isCompleted ? 'success' : 'outline'}>
                        {step.isCompleted ? 'Done' : 'Open'}
                      </Badge>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Usage</CardTitle>
              <p className="text-xs text-ink-500">Shop totals. They are not unique to this login.</p>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Count label="Customers" value={row.counts.customers} />
                <Count label="Stock" value={row.counts.inventory} />
                <Count label="Invoices" value={row.counts.invoices} />
                <Count label="Catalogue items" value={row.counts.catalogueProducts} />
                <Count label="Catalogue page views" value={row.counts.cataloguePageViews} />
                <Count label="Product views" value={row.counts.catalogueProductViews} />
                <Count label="Buyer leads" value={row.counts.catalogueLeads} />
                <Count label="AI uses" value={row.counts.aiEvents} />
                <Count label="Schemes" value={row.counts.schemes} />
                <Count label="Girvi" value={row.counts.loans} />
                <Count label="Khata" value={row.counts.khata} />
                <Count label="Support tickets" value={row.counts.supportTickets} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Catalogue interest</CardTitle>
              <p className="text-xs text-ink-500">What buyers opened on the public catalogue. Not pages this user visited in the app.</p>
            </CardHeader>
            <CardContent>
              {detail.interests.length === 0 ? (
                <p className="text-sm text-ink-500">No public product views recorded.</p>
              ) : (
                <ul className="divide-y divide-ink-50">
                  {detail.interests.map((item) => (
                    <li key={item.productId} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="text-ink-900">{item.name}</span>
                      <span className="tnum text-ink-500">{formatNumber(item.views)} views</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <p className="text-xs text-ink-500">
                Signup, shop records, recent actions, public catalogue, and founder messages. Page paths inside the app are not tracked.
              </p>
            </CardHeader>
            <CardContent>
              {detail.timeline.length === 0 ? (
                <p className="text-sm text-ink-500">No activity recorded.</p>
              ) : (
                <ol className="space-y-3">
                  {detail.timeline.map((event) => (
                    <li key={event.id} className="border-l-2 border-ink-100 pl-3">
                      <p className="text-sm text-ink-900">{event.label}</p>
                      {event.detail ? <p className="text-xs text-ink-600">{event.detail}</p> : null}
                      <p className="text-[11px] text-ink-400">{formatDateTime(event.at)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="order-1 space-y-4 lg:order-2 lg:col-span-2">
          <Card id="whatsapp">
            <CardHeader>
              <CardTitle>WhatsApp</CardTitle>
            </CardHeader>
            <CardContent>
              {row.shopId ? (
                <LeadWhatsApp
                  userId={row.userId}
                  shopId={row.shopId}
                  membershipId={row.id}
                  shopName={row.shopName || 'this shop'}
                  reachable={reachable}
                />
              ) : (
                <p className="text-sm text-ink-500">WhatsApp starts once they belong to a shop with a phone number.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lead</CardTitle>
            </CardHeader>
            <CardContent>
              {row.shopId ? (
                <LeadCrmForm
                  userId={row.userId}
                  shopId={row.shopId}
                  membershipId={row.id}
                  status={row.pipeline}
                  ownerName={row.ownerName}
                  followUpAt={row.followUpAt}
                />
              ) : (
                <p className="text-sm text-ink-500">Pipeline, owner, and notes start once they belong to a shop.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Communication</CardTitle>
              <p className="text-xs text-ink-500">Founder WhatsApp, notes, support tickets, and in-app notifications for this shop.</p>
            </CardHeader>
            <CardContent>
              {detail.communications.length === 0 ? (
                <p className="text-sm text-ink-500">No messages or notes yet.</p>
              ) : (
                <ul className="space-y-3">
                  {detail.communications.map((item) => (
                    <li key={`${item.channel}:${item.id}`} className="text-sm">
                      <p className="text-[11px] uppercase tracking-wide text-ink-400">
                        {item.channel}
                        {item.status ? ` · ${item.status}` : ''} · {formatDateTime(item.at)}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-ink-800">{item.summary}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink-900">{value}</dd>
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-ink-50 px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="tnum mt-0.5 font-serif text-lg text-ink-900">{formatNumber(value)}</dd>
    </div>
  );
}
