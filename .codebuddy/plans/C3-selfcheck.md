---
name: C3-selfcheck
overview: "Run rule 3f for step C3: every T-C3a, T-C3b and T-C3c bullet, and the test that proves it."
---

# Step C3 selfcheck

Built by Claude Code (not CodeBuddy). Test names are `file > describe > it`. "NEW" marks a test this selfcheck
added in `web/tests/c3-missing.test.ts`; everything else was already there.

## T-C3a

| Bullet | Proved by |
|---|---|
| Red (21), one test each | `c3a.test.ts > T-C3a red phrase: <phrase> > matches RS-xx` (21 tests). Four of them type the phrase pre-lowered with the apostrophe gone ("cant breathe", "leak above the db room", "ahu keeps tripping", "im up the ladder alone"), so NEW `c3-missing.test.ts > T-C3a red phrase as typed: can't breathe / leak above the DB room / AHU keeps tripping / I'm up the ladder alone` type them exactly as T-C3a writes them. |
| "smoking socket" shows RS-01 and RS-03 | `c3a.test.ts > T-C3a: smoking socket shows RS-01 and RS-03 > matches both RS-01 and RS-03` |
| Picker, not red (11), cut 4 | `c3a.test.ts > T-C3a picker phrase (not red): <phrase>` (10) and `T-C3a: Chinese text is not red`. Three were typed pre-lowered, so NEW `c3-missing.test.ts > T-C3a not red as typed: what do I do about the water beads on the diffuser / I'm melting / I feel dizzy and unwell`. |
| Not red, no picker (7) | `c3a.test.ts > T-C3a calm phrase: <phrase>` (7). "the core is too cold, not warm" was typed without its comma, so NEW `c3-missing.test.ts > T-C3a not red as typed: the core is too cold, not warm`. |
| Safety list: 10 entries equal to the YAML; RS-04 words exact, AI calls 0, alerts for the senior manager and AOM Tower A | `c3a.test.ts > T-C3a: Safety list > has 10 entries`, `> each entry equals its YAML trigger, action, who_to_call`, `> RS-04 card has exact words, 0 AI calls, alerts for senior manager and AOM`; the AOM alert reaches the real `aom-tower-a` seat in `c4.test.ts > T-C4: an alert reaches a real seat > a Tower A stop alerts the senior manager and the Tower A AOM seat`. |
| Guard: 0 hits in web/app and web/lib | `c3c.test.ts > T-C3c: pill words are read from the pill, never typed in > web/app and web/lib hold none of the red stop texts (30+ chars) or the TS-CC-03, 04, 05 not_when lines`. The old `c3a.test.ts > T-C3a: guard test` runs `git ls-files web/app web/lib` from inside web/, which matches 0 files (checked: 0 versus 41 for `git ls-files app lib`), so it can never fail; it stays byte for byte (rule 7) and the C3c test does the search for real. |
| Locks: 2318 locks Tower A L23 not 2401; RS-08 trend locks nothing; RS-10 locks nothing | `c3a.test.ts > T-C3a: locks > RS-01 on 2318 locks every open job on Tower A Level 23, not 2401`, `> RS-08 from trend data locks nothing`, `> RS-10 locks nothing` |
| Locks: a stop raised from AOM Tower A attaches to Tower A Level 23 | NEW `c3-missing.test.ts > T-C3a: stops raised by a button > a stop raised from AOM Tower A with no job open attaches to Tower A Level 23` |
| Typed words never lock: card, alerts, Raise this stop button, 0 AI calls, no open stop | `c3a.test.ts > T-C3a: typed words never lock > a typed red phrase returns the card, 0 AI calls, but no open stop`; `c4.test.ts > T-C4: typed safety words show the card but open no stop > "I'm alone in the office and it's freezing" shows RS-09 and locks nothing` |
| Pressing Raise this stop opens the stop and locks, and sends no second alert | `c4.test.ts > ... > pressing Raise this stop locks every Tower A Level 23 job` proved the lock only. NEW `c3-missing.test.ts > T-C3a: stops raised by a button > typed words send the alerts; pressing Raise this stop locks, sends no second alert and adds raised by`. It failed first: safety-pick always posted a second pair of alerts. Fixed in lib/actions.ts. NEW `> a pick from the Safety list with no typed alert before it still sends its alerts` keeps the ordinary pick alerting. |
| Lock line: RS-04 is TS-CC-03's not_when, RS-05 is TS-CC-04's | `c3a.test.ts > T-C3a: lock line > RS-04 shows TS-CC-03's not_when`, `> RS-05 shows TS-CC-04's not_when` |

