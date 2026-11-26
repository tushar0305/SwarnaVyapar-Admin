/** Client IP + session cookie helpers for admin proxy. */

export const ADMIN_SESSION_COOKIE = 'sv_admin_session_at';

/** Auth bypass is disabled. All environments require a real super_admins login. */
export function isAdminAuthBypassed(
  _nodeEnv = process.env.NODE_ENV,
  _flag = process.env.ADMIN_BYPASS_AUTH
): boolean {
  return false;
}

/**
 * Prefer platform-set client IPs. The left-most X-Forwarded-For value is
 * client-controlled when a proxy appends the real address, so it is not trusted
 * once more than one hop is present.
 */
export function clientIp(headers: Headers, directIp?: string | null): string {
  const vercel = headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim();
  if (vercel) return vercel;
  const real = headers.get('x-real-ip')?.trim();
  if (real) return real;
  if (directIp?.trim()) return directIp.trim();
  const forwarded = headers.get('x-forwarded-for');
  if (!forwarded) return '';
  const parts = forwarded.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  return parts.length === 1 ? parts[0] : parts[parts.length - 1];
}

/**
 * Prefer a dedicated ADMIN_SESSION_SECRET so the idle-session MAC is not tied
 * to the database god-key. Local/dev may fall back to the service-role key;
 * production requires the dedicated secret.
 */
export function sessionSigningSecret(
  explicit = process.env.ADMIN_SESSION_SECRET,
  fallback = process.env.SUPABASE_SERVICE_ROLE_KEY,
  nodeEnv = process.env.NODE_ENV
): string | null {
  const primary = explicit?.trim() || '';
  if (primary.length >= 16) return primary;
  if (nodeEnv === 'production') return null;
  const value = fallback?.trim() || '';
  return value.length >= 16 ? value : null;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  let binary = '';
  for (const byte of new Uint8Array(signature)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/** `${startedAtMs}.${hmac}` so a caller cannot mint a fresh timeout anchor. */
export async function signAdminSession(startedAtMs: number, secret: string): Promise<string> {
  const stamp = String(Math.trunc(startedAtMs));
  return `${stamp}.${await hmacSha256(secret, stamp)}`;
}

export async function verifyAdminSession(
  value: string | undefined,
  secret: string | null
): Promise<number | null> {
  if (!value || !secret) return null;
  const dot = value.lastIndexOf('.');
  if (dot <= 0) return null;
  const stamp = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  if (!/^\d+$/.test(stamp) || !mac) return null;
  const expected = await hmacSha256(secret, stamp);
  if (!timingSafeEqualStr(mac, expected)) return null;
  return Number(stamp);
}

/** Empty whitelist = allow all (local dev). */
export function isIpAllowed(ip: string, whitelistCsv: string | undefined): boolean {
  const list = (whitelistCsv || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length === 0) return true;
  if (!ip) return false;
  return list.includes(ip);
}

/**
 * Gate admin routes by ADMIN_IP_WHITELIST.
 * - Empty whitelist → allow
 * - Known IP not listed → deny
 * - Unknown IP (common on local `next dev` with no proxy headers):
 *   allow outside production, deny in production
 */
export function isAdminIpPermitted(
  ip: string,
  whitelistCsv: string | undefined,
  nodeEnv = process.env.NODE_ENV
): { allowed: boolean; reason?: 'not_listed' | 'unknown_ip' } {
  const list = (whitelistCsv || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length === 0) return { allowed: true };
  if (!ip) {
    if (nodeEnv === 'production') return { allowed: false, reason: 'unknown_ip' };
    return { allowed: true, reason: 'unknown_ip' };
  }
  if (!list.includes(ip)) return { allowed: false, reason: 'not_listed' };
  return { allowed: true };
}

export function isAdminSessionExpired(
  startedAtMs: number | null,
  timeoutSeconds: number
): boolean {
  if (!timeoutSeconds || timeoutSeconds <= 0) return false;
  if (!startedAtMs) return true;
  return Date.now() - startedAtMs > timeoutSeconds * 1000;
}

/**
 * Idle timeout in seconds.
 * Default 30 minutes. Set ADMIN_SESSION_TIMEOUT=0 to disable.
 * Missing/invalid values fall back to the default (fail closed for idle sessions).
 */
export function adminSessionTimeoutSeconds(
  raw = process.env.ADMIN_SESSION_TIMEOUT
): number {
  if (raw == null || String(raw).trim() === '') return 1800;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return 1800;
  return Math.trunc(value);
}
