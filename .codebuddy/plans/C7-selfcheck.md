---
name: C7-selfcheck
overview: "Run rule 3f for step C7: every T-C7a and T-C7b bullet, and the test that proves it."
---

# Step C7 selfcheck

Built by Claude Code (not CodeBuddy). Test names are `file > describe > it`. Two bullets got a new test here, both in
the commit "test: missing checks for C7 [fix done]": T-C7a's "no job for the technician" (C7a proved it with the
open-job gate only; once C7b added the technician's job list, that list still showed a job a tip had closed, which
the new test caught and the same commit fixed), and T-C7b's "within one poll (2 seconds)" for a tick the screen did
not make itself.

## T-C7a

| Bullet | Proved by |
|---|---|
| Hot, west boardroom, blinds up: the tip with TS-CC-20 word for word (AI off), the job `pending-30-day`, 0 visits, no job for the technician | `c7a.test.ts > T-C7a: hot, west boardroom, blinds up > the TS-CC-20 tip word for word (AI off), the job pending-30-day with its why, 0 visits, no job for the technician`; `c7a-review.test.ts > C7a review: the tenant reply holds the number of tips S10 names > blinds up: exactly 1 tip, the blinds tip, and the reply is not empty`; new: `c7-selfcheck.test.ts > T-C7a: hot, west boardroom, blinds up leaves no job for the technician > the technician's job list does not show the job a tip closed` |
| Cold, core, "It keeps coming back": visit booked, the answers attach to 2318 (no new job), the 2 tips with TS-CC-09, and no second speak-first notice | `c7a.test.ts > T-C7a: cold, core, It keeps coming back > visit booked, the answers attach to 2318 (no new job), the 2 TS-CC-09 tips, no second speak-first notice`; `c7a-review.test.ts > C7a review: the tenant reply holds the number of tips S10 names > It keeps coming back: exactly the 2 TS-CC-09 tips, the report tip and the steady-settings tip` |
| Q0 Yes: the Safety list; picking RS-04 shows its words, AI calls 0, alerts to the senior manager and the AOM | `c7a.test.ts > T-C7a: Q0 Yes > opens the Safety list for that job and asks nothing more; picking RS-04 shows its words, AI calls 0, alerts to the senior manager and the AOM` |
| After hours Yes (a test report time of 20:00): the tip with TS-CC-12 and an A4 request for the AOM; the tenant chat shows no amount | `c7a.test.ts > T-C7a: after hours Yes (a test report time of 20:00) > the TS-CC-12 tip, the AOM line, an A4 request for the AOM, the job pending-30-day; the tenant chat shows no amount`; `c7a-review.test.ts > C7a review: the tenant reply holds the number of tips S10 names > after hours Yes: exactly 1 tip, the after-hours request tip, then the AOM line` |
| A new spot (zone "Somewhere else") makes job 2319 in `visit-booked` | `c7a.test.ts > T-C7a: a new spot > zone Somewhere else makes job 2319 in visit-booked, with its place and answers` |
| Hands-off guard: no question text contains climb, reset, unplug, switch off, turn off, adjust, remove or "open the" | `c7a.test.ts > C7a: the self-check questions are the S10 table, fixed in self-check.ts > T-C7a hands-off guard: no question text or answer has climb, reset, unplug, switch off, turn off, adjust, remove or "open the"` |
| An AI tenant reply with "because your fit-out moved the thermostat" fails and the tips show word for word | `c7a.test.ts > T-C7a: an AI tenant reply that breaks S13 item 10 fails > 'because your fit-out moved the thermostat': the tips show word for word and no AI line` |

## T-C7b

