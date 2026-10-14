---
name: C3c
overview: "How a new solution becomes a rule. Part 3 of 3 of C3. Plain code, no AI, no screens."
---

# C3c: condition menu, draft tests and rule-aware ranking [step C3 done]

Built by Claude Code (not CodeBuddy). CodeBuddy credit ran out, so this part was built after C4 to C5b; the
code it changes (rank.ts, rule-engine.ts, pill.ts) already serves the seat pages, so every old test must stay green.

## Read first
- RUN-ALL "How to run this file" rules 1 to 16 (rule 16: the CE-CORR date is the demo clock's date, taken from the
  `now` the code is given, never the real clock; the fixture's ref is "CE-CORR-2026-10-06").
- Spec S16 items 1 to 7, S4 item 6, S9 (signed-rule tier, block removals, reason templates), S5 (fact labels), T-C3c.

## Items, each failing test first

1. **`web/lib/conditions.ts`, the menu (S16 item 1).**
   - Facts: `fit-out-12m`, `repeat`, `opposite-fixes`. Effects, 1 or 2: `block` step 25 only; `put-first` steps 9, 10,
     11, 12, 13, 15, 17, 18, 19, 20, 21, 22, 23, 29, 30 only.
   - `checkCondition(condition, pill, colour?)` returns every refusal in plain words, `[]` when it fits. Refused
     always: any effect on steps 1 to 8, 26, 28, 31; any effect on a step whose rules hold TS-CC-03, 04, 05, 08 or
     26 (read from the pill, not typed); any red step; anything that names a red stop or is not a step number; any
     colour lower than the first effect's step colour; an effect kind not on the menu; two effects on one step.
   - `screenSuggestion(suggestion, pill)`: an AI `{ kind: "note", text }` stays a note; a forced rule the menu
     refuses comes back as `{ kind: "note", text, label: "advisory, not enforced", refusals }`. A note never enters
     a pill.
   - Shared helpers the engine and the ranking both read: `factIsTrue`, `conditionRules`, `blockedSteps`,
     `putFirstSteps`, `fitOutRule`.
2. **`web/lib/draft.ts`, the draft (S16 item 2).** `buildNewRule` / `buildDraft(base, parts, now)` fill every field
   `checkPill` needs: next free id (TS-CC-27 first), rule text (AI off: the fix line word for word), applies_when
   (the fact in words), colour (the first effect's step colour), fixed templates for approver, section, label and
   not_when, `because` holds the why line, `sources: [{ ref: "CE-CORR-<date of now in Singapore>", label: "senior
   manager correction (role-played)" }]`, `condition`. Version one step up, GT-22 added to `golden_tests` once.
   Fix and why lines 3 to 30 words each. Anything off the menu is refused, nothing built. `saveDraft` writes only to
   the memory's runtime folder (web/data/runtime/ live; the per-worker folder in tests), never web/pills/ts-cc/.
3. **Engine (S16 item 3).** `canNudge` keeps every old field, accepts and ignores `pillVersion`, adds optional
   `pill` and `facts`. A fact is true when `facts` has it, or for `fit-out-12m` when `hadFitOutInLast12Months` is
   true. A true-fact rule that blocks step 25 blocks the nudge with that rule's id. Nothing keys on TS-CC-27 or
   "1.1". `getActiveChecklist` takes `facts`: steps 1 to 8 in order, then put-first steps, then the rest in order;
   blocked steps hidden. `rank.ts` reads the same helpers for the signed-rule tier and the block removals.
4. **`checkPill` (S4 item 6).** Any version but 1.0: each extra rule needs a condition that passes
   `checkCondition`, with the rule's own colour; an extra id must be TS-CC-27 or higher. Any rule carrying a
   condition is checked the same way. `loadAndCheckPillFile(path)` for drafts and fixtures.
5. **`web/lib/golden-cases.ts` (S16 item 4).** GT-01 to GT-22 as data: id, title, inputs, expected, appliesTo
   (`no-fit-out-rule` for GT-01 and GT-21, `fit-out-rule` for GT-22, `all` for the rest). Ticket cases read
   tickets.json and buildings.json with the clock rule. **The fixture** `web/tests/fixtures/ts-cc-v1.1.yaml`: v1.0
   with exactly version "1.1", TS-CC-27 (the demo rule) and GT-22. **The one rewrite:** the "v1.1 reserved rule
   (TS-CC-27)" block of golden-tests.test.ts loads v1.0 and the fixture and calls `canNudge` with each as `pill` and
   the fit-out fact. Imports at the top of that file stay byte for byte (the block imports what it needs itself).
6. **`web/lib/draft-tests.ts`, run tests (S16 items 5 and 7).** `runDraftTests(yamlText, { now })`: checkPill (0
   errors), red stops equal v1.0's, every golden case, and R-01 (every open job whose facts make a rule's fact true,
   ranked with the draft live, technician seat, no ticks, no open red stops: the first live lead's checkStep is that
   rule's put-first step). Reports passed, failed and "not applicable to v{version}", never N/A as passed, and the
   `draftHash` it saw. `draftHash` is SHA-256 of the YAML text.
7. **Demo solution by hand.** Built from the menu (fit-out-12m, block 25, put-first 21) with the S16 fix and why
   lines at the demo clock, it equals the fixture's rule and the whole fixture, and passes `checkPill`.
8. **Ranking.** 2401 with the fixture live: thermostat-spot first, signed-rule, reason "Signed expert rule TS-CC-27
   (v1.1): ...", setpoint removed by TS-CC-27. With v1.0: thermostat-spot third.

## Defects to fix on the way (found while reading)
- rank.ts signed-rule reason used the step's first rule (TS-CC-18 for step 21) and the job's first fact; S9 wants
  the signed rule's id and the rule's fact label.
- rank.ts fact labels differ from S5's "Label on screen" (fit-out-12m is "renovation in the last 12 months").
- rank.ts cut canNudge's reason at the first "." so "v1.1" would end the sentence; cut at the sentence end instead.
- The C3a guard test asks `git ls-files web/app web/lib` from inside web/, which matches nothing, so it reads 0
  files and can never fail. Old tests stay byte for byte, so c3c.test.ts adds the same check reading app/ and lib/
  with fs, plus a check that the new C3c modules hold no pill text.

## Noted, not changed (outside C3c)
- canNudge's "allowed" reason and computeRepeatFlag's reason repeat the opening words of step 25's text and
  TS-CC-09's applies_when (S0 rule 5). computeRepeatFlag's body must not change (C2b); canNudge's text predates C1.
- rank.ts's found and ruled-out reasons print the seat id, S9 says the seat label.
- R-01 is read literally: a rule that puts first a check no open job ranks first (for example step 23 on the cold
  jobs, or a step no cause checks) fails R-01, so it cannot go to HQ.

## When done
npm test, npm run build, git diff --stat -- web/tests (only the v1.1 reserved rule block), "no screen changed",
key grep, commit "feat: condition menu, draft tests and rule-aware ranking [step C3 done]", then rule 3f
(C3-selfcheck.md) and the proof row.
