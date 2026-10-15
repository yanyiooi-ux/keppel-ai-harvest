# Solution

This page is the map for judges. It answers Keppel's 8 questions, and for each answer it names the seat, screen or
button that shows it, the code that does it, and the test that proves it.

- Checked against the app at commit `4b44bdc` ("fix: review findings for D4"), 16 Oct 2026. It was first written
  against `5088410` on 15 Oct. Between the two commits the engine, the data, the rule book and the prompts did not
  change; what changed is the words on screen, Story mode, the look, the `/flow` page and the video player.
- All paths are from the repo root (`keppel-ai-harvest/`).
- Every building, tenant, ticket, case, rate, amount and signature in the app is made up for the demo. The five seats
  are role-played, with no login.
- The `/how` page in the app is the live version of this map: it asks the same 8 questions and answers each in one line
  (`web/lib/how.ts`, `briefAnswers`). One difference: its one line for question 5 says only that the AI words what
  code decided. The fuller answer, that for a new rule the AI also drafts the text and suggests from a fixed code
  menu, is on the same page in its own card, "The AI in a new solution" (`web/lib/how.ts`, `AI_NEW_SOLUTION_LINE`),
  and in question 5 below.
- Two more pages show the same flow. `/demo` is Story mode: the real app plays the whole demo by itself in 8 steps,
  one seat at a time, with a short caption for each step (`web/lib/story.ts`). `/flow`, "How a job flows", shows every
  button in order and who is told next (`web/lib/flow.ts`).

Short forms used below, spelled out once: AOM is the Asset Operations Manager, the owner-side manager who oversees
the property manager and the FM contractors (`docs/problem/level-23-story.md`; the exact Keppel title is not settled,
`docs/problem/problem-statement.md`). HQ is head office. FM is facilities management (the contractor who runs the building day to day). AI is artificial intelligence.
YAML is a plain text file format that people and code can both read. A1 to A4 are the four approval points.

Words used below, in plain terms:
- A **pill** is the rule book for one repeat problem: one YAML file with a version number. The demo's pill is TS-CC.
- The **pill owner** is head office (HQ), which approves each new version of the pill.
- A **red stop** is a safety stop: fixed words from the pill that say what to do and who to call. The AI is never
  used for it.
- The **never-list** is the pill's 4 "never" items: never quote a price (a free offer counts too), never admit fault,
  never show one tenant's details to another, and never write to the building management system (BMS) or any
  building system. Every AI answer is scanned for them.
- **Golden tests** are fixed test cases with known right answers. The pill lists them, and the test suite runs them.
- A **lead** is one likely cause in a job's ranked list, "best bet first".
- A **hash** is a short fingerprint of a file. Change one letter and the hash changes, so a test run is tied to one
  exact draft.
- **C1 to C10b** and **D1 to D4** are build step codes in `proof/BUILD-LOG.md`: C for the core build, D for the four
  finishing parts.

## The picture: five seats around one shared brain

```
      TENANT                    TECHNICIAN                  SENIOR MANAGER
      /seat/tenant              /seat/technician            /seat/senior-manager
      self-check, tips          checklist, ranked causes    (FM chief engineer)
                                                            new solution, its tests
         |                           |                           |
         |-- visit booked ---------->|-- Not solved, ----------->|
         |                           |   everything attached     |
         v                           v                           v
   +-----------------------------------------------------------------------------+
   |                            ONE SHARED BRAIN                                 |
   |                                                                             |
   |   Rule book: the pill TS-CC, one YAML file with a version number            |
   |   Past cases: 12 to start, plus every job that is solved                    |
   |   One memory: every job, tick, version and safety stop                      |
   |   Code ranks, locks and routes. The AI (Tencent Hunyuan) words things;      |
   |   for a new rule it also suggests from a code menu, and a person confirms.  |
   |                                                                             |
   |   [A1] Version 1 of the brain, signed by two senior experts (role-played)   |
   +-----------------------------------------------------------------------------+
         ^                                     ^
         |                                     |
      AOM, TOWER A                          HQ PILL OWNER
      /seat/aom-tower-a                     /seat/hq
      [A4] Decide charge (who pays)         [A2] Approve and send to all buildings
      impact meter, safety alerts,          [A3] Approve or Decline outside help
      live version (read only)              Roll back

   Hand-offs: senior manager to HQ: a new solution with its passing tests.
              HQ to every building: the approved version, all at once.
              AOM to tenant: the charge decision, written by code.
   Building B is a card, not a seat: it reads the same brain with its own live version.
```

### The four approval points, and only four

People approve at A1 to A4, and nowhere else. A1 was signed before the demo, so the app shows it as already signed,
with no button; A2 to A4 are buttons in the app. Typing in a chat never changes anything; only buttons do.
The pill's amber steps also name whose yes a step needs in the building (for example the FM chief engineer, or the
tenant plus the AOM, `web/pills/ts-cc/v1.0.yaml`, `guardrails`). The app shows that name on the step, and that yes
happens outside the app.

