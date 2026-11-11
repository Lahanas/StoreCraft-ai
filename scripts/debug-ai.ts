/**
 * Quick check that the AI model responds and can call tools.
 *   npx tsx scripts/debug-ai.ts
 */
import { config } from "dotenv";
import { google } from "@ai-sdk/google";
import { isStepCount, streamText, tool } from "ai";
import { z } from "zod";

config({ path: ".env.local" });

async function main() {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const modelId = process.env.GOOGLE_MODEL ?? "gemini-flash-lite-latest";
  console.log(`Key set: ${key ? "yes (" + key.slice(0, 3) + "…)" : "NO"} | model: ${modelId}`);

  const result = streamText({
    model: google(modelId),
    system: "You are a shopping assistant. Use the searchProducts tool to find products.",
    prompt: "find headphones under $150",
    tools: {
      searchProducts: tool({
        description: "Search the catalog",
        inputSchema: z.object({ query: z.string(), maxPrice: z.number().optional() }),
        execute: async (input) => {
          console.log("→ tool called with", input);
          return { products: [{ id: "p1", name: "Wireless Headphones Classic", price: 129 }] };
        },
      }),
    },
    stopWhen: isStepCount(3),
  });

  for await (const part of result.fullStream) {
    if (part.type === "text-delta") process.stdout.write(part.text);
    else if (part.type === "error") console.log("\nERROR:", part.error);
    else if (part.type === "finish-step") console.log(`\n[step done: ${part.finishReason}]`);
  }
  console.log("\nDone.");
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
