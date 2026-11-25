'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  approveAgentSend,
  saveAgentReply,
  setAgentEscalation,
  setAgentOptOut,
  type AgentQueueRow,
} from '@/services/agent.service';

const GATE_LABEL: Record<AgentQueueRow['gate'], string> = {
  ready: 'Ready to send',
  recent: 'Sent in the last 4 days',
  capped: 'Two sends in 14 days',
  silent: 'Quiet for 21 days after two ignores',
  no_phone: 'No WhatsApp number',
  opted_out: 'Opted out',
  escalated: 'Waiting on a person',
};

export function AgentQueue({ rows }: { rows: AgentQueueRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [reply, setReply] = useState<Record<string, string>>({});

  async function run(id: string, action: () => Promise<void>) {
    setBusy(id);
    try {
      await action();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the queue');
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return <p className="text-sm text-ink-500">No shop needs a play right now.</p>;
  }

  return (
    <ul className="divide-y divide-ink-50 rounded-lg border border-ink-100 bg-white">
      {rows.map((row) => (
        <li key={row.shopId} className="space-y-3 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-ink-900">{row.shopName}</p>
              <p className="text-xs text-ink-500">
                {row.play.replaceAll('_', ' ')} · {GATE_LABEL[row.gate]}
              </p>
              <p className="mt-1 text-sm text-ink-700">{row.reason}</p>
              <p className="mt-2 text-sm text-ink-800">{row.question}</p>
              <p className="mt-1 text-xs text-ink-500">
                {row.templateName
                  ? `Template ${row.templateName} · Visit Website button`
                  : 'Session follow-up · needs 24h window'}
              </p>
              {row.lastReply ? (
                <p className="mt-2 text-xs text-ink-500">Last reply: {row.lastReply}</p>
              ) : null}
              {row.outcome ? (
                <p className="mt-1 text-xs text-ink-500">
                  7-day check: {row.outcome === 'moved' ? 'the shop did the step' : 'no change yet'}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy !== null || row.gate !== 'ready'}
                onClick={() =>
                  run(row.shopId, async () => {
                    const result = await approveAgentSend(row.shopId);
                    toast.success(result.note || 'Meta accepted the message. That is not a delivery receipt.');
                  })
                }
              >
                {busy === row.shopId ? 'Sending…' : 'Approve send'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() =>
                  run(row.shopId, async () => {
                    await setAgentEscalation(row.shopId, row.gate !== 'escalated');
                    toast.success(row.gate === 'escalated' ? 'Back in the queue' : 'Held for a person');
                  })
                }
              >
                {row.gate === 'escalated' ? 'Return' : 'Hold for a person'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() =>
                  run(row.shopId, async () => {
                    await setAgentOptOut(row.shopId, row.gate !== 'opted_out');
                    toast.success(row.gate === 'opted_out' ? 'Opted back in' : 'Opted out');
                  })
                }
              >
                {row.gate === 'opted_out' ? 'Opt in' : 'Opt out'}
              </Button>
            </div>
          </div>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const text = reply[row.shopId] || '';
              void run(row.shopId, async () => {
                await saveAgentReply(row.shopId, text);
                setReply((current) => ({ ...current, [row.shopId]: '' }));
                toast.success('Reply saved');
              });
            }}
          >
            <Input
              value={reply[row.shopId] || ''}
              onChange={(event) =>
                setReply((current) => ({ ...current, [row.shopId]: event.target.value }))
              }
              placeholder="What they replied. Stop opts them out."
              className="min-w-[16rem] flex-1"
            />
            <Button type="submit" size="sm" variant="outline" disabled={busy !== null}>
              Save reply
            </Button>
          </form>
        </li>
      ))}
    </ul>
  );
}