| Bullet | Proved by |
|---|---|
| Open 2318: the filled checklist shows Tower A Level 23, core, VAV-23-C1; 5 calls with their dates; the repeat flag with opposite fixes; 4 past dial turns each "Failed: the spot called again"; fit-out 8 months ago; the self-check answers; the RS-08 trend card word for word with AI calls 0 | `c7b.test.ts > T-C7b: open 2318 shows the filled checklist > the place tag: Tower A Level 23, core, VAV-23-C1`, `> 5 calls at this spot in 30 days, each with its date and what it changed`, `> the repeat flag with opposite fixes, and the checklist note`, `> 4 past dial turns, each "Failed: the spot called again"`, `> the fit-out from buildings.json: 8 months ago`, `> the tenant's self-check answers and the thermostat note`, `> the RS-08 trend card word for word from the pill, AI calls 0, and it locks nothing` |
| The ranked leads match T-C2d, and each tick re-ranks within one poll (2 seconds) | `c7b.test.ts > T-C7b: the ranked leads match T-C2d and each tick re-ranks on the next read > precool, min-airflow, thermostat-spot with S9's exact reasons, check text, check time and fix line`, `> removed holds setpoint (TS-CC-09), sun-west and capacity, and rebalance, with their reasons`, `> Not this on precool: min-airflow first on the next read; precool ruled out with who ticked it`, `> then Not this on min-airflow: thermostat-spot first, low confidence; clear on min-airflow brings it back first`; `c7b-ui.test.tsx > C7b: a tick re-ranks at once, before the next poll > Not this on precool sends the tick and the reloaded order shows with no poll running`; new: `c7-selfcheck-ui.test.tsx > T-C7b: a tick made elsewhere re-ranks on screen within one poll (2 seconds) > the live chat (no pollMs given) reads the view again 2 seconds after the last read, and shows the new order` |
| Not solved needs the impact record; the job goes to `escalated` and the senior manager's chat gets it with a cost from the made-up rates | `c7b.test.ts > T-C7b: Not solved needs the impact record (S3) and reaches the senior manager with a cost from the made-up rates > with no impact record it is refused and nothing changes`, `> with the record: escalated, the record and its cost on the job, S$420 for 3 hours and 2 visits`, `> the senior manager's chat gets everything attached: place, ticks with who, self-check answers, the impact record and cost`; `c7b.test.ts > C7b: web/data/impact-rates.json (S18) and the impact record's cost (S3) > the cost comes from the rates it is given: hours lost at the hourly rate plus each extra visit's hours` |
| Found it on thermostat-spot, then Solved: refused ("this fix belongs to the senior manager"); Send with the cause escalates with the cause | `c7b.test.ts > T-C7b: Found it on thermostat-spot, then Solved is refused; Send with the cause escalates with the cause > Solved: refused, "this fix belongs to the senior manager"; nothing is saved`, `> Send with the cause: escalated with thermostat-spot as its cause, and the senior manager hears it` |
| The low-confidence notice reaches the senior manager exactly once | `c7b.test.ts > T-C7b: the low-confidence notice reaches the senior manager exactly once > after the second Not this on 2318, once; clearing and ticking again adds none` |
| At 390 px: the Safety button and the Solved and Not solved buttons are on screen without sideways scroll | Render item (rule 3f), seen on the production build (next start, port 4400, Replay) in the browser pane at 390 x 844 after Open job 2318: the bar with Solved, Not solved, Send with the cause and Safety sat at 718 to 844 px of an 844 px screen, page scroll width 390 = screen width, all 20 buttons 44 px or taller. Headless Chrome PNGs at 390 px through the iframe wrapper, looked at: `Reports\tencent-ai-hackathon\finish-sprint\look-samples\c7b-seat-technician-open-390.png` and `c7b-seat-technician-ticked-390.png`. |

Not a T-list bullet, for the record: run rule 6's rank wording on 2318 through C7b's real code path on Replay passes
(`c7b.test.ts > C7b run rule 6: rank wording on 2318 on Replay finds the saved real answers > Open job 2318 on Replay:
each lead carries the banner "replay: saved real AI answer", read only`), and C7a's tenant reply on Replay is still
the it.todo "replay miss: tenant-reply 2318" (QUESTIONS.md question 5).
