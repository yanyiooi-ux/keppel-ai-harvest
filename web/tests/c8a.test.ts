/**
 * C8a: the senior manager's chat (S11 clear stop, S16 items 2, 5 and 7, S17,
 * S21's senior manager row, T-C8a).
 *
 * Every press goes through the real gate and body (runAction, or actionTurn
 * where the AI drafts first). Fake clients only: tests/setup.ts keeps the key
 * empty and the network blocked, and tests/setup-replay.ts points the replay
 * folder at an empty temp folder. Only the run rule 6 block reads
 * web/data/replay/, read only.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync, existsSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { parse } from "yaml";
import * as memory from "../lib/memory";
import { resetDemo, runAction, openStopsOnJob } from "../lib/actions";
import { actionTurn } from "../lib/action-turn";
import { seatView } from "../lib/seat-view";
import { leadsForJob, factsForJob } from "../lib/leads";
import { loadPill, loadAndCheckPillFile, type Pill, type Rule } from "../lib/pill";
import { SEAT_LABELS } from "../lib/permissions";
import { factLabel } from "../lib/fact-labels";
import { draftHash } from "../lib/draft";
import { selfCheckLines } from "../lib/technician-flow";
import { impactLine, costLine, loadImpactRates } from "../lib/impact-rates";
import {
  currentSolution,
  needsSafetyRecord,
  openStopKey,
  SAFETY_RECORD_LINE,
  SAFETY_RECORD_NOTE,
  AI_DRAFTED,
  AI_SUGGESTED,
  type Solution,
} from "../lib/senior-manager-flow";
import { managerDesk, type ManagerDesk, type ManagerOpenJob } from "../lib/senior-manager-desk";
import {
  newSolution,
  newSolutionSpec,
  saveReplay,
  rankWordingSpec,
  REPLAY_BANNER,
  AI_OFF_LABEL,
  type ModelClient,
} from "../lib/ai";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");
const v10 = loadPill("ts-cc", "1.0");
const fixture: Pill = loadAndCheckPillFile(join(process.cwd(), "tests", "fixtures", "ts-cc-v1.1.yaml"));
const fixtureRule = fixture.rules.find((r) => r.id === "TS-CC-27") as Rule;
const TECH = SEAT_LABELS.technician;
const SM = SEAT_LABELS["senior-manager"];

/** The demo solution (S16 item 2), from the role-played senior manager. */
const DEMO_FIX =
  "If the zone had a fit-out in the last 12 months, check where the thermostat sits against the fit-out drawing before any nudge.";
const DEMO_WHY =
  "The fit-out 8 months ago moved the core thermostat next to the new printer bay, so it reads warm and the box keeps cooling the open area.";

const IMPACT = { hoursLost: 3, extraVisits: 2, contractorOrPartsNeeded: false };

beforeEach(() => {
  resetDemo(REAL_NOW);
});

// ---- Helpers: every press goes through the real gate and body ----

function press(seat: string, action: string, jobId?: string, payload?: Record<string, unknown>) {
  return runAction({ seat, action, jobId, payload }, REAL_NOW);
}

function job(id: string) {
  return memory.jobById(memory.read(), id)!;
}

function selfCheck(complaint: string, answers: [string, string][]) {
  const report = press("tenant", "report", undefined, { complaint });
  expect(report.ok).toBe(true);
  let last = report;
  for (const [questionId, answer] of answers) {
    last = press("tenant", "answer", report.jobId, { questionId, answer });
    expect(last.ok, last.message).toBe(true);
  }
  return last;
}

const COLD_CORE_KEEPS: [string, string][] = [
  ["Q0", "No"],
  ["Q1", "Open area near the lift core"],
  ["Q2", "It keeps coming back"],
  ["Q3", "Yes"],
  ["Q4-thermostat", "Not sure"],
];

/** The render path: the tenant's self-check, the technician opens 2318, Not this twice, Not solved. */
function escalate2318() {
  expect(selfCheck("too cold", COLD_CORE_KEEPS).jobId).toBe("2318");
  expect(press("technician", "open-job", "2318").ok).toBe(true);
  expect(press("technician", "tick", "2318", { causeId: "precool", type: "not-this" }).ok).toBe(true);
  expect(press("technician", "tick", "2318", { causeId: "min-airflow", type: "not-this" }).ok).toBe(true);
  const r = press("technician", "not-solved", "2318", IMPACT);
  expect(r.ok, r.message).toBe(true);
  expect(job("2318").status).toBe("escalated");
}

function smTick(causeId: string, type: "found" | "not-this" | "clear", jobId = "2318") {
  return press("senior-manager", "tick", jobId, { causeId, type });
}

function desk(show?: string): ManagerDesk {
  const view = seatView(memory.read(), "senior-manager", undefined, REAL_NOW, show);
  expect(view.manager).toBeDefined();
  return view.manager!;
}

function openJob(show?: string): ManagerOpenJob {
  const open = desk(show).open;
  expect(open).not.toBeNull();
  return open!;
}

function solution(jobId = "2318"): Solution {
  const s = currentSolution(memory.read(), jobId);
  expect(s).toBeDefined();
  return s!;
}

function logDemo(mode: "off" | "replay" | "live" = "off", deps?: Parameters<typeof actionTurn>[2]) {
  return actionTurn(
    { seat: "senior-manager", action: "log-new-solution", jobId: "2318", payload: { fixLine: DEMO_FIX, whyLine: DEMO_WHY } },
    mode,
    deps,
    REAL_NOW
  );
}

function confirm(part: string, value: string, jobId = "2318") {
  return press("senior-manager", "confirm-part", jobId, { part, value });
}

/** The fixture's rule, part by part: the demo path the orchestrator decided (block 25, then put-first 21). */
function confirmDemoParts() {
  for (const [part, value] of [
    ["rule-text", DEMO_FIX],
    ["fact", "fit-out-12m"],
    ["effect-1", "block:25"],
    ["effect-2", "put-first:21"],
  ]) {
    const r = confirm(part, value);
    expect(r.ok, `${part}: ${r.message}`).toBe(true);
  }
}

