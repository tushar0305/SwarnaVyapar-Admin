/** Monthly list prices — keep in sync with main app plan-catalog. */
export const PLAN_PRICE_MONTHLY: Record<string, number> = {
  free: 0,
  pro: 499,
  business: 999,
  enterprise: 0,
};

export function planMonthlyPrice(planId: string | null | undefined): number {
  if (!planId) return 0;
  return PLAN_PRICE_MONTHLY[planId] ?? 0;
}
