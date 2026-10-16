# Submission checklist

Form: https://tinyurl.com/TCHackathonSGProjectSubmission. Deadline Fri 16 Oct 2026 (the exact cutoff time is still to
be checked). What each item needs: `docs/challenge/submission-rules.md`.

This file is the form's checklist plus the text to paste. Each field below has a **Paste** block, ready to copy into
the form, and a **For YY** note that does not get pasted. Written 16 Oct 2026 against `main` at `4b44bdc` ("fix:
review findings for D4"), with D1 to D4 shipped. Every number and claim in the Paste blocks was checked line by line
against the repo; the check log sits with the staging copy of this file, outside the repo. A review the same day found
13 points; the fixes are in `proof/BUILD-LOG.md`, newest row.

| # | Item | Required? | Status | Draft or file |
|---|---|---|---|---|
| 1 | Project title | Required | ready | below, field 1 |
| 2 | Short blurb (**under 10 words**) | Required | ready (9 words) | below, field 2 |
| 3 | Project description (4 parts below) | Required | ready | below, 3.1 to 3.4 |
| 4 | CodeBuddy chat history: 3+ screenshots or a recording | Required | ready: 4 screenshots, plus the text below | `proof/screenshots/codebuddy-01` to `-04` |
| 5 | Cover image, 16:9, about 380 x 216 px | Required | ready | `submission/assets/cover.png` (380 x 216); `submission/assets/cover@2x.png` (760 x 432) |
| 6 | Solution diagram answering Keppel's 8 questions | Required for this track | ready | below, field 6; `docs/solution/README.md`; the app's `/how` and `/flow` |
| 7 | Live demo walkthrough | Required for this track | ready | below, field 7 |
| 8 | Demo video, 5 to 8 min | Optional in the form, **required for us** | ready: 6 min 12 s, live | https://eternal-wreath-5ceq.here.now/ |
| 9 | Project link (live URL, earns bonus points) | Optional | ready: live | http://43.160.222.54 |
| 10 | GitHub repo link (this repo) | Required for this track | private until submission | https://github.com/yanyiooi-ux/keppel-ai-harvest |

## Form pack

| # | Form field | Paste text in this file | File to upload |
|---|---|---|---|
| 1 | Project title | "1. Project title" | none |
| 2 | Short blurb | "2. Short blurb" | none |
| 3 | Project description | "3. Project description": 3.1, 3.2, 3.3 and 3.4, one block per part | none |
| 4 | CodeBuddy chat history | "4. CodeBuddy chat history", if the form has a text box | `proof/screenshots/codebuddy-01-loop-run-p1-p2.png`, `proof/screenshots/codebuddy-02-neon-quest-redesign-prompt.png`, `proof/screenshots/codebuddy-03-pip-fix-list.png`, `proof/screenshots/codebuddy-04-c0-c1a-plan.png` |
| 5 | Cover image | none | `submission/assets/cover.png`; `submission/assets/cover@2x.png` only if the form wants a bigger file |
| 6 | Solution diagram | "6. Solution diagram" | none; if the form asks for a link, `docs/solution/README.md` on GitHub |
| 7 | Live demo walkthrough | "7. Live demo walkthrough" | none |
| 8 | Demo video | "8. Demo video" | none: the film is a link |
| 9 | Project link | "9. Project link" | none |
| 10 | GitHub link | "10. GitHub link" | none |

The staging copy of this file keeps the same uploads together in one `uploads` folder for the person filling in the
form.

### Still open, and only these

1. **Done, 16 Oct:** fields 7 and 9 hold the live server, http://43.160.222.54 (Tencent Cloud Lighthouse,
   Singapore, saved AI answers only, no AI key on the server). Checked from outside: 12 pages at desktop and phone
   width, and the film plays on the home page.
2. **Field 10:** the repo is still private. After the orchestrator pushes `main` (with its secret scans), YY makes the
   repo public on GitHub.
3. **Sending the form:** YY's team fills it in from this file and the uploads.
4. **Today's cutoff time:** our notes give the date, Fri 16 Oct 2026, but no time
   (`docs/challenge/submission-rules.md`). YY to check it.
