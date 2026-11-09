import "server-only";
import { client } from "@/sanity/client";
import { isSanityConfigured } from "@/sanity/env";
import {
  CATEGORIES_QUERY,
  FEATURED_PRODUCTS_QUERY,
  PRODUCT_BY_SLUG_QUERY,
  PRODUCTS_BY_IDS_QUERY,
  RELATED_PRODUCTS_QUERY,
  productsQuery,
  type ProductSort,
} from "@/sanity/queries";
import type { Category, Product } from "@/sanity/types";

// Revalidate catalog reads every 60s; stock is re-checked server-side at checkout anyway.
const fetchOpts = { next: { revalidate: 60, tags: ["catalog"] } };

export type ProductSearch = {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
};

export async function searchProducts(opts: ProductSearch = {}) {
  if (!isSanityConfigured) return { items: [] as Product[], total: 0 };
  const pageSize = opts.pageSize ?? 24;
  const page = Math.max(1, opts.page ?? 1);
  const q = (opts.q ?? "").trim();
  return client.fetch<{ items: Product[]; total: number }>(
    productsQuery(opts.sort),
    {
      q: q ? `${q}*` : "",
      qRaw: q.toLowerCase(),
      category: opts.category ?? "",
      minPrice: opts.minPrice ?? 0,
      maxPrice: opts.maxPrice ?? 1_000_000,
      start: (page - 1) * pageSize,
      end: page * pageSize,
    },
    fetchOpts,
  );
}

export async function getCategories() {
  if (!isSanityConfigured) return [] as Category[];
  return client.fetch<Category[]>(CATEGORIES_QUERY, {}, fetchOpts);
}

export async function getFeaturedProducts() {
  if (!isSanityConfigured) return [] as Product[];
  return client.fetch<Product[]>(FEATURED_PRODUCTS_QUERY, {}, fetchOpts);
}

export async function getProductBySlug(slug: string) {
  if (!isSanityConfigured) return null;
  return client.fetch<Product | null>(PRODUCT_BY_SLUG_QUERY, { slug }, fetchOpts);
}

export async function getRelatedProducts(product: Product, limit = 4) {
  if (!isSanityConfigured) return [] as Product[];
  return client.fetch<Product[]>(
    RELATED_PRODUCTS_QUERY,
    { id: product._id, category: product.category?.slug ?? "", tags: product.tags ?? [], limit },
    fetchOpts,
  );
}

/** Uncached: used for checkout, where prices and stock must be authoritative. */
export async function getProductsByIdsFresh(ids: string[]) {
  return client
    .withConfig({ useCdn: false })
    .fetch<Product[]>(PRODUCTS_BY_IDS_QUERY, { ids }, { cache: "no-store" });
}
