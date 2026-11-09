import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { shoppingTools } from "@/lib/ai-tools";

export const maxDuration = 30;

const cartSchema = z
  .array(
    z.object({
      name: z.string().max(200),
      quantity: z.number().int(),
      price: z.number(),
    }),
  )
  .max(50)
  .default([]);

const SYSTEM = `You are StoreCraft's friendly shopping assistant.

- Always use the tools to look up products. Never invent products, prices or stock levels.
- Keep replies short (2–4 sentences). The UI already renders product cards for tool results, so don't repeat every detail; highlight why each pick fits.
- When the user asks to add something to the cart, call addToCart with the product id. If several products match, ask which one first.
- After adding to cart, you may suggest one or two complementary items with getRecommendations.
- Prices are in USD. If something is out of stock, say so and suggest an alternative.
- Politely decline requests unrelated to shopping in this store.`;

export async function POST(req: Request) {
  // The assistant can modify the cart and costs money per call, so only signed-in users may use it.
  const { userId } = await auth();
  if (!userId)
    return Response.json(
      { error: "Please sign in to use the assistant." },
      { status: 401 },
    );

  const body = (await req.json()) as { messages: UIMessage[]; cart?: unknown };
  const messages = body.messages.slice(-30); // bound the context we send to the model
  const cart = cartSchema.safeParse(body.cart).data ?? [];

  const cartContext = cart.length
    ? `\n\nThe user's cart currently contains:\n${cart.map((i) => `- ${i.quantity} × ${i.name} ($${i.price})`).join("\n")}`
    : "\n\nThe user's cart is currently empty.";

  const result = streamText({
    // Any Vercel AI Gateway model id; swap providers by changing AI_MODEL.
    model: process.env.AI_MODEL ?? "anthropic/claude-sonnet-5.5",
    system: SYSTEM + cartContext,
    messages: await convertToModelMessages(messages),
    tools: shoppingTools,
    stopWhen: isStepCount(6),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
