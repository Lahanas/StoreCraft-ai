export type Category = {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  productCount?: number;
};

export type SanityImage = { _key?: string; asset?: { _ref: string } };

export type Variant = {
  key: string;
  title: string;
  sku?: string;
  price: number; // falls back to the product price in the query
  stock: number;
};

export type Review = {
  _key: string;
  rating: number;
  comment: string;
  reviewerName: string;
  date: string;
};

export type Product = {
  _id: string;
  name: string;
  slug: string;
  brand?: string;
  price: number; // in major units (e.g. 49.99); the "from" price when variants differ
  compareAtPrice?: number;
  description?: string;
  image?: SanityImage;
  images?: SanityImage[];
  /** Name of the variant option, e.g. "Size" or "Storage". Empty for single-variant products. */
  optionName?: string;
  variants: Variant[];
  /** Total stock across all variants. */
  stock: number;
  rating?: number;
  tags?: string[];
  featured?: boolean;
  category?: { title: string; slug: string };
  reviews?: Review[];
};

export type OrderItem = {
  _key: string;
  productId: string;
  variantKey?: string;
  variantTitle?: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type Order = {
  _id: string;
  orderNumber: string;
  status: "paid" | "fulfilled" | "refunded";
  subtotal?: number;
  discountCode?: string;
  discountAmount?: number;
  total: number;
  currency: string;
  createdAt: string;
  items: OrderItem[];
};