| Point | What | Who | The button | Code | Test |
|---|---|---|---|---|---|
| A1 | Version 1 of the brain | Two senior experts (role-played) | None: shown as already signed, a card on the HQ seat and on `/how` | `web/data/seed-state.json` (`a1Line`), `web/lib/hq-desk.ts` | `web/tests/c8b.test.ts`, "shows v1.0 signed by two senior experts (role-played) on the HQ seat" |
| A2 | A new solution goes live | HQ pill owner, only after its tests pass on that exact draft | HQ seat: "Approve and send to all buildings" | `web/lib/hq-flow.ts` (`approveRefusal`, `applyApprove`) | `web/tests/c8b.test.ts`, "only HQ approves (A2): the senior manager and the AOM are refused and nothing changes" |
| A3 | Outside help or money beyond the senior manager | HQ pill owner | Senior manager: "Ask HQ for outside help", then HQ: "Approve" or "Decline", each with a reason | `web/lib/senior-manager-flow.ts`, `web/lib/hq-flow.ts` (`applyDecideOutsideHelp`) | `web/tests/c8b.test.ts`, "Approve with a reason: the job back to escalated, \"outside help approved (A3)\" on its card" |
| A4 | Charging the tenant | AOM, Tower A | AOM seat: "Decide charge" | `web/lib/charge-flow.ts` | `web/tests/c9.test.ts`, "every other seat is refused, and nothing changes" |

The table of who may press what is one file, `web/lib/permissions.ts` (`ACTION_RULES`). The server checks every press
against it in `web/lib/actions.ts` (`runAction` calls `mayPress`), not only by hiding buttons on screen.

## The 8 questions at a glance

| # | Keppel's question | Our answer in one line | See it in the app |
|---|---|---|---|
| 1 | What business problem? | Tickets close but causes stay: one floor called 5 times in 21 days, and every dial turn came back. | `/how`, section "1 · Why"; the AOM seat's impact meter |
| 2 | Whose expertise, and how is unwritten know-how captured? | The FM contractor's chief engineer (role-played): their fix line and why line become a draft rule, tested before it counts. Version 1.0 came from 144 research items and team decisions; no real expert interviewed yet. | Technician: "Mark solved", "Not solved". Senior manager: "Log new solution" |
| 3 | How does it become reusable? | It lives in a versioned rule book, and every solved job becomes a case that ranks the next job, in every building. | Technician seat: "Likely causes, best bet first"; the Building B card |
| 4 | How does the AOM use and supervise it, and know when to step in? | The AOM sees the cost, the safety alerts and the live version, and is the only one who decides a charge (A4). | `/seat/aom-tower-a`: impact meter, "Decide charge" |
| 5 | Why more than a chatbot or search? | Code decides and only buttons change anything. The AI words things, and for a new rule suggests from a fixed code menu that a person confirms. With the AI off every card is the same. | The AI switch in the top bar: Live, Saved answers, Off |
| 6 | How are feedback and new know-how reviewed, validated, versioned and approved? | 30-day rule, the fixer cannot confirm their own cause, tests on the exact draft, HQ approval (A2), versions with rollback. | Senior manager: "Run tests", "Send to HQ". HQ: "Approve and send to all buildings", "Roll back" |
| 7 | How does it extend to many assets? | A building is one row of data. One HQ approval moves every building at once. | The Building B card on the home page and the HQ seat |
| 8 | Credible path to build it? | It runs today: Next.js and TypeScript, the rule book as a YAML file, Hunyuan through Tencent Cloud TokenHub. | `README.md`, "Run it on Replay, with no key" |

## The 8 questions in full

### 1. What specific business problem is being addressed?

Office comfort complaints are handled one ticket at a time. Each ticket closes, so the numbers look fine, but the
cause is never fixed. In the demo data, Tower A Level 23 called 5 times in 21 days (15 Sep to 6 Oct). The first 4
calls were closed with a turn of the thermostat dial, and every one came back. Job 2318, the 5th call, is still open. The longer write-up
is `docs/problem/problem-statement.md`.

| What | Seat, screen or button | Code | Test |
|---|---|---|---|
| The 5 calls, worked out from the ticket data | `/how`, "1 · Why: Tickets close, causes stay" | `web/lib/how.ts` (`whyStory`), data `web/data/tickets.json` | `web/tests/c10a.test.ts`, "says 5 calls in 21 days, the first 4 closed with a dial turn that came back, 2318 still open, never fixed" |
| What it cost, before and with Pill Desk | AOM seat, "Impact meter" (tabs "As it happened" and "Replayed by code") | `web/lib/impact.ts` (`impactFor`), rates `web/data/impact-rates.json` | `web/tests/c9.test.ts`, "before: 5 calls, 5 visits, no senior check, not fixed after 21 days, 4 repeat calls, S$600 and counting" |
| The warning that a spot keeps calling | Senior manager's chat and the AOM seat: "This spot keeps calling" | `web/lib/speak-first.ts` | `web/tests/c2b.test.ts`, "2318 notice has 5 times in 30 days, with opposite fixes" |

