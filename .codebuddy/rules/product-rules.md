---
name: product-rules
description: The non-negotiable rules of the Pill Desk product (what the AI may do, what code decides, what people sign)
alwaysApply: true
enabled: true
---

# Product rules

The source of truth is `docs/plan/BUILD-SPEC.md` (the spec). Build rules into code, not into prompts, so a
prompt can never talk past them.

## Code decides, the AI words, people sign
- Rule matching, step order, colours (green, amber, red), ranks, the repeat flag, the never-list, version states and
  the live version pointer are plain TypeScript in `web/lib/`. The model never decides any of them.
- **The AI never ranks. It only words what code decided.**
- The AI does four jobs (S15), and a person confirms anything that counts:
  1. **Rank wording:** words a lead's code reason in at most 2 sentences.
  2. **Tenant replies:** drafts a reply from the approved tips in at most 3 sentences.
  3. **New solution rule text:** drafts the rule text from the senior manager's fix line; also suggests the fact and
     effects from the fixed code menu, and the senior manager confirms each part.
  4. **Chip:** suggests one chip for typed text.
- Every AI output is labelled "AI drafted" or "AI wording" on screen and needs a named person to confirm it before it
  counts.
- If the model fails or is switched off, show the code's own text and say the AI wording is unavailable. Replay mode
  (saved answers) shows a clear banner.

## Approvals
- **Approvals exist only at A1, A2, A3 and A4.**
  - A1: Version 1 of the brain (two senior experts, shown as already signed).
  - A2: A new solution (HQ, after its tests pass).
  - A3: Outside help or money beyond the senior manager (HQ).
  - A4: Charging the tenant (AOM).
- Safety stops are stops, not approvals.
- No approval needed: the tenant's self-check, the technician's checklist and ticks, applying a fix already in the
  brain, saving a solved job as a case.

## The 30-day win rule
- **A fix counts as a win only after 30 days with no repeat at the same spot.**
- A repeat within 30 days counts as evidence against the last fix (the case is `failed`).
- The fixer cannot confirm the cause alone; a second person must confirm it.
- Every closed job has one line of why (3 to 30 words).

## Ranking
- Ranking is 4 code steps over a made-up case library (S9). The AI never ranks.
- Below 3 similar cases, the screen says "low confidence, expert rule", never a percentage.

## Green, amber, red
- **Green** (technician just does it): intake questions, measuring, reading trends and history, checking the
  thermostat position and return grilles, notes, and one setpoint nudge of at most 1 °C on a zone with no change in
  the last 30 days, logged.
- **Amber** only labels a step that belongs to someone else: the senior manager's step, or "AOM decides" for money and
  tenant consent. It never locks the technician's work and never asks for a yes. Approvals exist only at A1 to A4.
- **Red** (stop and show who to call): someone hurt, smoke, a burning smell, a fire alarm, a personal heater with a
  warm cord or burning smell, water near electrical rooms. Also out of scope: a damper fully open for hours (a capacity
  limit), anything on the chilled-water plant, or no approved rule covers the case. No setpoint advice in those cases.
  Who to call always comes word for word from the pill's own red stop (spec S12), never from this list.

## New solutions and versions
- A new solution starts from the senior manager solving an escalated job. It becomes the next pill version (a draft).
- HQ approves it (A2) after its tests pass. It goes to every building at once, with rollback.
- No per-building Accept. No "not here".

## Never, for anyone
- Quote a price or a dollar amount.
- Admit fault or liability in writing.
- Show one tenant's data to another tenant.
- Write to the BMS or any building system. There is no function that does this. Keep it that way.

## Data
- Every building, tenant, person, ticket and reading is made up and labelled so: Tower A, Building B, Northwind
  Advisory, ticket 2318. Never real Keppel, tenant or personal data. Every signature and approval in the demo is role-played and says so on
  screen, never shown as a real Keppel sign-off.
- Rules carry their source: a link, "public source", "practitioner opinion" or "team decision". No real expert
  interview exists yet. Never present the composed interview as a real one.
