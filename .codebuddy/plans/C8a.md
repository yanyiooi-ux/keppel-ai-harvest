---
name: C8a
overview: "The senior manager's chat: escalated jobs with everything attached, Found it, Not this and Solved, Log new solution with each part confirmed on its own, Run tests, Send to HQ, Ask HQ for outside help, Confirm cause and Clear stop. Part 1 of 2 of C8."
---

# C8a: senior manager chat, new solution draft and tests [C8a]

Built by Claude Code (not CodeBuddy), after CodeBuddy's credit ran out. A new solution is born here, so it must be
honest and exact. Code decides every status, refusal, rank, test count and hash. The AI only drafts the rule text and
suggests the fact and effects from the code menu, each labelled, and nothing is saved until the senior manager
confirms each part with its own button. The senior manager approves nothing: HQ does (A2, C8b).

## Who uses it, what decision it serves, the look, the phases
- Who: the senior manager, the FM contractor's chief engineer (role-played), and judges watching the demo.
- Decision it serves: what a job that came up the line really needs: a fix this seat may make (Solved), a new
  solution written up for HQ (Log new solution, confirm each part, Run tests, Send to HQ), or outside help (A3).
  Also which pending cases to confirm and which red stops to clear.
- Look: already locked by YY on 14 Oct 2026, Neon Quest, the tokens in web/app/globals.css :root only; no new
  colour, a status colour always carries its word. No style options to offer.
- Phases: (1) tests first, (2) the presses, (3) the desk view, (4) the screen, (5) the standard ending, (6) the
  proof row. C8a's commit does not end a step, so there is no selfcheck (rule 3f).

## Read first
- RUN-ALL "How to run this file" rules 1 to 16 and "### C8a". Rule 4: cut 2 is out, so item 9 (Tell the tenant
  first) is not built; cut 6 (Clear stop), cut 7 (Confirm cause) and cut 8 (outside help) are built. Rule 6: one
  test runs the demo new solution through this part's real code path on Replay against web/data/replay/, read only,
  and expects the banner "replay: saved real AI answer"; a miss is written as "replay miss" in QUESTIONS.md and that
  test is an it.todo. Rule 7: no old test is edited.
- Spec S11 (clear stop), S16 items 2, 5 and 7, S17, S21 (senior manager row) and T-C8a. Also S2, S3, S8, S9, S12,
  S13, S15 and S20.
- Orchestrator note, already decided: the saved AI suggestion for the demo lines is fact fit-out-12m with put-first
  step 21 only. The screen must let the senior manager change the effects to the fixture's rule (block 25, then
  put-first 21), Run tests must pass on that exact draft hash, and Send to HQ must then open. The saved answer is
  never changed or recorded again.

## Items, each failing test first

