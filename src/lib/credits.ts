/** Ledger atomic unit: 1000 millicredits = ₹1. Matches the shop app wallet. */
const MILLICREDITS_PER_INR = 1000;
/** ₹1 = 2 credits. */
const CREDITS_PER_INR = 2;

export function millicreditsToInr(mc: number): number {
  return Math.round(mc) / MILLICREDITS_PER_INR;
}

export function millicreditsToCredits(mc: number): number {
  const inr = millicreditsToInr(mc);
  return Math.round(inr * CREDITS_PER_INR * 1000) / 1000;
}
