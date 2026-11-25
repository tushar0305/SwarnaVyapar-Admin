import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  formatInquiryPhone,
  INQUIRY_INTEREST_LABEL,
  INQUIRY_STATUS_LABEL,
  type InquiryStatus,
  waMeHref,
} from '@/lib/marketing-inquiries';
import { formatDate, formatDateTime } from '@/lib/utils';
import { getMarketingInquiry } from '@/services/marketing-inquiries.service';
import { PageFrame } from '../../../_components/page-frame';
import { PageHeader } from '../../../_components/page-header';
import { InquiryCrmForm } from '../_components/inquiry-crm-form';

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

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="mt-1 text-sm text-ink-800">{value || '—'}</dd>
    </div>
  );
}

export default async function MarketingInquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const inquiry = await getMarketingInquiry(id);
  if (!inquiry) notFound();

  const wa = waMeHref(inquiry.phone);
  const title = inquiry.name || inquiry.shopName || formatInquiryPhone(inquiry.phone);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Website inquiry"
        title={title}
        subtitle="Submitted from the public site form. Not linked to a signed-up account."
        actions={
          <>
            <Badge variant={STATUS_VARIANT[inquiry.status]}>
              {INQUIRY_STATUS_LABEL[inquiry.status]}
            </Badge>
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center rounded-md bg-ink-900 px-3 text-sm font-medium text-white"
              >
                WhatsApp
              </a>
            ) : null}
            <Link
              href="/leads/inquiries"
              className="inline-flex h-9 items-center rounded-md border border-ink-300 bg-white px-3 text-sm text-ink-700 hover:bg-ink-50"
            >
              All inquiries
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Detail label="Name" value={inquiry.name} />
                <Detail label="Shop name" value={inquiry.shopName} />
                <Detail label="Phone" value={formatInquiryPhone(inquiry.phone)} />
                <Detail label="City" value={inquiry.city} />
                <Detail label="State" value={inquiry.state} />
                <Detail label="PIN" value={inquiry.pinCode} />
                <Detail label="Interest" value={INQUIRY_INTEREST_LABEL[inquiry.interest]} />
                <Detail label="Consent" value={inquiry.consent ? 'Yes' : 'No'} />
                <Detail label="Shop type" value={inquiry.shopType} />
                <Detail label="Branches" value={inquiry.branches} />
                <Detail label="Current tool" value={inquiry.currentTool} />
                <Detail label="Page" value={inquiry.pagePath} />
                <Detail label="Submitted" value={formatDateTime(inquiry.createdAt)} />
                <Detail label="Updated" value={formatDateTime(inquiry.updatedAt)} />
                <Detail
                  label="Follow-up"
                  value={inquiry.followUpOn ? formatDate(inquiry.followUpOn) : null}
                />
                <Detail label="Assigned to" value={inquiry.assignedTo} />
              </dl>
            </CardContent>
          </Card>

          {inquiry.notes ? (
            <Card>
              <CardHeader>
                <CardTitle>Saved notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
                  {inquiry.notes}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Follow up</CardTitle>
            </CardHeader>
            <CardContent>
              <InquiryCrmForm
                id={inquiry.id}
                status={inquiry.status}
                assignedTo={inquiry.assignedTo}
                followUpOn={inquiry.followUpOn}
                notes={inquiry.notes}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </PageFrame>
  );
}
