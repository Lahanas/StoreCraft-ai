import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { getCategories, getProductBySlug, getRelatedProducts, getProductsByIdsFresh, searchProducts } from "@/lib/catalog";
import { productImage } from "@/sanity/image";
import type { Product } from "@/sanity/types";

/** Compact product shape sent to the model and rendered as cards in the chat. */
export type ProductSummary = {
  id: string;
  slug: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  rating?: number;
  stock: number;
  category?: string;
  image: string;
  url: string;
};

const summarize = (p: Product): ProductSummary => ({
  id: p._id,
  slug: p.slug,
  name: p.name,
  price: p.price,
  compareAtPrice: p.compareAtPrice,
  rating: p.rating,
  stock: p.stock,
  category: p.category?.title,
  image: productImage(p, 400),
  url: `/products/${p.slug}`,
});

export const shoppingTools = {
  listCategories: tool({
    description: "List the store's product categories with their slugs and product counts.",
    inputSchema: z.object({}),
    execute: async () => {
      const categories = await getCategories();
      return categories.map((c) => ({ title: c.title, slug: c.slug, productCount: c.productCount }));
    },
  }),

  searchProducts: tool({
    description:
      "Search the catalog. Use for any request to find, browse or compare products. Combine a keyword with optional category slug, price range and sort. Returns up to `limit` products.",
    inputSchema: z.object({
      query: z.string().describe("Keywords, e.g. 'wireless headphones' or 'hiking'. Empty for no keyword.").default(""),
      category: z.string().describe("Category slug from listCategories, e.g. 'audio'").optional(),
      minPrice: z.number().min(0).optional(),
      maxPrice: z.number().min(0).optional(),
      sort: z.enum(["newest", "price-asc", "price-desc", "rating"]).default("rating"),
      limit: z.number().int().min(1).max(12).default(6),
    }),
    execute: async ({ query, category, minPrice, maxPrice, sort, limit }) => {
      const { items, total } = await searchProducts({
        q: query,
        category,
        minPrice,
        maxPrice,
        sort,
        pageSize: limit,
      });
      return { total, products: items.map(summarize) };
    },
  }),

  getProductDetails: tool({
    description: "Get full details (description, tags, stock) for one product by its slug.",
    inputSchema: z.object({ slug: z.string() }),
    execute: async ({ slug }) => {
      const p = await getProductBySlug(slug);
      if (!p) return { error: `No product with slug "${slug}".` };
      return { ...summarize(p), description: p.description, tags: p.tags };
    },
  }),

  getRecommendations: tool({
    description:
      "Recommend products similar to or complementing a given product (same category or shared tags). Use after the user views or adds something, or asks 'what goes with this'.",
    inputSchema: z.object({
      slug: z.string().describe("Slug of the product to base recommendations on"),
      limit: z.number().int().min(1).max(8).default(4),
    }),
    execute: async ({ slug, limit }) => {
      const p = await getProductBySlug(slug);
      if (!p) return { error: `No product with slug "${slug}".` };
      const related = await getRelatedProducts(p, limit);
      return { basedOn: p.name, products: related.filter((r) => r.stock > 0).map(summarize) };
    },
  }),

  addToCart: tool({
    description:
      "Add a product to the user's cart. Only call this when the user clearly asks to add/buy something. Use the product id returned by searchProducts or getProductDetails.",
    inputSchema: z.object({
      productId: z.string(),
      quantity: z.number().int().min(1).max(10).default(1),
    }),
    // Validates against live stock on the server; the browser applies the returned item to
    // the cart when it sees this tool result (see ChatWidget).
    execute: async ({ productId, quantity }) => {
      const [p] = await getProductsByIdsFresh([productId]);
      if (!p) return { ok: false as const, error: "Product not found." };
      if (p.stock <= 0) return { ok: false as const, error: `${p.name} is out of stock.` };
      return { ok: true as const, quantity: Math.min(quantity, p.stock, 10), product: summarize(p) };
    },
  }),
};

export type ShoppingTools = typeof shoppingTools;
