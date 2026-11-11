import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import Link from "next/link";
import { formatPrice } from "@/lib/money";
import { ORDERS_BY_USER_QUERY } from "@/sanity/queries";
import type { Order } from "@/sanity/types";
import { writeClient } from "@/sanity/write-client";

export const metadata: Metadata = { title: "Your orders" };

export default async function OrdersPage() {
  // The proxy already protects this route; this is defence in depth.
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();

  // Orders live in Sanity and may be in a private dataset, so read with the server token, uncached.
  const orders = await writeClient.fetch<Order[]>(ORDERS_BY_USER_QUERY, { userId }, { cache: "no-store" });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Your orders</h1>
      {orders.length === 0 ? (
        <p className="text-zinc-500">
          No orders yet. <Link href="/products" className="underline">Start shopping</Link>.
        </p>
      ) : (
        orders.map((o) => (
          <div key={o._id} className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">Order #{o.orderNumber}</p>
                <p className="text-sm text-zinc-500">{new Date(o.createdAt).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatPrice(o.total, o.currency)}</p>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium capitalize text-emerald-800">
                  {o.status}
                </span>
              </div>
            </div>
            <ul className="mt-4 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
              {o.items.map((i) => (
                <li key={i._key} className="flex justify-between">
                  <span>
                    {i.quantity} × {i.name}
                    {i.variantTitle && <span className="text-zinc-400"> ({i.variantTitle})</span>}
                  </span>
                  <span>{formatPrice(i.unitPrice * i.quantity, o.currency)}</span>
                </li>
              ))}
              {o.discountCode && o.discountAmount ? (
                <li className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <span>Discount ({o.discountCode})</span>
                  <span>−{formatPrice(o.discountAmount, o.currency)}</span>
                </li>
              ) : null}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