5. **Done, 16 Oct:** the film plays near the top of the home page only (YY moved it there; `/how` and `/flow` have
   no player). The server has the film file.
6. **Done, 16 Oct:** `README.md`'s Key dates line and its `docs/solution/` line now match the app as built.
7. **`docs/solution/overview.md`:** the 6 Oct overview still describes the first plan (a "Building manager" role, six
   steps) and has no out-of-date note at its top; only `docs/solution/README.md` warns about it. YY to decide: add one
   line at its top saying it is the first plan and `/how` is current, or leave it.

---

## 1. Project title

**Paste:**

```text
Pill Desk
```

**For YY:** nothing open. The app's top bar now reads just "Pill Desk", with no tag after it
(`web/app/components/TopBar.tsx` line 43, D4).

---

## 2. Short blurb (under 10 words)

**Paste:**

```text
Turns engineers' fixes into approved know-how every building reuses.
```

Word count: Turns (1) engineers' (2) fixes (3) into (4) approved (5) know-how (6) every (7) building (8)
reuses (9). **9 words.**

Backups, also 9 words each:
- "One engineer's fix, approved once, live in every building." (One, engineer's, fix, approved, once, live, in,
  every, building)
- "Catches repeat complaints early and shares each approved fix." (Catches, repeat, complaints, early, and, shares,
  each, approved, fix)

**For YY:** nothing open.

---

## 3. Project description

### 3.1 Overview: target scenarios, users, value

**Paste:**

```text
Pill Desk is our answer to Keppel's "AI HARVEST" challenge, in the Technical Services area. It turns what a chief engineer learns on one job into an approved rule that every building uses next time.

The scenario is a repeat comfort complaint on an office floor. On our made-up Tower A, Level 23 has called 5 times in 21 days: too cold near the lift core in the mornings, too hot in the west glass boardroom in the afternoons. The first 4 calls were each closed with a turn of the thermostat dial, and each time the problem came back. The 5th call is still open.

Five people share one memory. Each has a chat with Pip, the desk's helper, plus buttons for only what that person may do:
- Tenant: reports the problem, answers a safety question first, then 4 hands-off questions. Some problems end here with an approved tip and no visit.
- Technician: opens the job with the checklist already filled in: the calls at this spot in the last 30 days, the repeat flag, past fixes and whether they held, the tenant's renovation (fit-out) and the tenant's answers. The likely causes come ranked, each with its reason. "Found it" and "Not this" re-rank the list straight away.
- Senior manager (the facilities management (FM) contractor's chief engineer): gets the escalated job with everything attached, so nothing is asked twice, and turns a real fix into a new rule with tests.
- Head office (HQ), owner of the rule book: approves a new rule only after its tests pass. It then goes live in every building at once, and can be rolled back.
- Asset Operations Manager (AOM): sees what the repeat calls cost, decides any charge to the tenant, and gets every safety alert for the building.

Three ways to see it in the app. Story mode at /demo: the real app plays the whole demo by itself in 8 steps, in about 2 minutes, one seat at a time, with a short caption for each step. /flow, "How a job flows": one page with every button in order and who is told next. /how: the page for judges, with the five real chats side by side. The app has a dark look with frosted glass panels, and Pip is drawn as a small robot in a yellow hard hat.

The value: the team fixes the cause sooner, so the same spot stops calling. What one engineer learns reaches every building instead of leaving with them.

All buildings, people, tickets and amounts are made up for the demo. Every seat is role-played, with no login.
```

### 3.2 Real-world insight: where the pain comes from, who has it, the core problem

**Paste:**