1. **`web/lib/senior-manager-flow.ts`** (the presses; each `...Refusal` reads and never writes, each `apply...`
   runs inside memory.update and plans again on the memory it is given):
   - `log-new-solution` (escalated): needs a found lead, a fix line and a why line, 3 to 30 words each. The AI
     answer is made before the update (action-turn.ts, the new-solution job of S15) and kept only when its replay
     key is the key of exactly these lines. The solution holds four parts: rule text, fact, effect 1, effect 2.
     From the AI: the rule text labelled "AI drafted", the fact and each effect labelled "AI suggested from the
     code menu". AI off, or a note, or no answer: the rule text is the fix line word for word and the fact and
     effects are picked by hand from the menu; a note shows as "advisory, not enforced". The job goes to
     `new-solution-drafted`. No draft file and no hash yet. No A4 request and no AOM notice (S17).
   - `confirm-part` (new-solution-drafted): one part per press, with the value the senior manager leaves in it
     (the suggestion, or a change from the menu). Off-menu values are refused. Once every part is confirmed, code
     builds the draft (S16 item 2), saves it in the runtime folder and stores its hash; a confirm that changes the
     draft clears the stored test run (S16 item 7).
   - `run-tests`: runs runDraftTests on the saved draft (S16 item 5) at the demo clock, over the open jobs in the
     memory, and stores the run with the hash it saw: passed, failed and not applicable.
   - `send-to-hq`: the existing gate (a stored run with 0 failed on the draft's hash now), then the solution goes
     to HQ with one notice for the HQ seat. The draft is then frozen for this seat.
   - `ask-outside-help` (A3, escalated): contractor or budget, a reason of 3 words or more, needs money yes or no,
     no amount in the text (S13). Job to `outside-help-requested`; the request and a notice reach HQ.
   - `clear-stop` (cut 6): an open red stop, a reason of 3 words or more, and for a stop whose who_to_call (read
     from the pill) names the Fire Safety Manager, the tick "Safety record: Fire Safety Manager told and agreed
     (role-played)". Logged with who and when; labelled a safety record, not an approval.
   - Found it, Not this and Solved use the technician's code (technician-flow.ts) with the senior manager's seat:
     Found it on rebalance, then Solved, is refused "this fix needs outside help: Ask HQ, A3".
   - Typed fix, why and rule text lines only flag red words (S12): a small flag, no alert, no lock.
2. **`web/lib/senior-manager-desk.ts`** (the view, read only): jobs with the senior manager (escalated,
   new-solution-drafted, outside-help-requested), one on the desk (Show job is a view only). For it: the same
   filled checklist as the technician's, the facts, the ticks with who made them, the impact record with its cost,
   how it came up, its own ranked list (the senior manager's seat, rank wording by replay key), ruled out, removed,
   the pill steps, the new solution with each part and its label, the test run and the hash, and any A3 request.
   Also the pending cases with Confirm cause (never for the fixer) and the open red stops with Clear stop.
   `seatView` returns it as `manager` (the technician's `desk` stays technician only).
3. **`SeniorManagerDesk.tsx`** inside SeatChat: job rows, the cards, lead cards with Found it, Not this and Clear,
   the new solution card with one Confirm per part (selects from the code menu), and a bar at the bottom of the
   screen: Solved, Log new solution and Ask HQ for outside help while escalated; Run tests and Send to HQ while
   drafted; Safety always. Every press at least 44 px tall. A refusal shows in the bar.
4. **Rank wording** for the senior manager's list: after the senior manager's own tick (already worded), and after
   Not solved or Send with the cause, the job's live leads are worded for the senior manager's seat, outside
   memory.update.

## Tests
- `web/tests/c8a.test.ts`: every T-C8a bullet code can prove, item 5 (no A4 request), item 10 (flags only),
  the menu refusals at confirm, the hash and the cleared run, Send to HQ opening on the fixture's rule, the AI
  suggestion labels, the A3 refusals, the clear-stop refusals and unlock, Confirm cause in the list, and the run
  rule 6 Replay test on the demo lines.
- `web/tests/c8a-ui.test.tsx` (jsdom, fake fetch): the escalated job's cards with no question buttons, the parts
  with their labels and Confirm buttons sending their payloads, the effect change to block 25 and put-first 21, Run
  tests and Send to HQ in the bar, the A3 form, Clear stop with the safety record tick only where needed.

## Not built here
- Item 9, Tell the tenant first (cut 2). HQ's approval, distribution, versions and rollback (C8b). The A4 charge
  request (C8b opens it on Approve). The AOM's screen (C9). `/how` (C10a).

## When done
npm test, npm run build, git diff --stat -- web/tests (no old test changed), render check on a production build
(port 4410, REPLAY_MODE=1, the AI switch on Replay): Reset, take 2318 to Not solved, then /seat/senior-manager at
1280 px and at 390 px (iframe wrapper): Found it on thermostat-spot, log the demo solution, change the effects to
block 25 and put-first 21, confirm each part, Run tests, Send to HQ; whether the banner "replay: saved real AI
answer" showed. Key grep, then commit "feat: senior manager chat, new solution draft and tests [C8a]".
