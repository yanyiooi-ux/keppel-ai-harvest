---
name: C2a Engine Fixes
overview: "Engine fixes part 1 of 4 for C2: red stop ids RS-01 to RS-10, pure pill generator in pill-source.ts, fix checkRedStop flag-to-stop mapping (water→RS-04 not RS-01), add getRedStop/checkRedStops, make loadAndCheckPill throw, make checkPill version-aware, add hasScorchedPlug flag. All 42 existing tests must pass unchanged. New tests added via failing-test-first."
todos:
  - id: create-pill-source
    content: Create web/scripts/pill-source.ts with pill object (id as last field on each red stop) and buildPillYaml(), then rewrite generate-pill.ts as thin command and run it once
    status: completed
  - id: add-red-stop-type-and-checkpill
    content: Add id to RedStop type in pill.ts, make loadAndCheckPill throw, make checkPill version-aware with red stop id validation
    status: completed
    dependencies:
      - create-pill-source
  - id: rewrite-check-red-stop
    content: Rewrite checkRedStop with flag→stop-id map and hasScorchedPlug, add id to RedStopResult, add getRedStop and checkRedStops
    status: completed
    dependencies:
      - add-red-stop-type-and-checkpill
  - id: switch-app-loaders
    content: Switch tech/page.tsx and aom/page.tsx from loadPill to loadAndCheckPill
    status: completed
    dependencies:
      - add-red-stop-type-and-checkpill
  - id: write-c2a-tests
    content: Write all T-C2a tests in web/tests/c2a.test.ts (failing test first for each item, then fix and pass)
    status: completed
    dependencies:
      - create-pill-source
      - add-red-stop-type-and-checkpill
      - rewrite-check-red-stop
  - id: verify-build-and-commit
    content: "Run npm test (expect 42+ new tests) and npm run build, verify git diff v1.0.yaml shows only 10 id lines, commit as fix: red stop ids, pure pill generator, right red stop words [C2a]"
    status: completed
    dependencies:
      - write-c2a-tests
      - switch-app-loaders
---

## Product Overview

Engine fixes for the Pill Desk rule engine — part 1 of 4 for step C2. Pure code changes, no AI, no screens. Follows spec S4 and T-C2a exactly.

## Core Features

- Red stop ids RS-01 to RS-10 as the last field of each stop in v1.0.yaml; RedStop type gains `id`
- Pure pill generator: pill object + `buildPillYaml()` moved to `web/scripts/pill-source.ts`; `generate-pill.ts` becomes a thin command
- `checkRedStop` rewritten: each flag maps to one stop by S4 table; `hasWaterDripping` returns RS-04's words; new `hasScorchedPlug` maps to RS-03; `RedStopResult` gains `id`
- New `getRedStop(pill, id)` and `checkRedStops(pill, ids)` functions
- `loadAndCheckPill` throws on any error; all app loaders switch from `loadPill` to `loadAndCheckPill`
- `checkPill` version-aware: v1.0 refuses TS-CC-27; red stop id validation (missing, repeated, wrong set)
- All 42 existing tests pass unchanged; new tests added via failing-test-first

## Tech Stack

- Language: TypeScript
- Test framework: Vitest
- Build: Next.js 16.3.8 (Turbopack)
- YAML library: `yaml` (stringify/parse)

## Implementation Approach

### 1. Red stop ids (S4 item 1)

- Add `id: string` as the **last** field of the `RedStop` interface in `web/lib/pill.ts`
- Add `id: "RS-01"` through `id: "RS-10"` as the last property of each red stop object in `web/scripts/pill-source.ts` (after the move)
- `checkPill` validates: each red stop has an id, no repeated ids, and for v1.0 the set is exactly RS-01..RS-10

### 2. Pure pill generator (S4 item 2)

- Create `web/scripts/pill-source.ts`: move the entire `pill` object (currently lines 15-556 of `generate-pill.ts`) plus a new `buildPillYaml(): string` function that returns `stringify(pill)`. This module imports only `stringify` from `yaml` — never imports `fs`. Add `id` fields to each red stop.
- Rewrite `web/scripts/generate-pill.ts` to ~10 lines: import `buildPillYaml` from `pill-source.ts`, write to `web/pills/ts-cc/v1.0.yaml`
- Run `npx tsx scripts/generate-pill.ts` once to regenerate v1.0.yaml with ids
- `git diff web/pills/ts-cc/v1.0.yaml` must show only 10 added `id: RS-xx` lines

