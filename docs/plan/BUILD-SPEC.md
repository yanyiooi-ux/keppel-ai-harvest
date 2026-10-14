# Pill Desk build spec

For CodeBuddy and the reviewer. Version 2, 10 Oct 2026. It replaces version 1 (7 Oct), whose amber "ask for a yes"
steps, 4-check Fixed gate, per-building Accept and interview are gone.

This file holds the rules and the tests for building Pill Desk. Each prompt names the sections to follow, for example
"S9 and T-C2d". Read those, plus S0 and S1. All buildings, tenants, tickets, cases and numbers are made up. Every
signature and approval is role-played.

---

## S0. Ground rules and secrets

1. **Plan first.** Every prompt starts in Plan mode. Build only what the prompt and its named sections ask for.
2. **Failing test first.** For every fix and every new rule: write the test, run it, show it fail, then make it pass.
3. **Old tests stay.** The 38 tests that pass at the start of C1 are never deleted, skipped or weakened. Only two
   rewrites are allowed, ever: (a) the block "v1.1 reserved rule (TS-CC-27)" at the end of
   `web/tests/golden/golden-tests.test.ts`, in C3c (S16 item 6); (b) the never-list half of GT-05 and GT-17, in C3b
   (S13 item 6). GT-05's `checkRedStop` lines stay byte for byte the same.
4. **The key file is private.** `web/.env.local` was made by YY. Nobody opens, prints, echoes, copies, cats, greps or
   reads it: not CodeBuddy, not the reviewer, not a test, and no script except the two loaders below. The same goes for
   every `web/.env*` file except `web/.env.example`. To check it, run only `Test-Path web/.env.local` and
   `git check-ignore web/.env.local`. Only two things load it: Next.js itself, for the app, and `@next/env`'s
   `loadEnvConfig` inside the two scripts `ai-ping.ts` and `ai-record.ts`, given a no-op logger so it never prints the
   file's path (S15). Nothing prints a value from it.
5. **Pill words come from the pill.** Red stop text, rule text, step text and tenant tips are read from the pill YAML
   when the app runs. Never type them into `web/app/` or `web/lib/`, not even as a copy.
6. **Label what is made up.** Every data file says "made up for the demo". Every signature, approval and decision by a
   person says "(role-played)".
7. **When two rules fight,** stop and say which two. Do not pick for YY.
8. **The standard ending.** Every part ends in this order:
   1. In `web/`: `npm test`, then `npm run build`. Both must pass; if either fails, fix it before the commit. Show the
      real output, say pass or fail for both, and the test count. The count never goes down.
   2. `git diff --stat -- web/tests`, naming every old test block that changed (normally none).
   3. Render check: open each screen that changed at laptop width and at 390 px wide, and say what was actually seen.
      If no screen changed, say "no screen changed".
   4. `git add`, then `git grep --cached -l -E "LLM_API_KEY=[A-Za-z0-9_.-]{8,}"` must print nothing (exit code 1 is
      fine). `git status`: no `.env.local`, no `state.json`, nothing from `proof/_inbox`.
   5. One commit with the part marker (rule 9).
   6. Say "Cxx committed, ready for /log-proof" (every part). Never push. Stop. YY then types `/log-proof YY`, and
      the next part commits that row first.
9. **Commit markers.** A part's commit message ends with its id in brackets, for example `[C2c]`. The last part of a
   step ends with `[step C2 done]`. A fix ends with `[fix done]`. The review starts only on a `[step Cn done]` or
   `[fix done]` commit.
10. **Next.js traps.** Read and write `web/data/state.json` and `web/data/runtime/` with `fs` at request time, never
    with `import`. Every page or route that reads the memory or a pill exports `dynamic = "force-dynamic"`. In page
    props, `params` and `searchParams` are Promises, so `await` them. Every npm command runs inside `web/`. Never
    join commands with `&&` and never use `VAR=x npm ...` (Windows PowerShell).
11. **CodeBuddy never pushes,** never takes, moves or edits screenshots (YY does that himself), and never touches
    `proof/screenshots/`.
12. **Errors never leak.** On any AI or network error, show and log only the HTTP status and a fixed phrase. Never
    `err.message`, the error object, headers, the base URL or the client config.

---

## S1. What Pill Desk is

YY's goal: "it's supposed to be efficient". The company must get faster at fixing a problem, so the same spot stops
calling again.

**The flow for one problem**

| # | What happens | Who |
|---|---|---|
| 1 | A problem comes in. | Tenant |
| 2 | Self-check: 4 hands-off questions after a safety question (S10). Some problems end with an approved tip and no visit. Otherwise a visit is booked. A charged fix is told to the tenant, with its price, only after the AOM approves the charge (A4). | Tenant, code |
| 3 | The technician gets the checklist already filled from what is known: the spot's history, the repeat flag, past fixes, the recent fit-out (S21). | Code |
| 4 | Code ranks the likely causes (S9). Each Found it or Not this tick re-ranks live. Using a fix the brain already holds needs no approval. | Technician, code |
| 5 | Solved: saved as a case with one line of why; a win only after 30 days with no repeat (S8). Not solved: record time lost, extra visits and cost, and send the job with everything attached to the senior manager. Nothing is asked twice. | Technician |
| 6 | The senior manager solves it, which makes a new solution (S16) that HQ must approve; or asks HQ for outside help or money (A3). | Senior manager |
| 7 | HQ approves the new solution after its tests pass. It goes to every building at once, like a code commit, with rollback. | HQ |
| 8 | The AOM approves charges to the tenant, decides goodwill, and watches the impact meter (S18). | AOM |

**Who does what**

- **Code decides** every rank, state, lock, colour word, number and hand-off.
- **The AI** (Tencent Hunyuan, model hy3, through TokenHub) only words things: rank reasons, tenant replies drafted
  from approved tips, the new solution's rule text drafted from the senior manager's typed fix, and a suggested chip
  for typed text. For a new solution it also suggests the fact and the effects, picked only from the fixed code menu
  (S16); that is a suggestion, and the senior manager confirms each part with its own button. A person confirms
  anything that counts. The AI never ranks.
- **People approve** only at A1 to A4 (S2). Safety stops are stops, not approvals.
- **Typing** only brings up cards and safety alerts. Only button presses change state. Typed safety words show the red
  card and send its alerts, but lock nothing; a locking stop opens only from a button (S11).

**Words**

- **Pill:** approved know-how for one problem in one YAML file. Ours is TS-CC (repeat comfort complaints).
  `web/pills/ts-cc/v1.0.yaml` is v1.0. v1.1 is v1.0 plus one new solution.
- **Brain:** the live pill version, the cause list (S7) and the case library (S7) together.
- **Spot:** a building and floor, for example Tower A Level 23. The repeat rule and the 30-day rule work per spot.
- **Place tag:** building, floor, zone and equipment on every job (S5).
- **Lead:** one likely cause, with its check (a pill step), how long the check takes, and who does the fix.
- **Case:** a closed job saved with its facts, cause, fix, one line of why, who fixed it and who confirmed the cause.
- **Won, failed, pending:** a case's outcome under the 30-day rule (S8).
- **Repeat flag:** the existing `computeRepeatFlag` result (rule TS-CC-09).
- **Speak first:** the alert to the senior manager when a spot trips the repeat flag (S6).
- **New solution:** a rule the senior manager adds after solving an escalated job. It becomes the next pill version.
- **Distribute:** HQ's approval makes the new version live in every building at once.
- **Card:** one answer box: a colour word, a title, a body and a receipt line (rule id, pill version, AI calls).
- **Red stop:** one of the pill's 10 safety stops (S11), always in the pill's own words, 0 AI calls.
- **Replay:** a saved real AI answer, shown with a banner when the AI is off or fails.
- **Tickets:** Tower A Level 23 (tenant Northwind Advisory): 2301 (15 Sep, core, too cold), 2305 (19 Sep, west, too
  hot), 2310 (24 Sep, core, too cold), 2315 (29 Sep, west, too hot), 2318 (6 Oct, core, too cold, open). Building B
  Level 12 (Meridian Partners): 2401 (5 Oct, core, too cold, open). Tower A Level 23's fit-out finished 8 months ago,
  Building B Level 12's 4 months ago (`web/data/buildings.json`).

---

## S2. Seats and permissions

There is no login. Seats are role-played, and anyone who posts `seat=hq` acts as HQ. The README and `/how` say so.

| Seat id | Label on screen | Home spot |
|---|---|---|
| `tenant` | Tenant, Northwind Advisory (role-played) | Tower A Level 23 |
| `technician` | Technician (role-played) | the spot of the job it opened last, else Tower A Level 23 |
| `senior-manager` | Senior manager: the FM contractor's chief engineer (role-played) | picks a job |
| `hq` | HQ pill owner: Keppel Technical Services lead (role-played) | picks a job |
| `aom-tower-a` | AOM, Tower A: Keppel Asset Operations Manager (role-played) | Tower A Level 23 |

Building B is **not** a seat. It is a card (S21) that shows its live version and ticket 2401's ranked causes.

**Approvals exist only here**

| Id | What | Who approves | Where in the app |
|---|---|---|---|
| A1 | Version 1 of the brain | Two senior experts (role-played), shown as already signed | A card on the HQ seat and on `/how` |
| A2 | A new solution | HQ, after its tests pass | `approve-solution` |
| A3 | Outside help or money beyond the senior manager | HQ | `decide-outside-help` |
| A4 | Charging the tenant | AOM | `decide-charge` |

**No approval needed:** the tenant's self-check, the technician's checklist and ticks, applying a fix that is already
in the brain, saving a solved job as a case.

**Who may press which button.** One table in `web/lib/permissions.ts`, checked on the server in `/api/action`, not
only hidden on screen. A refusal returns a plain reason and changes nothing.

| Action id | Seats | Allowed from | Does |
|---|---|---|---|
| `report` | tenant | any | Starts a self-check (S10) |
| `answer` | tenant | self-check | Answers one self-check question |
| `safety-pick` | every seat | any | Raises one red stop (S11): a pick from the Safety list, or Raise this stop on a typed-words card |
| `open-job` | technician | reported, visit-booked | Job to in-progress |
| `tick` | technician (in-progress), senior-manager (escalated) | as listed | Marks a lead `found`, `not-this` or `clear` |
| `solved` | technician (in-progress), senior-manager (escalated) | as listed | Needs a found lead whose fix this seat may do, and one line of why; job to pending-30-day; saves a case |
| `send-with-cause` | technician | in-progress | Found lead whose fix belongs to someone else: job to escalated with the cause |
| `not-solved` | technician | in-progress | Needs the impact record (S3); job to escalated |
| `log-new-solution` | senior-manager | escalated | Needs a found lead, a fix line and a why line; starts a draft (S16); job to new-solution-drafted |
| `confirm-part` | senior-manager | new-solution-drafted | Confirms the fact, an effect or the rule text |
| `run-tests` | senior-manager | new-solution-drafted | Runs the draft's tests (S16) |
| `send-to-hq` | senior-manager | new-solution-drafted | Needs a passing test run on the current draft hash |
| `ask-outside-help` | senior-manager | escalated | A3 request to HQ; job to outside-help-requested |
| `confirm-cause` | technician, senior-manager, hq | a pending case | Refused when the seat is the case's fixer |
| `clear-stop` | senior-manager | an open red stop | S11 |
| `tell-tenant-first` | senior-manager | a speak-first notice | Sends the approved tip with rule TS-CC-22 to the tenant chat (cut 2) |
| `approve-solution` | hq | solution sent to HQ | A2: S16 gates, then distribute |
| `decline-solution` | hq | solution sent to HQ | Reason of 3 words or more; job back to escalated |
| `rollback` | hq | a live version above 1.0 | S16 |
| `decide-outside-help` | hq | A3 request open | Approve or decline with a reason of 3 words or more |
| `decide-charge` | aom-tower-a | A4 request open | S17 |
| `reset` | every seat | any | S20 |

Every other seat gets a refusal, for example "Only HQ approves a new solution (A2)". The technician can approve
nothing.

**Each seat's "Pip never" line** lives in `permissions.ts`, so `/how` can show it: tenant: "touch plant, ceilings,
power or lifts"; technician: "approve anything, or use a fix the rules removed"; senior manager: "approve their own
new solution"; HQ: "approve a solution whose tests did not pass on this exact draft"; AOM: "let the AI write a price,
fault or another tenant's data".

---

## S3. Flow states of a job

A job has one `status`. Solutions and requests have their own status (S16, S17). Only the buttons in S2 and the code
rules below move a status. Typing never does.