The "with Pill Desk" numbers are a replay by code. The meter says so on screen: it assumes the cause is found on the
visit where the repeat is caught (`web/lib/impact.ts`, `IMPACT_LABEL`).

### 2. Whose expertise is captured, and how is knowledge that is not already documented obtained?

The expertise is the FM contractor's chief engineer's (the senior manager seat) and the technicians' on the floor.
Both are role-played. Version 1 of the rule book was built from 144 research items (drawn from 79 public web pages on
51 sites, practitioner forums among them, each checked against its source: `docs/knowhow/sources.md`) and team
decisions, and every rule names its source and how it
was labelled. **No real expert has been interviewed yet**
(`docs/knowhow/README.md`). An 11-question, 25-minute interview guide for a real chief engineer is ready in
`docs/knowhow/interview-guide.md`; it is not part of the app.

In the app, unwritten know-how is captured at the moment it is used. Each button that moves a job on asks for what
that step needs: "Mark solved" and "Log new solution" need a why line, "Not solved" needs the impact record, and "Send
with the cause" needs a cause marked "Found it".

| What | Seat, screen or button | Code | Test |
|---|---|---|---|
| A solved job needs one line of why (3 to 30 words), and becomes a case | Technician: "Found it", then "Mark solved" | `web/lib/technician-flow.ts` (`applySolved`) | `web/tests/c7b.test.ts`, "a why line under 3 or over 30 words is refused" |
| A job that is not solved needs the impact record: hours lost, extra visits, contractor or parts | Technician: "Not solved", then "Send to the senior manager" | `web/lib/technician-flow.ts` (`applyNotSolved`), `web/lib/impact-rates.ts` | `web/tests/c7b.test.ts`, "with no impact record it is refused and nothing changes" |
| The senior manager's fix becomes a draft rule: a fix line and a why line (3 to 30 words each) | Senior manager: "Log new solution", then "Log it" | `web/lib/senior-manager-flow.ts`, `web/lib/draft.ts` | `web/tests/c8a.test.ts`, "a fix line or a why line outside 3 to 30 words is refused, and nothing is drafted" |
| The AI drafts the rule text and suggests the fact and effects from a fixed code menu; the person confirms each part | Senior manager: "Confirm" on each of the 4 parts | `web/lib/ai-core.ts` (new-solution job), prompt `web/prompts/new-solution.md`, menu `web/lib/conditions.ts` | `web/tests/c8a.test.ts`, "labels: the rule text \"AI drafted\", the fact and each effect \"AI suggested from the code menu\"" |
| Nothing is saved until every part is confirmed | Senior manager's draft | `web/lib/senior-manager-flow.ts` (`applyConfirmPart`) | `web/tests/c8a.test.ts`, "nothing is saved until each part is confirmed: no draft file, no hash, no live change" |
| The new rule is tagged as the senior manager's correction, with its date | The draft on the HQ seat | `web/lib/draft.ts` (`NEW_RULE_TEMPLATES`, `ceCorrRef`) | `web/tests/c3c.test.ts`, "the new rule's source ref starts CE-CORR- and is the demo clock's date" |
| The tenant's answers (where, when, keeps coming back) join the job, so nobody asks twice | Tenant: "Report a problem", "Too cold", 5 answer buttons | `web/lib/self-check-flow.ts`, `web/lib/self-check.ts` | `web/tests/c7a.test.ts`, "visit booked, the answers attach to 2318 (no new job), the 2 TS-CC-09 tips, no second speak-first notice" |
| The rule book names its contributor by role, never a real person | `web/pills/ts-cc/v1.0.yaml`, `contributor` (role: FM chief engineer, Singapore office towers; real: false) | `web/lib/pill.ts` (`checkPill`) | `web/tests/pill-check.test.ts`, "has a contributor marked as not real" |

### 3. How does the captured expertise become reusable, rather than a one-off answer?

The know-how lives in a pill: one YAML file per repeat problem, with a version number and its contributor named by
role. Its owner is the HQ seat, which approves each new version. The demo pill is
TS-CC (Technical Services, repeat comfort complaints). Version 1.0 holds 26 rules, a 31-step checklist, 10 red stops,
4 never-list items, 5 guardrails, 8 hands-off tenant tips and 20 golden tests (`web/pills/ts-cc/v1.0.yaml`). Every
solved job is saved as a case, and cases rank the next job: 12 made-up past cases to start (`web/data/cases.json`). An
approved new rule goes live in every building at once. The same input always gives the same ranking.

