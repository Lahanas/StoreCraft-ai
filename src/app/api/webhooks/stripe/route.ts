import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { fulfillOrder, type PaidLineItem, type PaidSession } from "@/lib/fulfillment";
import { sanityOrderStore } from "@/lib/order-store";
import { getStripe } from "@/lib/stripe";

/**
 * Stripe webhook. Verifies the signature, then records each paid Checkout Session as exactly
 * one order. See src/lib/fulfillment.ts for how repeated deliveries are made harmless.
 */
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    // Must be the raw body: re-serialised JSON would break the signature.
    event = stripe.webhooks.constructEvent(await req.text(), signature, secret);
  } catch (err) {
    console.error("[stripe webhook] signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        if (session.payment_status === "paid") {
          const result = await fulfillOrder(
            sanityOrderStore,
            toPaidSession(session),
            () => loadLineItems(stripe, session.id),
            event.id,
          );
          return NextResponse.json({ received: true, result });
        }
        break;
      }
      default:
        // Unhandled event types are acknowledged so Stripe stops retrying them.
        break;
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    // A 5xx makes Stripe retry later, which is safe because fulfilment is idempotent.
    console.error(`[stripe webhook] failed to process ${event.type} ${event.id}`, err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

function toPaidSession(session: Stripe.Checkout.Session): PaidSession {
  return {
    id: session.id,
    paymentIntentId:
      typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
    clerkUserId: session.metadata?.clerkUserId ?? session.client_reference_id ?? "",
    email: session.customer_details?.email ?? session.customer_email ?? "",
    amountSubtotal: session.amount_subtotal ?? 0,
    amountDiscount: session.total_details?.amount_discount ?? 0,
    amountTotal: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
    created: session.created,
    discountCode: session.metadata?.discountCode || undefined,
  };
}

async function loadLineItems(stripe: Stripe, sessionId: string): Promise<PaidLineItem[]> {
  const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
    limit: 100,
    expand: ["data.price.product"],
  });
  return lineItems.data.map((li) => {
    const product = li.price?.product as Stripe.Product | undefined;
    const meta = product?.metadata ?? {};
    return {
      productId: meta.productId ?? "",
      variantKey: meta.variantKey ?? "",
      variantTitle: meta.variantTitle || undefined,
      name: meta.name || product?.name || li.description || "Item",
      quantity: li.quantity ?? 1,
      unitAmount: li.price?.unit_amount ?? 0,
    };
  });
}
