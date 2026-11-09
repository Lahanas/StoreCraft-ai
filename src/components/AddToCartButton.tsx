"use client";

import { useCart } from "@/lib/cart-store";

type Props = {
  product: { _id: string; slug: string; name: string; price: number; stock: number; image: string };
  className?: string;
};

export function AddToCartButton({ product, className = "" }: Props) {
  const addItem = useCart((s) => s.addItem);
  const open = useCart((s) => s.open);
  const inCart = useCart((s) => s.items.find((i) => i.productId === product._id)?.quantity ?? 0);
  const soldOut = product.stock <= 0;
  const maxed = inCart >= Math.min(10, product.stock);

  return (
    <button
      type="button"
      disabled={soldOut || maxed}
      onClick={() => {
        addItem({
          productId: product._id,
          slug: product.slug,
          name: product.name,
          price: product.price,
          image: product.image,
          stock: product.stock,
        });
        open();
      }}
      className={`rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-700 ${className}`}
    >
      {soldOut ? "Sold out" : maxed ? "Max in cart" : inCart ? `Add another (${inCart} in cart)` : "Add to cart"}
    </button>
  );
}
