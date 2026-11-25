/**
 * Evidence-only public website competitor signals.
 * Never claim a shop uses software without a matching public string.
 */

export type CompetitorSignal = {
  vendor: string;
  evidence: string;
  matched: string;
};

/** Publicly marketed jewellery / retail ERP & catalogue vendors (India-focused). */
const VENDOR_PATTERNS: { vendor: string; pattern: RegExp }[] = [
  { vendor: 'JewelSoft', pattern: /jewel\s*soft/i },
  { vendor: 'JewelCAD', pattern: /jewel\s*cad/i },
  { vendor: 'Marg ERP', pattern: /marg\s*erp|\bmarg\b/i },
  { vendor: 'Vyapar', pattern: /\bvyapar\b/i },
  { vendor: 'Busy Accounting', pattern: /\bbusy\s*(accounting|software)?\b/i },
  { vendor: 'Tally', pattern: /\btally\b/i },
  { vendor: 'Orbit Jewels', pattern: /orbit\s*jewels?/i },
  { vendor: 'JewelEasy', pattern: /jewel\s*easy/i },
  { vendor: 'Saral Jewels', pattern: /saral\s*jewels?/i },
  { vendor: 'Ginesys', pattern: /\bginesys\b/i },
  { vendor: 'GoFrugal', pattern: /go\s*frugal/i },
  { vendor: 'Petpooja', pattern: /pet\s*pooja/i },
  { vendor: 'Shopify', pattern: /\bshopify\b/i },
  { vendor: 'WooCommerce', pattern: /woo\s*commerce/i },
  { vendor: 'SwarnaVyapar', pattern: /swarna\s*vyapar/i },
];

function normalizeUrl(website: string): string | null {
  let url = website.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function snippetAround(hay: string, index: number, len: number): string {
  const start = Math.max(0, index - 40);
  const end = Math.min(hay.length, index + len + 40);
  return hay.slice(start, end).replace(/\s+/g, ' ').trim();
}

/**
 * Fetch homepage HTML (public) and extract vendor mentions with evidence snippets.
 * Honours a short timeout; does not follow into authenticated areas.
 */
export async function scanWebsiteCompetitorSignals(
  website: string
): Promise<{ signals: CompetitorSignal[]; fetched: boolean; error?: string }> {
  const url = normalizeUrl(website);
  if (!url) return { signals: [], fetched: false, error: 'Invalid website URL' };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'SwarnaVyaparAdminBot/1.0 (+https://swarnavyapar.com; sales-research)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { signals: [], fetched: true, error: `HTTP ${res.status}` };
    }
    const html = (await res.text()).slice(0, 250_000);
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ');

    const signals: CompetitorSignal[] = [];
    const seen = new Set<string>();
    for (const { vendor, pattern } of VENDOR_PATTERNS) {
      const match = text.match(pattern) || html.match(pattern);
      if (!match || match.index == null) continue;
      if (seen.has(vendor)) continue;
      seen.add(vendor);
      signals.push({
        vendor,
        matched: match[0],
        evidence: snippetAround(match.input || text, match.index, match[0].length),
      });
    }
    return { signals, fetched: true };
  } catch (error) {
    return {
      signals: [],
      fetched: false,
      error: error instanceof Error ? error.message : 'Fetch failed',
    };
  }
}
