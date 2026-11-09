import { defineArrayMember, defineField, defineType } from "sanity";

/**
 * Orders are written only by the Stripe webhook. The document _id is derived from the
 * Checkout Session id, which is what makes webhook processing idempotent.
 */
export const order = defineType({
  name: "order",
  title: "Order",
  type: "document",
  readOnly: true,
  fields: [
    defineField({ name: "orderNumber", type: "string" }),
    defineField({ name: "stripeCheckoutSessionId", type: "string" }),
    defineField({ name: "stripePaymentIntentId", type: "string" }),
    defineField({ name: "stripeEventId", type: "string" }),
    defineField({ name: "clerkUserId", type: "string" }),
    defineField({ name: "email", type: "string" }),
    defineField({
      name: "status",
      type: "string",
      options: { list: ["paid", "fulfilled", "refunded"] },
    }),
    defineField({ name: "total", type: "number" }),
    defineField({ name: "currency", type: "string" }),
    defineField({ name: "createdAt", type: "datetime" }),
    defineField({
      name: "items",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({ name: "productId", type: "string" }),
            defineField({ name: "name", type: "string" }),
            defineField({ name: "quantity", type: "number" }),
            defineField({ name: "unitPrice", type: "number" }),
          ],
        }),
      ],
    }),
  ],
  preview: {
    select: { title: "orderNumber", subtitle: "email", total: "total" },
    prepare: ({ title, subtitle, total }) => ({
      title: `#${title}`,
      subtitle: `${subtitle ?? ""} · $${total ?? 0}`,
    }),
  },
});
