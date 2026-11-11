import { defineQuery } from "next-sanity";

// Variant price falls back to the product price, and total stock is summed across variants.
const PRODUCT_FIELDS = /* groq */ `
  _id, name, "slug": slug.current, brand, price, compareAtPrice, description,
  "image": images[0], optionName,
  "variants": coalesce(variants[]{ "key": _key, title, sku, "price": coalesce(price, ^.price), "stock": coalesce(stock, 0) }, []),
  "stock": coalesce(math::sum(variants[].stock), 0),
  rating, tags, featured,
  "category": category->{ title, "slug": slug.current }
`;

const IN_STOCK = /* groq */ `count(variants[stock > 0]) > 0`;

export const CATEGORIES_QUERY = defineQuery(`
  *[_type == "category"] | order(title asc) {
    _id, title, "slug": slug.current, description,
    "productCount": count(*[_type == "product" && references(^._id)])
  }
`);

export const FEATURED_PRODUCTS_QUERY = defineQuery(`
  *[_type == "product" && featured == true && ${IN_STOCK}] | order(rating desc)[0...8] { ${PRODUCT_FIELDS} }
`);

const SORTS = {
  newest: "_createdAt desc",
  "price-asc": "price asc",
  "price-desc": "price desc",
  rating: "rating desc",
} as const;
export type ProductSort = keyof typeof SORTS;
export const isProductSort = (s: unknown): s is ProductSort => typeof s === "string" && s in SORTS;

const PRODUCT_FILTER = /* groq */ `_type == "product"
  && ($category == "" || category->slug.current == $category)
  && ($q == "" || name match $q || brand match $q || description match $q || $qRaw in tags)
  && price >= $minPrice && price <= $maxPrice`;

/**
 * Filtered + paginated listing. All values go through GROQ params; only the sort
 * clause is interpolated, and it comes from a fixed whitelist.
 */
export function productsQuery(sort: ProductSort = "newest") {
  return `{
    "items": *[${PRODUCT_FILTER}] | order(${SORTS[sort]}) [$start...$end] { ${PRODUCT_FIELDS} },
    "total": count(*[${PRODUCT_FILTER}])
  }`;
}

export const PRODUCT_BY_SLUG_QUERY = defineQuery(`
  *[_type == "product" && slug.current == $slug][0] {
    ${PRODUCT_FIELDS},
    images,
    "reviews": reviews[] | order(date desc)
  }
`);

export const RELATED_PRODUCTS_QUERY = defineQuery(`
  *[_type == "product" && _id != $id && category->slug.current == $category && ${IN_STOCK}]
    | order(rating desc)[0...$limit] { ${PRODUCT_FIELDS} }
`);

export const PRODUCTS_BY_IDS_QUERY = defineQuery(`
  *[_type == "product" && _id in $ids] { ${PRODUCT_FIELDS} }
`);

export const DISCOUNT_BY_CODE_QUERY = defineQuery(`
  *[_type == "discount" && code == $code][0] {
    code, description, type, value, minSubtotal, active, startsAt, endsAt, usageLimit, timesUsed
  }
`);

export const ORDERS_BY_USER_QUERY = defineQuery(`
  *[_type == "order" && clerkUserId == $userId] | order(createdAt desc) {
    _id, orderNumber, status, subtotal, discountCode, discountAmount, total, currency, createdAt, items
  }
`);
