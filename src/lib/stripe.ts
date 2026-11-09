import "server-only";
import Stripe from "stripe";

let _stripe: Stripe | null = null;

/** Lazily created so `next build` works without STRIPE_SECRET_KEY set. */
export function getStripe() {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key, { appInfo: { name: "StoreCraft" } });
  }
  return _stripe;
}
