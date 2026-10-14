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