```text
Where the pain comes from. In office towers, comfort complaints are handled one ticket at a time. Each ticket closes on time, so the response numbers look good, but nobody finds the cause. In our demo story, the tenant's fit-out eight months ago split the floor into glass rooms. Since then the core thermostat reads about 1.5 deg C warmer than the desks, so it keeps sending cold air. A technician turns the dial up. The next call says too hot, and the next technician turns it down. Staff start bringing personal heaters, which many buildings do not allow. This is common: in a 2009 survey by the International Facility Management Association (IFMA, US-based), "too cold" (94 percent) and "too hot" (91 percent) were the two most common air-con complaints.

Who has it. Tenant staff feel it. The FM contractor's technicians and chief engineer must fix it. The AOM carries the cost and the tenant relationship.

Why the know-how leaks away. The people who know a building's quirks are the FM contractor's chief engineer and senior technicians. Their contracts often run 3 to 6 years (Singapore's Building and Construction Authority (BCA) guide on FM procurement describes 3 plus 3 year terms). When the contract changes, the quirks leave with them. The work order system records what happened far better than why.

The core problem is not a missing answer. Hard-won judgement is never written down in a form the next person, or the next building, can use, and nobody checks whether a fix actually held.
```

### 3.3 Solution design: business and technical architecture, and how prompts drive the AI

**Paste:**

```text
BUSINESS ARCHITECTURE
- The rule book for one recurring problem is called a pill. It is one plain-text file (YAML) with a version number. Ours, TS-CC (repeat comfort complaints), version 1.0, holds 26 rules, a 31-step checklist, 10 safety stops, 4 "never" items, 5 guardrails, 8 approved tenant tips and 20 golden tests (fixed test cases with known right answers).
- Where the know-how comes from. Version 1.0 was built from 144 research items, drawn from 79 public web pages on 51 sites (practitioner forums among them) and each checked against its source, plus the team's own decisions. Each of the 26 rules is labelled with where it came from: 5 public source, 6 team decision, 2 corrections from a review that role-played a chief engineer, and 13 a mix. No real Keppel expert has been interviewed yet, so the expert who signs it is role-played. Inside the app, new know-how comes from the senior manager: when they solve an escalated job, their fix line and why line become a draft rule.
- People approve at exactly four moments. A1 is version 1 of the rule book, signed before the demo by two senior experts (role-played): the app shows it as already signed, with no button. The other three are buttons in the app: A2, a new rule (HQ, only after its tests pass on that exact draft); A3, outside help or money (HQ); A4, charging the tenant (AOM). Using a fix the rule book already holds needs no approval. Safety stops are stops, not approvals. No other approval happens inside the app. The rule book's amber steps also name whose yes a step needs (for example the FM chief engineer, or the tenant plus the AOM); the app shows that name on the step, and that yes happens outside the app.
- A fix counts as a win only after 30 days with no repeat call at the same spot. Someone other than the fixer confirms the cause: the fixer's own "Confirm cause" is refused, and HQ's approval of a new rule confirms that job's cause. Not built yet: a fix that nobody confirms still counts as a win after 30 days, although our spec says it should wait for a second person.
- Versions work like code commits: each records its parent, a short fingerprint, who approved it and when. Rollback puts every building back on the parent version and deletes nothing.

TECHNICAL ARCHITECTURE
- One Next.js web app in TypeScript. Plain code decides everything that counts: every rank, status, lock, colour word, number and hand-off. Only button presses change anything. Typing only brings up cards and safety alerts.
- Ranking runs in 4 steps: (a) remove causes that cannot apply, and say why; (b) match this job's facts against a library of past cases, and whether each fix held for 30 days; (c) order by that evidence, with the quicker check first on a close call; (d) explain each cause in a fixed sentence, and say "low confidence" when there are fewer than 3 similar cases. A low-confidence top cause alerts the senior manager.
- All five seats read and write one shared memory. Every button press is checked on the server against one permissions table, so no seat can press what it is not allowed to.
- Safety: 10 safety stops, always in the rule book's own words, with who to call, and 0 AI calls. Most stops, raised with the Safety button, lock work on that floor until the senior manager clears them. Typed alarm words show the stop and alert people, but lock nothing.
- Story mode at /demo drives the real app: it presses the same buttons, in the same order, as our whole-demo test, through the same routes every seat uses, and nothing is pre-recorded. A test checks every number in its captions against the app's own state after each step. On /flow, a test checks every button name against the app's real buttons.

HOW PROMPTS DRIVE THE AI
- The AI is Tencent Hunyuan (model hy3) through Tencent Cloud TokenHub. It has 3 jobs, each with its own prompt file that judges can read in web/prompts/: rank-wording.md says one ranked cause's reason in plainer words; tenant-reply.md drafts the tenant's reply from approved tips only; new-solution.md drafts the rule text from the senior manager's typed fix, and suggests when the rule applies and what it changes, picked only from a fixed menu in code.
- The AI never ranks, never sees a safety card, and never sees or writes an amount. The senior manager confirms each part of an AI-drafted rule with its own button, and code refuses anything off the menu.
- Every AI answer is scanned before anyone sees it: no prices or free offers, no admission of fault, no other tenant's details, no writing to the building management system (BMS). Worded lines also pass a wording check: at most 2 sentences for a cause's reason and 3 for a tenant reply, every number must already be in the code's own text, and no risky action words. If a check fails, the code's own words show instead.
- An AI switch in the top bar has 3 positions: Live (a new Hunyuan call), Saved answers (16 real Hunyuan answers recorded on 15 Oct, no new call) and Off (the code's words only). Hunyuan thinks before it answers, so on Live it usually gives no answer inside the app's limit of 600 tokens and 8 seconds, and the code's own words show. The demo therefore runs on Saved answers, and Story mode moves the switch there by itself. 14 of the 16 saved answers passed their checks; the 2 that failed are never shown.
```