function runtimeFiles(): string[] {
  const dir = memory.runtimeDir();
  return existsSync(dir) ? readdirSync(dir) : [];
}

function draftPill(s: Solution): Pill {
  expect(s.draftFile).toBeDefined();
  return parse(readFileSync(join(memory.runtimeDir(), s.draftFile!), "utf-8")) as Pill;
}

function fakeClient(answer: string | null): ModelClient {
  return {
    async complete() {
      return { content: answer, finish: "stop" };
    },
  };
}

// ---- T-C8a bullet 1: the escalated 2318 with everything attached ----

describe("T-C8a: the escalated 2318 shows everything attached", () => {
  beforeEach(() => {
    escalate2318();
  });

  it("the senior manager's desk lists 2318 and has it on the desk, escalated", () => {
    const d = desk();
    expect(d.jobs.map((j) => j.id)).toEqual(["2318"]);
    expect(d.open!.open.jobId).toBe("2318");
    expect(d.open!.open.status).toBe("escalated");
    expect(d.open!.editable).toBe(true);
  });

  it("the self-check answers, word for word, in the filled checklist", () => {
    const card = openJob().open.checklist.find((c) => c.id === "self-check")!;
    const lines = (card.lines ?? []).map((l) => l.text);
    for (const line of selfCheckLines(job("2318"))) expect(lines).toContain(line);
    expect(lines.length).toBeGreaterThanOrEqual(5);
  });

  it("the facts, by their labels on screen (S5)", () => {
    const state = memory.read();
    expect(openJob().facts).toEqual(factsForJob(state, job("2318")).map(factLabel));
    expect(openJob().facts).toEqual([
      "cold mornings",
      "core zone",
      "repeat",
      "opposite fixes",
      "renovation in the last 12 months",
      "VAV box",
    ]);
  });

  it("both ticks with who made them", () => {
    expect(openJob().ticks).toEqual([
      `Morning start-up runs too cold: Not this (${TECH})`,
      `Core box held at minimum airflow: Not this (${TECH})`,
    ]);
  });

  it("the impact record with its cost from the made-up rates", () => {
    const record = job("2318").impact!;
    expect(openJob().impact).toBe(`${impactLine(record)}. Cost: ${costLine(420, loadImpactRates())}.`);
  });

  it("how it came up: Not solved, by the technician", () => {
    expect(openJob().cameUp).toMatch(new RegExp(`^Not solved by ${TECH.replace(/[()]/g, "\\$&")}`));
  });

  it("its own ranked list: the senior manager's seat ranks thermostat-spot then rebalance (S9)", () => {
    const open = openJob().open;
    expect(open.leads.map((l) => l.causeId)).toEqual(["thermostat-spot", "rebalance"]);
    expect(open.leads[1].reason).toBe("Low confidence, expert rule TS-CC-24: no similar cases yet.");
    expect(open.ruledOut.map((l) => l.causeId)).toEqual(["precool", "min-airflow"]);
    const ranked = leadsForJob(memory.read(), job("2318"), "senior-manager", REAL_NOW);
    expect(open.leads.map((l) => l.reason)).toEqual(ranked.leads.map((l) => l.reason));
  });

  it("the same filled checklist as the technician's", () => {
    const tech = seatView(memory.read(), "technician", undefined, REAL_NOW).desk!.open!;
    expect(openJob().open.checklist).toEqual(tech.checklist);
  });

  it("nothing is asked again: no question card or answer button reaches the senior manager's seat", () => {
    const view = seatView(memory.read(), "senior-manager", undefined, REAL_NOW);
    const cards = view.messages.flatMap((m) => m.cards ?? []);
    expect(cards.some((c) => c.kind === "question" || (c.answers ?? []).length > 0)).toBe(false);
    expect(JSON.stringify(view.manager)).not.toMatch(/"questionId"|"answers"/);
  });

  it("the speak-first, low-confidence and escalated notices are on the seat", () => {
    const kinds = seatView(memory.read(), "senior-manager", undefined, REAL_NOW).notices.map((n) => n.kind);
    expect(kinds).toContain("speak-first");
    expect(kinds).toContain("low-confidence");
    expect(kinds).toContain("escalated");
  });

  it("a job not escalated is not on the senior manager's list", () => {
    memory.update((s) => {
      s.jobs.find((j) => j.id === "2318")!.status = "in-progress";
    });
    expect(desk().jobs).toEqual([]);
    expect(desk().open).toBeNull();
  });
});

// ---- C8a item 2: Found it, Not this and Solved, same rules as the technician ----

