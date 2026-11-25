'use server';

import { revalidatePath } from 'next/cache';
import { scoreDiscoveredLead } from '@/lib/discovered-lead-score';
import { scanWebsiteCompetitorSignals, type CompetitorSignal } from '@/lib/competitor-scan';
import { buildSalesScripts } from '@/lib/discovery-scripts';
import {
  DEFAULT_JEWELLERY_KEYWORDS,
  DISCOVERED_LEAD_CLOSED_STATUSES,
  DISCOVERED_LEAD_STATUSES,
  DISCOVERED_LEAD_TOUCHED_STATUSES,
  DISCOVERY_CITIES,
  MAX_ENRICH_PER_DAY,
  MAX_SEARCHES_PER_RUN,
  RECENT_CRAWL_DAYS,
  SERPAPI_FREE_MONTHLY_SEARCHES,
  draftHinglishIntro,
  getDiscoveryCity,
  getNeighbourhood,
  haversineKm,
  mapsPlaceHref,
  normalizePhone,
  utcMonthKey,
  type AreaAnalyticsRow,
  type DiscoveredLeadStatus,
} from '@/lib/lead-discovery';
import { fromDatetimeLocalIst } from '@/lib/lead-score';
import { zoomForRadiusKm } from '@/lib/nominatim';
import {
  generateAiSalesScripts,
  isGeminiConfigured,
  type AiSalesScripts,
} from '@/lib/gemini-sales';
import {
  checkWebsiteReachable,
  fetchGoogleMapsPlace,
  searchGoogleMaps,
  type SerpApiMapsLocalResult,
} from '@/lib/serpapi/maps';
import { getServiceRoleClient } from '@/lib/supabase/admin';
import { logAdminAction, requireAdminPermission, requireSuperAdmin } from './admin-auth.service';

const FREE_MONTHLY = SERPAPI_FREE_MONTHLY_SEARCHES;
const MAX_PAGES = 3;
const MAX_KEYWORDS = 3;

const LEAD_SELECT =
  'id, place_id, data_cid, business_name, address, phone, website, latitude, longitude, rating, reviews_count, category, types, open_state, operating_hours, city, area, neighbourhood, query, radius_km, distance_km, maps_url, status, notes, owner_name, follow_up_at, contacted_at, discovered_at, expires_at, last_seen_at, score, score_band, score_reasons, is_chain, digital_gap, suggested_pitch, website_reachable, website_checked_at, enriched_at, place_links, confidence, matched_shop_id, matched_shop_name, matched_at, competitor_signals, competitor_scanned_at, call_script, follow_up_script, whatsapp_script, ai_talking_points, ai_scripts_at, ai_scripts_model';

export type DiscoveredLeadRow = {
  id: string;
  place_id: string;
  data_cid: string | null;
  business_name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  reviews_count: number | null;
  category: string | null;
  types: string[];
  open_state: string | null;
  city: string;
  area: string | null;
  neighbourhood: string | null;
  query: string;
  radius_km: number | null;
  distance_km: number | null;
  maps_url: string | null;
  status: DiscoveredLeadStatus;
  notes: string | null;
  owner_name: string | null;
  follow_up_at: string | null;
  contacted_at: string | null;
  discovered_at: string;
  expires_at: string;
  last_seen_at: string;
  score: number;
  score_band: 'high' | 'medium' | 'low';
  score_reasons: { points: number; text: string }[];
  is_chain: boolean;
  digital_gap: boolean;
  suggested_pitch: string | null;
  website_reachable: boolean | null;
  website_checked_at: string | null;
  enriched_at: string | null;
  place_links: PlaceLink[];
  operating_hours: Record<string, string> | null;
  confidence: number;
  matched_shop_id: string | null;
  matched_shop_name: string | null;
  matched_at: string | null;
  competitor_signals: CompetitorSignal[];
  competitor_scanned_at: string | null;
  call_script: string | null;
  follow_up_script: string | null;
  whatsapp_script: string | null;
  ai_talking_points: string[];
  ai_scripts_at: string | null;
  ai_scripts_model: string | null;
};

export type PlaceLink = {
  link?: string;
  source?: string;
  thumbnail?: string;
};

export type SavedDiscoverySearch = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  radius_km: number;
  label: string;
  city_label: string;
  display_name: string | null;
  zoom: number | null;
  keywords: string;
  max_pages: number;
  contact_filter: 'all' | 'phone' | 'website';
  created_by: string | null;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
};

export type DiscoveryFunnelStats = {
  byStatus: Record<DiscoveredLeadStatus, number>;
  totalActive: number;
  withPhone: number;
  digitalGap: number;
  highScore: number;
  contactedPlus: number;
  demoPlus: number;
  converted: number;
  contactRate: number | null;
  demoRate: number | null;
  convertRate: number | null;
  monthBilled: number;
  monthUpserted: number;
  shopsPerCredit: number | null;
  topAreas: { area: string; city: string; count: number; high: number }[];
};

export type DiscoveryMapSelection = {
  lat: number;
  lon: number;
  radiusKm: number;
  label: string;
  cityLabel: string;
  displayName?: string;
  zoom?: number;
};

export type DiscoveryRunInput = {
  /** Optional when mapSelection is provided. */
  cityId?: string;
  area?: string;
  neighbourhoodId?: string;
  /** Map picker selection (OSM/Nominatim config — no SerpApi). */
  mapSelection?: DiscoveryMapSelection;
  keywords?: string;
  radiusKm?: number;
  maxPages?: number;
  contactFilter?: 'all' | 'phone' | 'website';
  /** Bypass 7-day neighbourhood credit governor. */
  forceRefresh?: boolean;
};

export type DiscoveryRunResult = {
  searched: number;
  cached: number;
  billed: number;
  fetched: number;
  inRadius: number;
  upserted: number;
  skippedNoPlaceId: number;
  filteredContact: number;
  monthUsed: number;
  monthLimit: number;
  city: string;
  neighbourhood: string | null;
  queries: string[];
  shopsPerBilled: number | null;
};

export type DiscoveryListFilters = {
  city?: string;
  status?: string;
  contact?: string;
  band?: string;
  digitalGap?: string;
  due?: string;
  q?: string;
  page?: string;
  sort?: string;
};

export type DiscoveryRunRow = {
  id: string;
  city: string;
  area: string | null;
  neighbourhood: string | null;
  keywords: string[];
  radius_km: number | null;
  max_pages: number;
  searched: number;
  cached: number;
  billed: number;
  fetched: number;
  in_radius: number;
  upserted: number;
  month_used: number | null;
  created_at: string;
};

export type DiscoveredLeadEvent = {
  id: string;
  lead_id: string;
  event_type: string;
  body: string | null;
  meta: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
};

function serpApiKey(): string {
  const key = process.env.SERPAPI_KEY?.trim();
  if (!key) {
    throw new Error('SERPAPI_KEY is not set. Add it to the admin env (Free plan key is fine).');
  }
  return key;
}

function parseKeywords(raw: string | undefined): string[] {
  const parts = (raw || DEFAULT_JEWELLERY_KEYWORDS[0])
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const unique = Array.from(new Set(parts.map((s) => s.toLowerCase()))).map(
    (lower) => parts.find((p) => p.toLowerCase() === lower)!
  );
  return unique.slice(0, MAX_KEYWORDS);
}