### 3.4 Business value: numbers or clearly defined impact

**Paste:**

```text
Only numbers we can back. Unless marked, they are worked out by the app's own code on made-up demo data.

- Repeat calls are caught early. The repeat flag turns on at the 2nd complaint from the same floor and tenant within 30 days, or when the dial was turned both up and down on that floor within 30 days. Quick dial turns are then off for that spot, and the senior manager gets a "speak first" alert to find the cause before the tenant calls again.
- What it would have saved on Level 23. The AOM's impact meter replays the made-up tickets at made-up rates (S$60 an hour, 2 hours a visit, 3 hours a senior check). As it happened: 5 calls, 5 visits, 4 repeat calls, not fixed after 21 days, S$600 and counting. With Pill Desk, caught at the 2nd call: 2 calls, 2 visits, 1 senior check, 1 repeat call, 4 days, S$420. The meter says plainly that it assumes the cause is found on the visit where the repeat is caught.
- Nothing is asked twice. An escalated job carries the filled checklist, every tick with who made it, and the impact record (hours lost, extra visits, cost).
- A fix counts only when it holds: 30 days with no repeat at the spot, and the person who fixed it cannot confirm the cause. "Attended" stops being reported as "fixed".
- One fix reaches every building. In the demo, HQ's single approval moves both buildings to version 1.1, and Building B's own open cold-morning ticket now puts "Thermostat in the wrong spot after a fit-out" first, with no extra work in Building B.
- Some calls need no visit. When the tenant's answers match an approved tip (the blinds are up in the hot west boardroom, or the call is after air-con hours), the tenant gets the tip and no visit is booked. Any after-hours cost waits for the AOM's decision.
- Energy (public figure, not our measurement): Singapore's Go 25 movement cites a Ngee Ann Polytechnic study that found up to 12 percent energy savings for each degree raised from 23 to 25 deg C in offices. That is a whole office kept warmer, not one dial turn, so we claim no energy saving for the demo. The rule book uses the figure to show that a colder floor has a cost: a tenant's request to run a floor colder than the building's set temperature goes to the Asset Operations Manager (rule TS-CC-25).
- Built to be trusted: 1,188 automated tests passed on 16 Oct (plus 12 marked to-do), run with "npx vitest run --maxWorkers=4 --minWorkers=1". Some earlier runs on Windows hit a file-lock error when a test renamed a temp file; each test that hit it passed when run alone. One test runs the whole demo end to end with the network blocked. A new rule must pass its tests on the exact draft before HQ can approve it (in the demo: 23 passed, 0 failed, 2 not applicable).
- Estimate, not measured: on a real portfolio, each repeat spot would save roughly the visits between its 2nd call and the call that finally finds the cause. We have no real portfolio data to size this yet; a one-building pilot would.
```

**For YY:** nothing open.

---

