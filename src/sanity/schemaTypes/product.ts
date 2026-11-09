import { defineField, defineType } from "sanity";

export const product = defineType({
  name: "product",
  title: "Product",
  type: "document",
  fields: [
    defineField({ name: "name", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "slug",
      type: "slug",
      options: { source: "name", maxLength: 96 },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "category",
      type: "reference",
      to: [{ type: "category" }],
      validation: (r) => r.required(),
    }),
    defineField({
      name: "price",
      type: "number",
      description: "Price in USD (major units)",
      validation: (r) => r.required().positive().precision(2),
    }),
    defineField({ name: "compareAtPrice", title: "Compare-at price", type: "number" }),
    defineField({ name: "description", type: "text", rows: 4 }),
    defineField({ name: "image", type: "image", options: { hotspot: true } }),
    defineField({
      name: "imageUrl",
      title: "External image URL",
      type: "url",
      description: "Used when no image is uploaded (seed data uses this).",
    }),
    defineField({
      name: "stock",
      type: "number",
      initialValue: 0,
      validation: (r) => r.required().integer().min(0),
    }),
    defineField({ name: "rating", type: "number", validation: (r) => r.min(0).max(5) }),
    defineField({
      name: "tags",
      type: "array",
      of: [{ type: "string" }],
      options: { layout: "tags" },
    }),
    defineField({ name: "featured", type: "boolean", initialValue: false }),
  ],
  preview: {
    select: {
      title: "name",
      subtitle: "category.title",
      media: "image",
      price: "price",
      stock: "stock",
    },
    prepare: ({ title, subtitle, media, price, stock }) => ({
      title,
      subtitle: `${subtitle ?? "Uncategorized"} · $${price ?? "?"} · ${stock ?? 0} in stock`,
      media,
    }),
  },
});
