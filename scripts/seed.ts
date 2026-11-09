/**
 * Seeds Sanity with 8 categories and 120 products.
 *
 *   npm run seed            # create or replace seed documents (safe to re-run)
 *   npm run seed -- --count=200
 *
 * Document ids are deterministic (category-<slug>, product-<slug>), so re-running the
 * script updates the same documents instead of creating duplicates.
 */
import { config } from "dotenv";
import { createClient } from "@sanity/client";

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

const countArg = process.argv.find((a) => a.startsWith("--count="));
const TARGET = countArg ? Number(countArg.split("=")[1]) : 120;

type CategorySeed = {
  title: string;
  description: string;
  items: { name: string; base: number; tags: string[] }[];
};

const CATEGORIES: CategorySeed[] = [
  {
    title: "Audio",
    description: "Headphones, speakers and everything in between.",
    items: [
      { name: "Wireless Headphones", base: 129, tags: ["wireless", "music", "travel"] },
      { name: "Bluetooth Speaker", base: 79, tags: ["wireless", "outdoor", "music"] },
      { name: "Noise-Cancelling Earbuds", base: 149, tags: ["wireless", "travel", "commute"] },
      { name: "Studio Monitor Headphones", base: 189, tags: ["studio", "music", "pro"] },
      { name: "Soundbar", base: 219, tags: ["home", "tv", "music"] },
    ],
  },
  {
    title: "Computing",
    description: "Keyboards, mice, monitors and desk tech.",
    items: [
      { name: "Mechanical Keyboard", base: 109, tags: ["desk", "gaming", "productivity"] },
      { name: "Ergonomic Mouse", base: 59, tags: ["desk", "productivity", "ergonomic"] },
      { name: "USB-C Hub", base: 45, tags: ["desk", "travel", "productivity"] },
      { name: "27in 4K Monitor", base: 399, tags: ["desk", "productivity", "gaming"] },
      { name: "Laptop Stand", base: 39, tags: ["desk", "ergonomic"] },
    ],
  },
  {
    title: "Home & Kitchen",
    description: "Tools that make cooking and living easier.",
    items: [
      { name: "Pour-Over Coffee Set", base: 49, tags: ["coffee", "kitchen", "gift"] },
      { name: "Cast Iron Skillet", base: 42, tags: ["kitchen", "cooking"] },
      { name: "Chef's Knife", base: 89, tags: ["kitchen", "cooking", "gift"] },
      { name: "Smart Kettle", base: 69, tags: ["kitchen", "coffee", "tea", "smart-home"] },
      { name: "Linen Throw Blanket", base: 59, tags: ["home", "cozy", "gift"] },
    ],
  },
  {
    title: "Outdoor",
    description: "Gear for trails, camps and weekends away.",
    items: [
      { name: "Hiking Backpack", base: 119, tags: ["hiking", "travel", "outdoor"] },
      { name: "Insulated Water Bottle", base: 29, tags: ["hiking", "outdoor", "fitness"] },
      { name: "Camping Lantern", base: 35, tags: ["camping", "outdoor"] },
      { name: "Ultralight Tent", base: 249, tags: ["camping", "hiking", "outdoor"] },
      { name: "Trekking Poles", base: 65, tags: ["hiking", "outdoor"] },
    ],
  },
  {
    title: "Fitness",
    description: "Train smarter at home or at the gym.",
    items: [
      { name: "Yoga Mat", base: 39, tags: ["yoga", "fitness", "home"] },
      { name: "Adjustable Dumbbells", base: 199, tags: ["strength", "fitness", "home"] },
      { name: "Fitness Tracker", base: 99, tags: ["wearable", "fitness", "running"] },
      { name: "Resistance Band Set", base: 25, tags: ["strength", "fitness", "travel"] },
      { name: "Foam Roller", base: 29, tags: ["recovery", "fitness"] },
    ],
  },
  {
    title: "Apparel",
    description: "Everyday essentials, built to last.",
    items: [
      { name: "Merino Crew Sweater", base: 89, tags: ["clothing", "winter", "travel"] },
      { name: "Waterproof Shell Jacket", base: 159, tags: ["clothing", "outdoor", "rain"] },
      { name: "Everyday Sneakers", base: 95, tags: ["shoes", "clothing", "commute"] },
      { name: "Organic Cotton Tee", base: 28, tags: ["clothing", "basics"] },
      { name: "Running Shorts", base: 38, tags: ["clothing", "running", "fitness"] },
    ],
  },
  {
    title: "Bags & Travel",
    description: "Carry everything, everywhere.",
    items: [
      { name: "Carry-On Suitcase", base: 229, tags: ["travel", "luggage"] },
      { name: "Leather Wallet", base: 55, tags: ["accessories", "gift"] },
      { name: "Laptop Backpack", base: 99, tags: ["travel", "commute", "desk"] },
      { name: "Packing Cubes Set", base: 32, tags: ["travel", "organization"] },
      { name: "Weekender Duffel", base: 139, tags: ["travel", "luggage", "gift"] },
    ],
  },
  {
    title: "Smart Home",
    description: "Connected devices for a smarter home.",
    items: [
      { name: "Smart Plug (2-pack)", base: 29, tags: ["smart-home", "home"] },
      { name: "Video Doorbell", base: 149, tags: ["smart-home", "security"] },
      { name: "Smart LED Bulb Kit", base: 49, tags: ["smart-home", "lighting"] },
      { name: "Wi-Fi Mesh Router", base: 279, tags: ["smart-home", "networking"] },
      { name: "Indoor Security Camera", base: 79, tags: ["smart-home", "security"] },
    ],
  },
];

