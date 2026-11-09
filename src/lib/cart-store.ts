"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  stock: number;
};

type CartState = {
  items: CartItem[];
  isOpen: boolean;
  /** Last change made by the assistant, shown as a toast in the cart drawer. */
  lastAdded: { name: string; at: number } | null;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
};

const MAX_PER_LINE = 10;
export const CART_STORAGE_KEY = "storecraft-cart";

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,
      lastAdded: null,
      addItem: (item, quantity = 1) =>
        set((state) => {
          const cap = Math.min(MAX_PER_LINE, item.stock);
          if (cap <= 0) return state;
          const existing = state.items.find((i) => i.productId === item.productId);
          const items = existing
            ? state.items.map((i) =>
                i.productId === item.productId
                  ? { ...i, ...item, quantity: Math.min(cap, i.quantity + quantity) }
                  : i,
              )
            : [...state.items, { ...item, quantity: Math.min(cap, quantity) }];
          return { items, lastAdded: { name: item.name, at: Date.now() } };
        }),
      setQuantity: (productId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.productId !== productId)
              : state.items.map((i) =>
                  i.productId === productId
                    ? { ...i, quantity: Math.min(quantity, MAX_PER_LINE, i.stock) }
                    : i,
                ),
        })),
      removeItem: (productId) =>
        set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),
      clear: () => set({ items: [] }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
    }),
    {
      name: CART_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ items: s.items }),
      skipHydration: true,
    },
  ),
);

export const cartCount = (items: CartItem[]) => items.reduce((n, i) => n + i.quantity, 0);
export const cartSubtotal = (items: CartItem[]) =>
  Math.round(items.reduce((sum, i) => sum + i.price * i.quantity, 0) * 100) / 100;
