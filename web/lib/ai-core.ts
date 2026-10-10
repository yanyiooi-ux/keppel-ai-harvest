/**
 * ai-core.ts: the one OpenAI-compatible client for Tencent Cloud TokenHub (Hunyuan).
 *
 * Rules (spec S15, S0 rule 4):
 * - NO `import "server-only"` here. Scripts import this file directly with tsx.
 * - Never loads the env file itself. Reads process.env at call time.
 * - Never NEXT_PUBLIC_.
 * - Nobody prints the key, base URL or any value from the env file.
 */

import OpenAI from "openai";

/** Max tokens for every AI call (spec S15: 600 so hy3 has room after thinking). */
export const AI_MAX_TOKENS = 600;

/** Timeout for every AI call in ms (spec S15: 8 s). */
export const AI_TIMEOUT_MS = 8000;

let cachedClient: OpenAI | null = null;

/**
 * Returns the one OpenAI client. Reads env at call time so tests can stub
 * process.env before importing.
 */
export function getClient(): OpenAI {
  if (cachedClient) return cachedClient;
  const baseURL = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY ?? "";
  cachedClient = new OpenAI({ baseURL, apiKey });
  return cachedClient;
}

/** The model id, from LLM_MODEL (spec says Hunyuan hy3). */
export function getModel(): string {
  return process.env.LLM_MODEL ?? "";
}

/** True when the key is set (non-empty). */
export function hasKey(): boolean {
  return (process.env.LLM_API_KEY ?? "").length > 0;
}

/** Clear the cached client (for tests). */
export function _resetClient(): void {
  cachedClient = null;
}
