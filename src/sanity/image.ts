import { createImageUrlBuilder } from "@sanity/image-url";
import { dataset, projectId } from "./env";
import type { SanityImage } from "./types";

const builder = createImageUrlBuilder({ projectId, dataset });

export const PLACEHOLDER_IMAGE = "/placeholder.svg";

/** Square, auto-format URL from the Sanity image CDN, or a placeholder when there is no image. */
export function imageUrl(image: SanityImage | undefined, width = 800) {
  if (!image?.asset?._ref) return PLACEHOLDER_IMAGE;
  return builder.image(image).width(width).height(width).fit("crop").auto("format").url();
}

export function productImage(product: { image?: SanityImage }, width = 800) {
  return imageUrl(product.image, width);
}
