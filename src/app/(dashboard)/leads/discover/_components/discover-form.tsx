'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DISCOVERY_PRESETS,
  MAX_SEARCHES_PER_RUN,
  SERPAPI_FREE_MONTHLY_SEARCHES,
} from '@/lib/lead-discovery';
import { zoomForRadiusKm } from '@/lib/nominatim';
import {
  runLeadDiscovery,
  saveDiscoverySearch,
  type DiscoveryRunResult,
  type SavedDiscoverySearch,
} from '@/services/lead-discovery.service';
import { MapAreaPickerDynamic, type MapAreaSelection } from './map-dynamic';
import { SavedSearches, SaveSearchButton } from './saved-searches';

const field =
  'mt-1 h-9 w-full rounded-md border border-ink-300 bg-white px-3 text-sm text-ink-900';

export function DiscoverForm({
  remaining,
  configured,
  savedSearches,
}: {
  remaining: number;
  configured: boolean;
  savedSearches: SavedDiscoverySearch[];
}) {
  const router = useRouter();
  const [mapOpen, setMapOpen] = useState(false);
  const [selection, setSelection] = useState<MapAreaSelection | null>(null);
  const [presetId, setPresetId] = useState(DISCOVERY_PRESETS[0]?.id || 'retail');
  const [keywords, setKeywords] = useState(DISCOVERY_PRESETS[0]?.keywords || 'jewellery shops');
  const [maxPages, setMaxPages] = useState(2);
  const [contactFilter, setContactFilter] = useState<'all' | 'phone' | 'website'>('all');
  const [forceRefresh, setForceRefresh] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState<DiscoveryRunResult | null>(null);
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);

  const keywordCount = keywords
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean).length;
  const planned = Math.max(1, keywordCount) * maxPages;

  function applyPreset(id: string) {
    setPresetId(id);
    const preset = DISCOVERY_PRESETS.find((p) => p.id === id);
    if (preset) setKeywords(preset.keywords);
  }

  function applySaved(search: SavedDiscoverySearch) {
    setActiveSavedId(search.id);
    setSelection({
      lat: Number(search.lat),
      lon: Number(search.lon),
      radiusKm: Number(search.radius_km),
      label: search.label,
      cityLabel: search.city_label,
      displayName: search.display_name || search.label,
      zoom: search.zoom ?? zoomForRadiusKm(Number(search.radius_km)),
    });
    setKeywords(search.keywords);
    setMaxPages(search.max_pages);
    setContactFilter(search.contact_filter);
    const match = DISCOVERY_PRESETS.find((p) => p.keywords === search.keywords);
    setPresetId(match?.id || 'retail');
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!configured) {
      toast.error('Add SERPAPI_KEY to the admin environment first');
      return;
    }
    if (!selection) {
      toast.error('Open the map and select an area + radius first');
      return;
    }
    if (planned > remaining) {
      toast.error(`This run needs up to ${planned} searches; only ${remaining} remain`);
      return;
    }
    if (planned > MAX_SEARCHES_PER_RUN) {
      toast.error(`Cap is ${MAX_SEARCHES_PER_RUN} searches per click`);
      return;
    }
    setLoading(true);
    setLastRun(null);
    try {
      const result = await runLeadDiscovery({
        mapSelection: {
          lat: selection.lat,
          lon: selection.lon,
          radiusKm: selection.radiusKm,
          label: selection.label,
          cityLabel: selection.cityLabel,
          displayName: selection.displayName,
          zoom: selection.zoom,
        },
        keywords,
        radiusKm: selection.radiusKm,
        maxPages,
        contactFilter,
        forceRefresh,
      });
      setLastRun(result);
      toast.success(
        `Saved ${result.upserted} · billed ${result.billed}` +
          (result.shopsPerBilled != null ? ` · ${result.shopsPerBilled}/credit` : '')
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Discovery failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-4">
        {!configured ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Set <code className="text-xs">SERPAPI_KEY</code> in admin env and restart the server.
          </p>
        ) : null}

        <div className="rounded-md border border-ink-100 bg-ink-50 px-3 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 text-sm text-ink-700">
              <p className="font-medium text-ink-900">Discovery area</p>
              {selection ? (
                <>
                  <p className="mt-1">
                    {selection.label}
                    {selection.cityLabel ? ` · ${selection.cityLabel}` : ''} · {selection.radiusKm}{' '}
                    km
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">{selection.displayName}</p>
                  <p className="text-xs text-ink-400">
                    {selection.lat.toFixed(5)}, {selection.lon.toFixed(5)}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-ink-500">
                  Pick on the map (OSM / Nominatim — no SerpApi credits). Then Discover scrapes that
                  circle.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <SaveSearchButton
                disabled={!selection || loading}
                onSave={async (name) => {
                  if (!selection) return;
                  try {
                    await saveDiscoverySearch({
                      id: activeSavedId || undefined,
                      name,
                      lat: selection.lat,
                      lon: selection.lon,
                      radiusKm: selection.radiusKm,
                      label: selection.label,
                      cityLabel: selection.cityLabel,
                      displayName: selection.displayName,
                      zoom: selection.zoom,
                      keywords,
                      maxPages,
                      contactFilter,
                    });
                    toast.success(activeSavedId ? 'Saved search updated' : 'Search saved');
                    router.refresh();
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : 'Could not save');
                    throw error;
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={() => setMapOpen(true)}>
                {selection ? 'Change on map' : 'Select area on map'}
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-ink-100 px-3 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            Saved searches
          </p>
          <SavedSearches searches={savedSearches} onApply={applySaved} />
        </div>

        <div className="flex flex-wrap gap-2">
          {DISCOVERY_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                presetId === preset.id
                  ? 'border-ink-900 bg-ink-900 text-white'
                  : 'border-ink-200 bg-white text-ink-600 hover:border-ink-400'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-sm text-ink-600 sm:col-span-2">
            Keywords
            <input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className={field}
              disabled={loading}
            />
            <span className="mt-1 block text-[11px] text-ink-400">
              Comma-separate up to 3. Radius comes from the map slider.
            </span>
          </label>

          <label className="block text-sm text-ink-600">
            Pages per keyword
            <select
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value))}
              className={field}
              disabled={loading}
            >
              <option value={1}>1 page (~20 shops)</option>
              <option value={2}>2 pages (~40 shops)</option>
              <option value={3}>3 pages (~60 shops)</option>
            </select>
          </label>

          <label className="block text-sm text-ink-600">
            Contact filter
            <select
              value={contactFilter}
              onChange={(e) => setContactFilter(e.target.value as 'all' | 'phone' | 'website')}
              className={field}
              disabled={loading}
            >
              <option value="all">All available</option>
              <option value="phone">Has phone</option>
              <option value="website">Has website</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-3">
          <div className="space-y-1">
            <p className="text-xs text-ink-500">
              Up to <strong className="text-ink-800">{planned}</strong> of{' '}
              <strong className="text-ink-800">{remaining}</strong> Free searches (
              {SERPAPI_FREE_MONTHLY_SEARCHES}/mo). Cap {MAX_SEARCHES_PER_RUN}/click.
            </p>
            <label className="flex items-center gap-2 text-xs text-ink-600">
              <input
                type="checkbox"
                checked={forceRefresh}
                onChange={(e) => setForceRefresh(e.target.checked)}
                disabled={loading}
              />
              Force refresh (bypass 7-day credit governor for this area)
            </label>
          </div>
          <Button
            type="submit"
            disabled={loading || !configured || !selection || planned > remaining}
          >
            {loading ? 'Discovering…' : 'Discover jewellery shops'}
          </Button>
        </div>

        {lastRun ? (
          <p className="rounded-md border border-ink-100 bg-ink-50 px-3 py-2 text-xs text-ink-600">
            {lastRun.city}
            {lastRun.neighbourhood ? ` · ${lastRun.neighbourhood}` : ''}: fetched {lastRun.fetched},
            in-radius {lastRun.inRadius}, saved {lastRun.upserted}. Billed {lastRun.billed}, cached{' '}
            {lastRun.cached}
            {lastRun.shopsPerBilled != null ? ` · ${lastRun.shopsPerBilled} shops/credit` : ''}. Month{' '}
            {lastRun.monthUsed}/{lastRun.monthLimit}.
          </p>
        ) : null}
      </form>

      {mapOpen ? (
        <MapAreaPickerDynamic
          open
          initial={selection || undefined}
          onClose={() => setMapOpen(false)}
          onConfirm={(next) => {
            setSelection(next);
            setActiveSavedId(null);
            setMapOpen(false);
            toast.success(`Area set: ${next.label} · ${next.radiusKm} km`);
          }}
        />
      ) : null}
    </>
  );
}
