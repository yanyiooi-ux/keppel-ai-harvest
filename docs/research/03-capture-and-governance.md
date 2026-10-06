# 03 Capture and governance: research for the Intelligence Pill

> **Archived research (18 Sep 2026).** Written for the earlier "Pill Factory" idea. The interview methods and governance prior art are still useful; the file formats are proposals, not decisions.

Research date: 2026-09-18.

## Summary

- Capture: run the Critical Decision Method (CDM) as the interview spine, with probes from the Applied Cognitive Task Analysis (ACTA) knowledge audit. Both are published and probe-based, so an AI interviewer can run them by voice or text [1][2][3][4].
- Evidence: one study found LLM interviewers performed close to humans with fewer common errors, but not fully automated [5]. A benchmark found LLMs still miss implicit needs [7]. So a human reviews every draft pill.
- Structure: a hybrid. The pill is a Git folder in the open Agent Skills shape. Hard logic sits in DMN-style decision tables kept as text. Documents are reference only. No fine-tuning [10][11][12].
- Governance: treat a pill like code plus a regulated model: pull-request review, semantic versioning, golden-test gates, staged rollout, rollback, audit trail. This maps onto IMDA's Model AI Governance Framework for Agentic AI (22 Jan 2026, updated 20 May 2026) [14][15].
- Gap: the closest product found (Morphe) interviews staff but outputs a searchable database [9]. A pill outputs governed, tested decision logic with action limits.

## Capture methods

| Method | What it is | AI agent in 20 to 30 min? |
| --- | --- | --- |
| CDM (Klein, Calderwood, MacGregor, 1989) | Interview about one real non-routine incident. Four sweeps: pick incident, build timeline, deepen on cues and goals, then "what if" and novice questions [1][2] | Yes, one incident per session. Best fit. |
| ACTA knowledge audit (Militello, Hutton, 1998) | Fixed probes: past and future, big picture, noticing, job smarts, improvising, anomalies. Each asks for a real example [3][4] | Yes. Scripted probes suit an LLM. |
| ACTA task diagram | Expert splits the task into steps and marks the hard-thinking ones [4] | Yes, as a 3 minute warm-up. |
| ACTA simulation interview | Walk through one scenario, ask what they would assess and do [4] | Yes, if a scenario is prepared, such as a past alarm log. |
| Think-aloud (Ericsson, Simon) | Expert voices thoughts during the task (concurrent) or on replay (retrospective) [19] | Retrospective yes. Concurrent needs a shared screen. |
| Novice-error contrast | "What would a new hire get wrong?" Part of CDM sweep four [2] | Yes. High yield for guardrails. |
| Teach-back | Agent restates the rule, expert corrects | Yes. See Unverified. |

Where an AI already runs the interview:

- LLMREI: LLM-led requirements interviews were comparable to human-led ones, and a structured prompt cut common interviewer errors [5].
- GPT-4o follow-up questions rated no worse than human ones [6].
- ReqElicitGym: models show limited coverage of implicit requirements [7].
- Springer BISE paper: LLM chatbots guide adaptive interviews and surface tacit process knowledge [8].
- Anthropic Interviewer: AI plans, runs adaptive 10 to 15 minute interviews, humans help analyse. 1,250 professionals [13].
- Morphe (Vooban): AI agent interviews departing staff over four to six 30-minute sessions, can see a shared screen [9].

Takeaway: a short AI-led session is a proven format [9][13]. The known weakness is missed implicit knowledge [7], so the script forces a concrete incident and ends with teach-back.

## Interview script

CDM spine, ACTA probes, one incident, about 25 minutes. Every answer is timestamped so each rule can point back to its moment.

1. Frame (1 min). "I will ask about one real case. Say skip or off the record any time."
2. Task diagram (3 min). "Break this job into 3 to 6 steps. Which needs the most judgement?" [4]
3. Incident (2 min). "Tell me about a non-routine time at that step when your experience made the difference." [2]
4. Timeline (3 min). "Walk me from first sign to close-out." Agent reads it back. [2]
5. Cues (3 min). "What were you seeing or hearing that told you something was off? What did others miss?" [2][4]
6. Options (3 min). "What did you decide? What else did you consider and why reject it?"
7. Threshold (2 min). "Give me a number for that call. When does it not apply?"
8. Novice contrast (2 min). "What would a one-year engineer have done? What would it cost?" [2]
9. What if (2 min). "If this were a data centre, not an office tower, would your call change?" [2]
10. Boundary (2 min). "When would you not decide this alone? Who do you call, how fast?"
11. Anomaly (1 min). "Has the system or SOP ever been wrong and you knew? How?" [4]
12. Teach-back (3 min). Agent reads back 3 to 6 rules as IF, THEN, UNLESS. Expert says right, wrong or depends.

## Storage formats compared

Ratings are team judgement from the cited specs, not benchmarks.

