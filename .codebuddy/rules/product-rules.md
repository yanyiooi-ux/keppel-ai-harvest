---
name: product-rules
description: The non-negotiable rules of the Pill Desk product (what the AI may do, what code decides, what people sign)
alwaysApply: true
enabled: true
---

# Product rules

These come from the approved plan (`docs/decisions/2026-10-05-approved-plan.md`). Build them into code, not into
prompts, so a prompt can never talk past them.

## Code decides, the AI words, people sign
- Rule matching, step order, colours (green, amber, red), the repeat flag, the never-list, version states and the live
  version pointer are plain TypeScript in `web/lib/`. The model never decides any of them.
- The model may only: write the "because" wording for a rule, draft a change to a pill from a person's correction,
  and draft rules from an interview transcript. Every model output is labelled "AI drafted" or "AI wording" on
  screen and needs a named person to accept it before it counts.
- If the model fails or is switched off, show the rule's own text and say the AI wording is unavailable. Replay mode
  (saved answers) shows a clear banner.

## The pill never changes itself
- A pill version is Draft, Approved or Retired. A separate live pointer says which version each building uses.
- Solved cases only add evidence. A change starts from a chief engineer's correction, or from the 80 percent counter
  (a fix above 80 percent with at least 5 confirmed cases from 2 or more zones). Either way it becomes a draft.
- Order to go live: golden tests pass, the chief engineer ticks "technically checked", the HQ pill owner signs a
  numbered core version. A building's site layer is signed by that building's AOM. Rollback moves the pointer back
  and deletes nothing.
- Rules about safety, money or wording to tenants never apply silently: each building's AOM must press Accept.
- Below 5 cases, show "expert rule, low evidence", never a percentage.

## Green, amber, red
- **Green** (technician just does it): intake questions, measuring, reading trends and history, checking the
  thermostat position and return grilles, notes, and one setpoint nudge of at most 1 °C on a zone with no change in
  the last 30 days, logged.
- **Amber** (a named yes first, the step stays locked until then): a second temperature change on the same floor in
  30 days or any change above 1 °C (chief engineer); any BMS override (chief engineer); VAV minimum airflow (chief
  engineer plus the controls contractor); work inside the tenant's space such as moving a thermostat (tenant's OK plus
  the AOM); a tenant asking for a colder floor (AOM); any cost, who pays or goodwill (AOM); routine explanations to
  the tenant (building manager).
- **Red** (stop and show who to call): someone hurt, smoke, a burning smell, a fire alarm, a personal heater with a
  warm cord or burning smell, water near electrical rooms (duty chief engineer and Fire Safety Manager). Also out of
  scope: a damper fully open for hours (a capacity limit), anything on the chilled-water plant, or no approved rule
  covers the case. No setpoint advice in those cases.

## Never, for anyone
- Quote a price or a dollar amount.
- Admit fault or liability in writing.
- Show one tenant's data to another tenant.
- Write to the BMS or any building system. There is no function that does this. Keep it that way.

## "Attended" is not "Fixed"
- "Attended, relief given" closes a ticket and changes nothing in the pill.
- "Fixed" needs four things: the chief engineer's cause note, 14 days of the zone trend in band at the complaint
  hour, a good call-back on day 7 to 14, and no comfort complaint from the same floor and tenant for 30 days. Only the
  building manager presses "Fixed". A repeat inside 30 days counts as evidence against the last fix.

## Data
- Every building, tenant, person, ticket and reading is made up and labelled so: Tower A, Building B, Northwind
  Advisory, ticket 2318. Never real Keppel, tenant or personal data. Every signature and approval in the demo is role-played and says so on
  screen, never shown as a real Keppel sign-off.
- Rules carry their source: a link, "public source", "practitioner opinion" or "team decision". No real expert
  interview exists yet. Never present the composed interview as a real one.
