import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { writeClient } from "@/sanity/write-client";

/**
 * Stripe webhook.
 *
 * Idempotency: Stripe delivers events at least once, and may retry or send
 * `checkout.session.completed` and `checkout.session.async_payment_succeeded` for the same
 * session. Each paid session maps to exactly one order document whose _id is derived from the
 * session id. The order is written with `create` (which fails if the id exists) in the same
 * atomic Sanity transaction as the stock decrements, so a duplicate delivery fails as a whole
 * with 409 and nothing is applied twice. We then acknowledge it with 200.
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
          const result = await fulfillOrder(stripe, session, event.id);
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

async function fulfillOrder(stripe: Stripe, session: Stripe.Checkout.Session, eventId: string) {
  const orderId = `order-${session.id}`;

  // Cheap early exit for the common retry case (the transaction below is the real guard).
  const existing = await writeClient.fetch<string | null>(`*[_id == $id][0]._id`, { id: orderId });
  if (existing) return "duplicate";

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 100,
    expand: ["data.price.product"],
  });

  const items = lineItems.data.map((li, i) => {
    const product = li.price?.product as Stripe.Product | undefined;
    return {
      _key: `item-${i}`,
      productId: product?.metadata?.productId ?? "",
      name: li.description ?? product?.name ?? "Item",
      quantity: li.quantity ?? 1,
      unitPrice: (li.price?.unit_amount ?? 0) / 100,
    };
  });

  const tx = writeClient.transaction().create({
    _id: orderId,
    _type: "order",
    orderNumber: session.id.slice(-10).toUpperCase(),
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId:
      typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
    stripeEventId: eventId,
    clerkUserId: session.metadata?.clerkUserId ?? session.client_reference_id ?? "",
    email: session.customer_details?.email ?? session.customer_email ?? "",
    status: "paid",
    total: (session.amount_total ?? 0) / 100,
    currency: (session.currency ?? "usd").toUpperCase(),
    createdAt: new Date((session.created ?? Date.now() / 1000) * 1000).toISOString(),
    items,
  });

  for (const item of items) {
    if (item.productId) {
      tx.patch(item.productId, (p) => p.setIfMissing({ stock: 0 }).dec({ stock: item.quantity }));
    }
  }

  try {
    await tx.commit();
    return "created";
  } catch (err) {
    if (isConflict(err)) return "duplicate"; // a concurrent delivery won the race
    throw err;
  }
}

function isConflict(err: unknown) {
  return typeof err === "object" && err !== null && "statusCode" in err && err.statusCode === 409;
}
