# Pill Desk (working name): Keppel "AI HARVEST"

Our entry for the **Tencent Cloud "AI CAN DO IT" Hackathon Singapore 2026**, Real Estate track, Keppel challenge
**"AI HARVEST: Turning Expert Know-How into Reusable Intelligence"**. Case study: **Technical Services**.

> **Status (5 Oct 2026):** the plan is locked and the build has started in CodeBuddy. The sections marked
> "to come" are filled in from the real code before submission.

## What it does

A veteran chief engineer knows why one office floor keeps complaining "too cold" in the morning and "too hot" in the
afternoon. A newcomer nudges the temperature and closes the ticket. Pill Desk turns the veteran's know-how into a
signed, versioned "Intelligence Pill": a checklist the FM technician follows on a phone, a "Needs your decision"
screen for the Keppel Asset Operations Manager, and a governed way to correct, test, sign and roll back the rules.
The AI words things and drafts things. Code decides. People sign.

## Run the demo

_To come: live link, and how to run it locally in replay mode without an API key._

## Solution diagram and Keppel's 8 questions

_To come in [`docs/solution/`](docs/solution/): each of the 8 questions mapped to the screen, file or test that
answers it._

## Real, mocked, and diagram only

_To come._ Every building, tenant, ticket and reading in this repo is made up for the demo.

## How we used AI tools

- **The product is built with Tencent CodeBuddy.** Plans, code, tests and fixes happen in CodeBuddy chats.
  Evidence: [`proof/BUILD-LOG.md`](proof/BUILD-LOG.md), screenshots in [`proof/screenshots/`](proof/screenshots/),
  and the plans CodeBuddy saved in `.codebuddy/plans/`.
- **The product's own AI** is a Tencent Hunyuan model through Tencent Cloud TokenHub. Its prompts are in
  `web/prompts/`.
- **Before the build,** the planning kit (these docs, the approved decisions, the CodeBuddy setup and the wording of
  the build prompts YY pasted into CodeBuddy) was prepared with Anthropic's Claude Code. No product code was written
  that way. This is the first row of the build log.

## Repo map

```
CODEBUDDY.md        CodeBuddy's standing brief (read at the start of every chat)
.codebuddy/         CodeBuddy setup: rules, a judge-panel sub-agent, the /log-proof command, saved plans
docs/
  challenge/        the Keppel brief in our words, submission rules, judging
  problem/          the problem, the Level 23 story, who is who
  decisions/        the approved plan and later decisions
  design/           the look
  knowhow/          the know-how pack the pill is built from, with sources
  solution/         overview, architecture, the 8-question map
  research/         background research from September
web/                the app (Next.js, created during the build)
proof/              proof we built with CodeBuddy
submission/         the submission form, field by field
scripts/            helpers (snap.ps1 takes dated proof screenshots on Windows)
```

## Key dates

Submit by Thu 15 Oct 2026 (official deadline 16 Oct). Finalists 23 Oct. Demo Day 3 Nov (TBC).
