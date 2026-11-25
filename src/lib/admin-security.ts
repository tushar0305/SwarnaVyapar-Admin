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

export function sessionSigningSecret(
  explicit = process.env.ADMIN_SESSION_SECRET,
  fallback = process.env.SUPABASE_SERVICE_ROLE_KEY
): string | null {
  const value = (explicit?.trim() || fallback?.trim() || '');
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

export function isAdminSessionExpired(
  startedAtMs: number | null,
  timeoutSeconds: number
): boolean {
  if (!timeoutSeconds || timeoutSeconds <= 0) return false;
  if (!startedAtMs) return true;
  return Date.now() - startedAtMs > timeoutSeconds * 1000;
}