| Status | Meaning | Moved by |
|---|---|---|
| `reported` | A job exists: from `tickets.json` (open tickets) or created by a tenant report | Seed, `report` |
| `self-check` | The tenant is answering the questions | `report` |
| `visit-booked` | The self-check ended needing a visit | `answer` (S10) |
| `in-progress` | The technician opened the job | `open-job` |
| `pending-30-day` | Solved; the case waits for its 30-day check | `solved`, a self-check tip, HQ `approve-solution` |
| `won` | 30 days passed with no repeat at the spot, and a second person confirmed the cause | Code only (S8) |
| `failed` | The spot called again within 30 days | Code only (S8) |
| `escalated` | With the senior manager, everything attached | `not-solved`, `send-with-cause`, `decline-solution`, A3 decided |
| `new-solution-drafted` | The senior manager logged a new solution; it waits for tests and HQ | `log-new-solution` |
| `approved-and-distributed` | Shown on the solution and, for a moment, on its job: HQ approved and the version went live everywhere; the job then shows `pending-30-day` | `approve-solution` |
| `outside-help-requested` | Waiting for HQ's A3 decision | `ask-outside-help` |

- `won` and `failed` are worked out by code from the demo clock (S20) every time a job is read. No button sets them.
- A refused move (wrong seat or wrong status) changes nothing and says why, for example "Open the job first".
- An open red stop on a job's spot locks it (S11): `tick`, `solved`, `not-solved`, `send-with-cause` and
  `log-new-solution` are refused with "Safety stop open on this floor" until the stop is cleared. Only `safety-pick`
  opens a stop; typed words never do.

**The impact record** (`not-solved`): hours lost (0 to 100), extra visits needed (0 to 10), and "contractor or parts
needed" (yes or no). Code adds the cost from the made-up rates in `web/data/impact-rates.json` (S18). It is stored on
the job and shown to the senior manager and the AOM.

---

## S4. Engine fixes (C2a)

These bugs are in today's engine and still matter.

1. **Red stop ids.** Give each of the 10 red stops an `id`, RS-01 to RS-10 in YAML order. Put `id` as the **last**
   field of each stop, so the YAML diff is only 10 added `id: RS-xx` lines. The `RedStop` type gets `id`.
   `checkPill` refuses a missing id, a repeated id, and (for v1.0) any set other than RS-01 to RS-10.
2. **The generator has no side effects.** Move the pill object and a pure function `buildPillYaml(): string` into
   `web/scripts/pill-source.ts`. That module never writes a file. `web/scripts/generate-pill.ts` becomes a small
   command that calls `buildPillYaml()` and writes `web/pills/ts-cc/v1.0.yaml`. Run it once to add the ids. Tests
   import `pill-source.ts` only and compare `buildPillYaml()` with `readFileSync` of v1.0.yaml. A test never writes
   the pill. Keep `pill-source.ts` in `web/scripts/` (S0 rule 5).
3. **checkRedStop shows the right stop.** Today `hasWaterDripping` returns the fire stop's words, because the loop
   matches RS-01 first. Each flag now maps to one stop. It still returns the first match in YAML order, plus its id:

   | Flag | Stop |
   |---|---|
   | hasSmoke | RS-01 |
   | hasBurningSmell | RS-02 |
   | hasScorchedPlug (new) | RS-03 |
   | hasWaterDripping | RS-04 |
   | someoneUnwell | RS-05 |
   | ahuTripping | RS-06 |
   | chillerCause | RS-07 |
   | damperFullyOpenForHours, noApprovedRuleCovers | RS-08 |
   | ceilingAccessWithoutApproval, workingAlone | RS-09 |
   | aiAskedToWriteToBms, aiAskedToQuotePrice, aiAskedToAdmitFault | RS-10 |

   With this table all 38 old tests pass with no edit.
4. **New:** `getRedStop(pill, id)` returns one stop. `checkRedStops(pill, ids)` returns every stop whose id is in
   `ids`, in YAML order, each with id, trigger, action, who_to_call and rules.
5. **loadAndCheckPill throws.** Today it calls `checkPill` and ignores the result. It must throw with the list of
   errors when there are any. Every loader for live, draft and signed versions uses it, never `loadPill`, so a broken
   file is refused, not shown.
6. **checkPill is version-aware.** v1.0 must have exactly TS-CC-01 to TS-CC-26 and still refuses TS-CC-27. Any other
   version must have TS-CC-01 to TS-CC-26, and each extra rule needs a valid `condition` (S16). Every source still
   needs a `ref` and a `label`. Any version's `red_stops` must equal v1.0's exactly.
7. `web/data/tickets.json` stays unchanged.

---

## S5. Place tags and facts (C2b)

**Places.** New file `web/data/places.json`, labelled "made up for the demo":

```json
{
  "label": "made up for the demo",
  "acHours": { "start": "08:00", "end": "18:00", "days": [1, 2, 3, 4, 5] },
  "spots": [
    { "building": "tower-a", "floor": 23, "zone": "core", "equipment": "VAV-23-C1", "equipmentType": "vav" },
    { "building": "tower-a", "floor": 23, "zone": "west", "equipment": "VAV-23-W1", "equipmentType": "vav" },
    { "building": "building-b", "floor": 12, "zone": "core", "equipment": "VAV-12-C1", "equipmentType": "vav" },
    { "building": "building-b", "floor": 12, "zone": "east", "equipment": "VAV-12-E1", "equipmentType": "vav" }
  ]
}
```

- `placeTag(job)` returns `{ building, floor, zone, equipment }`. A zone not in the file gets equipment "unknown".
- `spotKey(job)` is `"<building>/<floor>"`, for example `"tower-a/23"`.
- `allCalls(state)` is every ticket in `tickets.json` plus every job created at runtime, in the `Ticket` shape, with
  `fix: null` for runtime jobs. The repeat check and the 30-day rule always use `allCalls`.

**Facts.** `factsFor(job, allCalls, buildings, places)` returns fact ids in this fixed order (`web/lib/facts.ts`):

| Order | Fact id | True when | Label on screen |
|---|---|---|---|
| 1 | `cold-mornings` | complaint "too cold" and timeOfDay "morning" | cold mornings |
| 1 | `hot-afternoons` | complaint "too hot" and timeOfDay "afternoon" | hot afternoons |
| 1 | `cold-other` | "too cold" at any other time | too cold |
| 1 | `hot-other` | "too hot" at any other time | too hot |
| 2 | `core-zone`, `west-zone`, `east-zone` | the job's zone | core zone, west zone, east zone |
| 3 | `repeat` | `computeRepeatFlag(...).isRepeat` | repeat |
| 4 | `opposite-fixes` | `computeRepeatFlag(...).hasOppositeFixes` | opposite fixes |
| 5 | `fit-out-12m` | the floor's `fitOutCompletedMonths` in `buildings.json` is 12 or less | renovation in the last 12 months |
| 6 | `vav`, `fcu` | the spot's `equipmentType` | VAV box, fan coil unit |

- Exactly one symptom fact (order 1) per job. Its direction is cold or hot.
- **Clock rule:** facts use the job's report time plus 20 minutes as `asOfDate`, never the real clock and never the
  demo clock.
- Expected: 2318 gives `cold-mornings, core-zone, repeat, opposite-fixes, fit-out-12m, vav`. 2401 gives
  `cold-mornings, core-zone, fit-out-12m, vav`. 2305 gives `hot-afternoons, west-zone, repeat, opposite-fixes,
  fit-out-12m, vav`. 2301 gives `cold-mornings, core-zone, fit-out-12m, vav`.

---

## S6. Repeat and speak first (C2b)

- **Reuse, do not rewrite.** The repeat check is the existing `computeRepeatFlag` in `web/lib/rule-engine.ts`,
  called with `allCalls` and the clock rule. Its body does not change. (It counts a ticket's own fix for opposite
  fixes; we keep that as it is.)
- **Quick fix to find the cause.** When the repeat flag is on, `canNudge` already refuses the dial turn (TS-CC-09), so
  the ranking removes the dial lead (S9 step a) and the checklist note says "Repeat flag is on. No nudge. Find the cause
  and call the FM chief engineer." (today's `getActiveChecklist` text).
- **Speak first.** `speakFirstFor(job, allCalls)` returns `{ fire, count, opposite, spotKey }` from the repeat flag.
  It runs on Reset for every open job, and whenever a job is created or a self-check attaches to a job.
  - When `fire` is true and no speak-first notice exists for that spot in the last 30 days (demo clock), code posts
    one notice in the senior manager's chat and sets the spot's speak-first flag on the AOM seat.
  - Notice text (code, 0 AI): "Speak first: {buildingName} Level {floor} has called {count} times in 30
    days{opposite ? ", with opposite fixes" : ""} (repeat flag, TS-CC-09). Quick fixes are off for this spot. Find the
    cause before they call again."
  - Never twice for the same spot inside 30 days.
- Expected: 2301 at its own time: flag off, count 1, no speak first. 2305: flag on, count 2, fires. 2318: flag on,
  count 5, with opposite fixes, fires once on Reset. 2401: flag off.

---

## S7. The cause list and the case library (C2c)

Both are part of brain v1.0, which A1 shows as signed by two senior experts (role-played).

