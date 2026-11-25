'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  INQUIRY_STATUS_LABEL,
  INQUIRY_STATUSES,
  type InquiryStatus,
} from '@/lib/marketing-inquiries';
import { saveMarketingInquiry } from '@/services/marketing-inquiries.service';

const field = 'mt-1 h-9 w-full rounded-md border border-ink-300 bg-white px-3 text-sm text-ink-900';

export function InquiryCrmForm({
  id,
  status,
  assignedTo,
  followUpOn,
  notes,
}: {
  id: string;
  status: InquiryStatus;
  assignedTo: string | null;
  followUpOn: string | null;
  notes: string | null;
}) {
  const router = useRouter();
  const [pipeline, setPipeline] = useState<InquiryStatus>(status);
  const [assignee, setAssignee] = useState(assignedTo || '');
  const [followUp, setFollowUp] = useState(followUpOn || '');
  const [note, setNote] = useState(notes || '');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pipeline === 'lost' && !window.confirm('Mark this inquiry as lost?')) return;
    setLoading(true);
    try {
      await saveMarketingInquiry({
        id,
        status: pipeline,
        assignedTo: assignee,
        followUpOn: followUp,
        notes: note,
      });
      toast.success('Inquiry saved');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the inquiry');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block text-sm text-ink-600">
        Status
        <select
          value={pipeline}
          onChange={(event) => setPipeline(event.target.value as InquiryStatus)}
          className={field}
        >
          {INQUIRY_STATUSES.map((item) => (
            <option key={item} value={item}>
              {INQUIRY_STATUS_LABEL[item]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm text-ink-600">
        Assigned to
        <input
          value={assignee}
          onChange={(event) => setAssignee(event.target.value)}
          maxLength={80}
          placeholder="Who is following up"
          className={field}
        />
      </label>
      <label className="block text-sm text-ink-600">
        Follow-up date
        <input
          type="date"
          value={followUp}
          onChange={(event) => setFollowUp(event.target.value)}
          className={field}
        />
        <span className="mt-1 block text-xs text-ink-500">Leave empty to clear.</span>
      </label>
      <label className="block text-sm text-ink-600">
        Notes
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={4000}
          rows={5}
          placeholder="What did they say, and what should happen next?"
          className="mt-1 w-full rounded-md border border-ink-300 px-3 py-2 text-sm text-ink-900"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="h-9 rounded-md bg-ink-900 px-4 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? 'Saving…' : 'Save inquiry'}
      </button>
    </form>
  );
}
