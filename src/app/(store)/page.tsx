import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { SetupNotice } from "@/components/SetupNotice";
import { getCategories, getFeaturedProducts } from "@/lib/catalog";

export const revalidate = 60;

export default async function HomePage() {
  const [categories, featured] = await Promise.all([getCategories(), getFeaturedProducts()]);

  return (
    <div className="space-y-16">
      <SetupNotice />

      <section className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 px-8 py-16 text-white sm:px-14">
        <p className="text-sm font-medium uppercase tracking-widest text-indigo-200">New season</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          Gear that works as hard as you do.
        </h1>
        <p className="mt-4 max-w-xl text-indigo-100">
          Not sure where to start? Ask the shopping assistant in the corner. It can search the catalog,
          recommend products and add them straight to your cart.
        </p>
        <Link
          href="/products"
          className="mt-8 inline-block rounded-full bg-white px-6 py-3 font-medium text-indigo-700 hover:bg-indigo-50"
        >
          Shop all products
        </Link>
      </section>

      {categories.length > 0 && (
        <section>
          <h2 className="mb-6 text-2xl font-semibold">Shop by category</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {categories.map((c) => (
              <Link
                key={c._id}
                href={`/products?category=${c.slug}`}
                className="rounded-2xl border border-zinc-200 p-5 transition hover:border-indigo-400 hover:shadow dark:border-zinc-800"
              >
                <p className="font-medium">{c.title}</p>
                <p className="mt-1 text-sm text-zinc-500">{c.productCount} products</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {featured.length > 0 && (
        <section>
          <h2 className="mb-6 text-2xl font-semibold">Featured</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