## 4. CodeBuddy chat history (hard gate)

**Files to upload** (all 4 in `proof/screenshots/`, committed in `0e1b7af`; the form needs at least 3):

| File | What it shows (checked by eye on 15 Oct, opened again on 16 Oct) |
|---|---|
| `codebuddy-01-loop-run-p1-p2.png` (3839 x 2065) | CodeBuddy IDE, 6 Oct 2026 11:48: YY's instruction to run prompts P1 to P6 in a loop; CodeBuddy reports P1 done and starts P2, with its task list. |
| `codebuddy-02-neon-quest-redesign-prompt.png` (3832 x 2061) | YY's redesign prompt for the first look (6 Oct) and CodeBuddy reading the project files before step 1. |
| `codebuddy-03-pip-fix-list.png` (3839 x 2059) | YY's 7-item fix list after checking that redesign in the browser, and CodeBuddy's task list for the fixes (6 Oct). |
| `codebuddy-04-c0-c1a-plan.png` (3839 x 2064) | CodeBuddy finishing C0 ("C0 done. Not pushed.") with its credits and tokens shown, then planning C1a (10 Oct). |

No key, password or private chat is visible in any of the 4 (the C0 screenshot shows only that the key file exists
and is git-ignored, not its contents). Two of them show a Windows folder path; YY decided on 16 Oct that they go in
as they are.

**Paste** (if the form has a text box for the development process):

```text
Before any code, on 5 Oct 2026, we used Anthropic's Claude Code to prepare a planning kit: the plan, the wording of the build prompts, and the know-how pack the rule book is built from (144 research items with their sources, the 26 rules, the 31-step checklist, the safety stops and the golden tests). Claude also helped write the build spec.

The build started on Tencent CodeBuddy (IDE, Craft and loop modes), from 6 to 11 Oct. On 6 Oct CodeBuddy built the first version: the problem statement, the app shell, the rule book file (made from the know-how pack) and its checker, the rule engine with the repeat flag and golden tests, and first technician and AOM screens that were later replaced. On 10 and 11 Oct it built the Hunyuan connection, place tags and the repeat check, the cause list, the case library and 30-day rule, the 4-step ranking, and the safety stops. It also wrote most of the "never" scanner, but that run was left uncommitted with one failing test.

Our CodeBuddy credit ran out on 14 Oct. From then on, Claude Code finished the "never" scanner (it connected one word list CodeBuddy had written but not used) and built the rest: the shared memory and permissions, the five seat chats, the AI wording jobs and saved answers, the tenant, technician, senior manager, HQ and AOM seats, the judges' page, the whole-demo test, and four finishing parts: plain words on every screen; Story mode at /demo, where the real app plays the demo by itself; the dark glass look, with Pip as a small robot in a hard hat; and the final seat names, the "How a job flows" page at /flow and the video player. It also made the fixes after each review.

proof/BUILD-LOG.md in the repo records this row by row, each row naming the tool, with build step codes C1 to C10b and then D1 to D4 for the four finishing parts. 21 sessions were in CodeBuddy; all the others, starting with the 5 Oct planning kit, were in Claude Code. The 4 screenshots show CodeBuddy at work on 6 and 10 Oct.
```

**YY's decisions (16 Oct):** the 4 screenshots go in as they are, Windows folder path included; the wording on
CodeBuddy's credit running out and Claude Code building the rest is submitted as it is. The hard gate says "built on
CodeBuddy or WorkBuddy" (`docs/challenge/submission-rules.md` line 7); the text above says plainly which parts each
tool built.

**For YY:** nothing open.

---

## 5. Cover image

**Upload:** `submission/assets/cover.png`, 16:9, 380 x 216 px (PIL reads (380, 216)).
`submission/assets/cover@2x.png` is the same picture at 760 x 432 (PIL reads (760, 432)), for a form that wants a
bigger file. Both made 16 Oct from the cover's HTML source in the staging folder with headless Chrome (window 760 x
432, device scale 0.5 and 1), and looked at by eye at both sizes: nothing clipped, no chip touching the robot.

