"use client";

import { Show, SignInButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cartSubtotal, useCart } from "@/lib/cart-store";
import { formatPrice } from "@/lib/money";

export function CartDrawer() {
  const { items, isOpen, close, setQuantity, removeItem } = useCart();
  const subtotal = cartSubtotal(items);

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
              <li key={item.productId} className="flex gap-4 py-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                  <Image src={item.image} alt={item.name} fill sizes="80px" className="object-cover" />
                </div>
                <div className="flex flex-1 flex-col">
                  <Link href={`/products/${item.slug}`} onClick={close} className="line-clamp-2 text-sm font-medium">
                    {item.name}
                  </Link>
                  <span className="text-sm text-zinc-500">{formatPrice(item.price)}</span>
                  <div className="mt-auto flex items-center gap-2">
                    <QtyButton onClick={() => setQuantity(item.productId, item.quantity - 1)} label="Decrease">
                      −
                    </QtyButton>
                    <span className="w-6 text-center text-sm tabular-nums">{item.quantity}</span>
                    <QtyButton
                      onClick={() => setQuantity(item.productId, item.quantity + 1)}
                      label="Increase"
                      disabled={item.quantity >= Math.min(10, item.stock)}
                    >
                      +
                    </QtyButton>
                    <button
                      onClick={() => removeItem(item.productId)}
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
            <div className="flex justify-between font-medium">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
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
