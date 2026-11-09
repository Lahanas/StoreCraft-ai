"use client";

import { useEffect } from "react";
import { CART_STORAGE_KEY, useCart } from "@/lib/cart-store";

/**
 * Hydrates the persisted cart after mount (avoids SSR mismatches) and keeps every open
 * tab in sync in real time: a change in one tab fires a `storage` event in the others,
 * which rehydrate from localStorage immediately.
 */
export function CartSync() {
  useEffect(() => {
    void useCart.persist.rehydrate();
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY) void useCart.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return null;
}
