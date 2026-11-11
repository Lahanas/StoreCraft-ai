import { auth, currentUser } from "@clerk/nextjs/server";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDiscountFresh, getProductsByIdsFresh } from "@/lib/catalog";
import { buildOrderLines, MAX_PER_LINE } from "@/lib/checkout";
import { toCents } from "@/lib/money";
import { cartTotals, normalizeCode } from "@/lib/pricing";
import { getStripe } from "@/lib/stripe";
import { productImage } from "@/sanity/image";

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantKey: z.string().min(1),
        quantity: z.number().int().min(1).max(MAX_PER_LINE),
      }),
    )
    .min(1)
    .max(50),
  discountCode: z.string().max(40).optional(),
});

/**
 * Creates a Stripe Checkout Session from the cart. The client only sends ids, variant keys,
 * quantities and an optional discount code. Prices, stock and the discount are re-read from
 * Sanity here so none of them can be tampered with.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Please sign in to check out." }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid cart." }, { status: 400 });

  const ids = [...new Set(parsed.data.items.map((i) => i.productId))];
  const built = buildOrderLines(parsed.data.items, await getProductsByIdsFresh(ids));
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: built.status });
  const { lines } = built;

  const code = parsed.data.discountCode ? normalizeCode(parsed.data.discountCode) : "";
  const rule = code ? await getDiscountFresh(code) : null;
  const totals = cartTotals(lines, rule);
  if (code && !totals.discount?.ok) {
    const reason = totals.discount && !totals.discount.ok ? totals.discount.reason : "This code isn't valid.";
    return NextResponse.json({ error: `${code}: ${reason}`, discountInvalid: true }, { status: 422 });
  }

  const user = await currentUser();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;

  // Same user + same cart + same code within a 5-minute window gives the same idempotency key,
  // so a double-click or network retry returns the existing session instead of creating two.
  const fingerprint = lines
    .map((l) => `${l.productId}:${l.variantKey}:${l.quantity}`)
    .sort()
    .join(",");
  const idempotencyKey = createHash("sha256")
    .update(`${userId}|${fingerprint}|${code}|${Math.floor(Date.now() / 300_000)}`)
    .digest("hex");

  try {
    const stripe = getStripe();

    // The discount is computed by our own rules (src/lib/pricing.ts), then applied as a one-off
    // Stripe coupon for exactly that amount, so Stripe's total always matches ours.
    let discounts: { coupon: string }[] | undefined;
    if (totals.discountAmount > 0) {
      const coupon = await stripe.coupons.create(
        {
          amount_off: toCents(totals.discountAmount),
          currency: "usd",
          duration: "once",
          max_redemptions: 1,
          name: code,
          metadata: { discountCode: code },
        },
        { idempotencyKey: `${idempotencyKey}-coupon` },
      );
      discounts = [{ coupon: coupon.id }];
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: user?.primaryEmailAddress?.emailAddress,
        client_reference_id: userId,
        metadata: { clerkUserId: userId, discountCode: totals.discountAmount > 0 ? code : "" },
        line_items: lines.map((l) => {
          const image = productImage(l.product, 400);
          return {
            quantity: l.quantity,
            price_data: {
              currency: "usd",
              unit_amount: toCents(l.price),
              product_data: {
                name: l.variantTitle ? `${l.name} (${l.variantTitle})` : l.name,
                images: image.startsWith("https://") ? [image] : [],
                metadata: {
                  productId: l.productId,
                  variantKey: l.variantKey,
                  variantTitle: l.variantTitle ?? "",
                  name: l.name,
                },
              },
            },
          };
        }),
        discounts,
        shipping_address_collection: { allowed_countries: ["US", "CA", "GB", "FR", "DE", "MA"] },
        success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/products`,
      },
      { idempotencyKey },
    );
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout] Stripe error", err);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
  }
}
