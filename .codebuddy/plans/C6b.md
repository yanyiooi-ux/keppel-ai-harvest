---
name: C6b
overview: "Part 2 of 2 of C6: real AI answers, saved for the demo, recorded with npm run ai:record."
---

# C6b: saved real AI answers for the demo [step C6 done]

Built by Claude Code (not CodeBuddy), after CodeBuddy's credit ran out. The record commands run in this terminal
(run rule 12). Only `npm run ai:record` loads the key, and only it calls Hunyuan. No test ever calls Hunyuan, and no
test reads a `web/.env*` file.

Who uses it: the judges and YY at the demo, who see "replay: saved real AI answer" when Live is slow or off. What it
decides: nothing; code decides, the AI only words, and these files hold the real words for replay. No screen changes,
so there is no look to pick.

## Read first
- RUN-ALL "How to run this file" rules 1 to 16. Rule 4: no chip record commands (cut 1); in item 2 keep the
  secret-search test and skip the whole replay-quality sentence (cut 3). Rule 6: only `npm run ai:record` writes
  `web/data/replay/`; the tests C6b adds may point the replay setting at it, read only. Rule 12: the record steps.
- Spec S15 (record mode, replay keys, quality check), T-C6b. Also S10 outcome 4 (the TS-CC-09 tips) and S16 (the demo
  fix line and why line).

## Before the first record run (done)
1. **The record path leaks nothing.** A test runs ai-record's call-and-save path (`recordMissing` over every demo
   target) with a fake client whose error message holds FAKE-TEST-SECRET: the output is only "401 AI unavailable" per
   call (or "AI unavailable" with no status), nothing is saved, and no line holds the secret, a header or a URL.
2. **Every console call in `web/scripts/ai-record.ts`** is read by hand and by a test: each prints only a fixed
   phrase, a status, the model id or a count.
3. **The targets land where the app asks.** The senior manager now gets the same three tick states as the technician
   on 2318. Committed as c52f621 "fix: ai-record for C6b [fix done]", with `web/tests/c6b-record.test.ts`.

## Recovery: record-time limits (decided by the orchestrator, QUESTIONS.md question 2)
The first try stopped: 3 runs of `npm run ai:record` gave no answer on all 16 demo calls. hy3 streams its thinking
before its answer, and S15's 600 tokens and 8 s leave no room for the answer on the longer demo prompts. Recording
runs offline before the demo, so the record path may use larger limits than the live app.

a. Diagnose with the existing scripts only, showing only what they print. A 401, 403, 429 or a quota or balance
   message is a stop (the key or the quota is YY's to fix).
b. Failing test first with a fake client (`web/tests/c6b-limits.test.ts`), then in `web/lib/ai-core.ts`:
   `AI_RECORD_MAX_TOKENS` and `AI_RECORD_TIMEOUT_MS`, a `recordModelClient()` that asks for the record tokens, and
   `recordAnswer` waits the record timeout. `ai-record.ts` uses `recordModelClient()`. The live app and `ai:ping`
   keep `AI_MAX_TOKENS = 600` and 8 s; on Live a slow answer falls back to the saved answer with its banner.
   Settings, smallest first, stopping at the first that records answers: 2000 tokens and 30 s, then 4000 and 60 s,
   then 8000 and 90 s. At most 3 record runs per setting, to protect the free token quota.
c. One bullet in `docs/plan/BUILD-SPEC.md` S15 naming the record-time limits and the before and after counts
   `ai:record` printed. Commit (b) and (c) alone as "fix: ai-record for C6b, record-time limits [fix done]", after
   npm test, npm run build, the key grep and the git status checks.

## Record (run rule 12)
4. Commands, run in `web/`:
   - `npm run ai:record` (every demo job), or one job at a time: `npm run ai:record -- rank`,
     `npm run ai:record -- tenant`, `npm run ai:record -- solution`.
   - Jobs: rank wording for 2318's leads (technician and senior manager seats) and 2401's leads on v1.0 and on the
     v1.1 fixture; the tenant reply for the 2318 visit-booked tips (TS-CC-09); the new solution from the demo fix line
     and why line (S16). No chip commands (cut 1).
   - Show only what the script prints. A failed call, or an answer saved with its pass flag false, is retried up to 2
     more times (the script records only what is missing or failed). Anything still missing goes into QUESTIONS.md
     and the proof row as "not recorded: <jobs>". Never hand-write an answer.
5. Right after recording: npm test (a test that passed before and now fails is a stop), then npm run build.

## After recording, each test written first
6. **Secret search** (T-C6b): a test reads every file in `web/data/replay/` (read only) and finds no "LLM_", no
   "Authorization" and no "http"; every file is only `{ text, pass }`.
7. **Tenant reply on replay:** a test runs ai.ts's tenant-reply job on Replay with the same input the record command
   used (the 2318 visit-booked TS-CC-09 tips, the code line "A technician visit is booked.", seat tenant, v1.0) and
   gets the banner "replay: saved real AI answer". If the tenant reply is "not recorded", that test is an it.todo
   with that line.
8. Information only, for the proof row: whether the new-solution answer's fact and effects equal the fixture's rule.

## Outcome
- (a) `ai:ping`: "model: hy3, thinking first: yes, first reply: 1230 ms". `ai:record` at 600 tokens and 8 s:
  "recorded: 0 passed checks, 0 failed checks, 16 unavailable, 0 already saved". No 401, 403, 429 or quota line.
- (b) 2000 tokens and 30 s recorded answers on the first run, so the larger settings were never tried. 3 runs at this
  setting; 14 of 16 saved and passed. Not recorded: the 2318 tenant reply and one 2401 rank wording (QUESTIONS.md
  question 3).

## Not built (cuts)
- The chip record commands (cut 1). The replay quality test and its 80 percent check (cut 3).

## When done
npm test, npm run build, `git diff --stat -- web/tests` (no old test changed), render check: no screen changed, the
key grep and the history scans, git status (only new files in `web/data/replay/`, the new tests, this plan and
QUESTIONS.md), then commit "chore: saved real AI answers for the demo [step C6 done]". Then the rule 3f selfcheck for
C6 (T-C6a and T-C6b), then the proof row alone as "docs: proof for C6b".
