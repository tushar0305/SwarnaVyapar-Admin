/**
 * Regression checks for search-filter and outbound-URL guards.
 * Run: npx tsx src/lib/security.selfcheck.ts
 */
import assert from 'node:assert/strict';
import { ilikeAny } from './postgrest-filter';
import { assertPublicHttpUrl, fetchPublic, isPrivateOrReservedAddress } from './public-url';

assert.equal(isPrivateOrReservedAddress('127.0.0.1'), true);
assert.equal(isPrivateOrReservedAddress('169.254.169.254'), true);
assert.equal(isPrivateOrReservedAddress('10.1.2.3'), true);
assert.equal(isPrivateOrReservedAddress('8.8.8.8'), false);
assert.equal(isPrivateOrReservedAddress('example.com'), false);

const injected = ilikeAny(['reason', 'action'], '%,id.not.is.null');
assert.equal(injected, 'reason.ilike."%id not is null%",action.ilike."%id not is null%"');
assert.equal(ilikeAny(['name'], ',,,'), null);

const publicLookup = async () => ['93.184.216.34'];
const privateLookup = async () => ['10.0.0.8'];

async function main() {
  const ok = await assertPublicHttpUrl('https://example.com/path', publicLookup);
  assert.equal(ok.hostname, 'example.com');

  for (const blocked of [
    'http://127.0.0.1/',
    'http://169.254.169.254/latest',
    'http://localhost/admin',
    'https://user:pass@example.com/',
    'https://example.com:6379/',
    'file:///etc/passwd',
  ]) {
    await assert.rejects(() => assertPublicHttpUrl(blocked, publicLookup), blocked);
  }

  await assert.rejects(() => assertPublicHttpUrl('https://example.com', privateLookup));

  await assert.rejects(() =>
    fetchPublic('https://example.com', { method: 'GET' }, {
      lookup: publicLookup,
      fetchImpl: async () =>
        new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/' } }),
    })
  );

  console.log('security.selfcheck: ok');
}

void main();
