---
name: C7a
overview: "The tenant's chat: Report a problem, the hands-off self-check Q0 to Q4, approved tips by rule id, attach or a new job. Part 1 of 2 of C7."
---

# C7a: tenant self-check with approved tips [C7a]

Built by Claude Code (not CodeBuddy), after CodeBuddy's credit ran out. Code decides every question, outcome, status,
job and request. The AI may only word the tenant reply from the chosen tips, and the tips always stay on screen.
A tenant never touches plant, ceilings, power or lifts.

## Read first
- RUN-ALL "How to run this file" rules 1 to 16. Rule 16, C7a ruling: "Report a problem" shows two buttons, "Too cold"
  and "Too hot"; that choice is the report action's payload; a new job's report time comes from the demo clock
  (tests pass their own, such as 20:00); then Q0 to Q4 exactly as S10. Rule 4: cut 9 (A4) is built, so the
  after-hours outcome opens the A4 request. Rule 6: one test runs the tenant reply on 2318 on Replay against
  web/data/replay/ (read only); a miss is written as "replay miss" in QUESTIONS.md and that test is an it.todo.
- Spec S6, S10, S12, S13 (item 10), S17 (A4 opening), T-C7a. Also S2 (report, answer), S3, S11 (the Safety list,
  picks), S15 (tenant-reply), S20, S21 (tenant seat).

## Items, each failing test first

1. **`web/lib/self-check.ts`** (pure, no AI import, so ai-record's import walk stays clean).
   - The question texts and answers of the S10 table, fixed: Q0, Q1, Q2, Q3 and the three Q4s (blinds, after
     hours, thermostat). Q1 sets the zone: lift core is `core`, west boardroom is `west`, somewhere else is `other`.
   - Which Q4: too hot in the west boardroom asks the blinds; else a report time outside air-con hours
     (`places.json`, Singapore time) asks after hours; else the thermostat.
   - Outcomes in S10 order: Q0 Yes is safety; blinds "No, they are up"; after hours "Yes"; otherwise a visit, with
     the 2 TS-CC-09 tips when the spot has the repeat flag, Q2 is "It keeps coming back" or Q3 is "Yes", else the tip
     whose rules are TS-CC-01 and TS-CC-09. Thermostat "No" or "Not sure" adds the technician note.
   - Tips found by rule id from the live pill's `tenant_tips`, never by position, word for word.
   - Code lines and whys exactly as S10. `VISIT_BOOKED_LINE` moves here; ai-demo-targets.ts re-exports it, so the
     recorded replay key and the app's key share one string.
   - Hands-off guard: no question text or answer has climb, reset, unplug, switch off, turn off, adjust, remove or
     "open the".
2. **`web/lib/self-check-flow.ts`** (the memory writes and the AI wording).
   - `report` (tenant only, payload "too cold" or "too hot"): a job with the next free id in Tower A's series
     (2319), status `self-check`, report time from the demo clock, the tenant and building from buildings.json. The
     chat stores "Report a problem: too cold" and the Q0 card with its answer buttons. A second report while one is
     running is refused. A job still in `self-check` is not a call (callsForState), because it may attach.
   - `answer` (tenant, job in `self-check`, the current question and one of its answers): stores the answer, marks the
     question card answered, then the next question or the outcome.
   - Q0 Yes: the Safety list card for that job, no more questions, the job goes to `reported`. Picking a stop is the
     existing `safety-pick` on that job.
   - Attach, do not duplicate: an open job for the same tenant, building, floor and zone gets the answers (2318); the
     self-check job goes away. Otherwise the self-check job is the new job (2319). Speak first runs either way (S6).
   - Blinds up: the TS-CC-20 tip, no visit, the job `pending-30-day` with the S10 why. After hours Yes: the TS-CC-12
     tip, "The AOM will confirm any cost first.", the A4 request "After-hours air-con for {tenant}, Level {floor}" for
     the AOM (open, no amount), a notice in the AOM chat, the job `pending-30-day` with its why. Visit: "A technician
     visit is booked." plus the tips, the job `visit-booked`.
   - The reply card: the code text (code line and tips word for word, in S10 order) always stays; the AI's
     tenant-reply is only an extra "AI wording" line when it passes S13 with item 10 and S14; its receipt names the
     tips' rules, the pill version and the AI calls. The AI runs before memory.update, never inside it, and its
     answer is used only when its replay key equals the key of the reply code makes inside the update.
   - `tenantReplyInput` leaves out the "Code line:" line when there is none (the blinds reply has only its tip).
3. **Speak first posts to the senior manager's chat (S6).** Reset posted it to the technician seat. One helper,
   `postSpeakFirst`, used by Reset and by the self-check. callsForState moves to `web/lib/calls.ts` (actions.ts
   re-exports it), so the flow needs no import of actions.ts.
4. **`/api/action` runs the async path** (`web/lib/action-turn.ts`): for `answer`, the AI wording first, then
   `runAction`. Every other action is `runAction` as before.
5. **Safety picks show on screen.** A `safety-pick` stores the stop's card (trigger, action, "Call:" who_to_call,
   receipt) in the pressing seat's chat. The Safety list card gets a Raise button per stop.
6. **SeatChat** (fix of a C5a bug the orchestrator named): a typed message and its reply show exactly once.
   `/api/chat` now also returns `storedCount`, the seat's stored message count after the write; a local reply hides
   as soon as a poll holds that many messages, and is dropped at that poll. Old component tests whose fake chat
   answer has no `storedCount` keep their local reply, unchanged. Tenant seat: "Report a problem" then "Too cold" and
   "Too hot"; question cards show one button per answer until answered; a refused press shows its reason.

## Tests
- `web/tests/c7a.test.ts`: every T-C7a bullet, the S10 table, the Q4 choice, tips by rule id, refusals, speak first
  to the senior manager, the A4 request, the stored pick card, `storedCount`, and the run rule 6 Replay test.
- `web/tests/c7a-ui.test.tsx` (jsdom, fake fetch): the typed message shows once after a poll that returns the stored
  copy; the report buttons; answer buttons; Raise on the Safety list; the Call line; a refusal.

## Not built here
- Telling the tenant first (cut 2) and the tell-tenant-first button.
- The technician's job list and filled checklist (C7b), the AOM's charge decision (C8a to C9).

## When done
npm test, npm run build, git diff --stat -- web/tests (no old test changed), render check on a production build
(port 4310, Replay): Reset, /seat/tenant at 390 px and 1280 px, too cold, core, "It keeps coming back": visit booked
on 2318; Reset, too hot, west boardroom, blinds up: the tip, no visit; a typed message seen once after a poll. Key
grep, then commit "feat: tenant self-check with approved tips [C7a]".
