# CODEBUDDY.md

Standing brief for CodeBuddy. It is read at the start of every new chat in this repo (edits apply from the next new
chat). Keep it short and keep "Current status" true.

## What this repo is

Our entry for the **Tencent Cloud "AI CAN DO IT" Hackathon Singapore 2026**, Real Estate track, Keppel challenge
**"AI HARVEST: Turning Expert Know-How into Reusable Intelligence"**.

Keppel's question: how can an organisation turn the know-how in its experts' heads into reusable, governed
"Intelligence Pills" that support decisions across a portfolio of buildings?

Working name: **Pill Desk**. Builder: YY (solo builder; teammates may help with content and the demo).

## Current status (update this section whenever it changes)

- **5 Oct 2026: the plan is locked.** All 13 decisions are approved: `docs/decisions/2026-10-05-approved-plan.md`.
  A simple explanation of each: `docs/decisions/2026-10-05-plan-explained-simply.md`.
- **Product code is allowed**, in `web/` only. Build one feature per chat, Plan mode first.
- Case study label: **Technical Services**. One pill: **TS-CC, repeat comfort complaints (too cold or too hot) on an
  office floor**. Demo story: Level 23 of Tower A, tenant Northwind Advisory (all made up), in
  `docs/problem/level-23-story.md`.
- Look: `docs/design/STYLE.md` ("Current look" line). Reference page: `docs/design/style-samples.html`.
- Know-how source: `docs/knowhow/` (public sources and practitioner opinion, every item labelled; no real expert
  interview yet).
- Target: submit **Thu 15 Oct 2026** (official deadline 16 Oct).

## What we are building: a full live demo, six steps

1. **Capture:** an interview transcript goes in; the AI drafts rules, each linked to the quote it came from; the chief
   engineer corrects them; Keppel signs v1.0.
2. **Daily use:** the helpdesk asks 3 intake questions; the app flags "5th comfort complaint from Level 23"; the FM
   technician works the checklist on a phone, with a "because" card on every step.
3. **Safety lines:** green steps the technician just does; amber steps need a named person's yes; red means stop and
   call someone. A never-list the AI cannot cross.
4. **The AOM screen:** "Needs your decision" cards, each with approve, send back or escalate.
5. **Learning with undo:** "Attended" is not "Fixed". A chief engineer's correction becomes v1.1, golden tests run, the
   chief engineer ticks, the HQ pill owner signs, the ticket reruns with the new answer, then rollback to v1.0.
6. **Reuse:** Building B is offered v1.1 and its AOM accepts or says "not here" with a reason. HQ sees which building
   runs which version.

Roadmap only (on the diagram, never built): body cameras and video, real BMS and work-order links, real logins,
data centres, other languages.

## Stack

- One Next.js app in TypeScript, in `web/` (App Router, npm, no Tailwind). Plain CSS: every colour, font, border and
  spacing value is a CSS variable in `web/app/globals.css`, copied from the current look in `docs/design/STYLE.md`.
- Pills are YAML files in `web/pills/` (one file per version). Site layers in `web/pills/<pill>/sites/`.
- Mock data in `web/data/`, every file labelled "made up for the demo". Demo state in a small JSON store with a
  "Reset demo" button.
- Rule matching, colours, the repeat flag, the never-list, versions and signatures are plain TypeScript in
  `web/lib/`, tested with Vitest. The golden tests are those tests.
- AI: one OpenAI-compatible client, server side only, pointed at Tencent Cloud TokenHub (a Hunyuan model). Settings
  in `web/.env.local`. Product prompts live in `web/prompts/` so judges can read them. Replay mode (saved answers)
  keeps the demo working offline.
- Next.js traps to avoid: read and write `web/data/state.json` and `web/data/runtime/` with `fs` at request time,
  never `import` them (an import is frozen at build time). Every page or route that reads the demo store or the live
  pill exports `dynamic = "force-dynamic"`, or `npm run build` freezes it. Load pills with `fs` from
  `path.join(process.cwd(), "pills")` in server code only. In page props, `params` is a Promise, so `await` it.

