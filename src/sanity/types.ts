export type Category = {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  productCount?: number;
};

export type Product = {
  _id: string;
  name: string;
  slug: string;
  price: number; // in major units (e.g. 49.99)
  compareAtPrice?: number;
  description?: string;
  image?: { asset?: { _ref: string } };
  imageUrl?: string;
  stock: number;
  rating?: number;
  tags?: string[];
  featured?: boolean;
  category?: { title: string; slug: string };
};

export type OrderItem = {
  _key: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type Order = {
  _id: string;
  orderNumber: string;
  status: "paid" | "fulfilled" | "refunded";
  total: number;
  currency: string;
  createdAt: string;
  items: OrderItem[];
};
