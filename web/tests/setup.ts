/**
 * Test setup (spec S15: Tests).
 *
 * Runs before any test file loads. Sets LLM_API_KEY to empty and REPLAY_MODE
 * to 1, and makes any network call throw "network blocked in tests".
 */

// Set env before anything reads it.
process.env.LLM_API_KEY = "";
process.env.REPLAY_MODE = "1";

// Vitest runs test files in parallel workers. They share one working
// directory, so without this every file would Reset the same demo out from
// under the others. Each worker gets its own memory file.
process.env.PILL_DESK_STATE_FILE = `${process.cwd()}/data/state.test-${
  process.env.VITEST_WORKER_ID ?? "0"
}.json`;

// Block network calls. Any code that tries fetch or the OpenAI client's
// underlying request will get this error.
const blocked = (): never => {
  throw new Error("network blocked in tests");
};

// Stub fetch globally.
(globalThis as Record<string, unknown>).fetch = blocked;
