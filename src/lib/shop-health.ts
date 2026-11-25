/** Jewellery-shop activation: first invoice is the aha. No session replay. */

export const FREE_CAP = {
  customers: 100,
  inventory: 100,
  loans: 5,
  schemes: 1,
} as const;

export const UPGRADE_RATIO = 0.8;
export const QUIET_DAYS = 14;
export const HELP_DAYS = 7;

export type PrimaryCohort =
  | 'never_started'
  | 'stalled_billing'
  | 'activated'
  | 'quiet';

export type ShopHealthCounts = {
  invoices: number;
  customers: number;
  inventory: number;
  staff: number;
  schemes: number;
  loans: number;
  khata: number;
  whatsappConnected: boolean;
  hasGst: boolean;
  planId: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  isSuspended: boolean;
};

export type HealthStep = {
  id: string;
  name: string;
  description: string;
  isCompleted: boolean;
  order: number;
};

export function daysSince(iso: string, now = Date.now()): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return (now - t) / 86_400_000;
}

export function isFreePlan(planId: string | null | undefined): boolean {
  return !planId || planId === 'free';
}

export function isUpgradeReady(c: ShopHealthCounts): boolean {
  if (!isFreePlan(c.planId) || c.isSuspended) return false;
  return (
    c.customers >= FREE_CAP.customers * UPGRADE_RATIO ||
    c.inventory >= FREE_CAP.inventory * UPGRADE_RATIO ||
    c.loans >= FREE_CAP.loans * UPGRADE_RATIO ||
    c.schemes >= FREE_CAP.schemes
  );
}

export function primaryCohort(c: ShopHealthCounts, now = Date.now()): PrimaryCohort {
  if (c.invoices === 0 && c.customers === 0 && c.inventory === 0) {
    return 'never_started';
  }
  if (c.invoices === 0) return 'stalled_billing';
  const quietFrom = c.lastActivityAt || c.createdAt;
  if (daysSince(quietFrom, now) > QUIET_DAYS) return 'quiet';
  return 'activated';
}

export function activationSteps(c: ShopHealthCounts): HealthStep[] {
  return [
    {
      id: 'shop_setup',
      name: 'Shop created',
      description: 'Workspace exists',
      isCompleted: true,
      order: 1,
    },
    {
      id: 'gst_added',
      name: 'GST added',
      description: 'GSTIN on the shop',
      isCompleted: c.hasGst,
      order: 2,
    },
    {
      id: 'first_customer',
      name: 'First customer',
      description: 'At least one customer',
      isCompleted: c.customers > 0,
      order: 3,
    },
    {
      id: 'first_product',
      name: 'First inventory item',
      description: 'At least one stock row',
      isCompleted: c.inventory > 0,
      order: 4,
    },
    {
      id: 'first_invoice',
      name: 'First invoice',
      description: 'Billed once — activated',
      isCompleted: c.invoices > 0,
      order: 5,
    },
    {
      id: 'whatsapp_connected',
      name: 'WhatsApp connected',
      description: 'Can share bills from the counter',
      isCompleted: c.whatsappConnected,
      order: 6,
    },
    {
      id: 'money_product',
      name: 'Scheme, girvi, or khata',
      description: 'Used a jewellery money product',
      isCompleted: c.schemes + c.loans + c.khata > 0,
      order: 7,
    },
  ];
}

/** Progress over GST → customer → stock → invoice → WhatsApp. Invoice is the activation line. */
export function coreProgress(steps: HealthStep[]): number {
  const core = steps.filter((s) =>
    ['gst_added', 'first_customer', 'first_product', 'first_invoice', 'whatsapp_connected'].includes(
      s.id
    )
  );
  if (core.length === 0) return 0;
  return (core.filter((s) => s.isCompleted).length / core.length) * 100;
}

export function healthScore(c: ShopHealthCounts, now = Date.now()): number {
  if (c.isSuspended) return 0;
  const cohort = primaryCohort(c, now);
  if (cohort === 'never_started') return daysSince(c.createdAt, now) < 3 ? 25 : 10;
  if (cohort === 'stalled_billing') return 35;
  if (cohort === 'quiet') return 50;
  let score = 70;
  score += Math.min(15, c.invoices);
  if (c.whatsappConnected) score += 10;
  if (c.schemes + c.loans + c.khata > 0) score += 5;
  return Math.min(100, score);
}

export function classifyShopHealth(c: ShopHealthCounts, now = Date.now()) {
  const steps = activationSteps(c);
  const overallProgress = coreProgress(steps);
  const primary = primaryCohort(c, now);
  const upgradeReady = isUpgradeReady(c);
  const ageDays = daysSince(c.createdAt, now);
  const needsAssistance =
    !c.isSuspended && c.invoices === 0 && ageDays > HELP_DAYS;

  const tags: string[] = [];
  if (upgradeReady) tags.push('upgrade_ready');
  if (c.invoices > 0 && !c.whatsappConnected) tags.push('whatsapp_off');
  if (c.whatsappConnected && c.invoices === 0) tags.push('whatsapp_idle');
  if (!c.hasGst) tags.push('gst_missing');

  return {
    primary,
    upgradeReady,
    needsAssistance,
    steps,
    overallProgress,
    score: healthScore(c, now),
    tags,
    activated: c.invoices > 0,
  };
}
