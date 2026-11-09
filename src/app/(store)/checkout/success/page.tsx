import Link from "next/link";
import { ClearCartOnMount } from "@/components/ClearCartOnMount";
import { formatPrice } from "@/lib/money";
import { getStripe } from "@/lib/stripe";

export const metadata = { title: "Order confirmed" };

export default async function CheckoutSuccessPage({ searchParams }: PageProps<"/checkout/success">) {
  const { session_id } = await searchParams;
  let total: number | null = null;
  let email: string | null = null;

  if (typeof session_id === "string" && session_id.startsWith("cs_")) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(session_id);
      total = (session.amount_total ?? 0) / 100;
      email = session.customer_details?.email ?? null;
    } catch {
      // Show the generic confirmation if the session can't be loaded.
    }
  }

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <ClearCartOnMount />
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700">
        ✓
      </div>
      <h1 className="text-3xl font-bold">Thank you for your order!</h1>
      <p className="mt-3 text-zinc-500">
        {total != null && <>We received your payment of {formatPrice(total)}. </>}
        {email ? <>A receipt is on its way to {email}.</> : "A receipt is on its way to your inbox."}
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/orders" className="rounded-full bg-zinc-900 px-5 py-2.5 text-white dark:bg-white dark:text-zinc-900">
          View orders
        </Link>
        <Link href="/products" className="rounded-full border border-zinc-300 px-5 py-2.5 dark:border-zinc-700">
          Keep shopping
        </Link>
      </div>
    </div>
  );
}