describe("C8a item 2: Found it, Not this and Solved on the senior manager seat", () => {
  beforeEach(() => {
    escalate2318();
  });

  it("Found it on thermostat-spot records the senior manager as the one who found it", () => {
    expect(smTick("thermostat-spot", "found").ok).toBe(true);
    expect(job("2318").foundLeadId).toBe("thermostat-spot");
    expect(job("2318").ticks.find((t) => t.causeId === "thermostat-spot")).toEqual({
      causeId: "thermostat-spot",
      type: "found",
      seat: "senior-manager",
    });
    expect(openJob().open.leads[0].reason).toBe(`Checked: found it (${SM}).`);
    expect(openJob().ticks).toContain(`Thermostat in the wrong spot after a fit-out: Found it (${SM})`);
  });

  it("Not this, then Clear, re-rank the senior manager's list", () => {
    expect(smTick("rebalance", "not-this").ok).toBe(true);
    expect(openJob().open.ruledOut.map((l) => l.causeId)).toContain("rebalance");
    expect(smTick("rebalance", "clear").ok).toBe(true);
    expect(openJob().open.leads.map((l) => l.causeId)).toEqual(["thermostat-spot", "rebalance"]);
  });

  it('T-C8a: Found it on rebalance, then Solved, is refused ("this fix needs outside help: Ask HQ, A3")', () => {
    expect(smTick("rebalance", "found").ok).toBe(true);
    const r = press("senior-manager", "solved", "2318", { whyLine: "A specialist must balance the air here." });
    expect(r.ok).toBe(false);
    expect(r.message).toContain("this fix needs outside help: Ask HQ, A3");
    expect(job("2318").status).toBe("escalated");
    expect(memory.read().runtimeCases).toEqual([]);
  });

  it("Solved on rebalance is refused on every seat: the technician cannot even tick it", () => {
    memory.update((s) => {
      s.jobs.find((j) => j.id === "2318")!.status = "in-progress";
    });
    const tick = press("technician", "tick", "2318", { causeId: "rebalance", type: "found" });
    expect(tick.ok).toBe(false);
    expect(tick.message).toContain("This check is the senior manager's.");
    for (const seat of ["hq", "aom-tower-a", "tenant"]) {
      expect(press(seat, "solved", "2318", { whyLine: "A specialist balanced it." }).ok).toBe(false);
    }
  });

  it("Found it on thermostat-spot, then Solved: refused, the fix goes through the fit-out contract (TS-CC-11)", () => {
    smTick("thermostat-spot", "found");
    const r = press("senior-manager", "solved", "2318", { whyLine: "The thermostat sits in the wrong spot." });
    expect(r.ok).toBe(false);
    expect(r.message).toContain("TS-CC-11");
    expect(job("2318").status).toBe("escalated");
  });

  it("a fix the senior manager may make is Solved here: pending-30-day and a case fixed by the senior manager", () => {
    expect(smTick("precool", "clear").ok).toBe(true);
    expect(smTick("precool", "found").ok).toBe(true);
    const r = press("senior-manager", "solved", "2318", { whyLine: "The pre-cool started two hours early." });
    expect(r.ok, r.message).toBe(true);
    expect(job("2318").status).toBe("pending-30-day");
    const saved = memory.read().runtimeCases[0];
    expect(saved).toMatchObject({ jobId: "2318", causeId: "precool", fixedBy: "senior-manager", confirmedBy: null });
  });

  it("the senior manager's own ticks post no low-confidence notice to themselves", () => {
    const before = memory.read().notices.filter((n) => n.kind === "low-confidence").length;
    smTick("thermostat-spot", "not-this");
    expect(memory.read().notices.filter((n) => n.kind === "low-confidence").length).toBe(before);
  });
});

// ---- T-C8a bullet 2: Log new solution, AI off; nothing saves until each part is confirmed ----

describe("T-C8a: Log new solution with the demo lines, AI off", () => {
  beforeEach(() => {
    escalate2318();
    expect(smTick("thermostat-spot", "found").ok).toBe(true);
  });

  it("the rule text equals the fix line word for word, and the fact and effects wait to be picked by hand", async () => {
    const r = await logDemo("off");
    expect(r.ok, r.message).toBe(true);
    expect(job("2318").status).toBe("new-solution-drafted");
    const s = solution();
    expect(s.causeId).toBe("thermostat-spot");
    expect(s.fixLine).toBe(DEMO_FIX);
    expect(s.whyLine).toBe(DEMO_WHY);
    const rule = s.parts.find((p) => p.id === "rule-text")!;
    expect(rule.suggested).toBe(DEMO_FIX);
    expect(rule.suggestedBy).toBe("fix-line");
    for (const id of ["fact", "effect-1", "effect-2"]) {
      expect(s.parts.find((p) => p.id === id)!.suggested, id).toBeNull();
    }
    expect(s.ai.aiOff).toBe(AI_OFF_LABEL);
    expect(s.ai.aiCalls).toBe(0);
    const view = openJob().solution!;
    expect(view.aiOff).toBe(AI_OFF_LABEL);
    expect(view.parts.find((p) => p.id === "rule-text")!.label).toBe("the fix line, word for word");
    expect(view.parts.find((p) => p.id === "fact")!.label).toBe("pick by hand from the menu");
  });

  it("nothing is saved until each part is confirmed: no draft file, no hash, no live change", async () => {
    await logDemo("off");
    const before = runtimeFiles();
    expect(solution().hash).toBeUndefined();
    for (const [part, value] of [
      ["rule-text", DEMO_FIX],
      ["fact", "fit-out-12m"],
      ["effect-1", "block:25"],
    ]) {
      expect(confirm(part, value).ok).toBe(true);
      expect(solution().hash, part).toBeUndefined();
      expect(solution().draftFile, part).toBeUndefined();
      expect(runtimeFiles(), part).toEqual(before);
    }
    expect(openJob().solution!.saved).toBe(false);
    expect(openJob().solution!.savedLine).toBe("Nothing is saved until each part is confirmed.");
    expect(memory.read().liveVersionByBuilding).toEqual({ "tower-a": "1.0", "building-b": "1.0" });
  });

  it("once every part is confirmed, the draft is saved in the runtime folder and its rule equals the fixture's", async () => {
    await logDemo("off");
    confirmDemoParts();
    const s = solution();
    expect(s.draftFile).toBeDefined();
    expect(runtimeFiles()).toContain(s.draftFile);
    const text = readFileSync(join(memory.runtimeDir(), s.draftFile!), "utf-8");
    expect(s.hash).toBe(draftHash(text));
    const pill = draftPill(s);
    expect(pill.version).toBe("1.1");
    expect(pill.rules.find((r) => r.id === "TS-CC-27")).toEqual(fixtureRule);
    expect(pill.red_stops).toEqual(v10.red_stops);
    expect(pill).toEqual(fixture);
    expect(openJob().solution!.saved).toBe(true);
    expect(openJob().solution!.hash7).toBe(s.hash!.slice(0, 7));
  });

  it("the draft is never saved in web/pills/", async () => {
    const pills = readdirSync(join(process.cwd(), "pills", "ts-cc")).sort();
    await logDemo("off");
    confirmDemoParts();
    expect(readdirSync(join(process.cwd(), "pills", "ts-cc")).sort()).toEqual(pills);
  });

  it("Log new solution needs a found lead", async () => {
    smTick("thermostat-spot", "clear");
    const r = await logDemo("off");
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Log new solution needs a found lead: tick Found it on the cause first.");
    expect(job("2318").status).toBe("escalated");
    expect(memory.read().solutions).toEqual([]);
  });

  it("a fix line or a why line outside 3 to 30 words is refused, and nothing is drafted", () => {
    const short = press("senior-manager", "log-new-solution", "2318", { fixLine: "Move it", whyLine: DEMO_WHY });
    expect(short.ok).toBe(false);
    expect(short.message).toContain("The fix line needs 3 to 30 words; it has 2.");
    const long = press("senior-manager", "log-new-solution", "2318", {
      fixLine: DEMO_FIX,
      whyLine: Array.from({ length: 31 }, () => "word").join(" "),
    });
    expect(long.ok).toBe(false);
    expect(long.message).toContain("The why line needs 3 to 30 words; it has 31.");
    expect(memory.read().solutions).toEqual([]);
    expect(job("2318").status).toBe("escalated");
  });

  it("only the senior manager logs, and only on an escalated job", () => {
    expect(press("technician", "log-new-solution", "2318", { fixLine: DEMO_FIX, whyLine: DEMO_WHY }).ok).toBe(false);
    expect(press("hq", "log-new-solution", "2318", { fixLine: DEMO_FIX, whyLine: DEMO_WHY }).ok).toBe(false);
  });

  it("an off-menu fact or effect is refused at its own confirm", async () => {
    await logDemo("off");
    expect(confirm("fact", "warm-afternoons").ok).toBe(false);
    for (const value of ["block:8", "put-first:25", "block:26", "put-first:5", "put-first:31", "block:21"]) {
      const r = confirm("effect-1", value);
      expect(r.ok, value).toBe(false);
    }
    expect(confirm("effect-1", "none").ok).toBe(false);
    expect(solution().parts.every((p) => !p.confirmed)).toBe(true);
  });

  it("two effects on one step are refused when the draft is built, and nothing is saved", async () => {
    await logDemo("off");
    confirm("rule-text", DEMO_FIX);
    confirm("fact", "fit-out-12m");
    confirm("effect-1", "put-first:21");
    const r = confirm("effect-2", "put-first:21");
    expect(r.ok).toBe(false);
    expect(r.message).toContain("Step 21 has two effects");
    expect(solution().hash).toBeUndefined();
    expect(solution().parts.find((p) => p.id === "effect-2")!.confirmed).toBe(false);
  });

  it("an empty rule text is refused", async () => {
    await logDemo("off");
    expect(confirm("rule-text", "   ").ok).toBe(false);
  });
});

