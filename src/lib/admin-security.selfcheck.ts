/**
 * Self-check for admin IP / session helpers.
 * Run: npx tsx src/lib/admin-security.selfcheck.ts
 */
import {
  clientIp,
  isAdminAuthBypassed,
  isAdminSessionExpired,
  isIpAllowed,
  signAdminSession,
  verifyAdminSession,
} from './admin-security';
import assert from 'node:assert/strict';

console.assert(isIpAllowed('1.2.3.4', '') === true, 'empty whitelist allows');
console.assert(isIpAllowed('1.2.3.4', '1.2.3.4,::1') === true, 'listed ok');
console.assert(isIpAllowed('9.9.9.9', '1.2.3.4') === false, 'unlisted denied');
console.assert(isIpAllowed('', '1.2.3.4') === false, 'missing ip denied');

console.assert(isAdminSessionExpired(null, 1800) === true, 'missing cookie');
console.assert(isAdminSessionExpired(Date.now(), 1800) === false, 'fresh ok');
console.assert(
  isAdminSessionExpired(Date.now() - 2000_000, 1800) === true,
  'stale expired'
);
console.assert(isAdminSessionExpired(Date.now() - 99999, 0) === false, 'timeout off');

console.assert(isAdminAuthBypassed('development', undefined) === false, 'dev requires login');
console.assert(isAdminAuthBypassed('development', '1') === false, 'bypass flag ignored');
console.assert(isAdminAuthBypassed('production', '1') === false, 'prod never bypasses');

async function main() {
  const spoofed = new Headers({ 'x-forwarded-for': '1.2.3.4, 9.9.9.9' });
  assert.equal(clientIp(spoofed), '9.9.9.9');
  const platform = new Headers({
    'x-forwarded-for': '1.2.3.4',
    'x-real-ip': '8.8.8.8',
    'x-vercel-forwarded-for': '5.5.5.5',
  });
  assert.equal(clientIp(platform), '5.5.5.5');
  assert.equal(clientIp(new Headers({ 'x-forwarded-for': '1.2.3.4' })), '1.2.3.4');

  const secret = 'test-secret-value-16';
  const signed = await signAdminSession(1_700_000_000_000, secret);
  assert.equal(await verifyAdminSession(signed, secret), 1_700_000_000_000);
  assert.equal(await verifyAdminSession(`${Date.now()}`, secret), null);
  assert.equal(await verifyAdminSession(signed, 'other-secret-value'), null);
  console.log('admin-security.selfcheck: ok');
}

void main();
