import { defineArrayMember, defineField, defineType } from "sanity";

export const product = defineType({
  name: "product",
  title: "Product",
  type: "document",
  groups: [
    { name: "details", title: "Details", default: true },
    { name: "inventory", title: "Variants & inventory" },
    { name: "media", title: "Media" },
    { name: "reviews", title: "Reviews" },
  ],
  fields: [
    defineField({ name: "name", type: "string", group: "details", validation: (r) => r.required() }),
    defineField({
      name: "slug",
      type: "slug",
      group: "details",
      options: { source: "name", maxLength: 96 },
      validation: (r) => r.required(),
    }),
    defineField({ name: "brand", type: "string", group: "details" }),
    defineField({
      name: "category",
      type: "reference",
      group: "details",
      to: [{ type: "category" }],
      validation: (r) => r.required(),
    }),
    defineField({
      name: "price",
      type: "number",
      group: "details",
      description: "Price in USD. Variants use this price unless they set their own.",
      validation: (r) => r.required().positive().precision(2),
    }),
    defineField({ name: "compareAtPrice", title: "Compare-at price", type: "number", group: "details" }),
    defineField({ name: "description", type: "text", rows: 4, group: "details" }),
    defineField({
      name: "tags",
      type: "array",
      group: "details",
      of: [{ type: "string" }],
      options: { layout: "tags" },
    }),
    defineField({ name: "rating", type: "number", group: "details", validation: (r) => r.min(0).max(5) }),
    defineField({ name: "featured", type: "boolean", group: "details", initialValue: false }),

    defineField({
      name: "optionName",
      title: "Option name",
      type: "string",
      group: "inventory",
      description: 'What the variants differ by, e.g. "Size" or "Storage". Leave empty if there is only one variant.',
    }),
    defineField({
      name: "variants",
      type: "array",
      group: "inventory",
      description: "Each variant has its own stock. Every product needs at least one.",
      initialValue: [{ _key: "default", title: "Default", stock: 0 }],
      validation: (r) => r.required().min(1),
      of: [
        defineArrayMember({
          type: "object",
          name: "variant",
          fields: [
            defineField({ name: "title", type: "string", validation: (r) => r.required() }),
            defineField({ name: "sku", title: "SKU", type: "string" }),
            defineField({
              name: "price",
              type: "number",
              description: "Leave empty to use the product price.",
              validation: (r) => r.positive().precision(2),
            }),
            defineField({
              name: "stock",
              type: "number",
              initialValue: 0,
              validation: (r) => r.required().integer().min(0),
            }),
          ],
          preview: {
            select: { title: "title", stock: "stock", price: "price", sku: "sku" },
            prepare: ({ title, stock, price, sku }) => ({
              title,
              subtitle: [sku, price != null ? `$${price}` : null, `${stock ?? 0} in stock`]
                .filter(Boolean)
                .join(" · "),
            }),
          },
        }),
      ],
    }),

    defineField({
      name: "images",
      type: "array",
      group: "media",
      of: [defineArrayMember({ type: "image", options: { hotspot: true } })],
      validation: (r) => r.min(1),
    }),

    defineField({
      name: "reviews",
      type: "array",
      group: "reviews",
      of: [
        defineArrayMember({
          type: "object",
          name: "review",
          fields: [
            defineField({ name: "reviewerName", type: "string" }),
            defineField({ name: "rating", type: "number", validation: (r) => r.min(1).max(5) }),
            defineField({ name: "comment", type: "text", rows: 2 }),
            defineField({ name: "date", type: "datetime" }),
          ],
        }),
      ],
    }),
  ],
  preview: {
    select: {
      title: "name",
      subtitle: "category.title",
      media: "images.0",
      price: "price",
    },
    prepare: ({ title, subtitle, media, price }) => ({
      title,
      subtitle: `${subtitle ?? "Uncategorized"} · $${price ?? "?"}`,
      media,
    }),
  },
});