**`web/data/causes.json`**, labelled "made up for the demo; brain v1.0 cause list, signed by two role-played senior
experts (A1)". Fields per cause: `id`, `label`, `symptoms` (cold, hot), `checkStep` (pill step number; the check text
is read from the pill), `checkMinutes`, `checkSeats`, `fixStep` (or null), `fixSeat`, `fixRoute`, `tenantSolution`,
`tenantItem` (the fix touches something a tenant's fit-out installed), `red`.

| id | label | symptoms | checkStep | checkMinutes | checkSeats | fixStep | fixSeat | fixRoute | tenantSolution | tenantItem | red |
|---|---|---|---|---|---|---|---|---|---|---|---|
| setpoint | The setpoint is just off (turn the dial) | cold, hot | 25 | 5 | technician, senior-manager | 25 | technician | Technician turns the dial once, at most 1 degree, logged | We adjusted the setting for your area. | false | false |
| precool | Morning start-up runs too cold | cold | 17 | 15 | technician, senior-manager | null | senior-manager | Senior manager changes the start-up schedule | We adjusted the morning start-up. | false | false |
| min-airflow | Core box held at minimum airflow | cold | 18 | 20 | technician, senior-manager | null | senior-manager | Senior manager with the controls contractor | We adjusted the air box for your area. | false | false |
| thermostat-spot | Thermostat in the wrong spot after a fit-out | cold, hot | 21 | 20 | technician, senior-manager | null | senior-manager | Moved back to the spot on the fit-out drawing, with the tenant's OK | Our contractor will move the wall thermostat back to the spot on your approved fit-out drawing, with your OK. | true | false |
| sun-west | Sun heat on the west glass | hot | 23 | 30 | technician, senior-manager | null | technician | Blinds tip now; lasting shading is the AOM's call | Lower the blinds in the afternoon. | false | false |
| rebalance | Zoning or air balance after a fit-out | cold, hot | 29 | 2880 | senior-manager | null | none | Specialist air balancing; outside help or money goes to HQ (A3) | A specialist will balance the air on your floor. | false | false |
| capacity | West box fully open for hours (capacity limit) | hot | 16 | 30 | technician, senior-manager | null | senior-manager | Out of scope: senior manager (RS-08) | We are looking at the air supply for your floor. | false | true |

- `fixSeat` `none` means no seat may press Solved on that cause. Rebalance's fix always goes through
  `ask-outside-help` (A3).
- Every `tenantSolution` is a "we" sentence. A tenant is never told to touch plant, ceilings, power or lifts.

**`web/data/trends.json`, core zone (C2c).** Today its core text says the damper sits low because of minimum airflow,
which is a different cause from the demo's (the fit-out left the core thermostat in the wrong spot). Replace only the
`core` block with this, made up for the demo. The top `label` and the `west` block stay byte for byte. The old core
text is never shown anywhere. `temp` is a handheld at desk height; `sensorTemp` is what the wall thermostat reads.

```json
"core": {
  "description": "Open area near the lift core. Coldest from 8 to 10am. Since the fit-out, the wall thermostat reads about 1.5 deg C warmer than a handheld beside the desks, so the VAV damper sits high and keeps sending cold air.",
  "readings": [
    { "hour": 8, "temp": 22.1, "sensorTemp": 23.6, "damperPct": 85 },
    { "hour": 9, "temp": 22.3, "sensorTemp": 23.8, "damperPct": 90 },
    { "hour": 10, "temp": 23.0, "sensorTemp": 24.5, "damperPct": 80 },
    { "hour": 11, "temp": 23.5, "sensorTemp": 25.0, "damperPct": 75 },
    { "hour": 12, "temp": 23.8, "sensorTemp": 25.3, "damperPct": 70 },
    { "hour": 13, "temp": 24.0, "sensorTemp": 25.5, "damperPct": 70 },
    { "hour": 14, "temp": 24.2, "sensorTemp": 25.7, "damperPct": 70 },
    { "hour": 15, "temp": 24.3, "sensorTemp": 25.8, "damperPct": 75 },
    { "hour": 16, "temp": 24.1, "sensorTemp": 25.6, "damperPct": 70 },
    { "hour": 17, "temp": 23.8, "sensorTemp": 25.3, "damperPct": 65 },
    { "hour": 18, "temp": 23.5, "sensorTemp": 25.0, "damperPct": 60 }
  ],
  "pattern": "cold_mornings"
}
```

**`web/data/cases.json`**, labelled "made up for the demo". These are history from other floors and buildings. They
name no tenant. Fields: `id`, `building` (a name), `floor`, `zone`, `facts`, `cause`, `fix`, `why`, `fixedBy`,
`confirmedBy`, `closedAt`, `nextCallAt` (the next call at that spot, or null). Dates are `+08:00`.

| id | building, floor, zone | facts | cause | why | fixedBy | confirmedBy | closedAt | nextCallAt |
|---|---|---|---|---|---|---|---|---|
| H-01 | Tower C, 6, core | cold-mornings, core-zone, vav | setpoint | Setpoint sat below the building's band after a schedule change. | technician | senior-manager | 2026-03-04T11:00 | null |
| H-02 | Building D, 3, east | cold-mornings, east-zone, vav | setpoint | East zone setpoint was left low after an event; set back to the band. | technician | senior-manager | 2026-03-18T11:00 | null |
| H-03 | Tower C, 9, core | cold-mornings, core-zone, repeat, vav | min-airflow | Core box minimum airflow was set too high for a half-empty floor. | senior-manager | hq | 2026-04-02T11:00 | null |
| H-04 | Building D, 15, core | cold-mornings, core-zone, vav | min-airflow | The core box flow sensor drifted, so the box held minimum. | senior-manager | hq | 2026-04-21T11:00 | null |
| H-05 | Tower A, 18, core | cold-mornings, core-zone, vav | min-airflow | Core box minimum airflow was too high after a change of use. | senior-manager | hq | 2026-05-06T11:00 | null |
| H-06 | Building B, 7, core | cold-mornings, core-zone, repeat, vav | min-airflow | Minimum airflow was lowered, but the cold came back. | senior-manager | hq | 2026-05-12T11:00 | 2026-05-26T09:00 |
| H-07 | Tower C, 4, east | cold-mornings, east-zone, vav | precool | Pre-cooling started 2 hours early after a holiday schedule. | technician | senior-manager | 2026-06-03T11:00 | null |
| H-08 | Building D, 11, core | cold-mornings, core-zone, vav | precool | The overnight setpoint was left at the after-hours value. | technician | senior-manager | 2026-06-17T11:00 | null |
| H-09 | Tower A, 18, core | cold-mornings, core-zone, vav | precool | Start-up ran at full cooling for 90 minutes before staff arrived. | technician | senior-manager | 2026-07-01T11:00 | null |
| H-10 | Building B, 7, core | cold-mornings, core-zone, vav | precool | The pre-cool start moved later, but the cold came back. | technician | senior-manager | 2026-07-08T11:00 | 2026-07-20T09:00 |
| H-11 | Tower C, 12, core | cold-mornings, core-zone, fit-out-12m, vav | thermostat-spot | The fit-out put the core thermostat beside a server cabinet, so it read warm. | senior-manager | hq | 2026-07-29T11:00 | null |
| H-12 | Building D, 20, west | hot-afternoons, west-zone, repeat, fit-out-12m, vav | rebalance | The fit-out made a glass meeting room share the open-office box; a specialist re-zoned it. | senior-manager | hq | 2026-08-12T11:00 | null |

The `fix` field is a short phrase from the cause's `fixRoute`.

**Cases from the tickets.** `casesFromTickets(allCalls, ...)` turns each closed ticket with a fix into a case: cause
`setpoint` (fix action `setpoint_up` or `setpoint_down`), facts from `factsFor`, `why` = the ticket's `fix.note`,
`fixedBy` = `fix.fixerRole`, `confirmedBy` null, `closedAt` = `reportedAt` (fixes carry no time), next call = the next
call at the same spot. These are 2301, 2305, 2310 and 2315.

**Runtime cases** are added to the memory (S20) by `solved` and by HQ's `approve-solution` (S16), never written to
`cases.json`. Saving a solved job as a case needs no approval.

**Similar case.** A case is similar to a job when it has the job's symptom fact, and the two share at least 2 facts
(the symptom counts as one). Its **weight** is the number of shared facts.

---

## S8. The 30-day win rule (C2c)

`outcomeOf(case, allCalls, now)` in `web/lib/outcome.ts`:

1. **Repeat:** the first call at the same spot (`spotKey`) after `closedAt` and up to and including `closedAt` plus 30
   days. For history cases it is `nextCallAt`.
2. **failed:** a repeat exists and happened at or before `now`.
3. **pending:** no repeat yet and `now` is at or before `closedAt` plus 30 days. Label: "pending, 30-day check until
   {date}" (date as "5 Nov").
4. **won:** no repeat, more than 30 days have passed, and `confirmedBy` is set and is not `fixedBy`.
5. **unconfirmed:** no repeat, more than 30 days have passed, but nobody else confirmed the cause. Label: "needs a
   second person to confirm the cause". It counts like pending.

- **Points for ranking (S9):** won adds the case's weight to its cause; failed subtracts it; pending and unconfirmed
  add 0. So a fix that came back loses points for that cause.
- **The fixer cannot confirm alone.** `confirm-cause` is refused for the case's `fixedBy` seat. HQ's approval of a
  new solution confirms that job's cause (HQ is the second person).
- **Cut 7 fallback** (confirm-cause): the Confirm cause list on the technician and HQ seats goes. Each pending case a
  technician saved still reaches the senior manager's chat as a notice on their next poll, with one Confirm cause
  button, and HQ still confirms through A2. So a technician's fix can still become `won`, and the 30-day rule holds.
- **Every closed job has one line of why:** 3 to 30 words. Self-check tips get a code-made why (S10).
- Expected at the demo clock: 2301, 2305, 2310 and 2315 are all `failed` (the next calls are 2305, 2310, 2315 and
  2318). H-06 and H-10 are `failed`. The other 10 history cases are `won`.

---

## S9. Ranking in 4 steps (C2d, C3c)

`rankLeads(input)` in `web/lib/rank.ts`. Input: the job (with its facts and spot), the seat, the live pill for the
job's building, the causes, all cases (history, from tickets, runtime), the job's ticks, the open red stops and `now`.
It is pure code. It imports nothing from the AI modules. The same input always gives the same output.

**Step a. Rules first.** For each cause, in file order, the first rule that matches removes it into `removed`, with
its reason:

1. Its `symptoms` do not include the job's direction: "Does not explain too cold." (or "too hot").
2. Unsafe: the cause is `red`: "Red: out of scope. {fixRoute}." An open red stop on the job's spot removes every lead
   (the lock, S11).
3. Not allowed for this person: the seat is not in `checkSeats`: "This check is the senior manager's."
4. A live rule blocks it:
   - For `setpoint`: `canNudge(repeat, red, { hadSetpointChangeInLast30Days, changeAmount: 1, isAiMakingChange: false,
     pill: livePill, facts })` is not allowed: "Removed by {ruleIds joined}: {first sentence of canNudge's reason}"
     (for 2318: TS-CC-09). `hadSetpointChangeInLast30Days` is true when a call at the same building, floor and zone
     has a fix and was reported in the 30 days before this job.
   - For any cause: a rule in the live pill whose `condition.fact` is true for the job and which has a `block` effect
     on the cause's `checkStep` or `fixStep`: "Removed by rule {id} (v{version})."
5. **Warranty or contract** removes the fix, not the check: when `tenantItem` is true and the job has `fit-out-12m`,
   the lead stays, `fixAllowedHere` is false and its fix line becomes "Covered by the tenant's fit-out contract: goes
   through the AOM (TS-CC-11)".

`fixAllowedHere` is also false when the seat is not `fixSeat`, so it is false for `rebalance` on every seat (its
`fixSeat` is `none`; it goes through `ask-outside-help`, A3). `solved` needs a found lead with `fixAllowedHere`.

**Step b. Match this job's facts.** For each lead left: take the similar cases (S7) with this cause, and their
outcomes (S8). W = won, F = failed, N = W + F (decided), P = pending or unconfirmed. Score = sum of won weights minus
sum of failed weights.

**Step c. Order.** Tiers, highest first:

| Tier | When | Order inside the tier |
|---|---|---|
| found | ticked Found it (one per job) | |
| signed-rule | a rule in the live pill has `condition.fact` true for the job and a `put-first` effect on this lead's `checkStep` | checkMinutes, then file order |
| case-backed | N is 3 or more and score above 0 | close groups, below |
| low-confidence | N below 3 | checkMinutes, then checkStep |
| net-failed | N is 3 or more and score 0 or less | score, high first, then file order |

- **Close groups (quick checks first):** sort case-backed leads by score, high first. Take the top score s. The group is
  every lead with score s minus 2 or more. Order the group by checkMinutes (quicker first), then score, then file
  order. Repeat on the rest.
- Ticked **Not this** moves a lead to `ruledOut` (in tick order). `clear` undoes a tick.
- A signed expert rule beats any number of old counts, because its tier is higher.

**Step d. Show why, and be honest when data is thin.** Every lead gets a code reason. Templates (exact):

- case-backed: "{facts}: matched {W} of {N} similar cases that stayed fixed", then "; 1 failed fix counts against"
  when F is 1, or "; {F} failed fixes count against" when F is 2 or more, then ".", then " Close call, so the quicker
  check goes first ({time})." when the close-call rule put this lead above a lead with a higher score.
- low-confidence: "Low confidence, expert rule {ruleId}: no similar cases yet." when N is 0; "...: only 1 similar
  case so far." when N is 1; "...: only 2 similar cases so far." when N is 2. ruleId is the first rule of the check
  step in the live pill.
- signed-rule: "Signed expert rule {ruleId} (v{version}): {fact label} puts this check first.", then
  " {W} of {N} similar cases stayed fixed so far." when N is above 0.
- net-failed: "{facts}: only {W} of {N} similar cases stayed fixed; ", then "1 failed fix counts against." or
  "{F} failed fixes count against."
- found: "Checked: found it ({seat label})." Ruled out: "Checked: not this ({seat label})."
- {facts}: the job's facts in fact order, leaving out the equipment facts, that appear in at least one similar decided
  case of this cause; the first 3, labels joined with " + ".
- {time}: under 60 minutes "{n} minutes"; under 1440 "{n} hours"; else "{n} days".
- **Low confidence alert:** when the first live lead is low-confidence, or no live lead is left, the output says
  `alertSeniorManager: true`. The memory posts one notice per job in the senior manager's chat: "Low confidence on job
  {id}: the top cause has fewer than 3 similar cases. Please take a look." 0 AI calls.

**Output:** `{ leads, ruledOut, removed, alertSeniorManager }`. Each lead: causeId, label, tier, score, W, F, N, P,
reason, checkStep, checkText (from the pill), checkMinutes, fixRoute, fixAllowedHere.

**Expected, technician seat, v1.0, demo clock, no ticks:**

| Job | Order | Notes |
|---|---|---|
| 2318 | precool, min-airflow, thermostat-spot | min-airflow score 6 (3 of 4, 1 failed); precool score 5 (3 of 4, 1 failed); close group, so precool (15 minutes) goes first and its reason ends "Close call, so the quicker check goes first (15 minutes)."; thermostat-spot is low-confidence, "only 1 similar case so far"; removed: setpoint (TS-CC-09), sun-west and capacity (do not explain too cold), rebalance (the senior manager's check) |
| 2401 | precool, min-airflow, thermostat-spot, setpoint | setpoint is net-failed: score minus 3, "only 2 of 4 similar cases stayed fixed; 2 failed fixes count against" (2301 and 2310 count against it) |
| 2401 on v1.1 | thermostat-spot, precool, min-airflow | thermostat-spot is signed-rule (TS-CC-27); setpoint removed by TS-CC-27 |

Reasons for 2318, exactly:

- precool: "cold mornings + core zone: matched 3 of 4 similar cases that stayed fixed; 1 failed fix counts against.
  Close call, so the quicker check goes first (15 minutes)."
- min-airflow: "cold mornings + core zone + repeat: matched 3 of 4 similar cases that stayed fixed; 1 failed fix
  counts against."
- thermostat-spot: "Low confidence, expert rule TS-CC-18: only 1 similar case so far."

After the ticks precool Not this and min-airflow Not this on 2318, the first live lead is thermostat-spot
(low-confidence) and `alertSeniorManager` is true. On the senior manager seat with the same ticks, the live order is
thermostat-spot (20 minutes), then rebalance (2 days, "Low confidence, expert rule TS-CC-24: no similar cases yet.").

---

## S10. Tenant self-check and approved tips (C7a)

The tenant chat asks only **hands-off** questions. A tenant never touches plant, ceilings, power or lifts. The
question texts are fixed in `web/lib/self-check.ts`. Every answer is a button. Typed text still runs the safety words
first (S12).

| Q | Asked when | Text | Answers |
|---|---|---|---|
| Q0 | always, first | Before anything else: is there a burning smell, smoke, water dripping, a wet ceiling, or is anyone unwell? | Yes / No |
| Q1 | always | Where exactly? | Open area near the lift core / West glass boardroom / Somewhere else |
| Q2 | always | Since when? | Today / This week / It keeps coming back |
| Q3 | always | Has it happened before? | Yes / No |
| Q4 | too hot in the west boardroom | Are the blinds down? | Yes / No, they are up |
| Q4 | the report time is outside air-con hours (`places.json`) | Is this after normal air-con hours? | Yes / No |
| Q4 | otherwise | Without touching it, does the wall thermostat screen show AUTO? | Yes / No / Not sure |

**Outcomes, checked in this order:**

1. Q0 Yes: the Safety list opens (S11), no more questions, the job stays `reported` with its stop.
2. Blinds "No, they are up": reply with the tip whose rules include TS-CC-20. No visit. The job goes to
   `pending-30-day` with the why "Self-check: afternoon sun on the west glass, blinds were up (tenant's answer)."
3. After hours "Yes": reply with the tip whose rules include TS-CC-12, plus the code line "The AOM will confirm any
   cost first." Code opens an A4 charge request "After-hours air-con for {tenant}, Level {floor}" (S17). No visit. The
   job goes to `pending-30-day` with the why "Self-check: after normal air-con hours (tenant's answer)."
4. Otherwise: visit booked. The reply is the code line "A technician visit is booked." plus tips: when the spot has the
   repeat flag, or Q2 is "It keeps coming back", or Q3 is "Yes": every tip whose rules include TS-CC-09 (2 tips);
   else the tip whose rules are TS-CC-01 and TS-CC-09. Thermostat "No" or "Not sure" adds a note for the technician:
   "Tenant says the thermostat does not show AUTO (looked, did not touch)."

- **Tips are found by rule id,** never by position, and shown word for word from `tenant_tips` in the live pill.
- **Attach, do not duplicate:** if an open job exists for the same tenant, building, floor and zone, the answers attach
  to it (2318 in the demo) and no new job is made. Otherwise code makes a new job with the next free id in that
  building's series (2319 for Tower A) in `visit-booked`, and runs speak first (S6).
- **The AI may word the reply** from the chosen tips (S15). It must pass S13 and S14, or the tips show word for word.
  AI off: the tips word for word.
- **A charged fix:** the tenant hears the solution and the price only through the code card after the AOM's decision
  (S17). Before that, no amount appears in the tenant chat.

---

## S11. Safety stops (C3a)

Safety is not an approval. A red stop says STOP and who to call, word for word from the pill, with 0 AI calls.

**The 10 stops (YAML order).** The second column is a short label only. The app always shows the pill's own words.

| Id | Short label | How it is caught |
|---|---|---|
| RS-01 | Fire alarm, smoke, flame, strong burning smell | Safety button; typed words (S12) |
| RS-02 | Burning or electrical smell at a grille or unit | Safety button; typed words |
| RS-03 | Heater, plug, cord or socket scorched, melted or warm | Safety button; typed words |
| RS-04 | Water dripping or pooling near electrics | Safety button; typed words |
| RS-05 | Someone hurt, faints, chest pain, cannot breathe | Safety button; typed words |
| RS-06 | AHU keeps tripping, smoke detector trips, fire damper shut | Safety button; typed words |
| RS-07 | Chiller, chilled water or refrigerant | Safety button; typed words |
| RS-08 | A zone's damper fully open for hours, or no approved rule | Code: trend data, west zone only (9 of 14 afternoons); also the Safety button |
| RS-09 | Ceiling or air-handler work with no permit, no isolation, or alone | Safety button; typed words |
| RS-10 | Anyone asks the AI for BMS writes, prices, fault or other tenants | Code: the never-list scanner (S13) |

- **The Safety button** is red and on every seat, at every width. One tap opens all 10, loaded from `red_stops` in the
  live pill. Picking one shows that stop's card. The senior manager and HQ first pick which job it is about.
- **A red stop card:** the stop's trigger as the title, its action as the body, its who_to_call after "Call:", all
  word for word from the YAML, and the receipt "Red stop RS-xx · pill v{version} · AI calls: 0". A short code line
  above it may say how it was caught ("Safety words matched, no AI"). No red card is ever worded by the AI.
- **Where a stop attaches:** the seat's open job, else its home spot (S2).
- **Only a button opens a locking stop.** That is `safety-pick`: a pick from the Safety list, or the **Raise this
  stop** button on a typed-words card. Typed safety words (S12) show the same red card and send its alerts, with 0 AI
  calls, but open no stop and lock nothing, because typing never changes state (S19). Pressing Raise this stop sends
  no second alert; it adds "raised by {seat label}" to the alerts already sent.
- **Locks:** RS-01 to RS-07 and RS-09, once raised by a button, lock every open job on that building and floor. RS-08
  picked from the button locks that ticket's zone only. RS-08 from trend data locks nothing: it is a card in the filled
  checklist of Tower A Level 23 jobs (S21). RS-10 locks nothing: it is a refusal card.
- **While locked,** the job shows only the red card or cards and the lock line, which is the `not_when` of the stop's
  first rule, read from the pill: TS-CC-03 for RS-01 to RS-04, TS-CC-04 for RS-05, TS-CC-05 for RS-06 and RS-07. RS-08
  and RS-09 show no lock line; their action says what waits.
- **Alerts:** RS-01 to RS-09, whether typed or picked, put an alert in the senior manager's chat and in that
  building's AOM chat (Building B's go on its card). An alert card: a code title ("Red stop on Tower A, Level 23"),
  then trigger, action and who_to_call word for word, and "Red stop RS-04 · AI calls: 0".
- **Several stops matched:** show every one, in YAML order, each with its own Raise this stop button.
- **Clear stop** (senior manager only; cut 6 removes the button and a stop stays until Reset): a reason of 3 words or
  more. A stop whose who_to_call (read from the pill) names the Fire Safety Manager, which is RS-01 and RS-06 in v1.0,
  also needs the tick "Safety record: Fire Safety Manager told and agreed (role-played)". The screen calls it a safety
  record, not an approval. Logged with who and when.
- **Guards (tests):** `web/app/` and `web/lib/` contain none of the red stop trigger, action or who_to_call fields that
  are 30 characters or longer, and none of the `not_when` lines of TS-CC-03, 04 and 05 (the test reads the YAML and
  searches the files).

---

## S12. Typed safety words (C3a)

These run first on every typed message in every seat, before anything else, with no AI. They are a backup to the
Safety button. Exact words and simple stems only. No typo matching. A match shows the red card and sends its alerts
(S11), and locks nothing until someone presses Raise this stop on that card.

**Getting the words ready:** lower case; drop apostrophes (can't becomes cant); every other character that is not a
letter or a digit becomes a space; split on spaces. Match whole words only.

**How matching works**

1. Find every exception phrase and every red phrase (single red words count as phrases of 1 word).
2. Longest first: a phrase uses up its words, and a shorter phrase that needs a used-up word does not match. An
   exception beats a red phrase only when it is longer. On equal length, red wins. Two red phrases of equal length
   that overlap both match.
3. Then the pairs (RS-02's breaker pair, RS-03, RS-04's two pairs): a pair is one word from each list, anywhere in
   the message. A pair may use words that a red phrase used, but never words an exception used. A pair uses up
   nothing.
4. Every stop matched is shown, in YAML order.
5. Picker words count only when nothing in the message is red, and only on words not used up by an exception.
6. A message with any non-Latin letter (for example Chinese) gets the picker if nothing is red. Never the AI.

**Exceptions (never red):** keep warm, keeps warm, keeping warm, fire alarm test, fire alarm tests, fire alarm testing,
false alarm, false alarms, fire up, fires up, fired up, firing up, and burning hot (only when no RS-03 object word is in
the message).

**RS-01:** smoke, smokes, smoked, smoking, smoky, flame, flames, flaming, on fire, caught fire, catch fire, catching
fire, a fire, fire alarm, fire alarms.

**RS-02:** burning smell, burning smells, burnt smell, burnt smells, burned smell, electrical smell, electrical smells,
electric smell, smell of burning, smells of burning, smelling of burning. Pair: breaker tripped, breaker trips or
breaker tripping, plus smell, smells or smelling.

**RS-03:** a pair of an object word and a danger word.
- Object words: heater, heaters, plug, plugs, cord, cords, socket, sockets, outlet, outlets, charger, chargers,
  adaptor, adaptors, adapter, adapters, extension, extensions, power strip, power strips, wire, wires, wiring, cable,
  cables, plastic.
- Danger words: hot, warm, spark, sparks, sparking, sparked, scorch, scorched, scorching, melt, melted, melting,
  discoloured, discolored, smoking, burning, burnt, burned, smell, smells, smelling.
- Red on their own: sparks, sparking, sparked, electrocuted, electric shock, electric shocks, got a shock, getting a
  shock, gave me a shock.

**RS-04:** red on their own: dripping from the ceiling, drips from the ceiling, water from the ceiling, wet ceiling,
wet ceilings, wet tile, wet tiles, ceiling leak, ceiling leaks, ceiling leaking, leaking ceiling. Or one of two pairs.
The ceiling pair (the pill's trigger starts "Water dripping from the ceiling"):
- Ceiling words: ceiling, ceilings.
- Drip words: drip, drips, dripping, dripped, leak, leaks, leaking, leaked, wet.

The electrics pair:
- Water words: water, drip, drips, dripping, dripped, leak, leaks, leaking, leaked, wet, pool, pooling, pooled, puddle,
  puddles, flood, flooding, flooded.
- Electric words: light, lights, lighting, power, socket, sockets, outlet, outlets, plug, plugs, electrical, electric,
  electrics, db, db room, floor box, floor boxes, power box, power boxes, comms room, server room, pc, pcs, computer,
  computers.

**RS-05:** hurt, hurts, injured, injury, injuries, faint, faints, fainted, fainting, collapse, collapses, collapsed,
unconscious, bleeding, bleeds, passed out, chest pain, chest pains, cannot breathe, cant breathe, can not breathe, not
breathing, fell off, fell from, fallen off, fallen from, electrocuted.

**RS-06:** fire damper, fire dampers, ahu tripping, ahu tripped, ahu trips, ahu keeps tripping, air handler tripping,
air handler tripped, air handler trips, smoke detector, smoke detectors. ("smoke detector" is RS-06, not RS-01.)

**RS-07:** chiller, chillers, refrigerant, refrigerants, chilled water.

**RS-09:** alone, on my own, by myself, no permit, without a permit, not isolated, no isolation, without isolation.

**Picker words** (only when nothing is red; cut 4 removes the "Is this a safety problem?" picker, and Q0 and the red
words stay): heater, heaters, water, leak,
leaks, leaking, drip, drips, dripping, wet, pooling, puddle, puddles, alarm, alarms, fire, fires, smell, smells,
smelly, fumes, gas, breaker, breakers, melting, melted, shock, shocks, shocked, burning, burnt, flood, flooding,
flooded, unwell, dizzy, headache, headaches, sick, short of breath, breathless. They bring up "Is this a safety
problem?" with the 10-stop list and a "No" button. Never an automatic red, never the AI.

**The new solution's fix line and why line** (S16): typed text there runs these words only to show a small flag next to
a red word. No alert, no lock. The Safety button stays on screen.

---

## S13. Never-list scanner and tenant-text checks (C3b)

Runs on every AI output (tenant replies, rank wording, new solution text, chip picks) and on every typed message.

1. **Prices:** a money mark or money word next to a number: $200, S$200, S$ 200, SGD 200, 200 SGD, 200 bucks, two
   hundred dollars, cents.
2. **Free offers:** waive, waived, waiving, on the house, complimentary, goodwill credit, refund, rebate, discount,
   rent-free, free of charge, compensation, compensate, reimburse.
3. **Fault:** our fault, our mistake, our error, sorry for our error, we will cover it, that one is on us, we are
   responsible, liable, liability.
4. **Other tenants, buildings or floors:** any tenant name, building or floor that is not the seat's own (Meridian
   Partners in a Northwind reply is blocked). For HQ and the senior manager, both buildings count as their own.
5. **Building system:** write to the BMS, push it to the BMS, push to the system, push (up to 3 words) to the BMS,
   setpoint to the BMS, BMS override, override the, change the schedule.
6. It returns the pill's never_list ids: never-quote-price, never-admit-fault, never-cross-tenant, never-write-bms. It
   replaces `checkNeverList`. **The one rewrite in C3b:** GT-05 and GT-17 call it on text ("push the setpoint to the
   BMS" for GT-05, "we will waive the S$200, it was our fault" for GT-17) with the same assertions. GT-05's
   `checkRedStop` lines stay byte for byte the same.
7. **Must pass:** 1 deg C, Level 23, v1.1, TS-CC-09, ticket 2301, check the BMS trend, bump it 2 degrees.
8. **A typed message that hits the list** gets the TS-CC-06 refusal card (RS-10), AI calls 0, nothing sent to the AI,
   and a pointer: "Money and fault are the AOM's decision (A4)" or "Settings are the senior manager's".
9. **Hidden amounts in chat:** amounts in typed messages are stored and shown as "[amount hidden]", whichever route
   matched (safety words included). Amounts appear only in code-made cards: the impact meter (S18) and the AOM's
   charge card (S17).
10. **Extra blocks on AI-drafted tenant text** (TS-CC-02 says "No cause, no blame, no price, no promised date, no
    comfort range, no building settings."): cause, caused, because, due to, the reason, blame, your fit-out, your
    contractor, your printer, your heater, today, tomorrow, tonight, by Monday, by Tuesday, by Wednesday, by Thursday,
    by Friday, by Saturday, by Sunday, next week, within, degree, degrees, deg, setpoint, BMS, schedule. A tenant reply
    has at most 3 sentences and is checked against the job's own tenant, building and floor. The cause line of a job
    is never passed into the tenant prompt. A fail shows the tips word for word.

---

## S14. Wording check on AI text (C3b)

For every AI sentence shown under a code card or reason:

- At most 2 sentences for rank wording, 3 for tenant replies. Word numbers become digits first.
- Every number, rule id and version in the AI text must appear in the code text it words.
- **Blocked unless the code text uses the word:** unplug, reset, switch, bypass, override, open, isolate, climb,
  wedge, turn, pull the plug, remove, touch, move, disconnect, restart, power off, shut, cut, tape.
- **Blocked always:** safe to touch, fine to touch, ok to touch, ok to handle, no danger, guaranteed, definitely.
- The AI text never changes an order, a tier or a number. It is shown as an extra line labelled "AI wording" under the
  code reason, which always stays on screen.
- A fail shows only the code text.

---

## S15. The AI layer (C1b, C6a)

- **The key file** `web/.env.local` was made by YY (free TokenHub trial). Its lines are `LLM_BASE_URL`, `LLM_MODEL`
  (the Hunyuan model id hy3), `LLM_API_KEY` and `REPLAY_MODE`. Nobody opens or prints it (S0 rule 4).
- **What `REPLAY_MODE` does, and nothing more:** it only sets where the AI switch starts. `1` (the value in
  `web/.env.example`) starts on Replay; anything else starts on Live. Once someone picks on the switch, its cookie wins
  in the app. `ai:ping` and `ai:record` ignore `REPLAY_MODE` and call the model whenever the key is not empty. Nobody
  can read the value, so the switch always shows on screen where it stands. In C6a, the `REPLAY_MODE` comment in both
  `.env.example` files says this.
- **One client, two files:** `web/lib/ai-core.ts` holds the one OpenAI-compatible client pointed at Tencent Cloud
  TokenHub and has NO `server-only` import. `web/lib/ai.ts` is only `import "server-only"` plus a re-export of
  `ai-core.ts`; app code imports `ai.ts`. Scripts (`ai-ping`, `ai-record`) run with `tsx`, import `ai-core.ts` (never
  `ai.ts`, because `server-only` throws outside Next), and load the env file themselves with `@next/env`'s
  `loadEnvConfig`, passing a no-op logger (`{ info() {}, error() {} }`) so it never prints the file's full path. They
  never print a value. Never `NEXT_PUBLIC_`. `ai-core.ts` never loads the env file itself.
- **hy3 thinks first (measured 10 Oct):** hy3 streams a `reasoning_content` part before `content`. With `max_tokens`
  10 it ran out while thinking (finish `length`, no content); with 400 the first content came at about 1.25 s.
  `enable_thinking: false` did not stop the thinking part. So `ai-core.ts` exports `AI_MAX_TOKENS = 600` and every call
  uses it; code reads only `content`; `reasoning_content` is never shown, stored, logged or replayed; a call times out
  8 s after the request; a reply that ends with finish `length` and no content counts as no answer (the fallback
  shows). `ai:ping` reports "thinking first: yes or no" and the time to the first `content`.
- **What the AI does, and nothing else:**

  | Job | Input | Output | Checks | Fallback |
  |---|---|---|---|---|
  | `rank-wording` (cut 5) | one lead's code reason, label and check text | at most 2 sentences | S13, S14 | the code reason only |
  | `tenant-reply` | the chosen tips word for word and the code line | at most 3 sentences | S13 with item 10, S14 | the tips word for word |
  | `new-solution` | the senior manager's fix line and why line, and the menu (S16) | JSON `{ ruleText, fact, effects }` or `{ kind: "note", text }` | S13; menu check in code | rule text = the fix line word for word; fact and effects picked by hand |
  | `chip` (cut 1) | typed text with no safety or picker word | one chip id from the seat's fixed list | must be in the list | no highlight |

- **Prompts** live in `web/prompts/` (`rank-wording.md`, `tenant-reply.md`, `new-solution.md`, `chip.md`) so judges
  can read them. `tenant-reply.md` contains TS-CC-02's limits word for word.
- **The order for every AI call:** Hunyuan, then a replay with the banner "replay: saved real AI answer", then the
  fallback. An empty `LLM_API_KEY` turns replay on by itself.
- **The AI switch** (top bar, saved as a cookie): Live, Replay, Off. It starts where `REPLAY_MODE` says; the cookie
  wins after that. Off: no AI at all, the same cards, a small "AI off" label, tips word for word, and the fix line as
  the rule text.
- **Never on red:** no red card, RS-08 card or TS-CC-06 refusal is ever sent to the AI. Each card's receipt shows its
  AI calls.
- **Errors:** log and show only the HTTP status and "AI unavailable, using replay" (S0 rule 12). No debug logging.
- **Tests:** `web/tests/setup.ts`, listed in `vitest.config.ts`, sets `LLM_API_KEY` to empty and `REPLAY_MODE` to 1
  before anything loads, and makes any network call throw "network blocked in tests". In tests, `server-only` points to
  an empty stub, `web/tests/stubs/server-only.ts`.
- **Replay keys:** a wording or reply is keyed by seat, job, pill version, AI job and a hash of the code text it words.
  Free text (the fix line) is keyed by a hash of the exact text. On any mismatch, no replay: the fallback shows.
- **Record mode:** `web/scripts/ai-record.ts` (`npm run ai:record`) calls Hunyuan for the demo's AI jobs and saves each
  answer in `web/data/replay/`: only the answer text and whether it passed its checks. Never the key, the headers or
  the request. YY runs it in his own terminal. Never hand-write a replay answer and call it AI.
- **Record-time limits (C6b):** recording runs offline before the demo, so only the record path uses
  `AI_RECORD_MAX_TOKENS = 2000` and a 30 s timeout (`AI_RECORD_TIMEOUT_MS = 30000`), both exported by `ai-core.ts`.
  The live app and `ai:ping` keep `AI_MAX_TOKENS = 600` and 8 s; on Live a slow answer falls back to the saved answer
  with its banner. `ai:record` printed, before (600 tokens, 8 s): "recorded: 0 passed checks, 0 failed checks, 16
  unavailable, 0 already saved"; after (2000 tokens, 30 s, the first try): "recorded: 14 passed checks, 1 failed
  checks, 1 unavailable, 0 already saved".
- **Replay quality check** (`web/tests/replay-quality.test.ts`, cut 3): at least 80 percent of saved answers passed
  their checks; failed ones are never shown. It skips with "skipped: no replays yet" while the folder is empty. It is
  not a rule that changes advice.

---

## S16. New solutions: draft, tests, HQ approval, distribution, rollback (C3c, C8a, C8b)

**1. The condition menu.** A new solution may only say what this menu allows (`web/lib/conditions.ts`).

- **Fact (pick 1):** `fit-out-12m`, `repeat`, `opposite-fixes` (S5).
- **Effects (1 or 2):** `block` a step: step 25 only (the dial turn). `put-first` a step: steps 9, 10, 11, 12, 13,
  15, 17, 18, 19, 20, 21, 22, 23, 29 and 30 only. "First" means right after the safety section: steps 1 to 8 always
  stay first, in order.
- **Refused always:** any effect on steps 1 to 8, 26, 28 or 31; any effect on a step whose rules include TS-CC-03, 04,
  05, 08 or 26; any red step; anything that changes, blocks or reorders a red stop; lowering a colour.
- **No fit, no rule:** if nothing in the menu fits, the AI returns `{ kind: "note", text }`. Code shows it to the senior
  manager and HQ as "advisory, not enforced". A note never enters a pill. If the AI forces a rule the menu refuses,
  code refuses it and shows the text as a note.

**2. The draft.** `log-new-solution` needs a found lead (the cause), a fix line and a why line (3 to 30 words each).
Typed text never saves. The AI's suggestion card shows the rule text, labelled "AI drafted", and the fact and each
effect, labelled "AI suggested from the code menu". The fact and effects change the ranking, so they are only a
suggestion: code refuses anything off the menu, and nothing is saved until the senior manager confirms each part with
its own `confirm-part` button. With the AI off, the senior manager picks the fact and effects by hand from the menu. Code fills the fields
`checkPill` needs:

- `id`: the next free id (TS-CC-27 first). `rule`: the confirmed rule text. `applies_when`: the fact in words.
- `colour`: the first effect's step colour (never lower). `approver`, `section`, `label`, `because`, `not_when`: fixed
  templates. `because` holds the why line.
- `sources`: `[{ ref: "CE-CORR-<YYYY-MM-DD>", label: "senior manager correction (role-played)" }]`.
- `condition`: `{ fact, effects: [{ effect, step }] }`.
- The draft is v1.0 (or the live version) plus this rule, `version` one step up, saved in `web/data/runtime/`, never
  in `web/pills/ts-cc/`.

**The demo solution** (from the role-played senior manager): fix line "If the zone had a fit-out in the last 12 months,
check where the thermostat sits against the fit-out drawing before any nudge." Why line "The fit-out 8 months ago moved
the core thermostat next to the new printer bay, so it reads warm and the box keeps cooling the open area." Fact
`fit-out-12m`; effects `block` step 25 and `put-first` step 21. Step 21 stays green. The data agrees: the core block of
`trends.json` (S7) shows the thermostat reading warmer than a handheld and the damper sitting high in the morning.

**3. Engine changes that make a rule work** (C3c):

- `canNudge` reads the pill, not a version string. Keep every old context field. `pillVersion` is accepted and
  ignored. Add optional `pill` and `facts`. A fact is true when `facts` includes it, or, for `fit-out-12m`, when
  `hadFitOutInLast12Months` is true. Any rule with a `condition` whose fact is true and which blocks step 25 blocks the
  nudge, with `ruleIds` set to that rule's id. Nothing keys on the id TS-CC-27 or on "1.1".
- `getActiveChecklist` takes the pill's conditions: steps 1 to 8 first, in order; then put-first steps; then the rest
  in order. Blocked steps are hidden.
- The ranking's signed-rule tier and its block removals (S9) read the same conditions.

**4. Golden cases** move to `web/lib/golden-cases.ts`, so the app can run them on a draft: GT-01 to GT-22, each with
id, title, inputs, expected answer and `appliesTo`: `"no-fit-out-rule"` (GT-01 and GT-21, the v1.0 dial turn on 2301),
`"fit-out-rule"` (GT-22: 2301 on a pill with a `fit-out-12m` rule that blocks step 25: steps 1 to 8 in order, then
step 21, no step 25, `ruleIds` holds the new id) and `"all"`. Ticket cases read the ticket and building from
`web/data/` with the clock rule. The pill's `golden_tests` list: v1.0 keeps GT-01 to GT-20; a draft adds GT-22.

**5. Run tests** on a draft runs: `checkPill` (0 errors), red stops equal to v1.0's, every golden case, and R-01: for
every open job in the data whose facts make the rule's fact true, ranked with the draft as its live pill, the
technician seat, no ticks and no open red stops, the first live lead is the lead whose `checkStep` is the put-first
step. R-01 tests the rule, so it ranks with the rules only: an open red stop is a safety pause on a floor, not a rule,
and it neither fails nor skips R-01 (the stop stays open and its jobs stay locked). It reports passed, failed and not
applicable. A case that does not apply shows as "not applicable to v{version}", never as passed. The run stores the
draft hash it saw.

**6. The test fixture** `web/tests/fixtures/ts-cc-v1.1.yaml` is v1.0 with exactly 3 changes: `version: "1.1"`, the demo
rule as TS-CC-27, and GT-22 added to `golden_tests`. Its `red_stops` equal v1.0's. **The one rewrite in C3c:** the
"v1.1 reserved rule (TS-CC-27)" block at the end of `golden-tests.test.ts` loads v1.0 and the fixture, calls `canNudge`
with each as `pill` and the fit-out fact: v1.0 allows the nudge; the fixture blocks it, and `ruleIds` holds the
fixture's new rule id, read from the fixture.

**7. The draft hash.** `draftHash` is the SHA-256 of the draft's YAML text. Any confirm that changes the draft clears
the stored test run. `send-to-hq` needs a stored run with 0 failed whose hash equals the draft's hash now.

**8. HQ approval (A2).** `approve-solution` is refused unless all are true: a stored run with 0 failed and every
applicable case run; its hash equals the draft's hash now ("draft changed since the tests" otherwise); the draft's
`red_stops` equal v1.0's; it passes `loadAndCheckPill`. Signed "HQ pill owner (role-played)". The signed file is
frozen in `web/data/runtime/` and never written again. A later solution starts the next version.

**9. Distribution.** On approval, code at once sets the live version of **every** building to the new version (no
per-building accept), saves the job's case (cause = the found lead, facts, why, fixedBy `senior-manager`, confirmedBy
`hq`, closedAt = demo now, so it shows "pending, 30-day check"), moves the job to `pending-30-day`, and posts notices to
the senior manager, the AOM and the Building B card: "v{version} is live in every building (role-played approval by
HQ)." When the job's found lead has `tenantItem` on a floor with `fit-out-12m`, this is also the moment code opens the
A4 charge request for the AOM (S17, cut 9). Before HQ approves, no charge request exists.

**10. Versions like commits.** Each version records its parent version, the first 7 characters of its hash, who
approved it and when, and its why line. HQ sees them as a short list, newest first, for example
"v1.1 · 3f2a9c1 · approved by HQ pill owner (role-played) · parent v1.0".

**11. Rollback** (HQ only; cut 10): sets every building's live version back to the parent. It deletes nothing; the
rolled-back version stays in the list as "rolled back". Cases stay. Notices go to the senior manager, the AOM and the
Building B card.

---

## S17. Charges (A4) and outside help (A3) (C8a, C8b, C9)

**A4, charging the tenant** (AOM Tower A only; cut 9).

- A charge request opens when: the self-check ends with after-hours "Yes" (S10); or HQ approves (A2) a new solution
  whose job's found lead has `tenantItem` on a floor with `fit-out-12m` (S16 item 9). Nothing opens one earlier: while
  HQ may still decline the solution, the AOM gets no request and the tenant hears nothing. (`solved` can never name
  such a lead, because the fit-out contract makes `fixAllowedHere` false, S9 step a.5.) Its text: "Tenant will hear:
  "{tenantSolution}" This is work on the tenant's fit-out (TS-CC-11). Who pays?"
- `decide-charge` choices: **Tenant pays** (a whole-number amount from 1 to 100000, typed by the AOM in a number field,
  and a reason of 3 words or more); **Landlord pays** (reason); **Goodwill, no charge** (reason, the AOM's own
  decision). The AI never writes, suggests or sees an amount.
- After the decision, code (not the AI) posts the tenant's card: "What we will do: {tenantSolution} Cost: {Tenant pays:
  "S${amount}, made-up demo amount" | Landlord pays: "no charge to you" | Goodwill: "no charge to you"}. Approved by the
  AOM (role-played)." Before the decision, the tenant chat shows no amount.
- **Cut 9 fallback:** no charge request ever opens, the tenant never sees a price, the demo skips the 3:25 beat, and
  `demo-flow.test.ts` (T-C10b) drops the AOM's charge decision.

**A3, outside help or money beyond the senior manager** (cut 8).

- `ask-outside-help`: what is needed (contractor or budget), a reason of 3 words or more, and "needs money" yes or no.
  No amount in the text (S13). The job goes to `outside-help-requested` and HQ gets the request.
- `decide-outside-help` (HQ): Approve or Decline, each with a reason of 3 words or more. Either way the job goes back to
  `escalated`, with "outside help approved (A3)" or "declined: {reason}" on its card.

---

## S18. The impact meter (C9)

On the AOM seat and on `/how`. `impactFor(spotKey, allTickets, rates)` in `web/lib/impact.ts` works it out by replaying
the tickets. Nothing is typed in.

**Rates:** `web/data/impact-rates.json`, labelled "made up for the demo": `visitHours: 2`, `seniorCheckHours: 3`,
`hourlyRateSgd: 60`. So a visit is S$120 and a senior check S$180.

**The run of calls:** the spot's tickets in time order, each within 30 days of the one before.

| Measure | Before (as it happened) | With Pill Desk (replayed by code) |
|---|---|---|
| Calls | all calls in the run | calls up to and including the first one where `computeRepeatFlag` (clock rule) is on |
| Visits | one per call | one per call up to that call |
| Senior manager checks | 0 | 1, on the visit where the repeat is caught |
| Days to a real fix | "not fixed after {first to last call} days" | days from the first call to the caught call |
| Repeat calls | calls minus 1 | caught call's position minus 1 |
| Cost | visits x visit rate, "and counting" | visits x visit rate + senior checks x senior rate |

- Days are whole calendar days in Singapore time.
- Expected for Tower A Level 23: before 5 calls, 5 visits, not fixed after 21 days, 4 repeat calls, S$600 and
  counting. With Pill Desk: caught at 2305 on 19 Sep, 2 calls, 2 visits, 1 senior check, 4 days, 1 repeat call,
  S$420.
- The card always shows "Worked out on made-up demo data. It assumes the cause is found on the visit where the repeat
  is caught."
- The AOM seat shows two tabs, Before and With Pill Desk, opening on Before. The tabs are only a view.

---

## S19. Typed text and chips (C4)

- **The order, the same in every seat:** safety words (S12), then the never-list (S13), then the chip words, then
  "I did not catch that" with the seat's chips.
- Typing only adds the message, shows cards (red stop cards included) and sends red stop alerts. It never opens a
  stop or locks a job, and never changes a status, tick, solution, request, decision, version, case or charge. Only
  buttons do, through `/api/action`. A typed red card carries a **Raise this stop** button (`safety-pick`); that press,
  not the typing, opens the locking stop (S11).
- **Chip words** (fixed, in code, short; add only words a test uses): What needs me (what needs me, case study,
  today); Show job (job, ticket, open plus a job id); Why? (why: the first lead's reason); Dial? (dial, nudge, bump,
  setpoint: the dial lead's status for this job, allowed or removed with its reason); Safety (safety: opens the list);
  Impact (impact, AOM only); Versions (version, versions, HQ only).
- **The AI may highlight one chip** (cut 1), never when any safety or picker word is in the message. It never presses,
  hides or adds a chip.

---

## S20. Shared memory, demo clock, Reset (C4)

- **The memory:** `web/data/state.json`, seeded from `web/data/seed-state.json`. It holds: jobs (with status, place
  tag, facts, self-check answers, ticks, found lead, why line, fixer, impact record, notes), runtime cases, solutions
  (drafts, test runs, hashes, approvals), requests (A3, A4), versions and the live version per building (both start on
  1.0, with A1: "v1.0 signed by two senior experts (role-played)"), open red stops (building, floor, zone, job, source,
  opened and cleared details), each seat's messages and notices, speak-first and low-confidence flags, and AI call
  counts. Drafts and signed versions live in `web/data/runtime/` (gitignored).
- **Seed jobs:** 2318 (`reported`) and 2401 (`reported`, shown on the Building B card).
- **Safe writes:** `memory.read()` and `memory.update(fn)`. `update` re-reads the file, applies `fn` (plain code, no
  `await` inside), writes a temp file, then renames it over `state.json`. AI calls run before or after an update,
  never inside one.
- **Demo clock:** Reset stores `demoNow = 2026-10-06T10:00:00+08:00` and the real time. `now()` is `demoNow` plus the
  real time passed since Reset. Every stamp uses it. Engine functions take `now` as an argument so tests set it.
- **Reset** (`/api/reset`): copies the seed over the memory, clears `web/data/runtime/`, and runs speak first (S6).
- **Routes:** `POST /api/action` (seat, action, job, payload; S2 checks), `POST /api/chat` (seat, text; S19),
  `GET /api/state?seat=` (that seat's view), `POST /api/reset`. Every route reading the memory is `force-dynamic`.
- **Polling:** each chat asks for news every 2 seconds. In component tests `SeatChat` takes a fake fetch or a poll
  interval of 0 and never calls the network.

---

## S21. The seat screens (C5, C7, C8, C9)

`/seat/[name]` for the 5 seat ids; an unknown name gives a 404. Home (`/`) is "pick your seat": the 5 seats, the
Building B card and a link to `/how`. The old `/tech`, `/aom`, `/engineer` and `/hq` redirect to their seats
(`technician`, `aom-tower-a`, `senior-manager`, `hq`).

**The chat parts** in `web/app/components/chat/`: `SeatChat.tsx` (header with Pip, seat label and "role-played";
messages, with notices in a quieter style; chips; a text box; the Safety button) and `ChatCard.tsx` (colour word,
title, body, receipt line). The same parts work full page and as a narrow column on `/how`.

**Colour words** (always shown, so colour is never the only signal): for pill steps, "Do it" (green), "Senior
manager's step" (amber; "AOM decides" when the step's `who` names the Asset Operations Manager), "Stop" (red). For
cases: "Won", "Failed", "Pending". For leads: their tier name.

| Seat | Shows | Buttons |
|---|---|---|
| Tenant | Report a problem; the self-check questions (S10); tips; "A technician visit is booked."; the charge card after A4 | Report, answers, Safety |
| Technician (phone first) | Job list for Tower A; the open job's **filled checklist**: place tag, calls at this spot in 30 days with dates and what each changed, repeat flag and opposite fixes, past fixes with their outcome ("Failed: the spot called again"), fit-out months from `buildings.json`, the tenant's self-check answers, and the RS-08 trend card for Tower A Level 23; then the ranked leads with reason, check text, check time and fix line; then ruled out and removed (collapsed); then the pill steps with filled values | Open job, Found it, Not this, Solved (why line), Not solved (impact record), Send with the cause, Safety |
| Senior manager | Speak-first and low-confidence notices; safety alerts; escalated jobs with everything attached (the same filled checklist, the ticks with who made them, the impact record, its own ranked list; no question is asked again); new solution form; outside help; confirm-cause items | Found it, Not this, Solved, Log new solution, Confirm each part, Run tests, Send to HQ, Ask HQ for outside help, Confirm cause, Clear stop, Tell the tenant first, Safety |
| HQ | The A1 card; solutions sent to HQ with fix line, why line, rule text (with "AI drafted, confirmed by the senior manager" or "typed"), condition (with "AI suggested from the code menu, confirmed by the senior manager" or "picked by hand"), test counts and hash; versions list; the Building B card; A3 requests | Approve and send to all buildings, Decline, Roll back, Approve or decline outside help, Safety |
| AOM Tower A | Impact meter (S18) with the speak-first flag; charge requests; safety alerts for Tower A; live version in Tower A (read only) | Decide charge, Safety |

**Filled values for pill steps** (code, from data): step 1 from Q0 ("No safety signs reported by the tenant"); step 2
from Q1 to Q3 and the ticket's intake; step 3 "Fit-out {n} months ago (building data)"; step 9 "{count} calls at this
spot in 30 days: {ids}"; step 10 the repeat flag line; step 11 "Fit-out {n} months ago: pull the fit-out file". Other
steps show their pill text only.

**The Building B card** (on home, HQ and `/how`): "Building B, Level 12 (made up)", its live version, and ticket
2401's first 3 live leads with reasons (technician seat, demo clock). Not a seat: no buttons except Safety for its own
stops.

**Pip** (`web/app/components/PipAvatar.tsx`): a small flat block character with a cube head, a hard hat and a friendly
face, drawn like the Pip in `docs/design/chat-look-samples.html`. Flat SVG, no 3D, coloured with `--pip-*` tokens. Pip
fronts every chat.

---

## S22. The judges' page /how (C10a)

A React route inside the app. `docs/design/how-prototype.html` is a picture of the look and of the v2 story; if it
disagrees with this spec, the spec wins. Every number, rule id, step and sentence on a real card comes from the pill,
the data and the engine.

- **WHY:** the Level 23 story from `tickets.json`: too cold in the core in the mornings, too hot in the west in the
  afternoons, 5 calls in 21 days, the first 4 closed with a dial turn and 2318 still open, the cause never fixed. The
  impact meter (S18).
- **WHAT:** the 5 seats around one brain, Pip in the middle, Building B as a card; who approves what (A1 to A4); a
  static "who passes what to whom" list (tenant to technician: visit booked; technician to senior manager: not solved
  with everything attached; senior manager to HQ: new solution with tests; HQ to every building: approved version; AOM
  to tenant: charge decision).
- **HOW:** code decides, the AI words, people approve only at A1 to A4; the 30-day rule; the 4 ranking steps; safety
  stops with 0 AI calls. One line on the AI's part in a new solution: it drafts the rule text and suggests the fact
  and effects from the fixed code menu, and the senior manager confirms each part. The brief's 8 questions, one line
  each. One line says the seats are role-played with no login and all data is made up.
- **Live:** the 5 real chats side by side, AOM Tower A first, using the real `SeatChat` and the one shared memory
  (never a recording), plus the Building B card. A bar with Reset (the real Reset) and the demo steps as text (which
  seat, which button). No timer and no auto-play.
- **Phone (390 px):** the chats stack, the bar stays reachable, no sideways scroll.
- **Footer:** the close line, word for word: "The checklist finds it faster, people approve only what matters, and
  every fix makes the next one faster."

---

## S23. Look: Neon Quest (C5a)

Neon Quest only, picked by YY on 14 Oct 2026 (it replaces Ember, which this section named before). The look switcher
stays in the prototype page and is not built. The tokens are taken from the `.n` block of
`docs/design/chat-look-samples.html`, which is the picture YY picked from, and they live in `web/app/globals.css` as
`:root`:

```css
  --bg: #0b0b1a;
  --grid: rgba(130, 120, 255, 0.05);
  --surface: #101026;
  --card: #14142c;
  --card-2: #1c1c3c;
  --head-bg: transparent;
  --line: #2a2a55;
  --line-2: #3a3a70;
  --text: #eeedff;
  --muted: #a9a8d6;

  --accent: #45e6ff;
  --accent-ink: #06121a;
  --accent-soft: rgba(69, 230, 255, 0.13);
  --link: #b3a8ff;
  --lit: #b3a8ff;
  --lit-ink: #0b0b1a;

  --map-edge: #45e6ff;
  --map-now: #b3a8ff;
  --map-lock: #8f7330;
  --map-dim: #5a5a95;
  --map-rx: 6px;

  --green: #52f2a2;
  --amber: #ffcc55;
  --red: #ff7a92;
  --red-card: #2a0f1e;
  --red-line: #6a2340;
  --red-text: #ffe3ea;
  --red-muted: #e6afc0;

  --sent: #10304a;
  --sent-line: #1f5c80;
  --sent-text: #eeedff;
  --ai-bg: #1c1c3c;
  --ai-line: #34346a;
  --needs: #221c22;
  --needs-line: #5a4a2a;

  --font: var(--font-inter), "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-head: var(--font-hud-family), "Chakra Petch", var(--font-inter), "Inter", system-ui, sans-serif;
  --font-hud: var(--font-head);
  --head-weight: 600;
  --body-weight: 400;
  --name-weight: 600;
  --hud-case: uppercase;
  --hud-track: 0.12em;

  --r-card: 8px;
  --r-panel: 10px;
  --r-btn: 6px;
  --r-chip: 6px;

  --glow: 0 0 20px rgba(69, 230, 255, 0.4);
  --av-bg: #14142c;
  --av-line: #6b5ee8;
  --av-r: 12px;
  --av-glow: 0 0 18px rgba(139, 124, 255, 0.45);
  --map-now-glow: drop-shadow(0 0 6px rgba(160, 145, 255, 0.9));

  --pip-pb: #8b7cff;
  --pip-ps: #5f4fdb;
  --pip-hf: #ffcc55;
  --pip-ht: #ffe08f;
  --pip-hs: #c9971f;
  --pip-hr: #ffebb0;
  --pip-ey: #0b0b1a;
  --pip-ck: #ff8fd6;
  --pip-w: #ffffff;

  /* Status tokens map onto the look's three colours. A status always carries
     its word too, so colour is never the only signal (S21). */
  --g: var(--green);
  --g-ink: var(--green);
  --g-bg: var(--card);
  --a: var(--amber);
  --a-ink: var(--amber);
  --a-bg: var(--card);
  --r: var(--red);
  --r-ink: var(--red);
  --r-bg: var(--red-card);
}```

- Dark near-black blue with a faint violet grid, one cyan glow (only on the main action of a screen), HUD type in
  Chakra Petch for labels and Inter for body text.
- Keep the status tokens in `globals.css` (`--g`, `--a`, `--r`) and map them to `--green`, `--amber`, `--red`. Status
  text needs a contrast of 4.5:1 or more on its card; all five pairs are checked in `tests/c5a.test.tsx`.
- No hard-coded colours outside the token block, hex or rgba. Chakra Petch and Inter from `next/font`.
- The quest rail (`QuestRail.tsx`) is the look's own shape for how far a job has come. It draws only what the engine
  hands it.

---

## S24. Old code that goes, and the docs C1a writes

**Removed in C5a:** `web/app/HomeClient.tsx`, `GuidedDemoPanel.tsx`, `SkillTreeMap.tsx`, `StoryStrip.tsx`, the 3D
`PipCharacter.tsx` (its flat `PipSVG` drawing moves to `PipAvatar.tsx`), `web/app/tech/TechClient.tsx`,
`web/app/aom/AomClient.tsx`, and the packages three, @react-three/fiber, @react-three/drei, @types/three and
framer-motion. `TopBar.tsx`, `layout.tsx` and the status colours in `globals.css` are kept and restyled.

**The decisions file** `docs/decisions/2026-10-10-faster-fix-flow.md`, top line "approved by YY on 10 Oct 2026, one
approval for the whole list". Each item names the earlier decisions it changes:

1. The flow is YY's 2 Oct plan: tenant self-check, filled checklist, ranked causes, Solved or Not solved, senior
   manager, HQ, AOM (D1, D2, D12).
2. Approvals exist only at A1 to A4. The amber "ask for a yes" steps leave the flow. Safety stops are stops (D9).
3. A fix is a win only after 30 days with no repeat at the same spot; failed fixes lose points; the fixer cannot
   confirm the cause alone; every closed job has one line of why. This replaces the 4-check Fixed gate (D3).
4. Ranking is 4 code steps over a made-up case library; the AI never ranks; below 3 cases the screen says "low
   confidence, expert rule" (D4, D8; D4's "below 5 cases" becomes "below 3").
5. Every job carries building, floor, zone and equipment; the repeat flag also triggers speak first (D6).
6. HQ approves a new solution after its tests pass and it goes to every building at once, with rollback; no "not here"
   (D7).
7. v1.0 is shown as signed by two senior experts (role-played); the know-how stays labelled public sources (D11).
8. The 80 percent trigger stays on the roadmap (D4).
9. The tenant chat is a must; the helpdesk folds into the tenant self-check; Building B is a card (D1, D12).
10. The interview, version map, withdraw, AI wording on every card, Play, focus mode extras and the per-visitor live
    link are cut (D12, D13).
11. The look is Ember; it replaces `2026-10-06-new-look.md`.
12. The AOM approves charges to the tenant (A4); the tenant hears the price only after (D2, D9).
13. The senior manager is the FM contractor's chief engineer; HQ is the Keppel Technical Services lead; both
    role-played (D2).
14. Seats are role-played with no login.
15. The impact meter's "with Pill Desk" numbers are worked out by replaying the tickets and labelled so (D10).

**Rule files (C1a):** `.codebuddy/rules/product-rules.md` says this spec is the source of truth and holds these lines
word for word: "Approvals exist only at A1, A2, A3 and A4.", "A fix counts as a win only after 30 days with no repeat
at the same spot.", "The AI never ranks. It only words what code decided." Remove its old amber, Fixed, 80 percent and
per-building Accept rules. `.codebuddy/rules/safety-and-secrets.md`: replace the line saying keys go in `.env` only with
S0 rule 4 and S0 rule 12. New `.codebuddy/settings.json`: permissions deny Read and Edit of `./web/.env.local`,
`./web/.env` and `./.env`. `CODEBUDDY.md`: rewrite "Current status" and "What we are building" for Pill Desk chats and
the faster-fix flow, linking `docs/plan/BUILD-SPEC.md` and the decisions file.

---

## S25. How Claude reviews

- CodeBuddy writes every line of product code. Claude never edits this repo. Claude reads it, runs the tests and the
  build, renders the pages, and pushes to GitHub only with YY's OK.
- Claude reviews a step when YY says "review Cn" after its `[step Cn done]` commit. Part commits get no check, so
  Claude never runs a build while CodeBuddy is working.
- Claude never reads `web/.env*` files and searches only with `git ls-files` or `rg`, which skip ignored files.
- After the C5, C7, C8, C9 and C10 reviews, Claude renders at desktop width and at 390 px in an iframe wrapper and
  gives YY the numbers. YY writes the build-log row with `/log-proof YY`.

---

## T. Tests, by part

Every part also needs: every test passes, the build passes, the count never goes down (S0 rule 8).

### T-C1a
- `docs/plan/BUILD-SPEC.md`, `docs/design/how-prototype.html` and `docs/design/chat-look-samples.html` exist and their
  hashes equal the reference copies Claude placed in `design-refs` next to the repo, and the SHA-256 values Claude gave
  YY (they are written into the C1a prompt). The first lines of `docs/plan/BUILD-SPEC.md` say "Version 2".
- One search per file, each finds a match: `product-rules.md` has "Approvals exist only at A1, A2, A3 and A4." and
  "The AI never ranks."; `safety-and-secrets.md` has "web/.env.local" and no longer has "in `.env` only";
  `CODEBUDDY.md` has "Pill Desk chats" and "docs/plan/BUILD-SPEC.md"; `.codebuddy/settings.json` has
  "Read(./web/.env.local)".
- The decisions file names D1, D2, D3, D4, D6, D7, D8, D9, D10, D11, D12 and D13 (whole-word match).
- 38 tests pass.

### T-C1b
- `npm run ai:ping` prints the model id and a first reply time under 5000 ms, and no key, base URL, header or file
  path. With an empty key it prints "key: empty". On an error it prints only the HTTP status and "AI unavailable".
- `ai-ping.ts` calls `loadEnvConfig` with a no-op logger (a search of the file shows the `info` and `error` stubs), and
  it ignores `REPLAY_MODE`.
- `web/tests/setup.ts` is listed in `vitest.config.ts`; a test shows a network call fails with "network blocked in
  tests", and inside tests `LLM_API_KEY` is empty and `REPLAY_MODE` is 1.
- `ai-core.ts` has no `server-only` import; `ai.ts` has it; the scripts import `ai-core.ts`.

### T-C2a
- `getRedStop` returns each of the 10 stops' own trigger, action and who_to_call (10 tests, compared with the YAML).
- `hasWaterDripping` returns RS-04's action, not RS-01's or RS-02's. New `hasScorchedPlug` returns RS-03's action word
  for word.
- `checkRedStops(pill, ["RS-04", "RS-01"])` returns RS-01 then RS-04.
- `buildPillYaml()` equals the text of v1.0.yaml; nothing is written. `git diff web/pills/ts-cc/v1.0.yaml` shows only
  10 added `id: RS-xx` lines.
- `checkPill` refuses a missing or repeated red stop id. `loadAndCheckPill` throws on a broken pill (a rule with no
  sources). v1.0 still refuses a TS-CC-27.
- All 38 old tests pass with no edit.

### T-C2b
- `factsFor` gives exactly the 4 lists in S5 for 2318, 2401, 2305 and 2301.
- `placeTag(2318)` is `{ building: "tower-a", floor: 23, zone: "core", equipment: "VAV-23-C1" }`.
- 2301 alone has no repeat flag: count 1, `speakFirstFor` fire false.
- 2305 trips the repeat and speak first: count 2, opposite fixes true, fire true.
- 2318: count 5, fire true. 2401: fire false.
- After Reset (memory test): exactly 1 speak-first notice in the senior manager's chat, for Tower A Level 23, with
  "5 times in 30 days, with opposite fixes"; a second run adds none.
- `git diff web/lib/rule-engine.ts` shows no change inside `computeRepeatFlag`.

### T-C2c
- `cases.json` has 12 cases, each labelled; no case names a tenant.
- At the demo clock, the old dial fixes on Level 23 count as failed: 2301, 2305, 2310 and 2315 each `failed`, with
  repeats 2305, 2310, 2315 and 2318. H-06 and H-10 `failed`; the other 10 `won`.
- A fix closed today shows pending until 30 days pass with no repeat: a case at tower-a/23 closed
  2026-10-06T14:00+08:00, fixed by `senior-manager`, confirmed by `hq`: at 2026-10-20 it is `pending` with "pending,
  30-day check until 5 Nov"; at 2026-11-05T14:01 with no new call it is `won`; with a new call at tower-a/23 on
  2026-10-15 it is `failed` from 15 Oct on.
- The same case with `confirmedBy` equal to `fixedBy`, after 30 days: `unconfirmed`, 0 points, "needs a second person
  to confirm the cause".
- A call at another spot (building-b/12) never fails a tower-a/23 case.
- `causes.json`: rebalance's `fixSeat` is `none`; thermostat-spot's `tenantSolution` starts "Our contractor will move".
- `trends.json`: the core block equals S7 (description, 11 readings, `sensorTemp` above `temp` in every reading,
  `damperPct` 85 and 90 at 8 and 9); the `label` and the `west` block are byte for byte as before (`git diff` shows
  changes inside `core` only).

### T-C2d
- 2318, technician, v1.0, no ticks: leads in the order precool, min-airflow, thermostat-spot; scores and reasons as in
  S9; removed holds setpoint (TS-CC-09), sun-west, capacity and rebalance with their reasons.
- After Not this on precool: min-airflow first. After Not this on min-airflow too: thermostat-spot first, tier
  low-confidence, `alertSeniorManager` true. `clear` on min-airflow brings it back first.
- A ranked list with fewer than 3 matching cases shows low confidence: a test job and a test case list where a cause
  has 2 similar decided cases gives "Low confidence, expert rule" and no percentage.
- 2401, technician, v1.0: precool, min-airflow, thermostat-spot, setpoint; setpoint net-failed with score minus 3 and
  "2 failed fixes count against".
- Senior manager seat on 2318 with the two ticks: thermostat-spot then rebalance; rebalance's check time shows "2 days".
  Rebalance has `fixAllowedHere` false on the senior manager seat (and on every seat).
- Close groups: with test scores 9 (60 minutes) and 8 (10 minutes), the 10-minute check is first; with 9 and 6, the
  score order holds.
- 2315: capacity removed with "Red: out of scope".
- `web/lib/rank.ts` imports nothing from `ai.ts` or `ai-core.ts`; the same input twice gives deep-equal output.

### T-C3a
- **Red (21), one test each:** "cord feels hot", "sparks from the socket", "got a shock", "plastic melting", "smoking
  socket", "smoke coming from the ceiling", "collapsed", "can't breathe", "fell off the ladder", "leak above the DB
  room", "water dripping near the lights", "the fire damper seems shut", "AHU keeps tripping", "refrigerant leak", "I'm
  up the ladder alone", "the heater plug is burning hot", "there is a fire up in the ceiling", "wet ceiling tiles",
  "water from the ceiling near my desk", "the ceiling leak is getting worse", "the ceiling is dripping" (RS-04, the
  ceiling pair).
- "smoking socket" shows RS-01 and RS-03.
- **Picker, not red (11):** "a heater to keep warm", "a small heater", "water beads on the diffuser", "what do I do
  about the water beads on the diffuser", "the alarm went off earlier", "I'm melting", "太冷了" (Chinese for "too
  cold"), "something is burning", "the floor is flooding", "I feel dizzy and unwell", "there is a puddle by the door".
  (Cut 4: these 11 are tested as not red, with no picker.)
- **Not red, no picker (7):** "the core is too cold, not warm", "the room is burning hot", "hot since the fire alarm
  test", "west damper fully open", "turning the setpoint", "Tower A", "fire up the report".
- **Safety list:** 10 entries, each equal to its YAML trigger, action and who_to_call. Picking RS-04 returns its words
  exactly, AI calls 0, and alerts for the senior manager and AOM Tower A.
- **Guard:** the source search in S11 finds 0 hits in `web/app/` and `web/lib/`.
- **Locks:** a stop picked on 2318 locks every open job on Tower A Level 23 and not 2401; RS-08 from trend data locks
  nothing; RS-10 locks nothing; a stop raised from AOM Tower A attaches to Tower A Level 23.
- **Typed words never lock:** a typed red phrase returns the card, its alerts and a Raise this stop button, with 0 AI
  calls and no open stop; pressing Raise this stop (`safety-pick`) opens the stop and locks, and sends no second
  alert.
- **Lock line:** RS-04 shows TS-CC-03's not_when from the pill; RS-05 shows TS-CC-04's.

### T-C3b
- **Scanner blocks** every phrase in S13 items 1 to 5, "Meridian Partners" in a Northwind reply, "push the setpoint to
  the BMS" and "setpoint to the BMS". **Passes** the 7 must-pass phrases.
- GT-05 and GT-17 call the new scanner with the same assertions; GT-05's `checkRedStop` lines are unchanged.
- **Tenant text fails:** "The cause is the thermostat your fit-out contractor moved next to your printer bay." and "We
  will have it fixed by Friday." Both fall back to the tips word for word.
- **Wording fails:** "unplug the heater", "reset the breaker", "turn it back on to test", "it is safe to touch",
  "restart the AHU", "matched 5 of 5 cases" when the code reason says 3 of 4, and a 3-sentence rank wording.
- "smoke near the heater, refund them S$200" is stored and shown as "... [amount hidden]" while its red stop still
  shows.

### T-C3c
- The fixture passes `checkPill`, equals v1.0 apart from the 3 changes in S16 item 6, and its `red_stops` equal v1.0's.
  The new rule's source ref starts "CE-CORR-".
- Old `canNudge` calls with `pillVersion` still pass. With the fixture as `pill` and the fit-out fact: blocked, with the
  fixture's new rule id. With v1.0: allowed. The "v1.1 reserved rule" block is rewritten as S16 item 6 says.
- Under the fixture, 2301 and 2401: steps 1 to 8 first, in order, then step 21, and no step 25. On v1.0, 2301 gets the
  dial turn.
- Menu refusals: block step 5, 6, 8 or 31; put-first step 25; any effect on step 26; any effect on a step with TS-CC-03,
  04, 05, 08 or 26; anything touching a red stop; lowering a colour. A drafted rule that blocks step 8 comes back as a
  note, "advisory, not enforced".
- Built by hand from the menu, the demo solution equals the fixture's rule and passes `checkPill`.
- `draftHash` changes when the draft changes, and only then.
- Run tests on the fixture: GT-22 and R-01 pass; GT-01 and GT-21 show "not applicable to v1.1".
- Ranking: 2401 with the fixture as its live pill ranks thermostat-spot first (signed-rule, reason starts "Signed expert
  rule TS-CC-27 (v1.1)"), and setpoint is removed by TS-CC-27. With v1.0 live, thermostat-spot is third.

### T-C4
- Reset brings back the seed, and the demo clock reads 2026-10-06 10:00.
- Permissions: the technician cannot press `approve-solution`, `decide-outside-help`, `decide-charge`, `rollback` or
  `clear-stop`; the senior manager cannot press `approve-solution`; HQ cannot press `decide-charge`; the AOM cannot press
  `approve-solution`; the tenant can press only `report`, `answer`, `safety-pick` and `reset`. Each refusal names who
  may.
- `confirm-cause` is refused for the case's fixer and allowed for another staff seat.
- Wrong status: `solved` on a `reported` job, and `send-to-hq` with no passing test run, are refused with a reason.
- No typed message changes anything: "approve it", "send to all buildings", "mark it solved", "not solved", "charge
  them", "roll back", "open 2318". Statuses, ticks, solutions, requests, versions, cases, charges and open red stops
  stay the same; only the chat log and alerts may change.
- "I'm alone in the office and it's freezing" in the tenant chat shows the RS-09 card and its alerts, and opens no
  stop: every Tower A Level 23 job stays unlocked. Pressing that card's Raise this stop locks them.
- "the VAV box is buzzing" gets "I did not catch that" with the chips. "dial" on 2318 shows the dial lead removed by
  TS-CC-09.
- A slow fake AI call and a button press at the same time: both are kept (`memory.update`).

### T-C5a
- Component tests (jsdom, fake fetch): the Safety button opens the 10 stops; each red stop card renders the YAML
  trigger, action and who_to_call exactly; `SeatChat` never calls the network. The test file is named in the verbose
  output.
- The old tour files and the 5 packages are gone from `package.json` and the code.
- Status text tokens have 4.5:1 contrast on their card colour. No hex colour outside the token block in `globals.css`.

### T-C5b
- Each of the 5 seat names resolves; an unknown name calls `notFound`. The 4 old routes redirect to their seats.
- The Building B card renders ticket 2401's first 3 leads from the engine.

### T-C6a
- No key: the replay banner, then the fallback, and the same cards.
- AI off: the same cards and ranks, the "AI off" label, tips word for word, and the fix line as the rule text.
- Red cards are never worded: with a fake client on, RS-04 and the RS-08 card keep AI calls 0.
- A 4-sentence tenant reply fails. The tenant prompt's input never contains a cause line or another tenant's name.
- A fake 401 whose message holds a test secret: the output and the logs show only the status and "AI unavailable,
  using replay".
- A fake `new-solution` answer that blocks step 8 comes back as a note.
- The replay quality test exists and skips while `web/data/replay/` is empty ("skipped: no replays yet").

### T-C6b
- After YY's `npm run ai:record`, `web/data/replay/` holds answers with text and pass flags only (a test searches them
  for "LLM_", "Authorization" and "http" and finds none). The replay quality test runs (not skipped) and passes.

### T-C7a
- Hot, west boardroom, blinds up: the tip with TS-CC-20 word for word (AI off), the job `pending-30-day`, 0 visits, no
  job for the technician.
- Cold, core, "It keeps coming back": visit booked, the answers attach to 2318 (no new job), the 2 tips with TS-CC-09,
  and no second speak-first notice.
- Q0 Yes: the Safety list; picking RS-04 shows its words, AI calls 0, alerts to the senior manager and the AOM.
- After hours Yes (a test report time of 20:00): the tip with TS-CC-12 and an A4 request for the AOM; the tenant chat
  shows no amount.
- A new spot (zone "Somewhere else") makes job 2319 in `visit-booked`.
- Hands-off guard: no question text contains climb, reset, unplug, switch off, turn off, adjust, remove or "open the".
- An AI tenant reply with "because your fit-out moved the thermostat" fails and the tips show word for word.

### T-C7b
- Open 2318: the filled checklist shows Tower A Level 23, core, VAV-23-C1; 5 calls with their dates; the repeat flag
  with opposite fixes; 4 past dial turns each "Failed: the spot called again"; fit-out 8 months ago; the self-check
  answers; the RS-08 trend card word for word with AI calls 0.
- The ranked leads match T-C2d, and each tick re-ranks within one poll (2 seconds).
- Not solved needs the impact record; the job goes to `escalated` and the senior manager's chat gets it with a cost
  from the made-up rates.
- Found it on thermostat-spot, then Solved: refused ("this fix belongs to the senior manager"); Send with the cause
  escalates with the cause.
- The low-confidence notice reaches the senior manager exactly once.
- At 390 px: the Safety button and the Solved and Not solved buttons are on screen without sideways scroll.

### T-C8a
- The escalated 2318 shows the self-check answers, the facts, both ticks with who made them and the impact record; the
  seat shows no tenant question buttons.
- Log new solution with the demo fix line and why line, AI off: the rule text equals the fix line word for word;
  nothing is saved until each part is confirmed; the confirmed draft equals the fixture's rule.
- Run tests shows passed, failed and not applicable counts; Send to HQ is refused before a passing run, and after a
  confirm that changes the draft.
- Logging the solution with thermostat-spot found opens no A4 request: the AOM's chat has no charge request until HQ
  approves (T-C8b).
- Ask HQ for outside help moves the job to `outside-help-requested`; the request reaches HQ.
- Clear stop: senior manager only, reason of 3 words or more. RS-01 and RS-06 need the safety record tick (their
  who_to_call names the Fire Safety Manager); RS-04 and RS-05 do not. The tick is labelled a safety record, not an
  approval.
- On the senior manager seat, Found it on rebalance, then Solved: refused ("this fix needs outside help: Ask HQ, A3").

### T-C8b
- 2401 ranks the thermostat check first only after the new solution is approved and distributed: with the draft sent to
  HQ and its tests passed, 2401's first lead is precool; after Approve it is thermostat-spot, and both buildings' live
  version is 1.1.
- Approve is refused with no test run, with a failed run, with "draft changed since the tests", and when `red_stops`
  differ from v1.0's.
- After Approve: 2318's case is in the memory as `pending` with fixedBy `senior-manager` and confirmedBy `hq`; the job
  shows `pending-30-day`; the signed file never changes again (byte check after a later action).
- After Approve, the AOM's chat gets the A4 charge request, starting "Tenant will hear: "Our contractor will move the
  wall thermostat back to the spot on your approved fit-out drawing, with your OK."". After Decline, no request.
- R-01 and safety stops: with an RS-04 stop raised by a button on Tower A Level 23, Run tests on the draft still passes
  R-01 and Approve still works; the stop stays open and the floor's jobs stay locked.
- Rollback: both buildings back to 1.0, 2401's first lead precool again, v1.1 kept as "rolled back", nothing deleted.
- The A1 card shows v1.0 signed by two senior experts (role-played).
- Outside help: Approve and Decline each need a reason of 3 words or more and return the job to `escalated`.

### T-C9
- The impact meter shows the S18 numbers for Tower A Level 23, and the label. Changing a date in a temp copy of
  `tickets.json` changes the numbers (nothing is hard-coded).
- The speak-first flag shows for Tower A Level 23.
- Decide charge: AOM only; Tenant pays needs a whole number from 1 to 100000 and a reason of 3 words or more. After a
  test decision of 350 on 2318, the tenant gets exactly this code card, and nothing before: "What we will do: Our
  contractor will move the wall thermostat back to the spot on your approved fit-out drawing, with your OK. Cost:
  S$350, made-up demo amount. Approved by the AOM (role-played)." Goodwill needs a reason. No AI call is made for any
  charge step.

### T-C10a
- The WHY dates and the 5 calls match `tickets.json` (change a date in a temp copy and the page changes). The page says
  the seats are role-played with no login and the data is made up.
- The 5 chats, the Building B card and the impact meter render from the one memory. At 390 px the chats stack with no
  sideways scroll.

### T-C10b
- `web/tests/demo-flow.test.ts` runs the demo through the action functions on replay, network blocked: Reset; the
  tenant self-check on 2318; Open, 2 Not this ticks, Not solved; the senior manager's Found it, Log new solution,
  confirms, Run tests, Send to HQ; HQ Approve; 2401's first lead is thermostat-spot; the AOM's charge decision (cut 9:
  this line is dropped); the impact numbers; "water dripping near the lights" gives RS-04 with AI calls 0 and locks
  nothing, then Raise this stop locks Tower A Level 23; AI off gives the same cards. It prints "demo flow: all steps
  passed".
- `git grep -I -l -E "LLM_API_KEY=[A-Za-z0-9_.-]{8,}|sk-[A-Za-z0-9]{20,}"` on tracked files prints nothing.
- The README's run steps work with no key (replay).