| What | Seat, screen or button | Code | Test |
|---|---|---|---|
| The rule book passes a structure check before it is used | HQ seat: "Checks before it can go live" | `web/lib/pill.ts` (`checkPill`, `loadAndCheckPill`) | `web/tests/pill-check.test.ts`, "passes all structural checks (checkPill returns no errors)" |
| Causes ranked in 4 steps from the rule book and past cases, each with its reason | Technician: "Likely causes, best bet first" | `web/lib/rank.ts` (`rankLeads`), `web/lib/leads.ts` | `web/tests/c2d.test.ts`, "two calls with the same input are deep-equal" |
| A solved job is saved as a case | HQ: "Approve and send to all buildings" saves job 2318's case | `web/lib/hq-flow.ts`, `web/lib/cases.ts` | `web/tests/c10a-review.test.ts`, "a solved job is saved as a case: HQ's Approve saves 2318's" |
| One approved fix changes the next job in another building | Building B card: its first cause turns to the thermostat check | `web/lib/hq-flow.ts`, `web/lib/hq-desk.ts` (`buildingBView`) | `web/tests/c8b.test.ts`, "with the draft sent to HQ and its tests passed, 2401's first lead is precool; after Approve it is thermostat-spot, and both buildings are on 1.1" |
| Only fixes that held count as wins | Every ranked reason | `web/lib/outcome.ts` | `web/tests/c2c.test.ts`, "same case is won at 2026-11-06" |

### 4. How would an Asset Operations Manager use and supervise it, check its recommendations, and know when a human must step in?

The AOM has a seat of their own: `/seat/aom-tower-a`. On screen the seat reads "Asset Operations Manager" everywhere
(`web/lib/plain-words.ts`, `AOM_NAME`), and its chat heading reads "Asset Operations Manager, Tower A: Keppel
(role-played)". The chips "What needs me" and "Impact" answer in code.

- **Use:** "What needs me" lists any charge waiting on the AOM. The impact meter shows what the repeat calls cost.
- **Supervise:** the AOM sees every safety alert in Tower A and every stop open now, the live rule book version and who
  signed it (read only), and the impact record from every "Not solved" job, with its cost.
- **Check recommendations:** before a fix that touches the tenant's fit-out reaches the tenant, the AOM reads, word for
  word, what the tenant will hear and the pill rule behind it (TS-CC-11). The tenant hears nothing until the AOM
  decides.
- **Know when to step in:** a charge is the AOM's call alone (A4): "Tenant pays" (a whole number from 1 to 100000),
  "Landlord pays" or "Goodwill, no charge", each with a reason of 3 words or more. Red stops alert the AOM and always
  say who to call. The pill's guardrails name the AOM for any cost and for work inside the tenant's space.

| What | Seat, screen or button | Code | Test |
|---|---|---|---|
| Only the AOM decides a charge | AOM seat: "Decide charge" | `web/lib/permissions.ts` (`decide-charge`), `web/lib/charge-flow.ts` | `web/tests/c9.test.ts`, "every other seat is refused, and nothing changes" |
| The AOM sees the request word for word, with no amount, as soon as HQ approves | AOM seat: the charge card, "Waits on you" | `web/lib/hq-flow.ts` (`approvalChargeText`), `web/lib/aom-desk.ts` | `web/tests/c8b.test.ts`, "no request with the draft sent to HQ; after Approve the AOM's chat gets it, word for word" |
| The tenant hears nothing before the AOM decides | Tenant seat | `web/lib/charge-flow.ts` | `web/tests/c9.test.ts`, "nothing reaches the tenant before the decision: no solution, no amount" |
| Code, not the AI, writes the tenant's card, and the AI never sees the amount | Tenant seat after "Decide charge" | `web/lib/charge-flow.ts` | `web/tests/c9.test.ts`, "the AI never sees the amount: no prompt made after the decision holds it" |
| Safety alerts and open stops for the AOM's building | AOM seat: "Safety alerts, Tower A" | `web/lib/aom-desk.ts`, `web/lib/safety.ts` | `web/tests/c9.test.ts`, "safety alerts for Tower A: a red stop raised on Tower A Level 23 shows as an alert and as open now" |
| The live version, read only | AOM seat: "Live in Tower A" | `web/lib/aom-desk.ts`, `web/lib/versions.ts` | `web/tests/c9.test.ts`, "the live version in Tower A, read only: v1.0 with A1's line, then v1.1 after HQ approves" |
| The cost of a job that was not solved | AOM seat: "Impact records from Not solved" | `web/lib/aom-desk.ts`, `web/lib/impact-rates.ts` | `web/tests/c9.test.ts`, "the Not solved impact record reaches the AOM with its cost (S3), in the desk and not as a chat message" |