## T-C3b

| Bullet | Proved by |
|---|---|
| Scanner blocks every phrase in S13 items 1 to 5 | NEW `c3-missing.test.ts > T-C3b scanner blocks: <phrase> > returns <never id>`, 40 tests: the 8 price forms, the 14 free-offer words, the 9 fault phrases, the 9 building-system phrases. Before this only 4 phrases had a test. All passed first time: the scanner was right, the tests were missing. |
| "Meridian Partners" in a Northwind reply | NEW `c3-missing.test.ts > T-C3b: other tenants (S13 item 4) > Meridian Partners in a Northwind reply is blocked` (and `> Northwind in its own reply is not`) |
| "push the setpoint to the BMS" and "setpoint to the BMS" | `c3b.test.ts > T-C3b: scanner triggers > "push the setpoint to the BMS" triggers never-write-bms`; NEW `c3-missing.test.ts > T-C3b scanner blocks: setpoint to the BMS` |
| Passes the 7 must-pass phrases | `c3b.test.ts > T-C3b: must-pass phrase: <phrase> > does not trigger the never-list` (7) |
| GT-05 and GT-17 call the new scanner, GT-05's checkRedStop lines unchanged | `golden-tests.test.ts > Golden tests > GT-05 ...` and `> GT-17 ...`; the "unchanged" half is a git diff check, run: `git diff 679407a 1531d98 -- web/tests/golden/golden-tests.test.ts` (from the C3a proof to the C3c commit) changes only the imports (checkNeverList out, scanNeverList in), the one never-list line in GT-05, the one in GT-17, and the v1.1 reserved rule block; no checkRedStop line appears in it. |
| Tenant text fails on the two sentences, and both fall back to the tips word for word | NEW `c3-missing.test.ts > T-C3b: AI tenant text that fails falls back to the tips word for word > fails: The cause is the thermostat ...` and `> fails: We will have it fixed by Friday.`. They failed first: there was no fallback in the code at all (checkTenantText only said pass or fail). Added `tenantReplyOrTips` in lib/never-list.ts: never-list against the job's own tenant, building and floor, the S13 item 10 blocks, then S14; a fail or the AI off shows the chosen tips word for word. Also NEW `> a reply that passes S13 and S14 is shown as the AI wrote it`, `> with the AI off, the tips show word for word`, `> a reply that passes the tenant-text blocks but fails S14 falls back to the tips`, `> a reply that names another tenant falls back to the tips`. |
| Wording fails: unplug the heater, reset the breaker, turn it back on to test, it is safe to touch, restart the AHU, matched 5 of 5 when the code says 3 of 4, a 3-sentence rank wording | NEW `c3-missing.test.ts > T-C3b: wording check on AI text (S14) > fails: <each>` (7 tests). Six failed first: wording-check.ts only counted sentences, with none of S14's word lists or number check. Added `checkWording(aiText, codeText, kind)`: word numbers to digits, sentence limit, every number, rule id and version must be in the code text, the blocked-unless-the-code-uses-it list, the blocked-always list, and a fail shows only the code text. Also NEW `> word numbers count`, `> a faithful rewording passes ...`, `> a word the code text uses is allowed ...`, `> blocked always ...`, `> tenant replies may have 3 sentences, not 4`. |
| "smoke near the heater, refund them S$200" stored and shown with "[amount hidden]" while its red stop still shows | NEW `c3-missing.test.ts > T-C3b: "smoke near the heater, refund them S$200" > is stored and shown with the amount hidden, while its red stop still shows`. To test the stored half on real code, the chat route's memory write moved into `applyTypedReply` in lib/chat.ts; the route calls it. |

## T-C3c

