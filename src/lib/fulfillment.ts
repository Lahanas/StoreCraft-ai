/**
 * Order fulfilment for paid Stripe Checkout Sessions, kept free of Stripe and Sanity imports so
 * the idempotency rules can be unit tested with an in-memory store.
 *
 * Stripe delivers webhooks at least once, so the same session can arrive several times, even
 * concurrently. Each session maps to one order id (`order-<session id>`). The store must create
 * the order, decrement stock and count the discount use in one atomic step that fails with
 * `OrderExistsError` if the order already exists. A repeat delivery therefore changes nothing.
 */

export class OrderExistsError extends Error {
  constructor(orderId: string) {
    super(`Order ${orderId} already exists`);
    this.name = "OrderExistsError";
  }
}

export type PaidSession = {
  id: string;
  paymentIntentId?: string;
  clerkUserId: string;
  email: string;
  /** Amounts in cents, as Stripe reports them. */
  amountSubtotal: number;
  amountDiscount: number;
  amountTotal: number;
  currency: string;
  /** Unix seconds. */
  created: number;
  discountCode?: string;
};

export type PaidLineItem = {
  productId: string;
  variantKey: string;
  variantTitle?: string;
  name: string;
  quantity: number;
  /** Cents. */
  unitAmount: number;
};

export type StockDecrement = { productId: string; variantKey: string; quantity: number };

export type OrderDoc = {
  _id: string;
  _type: "order";
  orderNumber: string;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId?: string;
  stripeEventId: string;
  clerkUserId: string;
  email: string;
  status: "paid";
  subtotal: number;
  discountCode?: string;
  discountAmount: number;
  total: number;
  currency: string;
  createdAt: string;
  items: {
    _key: string;
    productId: string;
    variantKey: string;
    variantTitle?: string;
    name: string;
    quantity: number;
    unitPrice: number;
  }[];
};

export interface OrderStore {
  orderExists(orderId: string): Promise<boolean>;
  /** Must be atomic, and must throw OrderExistsError if the order id is taken. */
  commitOrder(order: OrderDoc, decrements: StockDecrement[], discountCode?: string): Promise<void>;
}

export const orderIdFor = (sessionId: string) => `order-${sessionId}`;

export function buildOrder(session: PaidSession, items: PaidLineItem[], eventId: string) {
  const order: OrderDoc = {
    _id: orderIdFor(session.id),
    _type: "order",
    orderNumber: session.id.slice(-10).toUpperCase(),
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: session.paymentIntentId,
    stripeEventId: eventId,
    clerkUserId: session.clerkUserId,
    email: session.email,
    status: "paid",
    subtotal: session.amountSubtotal / 100,
    discountCode: session.discountCode,
    discountAmount: session.amountDiscount / 100,
    total: session.amountTotal / 100,
    currency: session.currency.toUpperCase(),
    createdAt: new Date(session.created * 1000).toISOString(),
    items: items.map((li, i) => ({
      _key: `item-${i}`,
      productId: li.productId,
      variantKey: li.variantKey,
      variantTitle: li.variantTitle,
      name: li.name,
      quantity: li.quantity,
      unitPrice: li.unitAmount / 100,
    })),
  };

  // Merge lines for the same variant so each stock field is patched once.
  const totals = new Map<string, StockDecrement>();
  for (const li of items) {
    if (!li.productId || !li.variantKey) continue;
    const id = `${li.productId}:${li.variantKey}`;
    const prev = totals.get(id);
    totals.set(id, { productId: li.productId, variantKey: li.variantKey, quantity: (prev?.quantity ?? 0) + li.quantity });
  }

  return { order, decrements: [...totals.values()] };
}

export async function fulfillOrder(
  store: OrderStore,
  session: PaidSession,
  loadLineItems: () => Promise<PaidLineItem[]>,
  eventId: string,
): Promise<"created" | "duplicate"> {
  // Cheap early exit for the common retry case. The atomic commit below is the real guard.
  if (await store.orderExists(orderIdFor(session.id))) return "duplicate";

  const { order, decrements } = buildOrder(session, await loadLineItems(), eventId);
  try {
    await store.commitOrder(order, decrements, session.discountCode);
    return "created";
  } catch (err) {
    if (err instanceof OrderExistsError) return "duplicate"; // a concurrent delivery won the race
    throw err;
  }
}
