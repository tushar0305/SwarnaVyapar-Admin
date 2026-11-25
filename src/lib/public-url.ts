/**
 * Reject server-side fetches to loopback, link-local, and private networks.
 * Lead websites and redirects are untrusted input.
 *
 * Connections pin to a DNS answer that already passed the private-IP check so a
 * hostname cannot rebind to an internal address between lookup and connect.
 */

import http from 'node:http';
import https from 'node:https';
import type { IncomingMessage } from 'node:http';

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

export type PublicHttpTarget = {
  url: URL;
  /** Public A/AAAA answers used to pin the TCP connection. */
  addresses: string[];
};

/** Returns an absolute http(s) URL plus validated public DNS answers. */
export async function assertPublicHttpUrl(
  raw: string,
  lookup: HostLookup = defaultLookup
): Promise<PublicHttpTarget> {
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
  const publicAddresses = addresses.filter((address) => !isPrivateOrReservedAddress(address));
  if (addresses.length === 0 || publicAddresses.length !== addresses.length) {
    throw new Error('Blocked URL');
  }
  return { url: parsed, addresses: publicAddresses };
}

type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>;

function headerRecord(headers?: HeadersInit): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    for (const [key, value] of headers) out[key] = value;
    return out;
  }
  return { ...headers };
}

/**
 * Connect to a previously validated public IP while keeping the original Host/SNI.
 * This closes the DNS-rebinding gap between lookup and connect.
 */
export async function fetchPinned(
  target: PublicHttpTarget,
  init: RequestInit = {}
): Promise<Response> {
  const pinned = target.addresses[0];
  if (!pinned || isPrivateOrReservedAddress(pinned)) throw new Error('Blocked URL');

  const url = target.url;
  const isHttps = url.protocol === 'https:';
  const lib = isHttps ? https : http;
  const method = (init.method || 'GET').toUpperCase();
  const headers = headerRecord(init.headers);
  headers.Host = url.host;
  // Do not let callers override Host to a different name after we pinned the IP.
  delete (headers as Record<string, string | undefined>).host;

  const body =
    init.body == null
      ? undefined
      : typeof init.body === 'string' || Buffer.isBuffer(init.body)
        ? init.body
        : Buffer.from(await new Response(init.body).arrayBuffer());

  return new Promise<Response>((resolve, reject) => {
    const req = lib.request(
      {
        protocol: url.protocol,
        // Connect by IP; SNI/Host keep the original public hostname.
        hostname: pinned,
        servername: isHttps ? url.hostname : undefined,
        port: url.port ? Number(url.port) : isHttps ? 443 : 80,
        path: `${url.pathname}${url.search}`,
        method,
        headers,
        family: pinned.includes(':') ? 6 : 4,
        lookup(_hostname, _options, callback) {
          const family = pinned.includes(':') ? 6 : 4;
          callback(null, pinned, family);
        },
      },
      (res: IncomingMessage) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          const responseHeaders = new Headers();
          for (const [key, value] of Object.entries(res.headers)) {
            if (value == null) continue;
            if (Array.isArray(value)) value.forEach((item) => responseHeaders.append(key, item));
            else responseHeaders.set(key, value);
          }
          resolve(
            new Response(Buffer.concat(chunks), {
              status: res.statusCode || 0,
              statusText: res.statusMessage || '',
              headers: responseHeaders,
            })
          );
        });
      }
    );

    const signal = init.signal;
    if (signal) {
      if (signal.aborted) {
        req.destroy();
        reject(signal.reason || new Error('Aborted'));
        return;
      }
      const onAbort = () => {
        req.destroy();
        reject(signal.reason || new Error('Aborted'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
      req.on('close', () => signal.removeEventListener('abort', onAbort));
    }

    req.on('error', reject);
    if (body != null) req.write(body);
    req.end();
  });
}

/**
 * Fetch a public URL without automatically following redirects.
 * Each redirect target is checked again, and the TCP peer is pinned to a public DNS answer.
 */
export async function fetchPublic(
  raw: string,
  init: RequestInit = {},
  options: { fetchImpl?: FetchImpl; lookup?: HostLookup; hops?: number } = {}
): Promise<Response> {
  const hops = options.hops ?? 3;
  const target = await assertPublicHttpUrl(raw, options.lookup);
  const response = options.fetchImpl
    ? await options.fetchImpl(target.url.toString(), { ...init, redirect: 'manual' })
    : await fetchPinned(target, { ...init, redirect: 'manual' });
  if (response.status < 300 || response.status >= 400 || hops <= 0) return response;
  const location = response.headers.get('location');
  if (!location) return response;
  const next = new URL(location, target.url).toString();
  return fetchPublic(next, init, { ...options, hops: hops - 1 });
}
