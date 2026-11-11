import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductPurchase } from "@/components/ProductPurchase";
import { ProductCard } from "@/components/ProductCard";
import { ProductGallery } from "@/components/ProductGallery";
import { getProductBySlug, getRelatedProducts } from "@/lib/catalog";
import { imageUrl, productImage } from "@/sanity/image";

export const revalidate = 60;

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  return product ? { title: product.name, description: product.description } : {};
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();
  const related = await getRelatedProducts(product);

  const gallery = (product.images?.length ? product.images : [product.image]).map((img) => ({
    large: imageUrl(img, 1000),
    thumb: imageUrl(img, 160),
  }));
  const reviews = product.reviews ?? [];

  return (
    <div className="space-y-16">
      <div className="grid gap-10 md:grid-cols-2">
        <ProductGallery images={gallery} alt={product.name} />
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2 text-sm uppercase tracking-wide">
            {product.category && (
              <Link href={`/products?category=${product.category.slug}`} className="text-indigo-600">
                {product.category.title}
              </Link>
            )}
            {product.brand && <span className="text-zinc-500">· {product.brand}</span>}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
          {product.rating != null && (
            <p className="text-sm text-zinc-500">
              ★ {product.rating.toFixed(1)} / 5
              {reviews.length > 0 && <> · {reviews.length} reviews</>}
            </p>
          )}
          <p className="leading-relaxed text-zinc-600 dark:text-zinc-300">{product.description}</p>
          <ProductPurchase
            product={{
              _id: product._id,
              slug: product.slug,
              name: product.name,
              image: productImage(product, 400),
              compareAtPrice: product.compareAtPrice,
              optionName: product.optionName,
              variants: product.variants,
            }}
          />
          {product.tags && product.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {product.tags.map((t) => (
                <Link
                  key={t}
                  href={`/products?q=${encodeURIComponent(t)}`}
                  className="rounded-full bg-zinc-100 px-3 py-1 text-xs dark:bg-zinc-800"
                >
                  {t}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {reviews.length > 0 && (
        <section>
          <h2 className="mb-6 text-2xl font-semibold">Reviews</h2>
          <ul className="grid gap-4 sm:grid-cols-3">
            {reviews.map((r) => (
              <li key={r._key} className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
                <p className="text-amber-500" aria-label={`${r.rating} out of 5`}>
                  {"★".repeat(r.rating)}
                  <span className="text-zinc-300 dark:text-zinc-700">{"★".repeat(5 - r.rating)}</span>
                </p>
                <p className="mt-2">{r.comment}</p>
                <p className="mt-3 text-xs text-zinc-500">
                  {r.reviewerName} · {new Date(r.date).toLocaleDateString("en-US", { dateStyle: "medium" })}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

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
