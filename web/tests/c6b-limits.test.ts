/**
 * C6b: the record path gets its own limits (S15, record-time limits).
 *
 * hy3 thinks first, and on the demo's longer prompts S15's 600 tokens and 8 s
 * left no room for the answer: 16 of 16 record calls gave no answer. Recording
 * runs offline before the demo, so `npm run ai:record` may wait longer and allow
 * more tokens. The live app keeps 600 tokens and 8 s; on Live it falls back to
 * the saved answer with its banner, which is what replay is for.
 *
 * Fake clients only. tests/setup.ts keeps the key empty and the network blocked,
 * and tests/setup-replay.ts points the replay folder at an empty temp folder.
 * Every saved answer here goes into the test's own temp folder.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, readdirSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  AI_MAX_TOKENS,
  AI_TIMEOUT_MS,
  AI_RECORD_MAX_TOKENS,
  AI_RECORD_TIMEOUT_MS,
  openAiModelClient,
  recordModelClient,
  rankWording,
  type ModelClient,
} from "../lib/ai";
import { demoRecordTargets, recordMissing } from "../lib/ai-demo-targets";
import { loadPill } from "../lib/pill";
import * as memory from "../lib/memory";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");
const SECRET = "FAKE-TEST-SECRET";
const v10 = loadPill("ts-cc", "1.0");

const DEMO_FIX =
  "If the zone had a fit-out in the last 12 months, check where the thermostat sits against the fit-out drawing before any nudge.";
const DEMO_WHY =
  "The fit-out 8 months ago moved the core thermostat next to the new printer bay, so it reads warm and the box keeps cooling the open area.";

/** Passes S13 and S14 for any lead: no number, no rule id, no blocked word. */
const GOOD_RANK = "This is the best first check for this spot.";

function ownTempDir(): string {
  return mkdtempSync(join(tmpdir(), "c6b-limits-"));
}

/** A fake OpenAI client that streams the given chunks and keeps every request body. */
function fakeOpenAi(chunks: unknown[]) {
  const seen: { body: Record<string, unknown> }[] = [];
  const openai = {
    chat: {
      completions: {
        create: async (body: Record<string, unknown>) => {
          seen.push({ body });
          return (async function* () {
            for (const c of chunks) yield c;
          })();
        },
      },
    },
  };
  return { openai, seen };
}

/** Answers with GOOD_RANK only after the given time. */
function slowClient(afterMs: number): ModelClient {
  return {
    complete: () =>
      new Promise((resolve) => setTimeout(() => resolve({ content: GOOD_RANK, finish: "stop" }), afterMs)),
  };
}

/** Never answers; rejects with a message holding the test secret once aborted. */
const neverClient: ModelClient = {
  complete: (_messages, signal) =>
    new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error(`aborted ${SECRET}`)))),
};

beforeEach(() => {
  memory.resetToSeed(REAL_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("C6b: the record path has its own limits; the live app keeps S15's", () => {
  it("live stays at 600 tokens and 8 s; record allows 2000 tokens and 30 s", () => {
    expect(AI_MAX_TOKENS).toBe(600);
    expect(AI_TIMEOUT_MS).toBe(8000);
    expect(AI_RECORD_MAX_TOKENS).toBe(2000);
    expect(AI_RECORD_TIMEOUT_MS).toBe(30000);
  });

  it("the record client asks for AI_RECORD_MAX_TOKENS; the live client still asks for AI_MAX_TOKENS", async () => {
    const { openai, seen } = fakeOpenAi([
      { choices: [{ delta: { reasoning_content: "thinking about it" } }] },
      { choices: [{ delta: { content: "Hello." }, finish_reason: "stop" }] },
    ]);
    const record = recordModelClient(openai, "model-x");
    const recReply = await record.complete([{ role: "user", content: "hi" }], new AbortController().signal);
    const live = openAiModelClient(openai, "model-x");
    await live.complete([{ role: "user", content: "hi" }], new AbortController().signal);

    expect(recReply).toEqual({ content: "Hello.", finish: "stop" });
    expect(seen[0].body.max_tokens).toBe(AI_RECORD_MAX_TOKENS);
    expect(seen[0].body.stream).toBe(true);
    expect(seen[0].body.model).toBe("model-x");
    expect(seen[1].body.max_tokens).toBe(AI_MAX_TOKENS);
  });

  it("an answer that comes after 9 s: Live falls back with only the fixed phrase, the record path saves it", async () => {
    vi.useFakeTimers();
    const lateMs = AI_TIMEOUT_MS + 1000;

    // Live, through the app's chain.
    const job = memory.jobById(memory.read(), "2318")!;
    const lead = { label: "Pre-cooling starts too late", reason: "Code reason for the test.", checkText: "Check the start time." };
    const liveLines: string[] = [];
    const livePromise = rankWording(v10, lead, { seat: "technician", version: "1.0", job }, "live", {
      client: slowClient(lateMs),
      keyPresent: true,
      log: (l) => liveLines.push(l),
    });
    await vi.advanceTimersByTimeAsync(lateMs);
    const live = await livePromise;
    expect(live.source).toBe("fallback");
    expect(live.notice).toBe("AI unavailable, using replay");
    expect(liveLines).toEqual(["AI unavailable, using replay"]);

    // Record, through the path ai-record.ts runs.
    const dir = ownTempDir();
    const target = demoRecordTargets({ fixLine: DEMO_FIX, whyLine: DEMO_WHY }, "rank")[0];
    const recLines: string[] = [];
    const recPromise = recordMissing([target], slowClient(lateMs), { dir, log: (l) => recLines.push(l) });
    await vi.advanceTimersByTimeAsync(lateMs);
    const counts = await recPromise;
    expect(counts).toEqual({ passed: 1, failed: 0, unavailable: 0, skipped: 0 });
    expect(recLines).toEqual([]);
    expect(readdirSync(dir)).toEqual([`${target.spec.key}.json`]);
    expect(JSON.parse(readFileSync(join(dir, `${target.spec.key}.json`), "utf-8"))).toEqual({ text: GOOD_RANK, pass: true });
    rmSync(dir, { recursive: true, force: true });
  });

  it("a record call that never answers stops at the record timeout, saves nothing and prints only 'AI unavailable'", async () => {
    vi.useFakeTimers();
    const dir = ownTempDir();
    const target = demoRecordTargets({ fixLine: DEMO_FIX, whyLine: DEMO_WHY }, "tenant")[0];
    const lines: string[] = [];
    let settled = false;
    const p = recordMissing([target], neverClient, { dir, log: (l) => lines.push(l) }).then((c) => {
      settled = true;
      return c;
    });

    await vi.advanceTimersByTimeAsync(AI_RECORD_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const counts = await p;

    expect(counts).toEqual({ passed: 0, failed: 0, unavailable: 1, skipped: 0 });
    expect(lines).toEqual(["AI unavailable"]);
    expect(lines.join("\n")).not.toContain(SECRET);
    expect(readdirSync(dir)).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });

  it("ai-record.ts calls the model through the record client, never the live one", () => {
    const src = readFileSync(join(process.cwd(), "scripts", "ai-record.ts"), "utf-8");
    expect(src).toMatch(/recordMissing\(targets, recordModelClient\(\)\)/);
    expect(src).not.toMatch(/defaultModelClient/);
  });

  it("ai-ping.ts still checks the live limits", () => {
    const src = readFileSync(join(process.cwd(), "scripts", "ai-ping.ts"), "utf-8");
    expect(src).toMatch(/max_tokens: AI_MAX_TOKENS/);
    expect(src).not.toMatch(/AI_RECORD_/);
  });
});
