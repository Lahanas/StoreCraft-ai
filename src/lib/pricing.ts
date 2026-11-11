/**
 * Cart pricing and discount rules. Pure functions with no I/O, shared by the cart drawer
 * (to show the total) and the checkout API (which recomputes it from fresh data).
 */

export type DiscountRule = {
  code: string;
  description?: string;
  type: "percentage" | "fixed";
  /** Percent (e.g. 15 for 15%) or a fixed amount in USD. */
  value: number;
  /** Minimum cart subtotal in USD before the code applies. */
  minSubtotal?: number;
  active: boolean;
  startsAt?: string;
  endsAt?: string;
  usageLimit?: number;
  timesUsed?: number;
};

export type DiscountResult = { ok: true; amount: number } | { ok: false; reason: string };

export const roundMoney = (n: number) => Math.round(n * 100) / 100;

export const normalizeCode = (code: string) => code.trim().toUpperCase();

export function subtotalOf(lines: { price: number; quantity: number }[]) {
  return roundMoney(lines.reduce((sum, l) => sum + l.price * l.quantity, 0));
}

/** Checks whether a discount applies to a subtotal right now and how much it takes off. */
export function evaluateDiscount(
  rule: DiscountRule | null | undefined,
  subtotal: number,
  now: Date = new Date(),
): DiscountResult {
  if (!rule || !rule.active) return { ok: false, reason: "This code isn't valid." };
  if (rule.startsAt && now < new Date(rule.startsAt)) {
    return { ok: false, reason: "This code isn't active yet." };
  }
  if (rule.endsAt && now > new Date(rule.endsAt)) {
    return { ok: false, reason: "This code has expired." };
  }
  if (rule.usageLimit != null && (rule.timesUsed ?? 0) >= rule.usageLimit) {
    return { ok: false, reason: "This code has reached its usage limit." };
  }
  if (rule.minSubtotal && subtotal < rule.minSubtotal) {
    return { ok: false, reason: `Spend $${rule.minSubtotal.toFixed(2)} or more to use this code.` };
  }
  if (!(rule.value > 0)) return { ok: false, reason: "This code isn't valid." };

  const raw = rule.type === "percentage" ? subtotal * (Math.min(rule.value, 100) / 100) : rule.value;
  // Never take off more than the cart is worth.
  return { ok: true, amount: roundMoney(Math.min(raw, subtotal)) };
}

export function cartTotals(
  lines: { price: number; quantity: number }[],
  rule?: DiscountRule | null,
  now?: Date,
) {
  const subtotal = subtotalOf(lines);
  const discount = rule ? evaluateDiscount(rule, subtotal, now) : null;
  const discountAmount = discount?.ok ? discount.amount : 0;
  return { subtotal, discount, discountAmount, total: roundMoney(subtotal - discountAmount) };
}
