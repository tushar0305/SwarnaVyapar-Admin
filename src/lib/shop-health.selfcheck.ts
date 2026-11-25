/**
 * Self-check for shop activation classification.
 * Run: npx tsx src/lib/shop-health.selfcheck.ts
 */
import {
  classifyShopHealth,
  primaryCohort,
  type ShopHealthCounts,
} from './shop-health';

const now = Date.parse('2026-09-25T00:00:00.000Z');

function counts(partial: Partial<ShopHealthCounts>): ShopHealthCounts {
  return {
    invoices: 0,
    customers: 0,
    inventory: 0,
    staff: 1,
    schemes: 0,
    loans: 0,
    khata: 0,
    whatsappConnected: false,
    hasGst: false,
    planId: 'free',
    lastActivityAt: '2026-09-24T00:00:00.000Z',
    createdAt: '2026-09-24T00:00:00.000Z',
    isSuspended: false,
    ...partial,
  };
}

console.assert(primaryCohort(counts({}), now) === 'never_started', 'empty shop');
console.assert(
  primaryCohort(counts({ inventory: 3 }), now) === 'stalled_billing',
  'stock no bill'
);
console.assert(
  primaryCohort(counts({ invoices: 2 }), now) === 'activated',
  'billed recently'
);
console.assert(
  primaryCohort(
    counts({
      invoices: 4,
      lastActivityAt: '2026-08-01T00:00:00.000Z',
    }),
    now
  ) === 'quiet',
  'billed then silent'
);

const stale = classifyShopHealth(
  counts({ createdAt: '2026-08-01T00:00:00.000Z', inventory: 1 }),
  now
);
console.assert(stale.needsAssistance === true, 'week+ no invoice needs help');
console.assert(stale.activated === false, 'no invoice is not activated');

const cap = classifyShopHealth(counts({ invoices: 1, customers: 80 }), now);
console.assert(cap.upgradeReady === true, '80/100 customers is upgrade-ready');
console.assert(cap.tags.includes('upgrade_ready'), 'upgrade tag');

const wa = classifyShopHealth(
  counts({ invoices: 1, whatsappConnected: false, hasGst: true }),
  now
);
console.assert(wa.tags.includes('whatsapp_off'), 'billed without WhatsApp');
console.assert(wa.overallProgress === 40, 'gst + invoice = 2 of 5 core');

const dead = classifyShopHealth(counts({ isSuspended: true, invoices: 9 }), now);
console.assert(dead.score === 0, 'suspended score 0');

console.log('shop-health.selfcheck: ok');
