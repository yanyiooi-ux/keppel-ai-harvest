# Questions for YY

Each question names its part and the spec's exact words. Each one has one it.todo test carrying the question.

## C3c (from the C3c review)

1. **GT-22 and hand-picked fit-out rules.** S16 item 4 says GT-22 is "2301 on a pill with a `fit-out-12m` rule that
   blocks step 25: steps 1 to 8 in order, then step 21, no step 25". S16 item 2 says "With the AI off, the senior
   manager picks the fact and effects by hand from the menu", and S16 item 7 says "`send-to-hq` needs a stored run with
   0 failed". Together, any menu-legal fit-out rule that blocks step 25 but puts a step other than 21 first (or puts
   nothing first) always fails GT-22, so it can never reach HQ. Checked in code: "fit-out-12m, block 25 only" fails
   GT-22 with "checklist starts 1, 2, 3, 4, 5, 6, 7, 8, 9"; "block 25 + put-first 17" fails with "... 8, 17".
   Is that intended (only the demo rule can pass), or should GT-22 apply only to a rule that puts step 21 first?
   Test: `web/tests/c3c-review.test.ts`, "QUESTION C3c: ..." (it.todo).

## C6b

2. **ANSWERED (15 Oct 2026, decided for this run): recording runs offline before the demo, so the record path may use
   larger limits than the live app.** `ai-core.ts` now exports `AI_RECORD_MAX_TOKENS = 2000` and
   `AI_RECORD_TIMEOUT_MS = 30000`, used only by `ai:record` (the smallest of 2000 tokens and 30 s, 4000 and 60 s, 8000
   and 90 s that recorded answers). The live app and `ai:ping` keep 600 tokens and 8 s. On Live, only an error or the
   8 s timeout falls back to the saved answer with its banner; a reply with no content shows the fallback (corrected
   after the C6b review, see question 4). S15 has a bullet naming this with the before and after counts. Committed
   as "fix: ai-record for C6b, record-time limits [fix done]". The question as first asked:
   **hy3 gives no answer inside S15's limits.** S15 says "`ai-core.ts` exports `AI_MAX_TOKENS = 600` and every call
   uses it", "a call times out 8 s after the request" and "a reply that ends with finish `length` and no content counts
   as no answer (the fallback shows)". C6b says "real AI answers, saved for the demo". On 14 Oct 2026, 3 runs of
   `npm run ai:record` got no answer on all 16 demo calls each time. Run 1: 10 "no answer" and 6 "AI unavailable"
   with no status (the 8 s timeout). Run 2: 15 and 1. Run 3: 16 and 0. Nothing was saved, so `web/data/replay/` does
   not exist. Likely cause, not proven: the 10 Oct measurement used "Say OK.", and on the longer demo prompts hy3 seems
   to spend all 600 tokens thinking before any content (the script does not print the finish reason, so "length" is a
   guess). Not recorded: all 16, which is rank wording for 2318 (technician and senior manager), 2401 on v1.0 and on
   the v1.1 fixture, the tenant reply for 2318 (TS-CC-09 tips) and the new solution from the demo lines. Should record
   mode, or every call, get a larger token cap or a longer timeout, or is there a TokenHub setting that switches hy3's
   thinking off? Nothing was changed for this. No it.todo yet, because C6b stopped before its commit.

3. **Not recorded (run rule 12).** 3 runs of `npm run ai:record` at 2000 tokens and 30 s printed "recorded: 14 passed
   checks, 1 failed checks, 1 unavailable, 0 already saved", then "0 passed checks, 1 failed checks, 1 unavailable, 14
   already saved", then "0 passed checks, 2 failed checks, 0 unavailable, 14 already saved". 14 of 16 demo answers
   are saved and passed. Still failing after the 2 retries, each saved with its pass flag false, so the app never
   shows it and falls back:
   - not recorded: tenant-reply for 2318 (the TS-CC-09 visit-booked tips). The saved answer repeats the two tips word
     for word, and that answer can never pass, for two reasons (named in full after the C6b review): the two tips are 4
     sentences, where S14 and S15 allow a tenant reply at most 3, and the first tip says "Your reports help us find the
     cause.", where S13 item 10 blocks "cause" in AI-drafted tenant text. `web/prompts/tenant-reply.md` ends "If you
     cannot keep every rule, answer with the tips exactly as given.", so the model's safe answer is the one that always
     fails. The app shows the tips word for word, which is the right fallback. Test: `web/tests/c6b-replay.test.ts`,
     "not recorded: tenant-reply for 2318 ..." (it.todo); its line names only the sentence count. Because of this,
     C7a's run rule 6 test (the tenant reply on 2318 on Replay) will be a replay miss unless a passing answer is
     recorded first.
   - not recorded: rank-wording for 2401 (technician, v1.0), the lead "Morning start-up runs too cold". The answer
     says "1 fix failed" where the code says "1 failed fix", so the S14 number check refuses it and the code reason
     shows alone. No test needs this answer, so it has no it.todo.
   Re-running `npm run ai:record` retries only these two. For the tenant reply a re-run is very unlikely to help
   while the prompt's last line stays; changing the prompt and recording again is YY's call. Nobody hand-writes them.

## C6b (from the C6b review)

4. **On Live, the demo's AI lines usually do not show.** S15 says "a reply that ends with finish `length` and no
   content counts as no answer (the fallback shows)", and an old C6a test pins it: `web/tests/c6a.test.ts`, "a live
   answer that fails its checks, or has no content, shows only the code text, never a replay (S14, S15)". Only an error
   or the 8 s timeout goes on to the saved answer with its banner. At S15's 600 tokens and 8 s, all 16 demo record
   calls ended with no content ("no answer"). So on Live, each worded card (the Why? card, and Building B's 3 leads
   each time / or /how loads) makes a Hunyuan call, shows the code reason with no AI line and no banner, and its
   receipt counts the call. The saved real answers show only on Replay, where `REPLAY_MODE=1` (the value in
   `web/.env.example`) starts the switch. The record-limit decision (question 2) first said "on Live a slow answer
   falls back to the saved answer with its banner"; that holds only for an error or a timeout. Should a reply with no
   content on Live go on to the saved answer, as an error does? That changes S15's words and the old C6a test above,
   so it needs YY's ruling. Test: `web/tests/c6b-review.test.ts`, "QUESTION C6b review: ..." (it.todo).
