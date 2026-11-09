"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { cartCount, useCart } from "@/lib/cart-store";

export function Header() {
  const count = useCart((s) => cartCount(s.items));
  const open = useCart((s) => s.open);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Store<span className="text-indigo-600">Craft</span>
        </Link>
        <nav className="hidden gap-5 text-sm text-zinc-600 sm:flex dark:text-zinc-400">
          <Link href="/products" className="hover:text-zinc-900 dark:hover:text-white">
            Shop
          </Link>
          <Show when="signed-in">
            <Link href="/orders" className="hover:text-zinc-900 dark:hover:text-white">
              Orders
            </Link>
          </Show>
        </nav>
        <form action="/products" className="ml-auto hidden max-w-xs flex-1 md:block">
          <input
            name="q"
            placeholder="Search products…"
            className="w-full rounded-full border border-zinc-300 bg-transparent px-4 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
          />
        </form>
        <div className="ml-auto flex items-center gap-3 md:ml-0">
          <button
            onClick={open}
            className="relative rounded-full px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label={`Open cart, ${count} items`}
          >
            Cart
            {count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1 text-xs text-white">
                {count}
              </span>
            )}
          </button>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900">
                Sign in
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </div>
    </header>
  );
}
