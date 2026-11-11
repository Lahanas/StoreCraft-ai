import "server-only";
import { google } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

/**
 * Picks the model for the shopping assistant.
 *
 * - If GOOGLE_GENERATIVE_AI_API_KEY is set, Gemini is called directly (free tier, no card).
 *   Override the model with GOOGLE_MODEL (default: gemini-flash-lite-latest).
 * - Otherwise the Vercel AI Gateway is used with AI_MODEL (any gateway model id).
 */
export function getChatModel(): LanguageModel {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return google(process.env.GOOGLE_MODEL ?? "gemini-flash-lite-latest");
  }
  return process.env.AI_MODEL ?? "anthropic/claude-sonnet-5.5";
}
