import { describe, test, expect } from "vitest";

/**
 * T-C1b: test setup proves LLM_API_KEY is empty, REPLAY_MODE is 1,
 * and a network call throws "network blocked in tests".
 */
describe("ai test setup (T-C1b)", () => {
  test("LLM_API_KEY is empty", () => {
    expect(process.env.LLM_API_KEY).toBe("");
  });

  test("REPLAY_MODE is 1", () => {
    expect(process.env.REPLAY_MODE).toBe("1");
  });

  test("a network call throws 'network blocked in tests'", () => {
    expect(() => fetch("https://example.com")).toThrow(
      "network blocked in tests"
    );
  });
});
