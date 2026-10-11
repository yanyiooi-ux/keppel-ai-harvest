---
name: C2c
overview: "The cause list, the case library and the 30-day rule. Part 3 of 4 of C2. Plain code, no AI, no screens."
---

# C2c: Cause list, case library, 30-day rule

## Items (from RUN-ALL C2c + spec S7, S8, T-C2c)

1. web/data/causes.json: 7 causes as S7, labelled. checkStep text from pill by checkStep, never typed. rebalance fixSeat = "none". tenantSolution "we" sentences.
2. web/data/trends.json: replace only the core block with S7. label and west stay byte for byte.
3. web/data/cases.json: 12 history cases H-01 to H-12, +08:00, labelled, no tenant names.
4. casesFromTickets: 2301, 2305, 2310, 2315 become setpoint cases.
5. similar case and weight: symptom match + 2 shared facts, weight = shared facts count.
6. web/lib/outcome.ts: outcomeOf as S8 (failed, pending, won, unconfirmed). Points: won +weight, failed -weight, pending/unconfirmed 0.
7. At demo clock: 2301/2305/2310/2315 failed, H-06/H-10 failed, other 10 won.
8. Call at building-b/12 never fails tower-a/23 case.
9. Runtime cases live in memory (C4), never in cases.json.

## T-C2c checks
- cases.json: 12 cases, labelled, no tenant names
- At demo clock: 2301, 2305, 2310, 2315 failed, repeats 2305, 2310, 2315, 2318. H-06, H-10 failed. Other 10 won.
- Pending case: tower-a/23 closed 2026-10-06T14:00, at 2026-10-20 pending, at 2026-11-05 won, with 2026-10-15 call failed
- Same case with confirmedBy = fixedBy: unconfirmed, 0 points
- Call at building-b/12 never fails tower-a/23 case
- causes.json: rebalance fixSeat "none", thermostat-spot tenantSolution starts "Our contractor will move"
- trends.json: core = S7, label and west unchanged
