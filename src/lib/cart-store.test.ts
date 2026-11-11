import { beforeEach, describe, expect, it } from "vitest";
import { cartCount, useCart, type NewCartItem } from "./cart-store";

const shirtM: NewCartItem = {
  productId: "product-1",
  variantKey: "m",
  variantTitle: "M",
  slug: "man-plaid-shirt",
  name: "Man Plaid Shirt",
  price: 34.99,
  image: "/placeholder.svg",
  stock: 3,
};
const shirtL: NewCartItem = { ...shirtM, variantKey: "l", variantTitle: "L", stock: 20 };

describe("cart store", () => {
  beforeEach(() => useCart.getState().clear());

  it("keeps one line per variant", () => {
    const { addItem } = useCart.getState();
    addItem(shirtM);
    addItem(shirtL, 2);
    addItem(shirtM);
    const items = useCart.getState().items;
    expect(items.map((i) => [i.id, i.quantity])).toEqual([
      ["product-1:m", 2],
      ["product-1:l", 2],
    ]);
    expect(cartCount(items)).toBe(4);
  });

  it("caps quantity at the variant's stock and at 10 per line", () => {
    const { addItem, setQuantity } = useCart.getState();
    addItem(shirtM, 5);
    expect(useCart.getState().items[0].quantity).toBe(3);
    addItem(shirtL, 50);
    setQuantity("product-1:l", 15);
    expect(useCart.getState().items[1].quantity).toBe(10);
  });

  it("ignores sold-out variants", () => {
    useCart.getState().addItem({ ...shirtM, stock: 0 });
    expect(useCart.getState().items).toEqual([]);
  });

  it("removes a line when its quantity drops to zero", () => {
    const { addItem, setQuantity } = useCart.getState();
    addItem(shirtM);
    setQuantity("product-1:m", 0);
    expect(useCart.getState().items).toEqual([]);
  });

  it("clears the discount with the cart", () => {
    const { applyDiscount, addItem, clear } = useCart.getState();
    addItem(shirtM);
    applyDiscount({ code: "WELCOME10", type: "percentage", value: 10, active: true });
    clear();
    expect(useCart.getState()).toMatchObject({ items: [], discount: null });
  });
});
