import type { PrimaryCohort } from '@/lib/shop-health';

/** Founder-facing lead score. Points come only from records we actually store. */

export const PIPELINE_STATUSES = [
  'new',
  'contacted',
  'callback',
  'no_answer',
  'interested',
  'not_interested',
  'demo',
  'converted',
  'lost',
] as const;

export type StoredPipelineStatus = (typeof PIPELINE_STATUSES)[number];
export type PipelineStatus = StoredPipelineStatus | 'unreviewed';

export const PIPELINE_LABEL: Record<PipelineStatus, string> = {
  unreviewed: 'Unreviewed',
  new: 'New',
  contacted: 'Contacted',
  callback: 'Call back',
  no_answer: 'No answer',
  interested: 'Interested',
  not_interested: 'Not interested',
  demo: 'Demo',
  converted: 'Converted',
  lost: 'Lost',
};

/** Closed / negative outcomes — no follow-up nudges. */
export const PIPELINE_CLOSED_STATUSES: StoredPipelineStatus[] = ['not_interested', 'lost'];

export const LEAD_SORT_KEYS = [
  'person',
  'shop',
  'signed_up',
  'last_active',
  'score',
  'status',
  'next',
  'note',
] as const;

export type LeadSortKey = (typeof LEAD_SORT_KEYS)[number];

export function isLeadSortKey(value: string | undefined): value is LeadSortKey {
  return Boolean(value && (LEAD_SORT_KEYS as readonly string[]).includes(value));
}

export const PLAN_LABEL: Record<string, string> = {
  free: 'Starter',
  pro: 'Professional',
  business: 'Business',
};

export const JOIN_LABEL = {
  created_shop: 'Created this shop',
  added: 'Added to this shop',
  no_shop: 'No shop yet',
} as const;

export type JoinSource = keyof typeof JOIN_LABEL;

export type ScoreReason = {
  points: number;
  text: string;
  scope: 'person' | 'shop';
};

export type LeadSignals = {
  customers: number;
  inventory: number;
  invoices: number;
  catalogueProducts: number;
  cataloguePageViews: number;
  catalogueProductViews: number;
  catalogueWhatsappClicks: number;
  catalogueLeads: number;
  whatsappOutbound: number;
  aiEvents: number;
  schemes: number;
  loans: number;
  khata: number;
  supportTickets: number;
  whatsappConnected: boolean;
  hasGst: boolean;
  planId: string | null;
  planStatus: string | null;
  signedInRecently: boolean;
  returning: boolean;
  suspended: boolean;
  roleActive: boolean;
};

export type LeadScore = {
  score: number;
  reasons: ScoreReason[];
  highIntent: boolean;
  converted: boolean;
  conversionReason: string | null;
  band: 'high' | 'medium' | 'low';
};

export type NextAction = {
  label: string;
  tone: 'attention' | 'default';
};

const HIGH_INTENT_SCORE = 30;

export const WHATSAPP_PRESETS = [
  {
    id: 'welcome',
    label: 'Welcome',
    message:
      'Your SwarnaVyapar shop is ready. Add GST, one customer, and the first invoice. Reply here if you want a walkthrough.',
  },
  {
    id: 'onboarding',
    label: 'Onboarding help',
    message:
      'You have started setup. The next useful step is a customer and the first bill from the counter. Reply with what is blocking you.',
  },
  {
    id: 'demo',
    label: 'Demo invitation',
    message:
      'We can do a short demo of billing, stock, and WhatsApp sharing for a jewellery counter. Reply with a time that suits you.',
  },
  {
    id: 'follow_up',
    label: 'Follow-up',
    message:
      'Checking in on our last conversation. Tell us if you want help with billing, stock, or WhatsApp.',
  },
  {
    id: 'reengage',
    label: 'Re-engagement',
    message:
      'It has been quiet on the shop. Open SwarnaVyapar and create one bill today. Reply if something is in the way.',
  },
] as const;

export function isStoredPipeline(value: string): value is StoredPipelineStatus {
  return (PIPELINE_STATUSES as readonly string[]).includes(value);
}

export function planLabel(planId: string | null | undefined): string {
  if (!planId) return 'No plan';
  return PLAN_LABEL[planId] || planId;
}

