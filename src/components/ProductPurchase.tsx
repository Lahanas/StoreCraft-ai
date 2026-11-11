"use client";

import { useState } from "react";
import { lineId, MAX_PER_LINE } from "@/lib/checkout";
import { useCart } from "@/lib/cart-store";
import { formatPrice } from "@/lib/money";
import type { Variant } from "@/sanity/types";

type Props = {
  product: {
    _id: string;
    slug: string;
    name: string;
    image: string;
    compareAtPrice?: number;
    optionName?: string;
    variants: Variant[];
  };
};

/** Price, option picker, stock status and add-to-cart for one product. */
export function ProductPurchase({ product }: Props) {
  const { variants } = product;
  const hasOptions = variants.length > 1;
  const [selectedKey, setSelectedKey] = useState(
    () => (variants.find((v) => v.stock > 0) ?? variants[0])?.key,
  );
  const variant = variants.find((v) => v.key === selectedKey);

  const addItem = useCart((s) => s.addItem);
  const open = useCart((s) => s.open);
  const inCart = useCart(
    (s) => s.items.find((i) => variant && i.id === lineId(product._id, variant.key))?.quantity ?? 0,
  );

  if (!variant) return <p className="text-sm text-zinc-500">Not available.</p>;

  const soldOut = variant.stock <= 0;
  const maxed = inCart >= Math.min(MAX_PER_LINE, variant.stock);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-semibold">{formatPrice(variant.price)}</span>
        {product.compareAtPrice && product.compareAtPrice > variant.price && (
          <span className="text-lg text-zinc-400 line-through">{formatPrice(product.compareAtPrice)}</span>
        )}
      </div>

      {hasOptions && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">
            {product.optionName ?? "Option"}: <span className="text-zinc-500">{variant.title}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setSelectedKey(v.key)}
                aria-pressed={v.key === variant.key}
                className={`min-w-12 rounded-full border px-4 py-2 text-sm transition ${
                  v.key === variant.key
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                    : "border-zinc-300 hover:border-zinc-500 dark:border-zinc-700"
                } ${v.stock <= 0 ? "text-zinc-400 line-through" : ""}`}
              >
                {v.title}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <p className={`text-sm ${variant.stock > 5 ? "text-emerald-600" : "text-amber-600"}`}>
        {soldOut ? "Out of stock" : variant.stock <= 5 ? `Only ${variant.stock} left` : "In stock"}
        {variant.sku && <span className="ml-2 text-zinc-400">SKU {variant.sku}</span>}
      </p>

      <button
        type="button"
        disabled={soldOut || maxed}
        onClick={() => {
          addItem({
            productId: product._id,
            variantKey: variant.key,
            variantTitle: hasOptions ? variant.title : undefined,
            slug: product.slug,
            name: product.name,
            price: variant.price,
            image: product.image,
            stock: variant.stock,
          });
          open();
        }}
        className="self-start rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-700"
      >
        {soldOut ? "Sold out" : maxed ? "Max in cart" : inCart ? `Add another (${inCart} in cart)` : "Add to cart"}
      </button>
    </div>
  );
}
