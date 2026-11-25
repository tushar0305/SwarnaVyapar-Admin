/** Cities, neighbourhoods, presets and helpers for SerpApi Maps jewellery discovery. */

export const SERPAPI_FREE_MONTHLY_SEARCHES = 250;
export const SERPAPI_FREE_WARN_AT = 200;
export const MAX_SEARCHES_PER_RUN = 6;
export const MAX_ENRICH_PER_DAY = 20;
/** Skip re-crawling the same city/neighbourhood within this window (credit governor). */
export const RECENT_CRAWL_DAYS = 7;

export type DiscoveredLeadStatus =
  | 'new'
  | 'contacted'
  | 'callback'
  | 'no_answer'
  | 'interested'
  | 'not_interested'
  | 'demo'
  | 'qualified'
  | 'converted'
  | 'lost'
  | 'dismissed';

export const DISCOVERED_LEAD_STATUSES: DiscoveredLeadStatus[] = [
  'new',
  'contacted',
  'callback',
  'no_answer',
  'interested',
  'not_interested',
  'demo',
  'qualified',
  'converted',
  'lost',
  'dismissed',
];

export const DISCOVERED_LEAD_STATUS_LABEL: Record<DiscoveredLeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  callback: 'Call back',
  no_answer: 'No answer',
  interested: 'Interested',
  not_interested: 'Not interested',
  demo: 'Demo',
  qualified: 'Qualified',
  converted: 'Converted',
  lost: 'Lost',
  dismissed: 'Dismissed',
};

/** Closed / negative outcomes — hide from opportunity & active funnel stages. */
export const DISCOVERED_LEAD_CLOSED_STATUSES: DiscoveredLeadStatus[] = [
  'not_interested',
  'lost',
  'dismissed',
];

/** Outreach happened (or attempted) — count toward contact rate. */
export const DISCOVERED_LEAD_TOUCHED_STATUSES: DiscoveredLeadStatus[] = [
  'contacted',
  'callback',
  'no_answer',
  'interested',
  'not_interested',
  'demo',
  'qualified',
  'converted',
];

export type DiscoveryCity = {
  id: string;
  label: string;
  state: string;
  lat: number;
  lon: number;
  defaultZoom: number;
};

export type DiscoveryNeighbourhood = {
  id: string;
  cityId: string;
  label: string;
  lat: number;
  lon: number;
  zoom: number;
};

export type DiscoveryPreset = {
  id: string;
  label: string;
  keywords: string;
  description: string;
};

export const DISCOVERY_CITIES: DiscoveryCity[] = [
  {
    id: 'lucknow',
    label: 'Lucknow',
    state: 'Uttar Pradesh',
    lat: 26.8467,
    lon: 80.9462,
    defaultZoom: 11,
  },
  {
    id: 'kanpur',
    label: 'Kanpur',
    state: 'Uttar Pradesh',
    lat: 26.4499,
    lon: 80.3319,
    defaultZoom: 11,
  },
  {
    id: 'varanasi',
    label: 'Varanasi',
    state: 'Uttar Pradesh',
    lat: 25.3176,
    lon: 82.9739,
    defaultZoom: 11,
  },
  {
    id: 'jaipur',
    label: 'Jaipur',
    state: 'Rajasthan',
    lat: 26.9124,
    lon: 75.7873,
    defaultZoom: 11,
  },
  {
    id: 'surat',
    label: 'Surat',
    state: 'Gujarat',
    lat: 21.1702,
    lon: 72.8311,
    defaultZoom: 11,
  },
  {
    id: 'hyderabad',
    label: 'Hyderabad',
    state: 'Telangana',
    lat: 17.385,
    lon: 78.4867,
    defaultZoom: 11,
  },
  {
    id: 'delhi',
    label: 'Delhi',
    state: 'Delhi',
    lat: 28.6139,
    lon: 77.209,
    defaultZoom: 11,
  },
];