// ---- T-C8a bullet 3: Run tests, and Send to HQ only on a passing run of this exact draft ----

describe("T-C8a: Run tests shows passed, failed and not applicable; Send to HQ needs a passing run", () => {
  beforeEach(async () => {
    escalate2318();
    smTick("thermostat-spot", "found");
    await logDemo("off");
  });

  it("Run tests is refused until every part is confirmed", () => {
    const r = press("senior-manager", "run-tests", "2318");
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Confirm each part first: nothing is saved until then, so there is no draft to test.");
  });

  it("Send to HQ is refused before a passing run", () => {
    confirmDemoParts();
    const r = press("senior-manager", "send-to-hq", "2318");
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/no passing test run/);
    expect(solution().status).toBe("draft");
  });

  it("Run tests on the demo draft: 23 passed, 0 failed, 2 not applicable, on the draft's hash", () => {
    confirmDemoParts();
    const r = press("senior-manager", "run-tests", "2318");
    expect(r.ok, r.message).toBe(true);
    const run = solution().testRun!;
    expect(run.draftHash).toBe(solution().hash);
    expect([run.passed, run.failed, run.notApplicable]).toEqual([23, 0, 2]);
    const na = run.results.filter((x) => x.status === "not-applicable").map((x) => x.id);
    expect(na).toEqual(["GT-01", "GT-21"]);
    expect(run.results.find((x) => x.id === "GT-22")!.status).toBe("passed");
    expect(run.results.find((x) => x.id === "R-01")!.status).toBe("passed");
    const view = openJob().solution!.testRun!;
    expect([view.passed, view.failed, view.notApplicable]).toEqual([23, 0, 2]);
    expect(view.current).toBe(true);
    expect(view.lines.find((l) => l.id === "GT-01")!.label).toBe("not applicable to v1.1");
  });

  it("Send to HQ opens on the passing run: the solution goes to HQ and the job waits on HQ", () => {
    confirmDemoParts();
    press("senior-manager", "run-tests", "2318");
    expect(openJob().solution!.canSend).toBe(true);
    const r = press("senior-manager", "send-to-hq", "2318");
    expect(r.ok, r.message).toBe(true);
    const s = solution();
    expect(s.status).toBe("sent-to-hq");
    expect(s.sentBy).toBe("senior-manager");
    expect(job("2318").status).toBe("new-solution-drafted");
    const hq = memory.read().notices.filter((n) => n.seat === "hq" && n.jobId === "2318");
    expect(hq).toHaveLength(1);
    expect(hq[0].text).toContain(DEMO_FIX);
    expect(hq[0].text).toContain(s.hash!.slice(0, 7));
    expect(hq[0].text).toContain("23 passed, 0 failed, 2 not applicable");
  });

  it("a confirm that changes the draft clears the run, and Send to HQ is refused again", () => {
    confirmDemoParts();
    press("senior-manager", "run-tests", "2318");
    const oldHash = solution().hash;
    const r = confirm("effect-2", "put-first:17");
    expect(r.ok, r.message).toBe(true);
    expect(solution().hash).not.toBe(oldHash);
    expect(solution().testRun).toBeUndefined();
    expect(press("senior-manager", "send-to-hq", "2318").ok).toBe(false);
    expect(openJob().solution!.testRun).toBeNull();
    expect(openJob().solution!.canSend).toBe(false);
  });

  it("a confirm that leaves the draft the same keeps its run", () => {
    confirmDemoParts();
    press("senior-manager", "run-tests", "2318");
    const run = solution().testRun;
    expect(confirm("fact", "fit-out-12m").ok).toBe(true);
    expect(solution().testRun).toEqual(run);
    expect(press("senior-manager", "send-to-hq", "2318").ok).toBe(true);
  });

  it("once sent, the draft is HQ's: no more confirms, runs or sends from this seat", () => {
    confirmDemoParts();
    press("senior-manager", "run-tests", "2318");
    press("senior-manager", "send-to-hq", "2318");
    for (const r of [
      confirm("effect-2", "put-first:17"),
      press("senior-manager", "run-tests", "2318"),
      press("senior-manager", "send-to-hq", "2318"),
    ]) {
      expect(r.ok).toBe(false);
      expect(r.message).toBe("That draft is with HQ now: it waits for HQ's decision (A2).");
    }
  });

  it("Run tests ranks the open jobs in the memory with the rules only: an open red stop neither fails nor skips R-01", () => {
    confirmDemoParts();
    expect(press("technician", "safety-pick", "2318", { stopId: "RS-04" }).ok).toBe(true);
    const r = press("senior-manager", "run-tests", "2318");
    expect(r.ok, r.message).toBe(true);
    const r01 = solution().testRun!.results.find((x) => x.id === "R-01")!;
    expect(r01.status).toBe("passed");
    expect(openStopsOnJob(memory.read(), job("2318")).length).toBe(1);
  });
});

