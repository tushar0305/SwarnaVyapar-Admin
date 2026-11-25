'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  deleteSavedDiscoverySearch,
  touchSavedDiscoverySearch,
  type SavedDiscoverySearch,
} from '@/services/lead-discovery.service';

export function SavedSearches({
  searches,
  onApply,
}: {
  searches: SavedDiscoverySearch[];
  onApply: (search: SavedDiscoverySearch) => void;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!searches.length) {
    return (
      <p className="text-xs text-ink-400">
        No saved areas yet. Pick a map area, then use <strong>Save search</strong>.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {searches.map((search) => (
        <li
          key={search.id}
          className="flex items-start gap-2 rounded-md border border-ink-100 bg-white px-2.5 py-2"
        >
          <Bookmark className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-600" aria-hidden />
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            disabled={busyId === search.id}
            onClick={async () => {
              setBusyId(search.id);
              try {
                await touchSavedDiscoverySearch(search.id);
                onApply(search);
                toast.success(`Loaded “${search.name}”`);
                router.refresh();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Could not load search');
              } finally {
                setBusyId(null);
              }
            }}
          >
            <p className="truncate text-sm font-medium text-ink-900">{search.name}</p>
            <p className="truncate text-[11px] text-ink-500">
              {search.label} · {search.city_label} · {search.radius_km} km · {search.keywords}
            </p>
          </button>
          <button
            type="button"
            aria-label={`Delete ${search.name}`}
            className="grid size-8 shrink-0 place-items-center rounded-md text-ink-400 hover:bg-ink-50 hover:text-ink-800"
            disabled={busyId === search.id}
            onClick={async () => {
              setBusyId(search.id);
              try {
                await deleteSavedDiscoverySearch(search.id);
                toast.success('Saved search removed');
                router.refresh();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Delete failed');
              } finally {
                setBusyId(null);
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function SaveSearchButton({
  disabled,
  onSave,
}: {
  disabled?: boolean;
  onSave: (name: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        Save search
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Barabanki retail 8km"
        className="h-8 min-w-[180px] flex-1 rounded-md border border-ink-300 px-2 text-sm"
        autoFocus
      />
      <Button
        type="button"
        size="sm"
        disabled={busy || name.trim().length < 2}
        onClick={async () => {
          setBusy(true);
          try {
            await onSave(name.trim());
            setName('');
            setOpen(false);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Saving…' : 'Save'}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}
