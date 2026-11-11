import { describe, expect, it } from "vitest";
import type { Product } from "@/sanity/types";
import { buildOrderLines, resolveVariant } from "./checkout";

const shirt: Product = {
  _id: "product-1",
  name: "Man Plaid Shirt",
  slug: "man-plaid-shirt",
  price: 34.99,
  optionName: "Size",
  variants: [
    { key: "s", title: "S", price: 34.99, stock: 0 },
    { key: "m", title: "M", price: 34.99, stock: 3 },
    { key: "l", title: "L", price: 34.99, stock: 12 },
  ],
  stock: 15,
};

const phone: Product = {
  _id: "product-2",
  name: "iPhone 13 Pro",
  slug: "iphone-13-pro",
  price: 1099.99,
  optionName: "Storage",
  variants: [
    { key: "128gb", title: "128 GB", price: 1099.99, stock: 5 },
    { key: "256gb", title: "256 GB", price: 1231.99, stock: 5 },
  ],
  stock: 10,
};

const mug: Product = {
  _id: "product-3",
  name: "Coffee Mug",
  slug: "coffee-mug",
  price: 12,
  variants: [{ key: "default", title: "Default", price: 12, stock: 40 }],
  stock: 40,
};

const catalog = [shirt, phone, mug];

describe("buildOrderLines", () => {
  it("prices each line from the catalog, not from the client", () => {
    const result = buildOrderLines(
      [
        { productId: "product-2", variantKey: "256gb", quantity: 1 },
        { productId: "product-3", variantKey: "default", quantity: 2 },
      ],
      catalog,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines.map((l) => [l.name, l.variantTitle, l.price, l.quantity])).toEqual([
      ["iPhone 13 Pro", "256 GB", 1231.99, 1],
      ["Coffee Mug", undefined, 12, 2],
    ]);
  });

  it("merges duplicate lines for the same variant and caps them at 10", () => {
    const result = buildOrderLines(
      [
        { productId: "product-3", variantKey: "default", quantity: 7 },
        { productId: "product-3", variantKey: "default", quantity: 7 },
      ],
      catalog,
    );
    expect(result.ok && result.lines).toMatchObject([{ productId: "product-3", quantity: 10 }]);
  });

  it("rejects more than the variant has in stock", () => {
    const result = buildOrderLines([{ productId: "product-1", variantKey: "m", quantity: 4 }], catalog);
    expect(result).toMatchObject({ ok: false, status: 409, error: expect.stringContaining("Only 3") });
  });

  it("rejects a sold-out variant even when other sizes are in stock", () => {
    const result = buildOrderLines([{ productId: "product-1", variantKey: "s", quantity: 1 }], catalog);
    expect(result).toMatchObject({ ok: false, status: 409, error: expect.stringContaining("sold out") });
  });

  it("rejects unknown products and variants", () => {
    expect(buildOrderLines([{ productId: "nope", variantKey: "m", quantity: 1 }], catalog)).toMatchObject({
      ok: false,
      status: 409,
    });
    expect(buildOrderLines([{ productId: "product-1", variantKey: "xxl", quantity: 1 }], catalog)).toMatchObject({
      ok: false,
      status: 409,
    });
  });

  it("rejects an empty cart", () => {
    expect(buildOrderLines([], catalog)).toMatchObject({ ok: false, status: 400 });
  });
});

describe("resolveVariant", () => {
  it("picks the only variant of a simple product", () => {
    expect(resolveVariant(mug)).toMatchObject({ ok: true, variant: { key: "default" } });
  });

  it("asks for a choice when a product has options", () => {
    expect(resolveVariant(shirt)).toMatchObject({ ok: false, options: ["S", "M", "L"] });
  });

  it("matches titles case-insensitively and ignores spaces", () => {
    expect(resolveVariant(shirt, "m")).toMatchObject({ ok: true, variant: { key: "m" } });
    expect(resolveVariant(phone, "256gb")).toMatchObject({ ok: true, variant: { title: "256 GB" } });
    expect(resolveVariant(phone, "256 gb")).toMatchObject({ ok: true, variant: { title: "256 GB" } });
  });

  it("rejects an option that doesn't exist", () => {
    expect(resolveVariant(shirt, "XXL")).toMatchObject({ ok: false, options: ["S", "M", "L"] });
  });
});
