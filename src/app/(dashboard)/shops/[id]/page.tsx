import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getShopById } from '@/services/shop-management.service';
import { getShopOnboardingStatus } from '@/services/onboarding.service';
import { getShopAnalytics } from '@/services/shop-analytics.service';
import { getShopMembers, getShopPulse, getShopTimeline } from '@/services/tenant.service';
import { getShopCommunicationHistory } from '@/services/communication.service';
import { getGoogleReviewsUnlockState } from '@/services/google-reviews-admin.service';
import { CreateTicketDialog } from '../../communications/_components/create-ticket';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/utils';
import { ShopWhatsAppDialog } from '../../whatsapp/_components/shop-whatsapp-dialog';
import { ShopActions } from './_components/shop-actions';
import { PlanOverride } from './_components/plan-override';
import { GoogleReviewsControls } from './_components/google-reviews-controls';
import { ArrowLeft, Mail, Phone, MapPin } from 'lucide-react';
import Link from 'next/link';
import type { Shop } from '@/types';
import { PageHeader } from '../../_components/page-header';

export default async function ShopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const shop = await getShopById(id).catch(() => null);
  if (!shop) notFound();

  const [onboarding, analytics, pulse, members, timeline, inbox, googleReviews] =
    await Promise.all([
      getShopOnboardingStatus(id).catch(() => null),
      getShopAnalytics(id).catch(() => null),
      getShopPulse(id).catch(() => null),
      getShopMembers(id).catch(() => []),
      getShopTimeline(id, 60).catch(() => []),
      getShopCommunicationHistory(id).catch(() => ({
        emails: [] as const,
        notifications: [],
        tickets: [],
      })),
      getGoogleReviewsUnlockState(id).catch(() => null),
    ]);
  const planId = pulse?.planId || shop.subscriptions?.[0]?.plan_id || 'none';
  const planStatus = pulse?.subscriptionStatus || shop.subscriptions?.[0]?.status || 'none';

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2">
        <Button variant="ghost" size="icon" asChild className="mt-0.5 shrink-0">
          <Link href="/shops" aria-label="Back to shops">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <PageHeader
            title={shop.shop_name}
            subtitle={`Created ${formatDate(shop.created_at)}`}
            actions={
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/shops/${id}/analytics`}>Activation</Link>
                </Button>
                <ShopWhatsAppDialog
                  shopId={id}
                  shopName={shop.shop_name}
                  phone={shop.phone_number}
                />
                <ShopActions shop={shop as Shop} />
              </>
            }
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Shop profile</CardTitle>
            {shop.is_suspended ? (
              <Badge variant="destructive">Suspended</Badge>
            ) : !shop.is_active ? (
              <Badge variant="destructive">Inactive</Badge>
            ) : (
              <Badge variant="success">Active</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-4">
              <h3 className="font-semibold text-ink-900">Contact Information</h3>
              {shop.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-ink-400" />
                  <span className="text-ink-700">{shop.email}</span>
                </div>
              )}
              {shop.phone_number && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-ink-400" />
                  <span className="text-ink-700">{shop.phone_number}</span>
                </div>
              )}
              {shop.address && (
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-ink-400 mt-0.5" />
                  <span className="text-ink-700">{shop.address}</span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-ink-900">Business Details</h3>
              <div className="text-sm">
                <p className="text-ink-500">GST Number</p>
                <p className="font-mono text-ink-900">
                  {shop.gst_number || 'Not added'}
                </p>
              </div>
              <div className="text-sm">
                <p className="text-ink-500">Activation</p>
                <p className="text-ink-900">
                  {onboarding
                    ? `${Math.round(onboarding.overallProgress)}% core steps`
                    : '—'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Sales, 30 days', formatCurrency(pulse?.gmv30d ?? 0)],
          ['Collected, 30 days', formatCurrency(pulse?.collected30d ?? 0)],
          ['Balance due', formatCurrency(pulse?.balanceDue ?? 0)],
          ['Invoices, 30 days', formatNumber(pulse?.invoices30d ?? 0)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-ink-100 bg-white px-3 py-3">
            <p className="text-[11px] uppercase tracking-wide text-ink-500">{label}</p>
            <p className="tnum mt-1 font-serif text-xl text-ink-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Plan override</CardTitle>
          </CardHeader>
          <CardContent>
            <PlanOverride
              shopId={id}
              planId={planId}
              status={planStatus}
              periodEnd={shop.subscriptions?.[0]?.current_period_end}
            />
          </CardContent>
        </Card>
        <Card id="google-reviews">
          <CardHeader>
            <CardTitle>Google reviews</CardTitle>
          </CardHeader>
          <CardContent>
            {googleReviews ? (
              <GoogleReviewsControls initial={googleReviews} />
            ) : (
              <p className="text-sm text-ink-500">Could not load Google reviews unlock state.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Support tickets</CardTitle>
            <CreateTicketDialog shopId={id} shopName={shop.shop_name} />
          </div>
        </CardHeader>
        <CardContent>
          {inbox.tickets.length === 0 ? (
            <p className="text-sm text-ink-500">No tickets for this shop.</p>
          ) : (
            <ul className="divide-y divide-ink-50">
              {inbox.tickets.map((ticket) => (
                <li key={ticket.id} className="py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-ink-900">{ticket.subject}</p>
                    <Badge variant="secondary">{ticket.status}</Badge>
                    <Badge variant="outline">{ticket.priority}</Badge>
                  </div>
                  {ticket.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-ink-500">{ticket.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>People ({members.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <p className="text-sm text-ink-500">No users are linked to this shop.</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {members.map((member) => (
                  <li key={member.userId} className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-ink-900">
                        {member.email ?? member.userId}
                      </p>
                      <Badge variant={member.active ? 'secondary' : 'destructive'}>
                        {member.role}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {member.lastSignInAt
                        ? `Last sign-in ${formatDateTime(member.lastSignInAt)}`
                        : 'Never signed in'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <p className="text-sm text-ink-500">No recorded activity yet.</p>
            ) : (
              <ol className="max-h-[480px] space-y-3 overflow-y-auto pr-1">
                {timeline.map((event, index) => (
                  <li key={`${event.at}-${index}`} className="flex gap-3 text-sm">
                    <span className="mt-0.5 w-20 shrink-0 text-xs uppercase tracking-wide text-ink-400">
                      {event.kind}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink-900">{event.title}</p>
                      {event.detail ? (
                        <p className="truncate text-xs text-ink-500">{event.detail}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs text-ink-400">
                      {event.at ? formatDateTime(event.at) : ''}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-ink-600">
              Active seats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="tnum text-xl font-semibold">
              {analytics?.usage.activeUsers ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-ink-600">
              Subscription
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="tnum text-xl font-semibold">
              {shop.subscriptions?.[0]?.plan_id || 'None'}{' '}
              <span className="text-base font-normal text-ink-500">
                {shop.subscriptions?.[0]?.status || ''}
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-ink-600">
              Created At
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink-700">
              {formatDateTime(shop.created_at)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