function scoreFields(row: {
  business_name: string;
  category: string | null;
  types: string[];
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviews_count: number | null;
  distance_km: number | null;
  website_reachable?: boolean | null;
}) {
  const scored = scoreDiscoveredLead({
    businessName: row.business_name,
    category: row.category,
    types: row.types || [],
    phone: row.phone,
    website: row.website,
    rating: row.rating,
    reviewsCount: row.reviews_count,
    distanceKm: row.distance_km,
    websiteReachable: row.website_reachable,
  });
  return {
    score: scored.score,
    score_band: scored.band,
    score_reasons: scored.reasons,
    is_chain: scored.isChain,
    digital_gap: scored.digitalGap,
    suggested_pitch: scored.suggestedPitch,
    confidence: scored.confidence,
  };
}

async function getMonthUsage(supabase: ReturnType<typeof getServiceRoleClient>): Promise<number> {
  const monthKey = utcMonthKey();
  const { data } = await supabase
    .from('admin_serpapi_usage')
    .select('searches_used')
    .eq('month_key', monthKey)
    .maybeSingle();
  return typeof data?.searches_used === 'number' ? data.searches_used : 0;
}

async function bumpMonthUsage(
  supabase: ReturnType<typeof getServiceRoleClient>,
  billed: number
): Promise<number> {
  if (billed <= 0) return getMonthUsage(supabase);
  const monthKey = utcMonthKey();
  const current = await getMonthUsage(supabase);
  const next = current + billed;
  const { error } = await supabase.from('admin_serpapi_usage').upsert(
    {
      month_key: monthKey,
      searches_used: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'month_key' }
  );
  if (error) console.error('SerpApi usage bump failed:', error.message);
  return next;
}

async function appendEvent(
  supabase: ReturnType<typeof getServiceRoleClient>,
  leadId: string,
  eventType: string,
  body: string | null,
  meta: Record<string, unknown> = {},
  createdBy?: string | null
) {
  await supabase.from('admin_discovered_lead_events').insert({
    lead_id: leadId,
    event_type: eventType,
    body,
    meta,
    created_by: createdBy || null,
  });
}

function mapLocalResult(
  item: SerpApiMapsLocalResult,
  ctx: {
    cityLabel: string;
    area: string | null;
    neighbourhood: string | null;
    query: string;
    radiusKm: number;
    centerLat: number;
    centerLon: number;
  }
) {
  const placeId = item.place_id?.trim();
  if (!placeId) return null;
  const lat = item.gps_coordinates?.latitude;
  const lon = item.gps_coordinates?.longitude;
  const distanceKm =
    typeof lat === 'number' && typeof lon === 'number'
      ? Math.round(haversineKm(ctx.centerLat, ctx.centerLon, lat, lon) * 100) / 100
      : null;

  return {
    place_id: placeId,
    data_cid: item.data_cid ?? null,
    business_name: (item.title || 'Unknown business').slice(0, 200),
    address: item.address ?? null,
    phone: normalizePhone(item.phone),
    website: item.website ?? null,
    latitude: typeof lat === 'number' ? lat : null,
    longitude: typeof lon === 'number' ? lon : null,
    rating: typeof item.rating === 'number' ? item.rating : null,
    reviews_count: typeof item.reviews === 'number' ? item.reviews : null,
    category: item.type ?? null,
    types: Array.isArray(item.types) ? item.types : item.type ? [item.type] : [],
    open_state: item.open_state ?? item.hours ?? null,
    city: ctx.cityLabel,
    area: ctx.area,
    neighbourhood: ctx.neighbourhood,
    query: ctx.query,
    radius_km: ctx.radiusKm,
    distance_km: distanceKm,
    maps_url: mapsPlaceHref(placeId),
  };
}

