# Solution overview

> Made up for the hackathon demo. All buildings, tenants, people and signatures are role-played and labelled so.

## What it is

Pill Desk is a web app that turns building engineers' know-how into reusable, governed "Intelligence Pills". One pill covers one repeat problem and holds its rules, checklist, guardrails, escalation table and golden tests. The air-con brain is the shelf the pills sit on, not the pill itself.

One demo pill: TS-CC, repeat comfort complaints (too cold or too hot) on an office floor. Area: Technical Services.

## The six live demo steps

1. **Capture:** a transcript goes in, the AI drafts rules each linked to the quote it came from, the chief engineer corrects them, and the HQ pill owner signs v1.0.
2. **Daily use:** the helpdesk asks 3 intake questions, the app flags "5th comfort complaint from Level 23", and the FM technician works the checklist on a phone with a "because" card on every step.
3. **Safety lines:** green steps the technician just does, amber steps need a named person's yes, red means stop and call someone. A never-list the AI cannot cross, checked in code.
4. **The AOM screen:** "Needs your decision" cards, each with approve, send back or escalate.
5. **Learning with undo:** "Attended" is not "Fixed". A chief engineer's correction becomes v1.1, golden tests run, the chief engineer ticks, the HQ pill owner signs, the ticket reruns with the new answer, then rollback to v1.0.
6. **Reuse:** Building B is offered v1.1 and its AOM accepts or says "not here" with a reason. HQ sees which building runs which version.

## The roles

| Role | What they do in the app |
|---|---|
| FM technician | Main checklist user, on a phone. Green steps only unless someone approves an amber step. Marks "Attended, relief given". |
| Chief engineer (the expert) | Gives the capture interview, approves amber technical steps, writes the root cause and "do not undo" note, writes golden test cases, gives the "technically checked" tick on every pill change. Never signs Keppel's rules. |
| AOM (the supervisor) | Main screen: "Needs your decision". Approves cost, tenant messages, colder-floor requests and pill updates. Signs the building's site layer. |
| HQ pill owner | Owns the shared core. Signs every numbered core release after the chief engineer's tick and golden tests. Sees which building runs which version. |
| Helpdesk (role tag) | Logs the ticket and asks the 3 intake questions. Shown as a role tag, not a separate login. |
| BMS operator (role tag) | Owns the remote checks: the 2-week temperature and VAV trend. Shown as a role tag, not a separate login. |
| Building manager | Picks the fix with the chief engineer, explains to the tenant, and presses "Fixed" once all four checks are met. Folded into the chief engineer view in the demo's role switcher. |

The demo uses a 4-role switcher: technician, chief engineer, AOM, HQ pill owner. All role-played and labelled so on screen.

## What the AI is allowed to do

- Write the "because" wording for a rule (2 to 3 plain sentences for a technician).
- Draft a change to a pill from a chief engineer's correction (a structured diff labelled "AI drafted").
- Draft rules from an interview transcript, each linked to its quote.

Every model output is labelled "AI drafted" or "AI wording" and needs a named person to accept it before it counts. If the model fails or is switched off, the app shows the rule's own text and says the AI wording is unavailable.

## What the AI is not allowed to do

- Decide rule matching, step order, colours, the repeat flag, the never-list, version states or the live version pointer. Those are plain TypeScript in `web/lib/`. The model never decides any of them.
- Quote a price or a dollar amount.
- Admit fault or liability in writing.
- Show one tenant's data to another tenant.
- Write to the BMS or any building system. There is no function that does this.
- Add a rule that is not in the transcript (in the capture step).
- Go past a red stop or relax the never-list.

## What stays roadmap only

Drawn on the solution diagram, never built:

- Body cameras and video.
- Real BMS and work-order links.
- Real logins.
- Data centres (a future pill).
- Other languages.
- The Tenant Experience and Leasing specialist pills (shown as thin "handoff" cards in the demo).
- Keppel's own cooling-plant AI (the Operations Nerve Centre, KAI, Athena, Keppel Bay Tower digital twin). We add floor and tenant context to it, we do not replace it.
