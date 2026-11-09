import { auth, currentUser } from "@clerk/nextjs/server";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getProductsByIdsFresh } from "@/lib/catalog";
import { toCents } from "@/lib/money";
import { getStripe } from "@/lib/stripe";
import { productImage } from "@/sanity/image";

const bodySchema = z.object({
  items: z
    .array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(10) }))
    .min(1)
    .max(50),
});

/**
 * Creates a Stripe Checkout Session from the cart. The client only sends product ids and
 * quantities: names, prices and stock are re-read from Sanity here so they can't be tampered with.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Please sign in to check out." }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid cart." }, { status: 400 });

  // Merge duplicate lines defensively.
  const qty = new Map<string, number>();
  for (const { productId, quantity } of parsed.data.items) {
    qty.set(productId, Math.min(10, (qty.get(productId) ?? 0) + quantity));
  }

  const products = await getProductsByIdsFresh([...qty.keys()]);
  const byId = new Map(products.map((p) => [p._id, p]));

  for (const [id, quantity] of qty) {
    const p = byId.get(id);
    if (!p) return NextResponse.json({ error: "A product in your cart no longer exists." }, { status: 409 });
    if (p.stock < quantity) {
      return NextResponse.json(
        { error: `Only ${p.stock} of “${p.name}” left in stock. Please update your cart.` },
        { status: 409 },
      );
    }
  }

  const user = await currentUser();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;

  // Same user + same cart within a 5-minute window → same idempotency key, so a
  // double-click or network retry returns the existing session instead of creating two.
  const cartFingerprint = [...qty.entries()].sort().map(([id, q]) => `${id}:${q}`).join(",");
  const idempotencyKey = createHash("sha256")
    .update(`${userId}|${cartFingerprint}|${Math.floor(Date.now() / 300_000)}`)
    .digest("hex");

  try {
    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        customer_email: user?.primaryEmailAddress?.emailAddress,
        client_reference_id: userId,
        metadata: { clerkUserId: userId },
        line_items: [...qty.entries()].map(([id, quantity]) => {
          const p = byId.get(id)!;
          return {
            quantity,
            price_data: {
              currency: "usd",
              unit_amount: toCents(p.price),
              product_data: {
                name: p.name,
                images: [productImage(p, 400)],
                metadata: { productId: p._id },
              },
            },
          };
        }),
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
