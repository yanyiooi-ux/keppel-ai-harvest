# Pill Desk: Keppel "AI HARVEST"

Our entry for the **Tencent Cloud "AI CAN DO IT" Hackathon Singapore 2026**, Real Estate track, Keppel challenge
**"AI HARVEST: Turning Expert Know-How into Reusable Intelligence"**. Case study: **Technical Services**.

## What it does

Pill Desk helps a building team fix a repeat comfort complaint faster, so the same spot stops calling again.
Code ranks the likely causes from a signed checklist (the "pill") and past cases, people move the job on with buttons,
and the AI (Tencent Hunyuan) only words things: for a new solution it also drafts the rule text and suggests the fact
and effects from a fixed code menu, and the senior manager confirms each part. When the senior manager finds a new
cause, it becomes a new pill version that HQ approves after its tests pass, and every building gets it at once, with
rollback.

## The 5 seats and /how

Five role-played people share one memory. Each seat is a chat with Pip, the desk's helper, and the buttons that seat
may press. The server checks every press against one table (`web/lib/permissions.ts`), not only the screen.

- **Tenant, Northwind Advisory** (`/seat/tenant`): reports a problem and answers a hands-off self-check after a
  safety question. Some answers end with an approved tip and no visit; otherwise a visit is booked.
- **Technician** (`/seat/technician`): opens the job with its checklist already filled from the spot's history. Found
  it and Not this re-rank the causes live. Solved, or Not solved with the hours and visits lost. Approves nothing.
- **Senior manager, the FM contractor's chief engineer** (`/seat/senior-manager`): gets the escalated job with
  everything attached. Logs a new solution, confirms each part, runs its tests and sends it to HQ, or asks HQ for
  outside help.
- **HQ pill owner, Keppel Technical Services lead** (`/seat/hq`): approves a new solution only after its tests pass on
  that exact draft (A2), and every building goes live on it at once. Rolls back. Decides outside help (A3).
- **Asset Operations Manager, Tower A, Keppel** (`/seat/aom-tower-a`): decides each charge to the tenant (A4), and
  watches the impact meter, the speak-first flag and the safety alerts.

Building B is not a seat: it is a card that shows its live version and how its own open ticket is ranked, so you can
see a new version reach a second building.

- Live demo: <http://43.160.222.54> (a Tencent Cloud Lighthouse server in Singapore, on Saved answers).
- `/` is "Pick your seat", with the 6-minute film near the top.
- `/how` is the page for judges: why, what and how in one scroll, then the 5 real chats side by side on the one
  memory, with the Reset button and the demo steps as text. It also answers Keppel's 8 questions, one line each.
- `/demo` is Story mode: the real app plays the whole demo by itself in 8 steps, one seat at a time, with a short
  plain caption for each step and the app's own reply to each press. Play or Pause, Back, Next and Restart; space
  and the arrow keys work too. It presses through the same routes as the seats, nothing is recorded, and it runs on
  Saved answers. It shares the one demo memory, so its Restart and Back reset what anyone else is looking at.
- `/flow` is "How a job flows": every button in order, who is told next, the four approvals and the 30-day rule.
- The film: <https://eternal-wreath-5ceq.here.now/>, a 6 min 13 s one-take film of the real app with captions. The
  same film plays near the top of the home page ("Watch the 6-minute video") when the file is on that copy; it is
  not in git (`web/public/media/README.md`).

**No login.** The seats are role-played: anyone who opens a seat acts as that person. **All data is made up:** every
building, tenant, ticket, reading, case, rate and amount (each data file in `web/data/` says so), and every signature and
approval is role-played.

## Run it on Replay, with no key

You need Node.js 20.9 or newer (we ran it on Node 24).

```
cd web
npm install
cp .env.example .env.local
npm run dev
```

On Windows PowerShell, the copy line is `Copy-Item .env.example .env.local`. Leave `REPLAY_MODE=1` and leave the key
empty. Then open <http://localhost:3000/how>.