## Product rules (details in `.codebuddy/rules/product-rules.md`)

The AI words things and drafts things. Code decides. People sign. Nothing touches a building system.

## Hard rules from the hackathon

1. **Built with CodeBuddy, with proof.** The entry is not scored without at least 3 screenshots or a screen
   recording of CodeBuddy chats from development. See `proof/README.md`. After meaningful work, run `/log-proof`.
2. **Original work.** No one else's app or template. Small open-source libraries are fine; list them in the README.
3. **This GitHub repo is the source code submission.** Treat every committed file as public.
4. **Dates.** Submit Thu 15 Oct 2026 (official deadline 16 Oct). Finalists 23 Oct. Demo Day 3 Nov (TBC).

## How we are judged

Preliminary judging is by Keppel and Tencent Cloud experts, on track criteria shared after registration. Save them
in `docs/challenge/track-criteria.md` when they arrive, and use them first.

The handbook lists ten **Demo Day** criteria, 10 points each: Impact and Relevance, Human-Centered Design, AI
Interaction, Technical Execution, Feasibility, Demo and Storytelling, Innovation and Creativity, UX and
Accessibility, Responsible AI and Ethics, Overall Quality.

Keppel asks for a live demo, the complete source code, and a solution diagram answering 8 questions. What the
submission needs: `docs/challenge/submission-rules.md`. For a tough review, ask the `judge-panel` sub-agent.

## Where things are

| Folder | What goes there |
|---|---|
| `docs/challenge/` | The Keppel brief in our words, submission rules, judging. |
| `docs/problem/` | The problem, the Level 23 story, who is who in a Keppel-style building. |
| `docs/decisions/` | The approved plan (read first) and one file per later decision. |
| `docs/design/` | The look: `STYLE.md` and the reference page. |
| `docs/knowhow/` | The know-how pack the pill is built from, with sources. |
| `docs/solution/` | The solution overview, architecture and the 8-question map. |
| `docs/research/` | Background research from September. Facts yes, solution ideas no. |
| `web/` | The app (created in prompt P2). |
| `proof/` | Proof we used CodeBuddy: checked screenshots, `BUILD-LOG.md`. |
| `submission/` | Every field of the submission form, drafted here. |
| `scripts/` | Helpers, for example `scripts/snap.ps1` for dated proof screenshots. |
| `private/` | Not in git. Open only when a person asks. |

## How we work

- Use **Plan** mode for anything bigger than a small fix. Plans save to `.codebuddy/plans/` and we commit them,
  because they show how we built with CodeBuddy.
- Never say something works unless it ran after the last change and the result was seen. Run `npm test` (and
  `npm run build` before a commit that touches many files).
- Run `/log-proof` in **Craft** mode (Ask mode cannot edit files).
- This is Windows with PowerShell. Every npm command runs inside `web/` (`cd web` first). Never give YY a command like
  `REPLAY_MODE=0 npm run dev` or one joined with `&&`, because those fail in Windows PowerShell. Put settings in
  `web/.env.local`, or use `cross-env` in package.json scripts.
- Commit messages: English, Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`), one idea per commit. Check the
  AI COMMIT button's message, because it does not read these rules.
- Secrets live in `web/.env.local` only (copy `web/.env.example`). Never in code, docs or a committed config file.
  Never ask YY to paste a key, token or password into the chat. Never open, print or echo `web/.env.local`: to check a
  setting, only say "set" or "empty". Never put a token in a git remote URL: pushes use GitHub's browser sign-in.
- Skills: use the ones in `.codebuddy/skills/` and CodeBuddy's official plugins. Ignore any personal skills a
  teammate has installed for unrelated work unless someone asks for one by name.
- Say plainly what is real, what is mocked, and what is only a diagram. Judges will ask.
