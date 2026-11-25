/**
 * OpenStreetMap Nominatim helpers for map configuration.
 * Free / no SerpApi — used only to label the selected map area.
 * Usage policy: https://operations.osmfoundation.org/policies/nominatim/
 */

export type NominatimPlace = {
  displayName: string;
  lat: number;
  lon: number;
  city: string | null;
  state: string | null;
  suburb: string | null;
  neighbourhood: string | null;
  road: string | null;
};

function readAddress(addr: Record<string, string> | undefined) {
  if (!addr) {
    return {
      city: null as string | null,
      state: null as string | null,
      suburb: null as string | null,
      neighbourhood: null as string | null,
      road: null as string | null,
    };
  }
  return {
    city: addr.city || addr.town || addr.village || addr.county || null,
    state: addr.state || null,
    suburb: addr.suburb || addr.city_district || null,
    neighbourhood: addr.neighbourhood || addr.quarter || null,
    road: addr.road || null,
  };
}

export async function reverseGeocode(lat: number, lon: number): Promise<NominatimPlace> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('zoom', '16');
  url.searchParams.set('addressdetails', '1');

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'SwarnaVyaparAdmin/1.0 (lead-discovery-map-config)',
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Nominatim reverse failed (${res.status})`);
  const data = (await res.json()) as {
    display_name?: string;
    lat?: string;
    lon?: string;
    address?: Record<string, string>;
  };
  const address = readAddress(data.address);
  return {
    displayName: data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    lat: Number(data.lat ?? lat),
    lon: Number(data.lon ?? lon),
    ...address,
  };
}

export async function searchPlaces(query: string, limit = 5): Promise<NominatimPlace[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('q', q);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('countrycodes', 'in');

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'SwarnaVyaparAdmin/1.0 (lead-discovery-map-config)',
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Nominatim search failed (${res.status})`);
  const data = (await res.json()) as Array<{
    display_name?: string;
    lat?: string;
    lon?: string;
    address?: Record<string, string>;
  }>;
  return data.map((item) => {
    const address = readAddress(item.address);
    return {
      displayName: item.display_name || 'Place',
      lat: Number(item.lat),
      lon: Number(item.lon),
      ...address,
    };
  });
}

/** Approximate Google Maps zoom for a given radius (km). */
export function zoomForRadiusKm(radiusKm: number): number {
  const r = Math.max(1, radiusKm);
  // ~5 km → 14z, ~10 km → 13z, ~25 km → 12z, ~50 km → 11z
  const z = 14 - Math.log2(r / 5);
  return Math.max(9, Math.min(16, Math.round(z)));
}

export function shortAreaLabel(place: NominatimPlace): string {
  return (
    place.neighbourhood ||
    place.suburb ||
    place.road ||
    place.city ||
    place.displayName.split(',').slice(0, 2).join(',').trim()
  );
}
