import { createImageUrlBuilder } from "@sanity/image-url";
import { dataset, projectId } from "./env";
import type { Product } from "./types";

const builder = createImageUrlBuilder({ projectId, dataset });

/** Prefer an uploaded Sanity image; fall back to the seeded external URL. */
export function productImage(product: Pick<Product, "image" | "imageUrl">, width = 800) {
  if (product.image?.asset?._ref) {
    return builder.image(product.image).width(width).height(width).fit("crop").auto("format").url();
  }
  return product.imageUrl ?? `https://picsum.photos/seed/storecraft/${width}/${width}`;
}