On Replay the AI switch in the top bar starts on Replay, which the switch shows as "Saved answers": a worded line comes from a saved real Hunyuan answer in
`web/data/replay/`, with the banner "replay: saved real AI answer", and no AI call is made. Off shows the
same cards with the code's own words and the label "AI off". Live needs three lines of your own in `web/.env.local`,
all from your Tencent Cloud TokenHub console: `LLM_BASE_URL` (the TokenHub base URL), `LLM_API_KEY` (your key) and
`LLM_MODEL` (a Hunyuan model id). With an empty key or an empty base URL, Live falls back to Replay by itself and
makes no AI call.

To run the tests: `npm test` in `web/`. `web/tests/demo-flow.test.ts` runs the whole demo through the same action
functions the buttons call, on Replay with the network blocked, and prints "demo flow: all steps passed".

## What is real and what is made up

- **Real, running code:** the Next.js app; the ranking, the 30-day rule, the safety stops, who may press what, the
  tests on a new solution, versions and rollback, all plain TypeScript in `web/lib/`; the signed pill
  `web/pills/ts-cc/v1.0.yaml`; the Hunyuan calls on Live; the saved real answers in `web/data/replay/`.
- **Made up for the demo:** all the data above, the seats and every signature. There is no link to a real building
  system, helpdesk or Keppel system, and nothing is ever written to a BMS.
- **Known limits:** 2 of the 16 saved answers failed their checks when recorded, so the app shows the code's words
  there instead. On Live, the model usually gives no answer inside the app's limits, and the code's words show. Both
  are written up in `.codebuddy/plans/QUESTIONS.md` (questions 3 and 4).

## How we used AI tools

Who built what, row by row from [`proof/BUILD-LOG.md`](proof/BUILD-LOG.md):

- **Tencent CodeBuddy** wrote the parts whose rows say CodeBuddy in the tool column: the first build on 6 Oct 2026,
  and C1 to C3a (10 and 11 Oct).
- **Anthropic's Claude Code:** after CodeBuddy's credit ran out on 14 Oct 2026, Claude Code wrote the parts whose
  rows say "Claude Code (not CodeBuddy)", C3b onward. It finished C3b, which CodeBuddy's run had left uncommitted with
  one failing test: it wired in one word list that CodeBuddy's code declared but never used, and left the rest of C3b
  as CodeBuddy wrote it. Then it built C3c, C4 to C10b, the fixes after each review, and the removal of the old 3D
  tour.
- Claude also helped with the plan, the spec and the prompt wording, and made the design prototype in `docs/design/`.
- **The product's own AI** is a Tencent Hunyuan model (hy3) through Tencent Cloud TokenHub. Its 3 prompts are in
  `web/prompts/`.

The plans are in `.codebuddy/plans/` (the folder keeps CodeBuddy's name). CodeBuddy wrote the plans for C1a to C3b.
Claude Code wrote the plans for C3c and C6a to C10b, and the selfcheck files. C4, C5a and C5b have no plan file.

## Repo map

```
web/                the app (Next.js, TypeScript): app/, lib/, data/, pills/, prompts/, tests/
docs/plan/          BUILD-SPEC.md, the spec the build followed
docs/design/        the look and the design prototype
docs/challenge/     the Keppel brief in our words, submission rules, judging
docs/problem/       the problem and the Level 23 story
docs/decisions/     the approved plan and later decisions
docs/knowhow/       the know-how pack the pill is built from, with sources
docs/solution/      README.md: Keppel's 8 questions mapped to the app as built (overview.md is the first plan)
docs/research/      background research from September
proof/              BUILD-LOG.md, one row per build session and which tool did it
.codebuddy/         CodeBuddy setup, the plan for each part, QUESTIONS.md (open questions for YY)
CODEBUDDY.md        CodeBuddy's standing brief
submission/         the submission form, field by field
scripts/            snap.ps1 takes dated proof screenshots on Windows
```

## Key dates

Submission deadline Fri 16 Oct 2026. Finalists 23 Oct. Demo Day 3 Nov (TBC).

Licence: All rights reserved.
