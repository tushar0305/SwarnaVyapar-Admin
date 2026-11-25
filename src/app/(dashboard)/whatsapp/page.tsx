import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';
import { PageHeader } from '../_components/page-header';
import {
  getRecentWhatsAppSends,
  getWhatsAppStatus,
  listSendableWhatsAppTemplates,
  listWhatsAppShops,
} from '@/services/whatsapp-outreach.service';
import { WhatsAppConnection } from './_components/whatsapp-connection';
import { WhatsAppComposer } from './_components/whatsapp-composer';

export default async function WhatsAppPage() {
  const [status, shops, sends, catalog] = await Promise.all([
    getWhatsAppStatus(),
    listWhatsAppShops(),
    getRecentWhatsAppSends(40),
    listSendableWhatsAppTemplates(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp"
        subtitle="Meta “accepted” is not delivery. Prefer UTILITY templates — MARKETING often never shows on the phone."
      />

      <Card>
        <CardHeader>
          <CardTitle>Connection</CardTitle>
        </CardHeader>
        <CardContent>
          <WhatsAppConnection initial={status} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Send an instruction</CardTitle>
          </CardHeader>
          <CardContent>
            {status.connected ? (
              <WhatsAppComposer shops={shops} initialTemplates={catalog.templates} />
            ) : (
              <p className="text-sm text-ink-500">
                Connect the Cloud API first. Cold outreach needs an APPROVED Meta template.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent sends</CardTitle>
            <p className="text-xs text-ink-500">
              Accepted by Meta means the API took the message. It does not mean the shop’s phone received it.
            </p>
          </CardHeader>
          <CardContent>
            {sends.length === 0 ? (
              <p className="text-sm text-ink-500">No admin WhatsApp messages yet.</p>
            ) : (
              <div className="space-y-2">
                {sends.map((row) => (
                  <div key={row.id} className="rounded-lg bg-ink-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-ink-900">{row.shopName}</p>
                      <Badge variant={row.status === 'sent' ? 'warning' : 'destructive'}>
                        {row.status === 'sent' ? 'Accepted by Meta' : 'Failed'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-ink-600">{row.body}</p>
                    <p className="mt-1 text-xs text-ink-500">
                      {row.phone} · {row.channel}
                      {row.templateName ? ` · ${row.templateName}` : ''} ·{' '}
                      {formatDateTime(row.createdAt)}
                      {row.error ? ` · ${row.error}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
