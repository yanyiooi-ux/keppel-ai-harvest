---
name: C7b
overview: "The technician's chat: the Tower A job list, Open job, the filled checklist, the ranked leads with live ticks, Solved, Send with the cause, Not solved with the impact record, and the low-confidence notice. Part 2 of 2 of C7."
---

# C7b: technician chat with filled checklist and live re-rank [step C7 done]

Built by Claude Code (not CodeBuddy), after CodeBuddy's credit ran out. Phone first (390 px). Code decides every
rank, tier, status, refusal and number. The AI may only add the rank-wording line under a lead's code reason, and
that code reason always stays on screen. The technician approves nothing and never uses a fix the rules removed.

## Who uses it, what decision it serves, the look, the phases
- Who: the technician (role-played), on a phone at the floor, and judges watching the demo.
- Decision it serves: which cause to check first on this job, and whether the job ends here (Solved), goes up with
  its cause (Send with the cause), or goes up with its cost (Not solved).
- Look: already locked by YY on 14 Oct 2026, Neon Quest, the tokens in web/app/globals.css :root only; no new
  colour, a status colour always carries its word. No style options to offer.
- Phases: (1) tests first, (2) rates file and the flow, (3) the desk view and the wording, (4) the screen, (5) the
  standard ending, (6) the C7 selfcheck, (7) the proof row.

## Read first
- RUN-ALL "How to run this file" rules 1 to 16 and "### C7b". Rule 4: cut 5 (rank wording) is built. Rule 6: one
  test runs rank wording on 2318 through this part's real code path on Replay against web/data/replay/, read only;
  a miss is written as "replay miss" in QUESTIONS.md and that test is an it.todo. Rule 7: no old test is edited.
- Spec S3 (impact record), S9, S18 (rates), S21 (technician row, filled values) and T-C7b. Also S2 (open-job, tick,
  solved, send-with-cause, not-solved), S6, S8, S11 (locks, the RS-08 trend card), S15 (rank-wording), S19, S20.

## Items, each failing test first

1. **`web/data/impact-rates.json`** (new, S18): labelled "made up for the demo", `visitHours: 2`,
   `seniorCheckHours: 3`, `hourlyRateSgd: 60`. **`web/lib/impact-rates.ts`**: `loadImpactRates()` at call time,
   `checkImpactRecord(payload)` (hours lost 0 to 100, extra visits a whole number 0 to 10, contractor or parts
   needed yes or no; anything else is refused with what is missing) and `impactCost(record, rates)`: hours lost x
   the hourly rate + extra visits x a visit's hours x the hourly rate. Contractor or parts has no rate in S18, so it
   is shown but not costed (question 7).
2. **`web/lib/technician-flow.ts`** (the memory writes; one function per press, called inside memory.update, each
   planning again on the memory it is given):
   - `open-job`: reported or visit-booked to `in-progress`; the job becomes the technician's open job (S2 home
     spot: the job it opened last), stored as `openJobBySeat` in the memory.
   - `tick` (`found`, `not-this`, `clear`, with the seat that made it): one tick per lead, one found lead per job
     (a new Found it moves the old one back to the list), `clear` undoes a tick. A lead the rules removed cannot be
     ticked; the refusal quotes its removal reason. `foundLeadId` follows the found tick.
   - After open-job and every tick, the ranking runs again; when `alertSeniorManager` is true, the S9 notice "Low
     confidence on job {id}: the top cause has fewer than 3 similar cases. Please take a look." goes to the senior
     manager once per job (the existing `postLowConfidenceNotice`, now stamped on the demo clock).
   - `solved`: needs a found lead with `fixAllowedHere` and one line of why, 3 to 30 words. The job goes to
     `pending-30-day`, the why line and the fixer are stored, and a runtime case is saved (cause, facts, fix, why,
     fixedBy the seat, confirmedBy null, closed now). No approval. Refusals name whose fix it is: "this fix belongs
     to the senior manager", "this fix needs outside help: Ask HQ, A3", "this fix belongs to the technician", or the
     fit-out contract line (TS-CC-11).
   - `send-with-cause`: a found lead whose fix is someone else's; the job goes to `escalated` with the cause. A fix
     the technician may do is refused ("press Solved").
   - `not-solved`: needs the impact record; the cost comes from the rates file; the record and the cost are stored on
     the job; the job goes to `escalated`.
   - Both escalations post one notice to the senior manager with everything attached: place tag, the found cause,
     the ticks with who made them, the self-check answers and notes, and the impact record with its cost. Code
     text, 0 AI. The technician's chat gets a code card saying what happened.
   - Fix of a C7a leftover the orchestrator named: a second Raise this stop (or a second pick of a stop already
     open there) stores no second card, so the chat shows nothing new.