When a person must step in, beyond the AOM: the senior manager is told once when the top cause has fewer than 3 similar
past cases, and a "Not solved" job reaches the senior manager with everything attached.

| What | Seat, screen or button | Code | Test |
|---|---|---|---|
| Low confidence goes to the senior manager, once | Senior manager's chat | `web/lib/technician-flow.ts` (`postLowConfidenceNotice`), `web/lib/rank.ts` | `web/tests/c7b.test.ts`, "after the second Not this on 2318, once; clearing and ticking again adds none" |
| Nothing is asked twice after it goes up | Senior manager's desk | `web/lib/senior-manager-desk.ts` | `web/tests/c8a.test.ts`, "nothing is asked again: no question card or answer button reaches the senior manager's seat" |

### 5. Why is it more than a chatbot or a search tool?

- **Only buttons change anything.** Typed words never change a status, a tick, a version, a case or a stop. Every
  button press is checked on the server against one table of who may press what.
- **Code decides.** Ranking, routing, locks, colours, the repeat flag, the never-list and versions are plain TypeScript
  in `web/lib/`. The ranking code does not import the AI code.
- **The AI words, and suggests only from a menu.** Tencent Hunyuan writes the reason under a ranked cause, a tenant
  reply built from approved tips, and the draft text of a new rule. For a new rule it also suggests when the rule
  applies and what it changes, picked only from a fixed code menu, and the senior manager confirms each part. Switch
  the AI off and every card, rank and number stays the same.
- **Safety is fixed text.** A red stop shows the pill's own words, says who to call, and makes 0 AI calls.
- **Guarded words.** Every AI answer passes a never-list scanner (no prices, no free offers, no admission of fault, no
  other tenant's data, no writing to building systems). The reason under a cause and the tenant reply also pass a
  wording check; a new rule's suggestion must instead fit the fixed code menu. If a check fails, the AI answer is
  dropped and the code's text (for a new rule, the senior manager's own fix line) shows instead.

| What | Seat, screen or button | Code | Test |
|---|---|---|---|
| The whole demo gives the same cards with the AI off | The AI switch: Live, Saved answers, Off | `web/lib/seat-view.ts` (`forMode`), `web/lib/ai-mode.ts` | `web/tests/demo-flow.test.ts`, "runs every step in the T-C10b order, and AI off gives the same cards" |
| The same, against a run that really shows AI lines | Every seat | `web/lib/ai-core.ts` | `web/tests/c10b-review.test.ts`, "the Replay run shows the AI line and banner on every desk, and every seat's whole view equals Off, step by step" |
| A wrong seat is refused, and the refusal names who may | Any button pressed from the wrong seat | `web/lib/permissions.ts` (`mayPress`), `web/lib/actions.ts` (`runAction`) | `web/tests/c4.test.ts`, "the AOM cannot press approve-solution" |
| Typing never changes anything | Any chat box | `web/lib/chat-turn.ts`, `web/lib/chat.ts` | `web/tests/c8b.test.ts`, "typed approve and rollback words on the HQ seat change no status, version or solution" |
| Ranking is code only | Technician: "Likely causes, best bet first" | `web/lib/rank.ts` | `web/tests/c2d.test.ts`, "rank.ts does not import from ai.ts or ai-core.ts" |
| The AI never changes an order or a reason | Technician's ranked causes | `web/lib/technician-desk.ts` | `web/tests/c7b.test.ts`, "the AI never changes an order or a reason: the leads equal the code's on every switch position" |
| Red stops are never worded by the AI | The red stop card, the "Safety" list | `web/lib/safety.ts` | `web/tests/c6a.test.ts`, "RS-04, the RS-08 card, the TS-CC-06 refusal and the Safety list keep AI calls 0 with a fake client on" |
| The never-list catches a request to write to the building system | Any chat box | `web/lib/never-list.ts` (`scanNeverList`) | `web/tests/c3b.test.ts`, "\"push the setpoint to the BMS\" triggers never-write-bms" (BMS is the building management system) |
| An AI answer that fails its checks is never shown | Any worded card | `web/lib/ai-core.ts`, `web/lib/wording-check.ts` | `web/tests/c6a.test.ts`, "a model answer that fails its checks falls through and is never shown" |
| 20 golden tests check the rule book's answers | None (run by the test suite) | `web/tests/golden/golden-tests.test.ts` | `web/tests/golden/golden-tests.test.ts`, "AI writing to BMS triggers the never-list and a red stop" (golden test GT-05) |

### 6. How are feedback, outcome data and new expertise reviewed, validated, versioned and approved after deployment?

In order, as the demo runs it:

1. **Outcome:** a fix counts as a win only after 30 days with no repeat call at the same spot. A repeat inside 30 days
   counts against that fix.
