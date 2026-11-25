'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { DISCOVERED_LEAD_STATUSES, DISCOVERED_LEAD_STATUS_LABEL } from '@/lib/lead-discovery';

const field =
  'h-9 rounded-md border border-ink-300 bg-white px-3 text-sm text-ink-900';

export function DiscoverFilters({ cities }: { cities: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    startTransition(() => {
      router.push(`/leads/discover?${next.toString()}`);
    });
  }

  return (
    <div className={`flex flex-wrap items-end gap-3 ${pending ? 'opacity-70' : ''}`}>
      <label className="text-sm text-ink-600">
        Search
        <input
          defaultValue={params.get('q') || ''}
          placeholder="Name, phone, address"
          className={`mt-1 block ${field} w-48`}
          onKeyDown={(e) => {
            if (e.key === 'Enter') update('q', (e.target as HTMLInputElement).value.trim());
          }}
          onBlur={(e) => update('q', e.target.value.trim())}
        />
      </label>
      <label className="text-sm text-ink-600">
        City
        <select
          className={`mt-1 block ${field}`}
          value={params.get('city') || ''}
          onChange={(e) => update('city', e.target.value)}
        >
          <option value="">All cities</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm text-ink-600">
        Status
        <select
          className={`mt-1 block ${field}`}
          value={params.get('status') || ''}
          onChange={(e) => update('status', e.target.value)}
        >
          <option value="">All statuses</option>
          {DISCOVERED_LEAD_STATUSES.map((status) => (
            <option key={status} value={status}>
              {DISCOVERED_LEAD_STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm text-ink-600">
        Score band
        <select
          className={`mt-1 block ${field}`}
          value={params.get('band') || ''}
          onChange={(e) => update('band', e.target.value)}
        >
          <option value="">All</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </label>
      <label className="text-sm text-ink-600">
        Fit
        <select
          className={`mt-1 block ${field}`}
          value={params.get('digitalGap') || ''}
          onChange={(e) => update('digitalGap', e.target.value)}
        >
          <option value="">Any</option>
          <option value="yes">Digital gap</option>
        </select>
      </label>
      <label className="text-sm text-ink-600">
        Contact
        <select
          className={`mt-1 block ${field}`}
          value={params.get('contact') || ''}
          onChange={(e) => update('contact', e.target.value)}
        >
          <option value="">Any</option>
          <option value="phone">Has phone</option>
          <option value="no_phone">No phone</option>
          <option value="website">Has website</option>
        </select>
      </label>
      <label className="text-sm text-ink-600">
        Sort
        <select
          className={`mt-1 block ${field}`}
          value={params.get('sort') || 'score'}
          onChange={(e) => update('sort', e.target.value === 'score' ? '' : e.target.value)}
        >
          <option value="score">Score</option>
          <option value="recent">Newest</option>
          <option value="follow_up">Follow-up</option>
        </select>
      </label>
      <label className="flex items-center gap-2 pb-1 text-sm text-ink-600">
        <input
          type="checkbox"
          checked={params.get('due') === '1'}
          onChange={(e) => update('due', e.target.checked ? '1' : '')}
        />
        Due follow-ups
      </label>
    </div>
  );
}
