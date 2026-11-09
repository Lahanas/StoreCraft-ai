"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart-store";

export function ClearCartOnMount() {
  useEffect(() => {
    // Wait for the persisted cart to load, then clear it (also clears other open tabs).
    const clear = () => useCart.getState().clear();
    if (useCart.persist.hasHydrated()) clear();
    else return useCart.persist.onFinishHydration(clear);
  }, []);
  return null;
}