export const DISCOVERY_NEIGHBOURHOODS: DiscoveryNeighbourhood[] = [
  { id: 'lko-hazratganj', cityId: 'lucknow', label: 'Hazratganj', lat: 26.8512, lon: 80.943, zoom: 14 },
  { id: 'lko-gomti', cityId: 'lucknow', label: 'Gomti Nagar', lat: 26.8622, lon: 81.008, zoom: 14 },
  { id: 'lko-aminabad', cityId: 'lucknow', label: 'Aminabad', lat: 26.8475, lon: 80.923, zoom: 14 },
  { id: 'lko-chowk', cityId: 'lucknow', label: 'Chowk', lat: 26.8635, lon: 80.909, zoom: 14 },
  { id: 'lko-alambagh', cityId: 'lucknow', label: 'Alambagh', lat: 26.812, lon: 80.903, zoom: 14 },
  { id: 'lko-indira', cityId: 'lucknow', label: 'Indira Nagar', lat: 26.876, lon: 80.99, zoom: 14 },
  { id: 'knp-swaroop', cityId: 'kanpur', label: 'Swaroop Nagar', lat: 26.482, lon: 80.319, zoom: 14 },
  { id: 'knp-mall', cityId: 'kanpur', label: 'Mall Road', lat: 26.467, lon: 80.35, zoom: 14 },
  { id: 'vns-lanka', cityId: 'varanasi', label: 'Lanka', lat: 25.278, lon: 82.999, zoom: 14 },
  { id: 'vns-sigra', cityId: 'varanasi', label: 'Sigra', lat: 25.312, lon: 82.989, zoom: 14 },
  { id: 'jai-bapu', cityId: 'jaipur', label: 'Bapu Bazaar', lat: 26.917, lon: 75.82, zoom: 14 },
  { id: 'jai-johari', cityId: 'jaipur', label: 'Johari Bazaar', lat: 26.924, lon: 75.826, zoom: 14 },
  { id: 'srt-varachha', cityId: 'surat', label: 'Varachha', lat: 21.212, lon: 72.842, zoom: 14 },
  { id: 'srt-ring', cityId: 'surat', label: 'Ring Road', lat: 21.185, lon: 72.831, zoom: 14 },
  { id: 'hyd-abids', cityId: 'hyderabad', label: 'Abids', lat: 17.393, lon: 78.477, zoom: 14 },
  { id: 'hyd-banjara', cityId: 'hyderabad', label: 'Banjara Hills', lat: 17.415, lon: 78.435, zoom: 14 },
  { id: 'del-chandni', cityId: 'delhi', label: 'Chandni Chowk', lat: 28.6506, lon: 77.2303, zoom: 14 },
  { id: 'del-karol', cityId: 'delhi', label: 'Karol Bagh', lat: 28.651, lon: 77.190, zoom: 14 },
];

export const DISCOVERY_PRESETS: DiscoveryPreset[] = [
  {
    id: 'retail',
    label: 'Retail jeweller',
    keywords: 'jewellery shops',
    description: 'General retail jewellery stores',
  },
  {
    id: 'gold',
    label: 'Gold / jewellers',
    keywords: 'jewellers, gold jewellery',
    description: 'Gold-focused shops (2 keywords)',
  },
  {
    id: 'diamond',
    label: 'Diamond',
    keywords: 'diamond jewellery',
    description: 'Diamond / studded jewellery',
  },
  {
    id: 'silver',
    label: 'Silver',
    keywords: 'silver jewellery',
    description: 'Silver ornament shops',
  },
  {
    id: 'wholesale',
    label: 'Wholesale / showroom',
    keywords: 'jewellery showroom, wholesale jewellery',
    description: 'Showrooms and wholesale (2 keywords)',
  },
];

export const DEFAULT_JEWELLERY_KEYWORDS = [
  'jewellery shops',
  'jewellers',
  'gold jewellery',
] as const;

export function getDiscoveryCity(cityId: string): DiscoveryCity | undefined {
  return DISCOVERY_CITIES.find((city) => city.id === cityId);
}

export function getNeighbourhood(id: string): DiscoveryNeighbourhood | undefined {
  return DISCOVERY_NEIGHBOURHOODS.find((n) => n.id === id);
}

export function neighbourhoodsForCity(cityId: string): DiscoveryNeighbourhood[] {
  return DISCOVERY_NEIGHBOURHOODS.filter((n) => n.cityId === cityId);
}

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export function whatsappHref(phone: string | null | undefined, text?: string): string | null {
  const n = normalizePhone(phone);
  if (!n || n.length < 10) return null;
  const base = `https://wa.me/91${n}`;
  if (!text?.trim()) return base;
  return `${base}?text=${encodeURIComponent(text.trim())}`;
}

export function mapsPlaceHref(placeId: string | null | undefined): string | null {
  if (!placeId) return null;
  return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;
}

/** Opens the public Google Maps place page once in a new tab. */
export function openGoogleBusinessProfile(url: string | null | undefined): boolean {
  if (!url || typeof window === 'undefined') return false;
  // Use a real <a> click — window.open(..., features) has opened two tabs in Chrome.
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return true;
}

export function utcMonthKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function draftHinglishIntro(shopName: string, pitch: string | null): string {
  const name = shopName.trim() || 'ji';
  const focus = pitch?.includes('Catalogue')
    ? 'online catalogue aur billing'
    : pitch?.includes('WhatsApp')
      ? 'WhatsApp pe bill share aur stock'
      : 'billing, stock aur catalogue';
  return `Namaste ${name} team, SwarnaVyapar se baat ho rahi hai. Hum jewellery shops ke liye ${focus} simplify karte hain. 10 minute demo suit karega kya?`;
}

export type AreaAnalyticsRow = {
  key: string;
  city: string;
  neighbourhood: string | null;
  total: number;
  withPhone: number;
  digitalGap: number;
  highScore: number;
  avgScore: number;
  contacted: number;
  converted: number;
  /** Higher = more offline-strong / digitally weak independents still uncontacted. */
  opportunity: number;
};
