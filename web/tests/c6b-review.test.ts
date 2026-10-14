/**
 * C6b review: a spec question for YY (run rule 8), logged in
 * .codebuddy/plans/QUESTIONS.md as question 4.
 *
 * Today's behaviour stays as S15 and the old C6a test pin it: on Live, a reply
 * with no content shows only the code text, never a replay (web/tests/c6a.test.ts,
 * "a live answer that fails its checks, or has no content, ..."). Only an error
 * or the 8 s timeout goes on to the saved answer. Nothing here calls Hunyuan.
 */

import { describe, it } from "vitest";

describe("review C6b: on Live, a reply with no content and the saved answer", () => {
  it.todo(
    "QUESTION C6b review: at S15's 600 tokens and 8 s, all 16 demo record calls ended with no content, and on Live a reply with no content shows the code text with no AI line and no banner while its receipt counts the call; only an error or a timeout reaches the saved answer. Should a reply with no content on Live go on to the saved answer with its banner, as an error does?"
  );
});
