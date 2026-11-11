import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/money";
import { productImage } from "@/sanity/image";
import type { Product } from "@/sanity/types";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="relative aspect-square overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        <Image
          src={productImage(product, 600)}
          alt={product.name}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover transition duration-300 group-hover:scale-105"
        />
        {product.compareAtPrice && product.compareAtPrice > product.price && (
          <span className="absolute left-3 top-3 rounded-full bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white">
            Sale
          </span>
        )}
        {product.stock <= 0 && (
          <span className="absolute right-3 top-3 rounded-full bg-zinc-900/80 px-2.5 py-1 text-xs font-semibold text-white">
            Sold out
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-xs uppercase tracking-wide text-zinc-500">{product.brand ?? product.category?.title}</p>
        <h3 className="line-clamp-2 font-medium">{product.name}</h3>
        <div className="mt-auto flex items-baseline gap-2 pt-2">
          <span className="font-semibold">
            {hasPriceRange(product) && <span className="font-normal text-zinc-500">From </span>}
            {formatPrice(product.price)}
          </span>
          {product.compareAtPrice && product.compareAtPrice > product.price && (
            <span className="text-sm text-zinc-400 line-through">{formatPrice(product.compareAtPrice)}</span>
          )}
          {product.rating != null && (
            <span className="ml-auto text-xs text-zinc-500">★ {product.rating.toFixed(1)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

const hasPriceRange = (p: Product) => new Set(p.variants.map((v) => v.price)).size > 1;
