/** Client IP + session cookie helpers for admin proxy. */

export const ADMIN_SESSION_COOKIE = 'sv_admin_session_at';

/** Auth bypass is disabled. All environments require a real super_admins login. */
export function isAdminAuthBypassed(
  _nodeEnv = process.env.NODE_ENV,
  _flag = process.env.ADMIN_BYPASS_AUTH
): boolean {
  return false;
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || '';
  return headers.get('x-real-ip')?.trim() || '';
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
