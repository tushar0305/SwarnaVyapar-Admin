'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PIPELINE_LABEL, PIPELINE_STATUSES, toDatetimeLocalIst, type StoredPipelineStatus } from '@/lib/lead-score';
import { saveLead } from '@/services/lead-intelligence.service';

const field = 'mt-1 h-9 w-full rounded-md border border-ink-300 bg-white px-3 text-sm text-ink-900';

export function LeadCrmForm({
  userId,
  shopId,
  membershipId,
  status,
  ownerName,
  followUpAt,
}: {
  userId: string;
  shopId: string;
  membershipId: string;
  status: StoredPipelineStatus | 'unreviewed';
  ownerName: string | null;
  followUpAt: string | null;
}) {
  const router = useRouter();
  const [pipeline, setPipeline] = useState<StoredPipelineStatus>(status === 'unreviewed' ? 'new' : status);
  const [owner, setOwner] = useState(ownerName || '');
  const [followUp, setFollowUp] = useState(toDatetimeLocalIst(followUpAt));
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (
      (pipeline === 'lost' || pipeline === 'not_interested') &&
      !window.confirm(
        pipeline === 'not_interested'
          ? 'Mark this lead as not interested?'
          : 'Mark this lead as lost?'
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      await saveLead({
        userId,
        shopId,
        membershipId,
        status: pipeline,
        ownerName: owner,
        followUpLocal: followUp,
        note,
      });
      toast.success('Lead saved');
      setNote('');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the lead');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {status === 'unreviewed' ? (
        <p className="text-xs text-ink-500">Unreviewed until you save a status. Saving without a note still marks them New.</p>
      ) : null}
      <label className="block text-sm text-ink-600">
        Status
        <select
          value={pipeline}
          onChange={(event) => setPipeline(event.target.value as StoredPipelineStatus)}
          className={field}
        >
          {PIPELINE_STATUSES.map((item) => (
            <option key={item} value={item}>
              {PIPELINE_LABEL[item]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm text-ink-600">
        Assigned owner
        <input
          value={owner}
          onChange={(event) => setOwner(event.target.value)}
          maxLength={80}
          placeholder="Name of the person following up"
          className={field}
        />
      </label>
      <label className="block text-sm text-ink-600">
        Follow-up
        <input
          type="datetime-local"
          value={followUp}
          onChange={(event) => setFollowUp(event.target.value)}
          className={field}
        />
        <span className="mt-1 block text-xs text-ink-500">IST. Leave empty to clear a scheduled follow-up.</span>
      </label>
      <label className="block text-sm text-ink-600">
        Note
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="What did they say, and what should happen next?"
          className="mt-1 w-full rounded-md border border-ink-300 px-3 py-2 text-sm text-ink-900"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="h-9 rounded-md bg-ink-900 px-4 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? 'Saving…' : 'Save lead'}
      </button>
    </form>
  );
}
