/**
 * Test setup (spec S15: Tests).
 *
 * Runs before any test file loads. Sets LLM_API_KEY to empty and REPLAY_MODE
 * to 1, and makes any network call throw "network blocked in tests".
 */

// Set env before anything reads it.
process.env.LLM_API_KEY = "";
process.env.REPLAY_MODE = "1";

// Block network calls. Any code that tries fetch or the OpenAI client's
// underlying request will get this error.
const blocked = (): never => {
  throw new Error("network blocked in tests");
};

// Stub fetch globally.
(globalThis as Record<string, unknown>).fetch = blocked;