It shows the words "Pill Desk", the line "Building know-how, kept and shared", Bolt Pip (the app's helper: a small
glass robot with a yellow hard hat, `web/app/components/PipAvatar.tsx`) on the app's dark glass look
(`web/app/globals.css`), and five seat chips in the app's own words (`web/lib/plain-words.ts`, `SEAT_WORDS`): Tenant,
Technician, Senior manager, Head office (the app adds "(HQ)") and Asset Operations Manager.

What changed on 16 Oct: D3 shipped, so the look and mascot on the cover are now the app's own. The 5th chip said
"Asset ops manager"; it now says "Asset Operations Manager", as the app does since D4 (`AOM_NAME`). To fit it, every
chip went from 22 to 20 px and the 5th chip sits level with "Senior manager".

**For YY:** nothing open.

---

## 6. Solution diagram (Keppel's 8 questions)

**Points at:** `docs/solution/README.md` (rewritten for the app as built and checked against `4b44bdc`), the live
judges' page `/how`, which answers the same 8 questions from the running code, and `/flow`, "How a job flows", the
flow diagram inside the app.

**Paste** (the 8 answers, taken from what `/how` shows, with a line on sources added to answer 2, and answer 5
widened because the AI also suggests part of a new rule):

```text
1. What business problem? Tickets close but causes stay: Tower A Level 23 called 5 times in 21 days, and every dial turn came back.
2. Whose expertise, and how is undocumented knowledge captured? The FM contractor's chief engineer (role-played): when they solve a job that came up to them, their fix line and why line become a draft rule that is tested before it counts. Version 1.0 was built from 144 research items, checked against 79 public web pages on 51 sites, plus the team's own decisions; no real expert has been interviewed yet.
3. How does it become reusable? Every solved job is saved as a case that ranks the next job (12 made-up past cases to start), and an approved rule goes live in every building at once.
4. How does an AOM use and supervise it? The Asset Operations Manager (AOM) watches the impact meter, gets every safety alert for Tower A, sees the live version and decides every charge to a tenant (A4). A red safety stop always says who to call.
5. Why more than a chatbot or search tool? Code ranks, routes and locks, and only button presses change anything. The AI puts what code decided into words; for a new rule it also drafts the text and suggests when it applies, picked only from a fixed menu in code, and the senior manager confirms each part.
6. How is new expertise reviewed, validated, versioned and approved? A fix wins only after 30 days with no repeat. A new rule needs passing tests and HQ's approval (A2), goes out as a new version and can be rolled back.
7. How does it extend? A building is a row in the data and a spot is a building and floor, so one approved version reaches every building, as Building B shows.
8. Credible build path? It runs today: a Next.js app, Tencent Hunyuan through TokenHub for the wording, and the rule book as plain YAML in Git. The next step is a one-building pilot.
```

**For YY:** nothing open. No diagram image is needed for this field: `docs/solution/README.md`, `/how` and `/flow`
answer it.

---

## 7. Live demo walkthrough

**Paste:**

```text
Live demo: http://43.160.222.54

No login, and nothing to install. The home page plays the 6-minute film near the top. About 5 minutes:
1. Open /demo (Story mode) and let it play. The real app plays the whole demo by itself in 8 steps, about 2 minutes, one seat at a time, with a short caption for each step: a tenant reports a too-cold call; the technician opens the job and rules out two causes; the job goes up to the senior manager with everything attached; the senior manager finds the real cause and turns it into a new rule that passes its tests; head office approves it once, and Building B changes with no work there; the Asset Operations Manager decides who pays; and last, typed safety words bring up a stop in the building's own approved words, with no AI. Play, Pause, Back, Next and Restart sit in the caption panel. It runs on saved real answers from Tencent Hunyuan.
2. Open /flow, "How a job flows": every button in order, and who is told next, on one page.
3. Open /how, the page for judges: the problem, the five real chats side by side on one shared memory, Keppel's 8 questions answered in one line each.
4. To try it yourself, pick a seat in the top bar (Tenant, Technician, Senior manager, Head office (HQ), Asset Operations Manager). Reset demo starts everything over.

One demo runs for everyone: opening /demo, Restart, Back or Reset demo starts it over for anyone else watching too.
```