2. **Review:** the person who fixed it cannot confirm the cause: their own "Confirm cause" is refused. Another seat
   can press it, and HQ's approval of a new rule confirms that job's cause. Not built yet: the spec says a fix should
   not count as a win until a second person confirms it, but in the code a fix that nobody confirms still becomes a
   win after 30 days (`web/lib/outcome.ts` marks a case "unconfirmed" only when the fixer confirmed it).
3. **New know-how:** the senior manager logs a new solution and confirms each part. The menu is fixed in code: nothing
   may touch a red stop or lower a step's colour.
4. **Validation:** "Run tests" runs the structure check, checks the 10 red stops are word for word the same as v1.0,
   runs golden cases GT-01 to GT-22, and runs R-01, a check that the new rule's chosen check really comes first on
   every open job it applies to. On the demo draft: 23 passed, 0 failed, 2 not applicable.
5. **Sent on the exact draft:** "Send to HQ" works only with a passing run on that exact draft. Any change clears the run.
6. **Approval (A2):** HQ's "Approve and send to all buildings" checks every gate again on the server, signs the version
   once into a file that is never written again, and moves every building to it. "Decline" needs a reason and sends
   the job back.
7. **Versions and rollback:** versions are listed like commits (hash, who approved, parent, why). "Roll back" moves the
   live pointer back. It deletes nothing.

| What | Seat, screen or button | Code | Test |
|---|---|---|---|
| The 30-day rule | Every case and every ranked reason | `web/lib/outcome.ts` (`outcomeOf`) | `web/tests/c2c.test.ts`, "2301 ticket case is failed (repeat 2305 at same spot)" |
| The fixer cannot confirm their own cause | Technician, senior manager or HQ: "Confirm cause" | `web/lib/actions.ts` (`confirmCause`) | `web/tests/c4.test.ts`, "is refused for the seat that fixed it" |
| A cause confirmed only by the fixer scores 0 | Ranking | `web/lib/outcome.ts` | `web/tests/c2c.test.ts`, "fixedBy == confirmedBy is unconfirmed, 0 points" |
| The fixed menu refuses anything near a red stop | Senior manager: "Confirm" on each part | `web/lib/conditions.ts` | `web/tests/c3c.test.ts`, "refuses anything touching a red stop" |
| Run tests on the demo draft | Senior manager: "Run tests" | `web/lib/draft-tests.ts` (`runDraftTests`), `web/lib/golden-cases.ts` | `web/tests/c8a.test.ts`, "Run tests on the demo draft: 23 passed, 0 failed, 2 not applicable, on the draft's hash" |
| A changed draft must be tested again | Senior manager: "Confirm", then "Send to HQ" | `web/lib/actions.ts` (`sendToHqRefusal`) | `web/tests/c8a.test.ts`, "a confirm that changes the draft clears the run, and Send to HQ is refused again" |
| HQ cannot approve a draft that changed after its tests | HQ: "Approve and send to all buildings" | `web/lib/hq-flow.ts` (`approveRefusal`) | `web/tests/c8b.test.ts`, "refused with \"draft changed since the tests\" when the run saw an earlier draft" |
| The signed version never changes | HQ: "Versions, newest first" | `web/lib/hq-flow.ts`, `web/lib/versions.ts` | `web/tests/c8b.test.ts`, "the signed file is frozen: its bytes never change after a later action" |
| Versions like commits | HQ: "Versions, newest first" and the "Versions" chip | `web/lib/versions.ts` (`versionList`) | `web/tests/c8b.test.ts`, "after Approve: v1.1 first, with its hash, who approved it and when, its parent and its why line" |
| Roll back deletes nothing | HQ: "Roll back" | `web/lib/hq-flow.ts` (`applyRollback`) | `web/tests/c8b.test.ts`, "both buildings back to 1.0, 2401's first lead precool again, v1.1 kept as rolled back, nothing deleted" |
| Decline sends it back with a reason | HQ: "Decline", "Decline with this reason" | `web/lib/hq-flow.ts` (`applyDecline`) | `web/tests/c8b.test.ts`, "with a reason, the job goes back to escalated, no version moves, and the senior manager sees why" |

### 7. How could it extend from one asset or domain to many assets, business units or the whole enterprise?

- **Assets:** a building is one row in `web/data/buildings.json`, and a spot is a building plus a floor. The same rule
  book and the same ranking code run on any of them. Each job ranks with its own building's live version.
- **All at once:** one HQ approval moves every building to the new version. There is no per-building accept. Rollback
  moves every building back.
- **Proof in the demo:** Building B (a different building, tenant and floor) is a card that shows its live version and
  how its own open job (2401) ranks. After HQ approves, its first cause changes.
