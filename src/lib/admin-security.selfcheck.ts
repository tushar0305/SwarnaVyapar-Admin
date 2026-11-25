/**
 * Self-check for admin IP / session helpers.
 * Run: npx tsx src/lib/admin-security.selfcheck.ts
 */
import {
  isAdminAuthBypassed,
  isAdminSessionExpired,
  isIpAllowed,
} from './admin-security';

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

console.log('admin-security.selfcheck: ok');
