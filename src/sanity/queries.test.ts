import { evaluate, parse } from "groq-js";
import { describe, expect, it } from "vitest";
import {
  DISCOUNT_BY_CODE_QUERY,
  PRODUCT_BY_SLUG_QUERY,
  PRODUCTS_BY_IDS_QUERY,
  RELATED_PRODUCTS_QUERY,
  productsQuery,
} from "./queries";

// Runs the real GROQ queries against an in-memory dataset with groq-js.
const dataset = [
  { _id: "category-men", _type: "category", title: "Men", slug: { current: "men" } },
  { _id: "category-home", _type: "category", title: "Home", slug: { current: "home" } },
  {
    _id: "product-1",
    _type: "product",
    _createdAt: "2026-11-01T00:00:00Z",
    name: "Man Plaid Shirt",
    slug: { current: "man-plaid-shirt" },
    brand: "Fashion Trends",
    category: { _type: "reference", _ref: "category-men" },
    price: 34.99,
    rating: 4.2,
    tags: ["clothing", "shirts"],
    optionName: "Size",
    variants: [
      { _key: "s", title: "S", stock: 0 },
      { _key: "m", title: "M", stock: 4 },
      { _key: "xl", title: "XL", price: 39.99, stock: 6 },
    ],
    reviews: [
      { _key: "r0", rating: 5, comment: "Great", reviewerName: "A", date: "2026-01-01T00:00:00Z" },
      { _key: "r1", rating: 3, comment: "Ok", reviewerName: "B", date: "2026-03-01T00:00:00Z" },
    ],
  },
  {
    _id: "product-2",
    _type: "product",
    _createdAt: "2026-11-02T00:00:00Z",
    name: "Men Check Shirt",
    slug: { current: "men-check-shirt" },
    category: { _type: "reference", _ref: "category-men" },
    price: 27.99,
    rating: 4.8,
    variants: [{ _key: "m", title: "M", stock: 0 }],
  },
  {
    _id: "product-3",
    _type: "product",
    _createdAt: "2026-11-03T00:00:00Z",
    name: "Table Lamp",
    slug: { current: "table-lamp" },
    category: { _type: "reference", _ref: "category-home" },
    price: 49.99,
    rating: 3.9,
    tags: ["lighting"],
    variants: [{ _key: "default", title: "Default", stock: 9 }],
  },
  { _id: "discount-welcome10", _type: "discount", code: "WELCOME10", type: "percentage", value: 10, active: true },
];

async function run<T>(query: string, params: Record<string, unknown> = {}) {
  const result = await evaluate(parse(query, { params }), { dataset, params });
  return (await result.get()) as T;
}

const listParams = {
  q: "",
  qRaw: "",
  category: "",
  minPrice: 0,
  maxPrice: 1_000_000,
  start: 0,
  end: 24,
};

describe("product queries", () => {
  it("falls back to the product price per variant and sums stock", async () => {
    const p = await run<{ variants: { key: string; price: number; stock: number }[]; stock: number }>(
      PRODUCT_BY_SLUG_QUERY,
      { slug: "man-plaid-shirt" },
    );
    expect(p.variants).toEqual([
      { key: "s", title: "S", sku: null, price: 34.99, stock: 0 },
      { key: "m", title: "M", sku: null, price: 34.99, stock: 4 },
      { key: "xl", title: "XL", sku: null, price: 39.99, stock: 6 },
    ]);
    expect(p.stock).toBe(10);
  });

  it("returns reviews newest first and the category title", async () => {
    const p = await run<{ reviews: { _key: string }[]; category: { title: string; slug: string } }>(
      PRODUCT_BY_SLUG_QUERY,
      { slug: "man-plaid-shirt" },
    );
    expect(p.reviews.map((r) => r._key)).toEqual(["r1", "r0"]);
    expect(p.category).toEqual({ title: "Men", slug: "men" });
  });

  it("filters by category and keyword and counts the total", async () => {
    const byCategory = await run<{ items: { _id: string }[]; total: number }>(productsQuery("rating"), {
      ...listParams,
      category: "men",
    });
    expect(byCategory.items.map((p) => p._id)).toEqual(["product-2", "product-1"]);
    expect(byCategory.total).toBe(2);

    const byTag = await run<{ items: { _id: string }[] }>(productsQuery("newest"), {
      ...listParams,
      q: "lighting*",
      qRaw: "lighting",
    });
    expect(byTag.items.map((p) => p._id)).toEqual(["product-3"]);
  });

  it("sorts by price", async () => {
    const res = await run<{ items: { price: number }[] }>(productsQuery("price-asc"), listParams);
    expect(res.items.map((p) => p.price)).toEqual([27.99, 34.99, 49.99]);
  });

  it("only recommends in-stock products from the same category", async () => {
    const related = await run<{ _id: string }[]>(RELATED_PRODUCTS_QUERY, {
      id: "product-3",
      category: "men",
      limit: 4,
    });
    // product-2 is sold out in every variant.
    expect(related.map((p) => p._id)).toEqual(["product-1"]);
  });

  it("loads products by id for checkout", async () => {
    const res = await run<{ _id: string }[]>(PRODUCTS_BY_IDS_QUERY, { ids: ["product-3", "missing"] });
    expect(res.map((p) => p._id)).toEqual(["product-3"]);
  });

  it("finds a discount by code", async () => {
    expect(await run(DISCOUNT_BY_CODE_QUERY, { code: "WELCOME10" })).toMatchObject({ type: "percentage", value: 10 });
    expect(await run(DISCOUNT_BY_CODE_QUERY, { code: "NOPE" })).toBeNull();
  });
});