- **Domains:** pills are loaded by id and version (`loadPill(pillId, version)` in `web/lib/pill.ts`), from
  `web/pills/<pill id>/`. A new area, such as Energy Optimisation or Tenant Experience, would be a new pill folder.

What is not built yet: only one pill exists (TS-CC, Technical Services), only Tower A has an AOM seat, and there are no
per-building local rules, real logins, or links to real building or helpdesk systems.

| What | Seat, screen or button | Code | Test |
|---|---|---|---|
| One approval moves every building | HQ: "Approve and send to all buildings" | `web/lib/hq-flow.ts` (the loop over `liveVersionByBuilding`) | `web/tests/c8b.test.ts`, "every building moves at once: one Approve and no per-building accept" |
| Each job ranks with its own building's version | Technician and the Building B card | `web/lib/leads.ts` (`leadsForJob`) | `web/tests/c5b.test.ts`, "is Building B's own spot and its own live version" |
| A spot is a building plus a floor | Every job | `web/lib/places.ts` (`spotKey`) | `web/tests/c2b.test.ts`, "spotKey(2401) is building-b/12" |
| A call in one building never counts against another | Ranking and the 30-day rule | `web/lib/outcome.ts`, `web/lib/cases.ts` | `web/tests/c2c.test.ts`, "a building-b/12 call does not become nextCallAt for a tower-a/23 case" |
| Building B's own safety alerts go to its own card | The Building B card | `web/lib/permissions.ts` (`alertSeatFor`) | `web/tests/building-b-alerts.test.ts`, "a stop raised on 2401 shows on the Building B card" |
| The code is not tied to one rule or one version | None (code level) | `web/lib/conditions.ts`, `web/lib/rule-engine.ts` | `web/tests/c3c.test.ts`, "nothing keys on TS-CC-27 or 1.1: the same rule as TS-CC-31 in v2.4 blocks with TS-CC-31" |

### 8. What is a credible path to build it with current or near-term technology?

It runs today on common, current tools:

- One Next.js 16 app with React 19, in TypeScript (`web/package.json`).
- The rule book is a plain YAML file kept in Git. Approved versions are signed into their own files.
- The AI is Tencent Hunyuan through Tencent Cloud TokenHub, called with a standard OpenAI-compatible client, on the
  server only (`web/lib/ai.ts` is server-only; `web/lib/ai-core.ts` holds the client). The 3 prompts are in
  `web/prompts/`: `rank-wording.md`, `tenant-reply.md`, `new-solution.md`.
- "Saved answers" mode (Replay) uses 16 real Hunyuan answers saved in `web/data/replay/`, so the demo runs with no key
  and no network. 14 of them passed their checks and can be shown; the 2 that failed never show. With an empty key or base address, the app falls back to Replay by itself.
- Tests: the build log row for the last code change (16 Oct, the D4 review fixes) records 1188 passed and 12 to-do,
  61 test files passed and 1 skipped, run with `npx vitest run --maxWorkers=4 --minWorkers=1` in `web/`. Some earlier
  runs on Windows hit a known file-lock error when a test renamed a temp file; each test that hit it passed when run
  alone (`proof/BUILD-LOG.md`). `web/tests/demo-flow.test.ts` runs the whole demo through
  the same functions the buttons call and prints "demo flow: all steps passed".
