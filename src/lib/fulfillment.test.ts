import { describe, expect, it, vi } from "vitest";
import {
  buildOrder,
  fulfillOrder,
  OrderExistsError,
  type OrderDoc,
  type OrderStore,
  type PaidLineItem,
  type PaidSession,
  type StockDecrement,
} from "./fulfillment";

const session: PaidSession = {
  id: "cs_test_a1b2c3d4e5f6g7h8",
  paymentIntentId: "pi_123",
  clerkUserId: "user_1",
  email: "shopper@example.com",
  amountSubtotal: 15998,
  amountDiscount: 1600,
  amountTotal: 14398,
  currency: "usd",
  created: 1_794_384_000,
  discountCode: "WELCOME10",
};

const lineItems: PaidLineItem[] = [
  { productId: "product-1", variantKey: "m", variantTitle: "M", name: "Man Plaid Shirt", quantity: 2, unitAmount: 3499 },
  { productId: "product-2", variantKey: "128gb", variantTitle: "128 GB", name: "iPhone", quantity: 1, unitAmount: 9000 },
];

/**
 * In-memory store with the same guarantees as the Sanity one: creating an order and applying
 * its stock changes happen together, and creating an existing order id fails.
 */
function memoryStore(initialStock: Record<string, number>) {
  const orders = new Map<string, OrderDoc>();
  const stock = { ...initialStock };
  const discountUses: Record<string, number> = {};
  const store: OrderStore = {
    async orderExists(id) {
      return orders.has(id);
    },
    async commitOrder(order, decrements: StockDecrement[], code) {
      await Promise.resolve(); // let concurrent callers interleave
      if (orders.has(order._id)) throw new OrderExistsError(order._id);
      orders.set(order._id, order);
      for (const d of decrements) stock[`${d.productId}:${d.variantKey}`] -= d.quantity;
      if (code) discountUses[code] = (discountUses[code] ?? 0) + 1;
    },
  };
  return { store, orders, stock, discountUses };
}

describe("buildOrder", () => {
  it("derives the order id from the Checkout Session and converts cents", () => {
    const { order } = buildOrder(session, lineItems, "evt_1");
    expect(order._id).toBe("order-cs_test_a1b2c3d4e5f6g7h8");
    expect(order.orderNumber).toBe("D4E5F6G7H8");
    expect(order).toMatchObject({
      subtotal: 159.98,
      discountCode: "WELCOME10",
      discountAmount: 16,
      total: 143.98,
      currency: "USD",
      stripeEventId: "evt_1",
    });
    expect(order.items[0]).toMatchObject({ variantTitle: "M", quantity: 2, unitPrice: 34.99 });
  });

  it("merges stock decrements per variant and skips lines without ids", () => {
    const { decrements } = buildOrder(
      session,
      [
        ...lineItems,
        { ...lineItems[0], quantity: 1 },
        { productId: "", variantKey: "", name: "Mystery", quantity: 1, unitAmount: 100 },
      ],
      "evt_1",
    );
    expect(decrements).toEqual([
      { productId: "product-1", variantKey: "m", quantity: 3 },
      { productId: "product-2", variantKey: "128gb", quantity: 1 },
    ]);
  });
});

describe("fulfillOrder", () => {
  it("creates the order and decrements stock once", async () => {
    const { store, orders, stock, discountUses } = memoryStore({ "product-1:m": 10, "product-2:128gb": 5 });
    await expect(fulfillOrder(store, session, async () => lineItems, "evt_1")).resolves.toBe("created");
    expect(orders.size).toBe(1);
    expect(stock).toEqual({ "product-1:m": 8, "product-2:128gb": 4 });
    expect(discountUses).toEqual({ WELCOME10: 1 });
  });

  it("ignores a repeated delivery of the same event", async () => {
    const { store, orders, stock } = memoryStore({ "product-1:m": 10, "product-2:128gb": 5 });
    const load = vi.fn(async () => lineItems);
    await fulfillOrder(store, session, load, "evt_1");
    await expect(fulfillOrder(store, session, load, "evt_1")).resolves.toBe("duplicate");
    // A different event for the same session (e.g. async_payment_succeeded) is also a duplicate.
    await expect(fulfillOrder(store, session, load, "evt_2")).resolves.toBe("duplicate");
    expect(orders.size).toBe(1);
    expect(stock).toEqual({ "product-1:m": 8, "product-2:128gb": 4 });
    expect(load).toHaveBeenCalledTimes(1); // retries exit before calling Stripe again
  });

  it("creates exactly one order when deliveries race", async () => {
    const { store, orders, stock, discountUses } = memoryStore({ "product-1:m": 10, "product-2:128gb": 5 });
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => fulfillOrder(store, session, async () => lineItems, `evt_${i}`)),
    );
    expect(results.filter((r) => r === "created")).toHaveLength(1);
    expect(results.filter((r) => r === "duplicate")).toHaveLength(4);
    expect(orders.size).toBe(1);
    expect(stock).toEqual({ "product-1:m": 8, "product-2:128gb": 4 });
    expect(discountUses).toEqual({ WELCOME10: 1 });
  });

  it("lets other errors through so Stripe retries", async () => {
    const store: OrderStore = {
      orderExists: async () => false,
      commitOrder: async () => {
        throw new Error("Sanity is down");
      },
    };
    await expect(fulfillOrder(store, session, async () => lineItems, "evt_1")).rejects.toThrow("Sanity is down");
  });
});
