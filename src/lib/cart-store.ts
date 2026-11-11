"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { lineId, MAX_PER_LINE } from "@/lib/checkout";
import type { DiscountRule } from "@/lib/pricing";

export type CartItem = {
  /** `${productId}:${variantKey}`. One line per variant. */
  id: string;
  productId: string;
  variantKey: string;
  variantTitle?: string;
  slug: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  /** Stock of this variant when it was added; the server re-checks at checkout. */
  stock: number;
};

export type NewCartItem = Omit<CartItem, "id" | "quantity">;

type CartState = {
  items: CartItem[];
  discount: DiscountRule | null;
  isOpen: boolean;
  addItem: (item: NewCartItem, quantity?: number) => void;
  setQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  applyDiscount: (rule: DiscountRule) => void;
  removeDiscount: () => void;
  clear: () => void;
  open: () => void;
  close: () => void;
};

// Bumped when the stored shape changes so old carts don't break the app.
export const CART_STORAGE_KEY = "storecraft-cart-v2";

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      discount: null,
      isOpen: false,
      addItem: (item, quantity = 1) =>
        set((state) => {
          const cap = Math.min(MAX_PER_LINE, item.stock);
          if (cap <= 0 || quantity <= 0) return state;
          const id = lineId(item.productId, item.variantKey);
          const existing = state.items.find((i) => i.id === id);
          const items = existing
            ? state.items.map((i) =>
                i.id === id ? { ...i, ...item, quantity: Math.min(cap, i.quantity + quantity) } : i,
              )
            : [...state.items, { ...item, id, quantity: Math.min(cap, quantity) }];
          return { items };
        }),
      setQuantity: (id, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.id !== id)
              : state.items.map((i) =>
                  i.id === id ? { ...i, quantity: Math.min(quantity, MAX_PER_LINE, i.stock) } : i,
                ),
        })),
      removeItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      applyDiscount: (rule) => set({ discount: rule }),
      removeDiscount: () => set({ discount: null }),
      clear: () => set({ items: [], discount: null }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
    }),
    {
      name: CART_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ items: s.items, discount: s.discount }),
      skipHydration: true,
    },
  ),
);

export const cartCount = (items: CartItem[]) => items.reduce((n, i) => n + i.quantity, 0);
