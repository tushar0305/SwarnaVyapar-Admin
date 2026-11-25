/**
 * SerpApi Google Maps client for jewellery lead discovery.
 * Docs: https://serpapi.com/google-maps-api · https://serpapi.com/maps-place-results
 */

import { fetchPublic } from '@/lib/public-url';

export type SerpApiMapsLocalResult = {
  position?: number;
  title?: string;
  place_id?: string;
  data_id?: string;
  data_cid?: string;
  gps_coordinates?: { latitude?: number; longitude?: number };
  rating?: number;
  reviews?: number;
  type?: string;
  types?: string[];
  address?: string;
  phone?: string;
  website?: string;
  open_state?: string;
  hours?: string;
  operating_hours?: Record<string, string>;
  thumbnail?: string;
};

export type SerpApiPlaceResults = {
  title?: string;
  place_id?: string;
  data_id?: string;
  data_cid?: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews?: number;
  type?: string;
  types?: string[];
  open_state?: string;
  hours?: string[] | string;
  operating_hours?: Record<string, string>;
  gps_coordinates?: { latitude?: number; longitude?: number };
  links?: { link?: string; source?: string; thumbnail?: string }[];
  extensions?: unknown[];
  thumbnail?: string;
};

export type SerpApiMapsSearchResponse = {
  search_metadata?: {
    id?: string;
    status?: string;
    total_time_taken?: number;
  };
  search_parameters?: Record<string, unknown>;
  search_information?: {
    local_results_state?: string;
    query_displayed?: string;
  };
  local_results?: SerpApiMapsLocalResult[];
  place_results?: SerpApiPlaceResults;
  error?: string;
};

export type MapsSearchParams = {
  q: string;
  lat: number;
  lon: number;
  zoom?: number;
  start?: number;
  hl?: string;
  gl?: string;
  googleDomain?: string;
  apiKey: string;
  noCache?: boolean;
};

function parseMeta(data: SerpApiMapsSearchResponse) {
  const status = (data.search_metadata?.status || '').toLowerCase();
  const fromCache = status.includes('cache');
  return { fromCache, billed: !fromCache };
}

async function serpFetch(url: string): Promise<{
  data: SerpApiMapsSearchResponse;
  fromCache: boolean;
  billed: boolean;
}> {
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const data = (await res.json()) as SerpApiMapsSearchResponse;
  if (!res.ok) throw new Error(data.error || `SerpApi HTTP ${res.status}`);
  if (data.error) throw new Error(data.error);
  return { data, ...parseMeta(data) };
}

export async function searchGoogleMaps(
  params: MapsSearchParams
): Promise<{ data: SerpApiMapsSearchResponse; fromCache: boolean; billed: boolean }> {
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_maps');
  url.searchParams.set('type', 'search');
  url.searchParams.set('q', params.q);
  const zoom = params.zoom ?? 11;
  url.searchParams.set('ll', `@${params.lat},${params.lon},${zoom}z`);
  url.searchParams.set('hl', params.hl ?? 'en');
  url.searchParams.set('gl', params.gl ?? 'in');
  url.searchParams.set('google_domain', params.googleDomain ?? 'google.co.in');
  if (params.start && params.start > 0) url.searchParams.set('start', String(params.start));
  if (params.noCache) url.searchParams.set('no_cache', 'true');
  url.searchParams.set('api_key', params.apiKey);
  return serpFetch(url.toString());
}

/** Place detail by place_id — 1 search credit unless cached. */
export async function fetchGoogleMapsPlace(params: {
  placeId: string;
  apiKey: string;
  hl?: string;
  gl?: string;
  googleDomain?: string;
}): Promise<{ data: SerpApiMapsSearchResponse; fromCache: boolean; billed: boolean }> {
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_maps');
  url.searchParams.set('place_id', params.placeId);
  url.searchParams.set('hl', params.hl ?? 'en');
  url.searchParams.set('gl', params.gl ?? 'in');
  url.searchParams.set('google_domain', params.googleDomain ?? 'google.co.in');
  url.searchParams.set('api_key', params.apiKey);
  return serpFetch(url.toString());
}

/** Lightweight public website reachability check (HEAD then GET). Private and redirect targets are refused. */
export async function checkWebsiteReachable(website: string): Promise<boolean> {
  if (!website.trim()) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const init = {
      signal: controller.signal,
      headers: { 'User-Agent': 'SwarnaVyaparAdminBot/1.0' },
    };
    let res = await fetchPublic(website, { ...init, method: 'HEAD' });
    if (res.status === 405 || res.status === 403) {
      res = await fetchPublic(website, { ...init, method: 'GET' });
    }
    return res.ok || (res.status >= 200 && res.status < 400);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
