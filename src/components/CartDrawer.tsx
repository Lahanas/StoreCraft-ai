"use client";

import { Show, SignInButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MAX_PER_LINE } from "@/lib/checkout";
import { useCart } from "@/lib/cart-store";
import { formatPrice } from "@/lib/money";
import { cartTotals } from "@/lib/pricing";

export function CartDrawer() {
  const { items, discount, isOpen, close, setQuantity, removeItem } = useCart();
  const totals = cartTotals(items, discount);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <div className={`fixed inset-0 z-50 ${isOpen ? "" : "pointer-events-none"}`} aria-hidden={!isOpen}>
      <div
        onClick={close}
        className={`absolute inset-0 bg-black/40 transition-opacity ${isOpen ? "opacity-100" : "opacity-0"}`}
      />
      <aside
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform dark:bg-zinc-950 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Shopping cart"
      >
        <header className="flex items-center justify-between border-b border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Your cart</h2>
          <button onClick={close} className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Close cart">
            ✕
          </button>
        </header>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-zinc-500">
            <p>Your cart is empty.</p>
            <Link href="/products" onClick={close} className="font-medium text-zinc-900 underline dark:text-white">
              Browse products
            </Link>
          </div>
        ) : (
          <ul className="flex-1 divide-y divide-zinc-200 overflow-y-auto px-5 dark:divide-zinc-800">
            {items.map((item) => (
              <li key={item.id} className="flex gap-4 py-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                  <Image src={item.image} alt={item.name} fill sizes="80px" className="object-cover" />
                </div>
                <div className="flex flex-1 flex-col">
                  <Link href={`/products/${item.slug}`} onClick={close} className="line-clamp-2 text-sm font-medium">
                    {item.name}
                  </Link>
                  <span className="text-sm text-zinc-500">
                    {item.variantTitle && <>{item.variantTitle} · </>}
                    {formatPrice(item.price)}
                  </span>
                  <div className="mt-auto flex items-center gap-2">
                    <QtyButton onClick={() => setQuantity(item.id, item.quantity - 1)} label="Decrease">
                      −
                    </QtyButton>
                    <span className="w-6 text-center text-sm tabular-nums">{item.quantity}</span>
                    <QtyButton
                      onClick={() => setQuantity(item.id, item.quantity + 1)}
                      label="Increase"
                      disabled={item.quantity >= Math.min(MAX_PER_LINE, item.stock)}
                    >
                      +
                    </QtyButton>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="ml-auto text-xs text-zinc-500 hover:text-rose-600"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {items.length > 0 && (
          <footer className="space-y-4 border-t border-zinc-200 p-5 dark:border-zinc-800">
            <DiscountField subtotal={totals.subtotal} />
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatPrice(totals.subtotal)}</dd>
              </div>
              {discount && totals.discount?.ok && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <dt>Discount ({discount.code})</dt>
                  <dd className="tabular-nums">−{formatPrice(totals.discountAmount)}</dd>
                </div>
              )}
              {discount && totals.discount && !totals.discount.ok && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {discount.code}: {totals.discount.reason}
                </p>
              )}
              <div className="flex justify-between pt-1 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatPrice(totals.total)}</dd>
              </div>
            </dl>
            <p className="text-xs text-zinc-500">Shipping and taxes calculated at checkout.</p>
            <Show when="signed-in">
              <CheckoutButton />
            </Show>
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button className="w-full rounded-full bg-zinc-900 py-3 font-medium text-white dark:bg-white dark:text-zinc-900">
                  Sign in to check out
                </button>
              </SignInButton>
            </Show>
          </footer>
        )}
      </aside>
    </div>
  );
}

function DiscountField({ subtotal }: { subtotal: number }) {
  const discount = useCart((s) => s.discount);
  const applyDiscount = useCart((s) => s.applyDiscount);
  const removeDiscount = useCart((s) => s.removeDiscount);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (discount) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
        <span>
          <span className="font-semibold">{discount.code}</span>
          {discount.description && <> · {discount.description}</>}
        </span>
        <button onClick={removeDiscount} className="text-xs underline">
          Remove
        </button>
      </div>
    );
  }

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "This code isn't valid.");
      applyDiscount(data.discount);
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "This code isn't valid.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={apply} className="space-y-1">
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Discount code"
          aria-label="Discount code"
          className="min-w-0 flex-1 rounded-full border border-zinc-300 bg-transparent px-4 py-2 text-sm uppercase outline-none focus:border-indigo-500 dark:border-zinc-700"
        />
        <button
          disabled={loading || !code.trim()}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-zinc-700"
        >
          {loading ? "…" : "Apply"}
        </button>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </form>
  );
}

function QtyButton({
  children,
  onClick,
  label,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-300 text-sm disabled:opacity-40 dark:border-zinc-700"
    >
      {children}
    </button>
  );
}

export function CheckoutButton() {
  const items = useCart((s) => s.items);
  const discount = useCart((s) => s.discount);
  const removeDiscount = useCart((s) => s.removeDiscount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    setLoading(true);
    setError(null);
    try {
      const totals = cartTotals(items, discount);
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, variantKey: i.variantKey, quantity: i.quantity })),
          // Only send a code that currently applies, so a code below its minimum doesn't block checkout.
          discountCode: discount && totals.discount?.ok ? discount.code : undefined,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string; discountInvalid?: boolean };
      if (data.discountInvalid) removeDiscount();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Checkout failed");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={checkout}
        disabled={loading || items.length === 0}
        className="w-full rounded-full bg-zinc-900 py-3 font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        {loading ? "Redirecting to Stripe…" : "Checkout"}
      </button>
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
