export function formatPrice(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

/** Convert major units (49.99) to Stripe minor units (4999) without float drift. */
export const toCents = (amount: number) => Math.round(amount * 100);
