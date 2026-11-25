/**
 * Reject server-side fetches to loopback, link-local, and private networks.
 * Lead websites and redirects are untrusted input.
 */

export type HostLookup = (hostname: string) => Promise<string[]>;

const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata.google.internal.',
]);

export function isPrivateOrReservedAddress(address: string): boolean {
  const ip = address.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (ip === '::1' || ip === '::') return true;
  if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:')) return true;

  const mapped = ip.startsWith('::ffff:') ? ip.slice('::ffff:'.length) : ip;
  const parts = mapped.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false;
  const nums = parts.map((part) => Number(part));
  if (nums.some((n) => n > 255)) return true;
  const [a, b] = nums;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 255) return true;
  return false;
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (!host || BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) {
    return true;
  }
  if (isPrivateOrReservedAddress(host)) return true;
  if (!host.includes('.') && host !== 'localhost') return true;
  return false;
}

async function defaultLookup(hostname: string): Promise<string[]> {
  const { lookup } = await import('node:dns/promises');
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

/** Returns an absolute http(s) URL, or throws when the target is not a public website. */
export async function assertPublicHttpUrl(raw: string, lookup: HostLookup = defaultLookup): Promise<URL> {
  let text = raw.trim();
  if (!text) throw new Error('Blocked URL');
  if (!/^https?:\/\//i.test(text)) text = `https://${text}`;
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    throw new Error('Blocked URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('Blocked URL');
  if (parsed.username || parsed.password) throw new Error('Blocked URL');
  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') throw new Error('Blocked URL');
  if (isBlockedHostname(parsed.hostname)) throw new Error('Blocked URL');

  let addresses: string[];
  try {
    addresses = await lookup(parsed.hostname);
  } catch {
    throw new Error('Website could not be checked');
  }
  if (addresses.length === 0 || addresses.some((address) => isPrivateOrReservedAddress(address))) {
    throw new Error('Blocked URL');
  }
  return parsed;
}

type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Fetch a public URL without automatically following redirects.
 * Each redirect target is checked again so a public page cannot bounce the server onto a private address.
 */
export async function fetchPublic(
  raw: string,
  init: RequestInit = {},
  options: { fetchImpl?: FetchImpl; lookup?: HostLookup; hops?: number } = {}
): Promise<Response> {
  const hops = options.hops ?? 3;
  const target = await assertPublicHttpUrl(raw, options.lookup);
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(target.toString(), { ...init, redirect: 'manual' });
  if (response.status < 300 || response.status >= 400 || hops <= 0) return response;
  const location = response.headers.get('location');
  if (!location) return response;
  const next = new URL(location, target).toString();
  return fetchPublic(next, init, { ...options, hops: hops - 1 });
}
