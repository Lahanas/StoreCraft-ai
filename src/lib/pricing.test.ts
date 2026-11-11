import { describe, expect, it } from "vitest";
import { cartTotals, evaluateDiscount, normalizeCode, subtotalOf, type DiscountRule } from "./pricing";

const percent10: DiscountRule = { code: "WELCOME10", type: "percentage", value: 10, active: true };
const save25: DiscountRule = { code: "SAVE25", type: "fixed", value: 25, minSubtotal: 150, active: true };

describe("subtotalOf", () => {
  it("sums price × quantity without float drift", () => {
    expect(subtotalOf([{ price: 0.1, quantity: 3 }])).toBe(0.3);
    expect(subtotalOf([{ price: 19.99, quantity: 3 }, { price: 5.01, quantity: 1 }])).toBe(64.98);
  });
});

describe("evaluateDiscount", () => {
  it("applies a percentage discount, rounded to cents", () => {
    expect(evaluateDiscount(percent10, 89.99)).toEqual({ ok: true, amount: 9 });
    expect(evaluateDiscount(percent10, 33.33)).toEqual({ ok: true, amount: 3.33 });
  });

  it("applies a fixed discount only above the minimum subtotal", () => {
    expect(evaluateDiscount(save25, 149.99)).toMatchObject({ ok: false, reason: expect.stringContaining("$150.00") });
    expect(evaluateDiscount(save25, 150)).toEqual({ ok: true, amount: 25 });
  });

  it("never discounts more than the subtotal", () => {
    const big: DiscountRule = { code: "BIG", type: "fixed", value: 500, active: true };
    expect(evaluateDiscount(big, 40)).toEqual({ ok: true, amount: 40 });
    const over: DiscountRule = { code: "OVER", type: "percentage", value: 150, active: true };
    expect(evaluateDiscount(over, 40)).toEqual({ ok: true, amount: 40 });
  });

  it("rejects missing, inactive, expired, not-yet-started and used-up codes", () => {
    const now = new Date("2026-11-11T12:00:00Z");
    expect(evaluateDiscount(null, 100, now).ok).toBe(false);
    expect(evaluateDiscount({ ...percent10, active: false }, 100, now).ok).toBe(false);
    expect(evaluateDiscount({ ...percent10, endsAt: "2026-08-31T23:59:59Z" }, 100, now)).toMatchObject({
      ok: false,
      reason: "This code has expired.",
    });
    expect(evaluateDiscount({ ...percent10, startsAt: "2026-12-01T00:00:00Z" }, 100, now)).toMatchObject({
      ok: false,
      reason: "This code isn't active yet.",
    });
    expect(evaluateDiscount({ ...percent10, usageLimit: 5, timesUsed: 5 }, 100, now).ok).toBe(false);
    expect(evaluateDiscount({ ...percent10, usageLimit: 5, timesUsed: 4 }, 100, now).ok).toBe(true);
  });

  it("rejects non-positive values", () => {
    expect(evaluateDiscount({ ...percent10, value: 0 }, 100).ok).toBe(false);
    expect(evaluateDiscount({ ...percent10, value: -5 }, 100).ok).toBe(false);
  });
});

describe("cartTotals", () => {
  const lines = [
    { price: 129.99, quantity: 1 },
    { price: 24.5, quantity: 2 },
  ];

  it("returns the subtotal as the total when there is no discount", () => {
    expect(cartTotals(lines)).toMatchObject({ subtotal: 178.99, discountAmount: 0, total: 178.99 });
  });

  it("subtracts a valid discount", () => {
    expect(cartTotals(lines, save25)).toMatchObject({ subtotal: 178.99, discountAmount: 25, total: 153.99 });
  });

  it("ignores a discount that doesn't apply but reports why", () => {
    const totals = cartTotals([{ price: 20, quantity: 1 }], save25);
    expect(totals.total).toBe(20);
    expect(totals.discount).toMatchObject({ ok: false });
  });
});

describe("normalizeCode", () => {
  it("trims and upper-cases", () => {
    expect(normalizeCode("  welcome10 ")).toBe("WELCOME10");
  });
});
