/**
 * C8b: HQ approves and sends to every building (S2 A1 to A3, S16 items 5 and
 * 8 to 11, S17's A4 opening and A3, S21's HQ row and the Building B card,
 * T-C8b).
 *
 * Every press goes through the real gate and body (runAction, or actionTurn
 * where the AI drafts first). Fake clients only: tests/setup.ts keeps the key
 * empty and the network blocked, and tests/setup-replay.ts points the replay
 * folder at an empty temp folder. Nothing here reads web/data/replay/.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync, existsSync, writeFileSync, statSync } from "fs";
import { join, resolve } from "path";
import { parse, stringify } from "yaml";
import * as memory from "../lib/memory";
import { resetDemo, runAction, openStopsOnJob } from "../lib/actions";
import { actionTurn } from "../lib/action-turn";
import { seatView } from "../lib/seat-view";
import { leadsForJob } from "../lib/leads";
import { loadPill, loadAndCheckPill, type Pill } from "../lib/pill";
import { draftHash } from "../lib/draft";
import { runtimeCaseOutcome } from "../lib/calls";
import { wordLeads } from "../lib/ai-wording";
import { buildingBAlerts } from "../app/components/BuildingBCard";
import { currentSolution, type Solution } from "../lib/senior-manager-flow";
import { managerDesk } from "../lib/senior-manager-desk";
import { hqDesk, type HqDesk } from "../lib/hq-desk";
import { approveGates, HQ_SIGNATURE, liveNoticeText, type HqSolution } from "../lib/hq-flow";
import { versionList, nextFreeVersion, signedPillPath } from "../lib/versions";
import type { ModelClient } from "../lib/ai";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");
const v10 = loadPill("ts-cc", "1.0");

/** The demo solution (S16 item 2), from the role-played senior manager. */
const DEMO_FIX =
  "If the zone had a fit-out in the last 12 months, check where the thermostat sits against the fit-out drawing before any nudge.";
const DEMO_WHY =
  "The fit-out 8 months ago moved the core thermostat next to the new printer bay, so it reads warm and the box keeps cooling the open area.";

/** T-C8b's charge request, word for word (S17 with thermostat-spot's tenantSolution). */
const CHARGE_TEXT =
  'Tenant will hear: "Our contractor will move the wall thermostat back to the spot on your approved fit-out drawing, with your OK." This is work on the tenant\'s fit-out (TS-CC-11). Who pays?';

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

function solution(jobId = "2318"): Solution {
  const s = currentSolution(memory.read(), jobId);
  expect(s).toBeDefined();
  return s!;
}

const COLD_CORE_KEEPS: [string, string][] = [
  ["Q0", "No"],
  ["Q1", "Open area near the lift core"],
  ["Q2", "It keeps coming back"],
  ["Q3", "Yes"],
  ["Q4-thermostat", "Not sure"],
];

/** The demo up to the senior manager: the self-check, Open, Not this twice, Not solved. */
function escalate2318() {
  const report = press("tenant", "report", undefined, { complaint: "too cold" });
  expect(report.ok).toBe(true);
  for (const [questionId, answer] of COLD_CORE_KEEPS) {
    expect(press("tenant", "answer", report.jobId, { questionId, answer }).ok).toBe(true);
  }
  expect(press("technician", "open-job", "2318").ok).toBe(true);
  expect(press("technician", "tick", "2318", { causeId: "precool", type: "not-this" }).ok).toBe(true);
  expect(press("technician", "tick", "2318", { causeId: "min-airflow", type: "not-this" }).ok).toBe(true);
  const r = press("technician", "not-solved", "2318", IMPACT);
  expect(r.ok, r.message).toBe(true);
  expect(job("2318").status).toBe("escalated");
}

async function logDemo(mode: "off" | "live" = "off", client?: ModelClient) {
  const r = await actionTurn(
    { seat: "senior-manager", action: "log-new-solution", jobId: "2318", payload: { fixLine: DEMO_FIX, whyLine: DEMO_WHY } },
    mode,
    client ? { client, keyPresent: true } : undefined,
    REAL_NOW
  );
  expect(r.ok, r.message).toBe(true);
}

/** The fixture's rule, part by part (block 25, then put-first 21). */
function confirmDemoParts() {
  for (const [part, value] of [
    ["rule-text", DEMO_FIX],
    ["fact", "fit-out-12m"],
    ["effect-1", "block:25"],
    ["effect-2", "put-first:21"],
  ]) {
    const r = press("senior-manager", "confirm-part", "2318", { part, value });
    expect(r.ok, `${part}: ${r.message}`).toBe(true);
  }
}

/** Found it on thermostat-spot, Log new solution, each part confirmed: the draft is saved, not tested yet. */
async function draftDemo() {
  escalate2318();
  expect(press("senior-manager", "tick", "2318", { causeId: "thermostat-spot", type: "found" }).ok).toBe(true);
  await logDemo("off");
  confirmDemoParts();
}

function runAndSend() {
  const run = press("senior-manager", "run-tests", "2318");
  expect(run.ok, run.message).toBe(true);
  const sent = press("senior-manager", "send-to-hq", "2318");
  expect(sent.ok, sent.message).toBe(true);
}

/** The C8a steps to Send to HQ: the draft is with HQ, its tests passed on this exact draft. */
async function sentToHq() {
  await draftDemo();
  runAndSend();
  expect(solution().status).toBe("sent-to-hq");
}

function approve() {
  return press("hq", "approve-solution", "2318");
}

function first2401(): string {
  const state = memory.read();
  return leadsForJob(state, memory.jobById(state, "2401")!, "technician", REAL_NOW).leads[0].causeId;
}

