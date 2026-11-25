export type BillingKind = 'payment' | 'failed' | 'abandoned' | 'canceled' | 'lifecycle';

export function classifyBillingEvent(eventType: string): BillingKind {
  if (/payment\.(captured|authorized)|invoice\.paid|charged|captured/i.test(eventType)) {
    return 'payment';
  }
  if (/failed|halted|unpaid|past_due/i.test(eventType)) return 'failed';
  if (/abandoned/i.test(eventType)) return 'abandoned';
  if (/canceled|cancelled/i.test(eventType)) return 'canceled';
  return 'lifecycle';
}

export function amountFromPayload(payload: Record<string, unknown> | null): number | null {
  if (!payload) return null;
  const nested = payload.payload as Record<string, unknown> | undefined;
  const payment =
    (payload.payment as Record<string, unknown> | undefined) ||
    (nested?.payment as Record<string, unknown> | undefined);
  const entity =
    (payment?.entity as Record<string, unknown> | undefined) ||
    (nested?.entity as Record<string, unknown> | undefined) ||
    payment;
  const raw = entity?.amount ?? payload.amount ?? nested?.amount;
  if (raw == null || raw === '') return null;
  const amountPaise = Number(raw);
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) return null;
  return amountPaise >= 100 ? amountPaise / 100 : amountPaise;
}