export async function getSerpApiUsage(): Promise<{
  monthKey: string;
  used: number;
  limit: number;
  remaining: number;
  configured: boolean;
  enrichRemainingToday: number;
}> {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();
  const used = await getMonthUsage(supabase);
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from('admin_discovered_lead_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'enrich')
    .gte('created_at', dayStart.toISOString());
  return {
    monthKey: utcMonthKey(),
    used,
    limit: FREE_MONTHLY,
    remaining: Math.max(0, FREE_MONTHLY - used),
    configured: Boolean(process.env.SERPAPI_KEY?.trim()),
    enrichRemainingToday: Math.max(0, MAX_ENRICH_PER_DAY - (count || 0)),
  };
}

export async function listDiscoveryRuns(limit = 8): Promise<DiscoveryRunRow[]> {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('admin_discovery_runs')
    .select(
      'id, city, area, neighbourhood, keywords, radius_km, max_pages, searched, cached, billed, fetched, in_radius, upserted, month_used, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []) as DiscoveryRunRow[];
}

function nearestPresetCity(lat: number, lon: number) {
  let best = DISCOVERY_CITIES[0];
  let bestKm = Number.POSITIVE_INFINITY;
  for (const city of DISCOVERY_CITIES) {
    const d = haversineKm(lat, lon, city.lat, city.lon);
    if (d < bestKm) {
      bestKm = d;
      best = city;
    }
  }
  return best;
}

export async function runLeadDiscovery(input: DiscoveryRunInput): Promise<DiscoveryRunResult> {
  const admin = await requireAdminPermission('manage_users');
  const apiKey = serpApiKey();

  const mapSel = input.mapSelection;
  const neighbourhood = input.neighbourhoodId ? getNeighbourhood(input.neighbourhoodId) : undefined;
  const presetCity = input.cityId ? getDiscoveryCity(input.cityId) : undefined;

  let centerLat: number;
  let centerLon: number;
  let zoom: number;
  let radiusKm: number;
  let cityLabel: string;
  let area: string | null;
  let neighbourhoodLabel: string | null;

  if (mapSel) {
    if (!Number.isFinite(mapSel.lat) || !Number.isFinite(mapSel.lon)) {
      throw new Error('Invalid map selection coordinates');
    }
    centerLat = mapSel.lat;
    centerLon = mapSel.lon;
    radiusKm = Math.min(100, Math.max(3, Number(mapSel.radiusKm) || Number(input.radiusKm) || 8));
    zoom = mapSel.zoom ?? zoomForRadiusKm(radiusKm);
    cityLabel = (mapSel.cityLabel || presetCity?.label || nearestPresetCity(centerLat, centerLon)?.label || 'India').trim();
    area = mapSel.label?.trim() || null;
    neighbourhoodLabel = `Map:${centerLat.toFixed(3)},${centerLon.toFixed(3)}|${radiusKm}km`;
  } else {
    const city = presetCity;
    if (!city) throw new Error('Pick a city or select an area on the map.');
    if (input.neighbourhoodId && (!neighbourhood || neighbourhood.cityId !== city.id)) {
      throw new Error('Neighbourhood does not belong to the selected city.');
    }
    centerLat = neighbourhood?.lat ?? city.lat;
    centerLon = neighbourhood?.lon ?? city.lon;
    zoom = neighbourhood?.zoom ?? city.defaultZoom;
    radiusKm = Math.min(100, Math.max(5, Number(input.radiusKm) || (neighbourhood ? 8 : 50)));
    cityLabel = city.label;
    area =
      input.area?.trim() && input.area.trim().toLowerCase() !== 'all areas'
        ? input.area.trim()
        : neighbourhood?.label || null;
    neighbourhoodLabel = neighbourhood?.label || null;
  }

  const maxPages = Math.min(MAX_PAGES, Math.max(1, Math.floor(Number(input.maxPages) || 2)));
  const keywords = parseKeywords(input.keywords);
  const contactFilter = input.contactFilter || 'all';

  const planned = keywords.length * maxPages;
  if (planned > MAX_SEARCHES_PER_RUN) {
    throw new Error(
      `This run would use up to ${planned} searches. Free-plan safety cap is ${MAX_SEARCHES_PER_RUN} per click.`
    );
  }

  const supabase = getServiceRoleClient();

  if (!input.forceRefresh) {
    const since = new Date(Date.now() - RECENT_CRAWL_DAYS * 86_400_000).toISOString();
    let recentQuery = supabase
      .from('admin_discovery_runs')
      .select('id, created_at, neighbourhood, billed, upserted')
      .eq('city', cityLabel)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1);
    if (neighbourhoodLabel) {
      recentQuery = recentQuery.eq('neighbourhood', neighbourhoodLabel);
    } else {
      recentQuery = recentQuery.is('neighbourhood', null);
    }
    const { data: recent } = await recentQuery.maybeSingle();
    if (recent) {
      const when = new Date(recent.created_at as string).toLocaleString('en-IN');
      throw new Error(
        `Credit governor: ${cityLabel}${neighbourhoodLabel ? ` · ${neighbourhoodLabel}` : ''} was crawled on ${when} (${recent.billed} credits, ${recent.upserted} saved). Wait ${RECENT_CRAWL_DAYS} days or enable Force refresh.`
      );
    }
  }

  const monthUsedBefore = await getMonthUsage(supabase);
  if (monthUsedBefore >= FREE_MONTHLY) {
    throw new Error(
      `Tracked SerpApi usage for this month is ${monthUsedBefore}/${FREE_MONTHLY}. Wait for next month or upgrade.`
    );
  }
  if (monthUsedBefore + planned > FREE_MONTHLY) {
    throw new Error(
      `This run needs up to ${planned} searches but only ${FREE_MONTHLY - monthUsedBefore} remain.`
    );
  }

  let searched = 0;
  let cached = 0;
  let billed = 0;
  let fetched = 0;
  let skippedNoPlaceId = 0;
  const byPlace = new Map<string, NonNullable<ReturnType<typeof mapLocalResult>>>();

  for (const keyword of keywords) {
    const q = area ? `${keyword} ${area} ${cityLabel}` : `${keyword} ${cityLabel}`;
    for (let page = 0; page < maxPages; page += 1) {
      const { data, fromCache, billed: wasBilled } = await searchGoogleMaps({
        q,
        lat: centerLat,
        lon: centerLon,
        zoom,
        start: page * 20,
        apiKey,
      });
      searched += 1;
      if (fromCache) cached += 1;
      if (wasBilled) billed += 1;

      const locals = data.local_results || [];
      if (locals.length === 0) break;

      for (const item of locals) {
        fetched += 1;
        const mapped = mapLocalResult(item, {
          cityLabel,
          area,
          neighbourhood: area || neighbourhoodLabel,
          query: q,
          radiusKm,
          centerLat,
          centerLon,
        });
        if (!mapped) {
          skippedNoPlaceId += 1;
          continue;
        }
        const existing = byPlace.get(mapped.place_id);
        if (!existing) {
          byPlace.set(mapped.place_id, mapped);
        } else {
          byPlace.set(mapped.place_id, {
            ...existing,
            phone: existing.phone || mapped.phone,
            website: existing.website || mapped.website,
            rating: existing.rating ?? mapped.rating,
            reviews_count: existing.reviews_count ?? mapped.reviews_count,
            address: existing.address || mapped.address,
            distance_km: existing.distance_km ?? mapped.distance_km,
            neighbourhood: existing.neighbourhood || mapped.neighbourhood,
          });
        }
      }
      if (locals.length < 10) break;
    }
  }

  const monthUsed = await bumpMonthUsage(supabase, billed);

  let inRadius = 0;
  let filteredContact = 0;
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const rows: Record<string, unknown>[] = [];

  for (const mapped of byPlace.values()) {
    if (mapped.distance_km != null && mapped.distance_km > radiusKm) continue;
    inRadius += 1;
    if (contactFilter === 'phone' && !mapped.phone) {
      filteredContact += 1;
      continue;
    }
    if (contactFilter === 'website' && !mapped.website) {
      filteredContact += 1;
      continue;
    }

    const scored = scoreFields({
      ...mapped,
      website_reachable: null,
    });
    const scripts = buildSalesScripts({
      businessName: mapped.business_name,
      suggestedPitch: scored.suggested_pitch,
      digitalGap: scored.digital_gap,
      hasPhone: Boolean(mapped.phone),
      city: mapped.city,
    });

    rows.push({
      ...mapped,
      ...scored,
      call_script: scripts.callScript,
      follow_up_script: scripts.followUp,
      source: 'serpapi_maps',
      last_seen_at: now,
      discovered_at: now,
      expires_at: expiresAt,
      updated_at: now,
    });
  }

  let upserted = 0;
  if (rows.length > 0) {
    const { data: existing } = await supabase
      .from('admin_discovered_leads')
      .select(
        'place_id, status, notes, owner_name, follow_up_at, contacted_at, discovered_at, expires_at, website_reachable, website_checked_at, enriched_at, place_links'
      )
      .in(
        'place_id',
        rows.map((r) => r.place_id as string)
      );

    const existingByPlace = new Map((existing || []).map((row) => [row.place_id as string, row]));

    const payload = rows.map((row) => {
      const prev = existingByPlace.get(row.place_id as string);
      const websiteReachable =
        (prev?.website_reachable as boolean | null | undefined) ?? null;
      const rescored = scoreFields({
        business_name: row.business_name as string,
        category: row.category as string | null,
        types: (row.types as string[]) || [],
        phone: row.phone as string | null,
        website: row.website as string | null,
        rating: row.rating as number | null,
        reviews_count: row.reviews_count as number | null,
        distance_km: row.distance_km as number | null,
        website_reachable: websiteReachable,
      });

      if (!prev) {
        return { ...row, ...rescored, status: 'new' };
      }
      return {
        ...row,
        ...rescored,
        status: prev.status,
        notes: prev.notes,
        owner_name: prev.owner_name,
        follow_up_at: prev.follow_up_at,
        contacted_at: prev.contacted_at,
        discovered_at: prev.discovered_at,
        expires_at: prev.expires_at,
        website_reachable: prev.website_reachable,
        website_checked_at: prev.website_checked_at,
        enriched_at: prev.enriched_at,
        place_links: prev.place_links,
      };
    });

    const { error, count } = await supabase
      .from('admin_discovered_leads')
      .upsert(payload, { onConflict: 'place_id', count: 'exact' });
    if (error) throw new Error(error.message);
    upserted = count ?? payload.length;
  }

  await supabase.from('admin_discovery_runs').insert({
    city: cityLabel,
    area,
    neighbourhood: neighbourhoodLabel,
    keywords,
    radius_km: radiusKm,
    max_pages: maxPages,
    searched,
    cached,
    billed,
    fetched,
    in_radius: inRadius,
    upserted,
    month_used: monthUsed,
    created_by: admin.email || admin.name,
  });

  await logAdminAction(
    'lead_discovery_run',
    'admin_discovered_leads',
    null,
    {
      city: cityLabel,
      neighbourhood: neighbourhoodLabel,
      map: Boolean(mapSel),
      keywords,
      maxPages,
      radiusKm,
      searched,
      billed,
      cached,
      fetched,
      inRadius,
      upserted,
      monthUsed,
    },
    `Discover jewellery shops in ${cityLabel}`
  );

  revalidatePath('/leads/discover');

  return {
    searched,
    cached,
    billed,
    fetched,
    inRadius,
    upserted,
    skippedNoPlaceId,
    filteredContact,
    monthUsed,
    monthLimit: FREE_MONTHLY,
    city: cityLabel,
    neighbourhood: area || neighbourhoodLabel,
    queries: keywords,
    shopsPerBilled: billed > 0 ? Math.round((upserted / billed) * 10) / 10 : null,
  };
}

export async function listDiscoveredLeads(filters: DiscoveryListFilters = {}): Promise<{
  rows: DiscoveredLeadRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<string, number>;
  dueCount: number;
}> {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();
  const pageSize = 50;
  const page = Math.max(1, Number.parseInt(filters.page || '1', 10) || 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const sort = filters.sort || 'score';
  let query = supabase
    .from('admin_discovered_leads')
    .select(LEAD_SELECT, { count: 'exact' })
    .gt('expires_at', new Date().toISOString())
    .range(from, to);

  if (sort === 'recent') {
    query = query.order('discovered_at', { ascending: false });
  } else if (sort === 'follow_up') {
    query = query.order('follow_up_at', { ascending: true, nullsFirst: false });
  } else {
    query = query.order('score', { ascending: false }).order('discovered_at', { ascending: false });
  }

  if (filters.city?.trim()) query = query.ilike('city', filters.city.trim());
  if (filters.status && DISCOVERED_LEAD_STATUSES.includes(filters.status as DiscoveredLeadStatus)) {
    query = query.eq('status', filters.status);
  }
  if (filters.band === 'high' || filters.band === 'medium' || filters.band === 'low') {
    query = query.eq('score_band', filters.band);
  }
  if (filters.digitalGap === 'yes') query = query.eq('digital_gap', true);
  if (filters.contact === 'phone') query = query.not('phone', 'is', null);
  else if (filters.contact === 'website') query = query.not('website', 'is', null);
  else if (filters.contact === 'no_phone') query = query.is('phone', null);

  if (filters.due === '1') {
    query = query
      .not('follow_up_at', 'is', null)
      .lte('follow_up_at', new Date().toISOString())
      .neq('status', 'dismissed')
      .neq('status', 'converted')
      .neq('status', 'lost')
      .neq('status', 'not_interested');
  }

  if (filters.q?.trim()) {
    const safe = filters.q.trim().replace(/[%_,.()]/g, ' ').replace(/\s+/g, ' ').trim();
    if (safe) {
      const q = `%${safe}%`;
      query = query.or(`business_name.ilike.${q},address.ilike.${q},phone.ilike.${q}`);
    }
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const { data: statusRows } = await supabase
    .from('admin_discovered_leads')
    .select('status, phone, digital_gap, score_band, follow_up_at')
    .gt('expires_at', new Date().toISOString());

  const counts: Record<string, number> = {
    all: 0,
    with_phone: 0,
    digital_gap: 0,
    high: 0,
    medium: 0,
    low: 0,
    ...Object.fromEntries(DISCOVERED_LEAD_STATUSES.map((status) => [status, 0])),
  };
  let dueCount = 0;
  const now = Date.now();
  for (const row of statusRows || []) {
    counts.all += 1;
    if (row.phone) counts.with_phone += 1;
    if (row.digital_gap) counts.digital_gap += 1;
    const band = row.score_band as string;
    if (band in counts) counts[band] += 1;
    const st = row.status as string;
    if (st in counts) counts[st] += 1;
    if (
      row.follow_up_at &&
      new Date(row.follow_up_at).getTime() <= now &&
      st !== 'dismissed' &&
      st !== 'converted' &&
      st !== 'lost' &&
      st !== 'not_interested'
    ) {
      dueCount += 1;
    }
  }

  return {
    rows: (data || []).map((row) => normalizeLeadRow(row)),
    total: count ?? 0,
    page,
    pageSize,
    counts,
    dueCount,
  };
}

function normalizePlaceLinks(value: unknown): PlaceLink[] {
  if (!Array.isArray(value)) return [];
  const links: PlaceLink[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const link =
      typeof row.link === 'string'
        ? row.link
        : typeof row.url === 'string'
          ? row.url
          : undefined;
    if (!link) continue;
    links.push({
      link,
      source: typeof row.source === 'string' ? row.source : undefined,
      thumbnail: typeof row.thumbnail === 'string' ? row.thumbnail : undefined,
    });
  }
  return links;
}

function normalizeOperatingHours(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out: Record<string, string> = {};
  for (const [day, hours] of Object.entries(value as Record<string, unknown>)) {
    if (typeof hours === 'string' && hours.trim()) out[day] = hours.trim();
  }
  return Object.keys(out).length ? out : null;
}

function normalizeLeadRow(row: Record<string, unknown>): DiscoveredLeadRow {
  return {
    ...(row as DiscoveredLeadRow),
    score_reasons: Array.isArray(row.score_reasons) ? (row.score_reasons as DiscoveredLeadRow['score_reasons']) : [],
    place_links: normalizePlaceLinks(row.place_links),
    operating_hours: normalizeOperatingHours(row.operating_hours),
    types: Array.isArray(row.types) ? (row.types as string[]) : [],
    competitor_signals: Array.isArray(row.competitor_signals)
      ? (row.competitor_signals as CompetitorSignal[])
      : [],
    matched_shop_id: (row.matched_shop_id as string | null) ?? null,
    matched_shop_name: (row.matched_shop_name as string | null) ?? null,
    matched_at: (row.matched_at as string | null) ?? null,
    competitor_scanned_at: (row.competitor_scanned_at as string | null) ?? null,
    call_script: (row.call_script as string | null) ?? null,
    follow_up_script: (row.follow_up_script as string | null) ?? null,
    whatsapp_script: (row.whatsapp_script as string | null) ?? null,
    ai_talking_points: Array.isArray(row.ai_talking_points)
      ? (row.ai_talking_points as string[])
      : [],
    ai_scripts_at: (row.ai_scripts_at as string | null) ?? null,
    ai_scripts_model: (row.ai_scripts_model as string | null) ?? null,
  };
}

export async function getDiscoveredLeadDetail(id: string): Promise<{
  lead: DiscoveredLeadRow;
  events: DiscoveredLeadEvent[];
  draftMessage: string;
} | null> {
  await requireSuperAdmin();
  if (!id) return null;
  const supabase = getServiceRoleClient();
  const { data: lead, error } = await supabase
    .from('admin_discovered_leads')
    .select(LEAD_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!lead) return null;

  const { data: events } = await supabase
    .from('admin_discovered_lead_events')
    .select('id, lead_id, event_type, body, meta, created_by, created_at')
    .eq('lead_id', id)
    .order('created_at', { ascending: false })
    .limit(40);

  const typed = normalizeLeadRow(lead as Record<string, unknown>);
  const scripts = buildSalesScripts({
    businessName: typed.business_name,
    suggestedPitch: typed.suggested_pitch,
    digitalGap: typed.digital_gap,
    hasPhone: Boolean(typed.phone),
    city: typed.city,
  });

  return {
    lead: {
      ...typed,
      call_script: typed.call_script || scripts.callScript,
      follow_up_script: typed.follow_up_script || scripts.followUp,
      whatsapp_script: typed.whatsapp_script || scripts.whatsappIntro,
    },
    events: (events || []) as DiscoveredLeadEvent[],
    draftMessage:
      typed.whatsapp_script ||
      scripts.whatsappIntro ||
      draftHinglishIntro(typed.business_name, typed.suggested_pitch),
  };
}

export async function updateDiscoveredLead(input: {
  id: string;
  status?: DiscoveredLeadStatus;
  notes?: string;
  ownerName?: string;
  followUpLocal?: string;
  eventNote?: string;
}): Promise<void> {
  const admin = await requireAdminPermission('manage_users');
  if (!input.id) throw new Error('Lead id is required');

  const supabase = getServiceRoleClient();
  const { data: prev } = await supabase
    .from('admin_discovered_leads')
    .select('status, notes')
    .eq('id', input.id)
    .maybeSingle();
  if (!prev) throw new Error('Lead not found');

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.status) {
    if (!DISCOVERED_LEAD_STATUSES.includes(input.status)) throw new Error('Invalid status');
    patch.status = input.status;
    if (
      DISCOVERED_LEAD_TOUCHED_STATUSES.includes(input.status) &&
      !DISCOVERED_LEAD_TOUCHED_STATUSES.includes(prev.status as DiscoveredLeadStatus)
    ) {
      patch.contacted_at = new Date().toISOString();
    }
  }
  if (input.notes !== undefined) {
    const notes = input.notes.trim();
    if (notes.length > 2000) throw new Error('Notes must be 2000 characters or fewer');
    patch.notes = notes || null;
  }
  if (input.ownerName !== undefined) {
    const owner = input.ownerName.trim();
    patch.owner_name = owner ? owner.slice(0, 80) : null;
  }
  if (input.followUpLocal !== undefined) {
    patch.follow_up_at = input.followUpLocal.trim()
      ? fromDatetimeLocalIst(input.followUpLocal)
      : null;
  }

  const { error } = await supabase.from('admin_discovered_leads').update(patch).eq('id', input.id);
  if (error) throw new Error(error.message);

  if (input.status && input.status !== prev.status) {
    await appendEvent(
      supabase,
      input.id,
      'status',
      `Status → ${input.status}`,
      { from: prev.status, to: input.status },
      admin.email || admin.name
    );
  }
  if (input.eventNote?.trim()) {
    await appendEvent(
      supabase,
      input.id,
      'note',
      input.eventNote.trim().slice(0, 2000),
      {},
      admin.email || admin.name
    );
  }

  await logAdminAction('discovered_lead_updated', 'admin_discovered_leads', input.id, patch);
  revalidatePath('/leads/discover');
}

export async function logDiscoveredLeadActivity(input: {
  id: string;
  eventType: 'call' | 'whatsapp' | 'note' | 'maps';
  body?: string;
}): Promise<void> {
  const admin = await requireAdminPermission('manage_users');
  const supabase = getServiceRoleClient();
  const { data } = await supabase
    .from('admin_discovered_leads')
    .select('id, status')
    .eq('id', input.id)
    .maybeSingle();
  if (!data) throw new Error('Lead not found');

  await appendEvent(
    supabase,
    input.id,
    input.eventType,
    (input.body || input.eventType).slice(0, 2000),
    {},
    admin.email || admin.name
  );

  if (input.eventType === 'call' || input.eventType === 'whatsapp') {
    if (data.status === 'new') {
      await supabase
        .from('admin_discovered_leads')
        .update({
          status: 'contacted',
          contacted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id);
    }
  }

  revalidatePath('/leads/discover');
}

export async function bulkUpdateDiscoveredLeads(input: {
  ids: string[];
  status: DiscoveredLeadStatus;
}): Promise<{ updated: number }> {
  await requireAdminPermission('manage_users');
  if (!input.ids.length) throw new Error('Select at least one lead');
  if (!DISCOVERED_LEAD_STATUSES.includes(input.status)) throw new Error('Invalid status');
  if (input.ids.length > 100) throw new Error('Max 100 leads per bulk update');

  const supabase = getServiceRoleClient();
  const patch: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString(),
  };
  if (DISCOVERED_LEAD_TOUCHED_STATUSES.includes(input.status)) {
    patch.contacted_at = new Date().toISOString();
  }

  const { error, count } = await supabase
    .from('admin_discovered_leads')
    .update(patch, { count: 'exact' })
    .in('id', input.ids);
  if (error) throw new Error(error.message);

  await logAdminAction('discovered_leads_bulk_update', 'admin_discovered_leads', null, {
    ids: input.ids.length,
    status: input.status,
  });
  revalidatePath('/leads/discover');
  return { updated: count ?? input.ids.length };
}

export async function dismissDiscoveredLead(id: string): Promise<void> {
  await updateDiscoveredLead({ id, status: 'dismissed' });
}

export async function enrichDiscoveredLead(id: string): Promise<{
  billed: boolean;
  phone: string | null;
  website: string | null;
}> {
  const admin = await requireAdminPermission('manage_users');
  const apiKey = serpApiKey();
  const supabase = getServiceRoleClient();

  const monthUsed = await getMonthUsage(supabase);
  if (monthUsed >= FREE_MONTHLY) throw new Error('No SerpApi credits left this month');

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { count: enrichCount } = await supabase
    .from('admin_discovered_lead_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'enrich')
    .gte('created_at', dayStart.toISOString());
  if ((enrichCount || 0) >= MAX_ENRICH_PER_DAY) {
    throw new Error(`Daily enrich cap reached (${MAX_ENRICH_PER_DAY}/day on Free plan)`);
  }

  const { data: lead, error } = await supabase
    .from('admin_discovered_leads')
    .select(LEAD_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!lead) throw new Error('Lead not found');

  const { data: placeRes, billed } = await fetchGoogleMapsPlace({
    placeId: lead.place_id,
    apiKey,
  });
  if (billed) await bumpMonthUsage(supabase, 1);

  const place = placeRes.place_results;
  const phone = normalizePhone(place?.phone) || lead.phone;
  const website = place?.website || lead.website;
  let websiteReachable = lead.website_reachable as boolean | null;
  let websiteCheckedAt = lead.website_checked_at as string | null;
  if (website) {
    websiteReachable = await checkWebsiteReachable(website);
    websiteCheckedAt = new Date().toISOString();
  }

  const scored = scoreFields({
    business_name: (place?.title || lead.business_name) as string,
    category: (place?.type || lead.category) as string | null,
    types: (place?.types || lead.types || []) as string[],
    phone,
    website,
    rating: (place?.rating ?? lead.rating) as number | null,
    reviews_count: (place?.reviews ?? lead.reviews_count) as number | null,
    distance_km: lead.distance_km as number | null,
    website_reachable: websiteReachable,
  });

  const { error: updateError } = await supabase
    .from('admin_discovered_leads')
    .update({
      phone,
      website,
      rating: place?.rating ?? lead.rating,
      reviews_count: place?.reviews ?? lead.reviews_count,
      open_state: place?.open_state ?? lead.open_state,
      operating_hours: place?.operating_hours ?? null,
      place_links: place?.links || [],
      website_reachable: websiteReachable,
      website_checked_at: websiteCheckedAt,
      enriched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...scored,
    })
    .eq('id', id);
  if (updateError) throw new Error(updateError.message);

  await appendEvent(
    supabase,
    id,
    'enrich',
    billed ? 'Place detail enrich (billed)' : 'Place detail enrich (cached)',
    { billed, phone: Boolean(phone), website: Boolean(website) },
    admin.email || admin.name
  );

  revalidatePath('/leads/discover');
  return { billed, phone, website };
}

export async function checkDiscoveredLeadWebsite(id: string): Promise<{ reachable: boolean }> {
  await requireAdminPermission('manage_users');
  const supabase = getServiceRoleClient();
  const { data: lead } = await supabase
    .from('admin_discovered_leads')
    .select('id, business_name, category, types, phone, website, rating, reviews_count, distance_km')
    .eq('id', id)
    .maybeSingle();
  if (!lead) throw new Error('Lead not found');
  if (!lead.website) throw new Error('No website on this lead');

  const reachable = await checkWebsiteReachable(lead.website);
  const scored = scoreFields({
    business_name: lead.business_name,
    category: lead.category,
    types: lead.types || [],
    phone: lead.phone,
    website: lead.website,
    rating: lead.rating,
    reviews_count: lead.reviews_count,
    distance_km: lead.distance_km,
    website_reachable: reachable,
  });

  await supabase
    .from('admin_discovered_leads')
    .update({
      website_reachable: reachable,
      website_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...scored,
    })
    .eq('id', id);

  revalidatePath('/leads/discover');
  return { reachable };
}

export async function exportDiscoveredLeadsCsv(filters: DiscoveryListFilters = {}): Promise<string> {
  await requireAdminPermission('manage_users');
  const supabase = getServiceRoleClient();
  let query = supabase
    .from('admin_discovered_leads')
    .select(
      'business_name, city, neighbourhood, address, phone, website, rating, reviews_count, status, score, score_band, digital_gap, suggested_pitch, owner_name, follow_up_at, maps_url'
    )
    .gt('expires_at', new Date().toISOString())
    .order('score', { ascending: false })
    .limit(500);

  if (filters.city?.trim()) query = query.ilike('city', filters.city.trim());
  if (filters.status && DISCOVERED_LEAD_STATUSES.includes(filters.status as DiscoveredLeadStatus)) {
    query = query.eq('status', filters.status);
  }
  if (filters.band === 'high' || filters.band === 'medium' || filters.band === 'low') {
    query = query.eq('score_band', filters.band);
  }
  if (filters.digitalGap === 'yes') query = query.eq('digital_gap', true);
  if (filters.contact === 'phone') query = query.not('phone', 'is', null);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const headers = [
    'business_name',
    'city',
    'neighbourhood',
    'address',
    'phone',
    'website',
    'rating',
    'reviews_count',
    'status',
    'score',
    'score_band',
    'digital_gap',
    'suggested_pitch',
    'owner_name',
    'follow_up_at',
    'maps_url',
  ];
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(',')];
  for (const row of data || []) {
    lines.push(headers.map((h) => escape((row as Record<string, unknown>)[h])).join(','));
  }

  await logAdminAction('discovered_leads_export', 'admin_discovered_leads', null, {
    rows: data?.length || 0,
    note: 'Manual outreach export — not for auto-blast',
  });

  return lines.join('\n');
}

export async function rescoreAllDiscoveredLeads(): Promise<{ updated: number }> {
  await requireAdminPermission('manage_users');
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('admin_discovered_leads')
    .select(
      'id, business_name, category, types, phone, website, rating, reviews_count, distance_km, website_reachable, city'
    )
    .gt('expires_at', new Date().toISOString())
    .limit(2000);
  if (error) throw new Error(error.message);

  let updated = 0;
  for (const row of data || []) {
    const scored = scoreFields(row);
    const scripts = buildSalesScripts({
      businessName: row.business_name,
      suggestedPitch: scored.suggested_pitch,
      digitalGap: scored.digital_gap,
      hasPhone: Boolean(row.phone),
      city: (row.city as string) || 'India',
    });
    const { error: upErr } = await supabase
      .from('admin_discovered_leads')
      .update({
        ...scored,
        call_script: scripts.callScript,
        follow_up_script: scripts.followUp,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    if (!upErr) updated += 1;
  }
  revalidatePath('/leads/discover');
  return { updated };
}

export async function getDiscoveryAreaAnalytics(): Promise<AreaAnalyticsRow[]> {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('admin_discovered_leads')
    .select('city, neighbourhood, phone, digital_gap, score, score_band, status, is_chain')
    .gt('expires_at', new Date().toISOString())
    .limit(5000);
  if (error) throw new Error(error.message);

  type Agg = {
    city: string;
    neighbourhood: string | null;
    total: number;
    withPhone: number;
    digitalGap: number;
    highScore: number;
    scoreSum: number;
    contacted: number;
    converted: number;
    openDigital: number;
  };
  const map = new Map<string, Agg>();

  for (const row of data || []) {
    const city = (row.city as string) || 'Unknown';
    const neighbourhood = (row.neighbourhood as string | null) || null;
    const key = `${city}||${neighbourhood || 'All areas'}`;
    let agg = map.get(key);
    if (!agg) {
      agg = {
        city,
        neighbourhood,
        total: 0,
        withPhone: 0,
        digitalGap: 0,
        highScore: 0,
        scoreSum: 0,
        contacted: 0,
        converted: 0,
        openDigital: 0,
      };
      map.set(key, agg);
    }
    agg.total += 1;
    if (row.phone) agg.withPhone += 1;
    if (row.digital_gap) agg.digitalGap += 1;
    if (row.score_band === 'high') agg.highScore += 1;
    agg.scoreSum += Number(row.score) || 0;
    const st = row.status as DiscoveredLeadStatus;
    if (
      st === 'contacted' ||
      st === 'callback' ||
      st === 'no_answer' ||
      st === 'interested' ||
      st === 'demo' ||
      st === 'qualified'
    ) {
      agg.contacted += 1;
    }
    if (st === 'converted') agg.converted += 1;
    if (
      row.digital_gap &&
      !row.is_chain &&
      !DISCOVERED_LEAD_CLOSED_STATUSES.includes(st) &&
      st !== 'converted' &&
      st !== 'contacted' &&
      st !== 'callback' &&
      st !== 'no_answer' &&
      st !== 'interested' &&
      st !== 'demo' &&
      st !== 'qualified'
    ) {
      agg.openDigital += 1;
    }
  }

  return Array.from(map.entries())
    .map(([key, agg]) => {
      const avgScore = agg.total ? Math.round((agg.scoreSum / agg.total) * 10) / 10 : 0;
      const digitalRate = agg.total ? agg.digitalGap / agg.total : 0;
      const opportunity = Math.round(
        agg.openDigital * 12 + digitalRate * 20 + agg.highScore * 3 - agg.contacted * 2
      );
      return {
        key,
        city: agg.city,
        neighbourhood: agg.neighbourhood,
        total: agg.total,
        withPhone: agg.withPhone,
        digitalGap: agg.digitalGap,
        highScore: agg.highScore,
        avgScore,
        contacted: agg.contacted,
        converted: agg.converted,
        opportunity: Math.max(0, opportunity),
      } satisfies AreaAnalyticsRow;
    })
    .sort((a, b) => b.opportunity - a.opportunity || b.total - a.total)
    .slice(0, 24);
}

export async function listRecentNeighbourhoodCrawls(cityLabel: string): Promise<
  { neighbourhood: string | null; created_at: string; billed: number; upserted: number }[]
> {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();
  const since = new Date(Date.now() - RECENT_CRAWL_DAYS * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('admin_discovery_runs')
    .select('neighbourhood, created_at, billed, upserted')
    .eq('city', cityLabel)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  return (data || []) as {
    neighbourhood: string | null;
    created_at: string;
    billed: number;
    upserted: number;
  }[];
}

/** Match discovered phones to existing SwarnaVyapar shops (already customers). */
export async function matchDiscoveredLeadsToShops(): Promise<{ matched: number; checked: number }> {
  await requireAdminPermission('manage_users');
  const supabase = getServiceRoleClient();

  const [{ data: leads, error: leadErr }, { data: shops, error: shopErr }] = await Promise.all([
    supabase
      .from('admin_discovered_leads')
      .select('id, phone, matched_shop_id')
      .gt('expires_at', new Date().toISOString())
      .not('phone', 'is', null)
      .limit(2000),
    supabase.from('shops').select('id, shop_name, phone_number').not('phone_number', 'is', null).limit(5000),
  ]);
  if (leadErr) throw new Error(leadErr.message);
  if (shopErr) throw new Error(shopErr.message);

  const shopByPhone = new Map<string, { id: string; name: string }>();
  for (const shop of shops || []) {
    const phone = normalizePhone(shop.phone_number as string);
    if (!phone) continue;
    shopByPhone.set(phone, { id: shop.id as string, name: (shop.shop_name as string) || 'Shop' });
  }

  let matched = 0;
  const now = new Date().toISOString();
  for (const lead of leads || []) {
    const phone = normalizePhone(lead.phone as string);
    if (!phone) continue;
    const shop = shopByPhone.get(phone);
    if (!shop) continue;
    if (lead.matched_shop_id === shop.id) {
      matched += 1;
      continue;
    }
    const { error } = await supabase
      .from('admin_discovered_leads')
      .update({
        matched_shop_id: shop.id,
        matched_shop_name: shop.name,
        matched_at: now,
        status: 'converted',
        updated_at: now,
        notes: `Auto-matched to existing shop ${shop.name}`,
      })
      .eq('id', lead.id);
    if (!error) {
      matched += 1;
      await appendEvent(
        supabase,
        lead.id as string,
        'system',
        `Matched existing shop: ${shop.name}`,
        { shop_id: shop.id }
      );
    }
  }

  await logAdminAction('discovered_leads_shop_match', 'admin_discovered_leads', null, {
    matched,
    checked: leads?.length || 0,
  });
  revalidatePath('/leads/discover');
  return { matched, checked: leads?.length || 0 };
}

export async function scanLeadCompetitors(id: string): Promise<{
  signals: CompetitorSignal[];
  error?: string;
}> {
  const admin = await requireAdminPermission('manage_users');
  const supabase = getServiceRoleClient();
  const { data: lead, error } = await supabase
    .from('admin_discovered_leads')
    .select('id, website, business_name')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!lead) throw new Error('Lead not found');
  if (!lead.website) throw new Error('No website to scan');

  const result = await scanWebsiteCompetitorSignals(lead.website as string);
  const { error: upErr } = await supabase
    .from('admin_discovered_leads')
    .update({
      competitor_signals: result.signals,
      competitor_scanned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (upErr) throw new Error(upErr.message);

  await appendEvent(
    supabase,
    id,
    'system',
    result.signals.length
      ? `Competitor evidence: ${result.signals.map((s) => s.vendor).join(', ')}`
      : result.error
        ? `Competitor scan: ${result.error}`
        : 'Competitor scan: no public vendor mentions',
    { signals: result.signals.length, fetched: result.fetched },
    admin.email || admin.name
  );

  revalidatePath('/leads/discover');
  return { signals: result.signals, error: result.error };
}

export async function regenerateLeadScripts(id: string): Promise<void> {
  await requireAdminPermission('manage_users');
  const supabase = getServiceRoleClient();
  const { data: lead, error } = await supabase
    .from('admin_discovered_leads')
    .select('id, business_name, suggested_pitch, digital_gap, phone, city')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!lead) throw new Error('Lead not found');

  const scripts = buildSalesScripts({
    businessName: lead.business_name as string,
    suggestedPitch: lead.suggested_pitch as string | null,
    digitalGap: Boolean(lead.digital_gap),
    hasPhone: Boolean(lead.phone),
    city: (lead.city as string) || 'India',
  });

  const { error: upErr } = await supabase
    .from('admin_discovered_leads')
    .update({
      call_script: scripts.callScript,
      follow_up_script: scripts.followUp,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (upErr) throw new Error(upErr.message);
  revalidatePath('/leads/discover');
}

export async function listMarketMapPoints(): Promise<
  {
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
  }[]
> {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('admin_discovered_leads')
    .select(
      'id, business_name, latitude, longitude, score, score_band, digital_gap, phone, city, neighbourhood, status'
    )
    .gt('expires_at', new Date().toISOString())
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .neq('status', 'dismissed')
    .limit(2000);
  if (error) throw new Error(error.message);
  return (data || [])
    .filter(
      (row) =>
        typeof row.latitude === 'number' &&
        typeof row.longitude === 'number' &&
        Number.isFinite(row.latitude) &&
        Number.isFinite(row.longitude)
    )
    .map((row) => ({
      id: row.id as string,
      business_name: row.business_name as string,
      latitude: row.latitude as number,
      longitude: row.longitude as number,
      score: Number(row.score) || 0,
      score_band: (row.score_band as string) || 'low',
      digital_gap: Boolean(row.digital_gap),
      phone: (row.phone as string | null) ?? null,
      city: (row.city as string) || '',
      neighbourhood: (row.neighbourhood as string | null) ?? null,
      status: (row.status as string) || 'new',
    }));
}

export async function getAiSalesConfig(): Promise<{
  configured: boolean;
  provider: 'gemini';
}> {
  await requireSuperAdmin();
  return { configured: isGeminiConfigured(), provider: 'gemini' };
}

/** LLM-personalised Hinglish scripts from score + pitch + competitor evidence (Gemini). */
export async function generateAiLeadScripts(id: string): Promise<AiSalesScripts> {
  const admin = await requireAdminPermission('manage_users');
  if (!isGeminiConfigured()) {
    throw new Error('GEMINI_API_KEY is not set in admin env');
  }

  const supabase = getServiceRoleClient();
  const { data: lead, error } = await supabase
    .from('admin_discovered_leads')
    .select(LEAD_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!lead) throw new Error('Lead not found');

  const typed = normalizeLeadRow(lead as Record<string, unknown>);
  const scripts = await generateAiSalesScripts({
    businessName: typed.business_name,
    city: typed.city,
    neighbourhood: typed.neighbourhood,
    address: typed.address,
    phone: typed.phone,
    website: typed.website,
    rating: typed.rating,
    reviewsCount: typed.reviews_count,
    score: typed.score,
    scoreBand: typed.score_band,
    scoreReasons: typed.score_reasons,
    digitalGap: typed.digital_gap,
    suggestedPitch: typed.suggested_pitch,
    isChain: typed.is_chain,
    competitorSignals: typed.competitor_signals,
  });

  const { error: upErr } = await supabase
    .from('admin_discovered_leads')
    .update({
      whatsapp_script: scripts.whatsappIntro,
      call_script: scripts.callScript,
      follow_up_script: scripts.followUp,
      ai_talking_points: scripts.talkingPoints,
      ai_scripts_at: new Date().toISOString(),
      ai_scripts_model: scripts.model,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (upErr) throw new Error(upErr.message);

  await appendEvent(
    supabase,
    id,
    'system',
    `AI sales scripts generated (${scripts.model})`,
    { model: scripts.model, provider: 'gemini' },
    admin.email || admin.name
  );

  revalidatePath('/leads/discover');
  return scripts;
}

export async function listDiscoveryCities(): Promise<string[]> {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('admin_discovered_leads')
    .select('city')
    .gt('expires_at', now)
    .order('city', { ascending: true })
    .limit(2000);
  if (error) throw new Error(error.message);
  return Array.from(
    new Set((data || []).map((row) => String(row.city || '').trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
}

export async function getDiscoveryFunnelStats(): Promise<DiscoveryFunnelStats> {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();
  const now = new Date().toISOString();
  const month = utcMonthKey();

  const byStatus = Object.fromEntries(
    DISCOVERED_LEAD_STATUSES.map((status) => [status, 0])
  ) as Record<DiscoveredLeadStatus, number>;

  const [{ data: leads, error: leadErr }, { data: runs, error: runErr }] = await Promise.all([
    supabase
      .from('admin_discovered_leads')
      .select('status, phone, digital_gap, score_band, city, area, neighbourhood')
      .gt('expires_at', now)
      .limit(5000),
    supabase
      .from('admin_discovery_runs')
      .select('billed, upserted, created_at')
      .gte('created_at', `${month}-01T00:00:00.000Z`)
      .limit(500),
  ]);
  if (leadErr) throw new Error(leadErr.message);
  if (runErr) throw new Error(runErr.message);

  let withPhone = 0;
  let digitalGap = 0;
  let highScore = 0;
  const areaMap = new Map<string, { area: string; city: string; count: number; high: number }>();

  for (const row of leads || []) {
    const status = (row.status as DiscoveredLeadStatus) || 'new';
    if (status in byStatus) byStatus[status] += 1;
    if (row.phone) withPhone += 1;
    if (row.digital_gap) digitalGap += 1;
    if (row.score_band === 'high') highScore += 1;
    const area = String(row.neighbourhood || row.area || row.city || 'Unknown').trim();
    const city = String(row.city || '').trim() || 'Unknown';
    const key = `${city}::${area}`;
    const prev = areaMap.get(key) || { area, city, count: 0, high: 0 };
    prev.count += 1;
    if (row.score_band === 'high') prev.high += 1;
    areaMap.set(key, prev);
  }

  const totalActive = Object.values(byStatus).reduce((sum, n) => sum + n, 0);
  const contactedPlus = DISCOVERED_LEAD_TOUCHED_STATUSES.reduce(
    (sum, status) => sum + byStatus[status],
    0
  );
  const demoPlus = byStatus.demo + byStatus.qualified + byStatus.converted;
  const converted = byStatus.converted;

  const monthBilled = (runs || []).reduce((sum, row) => sum + (Number(row.billed) || 0), 0);
  const monthUpserted = (runs || []).reduce((sum, row) => sum + (Number(row.upserted) || 0), 0);

  return {
    byStatus,
    totalActive,
    withPhone,
    digitalGap,
    highScore,
    contactedPlus,
    demoPlus,
    converted,
    contactRate: totalActive ? Math.round((contactedPlus / totalActive) * 1000) / 10 : null,
    demoRate: contactedPlus ? Math.round((demoPlus / contactedPlus) * 1000) / 10 : null,
    convertRate: demoPlus ? Math.round((converted / demoPlus) * 1000) / 10 : null,
    monthBilled,
    monthUpserted,
    shopsPerCredit:
      monthBilled > 0 ? Math.round((monthUpserted / monthBilled) * 10) / 10 : null,
    topAreas: Array.from(areaMap.values())
      .sort((a, b) => b.high - a.high || b.count - a.count)
      .slice(0, 6),
  };
}

export async function listSavedDiscoverySearches(): Promise<SavedDiscoverySearch[]> {
  await requireSuperAdmin();
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('admin_discovery_saved_searches')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  return (data || []) as SavedDiscoverySearch[];
}

export async function saveDiscoverySearch(input: {
  id?: string;
  name: string;
  lat: number;
  lon: number;
  radiusKm: number;
  label: string;
  cityLabel: string;
  displayName?: string;
  zoom?: number;
  keywords: string;
  maxPages: number;
  contactFilter: 'all' | 'phone' | 'website';
}): Promise<SavedDiscoverySearch> {
  const admin = await requireAdminPermission('manage_users');
  const name = input.name.trim();
  if (name.length < 2) throw new Error('Name at least 2 characters');
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lon)) {
    throw new Error('Invalid map coordinates');
  }

  const supabase = getServiceRoleClient();
  const payload = {
    name,
    lat: input.lat,
    lon: input.lon,
    radius_km: Math.min(100, Math.max(3, Number(input.radiusKm) || 8)),
    label: input.label.trim() || name,
    city_label: input.cityLabel.trim() || 'India',
    display_name: input.displayName?.trim() || null,
    zoom: input.zoom ?? zoomForRadiusKm(input.radiusKm),
    keywords:
      input.keywords.trim() ||
      (Array.isArray(DEFAULT_JEWELLERY_KEYWORDS)
        ? DEFAULT_JEWELLERY_KEYWORDS[0]
        : String(DEFAULT_JEWELLERY_KEYWORDS)) ||
      'jewellery shops',
    max_pages: Math.min(3, Math.max(1, Math.floor(Number(input.maxPages) || 2))),
    contact_filter: input.contactFilter || 'all',
    created_by: admin.email || admin.name,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from('admin_discovery_saved_searches')
      .update(payload)
      .eq('id', input.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    revalidatePath('/leads/discover');
    return data as SavedDiscoverySearch;
  }

  const { data, error } = await supabase
    .from('admin_discovery_saved_searches')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  revalidatePath('/leads/discover');
  return data as SavedDiscoverySearch;
}

export async function deleteSavedDiscoverySearch(id: string): Promise<void> {
  await requireAdminPermission('manage_users');
  if (!id) throw new Error('Missing saved search id');
  const supabase = getServiceRoleClient();
  const { error } = await supabase.from('admin_discovery_saved_searches').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/leads/discover');
}

export async function touchSavedDiscoverySearch(id: string): Promise<void> {
  await requireAdminPermission('manage_users');
  if (!id) return;
  const supabase = getServiceRoleClient();
  await supabase
    .from('admin_discovery_saved_searches')
    .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id);
}
