'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { WhatsAppStatus } from '@/services/whatsapp-outreach.service';
import {
  provisionOpsTemplate,
  testWhatsAppConnection,
} from '@/services/whatsapp-outreach.service';

export function WhatsAppConnection({ initial }: { initial: WhatsAppStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [busy, setBusy] = useState<'test' | 'template' | null>(null);

  async function test() {
    setBusy('test');
    try {
      const next = await testWhatsAppConnection();
      setStatus(next);
      toast[next.connected ? 'success' : 'error'](
        next.connected ? 'WhatsApp Cloud API is connected' : next.error || 'Connection failed'
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Test failed');
    } finally {
      setBusy(null);
    }
  }

  async function provision() {
    setBusy('template');
    try {
      const next = await provisionOpsTemplate();
      setStatus(next);
      toast[next.templateStatus ? 'success' : 'error'](
        next.templateStatus
          ? `Template ${next.templateName} is ${next.templateStatus}`
          : next.error || 'Admin templates not found in Meta yet'
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Template setup failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <p className="text-sm text-ink-500">Cloud API</p>
          <p className="text-sm font-medium text-ink-900">
            {status.connected ? 'Connected' : status.ready ? 'Credentials set' : 'Not configured'}
          </p>
        </div>
        <div>
          <p className="text-sm text-ink-500">From</p>
          <p className="text-sm font-medium text-ink-900">
            {status.displayName || 'SwarnaVyapar'}
            {status.displayPhone ? ` · ${status.displayPhone}` : ''}
          </p>
        </div>
        <div>
          <p className="text-sm text-ink-500">Default admin template</p>
          <p className="text-sm font-medium text-ink-900">
            {status.templateName}
            {status.templateStatus ? ` · ${status.templateStatus}` : ''}
            {status.templateCategory ? ` · ${status.templateCategory}` : ''}
          </p>
        </div>
      </div>
      {status.templates.length > 0 ? (
        <ul className="space-y-1 text-xs text-ink-600">
          {status.templates
            .filter((row) =>
              ['sv_admin_setup', 'sv_admin_quiet', 'sv_admin_account'].includes(row.name)
            )
            .map((row) => (
              <li key={`${row.name}-${row.language}`}>
                {row.name} · {row.status}
                {row.category ? ` · ${row.category}` : ''} · {row.language}
              </li>
            ))}
        </ul>
      ) : null}
      {status.templateCategory === 'MARKETING' ? (
        <p className="text-sm text-amber-800">
          Meta classified this template as MARKETING. The API can accept the send while the phone
          never shows it. Wait for the Utility templates to be APPROVED.
        </p>
      ) : null}
      {status.error ? <p className="text-sm text-red-700">{status.error}</p> : null}
      {!status.ready && status.missing.length > 0 ? (
        <p className="text-sm text-ink-500">
          Add {status.missing.join(', ')} to <code>.env.local</code> from Meta WhatsApp → API Setup,
          then restart the admin server.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={test} disabled={busy !== null || !status.ready}>
          {busy === 'test' ? 'Testing…' : 'Test connection'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={provision}
          disabled={busy !== null || !status.ready}
        >
          {busy === 'template' ? 'Checking…' : 'Refresh template status'}
        </Button>
      </div>
    </div>
  );
}
