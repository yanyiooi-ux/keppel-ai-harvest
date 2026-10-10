/**
 * ai-ping.ts: send one tiny streamed message to the model, print the model id
 * and the time to first reply.
 *
 * Rules (spec S15, S0 rules 4 and 12):
 * - Imports ai-core.ts, never ai.ts (server-only throws outside Next).
 * - Loads web/.env.local itself with loadEnvConfig from @next/env, passing a
 *   no-op logger so it never prints the file path.
 * - Ignores REPLAY_MODE: with a key it always calls the model.
 * - Never prints the key, base URL, header, file path, err.message or the
 *   error object. On error: only the HTTP status and "AI unavailable".
 * - Empty key: print "key: empty" and stop.
 * - No reply in 5 s: say so plainly.
 */

import { loadEnvConfig } from "@next/env";
import { getClient, getModel, hasKey, _resetClient } from "../lib/ai-core";

// Load the env file with a no-op logger so the file path is never printed.
loadEnvConfig(process.cwd(), false, { info() {}, error() {} });

// The client may have been cached before env loaded; clear it.
_resetClient();

const TIMEOUT_MS = 5000;

async function main() {
  const model = getModel();

  if (!hasKey()) {
    console.log("key: empty");
    return;
  }

  // Model id must be set.
  if (!model) {
    console.log("model: empty (LLM_MODEL is not set)");
    return;
  }

  const client = getClient();
  const startTime = Date.now();

  // Abort the stream after the timeout so we don't hang forever.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const stream = await client.chat.completions.create(
      {
        model,
        messages: [{ role: "user", content: "Say OK." }],
        stream: true,
        max_tokens: 10,
      },
      { signal: controller.signal }
    );

    let firstChunkTime: number | null = null;

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta && delta.length > 0) {
        if (firstChunkTime === null) {
          firstChunkTime = Date.now() - startTime;
        }
        break; // we have the first reply
      }
    }

    if (firstChunkTime === null) {
      console.log(
        `model: ${model}, no reply in ${TIMEOUT_MS / 1000} s`
      );
      return;
    }

    console.log(`model: ${model}, first reply: ${firstChunkTime} ms`);
  } catch (err: unknown) {
    // S0 rule 12: only the HTTP status and "AI unavailable". Never
    // err.message, the error object, headers, the base URL or the client
    // config.
    const elapsed = Date.now() - startTime;

    if (elapsed >= TIMEOUT_MS) {
      console.log(
        `model: ${model}, no reply in ${TIMEOUT_MS / 1000} s`
      );
      return;
    }

    const status =
      err && typeof err === "object" && "status" in err
        ? (err as { status: number }).status
        : null;

    if (status !== null) {
      console.log(`${status} AI unavailable`);
    } else {
      console.log("AI unavailable");
    }
  } finally {
    clearTimeout(timer);
  }
}

main().then(() => process.exit(0));
