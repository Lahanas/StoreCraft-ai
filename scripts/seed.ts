/**
 * Seeds Sanity with the StoreCraft catalog: 184 products across 9 categories, with real product
 * photos, brands, variants (size, storage, memory), reviews and a few discount codes.
 *
 *   npm run seed
 *
 * Product data comes from scripts/data/products.json (from the MIT-licensed DummyJSON project).
 * Photos are downloaded once and uploaded to Sanity, so the store serves them from Sanity's
 * image CDN. Document ids are deterministic, so re-running the script updates the same
 * documents, skips images that are already uploaded, and removes products from older seeds.
 */
import { config } from "dotenv";
import { createClient } from "@sanity/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

config({ path: ".env.local" });
config();

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
const token = process.env.SANITY_API_WRITE_TOKEN;

if (!projectId || projectId === "your_project_id" || !token) {
  console.error(
    "Missing NEXT_PUBLIC_SANITY_PROJECT_ID or SANITY_API_WRITE_TOKEN. Copy .env.example to .env.local and fill them in.",
  );
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  token,
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "2026-11-01",
  useCdn: false,
});

type SourceProduct = {
  id: number;
  title: string;
  description: string;
  category: string;
  price: number;
  discountPercentage: number;
  rating: number;
  stock: number;
  tags: string[];
  brand?: string;
  sku: string;
  images: string[];
  reviews: { rating: number; comment: string; reviewerName: string; date: string }[];
};

const CATEGORIES: { slug: string; title: string; description: string; sources: string[] }[] = [
  {
    slug: "electronics",
    title: "Electronics",
    description: "Phones, tablets, laptops and the accessories that go with them.",
    sources: ["smartphones", "tablets", "laptops", "mobile-accessories"],
  },
  {
    slug: "kitchen",
    title: "Kitchen",
    description: "Tools and utensils for everyday cooking.",
    sources: ["kitchen-accessories"],
  },
  {
    slug: "groceries",
    title: "Groceries",
    description: "Pantry staples, fresh food and drinks.",
    sources: ["groceries"],
  },
  {
    slug: "sports",
    title: "Sports",
    description: "Gear for the court, the field and the gym.",
    sources: ["sports-accessories"],
  },
  {
    slug: "beauty",
    title: "Beauty",
    description: "Makeup, skin care and fragrances.",
    sources: ["beauty", "skin-care", "fragrances"],
  },
  {
    slug: "home",
    title: "Home",
    description: "Furniture and decor for every room.",
    sources: ["furniture", "home-decoration"],
  },
  {
    slug: "men",
    title: "Men",
    description: "Shirts, shoes and watches.",
    sources: ["mens-shirts", "mens-shoes", "mens-watches"],
  },
  {
    slug: "women",
    title: "Women",
    description: "Tops, dresses, shoes and bags.",
    sources: ["tops", "womens-dresses", "womens-shoes", "womens-bags"],
  },
  {
    slug: "accessories",
    title: "Accessories",
    description: "Sunglasses, jewellery and watches.",
    sources: ["sunglasses", "womens-jewellery", "womens-watches"],
  },
];

/** Variant options by source category. `delta` is a price multiplier on top of the base price. */
const OPTIONS: Record<string, { name: string; values: { title: string; delta?: number }[] }> = {
  "mens-shirts": { name: "Size", values: ["S", "M", "L", "XL"].map((title) => ({ title })) },
  tops: { name: "Size", values: ["XS", "S", "M", "L"].map((title) => ({ title })) },
  "womens-dresses": { name: "Size", values: ["XS", "S", "M", "L"].map((title) => ({ title })) },
  "mens-shoes": { name: "Size", values: ["US 8", "US 9", "US 10", "US 11", "US 12"].map((title) => ({ title })) },
  "womens-shoes": { name: "Size", values: ["US 6", "US 7", "US 8", "US 9", "US 10"].map((title) => ({ title })) },
  smartphones: {
    name: "Storage",
    values: [{ title: "128 GB" }, { title: "256 GB", delta: 0.12 }, { title: "512 GB", delta: 0.3 }],
  },
  tablets: {
    name: "Storage",
    values: [{ title: "64 GB" }, { title: "256 GB", delta: 0.2 }],
  },
  laptops: {
    name: "Memory",
    values: [{ title: "16 GB" }, { title: "32 GB", delta: 0.2 }],
  },
};

