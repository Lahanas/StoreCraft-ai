"use client";

import { useChat } from "@ai-sdk/react";
import { Show, SignInButton } from "@clerk/nextjs";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  type InferUITools,
  type UIDataTypes,
  type UIMessage,
} from "ai";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ProductSummary, ShoppingTools } from "@/lib/ai-tools";
import { useCart } from "@/lib/cart-store";
import { formatPrice } from "@/lib/money";

type StoreUIMessage = UIMessage<
  unknown,
  UIDataTypes,
  InferUITools<ShoppingTools>
>;

const SUGGESTIONS = [
  "Find wireless headphones under $150",
  "What should I pack for a weekend hike?",
  "Recommend a gift for a coffee lover",
];

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const addItem = useCart((s) => s.addItem);
  const openCart = useCart((s) => s.open);
  const applied = useRef(new Set<string>());
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error } = useChat<StoreUIMessage>({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const busy = status === "submitted" || status === "streaming";

  // Apply addToCart tool results to the real cart exactly once per tool call.
  useEffect(() => {
    for (const m of messages) {
      for (const part of m.parts) {
        if (part.type !== "tool-addToCart" || part.state !== "output-available")
          continue;
        if (applied.current.has(part.toolCallId)) continue;
        applied.current.add(part.toolCallId);
        const out = part.output;
        if (out.ok) {
          const p = out.product;
          addItem(
            {
              productId: p.id,
              variantKey: out.variant.key,
              variantTitle: out.variant.title,
              slug: p.slug,
              name: p.name,
              price: out.variant.price,
              image: p.image,
              stock: out.variant.stock,
            },
            out.quantity,
          );
        }
      }
    }
  }, [messages, addItem]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const cart = useCart
      .getState()
      .items.map((i) => ({
        name: i.name,
        variantTitle: i.variantTitle,
        quantity: i.quantity,
        price: i.price,
      }));
    void sendMessage({ text: trimmed }, { body: { cart } });
    setInput("");
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-40 flex h-14 items-center gap-2 rounded-full bg-indigo-600 px-5 font-medium text-white shadow-lg transition hover:bg-indigo-500"
        aria-expanded={open}
      >
        {open ? "Close" : "✨ Ask AI"}
      </button>

      {open && (
        <Show
          when="signed-in"
          fallback={
            <section className="fixed bottom-24 right-5 z-40 w-[min(360px,calc(100vw-2.5rem))] rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
              <p className="font-semibold">Shopping assistant</p>
              <p className="mt-2 text-sm text-zinc-500">
                Sign in to chat with the AI assistant. It can search, recommend
                and add items to your cart.
              </p>
              <SignInButton mode="modal">
                <button className="mt-4 rounded-full bg-indigo-600 px-5 py-2 text-sm font-medium text-white">
                  Sign in
                </button>
              </SignInButton>
            </section>
          }
        >
          <section
            className="fixed bottom-24 right-5 z-40 flex h-[min(600px,75vh)] w-[min(400px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
            aria-label="Shopping assistant"
          >
            <header className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <p className="font-semibold">Shopping assistant</p>
              <p className="text-xs text-zinc-500">
                Searches the catalog, recommends, and adds to your cart.
              </p>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
              {messages.length === 0 && (
                <div className="space-y-2">
                  <p className="text-zinc-500">
                    Hi! What are you shopping for today?
                  </p>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="block w-full rounded-xl border border-zinc-200 px-3 py-2 text-left hover:border-indigo-400 dark:border-zinc-800"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {messages.map((m) => (
                <div
                  key={m.id}
                  className={
                    m.role === "user" ? "flex justify-end" : "space-y-2"
                  }
                >
                  {m.parts.map((part, i) => {
                    if (part.type === "text") {
                      return (
                        <p
                          key={i}
                          className={`whitespace-pre-wrap ${
                            m.role === "user"
                              ? "max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-600 px-3 py-2 text-white"
                              : ""
                          }`}
                        >
                          {part.text}
                        </p>
                      );
                    }
                    if (!isToolUIPart(part)) return null;
                    const name = getToolName(part);

                    if (
                      part.state === "input-streaming" ||
                      part.state === "input-available"
                    ) {
                      return (
                        <p
                          key={i}
                          className="animate-pulse text-xs text-zinc-500"
                        >
                          {TOOL_LABELS[name] ?? "Working"}…
                        </p>
                      );
                    }
                    if (part.state === "output-error") {
                      return (
                        <p key={i} className="text-xs text-rose-600">
                          Tool error: {part.errorText}
                        </p>
                      );
                    }
                    if (part.state !== "output-available") return null;

                    if (
                      part.type === "tool-searchProducts" ||
                      part.type === "tool-getRecommendations"
                    ) {
                      const products =
                        ("products" in part.output
                          ? part.output.products
                          : undefined) ?? [];
                      return <ProductStrip key={i} products={products} />;
                    }
                    if (part.type === "tool-addToCart") {
                      const out = part.output;
                      return out.ok ? (
                        <button
                          key={i}
                          onClick={openCart}
                          className="w-full rounded-xl bg-emerald-50 px-3 py-2 text-left text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                        >
                          ✓ Added {out.quantity} × {out.product.name}
                          {out.variant.title && ` (${out.variant.title})`} to
                          your cart. View cart →
                        </button>
                      ) : out.options ? null : (
                        <p key={i} className="text-xs text-rose-600">
                          {out.error}
                        </p>
                      );
                    }
                    return null;
                  })}
                </div>
              ))}

              {error && (
                <p className="text-xs text-rose-600">
                  {error.message || "Something went wrong. Please try again."}
                </p>
              )}
              <div ref={bottomRef} />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about products…"
                className="flex-1 rounded-full border border-zinc-300 bg-transparent px-4 py-2 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700"
              />
              <button
                disabled={busy || !input.trim()}
                className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </section>
        </Show>
      )}
    </>
  );
}

const TOOL_LABELS: Record<string, string> = {
  searchProducts: "Searching the catalog",
  getRecommendations: "Finding recommendations",
  getProductDetails: "Checking product details",
  listCategories: "Looking at categories",
  addToCart: "Adding to cart",
};

function ProductStrip({ products }: { products: ProductSummary[] }) {
  if (products.length === 0)
    return <p className="text-xs text-zinc-500">No matching products.</p>;
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
      {products.map((p) => (
        <Link
          key={p.id}
          href={p.url}
          className="w-32 shrink-0 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
        >
          <div className="relative aspect-square bg-zinc-100">
            <Image
              src={p.image}
              alt={p.name}
              fill
              sizes="128px"
              className="object-cover"
            />
          </div>
          <div className="p-2">
            <p className="line-clamp-2 text-xs font-medium">{p.name}</p>
            <p className="mt-1 text-xs text-zinc-500">{formatPrice(p.price)}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