- The next step is a one-building pilot (the `/how` page's answer to this question).

Known limits, from `README.md`: 2 of the 16 saved answers failed their checks when recorded, so the app shows the
code's words there. On Live, the model usually gives no answer inside the app's limits (600 tokens, 8 seconds), and
the code's words show.

| What | Seat, screen or button | Code | Test |
|---|---|---|---|
| Tests run with no key and no network | None (test setup) | `web/tests/setup.ts` | `web/tests/ai-setup.test.ts`, "a network call throws 'network blocked in tests'" |
| Replay never calls the model | AI switch: "Saved answers" | `web/lib/ai-core.ts` | `web/tests/c6a.test.ts`, "Replay never calls the model, even with a key" |
| No key means no call | AI switch: "Live" with no key | `web/lib/ai-core.ts` | `web/tests/c6a.test.ts`, "an empty key turns replay on by itself: the model is never called" |
| No secret is saved with the answers | `web/data/replay/` | `web/scripts/ai-record.ts` | `web/tests/c6b-replay.test.ts`, "no saved file holds \"LLM_\", \"Authorization\" or \"http\"" |
| The key goes only to a set base address | AI switch: "Live" | `web/lib/ai-core.ts` | `web/tests/c10b-review.test.ts`, "a key with an empty LLM_BASE_URL makes no call on Live, even with a client at hand: the tips show" |
| The whole demo, start to end | `/how`, the 6 demo steps | `web/lib/action-turn.ts`, `web/lib/chat-turn.ts` | `web/tests/demo-flow.test.ts`, "runs every step in the T-C10b order, and AI off gives the same cards" |

## The demo, step by step, and which question each step answers

The order is the one `web/tests/demo-flow.test.ts` runs and `/how` lists (`web/lib/how.ts`, `demoSteps`).

| Step | Seat and button | Answers |
|---|---|---|
| 1 | Any seat: "Reset demo". Every chat starts again from the made-up seed. | |
| 2 | Tenant: "Report a problem", "Too cold", then the answers. They join job 2318 and a visit is booked. | 2, 3 |
| 3 | Technician: "Open job" on 2318, "Not this" twice, then "Not solved" with the hours lost and extra visits, then "Send to the senior manager". | 1, 2, 5 |
| 4 | Senior manager: "Found it" on the thermostat cause, "Log new solution", "Confirm" each part, "Run tests", "Send to HQ". | 2, 6 |
| 5 | HQ: "Approve and send to all buildings". Every building goes live on v1.1, and the Building B card puts the thermostat check first. | 3, 6, 7 |
| 6 | AOM: "Decide charge". The tenant's chat then gets the card. | 4 |
| Also | Typed "water dripping near the lights" shows the red stop and locks nothing; "Raise this stop" locks the floor. | 4, 5 |
| Also | The AI switch on Off: the same cards. | 5, 8 |

Story mode at `/demo` presses the same buttons in the same order, through the same routes every seat uses, and ends
with the safety stop: 8 steps in about 2 minutes, on Saved answers. Nothing is pre-recorded, and a test checks every
number in its captions against the app's own state after each step:
`web/tests/d2-story.test.ts`, "presses demo-flow's presses in its order, and each step's state and caption check out".
`/flow` draws the same path, and a test checks every button name on it against the app's real buttons:
`web/tests/d4-flow.test.tsx`, "checks every button name the page draws".

## What changed from the first map

The first version of this page (6 Oct) mapped an earlier design. These parts no longer hold:

- **The /tech and /engineer screens are gone.** Both addresses now redirect: `/tech` to `/seat/technician`, `/engineer`
  to `/seat/senior-manager` (`web/app/tech/page.tsx`, `web/app/engineer/page.tsx`).
  Test: `web/tests/c5b.test.ts`, "the 4 old routes still redirect to their seats".
- **No transcript capture tab.** Capture now happens in the work itself: "Mark solved", "Not solved" and "Log new
  solution".
- **The AOM no longer approves every card.** The old "Needs your decision" screen with approve, send back or escalate is
  gone. HQ approves new solutions (A2); the AOM decides charges (A4).
- **Building B no longer accepts or says "not here".** One HQ approval moves every building at once.
- **No site layer per building and no 80 percent counter.** Neither is in the code.
- **"Attended is not Fixed" is now the 30-day rule,** and the chief engineer's tick is now the senior manager confirming
  each part and running the tests.

Still true from the first map: the problem write-up in `docs/problem/problem-statement.md`; the know-how pack in
`docs/knowhow/`; the contributor stored as a role, not a name; rule matching, step order, colours, the repeat flag,
the never-list and version states as plain TypeScript in `web/lib/`; green, amber and red steps with named approvers in
the pill; golden tests; versions with rollback; one Next.js app in TypeScript, pills as YAML, Hunyuan through TokenHub
on the server only, and Replay for offline demos.

Other files in this folder: `overview.md` is the one-page overview written on 6 Oct, before the app was built. Its six
steps describe the first plan, so read `/how` for the app as it is. The diagram is the app's own `/flow` page, "How a
job flows", plus the text picture above. Not written: `architecture.md` and an exported diagram image.

## Who built it

Row by row from `proof/BUILD-LOG.md`, where each build step has a code (C for the core build, D for the four
finishing parts). On 5 Oct, before any code, Claude Code prepared a planning kit that held the know-how pack
(`docs/knowhow/`). Tencent CodeBuddy built the first parts: the pill file (made from that pack) and its checker, the
rule engine and golden tests (6 Oct), then steps C1 to C3a (10 and 11 Oct: the AI connection, place tags and facts,
the cause list, the case library and the 30-day rule, the 4-step ranking, and the safety stops). It also wrote most of
step C3b, the never-list scanner, but that run was left uncommitted with one failing test. CodeBuddy's credit ran out
on 14 Oct, and Anthropic's Claude Code built the rest. It finished C3b (it connected one word list CodeBuddy had
written but not used, and left the rest as CodeBuddy wrote it), then built C3c (how a new solution becomes a rule)
and C4 to C10b (the seats, the AI layer, HQ approval and rollback, the AOM seat and `/how`), then D1 to D4 (plain
words on every screen; Story mode at `/demo`; the dark glass look with Bolt Pip; the final seat names, the `/flow`
page and the video player), with the fixes after each review.