const MAX_IMAGES = 4;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const keyify = (s: string) => slugify(s).replace(/-/g, "") || "default";

const roundPrice = (n: number) => Math.max(0.99, Math.round(n) - 0.01);

// Small deterministic PRNG so every run produces the same stock split.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i], i);
      }
    }),
  );
  return results;
}

/** Uploads each image URL once. Re-runs find existing assets by their source URL. */
async function uploadImages(urls: string[]) {
  const existing = await client.fetch<{ _id: string; url: string }[]>(
    `*[_type == "sanity.imageAsset" && source.name == "storecraft-seed"]{ _id, "url": source.id }`,
  );
  const assetByUrl = new Map(existing.map((a) => [a.url, a._id]));
  const todo = urls.filter((u) => !assetByUrl.has(u));
  console.log(`Images: ${urls.length - todo.length} already uploaded, ${todo.length} to upload…`);

  let done = 0;
  let failed = 0;
  await mapLimit(todo, 6, async (url) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      const asset = await client.assets.upload("image", buffer, {
        filename: url.split("/").slice(-2).join("-"),
        source: { name: "storecraft-seed", id: url, url },
      });
      assetByUrl.set(url, asset._id);
    } catch (err) {
      failed++;
      console.warn(`  could not upload ${url}: ${err instanceof Error ? err.message : err}`);
    }
    done++;
    if (done % 25 === 0 || done === todo.length) console.log(`  ${done}/${todo.length}`);
  });
  if (failed) console.warn(`${failed} images failed. Run the seed again to retry them.`);
  return assetByUrl;
}

function buildVariants(p: SourceProduct, rand: () => number) {
  const option = OPTIONS[p.category];
  if (!option) {
    return {
      optionName: undefined,
      variants: [{ _key: "default", _type: "variant", title: "Default", sku: p.sku, stock: p.stock }],
    };
  }
  // Split the product's stock across its variants, and sell out one size now and then so the
  // storefront has sold-out options to show.
  const weights = option.values.map(() => 0.5 + rand());
  const sum = weights.reduce((a, b) => a + b, 0);
  const soldOut = rand() < 0.35 ? Math.floor(rand() * option.values.length) : -1;
  const variants = option.values.map((v, i) => ({
    _key: keyify(v.title),
    _type: "variant",
    title: v.title,
    sku: `${p.sku}-${keyify(v.title).toUpperCase()}`,
    ...(v.delta ? { price: roundPrice(p.price * (1 + v.delta)) } : {}),
    stock: i === soldOut ? 0 : Math.max(1, Math.round((p.stock * weights[i]) / sum)),
  }));
  return { optionName: option.name, variants };
}

