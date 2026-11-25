import { JOIN_LABEL, PIPELINE_LABEL, PIPELINE_STATUSES } from '@/lib/lead-score';
import type { LeadListFilters } from '@/services/lead-intelligence.service';

const field =
  'h-9 w-full rounded-md border border-ink-300 bg-white px-3 text-sm text-ink-900';

export function LeadFilters({
  filters,
  owners,
}: {
  filters: LeadListFilters;
  owners: string[];
}) {
  const active = Object.entries(filters).some(([key, value]) => key !== 'page' && Boolean(value));
  const pinned = [
    filters.live === 'active' ? 'Active in 7 days' : null,
    filters.live === 'returning' ? 'Returning' : null,
    filters.intent === 'high' ? 'High intent' : null,
    filters.converted === 'yes' ? 'Converted' : null,
    filters.converted === 'no' ? 'Not converted' : null,
    filters.due === '1' ? 'Follow-up due' : null,
  ].filter((item): item is string => Boolean(item));
  const ownerOptions =
    filters.owner && filters.owner !== '__unassigned' && !owners.includes(filters.owner)
      ? [filters.owner, ...owners]
      : owners;

  return (
    <form method="get" action="/leads" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {filters.live ? <input type="hidden" name="live" value={filters.live} /> : null}
      {filters.intent ? <input type="hidden" name="intent" value={filters.intent} /> : null}
      {filters.converted ? <input type="hidden" name="converted" value={filters.converted} /> : null}
      {filters.due ? <input type="hidden" name="due" value={filters.due} /> : null}
      {filters.sort ? <input type="hidden" name="sort" value={filters.sort} /> : null}
      {filters.dir ? <input type="hidden" name="dir" value={filters.dir} /> : null}
      {pinned.length > 0 ? (
        <p className="text-xs text-ink-600 sm:col-span-2 lg:col-span-4">Also applied: {pinned.join(' · ')}</p>
      ) : null}
      <label className="text-sm text-ink-600 sm:col-span-2">
        Search
        <input
          name="q"
          defaultValue={filters.q || ''}
          placeholder="Name, email, shop, or phone"
          className={`mt-1 ${field}`}
        />
      </label>
      <label className="text-sm text-ink-600">
        Signed up
        <select name="joined" defaultValue={filters.joined || ''} className={`mt-1 ${field}`}>
          <option value="">Any time</option>
          <option value="today">Today, IST</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
      </label>
      <label className="text-sm text-ink-600">
        Pipeline
        <select name="pipeline" defaultValue={filters.pipeline || ''} className={`mt-1 ${field}`}>
          <option value="">Any status</option>
          <option value="unreviewed">{PIPELINE_LABEL.unreviewed}</option>
          {PIPELINE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {PIPELINE_LABEL[status]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm text-ink-600">
        Lead score
        <select name="band" defaultValue={filters.band || ''} className={`mt-1 ${field}`}>
          <option value="">Any score</option>
          <option value="high">High, 30+</option>
          <option value="medium">Medium, 15–29</option>
          <option value="low">Low, under 15</option>
        </select>
      </label>
      <label className="text-sm text-ink-600">
        Source
        <select name="joinedAs" defaultValue={filters.joinedAs || ''} className={`mt-1 ${field}`}>
          <option value="">Any source</option>
          <option value="created_shop">{JOIN_LABEL.created_shop}</option>
          <option value="added">{JOIN_LABEL.added}</option>
          <option value="no_shop">{JOIN_LABEL.no_shop}</option>
        </select>
      </label>
      <label className="text-sm text-ink-600">
        Activity
        <select name="cohort" defaultValue={filters.cohort || ''} className={`mt-1 ${field}`}>
          <option value="">Any activity</option>
          <option value="never_started">Never started</option>
          <option value="stalled_billing">Stocked, never billed</option>
          <option value="activated">Activated</option>
          <option value="quiet">Quiet after billing</option>
        </select>
      </label>
      <label className="text-sm text-ink-600">
        Plan
        <select name="plan" defaultValue={filters.plan || ''} className={`mt-1 ${field}`}>
          <option value="">Any plan</option>
          <option value="none">No plan</option>
          <option value="free">Starter</option>
          <option value="pro">Professional</option>
          <option value="business">Business</option>
        </select>
      </label>
      <label className="text-sm text-ink-600">
        WhatsApp
        <select name="whatsapp" defaultValue={filters.whatsapp || ''} className={`mt-1 ${field}`}>
          <option value="">Any</option>
          <option value="connected">Shop WhatsApp connected</option>
          <option value="off">Shop exists, WhatsApp off</option>
        </select>
      </label>
      <label className="text-sm text-ink-600">
        Assigned owner
        <select name="owner" defaultValue={filters.owner || ''} className={`mt-1 ${field}`}>
          <option value="">Anyone</option>
          <option value="__unassigned">Unassigned</option>
          {ownerOptions.map((owner) => (
            <option key={owner} value={owner}>
              {owner}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2">
        <button type="submit" className="h-9 rounded-md bg-ink-900 px-4 text-sm font-medium text-white">
          Apply
        </button>
        {active ? (
          <a href="/leads" className="inline-flex h-9 items-center rounded-md border border-ink-300 px-4 text-sm text-ink-800">
            Clear
          </a>
        ) : null}
      </div>
    </form>
  );
}