### 3. checkRedStop flag-to-stop mapping (S4 item 3)

- Rewrite `checkRedStop` in `web/lib/rule-engine.ts`: instead of looping stops and matching by rule id, build a flag→id lookup table. Collect all triggered stop ids from set flags, then return the first stop (in YAML order) whose id matches.
- Add `hasScorchedPlug` to the context type
- Flag→stop-id map:
- hasSmoke → RS-01
- hasBurningSmell → RS-02
- hasScorchedPlug → RS-03
- hasWaterDripping → RS-04
- someoneUnwell → RS-05
- ahuTripping → RS-06
- chillerCause → RS-07
- damperFullyOpenForHours, noApprovedRuleCovers → RS-08
- ceilingAccessWithoutApproval, workingAlone → RS-09
- aiAskedToWriteToBms, aiAskedToQuotePrice, aiAskedToAdmitFault → RS-10
- `RedStopResult` gains `id: string` field
- Returns first match in YAML order with its id, trigger, action, whoToCall, relatedRuleIds

### 4. getRedStop and checkRedStops (S4 item 4)

- `getRedStop(pill, id)`: returns the `RedStop` whose `id` matches, or `null`
- `checkRedStops(pill, ids)`: returns every stop whose id is in `ids`, in YAML order, each with id, trigger, action, who_to_call, rules

### 5. loadAndCheckPill throws (S4 item 5)

- Change `loadAndCheckPill` to: `const errors = checkPill(pill); if (errors.length > 0) throw new Error(errors.join("; "));`
- Switch `web/app/tech/page.tsx` and `web/app/aom/page.tsx` from `loadPill` to `loadAndCheckPill`
- Tests may still use `loadPill` directly (S0 rule 3: old tests stay unchanged)

### 6. checkPill version-aware (S4 item 6)

- v1.0 path: must have exactly TS-CC-01..26, refuse TS-CC-27 (current behavior preserved)
- Other versions: must have TS-CC-01..26, extras allowed; condition validation deferred to C3c
- Every source still needs `ref` and `label` (already checked)
- Red stop validation: missing id, repeated id, wrong set for v1.0
- Any version's red_stops must equal v1.0's exactly (for v1.0 this is trivially true; future versions compared against v1.0 loaded as reference)

### 7. Existing tests compatibility

All 42 existing tests verified compatible with the new mapping:

- GT-03 (hasBurningSmell): RS-02 rules=["TS-CC-03"] → contains TS-CC-03 ✓
- GT-09 (someoneUnwell): RS-05 rules=["TS-CC-04"] → contains TS-CC-04 ✓
- GT-10 (hasBurningSmell): RS-02 rules=["TS-CC-03"] → contains TS-CC-03 ✓; heater stop found by TS-CC-07 ✓
- GT-14 (aiAskedToWriteToBms): RS-10 rules=["TS-CC-06"] → contains TS-CC-06 ✓
- GT-15 (ceilingAccessWithoutApproval+workingAlone): RS-09 rules=["TS-CC-08"] ✓
- GT-17 (damperFullyOpenForHours): RS-08 rules=["TS-CC-26"] → contains TS-CC-26 ✓
- GT-18 (hasWaterDripping): RS-04 rules=["TS-CC-03","TS-CC-08"] → contains TS-CC-03 ✓
- GT-19 (ahuTripping): RS-06 rules=["TS-CC-05"] → contains TS-CC-05 ✓

## Implementation Notes

- **Failing test first**: For each item, write the test, run it, show it fail, then fix the code and show it pass. This is S0 rule 2.
- **Old tests untouched**: S0 rule 3 — the 42 existing tests are never deleted, skipped, or weakened. `pill-check.test.ts` and `golden-tests.test.ts` still use `loadPill` directly, which still works.
- **YAML key order**: The `yaml` library's `stringify` preserves object key insertion order. Adding `id` as the last property of each red stop object ensures `id` appears last in the YAML output, so the diff is only 10 added lines.
- **No file writes from tests**: Tests import `pill-source.ts` and compare `buildPillYaml()` with `readFileSync` of v1.0.yaml. No test writes the pill file.
- **tickets.json unchanged**: S4 item 7.
- **No secrets**: Never open, print, or echo `web/.env.local`.