function live() {
  return memory.read().liveVersionByBuilding;
}

function desk(): HqDesk {
  const view = seatView(memory.read(), "hq", undefined, REAL_NOW);
  expect(view.hq).toBeDefined();
  return view.hq!;
}

function draftPath(s: Solution = solution()): string {
  return join(memory.runtimeDir(), s.draftFile!);
}

/** Every file under the runtime folder, with its folder. */
function runtimeFiles(dir = memory.runtimeDir(), prefix = ""): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...runtimeFiles(path, `${prefix}${name}/`));
    else out.push(`${prefix}${name}`);
  }
  return out.sort();
}

/** Change the stored solution or its run, as a test sets up a state the presses cannot reach. */
function changeSolution(fn: (s: Solution) => void) {
  memory.update((state) => {
    fn(currentSolution(state, "2318")!);
  });
}

// ---- T-C8b bullet 1: 2401 ranks the thermostat check first only after Approve ----

describe("T-C8b: 2401 ranks the thermostat check first only after the new solution is approved and distributed", () => {
  it("with the draft sent to HQ and its tests passed, 2401's first lead is precool; after Approve it is thermostat-spot, and both buildings are on 1.1", async () => {
    await sentToHq();
    expect(solution().testRun!.failed).toBe(0);
    expect(solution().testRun!.draftHash).toBe(solution().hash);
    expect(first2401()).toBe("precool");
    expect(live()).toEqual({ "tower-a": "1.0", "building-b": "1.0" });

    const r = approve();
    expect(r.ok, r.message).toBe(true);
    expect(first2401()).toBe("thermostat-spot");
    expect(live()).toEqual({ "tower-a": "1.1", "building-b": "1.1" });
  });

  it("every building moves at once: one Approve and no per-building accept", async () => {
    await sentToHq();
    expect(approve().ok).toBe(true);
    const buildings = JSON.parse(readFileSync(join(process.cwd(), "data", "buildings.json"), "utf-8")) as { id: string }[];
    expect(buildings.length).toBeGreaterThanOrEqual(2);
    for (const b of buildings) expect(live()[b.id], b.id).toBe("1.1");
    expect(Object.values(live()).every((v) => v === "1.1")).toBe(true);
  });

  it("the live v1.1 is the approved draft, loaded from the version HQ signed in the runtime folder", async () => {
    await sentToHq();
    expect(() => loadPill("ts-cc", "1.1")).toThrow();
    const draft = readFileSync(draftPath(), "utf-8");
    expect(approve().ok).toBe(true);
    expect(resolve(signedPillPath("ts-cc", "1.1")).startsWith(resolve(memory.runtimeDir()))).toBe(true);
    expect(readFileSync(signedPillPath("ts-cc", "1.1"), "utf-8")).toBe(draft);
    expect(loadAndCheckPill("ts-cc", "1.1")).toEqual(parse(draft));
    expect(existsSync(join(process.cwd(), "pills", "ts-cc", "v1.1.yaml"))).toBe(false);
  });

  it("the Building B card's leads (the same wordLeads the home card uses, AI off) put thermostat-spot first on v1.1", async () => {
    await sentToHq();
    const before = await wordLeads(memory.read(), job("2401"), "technician", "off", undefined, REAL_NOW);
    expect(before.items[0].lead.causeId).toBe("precool");
    expect(approve().ok).toBe(true);
    const after = await wordLeads(memory.read(), job("2401"), "technician", "off", undefined, REAL_NOW);
    expect(after.items[0].lead.causeId).toBe("thermostat-spot");
    expect(after.items.length).toBe(3);
  });

  it("the HQ seat's Building B card shows the live version and 2401's first 3 leads, thermostat-spot first only after Approve", async () => {
    await sentToHq();
    expect(desk().buildingB!.version).toBe("1.0");
    expect(desk().buildingB!.leads[0].causeId).toBe("precool");
    expect(approve().ok).toBe(true);
    const card = desk().buildingB!;
    expect(card.title).toBe("Building B, Level 12 (made up)");
    expect(card.version).toBe("1.1");
    expect(card.leads.map((l) => l.causeId)).toEqual(
      leadsForJob(memory.read(), job("2401"), "technician", REAL_NOW).leads.slice(0, 3).map((l) => l.causeId)
    );
    expect(card.leads[0].causeId).toBe("thermostat-spot");
    expect(card.leads[0].reason.length).toBeGreaterThan(0);
  });

  it("the HQ seat's Building B card has only Safety for its own stops: the pill's 10 and what is open in Building B", () => {
    const card = desk().buildingB!;
    expect(card.stops.map((s) => s.id)).toEqual(v10.red_stops.map((s) => s.id));
    expect(card.openHere).toEqual([]);
    expect(press("technician", "safety-pick", "2318", { stopId: "RS-04" }).ok).toBe(true);
    expect(desk().buildingB!.openHere).toEqual([]);
    expect(press("technician", "safety-pick", "2401", { stopId: "RS-04" }).ok).toBe(true);
    expect(desk().buildingB!.openHere).toEqual(["RS-04"]);
    expect(desk().buildingB!.alerts.some((a) => a.kind === "alert" && /RS-04/.test(a.text))).toBe(true);
  });
});

// ---- T-C8b bullet 2: Approve is refused unless every S16 item 8 gate holds ----

