# Solution

Written during the build, from the real code:

- `overview.md`: the solution in one page (prompt P1).
- `architecture.md`: the technical architecture and how prompts drive the AI (prompt P16).
- The solution diagram (its source file, plus an exported image for the submission).
- The map below, so judges and the `judge-panel` sub-agent can find every answer.

## Keppel's 8 questions: where each one is answered

| # | Question | Answered where (demo step, screen, file or test) | Status |
|---|---|---|---|
| 1 | What specific business problem is being addressed? | `docs/problem/problem-statement.md`. Demo step 2: the helpdesk sees the repeat flag on the /tech screen for ticket 2318. | planned |
| 2 | Whose expertise is captured, and how is undocumented knowledge obtained? | Demo step 1 (Capture): /engineer capture tab. `docs/knowhow/` holds the source pack, composed interview and sources. The contributor field in the pill stores the role (chief engineer, Singapore office towers), not a real name. | planned |
| 3 | How does the captured expertise become reusable, not a one-off answer? | The pill file: `web/pills/ts-cc/v1.0.yaml`. One pill = one repeat problem, versioned, with rules, checklist, guardrails, golden tests and an owner. Demo step 5 (sign v1.1) shows the versioning. | planned |
| 4 | How does an Asset Operations Manager use and supervise it, check recommendations, and know when to escalate? | Demo step 4: the /aom screen ("Needs your decision"). The AOM approves, sends back or escalates each card. The AOM signs the building's site layer. Demo step 6: the AOM accepts or says "not here" for a pill update. | planned |
| 5 | Why is it more than a chatbot or a search tool? | Rule matching, step order, colours, the repeat flag, the never-list and version states are plain TypeScript in `web/lib/`, not model output. The AI only writes words. Green, amber and red steps with named approvers. Golden tests check rule IDs and step order. The pill is versioned and rolled back. | planned |
| 6 | How are feedback, outcomes and new expertise reviewed, validated, versioned and approved? | Demo step 5: "Attended" is not "Fixed". A correction becomes a draft, golden tests run, the chief engineer ticks, the HQ pill owner signs a numbered version, rollback moves the pointer. The 80 percent rule is a counter, not an auto-change. | planned |
| 7 | How could it extend to many assets, business units or the whole enterprise? | Demo step 6: Building B is offered v1.1 and accepts or says "not here". A shared core plus a site layer per building. The HQ version map shows which building runs which version. Data centres are a future pill, drawn on the diagram. | planned |
| 8 | What is a credible path to build it with current or near-term technology? | One Next.js app in TypeScript. Pills are YAML files. Rule matching is plain code. A Hunyuan model through Tencent Cloud TokenHub writes the wording, server side only. Replay mode (saved answers) keeps the demo working offline. A live link on Tencent Cloud (bonus). | planned |
