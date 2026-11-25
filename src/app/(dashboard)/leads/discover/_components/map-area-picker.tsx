'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import { Button } from '@/components/ui/button';
import { shortAreaLabel, zoomForRadiusKm, type NominatimPlace } from '@/lib/nominatim';
import { reverseGeocodeAction, searchPlacesAction } from '@/services/geocode.service';
import 'leaflet/dist/leaflet.css';

export type MapAreaSelection = {
  lat: number;
  lon: number;
  radiusKm: number;
  label: string;
  cityLabel: string;
  displayName: string;
  zoom: number;
};

const DEFAULT_LAT = 26.8467;
const DEFAULT_LON = 80.9462;
const DEFAULT_RADIUS_KM = 8;

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function placeFromCoords(lat: number, lon: number): NominatimPlace {
  return {
    displayName: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
    lat,
    lon,
    city: null,
    state: null,
    suburb: null,
    neighbourhood: null,
    road: null,
  };
}

export function MapAreaPicker({
  open,
  initial,
  onClose,
  onConfirm,
}: {
  open: boolean;
  initial?: Partial<MapAreaSelection>;
  onClose: () => void;
  onConfirm: (selection: MapAreaSelection) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const aliveRef = useRef(false);
  const movePinRef = useRef<(lat: number, lon: number, opts?: { pan?: boolean }) => void>(
    () => undefined
  );

  const [lat, setLat] = useState(initial?.lat ?? DEFAULT_LAT);
  const [lon, setLon] = useState(initial?.lon ?? DEFAULT_LON);
  const [radiusKm, setRadiusKm] = useState(initial?.radiusKm ?? DEFAULT_RADIUS_KM);
  const [place, setPlace] = useState<NominatimPlace | null>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<NominatimPlace[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [clickHint, setClickHint] = useState('Click anywhere on the map or drag the pin');

  const zoom = useMemo(() => zoomForRadiusKm(radiusKm), [radiusKm]);

  const resolvePlace = useCallback(async (nextLat: number, nextLon: number) => {
    setBusy(true);
    setError(null);
    // Optimistic label so confirm works even if Nominatim is slow/blocked.
    setPlace(placeFromCoords(nextLat, nextLon));
    try {
      const geo = await reverseGeocodeAction(nextLat, nextLon);
      if (!aliveRef.current) return;
      setPlace(geo);
    } catch (e) {
      if (!aliveRef.current) return;
      setError(e instanceof Error ? e.message : 'Could not label this point (coords still usable)');
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  }, []);

  const movePin = useCallback(
    (nextLat: number, nextLon: number, opts?: { pan?: boolean }) => {
      setLat(nextLat);
      setLon(nextLon);
      setClickHint(`Pinned ${nextLat.toFixed(5)}, ${nextLon.toFixed(5)}`);
      const marker = markerRef.current;
      const circle = circleRef.current;
      const map = mapRef.current;
      if (marker) marker.setLatLng([nextLat, nextLon]);
      if (circle) circle.setLatLng([nextLat, nextLon]);
      if (map && opts?.pan) {
        map.panTo([nextLat, nextLon], { animate: true });
      }
      void resolvePlace(nextLat, nextLon);
    },
    [resolvePlace]
  );

  movePinRef.current = movePin;

  // Reset state when modal opens.
  useEffect(() => {
    if (!open) {
      setMapReady(false);
      return;
    }
    aliveRef.current = true;
    const startLat = initial?.lat ?? DEFAULT_LAT;
    const startLon = initial?.lon ?? DEFAULT_LON;
    const startRadius = initial?.radiusKm ?? DEFAULT_RADIUS_KM;
    setLat(startLat);
    setLon(startLon);
    setRadiusKm(startRadius);
    setError(null);
    setHits([]);
    setQuery('');
    setClickHint('Click anywhere on the map or drag the pin');
    setPlace(placeFromCoords(startLat, startLon));
    void resolvePlace(startLat, startLon);
    return () => {
      aliveRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Create / destroy map once per open. Host must be in the DOM with size.
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    let map: L.Map | null = null;
    let ro: ResizeObserver | null = null;
    const timers: number[] = [];

    const boot = () => {
      const host = hostRef.current;
      if (!host || cancelled) return;

      // Fresh DOM node avoids "Map container is already initialized".
      host.replaceChildren();
      const node = document.createElement('div');
      node.style.cssText = 'height:100%;width:100%;cursor:crosshair;';
      host.appendChild(node);

      try {
        map = L.map(node, {
          scrollWheelZoom: true,
          doubleClickZoom: true,
          boxZoom: true,
          keyboard: true,
          dragging: true,
        });
      } catch {
        return;
      }

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19,
      }).addTo(map);

      const startLat = initial?.lat ?? DEFAULT_LAT;
      const startLon = initial?.lon ?? DEFAULT_LON;
      const startRadius = initial?.radiusKm ?? DEFAULT_RADIUS_KM;
      map.setView([startLat, startLon], zoomForRadiusKm(startRadius));

      // Circle must NOT capture pointer events — otherwise map clicks never fire.
      const circle = L.circle([startLat, startLon], {
        radius: startRadius * 1000,
        color: '#b45309',
        fillColor: '#f59e0b',
        fillOpacity: 0.12,
        weight: 2,
        interactive: false,
        bubblingMouseEvents: false,
      }).addTo(map);

      const marker = L.marker([startLat, startLon], {
        icon: markerIcon,
        draggable: true,
        autoPan: true,
        keyboard: false,
      }).addTo(map);

      mapRef.current = map;
      markerRef.current = marker;
      circleRef.current = circle;

      const placeAt = (ll: L.LatLng) => {
        if (cancelled) return;
        movePinRef.current(ll.lat, ll.lng);
      };

      map.on('click', (e: L.LeafletMouseEvent) => placeAt(e.latlng));
      marker.on('dragend', () => placeAt(marker.getLatLng()));

      const refreshSize = () => {
        if (cancelled || !map) return;
        try {
          map.invalidateSize({ animate: false });
        } catch {
          // ignore
        }
      };

      timers.push(window.setTimeout(refreshSize, 0));
      timers.push(window.setTimeout(refreshSize, 80));
      timers.push(window.setTimeout(refreshSize, 250));
      timers.push(window.setTimeout(refreshSize, 500));

      ro = new ResizeObserver(() => refreshSize());
      ro.observe(host);

      if (!cancelled) setMapReady(true);
    };

    // Wait a tick so the modal + host have real layout dimensions.
    timers.push(window.setTimeout(boot, 40));

    return () => {
      cancelled = true;
      setMapReady(false);
      for (const t of timers) window.clearTimeout(t);
      ro?.disconnect();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
      if (map) {
        try {
          map.off();
          map.remove();
        } catch {
          // ignore
        }
      }
      hostRef.current?.replaceChildren();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep circle radius in sync; don't re-pan on every radius tick.
  useEffect(() => {
    const circle = circleRef.current;
    if (!circle) return;
    circle.setRadius(radiusKm * 1000);
    const map = mapRef.current;
    if (map) {
      try {
        map.setZoom(zoom, { animate: false });
      } catch {
        // ignore
      }
    }
  }, [radiusKm, zoom]);

  async function onSearch() {
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const results = await searchPlacesAction(query.trim());
      setHits(results);
      if (results[0]) {
        movePin(results[0].lat, results[0].lon, { pan: true });
        setPlace(results[0]);
      } else {
        setError('No places found — try a different query');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    const selected = place || placeFromCoords(lat, lon);
    const label = shortAreaLabel(selected) || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    onConfirm({
      lat,
      lon,
      radiusKm,
      label,
      cityLabel: selected.city || label,
      displayName: selected.displayName,
      zoom,
    });
  }

  if (!open) return null;

  // Portal to body — dashboard layout uses transforms that break position:fixed,
  // which previously parked the map thousands of px below the viewport.
  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-ink-900/40 p-3"
      role="dialog"
      aria-modal="true"
      aria-label="Select discovery area"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-ink-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-ink-100 px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gold-700">
              Map area (no SerpApi)
            </p>
            <h2 className="font-serif text-xl text-ink-900">Select discovery area</h2>
            <p className="mt-1 text-xs text-ink-500">
              Click the map or drag the pin. Adjust radius with the slider. OSM/Nominatim labels only —
              SerpApi runs on Discover.
            </p>
          </div>
          <Button size="sm" variant="ghost" type="button" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="space-y-3 border-b border-ink-100 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void onSearch();
                }
              }}
              placeholder="Search area e.g. Hazratganj Lucknow"
              className="h-9 min-w-[220px] flex-1 rounded-md border border-ink-300 px-3 text-sm"
            />
            <Button type="button" variant="outline" disabled={busy} onClick={() => void onSearch()}>
              Search
            </Button>
          </div>
          {hits.length > 0 ? (
            <ul className="max-h-24 space-y-1 overflow-y-auto text-xs text-ink-600">
              {hits.map((hit) => (
                <li key={`${hit.lat}-${hit.lon}-${hit.displayName}`}>
                  <button
                    type="button"
                    className="text-left hover:text-gold-700"
                    onClick={() => {
                      movePin(hit.lat, hit.lon, { pan: true });
                      setPlace(hit);
                      setHits([]);
                    }}
                  >
                    {hit.displayName}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <label className="block text-sm text-ink-600">
            Radius: <strong className="text-ink-900">{radiusKm} km</strong>
            <input
              type="range"
              min={3}
              max={50}
              step={1}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>

          <p className="text-xs text-ink-600">
            {!mapReady ? 'Loading map… ' : null}
            {busy ? 'Resolving place… ' : null}
            {place ? (
              <>
                <span className="font-medium text-ink-800">{shortAreaLabel(place)}</span>
                {place.city ? ` · ${place.city}` : ''}
                <span className="block text-ink-400">{place.displayName}</span>
                <span className="block text-ink-400">
                  {lat.toFixed(5)}, {lon.toFixed(5)} · zoom ~{zoom}
                </span>
              </>
            ) : (
              clickHint
            )}
          </p>
          {error ? <p className="text-xs text-amber-700">{error}</p> : null}
        </div>

        <div className="relative min-h-[320px] flex-1 bg-ink-50">
          <div ref={hostRef} className="h-[320px] w-full touch-none sm:h-[380px]" />
          {!mapReady ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-ink-400">
              Preparing map…
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-ink-100 px-4 py-3">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={confirm} disabled={!mapReady}>
            Use this area · {radiusKm} km
          </Button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modal, document.body);
}