const VARIANTS = [
  { label: "Classic", mult: 1, color: "Black" },
  { label: "Pro", mult: 1.45, color: "Graphite" },
  { label: "Lite", mult: 0.75, color: "White" },
  { label: "Max", mult: 1.8, color: "Midnight" },
  { label: "Eco", mult: 0.95, color: "Sage" },
  { label: "Travel", mult: 0.85, color: "Sand" },
];

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// Small deterministic PRNG so every run produces the same catalog.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);

async function main() {
  const tx = client.transaction();

  for (const c of CATEGORIES) {
    const slug = slugify(c.title);
    tx.createOrReplace({
      _id: `category-${slug}`,
      _type: "category",
      title: c.title,
      slug: { _type: "slug", current: slug },
      description: c.description,
    });
  }

  // Round-robin through categories → items → variants until TARGET products exist.
  const products: Record<string, unknown>[] = [];
  outer: for (const variant of VARIANTS) {
    for (let i = 0; i < 5; i++) {
      for (const c of CATEGORIES) {
        if (products.length >= TARGET) break outer;
        const item = c.items[i];
        const name = `${item.name} ${variant.label} – ${variant.color}`;
        const slug = slugify(name);
        const price = Math.round(item.base * variant.mult * (0.9 + rand() * 0.2)) - 0.01;
        const onSale = rand() < 0.2;
        products.push({
          _id: `product-${slug}`,
          _type: "product",
          name,
          slug: { _type: "slug", current: slug },
          category: { _type: "reference", _ref: `category-${slugify(c.title)}` },
          price,
          ...(onSale ? { compareAtPrice: Math.round(price * 1.25) - 0.01 } : {}),
          description: `The ${item.name.toLowerCase()} in our ${variant.label} edition, finished in ${variant.color.toLowerCase()}. ${c.description} Covered by a 2-year warranty and free 30-day returns.`,
          imageUrl: `https://picsum.photos/seed/${slug}/800/800`,
          stock: Math.floor(rand() * 60) + (rand() < 0.05 ? 0 : 3),
          rating: Math.round((3.4 + rand() * 1.6) * 10) / 10,
          tags: [...item.tags, variant.label.toLowerCase(), variant.color.toLowerCase()],
          featured: rand() < 0.12,
        });
      }
    }
  }

  for (const p of products) tx.createOrReplace(p as { _id: string; _type: string });

  console.log(`Seeding ${CATEGORIES.length} categories and ${products.length} products into ${projectId}/${dataset}…`);
  await tx.commit({ visibility: "async" });
  console.log("Done. Open /studio to browse them.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