async function main() {
  const source: SourceProduct[] = JSON.parse(
    readFileSync(join(process.cwd(), "scripts/data/products.json"), "utf8"),
  );
  const categoryBySource = new Map(CATEGORIES.flatMap((c) => c.sources.map((s) => [s, c] as const)));
  const products = source.filter((p) => categoryBySource.has(p.category));

  const urls = products.flatMap((p) => p.images.slice(0, MAX_IMAGES));
  const assetByUrl = await uploadImages(urls);

  const rand = mulberry32(42);
  const usedSlugs = new Set<string>();
  // Feature the best-rated in-stock product from each category.
  const featured = new Set(
    CATEGORIES.map(
      (c) =>
        products
          .filter((p) => c.sources.includes(p.category) && p.stock > 0)
          .sort((a, b) => b.rating - a.rating)[0]?.id,
    ),
  );

  const docs = products.map((p) => {
    const category = categoryBySource.get(p.category)!;
    let slug = slugify(p.title);
    if (usedSlugs.has(slug)) slug = `${slug}-${p.id}`;
    usedSlugs.add(slug);

    const { optionName, variants } = buildVariants(p, rand);
    const images = p.images
      .slice(0, MAX_IMAGES)
      .filter((u) => assetByUrl.has(u))
      .map((u, i) => ({
        _key: `img${i}`,
        _type: "image",
        asset: { _type: "reference", _ref: assetByUrl.get(u)! },
      }));
    const compareAtPrice =
      p.discountPercentage >= 12 ? roundPrice(p.price / (1 - p.discountPercentage / 100)) : undefined;

    return {
      _id: `product-${p.id}`,
      _type: "product",
      name: p.title,
      slug: { _type: "slug", current: slug },
      brand: p.brand,
      category: { _type: "reference", _ref: `category-${category.slug}` },
      price: p.price,
      ...(compareAtPrice && compareAtPrice > p.price ? { compareAtPrice } : {}),
      description: p.description,
      tags: [...new Set([...(p.tags ?? []), p.category.replace(/-/g, " ")])],
      rating: Math.round(p.rating * 10) / 10,
      featured: featured.has(p.id),
      ...(optionName ? { optionName } : {}),
      variants,
      images,
      reviews: p.reviews.map((r, i) => ({ _key: `r${i}`, _type: "review", ...r })),
    };
  });

  const discounts: ({ _id: string; code: string } & Record<string, unknown>)[] = [
    {
      _id: "discount-welcome10",
      code: "WELCOME10",
      description: "10% off your order",
      type: "percentage",
      value: 10,
      active: true,
    },
    {
      _id: "discount-save25",
      code: "SAVE25",
      description: "$25 off orders over $150",
      type: "fixed",
      value: 25,
      minSubtotal: 150,
      active: true,
    },
    {
      _id: "discount-summer20",
      code: "SUMMER20",
      description: "20% off (expired)",
      type: "percentage",
      value: 20,
      active: true,
      startsAt: "2026-06-01T00:00:00Z",
      endsAt: "2026-08-31T23:59:59Z",
    },
  ];

  const tx = client.transaction();
  for (const c of CATEGORIES) {
    tx.createOrReplace({
      _id: `category-${c.slug}`,
      _type: "category",
      title: c.title,
      slug: { _type: "slug", current: c.slug },
      description: c.description,
    });
  }
  for (const d of docs) tx.createOrReplace(d);
  // Keep usage counts when re-seeding discounts.
  for (const d of discounts) {
    tx.createIfNotExists({ ...d, _type: "discount", timesUsed: 0 });
    const { _id, ...fields } = d;
    tx.patch(_id, (p) => p.set(fields));
  }

  // Remove products and categories left over from older versions of the seed.
  const productIds = docs.map((d) => d._id);
  const categoryIds = CATEGORIES.map((c) => `category-${c.slug}`);
  const stale = await client.fetch<{ products: string[]; categories: string[] }>(
    `{
      "products": *[_type == "product" && !(_id in path("drafts.**")) && !(_id in $productIds)]._id,
      "categories": *[_type == "category" && !(_id in path("drafts.**")) && !(_id in $categoryIds)]._id
    }`,
    { productIds, categoryIds },
  );
  for (const id of [...stale.products, ...stale.categories]) tx.delete(id);

  console.log(
    `Writing ${CATEGORIES.length} categories, ${docs.length} products and ${discounts.length} discount codes` +
      (stale.products.length ? `, removing ${stale.products.length} old products` : "") +
      ` in ${projectId}/${dataset}…`,
  );
  await tx.commit({ visibility: "async" });
  console.log("Done. Open /studio to browse them.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