**For YY:** nothing open. The same server address is in fields 7 and 9. The film file is not in git; it was copied
onto the server before the app was built there, so the home page plays it.

---

## 8. Demo video

**Paste:**

```text
https://eternal-wreath-5ceq.here.now/
A 6 min 12 s one-take film of the real Pill Desk app, read by an AI narrator voice, with captions in the picture: the problem, the five seats and the fix that reaches every building. It ends with how we built it, with Tencent CodeBuddy and another AI coding assistant, and one tip.
The film was made before the final seat names: its "senior engineer" is the app's Senior manager, and its "asset manager" is the Asset Operations Manager. Its test screen shows an earlier run (1,174 passed).
```

The link is open to anyone, with no password. The same film plays inside the app, near the top of the home page
("Watch the 6-minute video"), when that copy of the app has the file; the file is not in git
(`web/public/media/README.md`).

**For YY:** the narrator is a preset AI voice, as the film's own script says (`SCRIPT.md` line 3, in the film's
project folder `Reports\tencent-ai-hackathon\story-video\pill-desk-story\`, outside the app repo), and the film's
sound is its 14 voice clips, S01 to S14. Its captions and its step 5 label still use the old seat names; a new render
would fix that, but no new recording is planned (YY, 16 Oct), so the paste text says it plainly instead. The test
screen in the film reads "Tests 1174 passed | 12 todo (1186)", the D4 run in the repo's `proof/BUILD-LOG.md`.

---

## 9. Project link

**Paste:**

```text
http://43.160.222.54
```

**Status: LIVE.** A Tencent Cloud Lighthouse server in Singapore (paid until 16 Nov 2026), on Saved answers with no AI
key on the server: if someone picks Live, the app shows the saved real Hunyuan answers by itself. The home page links to
Story mode, the flow page and the judges' page. Checked from outside on 16 Oct: 12 pages at 1280 and 390 px wide, no
errors, every Story mode step plays, and the film plays.

**For YY:** nothing open.

---

## 10. GitHub link

**Paste:**

```text
https://github.com/yanyiooi-ux/keppel-ai-harvest
```

**YY's decision (16 Oct):** licence "All rights reserved", stated in `README.md`.

**For YY:** the repo is still private. After the orchestrator pushes `main` with its secret scans, make it public on
GitHub (the repo's Settings, Danger Zone, Change visibility). The checks below were run on 16 Oct.

## Before making the repo public

Making the repo public shows every past commit, not only the latest files.

- [ ] Search the full history: `git log -p --all` for keys, `.env` values, `C:\Users`, personal email addresses and
      handbook passages. Partly done, 16 Oct, read only: 0 key-like strings (API key values, `sk-`, `rk_live`,
      `sb_secret`, `GOCSPX`, `EAAB`, `AKID`, bearer tokens, `ghp_`), the Windows user path only in this list's own
      line above, and no personal email address (only `example.com` placeholders). Not checkable by script: copied
      handbook passages (`docs/challenge/` says it is in our own words).
- [x] `git log --format=%ae | sort -u` shows only GitHub no-reply addresses. Checked 16 Oct over every branch: one
      no-reply address on every commit up to `4b44bdc`.
- [x] Nothing from `private/` or `web/.env.local` was ever committed. Checked 16 Oct: the only `web/.env*` file in
      the history is `web/.env.example`, and nothing under `private/`.
- [x] Every image in `proof/screenshots/` checked for private content: no key, password or private chat in the 4
      (checked by eye 15 Oct). Two show a Windows folder path; YY decided on 16 Oct they go in as they are.
- [ ] README is the judges' front page: what it does, how to run it, the demo link, the 8-question map, proof. The
      film link is in; the live link waits on the server (field 9); two old lines wait on the orchestrator or YY
      (still open, item 6).
- [x] Decide a licence (or state "all rights reserved"): "All rights reserved" (YY, 16 Oct), stated in `README.md`.
- [x] `proof/screenshots/` holds at least 3 dated development screenshots: 4 (6 Oct and 10 Oct), not 10 or more.