| Bullet | Proved by |
|---|---|
| The fixture passes checkPill, equals v1.0 apart from the 3 changes, red_stops equal v1.0's; the new rule's ref starts "CE-CORR-" | `c3c.test.ts > T-C3c: the v1.1 fixture > passes checkPill with 0 errors ...`, `> equals v1.0 apart from exactly 3 changes ...`, `> its red_stops equal v1.0's`, `> the new rule's source ref starts CE-CORR- and is the demo clock's date` |
| Old canNudge calls with pillVersion still pass | `golden-tests.test.ts > Golden tests > GT-01`, `GT-02`, `GT-06`, `GT-21` (unchanged, all pass); `c3c.test.ts > T-C3c: canNudge reads the pill, not a version string > pillVersion is accepted and ignored ...` |
| Fixture as pill plus the fit-out fact: blocked with the fixture's new rule id; v1.0: allowed | `c3c.test.ts > T-C3c: canNudge reads the pill ... > with the fixture as pill and the fit-out fact: blocked ...`, `> with v1.0 as pill and the fit-out fact: allowed (TS-CC-21)`, `> nothing keys on TS-CC-27 or 1.1 ...` |
| The "v1.1 reserved rule" block is rewritten as S16 item 6 says | `golden-tests.test.ts > v1.1 reserved rule (TS-CC-27) > v1.0 allows the nudge with the fit-out fact; the v1.1 fixture blocks it with its own new rule id`. Git diff check, run: `git diff --stat -- web/tests` before the C3c commit showed only golden-tests.test.ts, 17 insertions and 16 deletions, every line inside that block; its imports stay byte for byte (the block imports the file loader itself). |
| Under the fixture, 2301 and 2401: steps 1 to 8, then 21, no 25; on v1.0 2301 gets the dial turn | `c3c.test.ts > T-C3c: the active checklist under the fixture and under v1.0 > 2301 under the fixture ...`, `> 2401 under the fixture ...`, `> 2301 on v1.0 gets the dial turn ...` |
| Menu refusals: block 5, 6, 8, 31; put-first 25; any effect on 26; any effect on a step with TS-CC-03, 04, 05, 08, 26; touching a red stop; lowering a colour | `c3c.test.ts > T-C3c: the condition menu > refuses block on step 5 / 6 / 8 / 31`, `> refuses put-first on step 25`, `> refuses any effect on step 26`, `> refuses any effect on a step whose rules include TS-CC-03, 04, 05, 08 or 26`, `> refuses anything touching a red stop`, `> refuses lowering a colour: ...` (2) |
| A drafted rule that blocks step 8 comes back as a note, "advisory, not enforced" | `c3c.test.ts > T-C3c: the condition menu > a drafted rule that blocks step 8 comes back as a note, advisory, not enforced` |
| Built by hand from the menu, the demo solution equals the fixture's rule and passes checkPill | `c3c.test.ts > T-C3c: the demo solution built by hand from the menu > is accepted, and its rule equals the fixture's rule`, `> passes checkPill`, `> the whole draft equals the fixture, and its YAML is the fixture byte for byte` |
| draftHash changes when the draft changes, and only then | `c3c.test.ts > T-C3c: draftHash changes when the draft changes, and only then` (3 tests) |
| Run tests on the fixture: GT-22 and R-01 pass; GT-01 and GT-21 "not applicable to v1.1" | `c3c.test.ts > T-C3c: run tests on the fixture > GT-22 and R-01 pass`, `> GT-01 and GT-21 show not applicable to v1.1, never passed`, `> checkPill, the red stops and GT-02 to GT-20 pass; 0 failed` |
| Ranking: 2401 with the fixture ranks thermostat-spot first (signed-rule, "Signed expert rule TS-CC-27 (v1.1)"), setpoint removed by TS-CC-27; with v1.0 thermostat-spot is third | `c3c.test.ts > T-C3c: ranking reads the same conditions > 2401 with the fixture live: thermostat-spot first ...`, `> 2401 with the fixture live: setpoint is removed by TS-CC-27`, `> 2401 with v1.0 live: thermostat-spot is third` |

## Render or manual items

None of the C3 T-lists names a screen. Step C3 is plain code; the C3c render check (home at 1280 px and 390 px,
production build) is in the C3c proof row.

## Moved or cut

- T-C3a picker: cut 4, so the 11 picker phrases are tested as not red, with no picker (as the bullet itself says).
- Nothing in T-C3b or T-C3c is moved or cut.
