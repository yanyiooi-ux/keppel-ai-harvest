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

## C7a

5. **replay miss: tenant-reply 2318 (run rule 6).** C7a's tenant reply on 2318, through the part's real code path on
   Replay (Report a problem, too cold, "Open area near the lift core", "It keeps coming back": visit booked on 2318,
   the 2 TS-CC-09 tips, "A technician visit is booked."), asks for exactly the replay key `npm run ai:record` recorded
   (a test checks the key equals the record target's key). The saved answer for that key has its pass flag false
   (question 3), so the reply shows the tips word for word with no banner. Run once as a real test on 15 Oct 2026:
   "aiBanner": null, "AI calls: 0". Not re-recorded, and no key code changed to force it. Test:
   `web/tests/c7a.test.ts`, "replay miss: tenant-reply 2318 ..." (it.todo).

6. **A report that attaches to a job someone has already started.** S10 says "if an open job exists for the same
   tenant, building, floor and zone, the answers attach to it (2318 in the demo) and no new job is made", and its
   outcomes say "The job goes to `pending-30-day`" (blinds up, after hours) or "visit booked". S3 says only buttons and
   the code rules it lists move a status. The spec does not say what happens when the open job is already
   `in-progress`, `escalated` or further along (a technician or the senior manager is working on it). Built for now:
   the answers, the note and the reply attach, and the job's status moves only from `reported` (to `visit-booked`)
   or from `reported` or `visit-booked` (to `pending-30-day`); a job further along keeps its status. In the demo the
   self-check runs before anyone opens 2318, so this never shows. Should a tenant's tip close a job a technician has
   open, or should the attach leave its status alone as built? Test: `web/tests/c7a.test.ts`, "QUESTION C7a: ..."
   (it.todo).

## C7b

7. **The impact record's cost.** S3 says "Code adds the cost from the made-up rates in
   `web/data/impact-rates.json` (S18)", and S18's rates are "`visitHours: 2`, `seniorCheckHours: 3`,
   `hourlyRateSgd: 60`". The spec does not say how hours lost, extra visits and "contractor or parts needed" turn into
   one cost. Built for now: hours lost x the hourly rate + extra visits x a visit's hours x the hourly rate, so 3 hours
   and 2 visits cost S$420; "contractor or parts needed" has no rate in S18, so it is shown but not costed. The cost
   is stored on the job and shown only in the senior manager's notice (S3 also names the AOM; that screen is C9).
   Is that the cost YY wants? Test: `web/tests/c7b.test.ts`, "QUESTION C7b: S3 says code adds the impact record's
   cost ..." (it.todo).

8. **A Confirm cause list on the technician seat.** S8 says "Cut 7 fallback (confirm-cause): the Confirm cause list
   on the technician and HQ seats goes", and run rule 4 builds everything marked cut 5 to cut 10, so the list should
   exist. But S21's technician row lists the buttons "Open job, Found it, Not this, Solved (why line), Not solved
   (impact record), Send with the cause, Safety", and C7b's items name no Confirm cause. Not built on the technician
   seat in C7b; `confirm-cause` itself works (C4). Should the technician seat get the list? Test:
   `web/tests/c7b.test.ts`, "QUESTION C7b: S8 says the Confirm cause list ..." (it.todo).

## C7b (from the C7b review)

9. **The impact record's cost in the senior manager's chat.** S13 item 9 says "Amounts appear only in code-made
   cards: the impact meter (S18) and the AOM's charge card (S17)." T-C7b says "the senior manager's chat gets it with
   a cost from the made-up rates", and S3 says the impact record is "shown to the senior manager and the AOM". Built:
   the senior manager's escalation notice shows the cost ("Cost: S$420 (made-up rates: ...)"), and the technician's
   own card names the record with no amount. Should the senior manager's chat show the amount? If YY answers
   differently here or on question 7, the C7b tests that pin S$420 (`web/tests/c7b.test.ts`) need an old-test edit,
   so that answer needs YY's go for the edit too. Test: `web/tests/c7b-review.test.ts`, "QUESTION C7b review: S13
   item 9 says ..." (it.todo).

## C9

10. **What the tenant hears after an after-hours charge decision.** S17 says "After the decision, code (not the AI)
    posts the tenant's card: "What we will do: {tenantSolution} Cost: ...". Approved by the AOM (role-played)."", and
    S10 outcome 3 opens an A4 request "After-hours air-con for {tenant}, Level {floor}". The tenantSolution comes from
    the found lead in `causes.json` on the HQ Approve path (S16 item 9); the after-hours request has no found lead and
    the spec gives it no tenantSolution. Built for now: the card uses the request's own words with a full stop, so
    Landlord pays reads "What we will do: After-hours air-con for Northwind Advisory, Level 23. Cost: no charge to
    you. Approved by the AOM (role-played)." The demo's charge (the thermostat move after HQ's Approve) is not
    affected. What should the tenant hear for after-hours air-con? Test: `web/tests/c9.test.ts`, "QUESTION C9: S17
    says the tenant's card is ..." (it.todo).

## C9 (from the C9 review)

11. **How long the reason is for Landlord pays and Goodwill.** S17 says "**Tenant pays** (a whole-number amount from
    1 to 100000, typed by the AOM in a number field, and a reason of 3 words or more); **Landlord pays** (reason);
    **Goodwill, no charge** (reason, the AOM's own decision)", and T-C9 says only "Goodwill needs a reason". The
    3-word minimum is written only for Tenant pays. Built for now: every choice needs a reason of 3 words or more,
    and the AOM's form says "Reason (3 words or more)" for all three, so "Landlord fault" is refused. Should Landlord
    pays and Goodwill take a shorter reason? An old C9 test pins the 3-word refusal message for a Goodwill press with
    no reason, so a looser rule must still refuse an empty reason with that message, or that answer needs YY's go for
    an old-test edit. Test: `web/tests/c9-review.test.ts`, "QUESTION C9 review: S17 says "Tenant pays ..." (it.todo).

12. **A self-check with no visit on the impact meter.** S18 says "Visits | one per call" and "Calls | all calls in the
    run", and S10 outcomes 2 and 3 (blinds up, after hours) say "No visit". Built for now: the meter replays every
    call at the spot, a no-visit self-check too, and counts each as one visit, so an after-hours report on Tower A
    Level 23 ("Somewhere else", job 2319) moves Before from 5 calls, 5 visits, S$600 and counting to 6 calls, 6 visits,
    S$720 and counting. The demo path ("too cold" attaches to 2318) is not affected. Should a no-visit self-check
    count as a call without a visit, or not count on the meter at all? Test: `web/tests/c9-review.test.ts`, "QUESTION
    C9 review: S18 says "Visits: one per call" ..." (it.todo).

## C10a (from the C10a review)

13. **The live wall at laptop width.** S22 says "Live: the 5 real chats side by side, AOM Tower A first", and
    `docs/design/how-prototype.html` shows 5 columns from 1280 px and 3 below that. Built in C10a, without a question:
    at 1280 px the wall is 3 columns by 2 rows (AOM, tenant and technician, then senior manager, HQ and the Building
    B card), and the 5 chats sit in one row only from about 1790 px. Tried in the C10a review and looked at: 5 in a
    row at 1280 px leaves each chat about 238 px wide, the chips wrap to 3 rows, the room for the desk shrinks, and
    the Building B card sits alone on a second row (look sample c10a-fix-how-try5col-1280.png). Not changed. Should
    the wall show the 5 chats in one row from 1280 px? Test: `web/tests/c10a-review-ui.test.tsx`, "QUESTION C10a
    review: S22 says "the 5 real chats side by side" ..." (it.todo).
