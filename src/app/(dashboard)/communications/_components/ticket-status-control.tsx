'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { updateSupportTicketStatus } from '@/services/communication.service';

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;

export function TicketStatusControl({
  ticketId,
  status,
  resolution,
}: {
  ticketId: string;
  status: string;
  resolution?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState(resolution || '');

  function onStatusChange(next: (typeof STATUSES)[number]) {
    startTransition(async () => {
      try {
        await updateSupportTicketStatus(
          ticketId,
          next,
          next === 'resolved' || next === 'closed' ? note || undefined : undefined
        );
        toast.success(`Status → ${next.replace('_', ' ')}`);
        router.refresh();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Update failed');
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2 min-w-[160px]">
      <select
        value={status}
        disabled={pending}
        onChange={(e) => onStatusChange(e.target.value as (typeof STATUSES)[number])}
        className="h-9 rounded-md border border-ink-300 bg-white px-2 text-sm"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace('_', ' ')}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Resolution note"
        className="h-8 w-full rounded-md border border-ink-200 px-2 text-xs"
      />
    </div>
  );
}
