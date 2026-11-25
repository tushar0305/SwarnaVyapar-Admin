'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type MarketMapPoint = {
  id: string;
  business_name: string;
  latitude: number;
  longitude: number;
  score: number;
  score_band: string;
  digital_gap: boolean;
  phone: string | null;
  city: string;
  neighbourhood: string | null;
  status: string;
};

function colorFor(point: MarketMapPoint): string {
  if (point.digital_gap && point.score_band === 'high') return '#b45309';
  if (point.digital_gap) return '#d97706';
  if (point.score_band === 'high') return '#0369a1';
  if (point.score_band === 'medium') return '#4b5563';
  return '#9ca3af';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeInvalidate(map: L.Map | null) {
  if (!map) return;
  try {
    const container = map.getContainer?.();
    if (!container || !container.parentNode) return;
    map.invalidateSize({ animate: false });
  } catch {
    // ignore disposed map
  }
}

export function MarketMap({ points }: { points: MarketMapPoint[] }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const disposedRef = useRef(false);

  // Only mount Leaflet when we have points (host is visible with real size).
  useEffect(() => {
    if (!points.length) return;
    const host = hostRef.current;
    if (!host) return;

    disposedRef.current = false;
    host.replaceChildren();
    const node = document.createElement('div');
    node.style.height = '100%';
    node.style.width = '100%';
    host.appendChild(node);

    let map: L.Map;
    try {
      map = L.map(node, { scrollWheelZoom: true });
    } catch {
      return;
    }

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);
    const layer = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerRef.current = layer;

    const bounds: L.LatLngExpression[] = [];
    for (const point of points) {
      const marker = L.circleMarker([point.latitude, point.longitude], {
        radius: point.digital_gap ? 9 : 6,
        color: colorFor(point),
        fillColor: colorFor(point),
        fillOpacity: 0.75,
        weight: 1,
      });
      marker.bindPopup(
        `<div style="font-size:12px">
          <strong>${escapeHtml(point.business_name)}</strong><br/>
          Score ${point.score} (${escapeHtml(point.score_band)})${
            point.digital_gap ? ' · digital gap' : ''
          }<br/>
          ${escapeHtml(point.neighbourhood || point.city)}${
            point.phone ? ` · ${escapeHtml(point.phone)}` : ''
          }<br/>
          <span style="color:#6b7280">${escapeHtml(point.status)}</span>
        </div>`
      );
      marker.addTo(layer);
      bounds.push([point.latitude, point.longitude]);
    }

    try {
      if (bounds.length === 1) {
        map.setView(bounds[0] as L.LatLngExpression, 13);
      } else {
        map.fitBounds(L.latLngBounds(bounds), { padding: [28, 28], maxZoom: 13 });
      }
    } catch {
      // ignore
    }

    const timers = [
      window.setTimeout(() => {
        if (!disposedRef.current) safeInvalidate(map);
      }, 50),
      window.setTimeout(() => {
        if (!disposedRef.current) safeInvalidate(map);
      }, 250),
    ];

    return () => {
      disposedRef.current = true;
      for (const t of timers) window.clearTimeout(t);
      mapRef.current = null;
      layerRef.current = null;
      try {
        map.remove();
      } catch {
        // ignore
      }
      host.replaceChildren();
    };
  }, [points]);

  return (
    <div className="space-y-2">
      {!points.length ? (
        <p className="px-1 text-sm text-ink-500">
          No geo-tagged prospects yet. Run a discovery with the map picker to populate this heatmap.
        </p>
      ) : (
        <div className="flex flex-wrap gap-3 text-[11px] text-ink-500">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-700" /> High + digital gap
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" /> Digital gap
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-700" /> High score
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink-500" /> Medium / other
          </span>
        </div>
      )}
      {points.length ? (
        <>
          <div ref={hostRef} className="h-[360px] w-full rounded-md border border-ink-100" />
          <p className="text-[11px] text-ink-400">
            {points.length} shops plotted · larger amber dots = digital-gap priorities · map tiles via
            OpenStreetMap (not SerpApi)
          </p>
        </>
      ) : null}
    </div>
  );
}