// ---- C8a item 3: the AI's suggestion card, labelled; nothing saves until each part is confirmed ----

describe("C8a item 3: the AI drafts the rule text and suggests the fact and effects from the code menu", () => {
  const SUGGESTION = JSON.stringify({
    ruleText: DEMO_FIX,
    fact: "fit-out-12m",
    effects: [{ effect: "put-first", step: 21 }],
  });

  beforeEach(() => {
    escalate2318();
    smTick("thermostat-spot", "found");
  });

  it('labels: the rule text "AI drafted", the fact and each effect "AI suggested from the code menu"', async () => {
    const r = await logDemo("live", { client: fakeClient(SUGGESTION), keyPresent: true });
    expect(r.ok, r.message).toBe(true);
    const s = solution();
    expect(s.ai.source).toBe("live");
    expect(s.ai.aiCalls).toBe(1);
    expect(s.parts.map((p) => [p.id, p.suggested, p.suggestedBy])).toEqual([
      ["rule-text", DEMO_FIX, "ai"],
      ["fact", "fit-out-12m", "ai"],
      ["effect-1", "put-first:21", "ai"],
      ["effect-2", null, null],
    ]);
    const view = openJob().solution!;
    expect(view.parts.find((p) => p.id === "rule-text")!.label).toBe(AI_DRAFTED);
    expect(AI_DRAFTED).toBe("AI drafted");
    expect(view.parts.find((p) => p.id === "fact")!.label).toBe(AI_SUGGESTED);
    expect(view.parts.find((p) => p.id === "effect-1")!.label).toBe(AI_SUGGESTED);
    expect(AI_SUGGESTED).toBe("AI suggested from the code menu");
    expect(view.parts.find((p) => p.id === "effect-2")!.label).toBe("pick by hand from the menu");
    expect(view.parts.every((p) => !p.confirmed && p.word === "To confirm")).toBe(true);
    expect(memory.read().aiCalls).toBe(1);
    expect(solution().hash).toBeUndefined();
  });

  it("confirming the AI's suggestion as it stands keeps its label; a change from the menu is picked by hand", async () => {
    await logDemo("live", { client: fakeClient(SUGGESTION), keyPresent: true });
    confirm("fact", "fit-out-12m");
    confirm("effect-1", "block:25");
    const view = openJob().solution!;
    expect(view.parts.find((p) => p.id === "fact")!.label).toBe(`${AI_SUGGESTED}, confirmed by the senior manager`);
    expect(view.parts.find((p) => p.id === "effect-1")!.label).toBe("picked by hand");
    expect(view.parts.find((p) => p.id === "fact")!.word).toBe("Confirmed");
  });

  it("a suggestion the menu refuses comes back as a note, advisory, not enforced; the rule text is the fix line", async () => {
    const offMenu = JSON.stringify({ ruleText: DEMO_FIX, fact: "fit-out-12m", effects: [{ effect: "block", step: 8 }] });
    const r = await logDemo("live", { client: fakeClient(offMenu), keyPresent: true });
    expect(r.ok).toBe(true);
    const s = solution();
    expect(s.ai.note?.label).toBe("advisory, not enforced");
    expect(s.parts.find((p) => p.id === "rule-text")!.suggestedBy).toBe("fix-line");
    expect(s.parts.find((p) => p.id === "fact")!.suggested).toBeNull();
    expect(openJob().solution!.note!.label).toBe("advisory, not enforced");
  });

  it("a wording made for other lines is never kept: the key must be the key of exactly these lines", async () => {
    const dir = mkdtempSync(join(tmpdir(), "c8a-replay-"));
    try {
      // A real outcome, worded for a fix line one word longer, handed to the press for the demo lines.
      const otherFix = `${DEMO_FIX} Now.`;
      const place = { seat: "senior-manager", version: "1.0", job: job("2318") };
      saveReplay(newSolutionSpec(v10, otherFix, DEMO_WHY, place).key, { text: SUGGESTION, pass: true }, dir);
      const other = await newSolution(v10, otherFix, DEMO_WHY, place, "replay", { replayDir: dir });
      expect(other.banner).toBe(REPLAY_BANNER);
      const r = runAction(
        { seat: "senior-manager", action: "log-new-solution", jobId: "2318", payload: { fixLine: DEMO_FIX, whyLine: DEMO_WHY } },
        REAL_NOW,
        { solutionWording: other }
      );
      expect(r.ok, r.message).toBe(true);
      const s = solution();
      expect(s.ai.banner).toBeNull();
      expect(s.ai.source).toBe("none");
      expect(s.parts.find((p) => p.id === "rule-text")!.suggestedBy).toBe("fix-line");
      expect(s.parts.find((p) => p.id === "effect-1")!.suggested).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a refused press never reaches the AI", async () => {
    let calls = 0;
    const counting: ModelClient = {
      async complete() {
        calls += 1;
        return { content: SUGGESTION, finish: "stop" };
      },
    };
    smTick("thermostat-spot", "clear");
    const r = await logDemo("live", { client: counting, keyPresent: true });
    expect(r.ok).toBe(false);
    expect(calls).toBe(0);
  });
});

// ---- Run rule 6: the demo new solution on Replay, read only ----

describe("C8a run rule 6: the demo new solution on Replay finds the saved real answer", () => {
  it('Log new solution with the demo lines on Replay: the banner "replay: saved real AI answer", then the demo path to HQ', async () => {
    const REPLAY = join(process.cwd(), "data", "replay");
    const filesBefore = readdirSync(REPLAY).sort();
    escalate2318();
    expect(smTick("thermostat-spot", "found").ok).toBe(true);

    const r = await logDemo("replay", { replayDir: REPLAY });
    expect(r.ok, r.message).toBe(true);
    const s = solution();
    expect(s.ai.banner).toBe(REPLAY_BANNER);
    expect(s.ai.source).toBe("replay");
    expect(s.ai.aiCalls).toBe(0);
    expect(openJob().solution!.aiBanner).toBe(REPLAY_BANNER);
    // The saved suggestion, as recorded: the fix line as the rule text, fit-out-12m, put-first 21 only.
    expect(s.parts.map((p) => [p.id, p.suggested, p.suggestedBy])).toEqual([
      ["rule-text", DEMO_FIX, "ai"],
      ["fact", "fit-out-12m", "ai"],
      ["effect-1", "put-first:21", "ai"],
      ["effect-2", null, null],
    ]);

    // The demo path: the senior manager changes the effects to the fixture's rule, confirms each part,
    // runs the tests on that exact draft hash, and Send to HQ opens.
    confirmDemoParts();
    expect(draftPill(solution()).rules.find((x) => x.id === "TS-CC-27")).toEqual(fixtureRule);
    const run = press("senior-manager", "run-tests", "2318");
    expect(run.ok, run.message).toBe(true);
    expect(solution().testRun!.failed).toBe(0);
    expect(solution().testRun!.draftHash).toBe(solution().hash);
    const sent = press("senior-manager", "send-to-hq", "2318");
    expect(sent.ok, sent.message).toBe(true);
    expect(readdirSync(REPLAY).sort()).toEqual(filesBefore);
  });
});

// ---- T-C8a bullet 4 and item 5: no charge request here ----

describe("T-C8a: logging the solution with thermostat-spot found opens no A4 request", () => {
  it("the AOM's chat has no charge request through log, confirm, run and send", async () => {
    escalate2318();
    smTick("thermostat-spot", "found");
    const requestsBefore = memory.read().requests.length;
    await logDemo("off");
    confirmDemoParts();
    press("senior-manager", "run-tests", "2318");
    expect(press("senior-manager", "send-to-hq", "2318").ok).toBe(true);
    const state = memory.read();
    expect(state.requests).toHaveLength(requestsBefore);
    expect(state.requests.some((r) => (r as { kind?: string }).kind === "A4")).toBe(false);
    expect(state.notices.filter((n) => n.seat === "aom-tower-a" && n.kind === "charge-request")).toEqual([]);
    expect(state.messages.filter((m) => m.seat === "aom-tower-a")).toEqual([]);
    expect(JSON.stringify(seatView(state, "tenant"))).not.toMatch(/\$|SGD|dollar|cents/i);
  });
});

// ---- T-C8a bullet 5: Ask HQ for outside help (A3, cut 8) ----

describe("T-C8a: Ask HQ for outside help", () => {
  beforeEach(() => {
    escalate2318();
  });

  const HELP = { need: "contractor", reason: "The air needs a specialist balance", needsMoney: true };

  it("moves the job to outside-help-requested and the request reaches HQ", () => {
    const r = press("senior-manager", "ask-outside-help", "2318", HELP);
    expect(r.ok, r.message).toBe(true);
    expect(job("2318").status).toBe("outside-help-requested");
    const request = memory.read().requests.find((x) => (x as { kind?: string }).kind === "A3") as Record<string, unknown>;
    expect(request).toMatchObject({
      kind: "A3",
      status: "open",
      seat: "hq",
      jobId: "2318",
      need: "contractor",
      reason: HELP.reason,
      needsMoney: true,
      askedBy: "senior-manager",
    });
    expect(JSON.stringify(request)).not.toMatch(/amount/i);
    const hq = memory.read().notices.filter((n) => n.seat === "hq" && n.kind === "outside-help");
    expect(hq).toHaveLength(1);
    expect(hq[0].text).toContain(HELP.reason);
    expect(hq[0].text).toContain("Needs money: yes");
    expect(openJob().outsideHelp).not.toBeNull();
  });

  it("needs contractor or budget, a reason of 3 words or more, and needs money yes or no", () => {
    const bad = [
      { ...HELP, need: "money" },
      { ...HELP, reason: "Too cold" },
      { need: "budget", reason: HELP.reason },
    ];
    for (const payload of bad) {
      const r = press("senior-manager", "ask-outside-help", "2318", payload);
      expect(r.ok, JSON.stringify(payload)).toBe(false);
    }
    expect(job("2318").status).toBe("escalated");
    expect(memory.read().requests).toEqual([]);
  });

  it("no amount in the text (S13): a reason with an amount is refused", () => {
    const r = press("senior-manager", "ask-outside-help", "2318", { ...HELP, reason: "Balancing will cost S$500 at least" });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/amount/i);
    expect(memory.read().requests).toEqual([]);
  });

  it("only the senior manager asks, and only on an escalated job", () => {
    expect(press("technician", "ask-outside-help", "2318", HELP).ok).toBe(false);
    expect(press("hq", "ask-outside-help", "2318", HELP).ok).toBe(false);
    expect(press("senior-manager", "ask-outside-help", "2318", HELP).ok).toBe(true);
    expect(press("senior-manager", "ask-outside-help", "2318", HELP).ok).toBe(false);
  });
});

