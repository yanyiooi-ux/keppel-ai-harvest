---
name: C9-selfcheck
overview: "Run rule 3f for step C9: every T-C9 bullet, and the test that proves it."
---

# Step C9 selfcheck

Built by Claude Code (not CodeBuddy). Test names are `file > describe > it`, files in `web/tests/`. Every bullet
already had a test, so nothing was added here and this file is committed alone as "docs: selfcheck for C9".

## T-C9

| Bullet | Proved by |
|---|---|
| The impact meter shows the S18 numbers for Tower A Level 23, and the label | `c9.test.ts > T-C9: the impact meter shows the S18 numbers for Tower A Level 23, and the label > before: 5 calls, 5 visits, no senior check, not fixed after 21 days, 4 repeat calls, S$600 and counting`, `> with Pill Desk: caught at 2305 on 19 Sep, 2 calls, 2 visits, 1 senior check, 4 days, 1 repeat call, S$420`, `> the card always carries the label, word for word, and names its place`, `> the cost comes from the made-up rates: a visit is 2 hours and a senior check 3 hours, at S$60 an hour`, `> the repeat is caught by computeRepeatFlag with the clock rule: 2301 alone is no repeat`; on the AOM seat: `c9.test.ts > C9: the AOM desk on /seat/aom-tower-a > shows the meter for Tower A Level 23, worked out from the calls in the memory and the rates file`; on screen: `c9-ui.test.tsx > C9: the impact meter on the AOM seat > opens on Before: 5 calls, 5 visits, 0 senior manager checks, not fixed after 21 days, 4 repeat calls, S$600 and counting`, `> With Pill Desk: caught at 2305 on 19 Sep, 2 calls, 2 visits, 1 senior check, 4 days, 1 repeat call, S$420; the label stays` |
| Changing a date in a temp copy of `tickets.json` changes the numbers (nothing is hard-coded) | `c9.test.ts > T-C9: changing a date in a temp copy of tickets.json changes the numbers (nothing is hard-coded) > 2301 three days earlier: not fixed after 24 days, and 7 days with Pill Desk`, `> 2305 moved to 1 Aug: it falls out of the run, 4 calls before (S$480 and counting), caught at 2310 on 24 Sep after 9 days`, `> a changed rate in a temp copy of impact-rates.json changes the cost` |
| The speak-first flag shows for Tower A Level 23 | `c9.test.ts > C9: the AOM desk on /seat/aom-tower-a > T-C9: the speak-first flag shows for Tower A Level 23, in the notice's own words, and only for Tower A`, `> the speak-first flag goes once its notice is more than 30 days old on the demo clock`; `c9-ui.test.tsx > C9: the impact meter on the AOM seat > shows the speak-first flag for Tower A Level 23 with its word` |
| Decide charge: AOM only | `c9.test.ts > T-C9: Decide charge is the AOM's only > every other seat is refused, and nothing changes`, `> with no open request it is refused with a plain reason` (and the old `c4.test.ts > T-C4: permissions > HQ cannot press decide-charge`) |
| Tenant pays needs a whole number from 1 to 100000 and a reason of 3 words or more | `c9.test.ts > T-C9: Tenant pays needs a whole number from 1 to 100000 and a reason of 3 words or more > amount %j is refused, and nothing changes` (0, -5, 100001, 350.5, "350", null, undefined, NaN), `> 1 and 100000 are taken`, `> a reason under 3 words is refused, and nothing changes`, `> an amount typed in the reason is refused: the amount goes only in the number field`, `> a choice that is not one of the three is refused`; on screen: `c9-ui.test.tsx > C9: the charge request and Decide charge > shows the request word for word, with the three choices, a number field and a reason`, `> Tenant pays sends decide-charge with the amount as a whole number and the reason` |
| After a test decision of 350 on 2318, the tenant gets exactly this code card, and nothing before: "What we will do: Our contractor will move the wall thermostat back to the spot on your approved fit-out drawing, with your OK. Cost: S$350, made-up demo amount. Approved by the AOM (role-played)." | `c9.test.ts > T-C9: after a test decision of 350 on 2318, the tenant gets exactly this code card, and nothing before > nothing reaches the tenant before the decision: no solution, no amount`, `> Tenant pays 350: one new card in the tenant chat, word for word, from code`, `> the request is decided, with the choice, the amount, the reason, who and when; the AOM desk shows it`, `> a decided request cannot be decided again, and the tenant gets no second card`; on screen: `c9-ui.test.tsx > C9: the charge request and Decide charge > the tenant seat shows the code card after the decision, and none before` |
| Goodwill needs a reason | `c9.test.ts > T-C9: after a test decision of 350 on 2318, the tenant gets exactly this code card, and nothing before > Goodwill needs a reason`; Goodwill's card: `> Landlord pays and Goodwill each say "no charge to you", and keep no amount`; on screen: `c9-ui.test.tsx > C9: the charge request and Decide charge > Goodwill sends no amount` |
| No AI call is made for any charge step | `c9.test.ts > T-C9: no AI call is made for any charge step > Decide charge on Live with a fake client: 0 calls, the AI count unchanged`, `> a refused Decide charge on Live calls nothing either`, `> the AI never sees the amount: no prompt made after the decision holds it`; the request and the tenant card carry "AI calls: 0": `c9.test.ts > C9: the charge request on the AOM desk > no request before HQ approves; after Approve it shows open, word for word, with no amount` and `> Tenant pays 350: one new card in the tenant chat, word for word, from code` |

Open question, not a T-C9 bullet: what the tenant hears after an after-hours charge decision (QUESTIONS.md question 10,
`c9.test.ts > C9: the after-hours charge request (S10) > QUESTION C9: ...`, it.todo).

Render items, for the record (not T-list bullets): C9's render check on a production build (next build, then next
start on port 4500, Replay) looked at /seat/aom-tower-a at 1280 px and at 390 px (iframe wrapper for the Before tab;
headless Chrome over its debugging port at a true 390 px for the With Pill Desk tab and the Decide charge press), and
at /seat/tenant at 1280 px and 390 px after the decision. PNGs in the finish-sprint look-samples folder, named in the
C9 proof row.
