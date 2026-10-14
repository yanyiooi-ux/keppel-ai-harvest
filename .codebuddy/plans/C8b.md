---
name: C8b
overview: "HQ approves and sends to every building: the A1 card, the solutions sent to HQ, Approve and send to all buildings (A2) with S16 item 8's gates, distribution, the A4 charge request on Approve, Decline, the versions list, Roll back, outside help decisions (A3) and the Building B card. Part 2 of 2 of C8."
---

# C8b: HQ approval, send to all buildings, versions and rollback [step C8 done]

Built by Claude Code (not CodeBuddy), after CodeBuddy's credit ran out. HQ (the Keppel Technical Services lead,
role-played) is the only seat that approves a new solution (A2) or outside help (A3). Code decides every gate, version,
hash, notice and request. The AI words nothing new here: the only AI line on this seat is the rank wording under
Building B's lead reasons, made at the press and shown by its replay key.

## Who uses it, what decision it serves, the look, the phases
- Who: the HQ pill owner (role-played), and judges watching the demo.
- Decision it serves: does this new solution go live in every building (Approve, or Decline with a reason), does a
  live version come back out (Roll back), and does a job get outside help or money (A3).
- Look: already locked by YY on 14 Oct 2026, Neon Quest, the tokens in web/app/globals.css :root only; no new colour,
  a status colour always carries its word. No style options to offer.
- Phases: (1) tests first, (2) the presses, (3) the HQ desk view, (4) the screen, (5) the standard ending, (6) the C8
  selfcheck (rule 3f), (7) the proof row.

## Read first
- RUN-ALL "How to run this file" rules 1 to 16 and "### C8b". Rule 4: cut 8 (outside help), cut 9 (the A4 charge
  request) and cut 10 (rollback) are built. Rule 6 names no replay test for C8b. Rule 7: no old test is edited.
- Spec S2 (A1 to A3), S16 items 5 and 8 to 11, S17 (A4 opening, A3), S21 (HQ row, Building B card) and T-C8b. Also S3,
  S8, S11, S13, S15 and S20.
- Orchestrator note, already decided: after HQ approves, both buildings go live on v1.1 and ticket 2401's first lead on
  the Building B card must be thermostat-spot (C10b's demo checks exactly this); rollback moves both back. Replay keys:
  the same pre-approved rule as C7b; a v1.1 card with no saved answer is a replay miss, never a re-record.

## Items, each failing test first

1. **A signed version loads like a shipped one.** `loadPill("ts-cc", "1.1")` reads `web/pills/ts-cc/v1.1.yaml` when it
   exists, else the version HQ signed in the runtime folder (`web/data/runtime/signed/ts-cc-v1.1.yaml`). Every place
   that loads the live version (ranking, the cards, the Building B card) then ranks with the live v1.1 with no other
   change. Reset clears the runtime folder, so the signed file goes with it.
2. **`web/lib/versions.ts`**: the version records (version, parent, hash, signed by, when, why line, rule id, the job,
   the solution, live or rolled back), the versions list newest first with v1.0 from A1, the live version, and the next
   free version (a later solution starts the next version, S16 item 8, even after a rollback).
3. **`web/lib/hq-flow.ts`** (the presses; each `...Refusal` reads and never writes, each `apply...` runs inside
   memory.update and plans again on the memory it is given):
   - `approve-solution` (A2): refused unless every S16 item 8 gate holds, each with its plain reason: a stored run with
     0 failed and every case run; its hash equals the draft's hash now ("draft changed since the tests" otherwise);
     the draft's red_stops equal v1.0's; it passes loadAndCheckPill. Then: the signed file is written once in the
     runtime folder and never again; signed "HQ pill owner (role-played)"; every building's live version moves at
     once (no per-building accept); the version is recorded; the solution shows approved-and-distributed; the job's
     case is saved (cause = the found lead, facts, fix, why, fixedBy senior-manager, confirmedBy hq, closed at demo
     now, so it is pending); the job goes to pending-30-day; notices "v{version} is live in every building
     (role-played approval by HQ)." to the senior manager, the AOM and the Building B card; and, when the found lead
     has tenantItem on a floor with fit-out-12m, the A4 request for the AOM: `Tenant will hear: "{tenantSolution}"
     This is work on the tenant's fit-out (TS-CC-11). Who pays?` (S17). No amount anywhere.
   - `decline-solution`: a reason of 3 words or more; the job goes back to escalated; no request opens; the senior
     manager hears why.
   - `rollback` (cut 10): a live version above 1.0; every building back to its parent; nothing deleted (the signed
     file, the draft, the cases and the version record stay; the record shows "rolled back"); notices to the senior
     manager, the AOM and the Building B card.
   - `decide-outside-help` (A3, cut 8): an open A3 request on the job; Approve or Decline, each with a reason of 3
     words or more and no amount; the job back to escalated with "outside help approved (A3)" or
     "declined: {reason}" on its card.
   - R-01 already ranks with the rules only (draft-tests.ts), so an open red stop neither fails nor skips it; approve
     is not one of the presses a stop locks (S3), and the stop stays open.
4. **`web/lib/hq-desk.ts`** (the view, read only): the A1 card; each solution sent to HQ with its fix line, why line,
   rule text ("AI drafted, confirmed by the senior manager" or "typed"), condition part by part ("AI suggested from
   the code menu, confirmed by the senior manager" or "picked by hand"), test counts and hash, and the S16 item 8
   gates with a word each; decided solutions with their result; the live version per building; the versions list
   like commits, newest first; Roll back while a version above 1.0 is live; A3 requests; and the Building B card
   (live version, 2401's first 3 live leads with reasons, technician seat, demo clock, the rank wording stored at
   the press by replay key). `seatView` returns it as `hq`.
5. **Rank wording for Building B**: after Approve and Roll back, 2401's live leads are worded for the technician seat,
   outside memory.update, and kept by replay key (action-turn.ts), so the HQ card shows them and a poll never calls
   the AI.
6. **`HqDesk.tsx`** inside SeatChat: the cards above with Approve and send to all buildings, Decline (reason), Roll
   back, outside help Approve or Decline (reason). Every press at least 44 px tall. A refusal shows in the card that
   was pressed.
7. **The senior manager's desk** reads the new statuses: a declined solution shows "Declined by HQ" and its reason; a
   decided A3 request shows "outside help approved (A3)" or "declined: {reason}".

## Tests
- `web/tests/c8b.test.ts`: every T-C8b bullet code can prove, items 1 to 11 where code can prove them, the S16 item 8
  gate reasons one by one, the signed file's bytes after a later action, the next free version after a rollback, and
  only HQ pressing.
- `web/tests/c8b-ui.test.tsx` (jsdom, fake fetch): the A1 card, the solution card's lines and labels, Approve and
  Decline payloads, the versions list newest first, Roll back, the A3 buttons, a refusal in its card, the Building B
  card on the HQ seat.

## Not built here
- The AOM's charge decision and the tenant's charge card (C9). `/how` (C10a). Tell the tenant first (cut 2).

## When done
npm test, npm run build, git diff --stat -- web/tests (no old test changed), render check on a production build
(port 4420, REPLAY_MODE=1, the switch on Replay): Reset, the C8a steps over HTTP to Send to HQ, then /seat/hq at
1280 px and at 390 px (iframe wrapper): Approve, then the Building B card on home shows v1.1 and the thermostat check
first. Key grep, then commit "feat: HQ approval, send to all buildings, versions and rollback [step C8 done]", then
the C8 selfcheck (rule 3f), then the proof row.
