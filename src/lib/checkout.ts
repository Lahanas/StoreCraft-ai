/**
 * Turns what the browser sent (product ids, variant keys, quantities) into priced order lines
 * using fresh catalog data. Pure, so it can be unit tested without Sanity or Stripe.
 */
import type { Product, Variant } from "@/sanity/types";

export const MAX_PER_LINE = 10;

export type RequestedLine = { productId: string; variantKey: string; quantity: number };

export type PricedLine = {
  productId: string;
  variantKey: string;
  variantTitle?: string;
  name: string;
  price: number;
  quantity: number;
  product: Product;
};

export type BuildResult =
  | { ok: true; lines: PricedLine[] }
  | { ok: false; status: 400 | 409; error: string };

export const lineId = (productId: string, variantKey: string) => `${productId}:${variantKey}`;

/** Variant title to show next to the product name, or undefined for single-variant products. */
export function variantLabel(product: Pick<Product, "variants">, variant: Variant) {
  return product.variants.length > 1 ? variant.title : undefined;
}

export function buildOrderLines(requested: RequestedLine[], products: Product[]): BuildResult {
  if (requested.length === 0) return { ok: false, status: 400, error: "Your cart is empty." };

  // Merge duplicate lines for the same variant.
  const merged = new Map<string, RequestedLine>();
  for (const r of requested) {
    const id = lineId(r.productId, r.variantKey);
    const prev = merged.get(id);
    merged.set(id, { ...r, quantity: Math.min(MAX_PER_LINE, (prev?.quantity ?? 0) + r.quantity) });
  }

  const byId = new Map(products.map((p) => [p._id, p]));
  const lines: PricedLine[] = [];

  for (const r of merged.values()) {
    const product = byId.get(r.productId);
    if (!product) return { ok: false, status: 409, error: "A product in your cart no longer exists." };
    const variant = product.variants.find((v) => v.key === r.variantKey);
    if (!variant) {
      return { ok: false, status: 409, error: `The option you picked for “${product.name}” is no longer available.` };
    }
    const label = variantLabel(product, variant);
    const displayName = label ? `${product.name} (${label})` : product.name;
    if (variant.stock < r.quantity) {
      return {
        ok: false,
        status: 409,
        error:
          variant.stock <= 0
            ? `“${displayName}” is sold out. Please remove it from your cart.`
            : `Only ${variant.stock} of “${displayName}” left in stock. Please update your cart.`,
      };
    }
    lines.push({
      productId: product._id,
      variantKey: variant.key,
      variantTitle: label,
      name: product.name,
      price: variant.price,
      quantity: r.quantity,
      product,
    });
  }

  return { ok: true, lines };
}

/**
 * Picks the variant the shopper (or the assistant) asked for. Matches the variant key or its
 * title, case-insensitively. Single-variant products need no choice.
 */
export function resolveVariant(
  product: Pick<Product, "name" | "variants" | "optionName">,
  choice?: string,
): { ok: true; variant: Variant } | { ok: false; error: string; options?: string[] } {
  const variants = product.variants;
  if (variants.length === 0) return { ok: false, error: `${product.name} is not available.` };
  if (variants.length === 1 && !choice) return { ok: true, variant: variants[0] };

  const options = variants.map((v) => v.title);
  if (!choice) {
    return {
      ok: false,
      error: `${product.name} comes in more than one ${(product.optionName ?? "option").toLowerCase()}. Ask the user which one they want.`,
      options,
    };
  }
  const wanted = choice.trim().toLowerCase();
  const variant =
    variants.find((v) => v.key.toLowerCase() === wanted) ??
    variants.find((v) => v.title.toLowerCase() === wanted) ??
    variants.find((v) => v.title.toLowerCase().replace(/\s+/g, "") === wanted.replace(/\s+/g, ""));
  if (!variant) {
    return { ok: false, error: `“${choice}” isn't an option for ${product.name}.`, options };
  }
  return { ok: true, variant };
}
