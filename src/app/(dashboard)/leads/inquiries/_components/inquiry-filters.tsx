import {
  INQUIRY_INTEREST_LABEL,
  INQUIRY_INTERESTS,
  INQUIRY_STATUS_LABEL,
  INQUIRY_STATUSES,
} from '@/lib/marketing-inquiries';
import type { InquiryListFilters } from '@/services/marketing-inquiries.service';

const field = 'h-9 w-full rounded-md border border-ink-300 bg-white px-3 text-sm text-ink-900';

export function InquiryFilters({
  filters,
  assignees,
}: {
  filters: InquiryListFilters;
  assignees: string[];
}) {
  return (
    <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <label className="text-sm text-ink-600 sm:col-span-2 lg:col-span-1">
        Search
        <input
          name="q"
          defaultValue={filters.q || ''}
          placeholder="Name, shop, phone, city"
          className={`mt-1 ${field}`}
        />
      </label>
      <label className="text-sm text-ink-600">
        Status
        <select name="status" defaultValue={filters.status || ''} className={`mt-1 ${field}`}>
          <option value="">Any status</option>
          {INQUIRY_STATUSES.map((status) => (
            <option key={status} value={status}>
              {INQUIRY_STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm text-ink-600">
        Interest
        <select name="interest" defaultValue={filters.interest || ''} className={`mt-1 ${field}`}>
          <option value="">Any interest</option>
          {INQUIRY_INTERESTS.map((interest) => (
            <option key={interest} value={interest}>
              {INQUIRY_INTEREST_LABEL[interest]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm text-ink-600">
        Assignee
        <select name="assigned" defaultValue={filters.assigned || ''} className={`mt-1 ${field}`}>
          <option value="">Anyone</option>
          <option value="__unassigned">Unassigned</option>
          {assignees.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm text-ink-600">
        Follow-up
        <select name="due" defaultValue={filters.due || ''} className={`mt-1 ${field}`}>
          <option value="">Any</option>
          <option value="1">Due today or overdue</option>
        </select>
      </label>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
        <button
          type="submit"
          className="h-9 rounded-md bg-ink-900 px-4 text-sm font-medium text-white"
        >
          Apply filters
        </button>
        <a
          href="/leads/inquiries"
          className="inline-flex h-9 items-center rounded-md border border-ink-300 bg-white px-3 text-sm text-ink-700 hover:bg-ink-50"
        >
          Clear
        </a>
      </div>
    </form>
  );
}