describe("T-C8b: Approve is refused unless every gate in S16 item 8 holds, each with its plain reason", () => {
  beforeEach(async () => {
    await sentToHq();
  });

  function refusedAndUnchanged(expected: RegExp) {
    const before = JSON.stringify(memory.read());
    const filesBefore = runtimeFiles();
    const r = approve();
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(expected);
    expect(JSON.stringify(memory.read())).toBe(before);
    expect(runtimeFiles()).toEqual(filesBefore);
    expect(live()).toEqual({ "tower-a": "1.0", "building-b": "1.0" });
    expect(existsSync(signedPillPath("ts-cc", "1.1"))).toBe(false);
    return r;
  }

  it("with every gate holding, the HQ desk lists the four gates as holding", () => {
    const view = desk().solutions.find((s) => s.jobId === "2318")!;
    expect(view.gates.map((g) => [g.id, g.holds, g.word])).toEqual([
      ["tests", true, "Holds"],
      ["hash", true, "Holds"],
      ["red-stops", true, "Holds"],
      ["pill-check", true, "Holds"],
    ]);
    expect(view.canDecide).toBe(true);
  });

  it("refused with no test run", () => {
    changeSolution((s) => {
      delete s.testRun;
    });
    refusedAndUnchanged(/No test run is stored on this draft/);
  });

  it("refused with a failed run", () => {
    changeSolution((s) => {
      const r = s.testRun!;
      r.results[0] = { ...r.results[0], status: "failed", label: "failed: made up for this test" };
      r.passed -= 1;
      r.failed = 1;
      r.ok = false;
    });
    refusedAndUnchanged(/The stored test run has 1 failed/);
  });

  it("refused when the stored run did not run every case", () => {
    changeSolution((s) => {
      const r = s.testRun!;
      const dropped = r.results.find((x) => x.id === "GT-22")!;
      r.results = r.results.filter((x) => x.id !== "GT-22");
      if (dropped.status === "passed") r.passed -= 1;
    });
    refusedAndUnchanged(/did not run every case: GT-22/);
  });

  it('refused with "draft changed since the tests" when the run saw an earlier draft', () => {
    changeSolution((s) => {
      s.testRun!.draftHash = "0".repeat(64);
    });
    refusedAndUnchanged(/draft changed since the tests/);
  });

  it('refused with "draft changed since the tests" when the saved draft file is not the one tested', () => {
    const path = draftPath();
    const pill = parse(readFileSync(path, "utf-8")) as Pill;
    pill.rules[pill.rules.length - 1].because = "A different why line, written after the tests ran.";
    writeFileSync(path, stringify(pill), "utf-8");
    refusedAndUnchanged(/draft changed since the tests/);
  });

  it("refused when the draft's red_stops differ from v1.0's, even with a passing run on that exact draft", () => {
    const path = draftPath();
    const pill = parse(readFileSync(path, "utf-8")) as Pill;
    pill.red_stops[3] = { ...pill.red_stops[3], action: "Carry on and check it later." };
    const yaml = stringify(pill);
    writeFileSync(path, yaml, "utf-8");
    changeSolution((s) => {
      s.hash = draftHash(yaml);
      s.testRun!.draftHash = draftHash(yaml);
    });
    // checkPill holds the same rule for every version above 1.0 (S4 item 6), so the pill check fails with it.
    const gates = approveGates(memory.read(), solution() as HqSolution);
    expect(gates.filter((g) => !g.holds).map((g) => g.id)).toEqual(["red-stops", "pill-check"]);
    expect(gates.find((g) => g.id === "pill-check")!.reason).toMatch(/red stop RS-04 .*differs from v1\.0/);
    refusedAndUnchanged(/red stops differ from v1\.0's/);
  });

  it("refused when the draft fails the pill check (loadAndCheckPill)", () => {
    const path = draftPath();
    const pill = parse(readFileSync(path, "utf-8")) as Pill;
    (pill.rules[pill.rules.length - 1] as unknown as Record<string, unknown>).rule = "";
    const yaml = stringify(pill);
    writeFileSync(path, yaml, "utf-8");
    changeSolution((s) => {
      s.hash = draftHash(yaml);
      s.testRun!.draftHash = draftHash(yaml);
    });
    const gates = approveGates(memory.read(), solution() as HqSolution);
    expect(gates.find((g) => g.id === "pill-check")!.holds).toBe(false);
    refusedAndUnchanged(/fails the pill check/);
  });

  it("every failing gate gives its own reason, and the HQ desk shows each with its word", () => {
    changeSolution((s) => {
      s.testRun!.draftHash = "0".repeat(64);
      s.testRun!.failed = 2;
    });
    const r = refusedAndUnchanged(/has 2 failed/);
    expect(r.message).toMatch(/draft changed since the tests/);
    const view = desk().solutions.find((s) => s.jobId === "2318")!;
    expect(view.gates.filter((g) => !g.holds).map((g) => [g.id, g.word])).toEqual([
      ["tests", "Fails"],
      ["hash", "Fails"],
    ]);
  });

  it("only HQ approves (A2): the senior manager and the AOM are refused and nothing changes", () => {
    for (const seat of ["senior-manager", "aom-tower-a", "technician", "tenant"]) {
      const before = JSON.stringify(memory.read());
      const r = press(seat, "approve-solution", "2318");
      expect(r.ok, seat).toBe(false);
      expect(r.message).toMatch(/^Only HQ approves a new solution \(A2\)\.$/);
      expect(JSON.stringify(memory.read())).toBe(before);
    }
  });
});

describe("T-C8b: Approve needs a solution sent to HQ", () => {
  it("refused on a job with no solution sent to HQ", async () => {
    await draftDemo();
    const r = approve();
    expect(r.ok).toBe(false);
    expect(r.message).toBe("There is no new solution from job 2318 waiting for HQ (A2).");
    expect(job("2318").status).toBe("new-solution-drafted");
  });

  it("refused with no job named", () => {
    const r = press("hq", "approve-solution");
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Pick a job first.");
  });
});

// ---- T-C8b bullet 3: after Approve ----

describe("T-C8b: after Approve", () => {
  beforeEach(async () => {
    await sentToHq();
    const r = approve();
    expect(r.ok, r.message).toBe(true);
  });

  it("2318's case is in the memory as pending, fixedBy senior-manager, confirmedBy hq; the job shows pending-30-day", () => {
    const state = memory.read();
    const cases = state.runtimeCases.filter((c) => c.jobId === "2318");
    expect(cases).toHaveLength(1);
    const c = cases[0];
    expect(c).toMatchObject({
      jobId: "2318",
      building: "tower-a",
      floor: 23,
      zone: "core",
      causeId: "thermostat-spot",
      fixedBy: "senior-manager",
      confirmedBy: "hq",
      fix: DEMO_FIX,
      why: DEMO_WHY,
    });
    expect(c.facts).toContain("fit-out-12m");
    expect(c.fixedAt.startsWith("2026-10-06")).toBe(true);
    expect(runtimeCaseOutcome(state, c, memory.now(state, REAL_NOW))).toBe("pending");
    const j = job("2318");
    expect(j.status).toBe("pending-30-day");
    expect(j.fixerSeat).toBe("senior-manager");
    expect(j.whyLine).toBe(DEMO_WHY);
    expect(j.foundLeadId).toBe("thermostat-spot");
  });

  it("the solution is approved-and-distributed, signed HQ pill owner (role-played)", () => {
    const s = solution() as HqSolution;
    expect(s.status).toBe("approved-and-distributed");
    expect(s.decidedBy).toBe("hq");
    expect(HQ_SIGNATURE).toBe("HQ pill owner (role-played)");
    const v = versionList(memory.read())[0];
    expect(v.version).toBe("1.1");
    expect(v.signedBy).toBe(HQ_SIGNATURE);
  });

  it("the signed file is frozen: its bytes never change after a later action", () => {
    const path = signedPillPath("ts-cc", "1.1");
    const bytes = readFileSync(path);
    const again = approve();
    expect(again.ok).toBe(false);
    expect(readFileSync(path).equals(bytes)).toBe(true);
    expect(press("hq", "rollback", undefined, { version: "1.1" }).ok).toBe(true);
    expect(readFileSync(path).equals(bytes)).toBe(true);
    expect(press("technician", "safety-pick", "2401", { stopId: "RS-04" }).ok).toBe(true);
    expect(readFileSync(path).equals(bytes)).toBe(true);
    expect(draftHash(readFileSync(path, "utf-8"))).toBe(solution().hash);
  });

  it("notices go to the senior manager, the AOM and the Building B card: v1.1 is live in every building", () => {
    const text = "v1.1 is live in every building (role-played approval by HQ).";
    expect(liveNoticeText("1.1")).toBe(text);
    const state = memory.read();
    for (const seat of ["senior-manager", "aom-tower-a", "building-b-card"]) {
      expect(state.notices.filter((n) => n.seat === seat && n.text === text), seat).toHaveLength(1);
    }
    expect(buildingBAlerts(state).some((n) => n.text === text)).toBe(true);
    expect(seatView(state, "senior-manager").notices.some((n) => n.text === text)).toBe(true);
    expect(seatView(state, "aom-tower-a").notices.some((n) => n.text === text)).toBe(true);
  });

  it("a second Approve is refused and changes nothing", () => {
    const before = JSON.stringify(memory.read());
    const r = approve();
    expect(r.ok).toBe(false);
    expect(r.message).toBe("There is no new solution from job 2318 waiting for HQ (A2).");
    expect(JSON.stringify(memory.read())).toBe(before);
  });

  it("2318 leaves the senior manager's desk and the HQ desk shows it approved, with no buttons", () => {
    expect(managerDesk(memory.read(), REAL_NOW).jobs.map((j) => j.id)).not.toContain("2318");
    const view = desk().solutions.find((s) => s.jobId === "2318")!;
    expect(view.status).toBe("approved-and-distributed");
    expect(view.statusWord).toBe("Approved and distributed");
    expect(view.canDecide).toBe(false);
  });

  it("the HQ chat gets a code card saying what happened, with AI calls 0", () => {
    const last = memory.read().messages.filter((m) => m.seat === "hq").pop()!;
    expect(last.from).toBe("pip");
    expect(last.text).toContain("v1.1 is live in every building");
    expect(JSON.stringify(last.cards)).toContain("AI calls: 0");
  });
});

// ---- T-C8b bullet 4: the A4 charge request opens on Approve, never on Decline ----

describe("T-C8b: the A4 charge request opens on Approve, not before, and never on Decline", () => {
  it("no request with the draft sent to HQ; after Approve the AOM's chat gets it, word for word", async () => {
    await sentToHq();
    expect(memory.read().requests.some((r) => (r as { kind?: string }).kind === "A4")).toBe(false);
    expect(approve().ok).toBe(true);

    const state = memory.read();
    const a4 = state.requests.filter((r) => (r as { kind?: string }).kind === "A4") as Record<string, unknown>[];
    expect(a4).toHaveLength(1);
    expect(a4[0]).toMatchObject({ kind: "A4", status: "open", seat: "aom-tower-a", jobId: "2318", text: CHARGE_TEXT });
    expect(JSON.stringify(a4[0])).not.toMatch(/amount|S\$/i);

    const aom = seatView(state, "aom-tower-a").notices.filter((n) => n.kind === "charge-request");
    expect(aom).toHaveLength(1);
    expect(aom[0].text.startsWith('Tenant will hear: "Our contractor will move the wall thermostat back to the spot on your approved fit-out drawing, with your OK."')).toBe(true);
    expect(aom[0].text).toBe(CHARGE_TEXT);
  });

  it("the tenant hears nothing yet: no fix and no price in the tenant's chat before the AOM decides", async () => {
    await sentToHq();
    expect(approve().ok).toBe(true);
    const tenant = JSON.stringify(seatView(memory.read(), "tenant"));
    expect(tenant).not.toContain("Our contractor will move");
    expect(tenant).not.toMatch(/S\$|SGD|dollar/i);
  });

  it("after Decline, no request and no charge notice", async () => {
    await sentToHq();
    const r = press("hq", "decline-solution", "2318", { reason: "Check the drawing with the tenant first" });
    expect(r.ok, r.message).toBe(true);
    const state = memory.read();
    expect(state.requests.some((x) => (x as { kind?: string }).kind === "A4")).toBe(false);
    expect(state.notices.filter((n) => n.kind === "charge-request")).toEqual([]);
  });
});

// ---- T-C8b bullet 5: R-01 and an open red stop ----

describe("T-C8b: R-01 ranks with the rules only, and an open red stop stays open", () => {
  it("with RS-04 raised by a button on Tower A Level 23, Run tests still passes R-01 and Approve still works; the stop stays open and the floor's jobs stay locked", async () => {
    await draftDemo();
    const raised = press("technician", "safety-pick", "2318", { stopId: "RS-04" });
    expect(raised.ok, raised.message).toBe(true);
    const stop = memory.read().openRedStops.find((s) => s.stopId === "RS-04" && s.clearedAt === null)!;
    expect(stop.source).toBe("button");
    expect(stop.building).toBe("tower-a");
    expect(stop.floor).toBe(23);
    expect(stop.lockedJobIds).toContain("2318");

    runAndSend();
    const r01 = solution().testRun!.results.find((x) => x.id === "R-01")!;
    expect(r01.status).toBe("passed");
    expect(solution().testRun!.failed).toBe(0);

    const r = approve();
    expect(r.ok, r.message).toBe(true);
    expect(live()).toEqual({ "tower-a": "1.1", "building-b": "1.1" });

    const state = memory.read();
    const still = state.openRedStops.find((s) => s.stopId === "RS-04" && s.building === "tower-a")!;
    expect(still.clearedAt).toBeNull();
    expect(openStopsOnJob(state, memory.jobById(state, "2318")!).map((s) => s.stopId)).toEqual(["RS-04"]);
    expect(press("technician", "tick", "2318", { causeId: "sun-west", type: "not-this" }).ok).toBe(false);
  });
});

// ---- T-C8b item 7: Decline ----

describe("C8b: Decline", () => {
  beforeEach(async () => {
    await sentToHq();
  });

  it("needs a reason of 3 words or more, and a refusal changes nothing", () => {
    for (const reason of [undefined, "", "Not yet", "  no   "]) {
      const before = JSON.stringify(memory.read());
      const r = press("hq", "decline-solution", "2318", reason === undefined ? {} : { reason });
      expect(r.ok).toBe(false);
      expect(r.message).toBe("Decline needs a reason of 3 words or more.");
      expect(JSON.stringify(memory.read())).toBe(before);
    }
  });

  it("with a reason, the job goes back to escalated, no version moves, and the senior manager sees why", () => {
    const reason = "Check the drawing with the tenant first";
    const r = press("hq", "decline-solution", "2318", { reason });
    expect(r.ok, r.message).toBe(true);
    expect(job("2318").status).toBe("escalated");
    expect(live()).toEqual({ "tower-a": "1.0", "building-b": "1.0" });
    expect(existsSync(signedPillPath("ts-cc", "1.1"))).toBe(false);
    const s = solution() as HqSolution;
    expect(s.status).toBe("declined");
    expect(s.declineReason).toBe(reason);
    expect(versionList(memory.read()).map((v) => v.version)).toEqual(["1.0"]);

    const sm = memory.read().notices.filter((n) => n.seat === "senior-manager" && n.kind === "solution-declined");
    expect(sm).toHaveLength(1);
    expect(sm[0].text).toContain(reason);
    const open = managerDesk(memory.read(), REAL_NOW).open!;
    expect(open.open.jobId).toBe("2318");
    expect(open.solution!.statusLine).toBe(`Declined by HQ: ${reason}.`);
    expect(open.solution!.canEdit).toBe(false);
    expect(open.editable).toBe(true);
    expect(first2401()).toBe("precool");
  });

  it("only HQ declines", () => {
    const r = press("senior-manager", "decline-solution", "2318", { reason: "Not good enough yet" });
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Only HQ declines a new solution (A2).");
  });

  it("after Decline the senior manager can log a new solution again, as the next draft", async () => {
    expect(press("hq", "decline-solution", "2318", { reason: "Check the drawing with the tenant first" }).ok).toBe(true);
    await logDemo("off");
    const s = solution();
    expect(s.id).toBe("S-2");
    expect(s.status).toBe("draft");
    expect(job("2318").status).toBe("new-solution-drafted");
  });
});

// ---- T-C8b item 8: versions like commits ----

describe("C8b: the versions list, like commits, newest first (S16 item 10)", () => {
  it("before any approval: only v1.0, signed by two senior experts (role-played), live", () => {
    const list = versionList(memory.read());
    expect(list).toHaveLength(1);
    const hash7 = draftHash(readFileSync(join(process.cwd(), "pills", "ts-cc", "v1.0.yaml"), "utf-8")).slice(0, 7);
    expect(list[0].line).toBe(`v1.0 · ${hash7} · signed by two senior experts (role-played)`);
    expect(list[0].status).toBe("live");
  });

  it("after Approve: v1.1 first, with its hash, who approved it and when, its parent and its why line", async () => {
    await sentToHq();
    const hash7 = solution().hash!.slice(0, 7);
    expect(approve().ok).toBe(true);
    const list = versionList(memory.read());
    expect(list.map((v) => v.version)).toEqual(["1.1", "1.0"]);
    expect(list[0].line).toBe(`v1.1 · ${hash7} · approved by HQ pill owner (role-played) · parent v1.0`);
    expect(list[0].parent).toBe("1.0");
    expect(list[0].hash7).toBe(hash7);
    expect(list[0].when).toBe("6 Oct, 10:00");
    expect(list[0].why).toBe(DEMO_WHY);
    expect(list[0].status).toBe("live");
    expect(list[1].status).toBe("earlier");
    expect(desk().versions.map((v) => v.line)).toEqual(list.map((v) => v.line));
  });
});

describe("S19: the Versions chip (HQ only) shows the same list", () => {
  it("after Approve, the chip's card names v1.1's line first, then v1.0's, with A1's line", async () => {
    await sentToHq();
    expect(approve().ok).toBe(true);
    const { chatTurn } = await import("../lib/chat-turn");
    const r = await chatTurn({ seat: "hq", text: "versions", job: "2318" }, "off", undefined, REAL_NOW);
    expect(r.status).toBe(200);
    const body = r.status === 200 ? String(r.body.cards[0].body) : "";
    const list = versionList(memory.read());
    expect(body).toContain("tower-a: v1.1");
    expect(body).toContain("building-b: v1.1");
    expect(body).toContain(memory.read().a1Line);
    expect(body.indexOf(`${list[0].line} (live)`)).toBeGreaterThan(-1);
    expect(body.indexOf(`${list[1].line} (earlier)`)).toBeGreaterThan(body.indexOf(list[0].line));
  });
});

// ---- T-C8b bullet 6: Roll back ----

describe("T-C8b: Roll back (cut 10)", () => {
  it("both buildings back to 1.0, 2401's first lead precool again, v1.1 kept as rolled back, nothing deleted", async () => {
    await sentToHq();
    expect(approve().ok).toBe(true);
    expect(first2401()).toBe("thermostat-spot");
    const filesBefore = runtimeFiles();
    const casesBefore = JSON.stringify(memory.read().runtimeCases);
    const solutionsBefore = memory.read().solutions.length;

    const r = press("hq", "rollback", undefined, { version: "1.1" });
    expect(r.ok, r.message).toBe(true);
    expect(live()).toEqual({ "tower-a": "1.0", "building-b": "1.0" });
    expect(first2401()).toBe("precool");

    const list = versionList(memory.read());
    expect(list.map((v) => [v.version, v.status])).toEqual([
      ["1.1", "rolled back"],
      ["1.0", "live"],
    ]);
    expect(list[0].line).toMatch(/ · rolled back$/);
    expect(runtimeFiles()).toEqual(filesBefore);
    expect(JSON.stringify(memory.read().runtimeCases)).toBe(casesBefore);
    expect(memory.read().solutions.length).toBe(solutionsBefore);
    expect(job("2318").status).toBe("pending-30-day");
  });

  it("render check: the approved solution's card no longer says its version is live once it is rolled back", async () => {
    await sentToHq();
    expect(approve().ok).toBe(true);
    expect(desk().solutions[0].statusLine).toMatch(/v1\.1 is live in every building\.$/);
    expect(press("hq", "rollback", undefined, { version: "1.1" }).ok).toBe(true);
    const view = desk().solutions[0];
    expect(view.status).toBe("approved-and-distributed");
    expect(view.statusWord).toBe("Approved, then rolled back");
    expect(view.colour).toBe("amber");
    expect(view.statusLine).toBe(
      "Approved by HQ pill owner (role-played), 6 Oct, 10:00, then rolled back, 6 Oct, 10:00: every building is on v1.0 again."
    );
    expect(view.statusLine).not.toMatch(/is live/);
  });

  it("notices go to the senior manager, the AOM and the Building B card", async () => {
    await sentToHq();
    expect(approve().ok).toBe(true);
    expect(press("hq", "rollback", undefined, { version: "1.1" }).ok).toBe(true);
    const state = memory.read();
    for (const seat of ["senior-manager", "aom-tower-a", "building-b-card"]) {
      const mine = state.notices.filter((n) => n.seat === seat && n.kind === "rolled-back");
      expect(mine, seat).toHaveLength(1);
      expect(mine[0].text).toBe("v1.1 was rolled back: every building is on v1.0 again (role-played decision by HQ).");
    }
  });

  it("refused with no version above 1.0 live, and for a version that is not the live one", async () => {
    const none = press("hq", "rollback");
    expect(none.ok).toBe(false);
    expect(none.message).toBe("No version above v1.0 is live: there is nothing to roll back.");

    await sentToHq();
    expect(approve().ok).toBe(true);
    const stale = press("hq", "rollback", undefined, { version: "1.2" });
    expect(stale.ok).toBe(false);
    expect(stale.message).toBe("v1.2 is not the live version: v1.1 is.");
    expect(live()).toEqual({ "tower-a": "1.1", "building-b": "1.1" });
  });

  it("only HQ rolls a version back", async () => {
    await sentToHq();
    expect(approve().ok).toBe(true);
    const r = press("senior-manager", "rollback", undefined, { version: "1.1" });
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Only HQ rolls a version back.");
    expect(live()["tower-a"]).toBe("1.1");
  });

  it("the HQ desk offers Roll back only while a version above 1.0 is live", async () => {
    expect(desk().rollback).toBeNull();
    await sentToHq();
    expect(approve().ok).toBe(true);
    expect(desk().rollback).toEqual({
      version: "1.1",
      parent: "1.0",
      line: "Roll back v1.1: every building goes back to v1.0. Nothing is deleted.",
    });
    expect(press("hq", "rollback", undefined, { version: "1.1" }).ok).toBe(true);
    expect(desk().rollback).toBeNull();
  });
});

// ---- S16 item 8: a later solution starts the next version ----

describe("C8b: a later solution starts the next version (S16 item 8)", () => {
  it("the next free version skips every version already made, rolled back or not", async () => {
    expect(nextFreeVersion(memory.read(), "1.0")).toBe("1.1");
    await sentToHq();
    expect(approve().ok).toBe(true);
    expect(nextFreeVersion(memory.read(), "1.1")).toBe("1.2");
    expect(press("hq", "rollback", undefined, { version: "1.1" }).ok).toBe(true);
    expect(nextFreeVersion(memory.read(), "1.0")).toBe("1.2");
  });

  it("after a rollback, a later solution on v1.0 becomes v1.2 with parent v1.0, and v1.1's signed file never changes", async () => {
    await sentToHq();
    expect(approve().ok).toBe(true);
    const signed11 = readFileSync(signedPillPath("ts-cc", "1.1"));
    expect(press("hq", "rollback", undefined, { version: "1.1" }).ok).toBe(true);

    // A later job comes up to the senior manager with the same found cause.
    memory.update((s) => {
      s.jobs.find((j) => j.id === "2318")!.status = "escalated";
    });
    await logDemo("off");
    expect(solution().version).toBe("1.2");
    confirmDemoParts();
    expect((parse(readFileSync(draftPath(), "utf-8")) as Pill).version).toBe("1.2");
    runAndSend();
    const r = approve();
    expect(r.ok, r.message).toBe(true);
    expect(live()).toEqual({ "tower-a": "1.2", "building-b": "1.2" });
    const list = versionList(memory.read());
    expect(list.map((v) => [v.version, v.status, v.parent])).toEqual([
      ["1.2", "live", "1.0"],
      ["1.1", "rolled back", "1.0"],
      ["1.0", "earlier", null],
    ]);
    expect(readFileSync(signedPillPath("ts-cc", "1.1")).equals(signed11)).toBe(true);
  });
});

// ---- T-C8b bullet 7: the A1 card ----

describe("T-C8b: the A1 card", () => {
  it("shows v1.0 signed by two senior experts (role-played) on the HQ seat", () => {
    const d = desk();
    expect(d.a1.line).toBe("v1.0 signed by two senior experts (role-played)");
    expect(d.a1.line).toBe(memory.read().a1Line);
    expect(d.a1.title).toBe("A1: version 1 of the brain");
  });

  it("only the HQ seat carries the HQ desk", () => {
    for (const seat of ["tenant", "technician", "senior-manager", "aom-tower-a"]) {
      expect(seatView(memory.read(), seat, undefined, REAL_NOW).hq, seat).toBeUndefined();
    }
  });
});

// ---- T-C8b bullet 8: outside help (A3, cut 8) ----

describe("T-C8b: outside help (A3): Approve and Decline each need a reason and return the job to escalated", () => {
  const HELP = { need: "contractor", reason: "The air needs a specialist balance", needsMoney: true };

  beforeEach(() => {
    escalate2318();
    const r = press("senior-manager", "ask-outside-help", "2318", HELP);
    expect(r.ok, r.message).toBe(true);
    expect(job("2318").status).toBe("outside-help-requested");
  });

  it("the HQ desk lists the open request with what is needed, the reason and needs money", () => {
    const rows = desk().requests;
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("open");
    expect(rows[0].canDecide).toBe(true);
    expect(rows[0].lines.join(" ")).toContain(HELP.reason);
    expect(rows[0].lines.join(" ")).toContain("a contractor");
    expect(rows[0].lines.join(" ")).toContain("Needs money: yes");
  });

  for (const decision of ["approve", "decline"]) {
    it(`${decision} needs a reason of 3 words or more, and a refusal changes nothing`, () => {
      for (const reason of [undefined, "", "Fine", "Go ahead"]) {
        const before = JSON.stringify(memory.read());
        const r = press("hq", "decide-outside-help", "2318", reason === undefined ? { decision } : { decision, reason });
        expect(r.ok).toBe(false);
        expect(r.message).toBe("Approve or Decline needs a reason of 3 words or more.");
        expect(JSON.stringify(memory.read())).toBe(before);
      }
    });
  }

  it('Approve with a reason: the job back to escalated, "outside help approved (A3)" on its card', () => {
    const r = press("hq", "decide-outside-help", "2318", { decision: "approve", reason: "Book the balancing contractor now" });
    expect(r.ok, r.message).toBe(true);
    expect(job("2318").status).toBe("escalated");
    const request = memory.read().requests.find((x) => (x as { kind?: string }).kind === "A3") as Record<string, unknown>;
    expect(request).toMatchObject({ status: "approved", decidedBy: "hq", decisionReason: "Book the balancing contractor now" });
    const card = managerDesk(memory.read(), REAL_NOW).open!.outsideHelp!;
    expect(card).toContain("outside help approved (A3)");
    expect(desk().requests[0].canDecide).toBe(false);
    expect(desk().requests[0].result).toBe("outside help approved (A3)");
  });

  it('Decline with a reason: the job back to escalated, "declined: {reason}" on its card', () => {
    const reason = "Try the fit-out contractor first";
    const r = press("hq", "decide-outside-help", "2318", { decision: "decline", reason });
    expect(r.ok, r.message).toBe(true);
    expect(job("2318").status).toBe("escalated");
    const card = managerDesk(memory.read(), REAL_NOW).open!.outsideHelp!;
    expect(card).toContain(`declined: ${reason}`);
    expect(desk().requests[0].result).toBe(`declined: ${reason}`);
    const sm = memory.read().notices.filter((n) => n.seat === "senior-manager" && n.kind === "outside-help");
    expect(sm).toHaveLength(1);
    expect(sm[0].text).toContain(`declined: ${reason}`);
  });

  it("refused without Approve or Decline, with an amount in the reason, for another seat, and once decided", () => {
    const pick = press("hq", "decide-outside-help", "2318", { reason: "Book the balancing contractor now" });
    expect(pick.ok).toBe(false);
    expect(pick.message).toBe("Pick Approve or Decline.");

    const amount = press("hq", "decide-outside-help", "2318", { decision: "approve", reason: "Approved up to S$900 for it" });
    expect(amount.ok).toBe(false);
    expect(amount.message).toBe("Leave the amount out: no amount goes in the text (S13).");

    const sm = press("senior-manager", "decide-outside-help", "2318", { decision: "approve", reason: "Book the balancing contractor now" });
    expect(sm.ok).toBe(false);
    expect(sm.message).toBe("Only HQ decides outside help or money (A3).");

    expect(press("hq", "decide-outside-help", "2318", { decision: "approve", reason: "Book the balancing contractor now" }).ok).toBe(true);
    const twice = press("hq", "decide-outside-help", "2318", { decision: "decline", reason: "Changed my mind on this" });
    expect(twice.ok).toBe(false);
    expect(twice.message).toBe("There is no open outside help request on job 2318 (A3).");
  });
});

// ---- S21's HQ row: the solution card ----

describe("S21: HQ sees each solution sent to HQ with its lines, labels, test counts and hash", () => {
  it("AI off: the rule text is typed and every part of the condition is picked by hand", async () => {
    await sentToHq();
    const s = solution();
    const view = desk().solutions.find((x) => x.jobId === "2318")!;
    expect(view.fixLine).toBe(DEMO_FIX);
    expect(view.whyLine).toBe(DEMO_WHY);
    expect(view.ruleText).toBe(DEMO_FIX);
    expect(view.ruleTextLabel).toBe("typed");
    expect(view.condition.map((c) => [c.id, c.display, c.label])).toEqual([
      ["fact", "renovation in the last 12 months", "picked by hand"],
      ["effect-1", "Block step 25", "picked by hand"],
      ["effect-2", "Put step 21 first", "picked by hand"],
    ]);
    expect(view.counts).toBe("23 passed, 0 failed, 2 not applicable");
    expect(view.hash7).toBe(s.hash!.slice(0, 7));
    expect(view.version).toBe("1.1");
    expect(view.statusWord).toBe("Sent to HQ");
    expect(view.place).toBe("Tower A, Level 23, core");
    expect(view.causeLabel).toBe("Thermostat in the wrong spot after a fit-out");
  });

  it("an AI suggestion confirmed as it stands: AI drafted, confirmed by the senior manager; AI suggested from the code menu, confirmed by the senior manager", async () => {
    escalate2318();
    expect(press("senior-manager", "tick", "2318", { causeId: "thermostat-spot", type: "found" }).ok).toBe(true);
    const answer = JSON.stringify({
      ruleText: DEMO_FIX,
      fact: "fit-out-12m",
      effects: [
        { effect: "block", step: 25 },
        { effect: "put-first", step: 21 },
      ],
    });
    const client: ModelClient = {
      async complete() {
        return { content: answer, finish: "stop" };
      },
    };
    await logDemo("live", client);
    confirmDemoParts();
    runAndSend();
    const view = desk().solutions.find((x) => x.jobId === "2318")!;
    expect(view.ruleTextLabel).toBe("AI drafted, confirmed by the senior manager");
    expect(view.condition.map((c) => c.label)).toEqual([
      "AI suggested from the code menu, confirmed by the senior manager",
      "AI suggested from the code menu, confirmed by the senior manager",
      "AI suggested from the code menu, confirmed by the senior manager",
    ]);
  });

  it("a draft still with the senior manager is not on the HQ desk", async () => {
    await draftDemo();
    expect(desk().solutions).toEqual([]);
  });
});

// ---- Typing never approves (S19) ----

describe("S19: typing never approves, declines or rolls back", () => {
  it("typed approve and rollback words on the HQ seat change no status, version or solution", async () => {
    await sentToHq();
    const { chatTurn } = await import("../lib/chat-turn");
    const before = memory.read();
    for (const text of ["approve it", "send to all buildings", "roll back", "decline this one", "versions"]) {
      await chatTurn({ seat: "hq", text, job: "2318" }, "off", undefined, REAL_NOW);
    }
    const after = memory.read();
    expect(after.liveVersionByBuilding).toEqual(before.liveVersionByBuilding);
    expect(JSON.stringify(after.solutions)).toBe(JSON.stringify(before.solutions));
    expect(after.jobs.find((j) => j.id === "2318")!.status).toBe("new-solution-drafted");
    expect(versionList(after).map((v) => v.version)).toEqual(["1.0"]);
    expect(v10.version).toBe("1.0");
  });
});