3. **`web/lib/technician-desk.ts`** (the view, read only): the Tower A job list (not jobs still in the self-check)
   with Open job where S2 allows it; the open job's filled checklist: place tag; calls at this spot in 30 days with
   dates and what each changed (the repeat flag's own set, the clock rule); the repeat flag line and the checklist
   note; past fixes at the spot with their outcome (S8 at the demo clock: "Failed: the spot called again",
   "pending, 30-day check until {date}", "needs a second person to confirm the cause", won); fit-out months from
   buildings.json; the self-check answers and notes; the RS-08 trend card from trends.json (trigger, action and
   who_to_call word for word from the live pill, receipt "Red stop RS-08 · pill v{version} · AI calls: 0", no lock).
   Then the ranked leads from rank.ts (reason, check text, check time, fix line, tick), then ruled out and removed
   (collapsed on screen), then the active pill steps (getActiveChecklist) with S21's colour words and filled values
   for steps 1, 2, 3, 9, 10 and 11. A locked job shows only its red cards and lock lines (S11).
   `seatView` adds this desk for the technician seat; `/api/state` and the page return the same shape.
4. **Rank wording (S15, cut 5 built)**: after an open-job or tick press passes, `action-turn.ts` words the job's
   live leads with `rankWording`, outside memory.update, then stores each answer by its replay key with the AI call
   count in one update. The view shows a stored wording only when its key is the key of the lead code ranks now, so
   a stale line never sits under the wrong reason. On Off: no AI line, the "AI off" label. Polls never call the AI.
5. **`TechnicianDesk.tsx`** inside SeatChat, phone first: job rows with Open job, the checklist cards, lead cards
   with Found it, Not this and Clear (each at least 44 px tall), collapsed Ruled out and Removed, the pill steps, and
   a bar that stays at the bottom of the screen while the job is in progress: Solved (one line of why), Not solved
   (hours lost, extra visits, contractor or parts), Send with the cause, and Safety. A press reloads the view at
   once, so a tick re-ranks before the next 2-second poll. SeatChat's chips and presses use the open job.

## Tests
- `web/tests/c7b.test.ts`: every T-C7b bullet that code can prove, the S9 order and reasons after open-job, ticks
  through runAction and the view, typing never changes a tick, Solved on a job the technician may fix, the
  refusals, Not solved with S$ cost from the rates, the escalation notices, the low-confidence notice once, the
  filled step values, the lock view, the second-press fix, the rates file, the run rule 6 Replay test, and AI off.
- `web/tests/c7b-ui.test.tsx` (jsdom, fake fetch): the job list's Open job press, a Not this press reloads at once
  and the new order shows, Found it and Clear, the Solved and Not solved forms send their payloads, the bar shows
  only while the job is in progress, the ruled out and removed lists are collapsed.
- QUESTIONS.md question 7 (the impact record's cost) and question 8 (a Confirm cause list on the technician seat),
  each with one it.todo.

## Not built here
- The senior manager's view of escalated jobs, Log new solution and outside help (C8a); HQ (C8b); the AOM's impact
  meter and charges (C9); `/how` (C10a).

## When done
npm test, npm run build, git diff --stat -- web/tests (no old test changed), render check on a production build
(port 4400, REPLAY_MODE=1): Reset, /seat/technician at 390 px (iframe wrapper) and 1280 px: open 2318, Not this
twice, the order changes, then Not solved; Safety, Solved and Not solved on screen, no sideways scroll, buttons at
least 44 px tall; whether the banner "replay: saved real AI answer" showed. Key grep, then commit
"feat: technician chat with filled checklist and live re-rank [step C7 done]", then the C7 selfcheck (rule 3f).
