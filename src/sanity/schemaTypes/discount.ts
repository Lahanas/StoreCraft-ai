import { defineField, defineType } from "sanity";

/** Discount codes customers can enter in the cart. Checked again on the server at checkout. */
export const discount = defineType({
  name: "discount",
  title: "Discount code",
  type: "document",
  fields: [
    defineField({
      name: "code",
      type: "string",
      description: "What customers type, in capitals, e.g. WELCOME10.",
      validation: (r) =>
        r
          .required()
          .regex(/^[A-Z0-9_-]{3,32}$/, { name: "code" })
          .error("Use 3–32 capital letters, digits, - or _."),
    }),
    defineField({ name: "description", type: "string" }),
    defineField({
      name: "type",
      type: "string",
      options: {
        list: [
          { title: "Percentage off", value: "percentage" },
          { title: "Fixed amount off (USD)", value: "fixed" },
        ],
        layout: "radio",
      },
      initialValue: "percentage",
      validation: (r) => r.required(),
    }),
    defineField({ name: "value", type: "number", validation: (r) => r.required().positive() }),
    defineField({ name: "minSubtotal", title: "Minimum subtotal (USD)", type: "number" }),
    defineField({ name: "active", type: "boolean", initialValue: true }),
    defineField({ name: "startsAt", type: "datetime" }),
    defineField({ name: "endsAt", type: "datetime" }),
    defineField({
      name: "usageLimit",
      type: "number",
      description: "Total number of orders that can use this code. Empty means unlimited.",
    }),
    defineField({
      name: "timesUsed",
      type: "number",
      readOnly: true,
      initialValue: 0,
      description: "Updated by the Stripe webhook when an order is paid.",
    }),
  ],
  preview: {
    select: { title: "code", type: "type", value: "value", active: "active", used: "timesUsed" },
    prepare: ({ title, type, value, active, used }) => ({
      title,
      subtitle: `${type === "fixed" ? `$${value}` : `${value}%`} off · used ${used ?? 0}× ${active ? "" : "· inactive"}`,
    }),
  },
});