| Format | Portable | Readable by approver | Testable | Git versioning | Verdict |
| --- | --- | --- | --- | --- | --- |
| Agent Skills folder (SKILL.md) | High. Open spec, plain Markdown and YAML [10][11] | High | Medium. Needs an eval harness | High | The container |
| DMN decision tables | High. OMG standard, XML interchange, conformance test kit [12] | High. A table | High. Deterministic | Medium. Keep a YAML source, export XML | Hard rules |
| Vendor rules engine | Low to medium unless it reads DMN [12] | Medium | High | Medium | Only as a DMN runner |
| Knowledge graph | Medium | Low | Medium | Low. Poor diffs | Later, as a cross-pill index |
| Plain RAG | Medium. Documents move, embeddings do not | Low. Approver cannot see what will be said | Low | Documents only | Reference only |
| Fine-tuning | Low. Locked in one model's weights | None | Low | No. Cannot roll back one rule | Avoid |

Recommendation: hybrid. Judgement and context live in SKILL.md. Thresholds, action classes and escalations live in decision tables with rule IDs. RAG only retrieves documents the pill names. Two cautions: the spec's `metadata` field only holds string pairs, so the manifest must be its own file [10]. And the standard has no signing, review gate or pinning [11]. That missing layer is what our platform adds.

## Pill schema

Folder: `pill.yaml` (manifest), `SKILL.md` (context and heuristics [10]), `rules/decisions.yaml` (rule tables, DMN-exportable [12]), `guardrails.yaml`, `provenance/` (transcripts, timestamps, sign-off), `tests/golden.yaml`, `references/`, `CHANGELOG.md`.

```yaml
id: pill.energy.chiller-plant-triage
name: Chiller plant fault triage
domain: energy-optimisation
version: 1.2.0     # major=scope or guardrail, minor=rule, patch=wording
status: live       # draft|in_review|validated|approved|live|retired
owner: lead-engineer-ops@example.com
approver: head-technical-services@example.com
scope:
  asset_types: [office_tower, data_centre]
  excludes: [district_cooling_plant]
inputs_required:
  - {name: chw_supply_temp_c, source: bms, max_age_min: 5}
  - {name: chiller_load_pct, source: bms, max_age_min: 5}
rules:
  - id: R-007
    if: "chw_supply_temp_c > setpoint + 1.5 for 15 min AND chiller_load_pct < 60"
    then: "Suspect fouled condenser. Check approach temperature first."
    unless: "asset_type == data_centre"
    action_class: recommend   # inform|recommend|needs_approval|escalate
    provenance: {expert: E-014, session: S-2026-09-10, timestamp: "00:14:32", probe: cues}
guardrails:
  - {id: G-002, rule: "Never recommend chiller shutdown in a data centre.", on_breach: escalate}
escalation:
  - {trigger: out_of_scope_or_missing_input, contact: duty-engineer, within_min: 15}
  - {trigger: life_safety, contact: fire-safety-manager, within_min: 0}
access:
  sensitivity: internal
  roles: {view: [ops_manager, technician], propose: [ops_manager], approve: [head_tech_services]}
tests: {golden_file: tests/golden.yaml, guardrail_pass_rate: 1.0}
changelog:
  - {version: 1.2.0, date: 2026-09-15, change: "R-007 threshold 2.0 to 1.5", approved_by: head-technical-services}
verified_on_models: [model-a, model-b]
```

## Governance lifecycle

| State | What happens | Gate | Pattern borrowed |
| --- | --- | --- | --- |
| Draft | Interview or correction creates a change on a branch | Expert confirms teach-back | Bound the scope, trace to a human [14] |
| In review | Pull request shows a rule-level diff | Owner plus second reviewer sign | Pull-request review. Independent validation from model risk management [16] |
| Validated | Golden tests run. Guardrail cases must pass 100 percent | Green test gate | CI quality gates that fail the build [18]. IMDA: test accuracy and edge cases before deployment [14] |
| Approved | Approver signs. Version bumped by semver [17] | Signature in audit trail | Human approval checkpoints [14]. AI Verify accountability and oversight [20] |
| Live | One asset first, then wider. Outcomes and overrides logged | Monitoring thresholds hold | IMDA: gradual rollout by risk, monitoring, failsafes [14] |
| Retired | Version withdrawn. Rollback is a Git revert to the last approved tag | Approver confirms | Periodic review, at least yearly [16] |

IMDA's agentic framework has four dimensions: assess and bound risks, make humans meaningfully accountable, implement technical controls, enable end-user responsibility [14]. Action classes cover the first, named owner and approver the second, test gates and staged rollout the third, visible rule IDs and limits the fourth. AI Verify checks 11 principles mainly through documentary process checks, which the audit trail feeds [20]. SR 11-7 was superseded by SR 26-2 on 17 April 2026, and generative and agentic AI sit outside SR 26-2. Cite it for ideas, not as applicable regulation [16].

## Prior art