// ---- T-C8a bullet 6: Clear stop (cut 6) ----

describe("T-C8a: Clear stop, senior manager only, with the safety record tick only where it is needed", () => {
  function raise(stopId: string) {
    const r = press("technician", "safety-pick", "2318", { stopId });
    expect(r.ok, r.message).toBe(true);
    return memory.read().openRedStops.find((s) => s.stopId === stopId && s.clearedAt === null)!;
  }

  it("the stops whose who_to_call names the Fire Safety Manager are RS-01 and RS-06, read from the pill", () => {
    expect(v10.red_stops.filter((s) => needsSafetyRecord(s)).map((s) => s.id)).toEqual(["RS-01", "RS-06"]);
    expect(SAFETY_RECORD_LINE).toBe("Safety record: Fire Safety Manager told and agreed (role-played)");
  });

  it("RS-04 clears with a reason of 3 words or more and no tick: logged with who and when, the jobs unlock", () => {
    const stop = raise("RS-04");
    expect(openStopsOnJob(memory.read(), job("2318")).length).toBe(1);
    const r = press("senior-manager", "clear-stop", undefined, { stop: openStopKey(stop), reason: "Ceiling is dry again" });
    expect(r.ok, r.message).toBe(true);
    const cleared = memory.read().openRedStops.find((s) => s.stopId === "RS-04")!;
    expect(cleared.clearedBySeat).toBe("senior-manager");
    expect(cleared.clearedAt).toBe("2026-10-06T10:00:00+08:00");
    expect(cleared.clearedReason).toBe("Ceiling is dry again");
    expect(cleared.safetyRecord).toBeUndefined();
    expect(openStopsOnJob(memory.read(), job("2318"))).toEqual([]);
  });

  it("RS-05 needs no tick", () => {
    const stop = raise("RS-05");
    expect(press("senior-manager", "clear-stop", undefined, { stop: openStopKey(stop), reason: "First aider has taken over" }).ok).toBe(true);
  });

  for (const stopId of ["RS-01", "RS-06"]) {
    it(`${stopId} needs the safety record tick, labelled a safety record, not an approval`, () => {
      const stop = raise(stopId);
      const row = desk().stops.find((s) => s.stopId === stopId)!;
      expect(row.needsSafetyRecord).toBe(true);
      expect(row.safetyRecordLabel).toBe(SAFETY_RECORD_LINE);
      expect(row.note).toBe(SAFETY_RECORD_NOTE);
      expect(SAFETY_RECORD_NOTE).toBe("This is a safety record, not an approval.");

      const without = press("senior-manager", "clear-stop", undefined, { stop: openStopKey(stop), reason: "All clear from the wardens" });
      expect(without.ok).toBe(false);
      expect(without.message).toContain("Fire Safety Manager");
      expect(memory.read().openRedStops.find((s) => s.stopId === stopId)!.clearedAt).toBeNull();

      const withTick = press("senior-manager", "clear-stop", undefined, {
        stop: openStopKey(stop),
        reason: "All clear from the wardens",
        safetyRecord: true,
      });
      expect(withTick.ok, withTick.message).toBe(true);
      const cleared = memory.read().openRedStops.find((s) => s.stopId === stopId)!;
      expect(cleared.safetyRecord).toBe(SAFETY_RECORD_LINE);
      const card = memory.read().messages.filter((m) => m.seat === "senior-manager").pop()!;
      expect(card.text).toContain(SAFETY_RECORD_LINE);
      expect(card.text).toContain(SAFETY_RECORD_NOTE);
      expect(card.text).not.toMatch(/\bapproved\b/i);
    });
  }

  it("RS-04's row on the desk carries no tick", () => {
    raise("RS-04");
    const row = desk().stops.find((s) => s.stopId === "RS-04")!;
    expect(row.needsSafetyRecord).toBe(false);
    expect(row.safetyRecordLabel).toBeUndefined();
  });

  it("a reason under 3 words is refused", () => {
    const stop = raise("RS-04");
    const r = press("senior-manager", "clear-stop", undefined, { stop: openStopKey(stop), reason: "All dry" });
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Clear stop needs a reason of 3 words or more.");
  });

  it("only the senior manager clears a stop", () => {
    const stop = raise("RS-04");
    for (const seat of ["technician", "hq", "aom-tower-a", "tenant"]) {
      const r = press(seat, "clear-stop", undefined, { stop: openStopKey(stop), reason: "Ceiling is dry again" });
      expect(r.ok, seat).toBe(false);
      expect(r.message).toBe("Only the senior manager clears a safety stop.");
    }
  });

  it("a stop that is not open cannot be cleared", () => {
    const r = press("senior-manager", "clear-stop", undefined, { stop: "RS-04|nowhere", reason: "Ceiling is dry again" });
    expect(r.ok).toBe(false);
    expect(r.message).toBe("There is no open red stop like that.");
  });
});

