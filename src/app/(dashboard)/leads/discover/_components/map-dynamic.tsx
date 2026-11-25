'use client';

import dynamic from 'next/dynamic';
import type { MapAreaSelection } from './map-area-picker';
import type { MarketMapPoint } from './market-map';

export const MapAreaPickerDynamic = dynamic(
  () => import('./map-area-picker').then((m) => m.MapAreaPicker),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/40 p-3">
        <p className="rounded-md border border-ink-200 bg-white px-4 py-3 text-sm text-ink-700 shadow">
          Loading map…
        </p>
      </div>
    ),
  }
);

export const MarketMapDynamic = dynamic(
  () => import('./market-map').then((m) => m.MarketMap),
  {
    ssr: false,
    loading: () => (
      <p className="py-8 text-center text-sm text-ink-400">Loading market map…</p>
    ),
  }
);

export type { MapAreaSelection, MarketMapPoint };