- Augmentir: AI-native connected worker platform linking skills, work and workforce data [21]. Pill: captures decision logic with approval, not work-instruction delivery.
- Poka: connected worker platform known for tribal knowledge on video [22][23]. Pill: video is watched, a pill is executed and tested.
- Squint: turns veteran know-how, manuals and system data into procedures [24]. Pill: adds action limits, escalation, versioned release.
- Dozuki: structured work instructions and training [25][23]. Pill: covers judgement calls, not only steps.
- Morphe (Vooban): AI interviews departing staff into a searchable database [9]. Closest on capture. Pill: output is governed logic, not retrieval.
- Anthropic Interviewer: AI-run research interviews [13]. Pill: produces a reusable capability, not a study.
- Glean: enterprise search, connectors, enterprise graph, agents [26]. Pill: Glean finds what is written, a pill captures what was never written.
- Willow: operational AI and digital twin for buildings [27]. Pill: Willow models the asset, a pill models the expert. Complementary.

## More than a chatbot

Five things a judge can see live:

1. It asks before it answers. The agent interviews an engineer and the output is a draft pill with rule IDs, not a transcript.
2. Every recommendation shows its receipt: rule ID, pill version, expert, and a link to the interview timestamp.
3. It knows its limits. Each output is tagged inform, recommend, needs approval or escalate. Give it an out-of-scope case and it declines and pages a named person.
4. Corrections change nothing until approved. A manager corrects a threshold, a diff appears, golden tests run, the approver signs, the version bumps. One click rolls it back.
5. It is portable. The same pill folder runs on two different models and passes the same golden tests. The organisation owns a Git folder, not a vendor's memory.

## Unverified

- Teach-back as an elicitation method: no academic source found. Included on practitioner judgement.
- The script's time boxes, and that compressed CDM fits 25 minutes, are our design. Only timing evidence: Morphe (30 minutes) and Anthropic Interviewer (10 to 15 minutes) [9][13].
- All storage table ratings are team judgement, not measured.
- "Sensei-type tools": no specific product identified. Not assessed.
- IMDA's own pages did not render for the fetch tool. The four dimensions and dates come from Bird and Bird and search results, not the primary PDF [14][15].
- SR 11-7 wording was not checked against the Fed PDF. The annual review point and the SR 26-2 supersession come from secondary sources [16].
- The 2020 Model AI Governance Framework (second edition) was seen in search results only, so it is not relied on.
- How many tools adopted Agent Skills was reported by blogs only, so no count is given [11].
- Manifest values (thresholds, names, rule text) are illustrative, not engineering guidance.
- No product was found that ships a governed, versioned, portable pill format. Absence of evidence only.

## Sources

1. Klein et al, CDM (1989): https://www.semanticscholar.org/paper/Critical-decision-method-for-eliciting-knowledge-Klein-Calderwood/3069088b452ca5b02df350619524f5f7f7bd7cc6
2. CDM four sweeps: https://www.mdpi.com/2071-1050/13/11/6418 and https://journals.sagepub.com/doi/10.1518/001872098779480442
3. Militello and Hutton, ACTA (1998): https://pubmed.ncbi.nlm.nih.gov/9819578/
4. Commoncog ACTA walkthrough: https://commoncog.com/an-easier-method-for-extracting-tacit-knowledge/
5. LLMREI: https://arxiv.org/html/2507.02564v1
6. Follow-up question generation: https://arxiv.org/pdf/2507.02858
7. ReqElicitGym: https://arxiv.org/html/2602.18306
8. LLMs for Process Knowledge Acquisition: https://link.springer.com/article/10.1007/s12599-025-00976-w
9. Globe and Mail on Morphe: https://www.theglobeandmail.com/investing/personal-finance/retirement/article-retiring-an-ai-agent-will-see-you-now-to-download-your-knowledge/
10. Agent Skills specification: https://agentskills.io/specification
11. Anomity on the Agent Skills governance gap: https://anomity.ai/blog/agent-skills-open-standard-adoption-governance/
12. DMN: https://www.omg.org/spec/DMN and https://en.wikipedia.org/wiki/Decision_Model_and_Notation
13. Anthropic Interviewer: https://www.anthropic.com/research/anthropic-interviewer
14. Bird and Bird on IMDA agentic framework: https://www.twobirds.com/en/insights/2026/singapore/singapore-introduces-new-model-ai-governance-framework-for-agentic-ai
15. IMDA updated framework factsheet: https://www.imda.gov.sg/resources/press-releases-factsheets-and-speeches/factsheets/2026/updated-model-ai-governance-framework-for-agentic-ai
16. SR 11-7: https://www.federalreserve.gov/boarddocs/srletters/2011/sr1107.pdf and SR 26-2 summary: https://www.sia-partners.com/en/insights/publications/sr-11-7-vs-sr-26-2-model-risk-management-modernization
17. Semantic Versioning: https://semver.org/
18. Promptfoo CI/CD gates: https://www.promptfoo.dev/docs/integrations/ci-cd/
19. Think-aloud protocol: https://en.wikipedia.org/wiki/Think_aloud_protocol
20. AI Verify: https://aiverifyfoundation.sg/what-is-ai-verify/
21. Augmentir: https://www.augmentir.com/
22. Poka: https://www.poka.io/en/
23. Reliamag connected worker comparison: https://reliamag.com/guides/best-connected-worker-platforms-2026/
24. Squint: https://www.squint.ai/
25. Dozuki: https://www.dozuki.com/
26. Glean: https://www.glean.com/product/overview
27. Willow: https://www.willowinc.com/