// ---- C8a item 7: Confirm cause on pending cases, never for the fixer ----

describe("C8a item 7: Confirm cause on the senior manager seat", () => {
  const HOT_WEST_BLINDS_DOWN: [string, string][] = [
    ["Q0", "No"],
    ["Q1", "West glass boardroom"],
    ["Q2", "This week"],
    ["Q3", "No"],
    ["Q4-blinds", "Yes"],
  ];

  it("a case the technician saved is on the list with Confirm cause, and the press confirms it", () => {
    const landed = selfCheck("too hot", HOT_WEST_BLINDS_DOWN);
    const id = landed.jobId!;
    expect(press("technician", "open-job", id).ok).toBe(true);
    const lead = leadsForJob(memory.read(), job(id), "technician", REAL_NOW).leads.find((l) => l.fixAllowedHere)!;
    expect(lead).toBeDefined();
    expect(press("technician", "tick", id, { causeId: lead.causeId, type: "found" }).ok).toBe(true);
    expect(press("technician", "solved", id, { whyLine: "The blinds were left up all afternoon." }).ok).toBe(true);

    const row = desk().cases.find((c) => c.jobId === id)!;
    expect(row.canConfirm).toBe(true);
    const r = press("senior-manager", "confirm-cause", undefined, { caseId: row.id });
    expect(r.ok, r.message).toBe(true);
    expect(memory.read().runtimeCases.find((c) => c.id === row.id)!.confirmedBy).toBe("senior-manager");
    expect(desk().cases.find((c) => c.id === row.id)).toBeUndefined();
  });

  it("a case the senior manager fixed shows with no Confirm cause: a second person confirms it", () => {
    escalate2318();
    smTick("precool", "clear");
    smTick("precool", "found");
    expect(press("senior-manager", "solved", "2318", { whyLine: "The pre-cool started two hours early." }).ok).toBe(true);
    const row = desk().cases.find((c) => c.jobId === "2318")!;
    expect(row.canConfirm).toBe(false);
    expect(row.note).toBe("You fixed this one: a second person confirms the cause.");
    expect(press("senior-manager", "confirm-cause", undefined, { caseId: row.id }).ok).toBe(false);
  });
});

