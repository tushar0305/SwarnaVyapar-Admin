import type { ActivationRow } from '@/services/onboarding.service';

export type AgentPlayId =
  | 'never_started'
  | 'first_bill'
  | 'quiet'
  | 'whatsapp_off'
  | 'near_cap';

export type AgentPlay = {
  id: AgentPlayId;
  reason: string;
  question: string;
};

/** Cold outreach templates submitted in Meta (shop name only + Visit Website). */
export function templateForPlay(play: AgentPlayId): string {
  if (play === 'quiet') return 'sv_admin_quiet';
  if (play === 'whatsapp_off' || play === 'near_cap') return 'sv_admin_account';
  return 'sv_admin_setup';
}

const QUESTIONS: Record<AgentPlayId, string> = {
  never_started:
    'Was the hold-up GST, time, or the first bill? Reply with one of those.',
  first_bill:
    'You already have stock or a customer, and no bill yet. What is blocking the first invoice?',
  quiet:
    'It has been quiet since the last bill. Did the counter go quiet, or did billing get in the way? Reply quiet or stuck.',
  whatsapp_off:
    'You are billing. Connect WhatsApp in the app so the bill can leave the counter. Reply if you want the steps.',
  near_cap:
    'You are close to a free-plan limit. Do you need more room, or is the current cap enough?',
};

export function chooseAgentPlay(row: Pick<ActivationRow, 'primary' | 'tags' | 'upgradeReady' | 'counts'>): AgentPlay | null {
  if (row.counts.isSuspended) return null;
  if (row.primary === 'never_started') {
    return { id: 'never_started', reason: 'No customer, stock, or invoice yet.', question: QUESTIONS.never_started };
  }
  if (row.primary === 'stalled_billing') {
    return { id: 'first_bill', reason: 'Stock or customers exist, and nobody has billed.', question: QUESTIONS.first_bill };
  }
  if (row.primary === 'quiet') {
    return { id: 'quiet', reason: 'No shop activity for 14 days after billing.', question: QUESTIONS.quiet };
  }
  if (row.tags.includes('whatsapp_off')) {
    return { id: 'whatsapp_off', reason: 'They bill, and shop WhatsApp is not connected.', question: QUESTIONS.whatsapp_off };
  }
  if (row.upgradeReady) {
    return { id: 'near_cap', reason: 'A free-plan cap is at least 80% full.', question: QUESTIONS.near_cap };
  }
  return null;
}

export function sendGate(input: {
  sentAt: string[];
  silenceUntil?: string | null;
  repliedAfterLastSend?: boolean;
  now?: number;
}): 'ready' | 'recent' | 'capped' | 'silent' {
  const now = input.now ?? Date.now();
  if (input.silenceUntil) {
    const until = new Date(input.silenceUntil).getTime();
    if (Number.isFinite(until) && until > now) return 'silent';
  }
  const times = input.sentAt
    .map((iso) => new Date(iso).getTime())
    .filter((t) => Number.isFinite(t) && now - t < 14 * 86400000);
  if (!input.repliedAfterLastSend && times.some((t) => now - t < 4 * 86400000)) return 'recent';
  if (times.length >= 2 && !input.repliedAfterLastSend) return 'capped';
  return 'ready';
}

/** Two sends with no reply pauses the shop for 21 days. */
export function silenceAfterSend(unansweredBeforeSend: number, repliedAfterLastSend: boolean, now = Date.now()): {
  unanswered: number;
  silenceUntil: string | null;
} {
  const unanswered = repliedAfterLastSend ? 0 : unansweredBeforeSend + 1;
  if (unanswered >= 2) {
    return { unanswered, silenceUntil: new Date(now + 21 * 86400000).toISOString() };
  }
  return { unanswered, silenceUntil: null };
}

export function playMoved(
  play: AgentPlayId,
  before: { invoices: number; whatsapp: boolean; upgradeReady: boolean; quiet: boolean },
  after: { invoices: number; whatsapp: boolean; upgradeReady: boolean; quiet: boolean }
): boolean {
  if (play === 'never_started' || play === 'first_bill') return after.invoices > before.invoices;
  if (play === 'quiet') return !after.quiet;
  if (play === 'whatsapp_off') return after.whatsapp && !before.whatsapp;
  if (play === 'near_cap') return before.upgradeReady && !after.upgradeReady;
  return false;
}

export function messageForShop(play: AgentPlay, lastReply: string | null, repliedAfterLastSend: boolean): string {
  if (!repliedAfterLastSend || !lastReply) return play.question;
  const text = lastReply.toLowerCase();
  if (play.id === 'never_started' || play.id === 'first_bill') {
    if (text.includes('gst')) {
      return 'You said GST. Add the GSTIN in shop settings, then bill one customer you already saved. Reply if that screen is confusing.';
    }
    if (text.includes('time')) {
      return 'You said time. The short step is one bill for a customer already saved. Reply when you want a person to walk you through it.';
    }
    if (text.includes('bill') || text.includes('invoice')) {
      return 'You said the first bill is the hold-up. Open Billing and create one invoice. Reply with the field that stops you.';
    }
  }
  if (play.id === 'quiet') {
    if (text.includes('quiet')) {
      return 'You said the counter went quiet. Bill the next customer in SwarnaVyapar. Reply only if you want help.';
    }
    if (text.includes('stuck')) {
      return 'You said billing got in the way. Reply with the screen that stopped you, or reply call for a person.';
    }
  }
  const clipped = lastReply.trim().slice(0, 120);
  return `You replied: ${clipped}. ${play.question}`;
}
