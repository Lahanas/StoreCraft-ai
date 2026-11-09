import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/AddToCartButton";
import { ProductCard } from "@/components/ProductCard";
import { getProductBySlug, getRelatedProducts } from "@/lib/catalog";
import { formatPrice } from "@/lib/money";
import { productImage } from "@/sanity/image";

export const revalidate = 60;

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  return product ? { title: product.name, description: product.description } : {};
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();
  const related = await getRelatedProducts(product);
  const image = productImage(product, 1000);

  return (
    <div className="space-y-16">
      <div className="grid gap-10 md:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-3xl bg-zinc-100 dark:bg-zinc-800">
          <Image src={image} alt={product.name} fill priority sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
        </div>
        <div className="flex flex-col gap-5">
          {product.category && (
            <Link href={`/products?category=${product.category.slug}`} className="text-sm uppercase tracking-wide text-indigo-600">
              {product.category.title}
            </Link>
          )}
          <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-semibold">{formatPrice(product.price)}</span>
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <span className="text-lg text-zinc-400 line-through">{formatPrice(product.compareAtPrice)}</span>
            )}
          </div>
          {product.rating != null && <p className="text-sm text-zinc-500">★ {product.rating.toFixed(1)} / 5</p>}
          <p className="leading-relaxed text-zinc-600 dark:text-zinc-300">{product.description}</p>
          <p className={`text-sm ${product.stock > 5 ? "text-emerald-600" : "text-amber-600"}`}>
            {product.stock <= 0 ? "Out of stock" : product.stock <= 5 ? `Only ${product.stock} left` : "In stock"}
          </p>
          <AddToCartButton
            product={{ _id: product._id, slug: product.slug, name: product.name, price: product.price, stock: product.stock, image: productImage(product, 400) }}
            className="self-start"
          />
          {product.tags && product.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {product.tags.map((t) => (
                <Link key={t} href={`/products?q=${encodeURIComponent(t)}`} className="rounded-full bg-zinc-100 px-3 py-1 text-xs dark:bg-zinc-800">
                  {t}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section>
          <h2 className="mb-6 text-2xl font-semibold">You might also like</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
