/**
 * Self-check for lead scoring. Run: npx tsx src/lib/lead-score.selfcheck.ts
 */
import {
  fromDatetimeLocalIst,
  joinSource,
  nextLeadAction,
  scoreLead,
  toDatetimeLocalIst,
  type LeadSignals,
} from './lead-score';

function signals(partial: Partial<LeadSignals>): LeadSignals {
  return {
    customers: 0,
    inventory: 0,
    invoices: 0,
    catalogueProducts: 0,
    cataloguePageViews: 0,
    catalogueProductViews: 0,
    catalogueWhatsappClicks: 0,
    catalogueLeads: 0,
    whatsappOutbound: 0,
    aiEvents: 0,
    schemes: 0,
    loans: 0,
    khata: 0,
    supportTickets: 0,
    whatsappConnected: false,
    hasGst: false,
    planId: null,
    planStatus: null,
    signedInRecently: false,
    returning: false,
    suspended: false,
    roleActive: true,
    ...partial,
  };
}

const signupOnly = scoreLead(signals({ signedInRecently: true, returning: false }));
console.assert(signupOnly.highIntent === false, 'sign-in alone is not high intent');
console.assert(signupOnly.converted === false, 'sign-in is not conversion');

const working = scoreLead(
  signals({ signedInRecently: true, customers: 2, inventory: 4 })
);
console.assert(working.highIntent === true, 'customers + stock + sign-in is high intent');
console.assert(working.score >= 30, 'working shop clears 30');
console.assert(
  working.reasons.some((reason) => reason.scope === 'shop' && reason.text.includes('customer')),
  'why includes customers'
);

const billed = scoreLead(signals({ invoices: 3, customers: 3, inventory: 3, signedInRecently: true }));
console.assert(billed.converted === true, 'invoice converts');
console.assert(billed.highIntent === false, 'converted shops are not high-intent leads');
console.assert(billed.conversionReason?.includes('invoice'), 'conversion reason names invoices');

const suspended = scoreLead(signals({ suspended: true, invoices: 2 }));
console.assert(suspended.score === 0 && suspended.highIntent === false, 'suspended is not a lead');
console.assert(suspended.converted === true, 'suspension does not erase invoices');

const catalogue = scoreLead(
  signals({ catalogueProducts: 2, catalogueProductViews: 8, catalogueLeads: 1 })
);
console.assert(catalogue.highIntent === true, 'catalogue demand is high intent');

console.assert(
  joinSource({
    hasShop: true,
    role: 'owner',
    shopCreatedBy: 'user-1',
    userId: 'user-1',
    shopCreatedAt: '2026-10-01T00:00:00Z',
    roleCreatedAt: '2026-10-01T00:00:00Z',
  }) === 'created_shop',
  'creator source'
);
console.assert(
  joinSource({
    hasShop: true,
    role: 'manager',
    shopCreatedBy: 'owner',
    userId: 'staff',
    shopCreatedAt: '2026-10-01T00:00:00Z',
    roleCreatedAt: '2026-10-02T00:00:00Z',
  }) === 'added',
  'staff source'
);

const due = nextLeadAction({
  hasShop: true,
  hasPhone: true,
  roleActive: true,
  suspended: false,
  highIntent: true,
  converted: false,
  cohort: 'stalled_billing',
  pipeline: 'contacted',
  followUpAt: '2026-10-01T00:00:00Z',
  whatsappConnected: false,
  ageDays: 3,
  now: Date.parse('2026-10-07T00:00:00Z'),
});
console.assert(due.label.includes('Follow-up is due'), 'due follow-up wins');

const iso = fromDatetimeLocalIst('2026-10-31T18:30');
console.assert(iso === '2026-10-31T13:00:00.000Z', 'IST follow-up converts to UTC');
console.assert(toDatetimeLocalIst(iso) === '2026-10-31T18:30', 'IST follow-up round trip');

console.log('lead-score selfcheck ok');