## Architecture Design

### Module relationships

```
web/scripts/pill-source.ts  (pure: pill object + buildPillYaml(): string, no fs)
  ↓ imported by
web/scripts/generate-pill.ts (thin: calls buildPillYaml(), writes v1.0.yaml)
  ↓ imported by
web/tests/c2a.test.ts (new tests: compares buildPillYaml() with readFileSync)

web/lib/pill.ts
  - RedStop type gains id
  - loadPill (unchanged, still used by tests)
  - loadAndCheckPill (now throws)
  - checkPill (version-aware, red stop id validation)

web/lib/rule-engine.ts
  - RedStopResult gains id
  - checkRedStop (rewritten: flag→stop-id lookup)
  - getRedStop (new)
  - checkRedStops (new)

web/app/tech/page.tsx, web/app/aom/page.tsx
  - loadPill → loadAndCheckPill
```

## Directory Structure

```
web/
├── lib/
│   ├── pill.ts              # [MODIFY] RedStop type gains id; loadAndCheckPill throws; checkPill version-aware + red stop id validation
│   └── rule-engine.ts       # [MODIFY] RedStopResult gains id; checkRedStop rewritten with flag→id map + hasScorchedPlug; add getRedStop, checkRedStops
├── scripts/
│   ├── pill-source.ts       # [NEW] Pill object (moved from generate-pill.ts) + buildPillYaml(): string. Each red stop has id as last field. Never imports fs.
│   └── generate-pill.ts     # [MODIFY] Thin command: import buildPillYaml, write v1.0.yaml. ~10 lines.
├── pills/ts-cc/
│   └── v1.0.yaml            # [MODIFIED] Only 10 added "id: RS-xx" lines (regenerated by running generate-pill.ts once)
├── tests/
│   ├── c2a.test.ts          # [NEW] All T-C2a tests: getRedStop (10), hasWaterDripping→RS-04, hasScorchedPlug→RS-03, checkRedStops ordering, buildPillYaml equals v1.0.yaml, checkPill id validation, loadAndCheckPill throws, v1.0 refuses TS-CC-27
│   ├── pill-check.test.ts   # [UNCHANGED] 15 tests, uses loadPill
│   ├── golden/golden-tests.test.ts  # [UNCHANGED] 23 tests
│   └── ai-setup.test.ts     # [UNCHANGED] 4 tests
├── app/
│   ├── tech/page.tsx        # [MODIFY] loadPill → loadAndCheckPill
│   └── aom/page.tsx         # [MODIFY] loadPill → loadAndCheckPill
```

## Key Code Structures

```typescript
// web/lib/pill.ts — RedStop gains id as last field
export interface RedStop {
  trigger: string;
  action: string;
  who_to_call: string;
  rules: string[];
  id: string;  // RS-01 to RS-10, last field
}

// web/lib/rule-engine.ts — RedStopResult gains id
export interface RedStopResult {
  isRed: boolean;
  id: string;
  trigger: string;
  action: string;
  whoToCall: string;
  relatedRuleIds: string[];
}

// checkRedStop context gains hasScorchedPlug
export function checkRedStop(
  pill: Pill,
  context: {
    hasBurningSmell?: boolean;
    hasSmoke?: boolean;
    hasScorchedPlug?: boolean;  // new
    hasWaterDripping?: boolean;
    someoneUnwell?: boolean;
    ahuTripping?: boolean;
    damperFullyOpenForHours?: boolean;
    chillerCause?: boolean;
    ceilingAccessWithoutApproval?: boolean;
    workingAlone?: boolean;
    aiAskedToWriteToBms?: boolean;
    aiAskedToQuotePrice?: boolean;
    aiAskedToAdmitFault?: boolean;
    noApprovedRuleCovers?: boolean;
  }
): RedStopResult;

// New functions
export function getRedStop(pill: Pill, id: string): RedStop | null;
export function checkRedStops(pill: Pill, ids: string[]): RedStop[];
```