// ---- C8a item 10: typed fix and why lines only flag red words (S12) ----

describe("C8a item 10: typed fix and why lines only flag red words: no alert, no lock", () => {
  it("a red word in the fix line shows a flag, and opens no stop and sends no alert", async () => {
    escalate2318();
    smTick("thermostat-spot", "found");
    const before = memory.read();
    const alertsBefore = before.notices.filter((n) => n.kind === "alert").length;
    const fixLine = "Check the thermostat spot first, and keep away if water is dripping from the ceiling.";
    const r = await actionTurn(
      { seat: "senior-manager", action: "log-new-solution", jobId: "2318", payload: { fixLine, whyLine: DEMO_WHY } },
      "off",
      undefined,
      REAL_NOW
    );
    expect(r.ok, r.message).toBe(true);
    expect(solution().flags.fixLine).toEqual(["RS-04"]);
    expect(solution().flags.whyLine).toEqual([]);
    expect(openJob().solution!.fixFlags).toEqual(["RS-04"]);
    const after = memory.read();
    expect(after.openRedStops).toEqual(before.openRedStops);
    expect(after.notices.filter((n) => n.kind === "alert").length).toBe(alertsBefore);
    expect(openStopsOnJob(after, job("2318"))).toEqual([]);
  });
});

// ---- Rank wording on the senior manager's list (S15, cut 5 built) ----

describe("C8a: the senior manager's ranked list carries rank wording made for that seat", () => {
  it("after Not solved, the job's live leads are worded for the senior manager, shown only under the reason worded", async () => {
    const dir = mkdtempSync(join(tmpdir(), "c8a-rank-"));
    try {
      expect(selfCheck("too cold", COLD_CORE_KEEPS).jobId).toBe("2318");
      press("technician", "open-job", "2318");
      press("technician", "tick", "2318", { causeId: "precool", type: "not-this" });
      press("technician", "tick", "2318", { causeId: "min-airflow", type: "not-this" });
      // What the senior manager's list will rank once 2318 is escalated: the same ticks, its own seat.
      const state = memory.read();
      const leads = leadsForJob(state, job("2318"), "senior-manager", REAL_NOW).leads;
      const place = { seat: "senior-manager", version: "1.0", job: job("2318") };
      for (const lead of leads) saveReplay(rankWordingSpec(v10, lead, place).key, { text: "This is the best first check for this spot.", pass: true }, dir);

      const r = await actionTurn({ seat: "technician", action: "not-solved", jobId: "2318", payload: IMPACT }, "replay", { replayDir: dir }, REAL_NOW);
      expect(r.ok).toBe(true);
      const shown = seatView(memory.read(), "senior-manager", "replay", REAL_NOW).manager!.open!.open.leads;
      expect(shown.map((l) => l.causeId)).toEqual(["thermostat-spot", "rebalance"]);
      for (const lead of shown) {
        expect(lead.aiBanner, lead.causeId).toBe(REPLAY_BANNER);
        expect(lead.aiWording).toBe("This is the best first check for this spot.");
      }
      // The technician's own desk never shows the senior manager's wording.
      const techView = seatView(memory.read(), "technician", "replay", REAL_NOW).desk!.open!;
      expect(techView.leads.every((l) => l.aiWording === undefined)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---- The seat's view is built from the one memory ----

describe("C8a: managerDesk reads the memory it is given", () => {
  it("returns the same desk as seatView, and the technician seat gets no manager desk", () => {
    escalate2318();
    expect(managerDesk(memory.read(), REAL_NOW)).toEqual(desk());
    expect(seatView(memory.read(), "technician", undefined, REAL_NOW).manager).toBeUndefined();
  });

  it("the menu on the desk lists only what the code menu allows", () => {
    escalate2318();
    const menu = desk().menu;
    expect(menu.facts.map((f) => f.value)).toEqual(["fit-out-12m", "repeat", "opposite-fixes"]);
    const effects = menu.effects.map((e) => e.value);
    expect(effects).toContain("block:25");
    expect(effects).toContain("put-first:21");
    expect(effects.filter((e) => e.startsWith("block:"))).toEqual(["block:25"]);
    for (const banned of ["put-first:5", "put-first:25", "put-first:26", "put-first:31", "block:8"]) {
      expect(effects).not.toContain(banned);
    }
  });
});