export function signInLabel(provider: string | null | undefined): string {
  if (!provider) return 'Not recorded';
  if (provider === 'google') return 'Google';
  if (provider === 'email') return 'Email';
  return provider;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export function isPaidActive(planId: string | null, status: string | null): boolean {
  return (planId === 'pro' || planId === 'business') && status === 'active';
}

export function scoreLead(signals: LeadSignals): LeadScore {
  const paid = isPaidActive(signals.planId, signals.planStatus);
  const converted = signals.invoices > 0 || paid;
  const conversionReason = !converted
    ? null
    : signals.invoices > 0 && paid
      ? `Created ${plural(signals.invoices, 'invoice')}, and ${planLabel(signals.planId)} is active.`
      : signals.invoices > 0
        ? `Created ${plural(signals.invoices, 'invoice')}.`
        : `${planLabel(signals.planId)} is an active paid plan.`;

  if (signals.suspended) {
    return {
      score: 0,
      reasons: [{ points: 0, text: 'Shop is suspended', scope: 'shop' }],
      highIntent: false,
      converted,
      conversionReason,
      band: 'low',
    };
  }

  const reasons: ScoreReason[] = [];
  const add = (points: number, text: string, scope: ScoreReason['scope'], when: boolean) => {
    if (!when) return;
    reasons.push({ points, text, scope });
  };

  add(12, 'Signed in during the last 7 days', 'person', signals.signedInRecently);
  add(8, 'Signed in again after the signup day', 'person', signals.returning);
  add(8, 'GSTIN is on the shop', 'shop', signals.hasGst);
  add(12, `Added ${plural(signals.customers, 'customer')}`, 'shop', signals.customers > 0);
  add(12, `Added ${plural(signals.inventory, 'stock item')}`, 'shop', signals.inventory > 0);
  add(
    10,
    `Published ${plural(signals.catalogueProducts, 'catalogue item')}`,
    'shop',
    signals.catalogueProducts > 0
  );
  add(
    8,
    `Public catalogue has ${plural(signals.catalogueProductViews, 'product view')}`,
    'shop',
    signals.catalogueProductViews > 0
  );
  add(
    14,
    `Public catalogue captured ${plural(signals.catalogueLeads, 'buyer lead')}`,
    'shop',
    signals.catalogueLeads > 0
  );
  add(
    6,
    `Buyers clicked WhatsApp on the catalogue ${plural(signals.catalogueWhatsappClicks, 'time')}`,
    'shop',
    signals.catalogueWhatsappClicks > 0
  );
  add(12, 'Shop WhatsApp is connected', 'shop', signals.whatsappConnected);
  add(
    6,
    `Shop sent ${plural(signals.whatsappOutbound, 'WhatsApp message')} to customers`,
    'shop',
    signals.whatsappOutbound > 0
  );
  add(8, `Used AI ${plural(signals.aiEvents, 'time')}`, 'shop', signals.aiEvents > 0);
  add(8, 'Used a scheme, girvi, or khata', 'shop', signals.schemes + signals.loans + signals.khata > 0);
  add(
    6,
    `Opened ${plural(signals.supportTickets, 'support ticket')}`,
    'shop',
    signals.supportTickets > 0
  );

  const raw = reasons.reduce((sum, reason) => sum + reason.points, 0);
  const meaningful =
    signals.customers > 0 ||
    signals.inventory > 0 ||
    signals.catalogueProducts > 0 ||
    signals.catalogueLeads > 0 ||
    signals.catalogueProductViews > 0 ||
    signals.catalogueWhatsappClicks > 0 ||
    signals.whatsappConnected ||
    signals.aiEvents > 0 ||
    signals.schemes + signals.loans + signals.khata > 0 ||
    signals.supportTickets > 0;

  return {
    score: Math.min(100, raw),
    reasons,
    highIntent: !converted && signals.roleActive && raw >= HIGH_INTENT_SCORE && meaningful,
    converted,
    conversionReason,
    band: raw >= HIGH_INTENT_SCORE ? 'high' : raw >= 15 ? 'medium' : 'low',
  };
}

export function nextLeadAction(input: {
  hasShop: boolean;
  hasPhone: boolean;
  roleActive: boolean;
  suspended: boolean;
  highIntent: boolean;
  converted: boolean;
  cohort: PrimaryCohort | null;
  pipeline: PipelineStatus;
  followUpAt: string | null;
  whatsappConnected: boolean;
  ageDays: number;
  now?: number;
}): NextAction {
  const now = input.now ?? Date.now();
  const open = input.pipeline === 'unreviewed' || input.pipeline === 'new';
  const followUpTime = input.followUpAt ? new Date(input.followUpAt).getTime() : NaN;
  const followUpDue = Number.isFinite(followUpTime) && followUpTime <= now;
  const followUpLater = Number.isFinite(followUpTime) && followUpTime > now;

  if (input.hasShop && !input.roleActive) {
    return { label: 'Shop access is disabled', tone: 'default' };
  }
  if (input.suspended) return { label: 'Shop is suspended', tone: 'default' };
  if (!input.hasShop) return { label: 'No shop yet', tone: 'attention' };
  const closed =
    input.pipeline === 'lost' ||
    input.pipeline === 'not_interested' ||
    (PIPELINE_CLOSED_STATUSES as readonly string[]).includes(input.pipeline);

  if (followUpDue && !closed) {
    return {
      label: input.hasPhone ? 'Follow-up is due — send WhatsApp' : 'Follow-up is due — shop has no WhatsApp number',
      tone: 'attention',
    };
  }
  if (!input.hasPhone && !input.converted && (input.highIntent || open)) {
    return { label: 'No shop phone on file', tone: 'attention' };
  }
  if (input.highIntent && open) {
    return { label: 'High intent and not contacted — send a message', tone: 'attention' };
  }
  if (input.cohort === 'stalled_billing' && open) {
    return { label: 'Stock or customers exist — invite the first invoice', tone: 'attention' };
  }
  if (input.cohort === 'never_started' && input.ageDays >= 1 && open) {
    return { label: 'Signed up and has not started — send a welcome', tone: 'attention' };
  }
  if (input.cohort === 'quiet' && !closed) {
    return { label: 'Billed before, quiet for 14+ days — re-engage', tone: 'attention' };
  }
  if (input.converted && !input.whatsappConnected && !closed) {
    return { label: 'They bill, and shop WhatsApp is off', tone: 'default' };
  }
  if (followUpLater && !closed) {
    return { label: 'Follow-up is scheduled', tone: 'default' };
  }
  if (input.pipeline === 'callback') {
    return { label: 'They asked for a call back', tone: 'attention' };
  }
  if (input.pipeline === 'no_answer') {
    return { label: 'No answer last time — try again', tone: 'attention' };
  }
  if (input.pipeline === 'not_interested') return { label: 'Marked not interested', tone: 'default' };
  if (input.pipeline === 'lost') return { label: 'Marked lost', tone: 'default' };
  return { label: 'No follow-up needed today', tone: 'default' };
}

export function joinSource(input: {
  hasShop: boolean;
  role: string | null;
  shopCreatedBy: string | null;
  userId: string;
  shopCreatedAt: string | null;
  roleCreatedAt: string | null;
}): JoinSource {
  if (!input.hasShop) return 'no_shop';
  if (input.shopCreatedBy && input.shopCreatedBy === input.userId) return 'created_shop';
  if (input.role === 'owner' && input.shopCreatedAt && input.roleCreatedAt) {
    const delta = Math.abs(
      new Date(input.shopCreatedAt).getTime() - new Date(input.roleCreatedAt).getTime()
    );
    if (delta < 5 * 60 * 1000) return 'created_shop';
  }
  return 'added';
}

export function istYmd(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
}

export function istDayStart(now = new Date()): Date {
  return new Date(`${istYmd(now)}T00:00:00+05:30`);
}

export function withinRolling(iso: string | null | undefined, days: number, now = Date.now()): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return false;
  return now - time >= 0 && now - time <= days * 86_400_000;
}

export function toDatetimeLocalIst(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
  const year = read('year');
  const month = read('month');
  const day = read('day');
  const hour = read('hour');
  const minute = read('minute');
  if (!year || !month || !day || !hour || !minute) return '';
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function fromDatetimeLocalIst(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    throw new Error('Pick a valid follow-up date');
  }
  const date = new Date(`${trimmed}:00+05:30`);
  if (Number.isNaN(date.getTime())) throw new Error('Pick a valid follow-up date');
  return date.toISOString();
}
