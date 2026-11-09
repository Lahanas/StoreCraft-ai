import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { SetupNotice } from "@/components/SetupNotice";
import { getCategories, searchProducts } from "@/lib/catalog";
import { isProductSort } from "@/sanity/queries";

export const metadata: Metadata = { title: "Shop" };

const PAGE_SIZE = 24;

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = str(sp.q);
  const category = str(sp.category);
  const sort = isProductSort(sp.sort) ? sp.sort : "newest";
  const page = Math.max(1, Number(str(sp.page)) || 1);

  const [categories, { items, total }] = await Promise.all([
    getCategories(),
    searchProducts({ q, category, sort, page, pageSize: PAGE_SIZE }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const href = (patch: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q, category, sort, page: undefined as number | undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) {
      if (v && !(k === "sort" && v === "newest") && !(k === "page" && v === 1)) params.set(k, String(v));
    }
    const s = params.toString();
    return s ? `/products?${s}` : "/products";
  };

  return (
    <div className="space-y-8">
      <SetupNotice />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {q ? `Results for “${q}”` : (categories.find((c) => c.slug === category)?.title ?? "All products")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{total} products</p>
        </div>
        <form className="flex gap-2" action="/products">
          {category && <input type="hidden" name="category" value={category} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search…"
            className="rounded-full border border-zinc-300 bg-transparent px-4 py-2 text-sm dark:border-zinc-700"
          />
          <select
            name="sort"
            defaultValue={sort}
            className="rounded-full border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          >
            <option value="newest">Newest</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="rating">Top rated</option>
          </select>
          <button className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-white dark:text-zinc-900">
            Apply
          </button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip href={href({ category: "" })} active={!category}>
          All
        </Chip>
        {categories.map((c) => (
          <Chip key={c._id} href={href({ category: c.slug })} active={category === c.slug}>
            {c.title}
          </Chip>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="py-20 text-center text-zinc-500">No products match. Try another search.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p._id} product={p} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav className="flex justify-center gap-2" aria-label="Pagination">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Chip key={n} href={href({ page: n })} active={n === page}>
              {n}
            </Chip>
          ))}
        </nav>
      )}
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-4 py-1.5 text-sm transition ${
        active
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
          : "border-zinc-300 hover:border-zinc-500 dark:border-zinc-700"
      }`}
    >
      {children}
    </Link>
  );
}
