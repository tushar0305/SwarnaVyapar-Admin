'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { WHATSAPP_PRESETS } from '@/lib/lead-score';
import { sendLeadWhatsApp } from '@/services/lead-intelligence.service';

export function LeadWhatsApp({
  userId,
  shopId,
  membershipId,
  shopName,
  reachable,
}: {
  userId: string;
  shopId: string;
  membershipId: string;
  shopName: string;
  reachable: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'session' | 'template' | 'auto'>('session');
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!message.trim()) {
      toast.error('Write a message first');
      return;
    }
    setLoading(true);
    try {
      const result = await sendLeadWhatsApp({ userId, shopId, membershipId, message, mode });
      if (result.sent) {
        toast.success(
          result.note ||
            `Meta accepted WhatsApp for ${result.shopName}. This is not a delivery receipt.`
        );
        setMessage('');
        router.refresh();
      } else {
        toast.error(result.error || 'WhatsApp was not sent');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'WhatsApp send failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-500">
        Sends to {shopName} from the SwarnaVyapar WhatsApp number. Free text needs a reply from them
        in the last 24 hours. Cold outreach needs an approved Meta template. A successful send marks
        an unreviewed or New lead as Contacted.
      </p>
      <div className="flex flex-wrap gap-2">
        {WHATSAPP_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            disabled={!reachable}
            onClick={() => setMessage(preset.message)}
            className="h-8 rounded-full border border-ink-200 bg-white px-3 text-xs text-ink-800 hover:border-gold-400 disabled:opacity-50"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <select
        value={mode}
        onChange={(event) => setMode(event.target.value as 'session' | 'template' | 'auto')}
        disabled={!reachable}
        className="h-9 w-full rounded-md border border-ink-300 bg-white px-3 text-sm disabled:bg-ink-50"
      >
        <option value="session">Free text · no template</option>
        <option value="template">Approved template</option>
        <option value="auto">Auto · template if ready, else free text</option>
      </select>
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        maxLength={900}
        rows={4}
        disabled={!reachable}
        placeholder="Write an instruction, or start from a preset above."
        className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm text-ink-900 disabled:bg-ink-50"
      />
      <button
        type="button"
        onClick={() => void send()}
        disabled={loading || !reachable}
        className="h-9 rounded-md bg-ink-900 px-4 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? 'Sending…' : mode === 'session' ? 'Send free text' : 'Send WhatsApp'}
      </button>
      {!reachable ? (
        <p className="text-xs text-amber-800">This shop has no valid WhatsApp number.</p>
      ) : null}
    </div>
  );
}
