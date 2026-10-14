/**
 * C8b review fixes (two reviewers, checked on disk before any change).
 *
 * - Approve is refused when the draft was built on a version that is no
 *   longer live: a draft built on v1.1 after v1.1 was rolled back would bring
 *   its rule back, and a draft built on v1.0 after v1.1 went live would drop
 *   v1.1's rule. Either way HQ sees why on its desk before pressing.
 * - A later solution starts the next version even while an earlier draft is
 *   still waiting (S16 item 8).
 * - Each A4 request gets its own id, whoever opened it.
 * - HQ's "What needs me" drops a solution or an A3 request HQ has decided.
 * - The Building B card shows only the newest version notice, so the line
 *   under its live version never contradicts it.
 * - The floor's jobs stay locked through Approve, shown by a press the status
 *   gate allows.
 * - Approve and Roll back word Building B's 2401 for the technician seat.
 *
 * Every press goes through the real gate and body. Fake clients only; nothing
 * here reads web/data/replay/.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { existsSync, readFileSync } from "fs";
import { parse } from "yaml";
import * as memory from "../lib/memory";
import { resetDemo, runAction, openStopsOnJob } from "../lib/actions";
import { actionTurn } from "../lib/action-turn";
import { seatView } from "../lib/seat-view";
import { leadsForJob } from "../lib/leads";
import { loadAndCheckPill, type Pill } from "../lib/pill";
import { currentSolution, type Solution } from "../lib/senior-manager-flow";
import { type HqDesk } from "../lib/hq-desk";
import { versionList, signedPillPath } from "../lib/versions";
import { buildingBAlerts } from "../app/components/BuildingBCard";
import { rankWordingSpec, type ModelClient, type AiMessage } from "../lib/ai";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");
const AT_20 = new Date("2026-10-06T20:00:00+08:00");

const DEMO_FIX =
  "If the zone had a fit-out in the last 12 months, check where the thermostat sits against the fit-out drawing before any nudge.";
const DEMO_WHY =
  "The fit-out 8 months ago moved the core thermostat next to the new printer bay, so it reads warm and the box keeps cooling the open area.";

/**
 * A second solution, on Building B's 2401: lines of 3 to 30 words, no floor,
 * tenant or amount named. It puts step 17 first, which both open jobs already
 * rank first on v1.0, so its R-01 passes whichever job is still open.
 */
const B_FIX = "Check the box minimum airflow setting against the design sheet before any other step.";
const B_WHY = "The box minimum airflow was left too high after the last balance, so the open area keeps getting cold air.";
const B_PARTS: [string, string][] = [
  ["rule-text", B_FIX],
  ["fact", "repeat"],
  ["effect-1", "put-first:17"],
  ["effect-2", "none"],
];

const IMPACT = { hoursLost: 3, extraVisits: 2, contractorOrPartsNeeded: false };

beforeEach(() => {
  resetDemo(REAL_NOW);
});

// ---- Helpers: every press goes through the real gate and body ----

function press(seat: string, action: string, jobId?: string, payload?: Record<string, unknown>, at: Date = REAL_NOW) {
  return runAction({ seat, action, jobId, payload }, at);
}

function ok(seat: string, action: string, jobId?: string, payload?: Record<string, unknown>, at: Date = REAL_NOW) {
  const r = press(seat, action, jobId, payload, at);
  expect(r.ok, `${seat} ${action} ${jobId ?? ""}: ${r.message}`).toBe(true);
  return r;
}

function job(id: string) {
  return memory.jobById(memory.read(), id)!;
}

function solution(jobId = "2318"): Solution {
  const s = currentSolution(memory.read(), jobId);
  expect(s).toBeDefined();
  return s!;
}

function live() {
  return memory.read().liveVersionByBuilding;
}

function desk(): HqDesk {
  const view = seatView(memory.read(), "hq", undefined, REAL_NOW);
  expect(view.hq).toBeDefined();
  return view.hq!;
}

/** The demo up to the senior manager on 2318: the self-check, Open, Not this twice, Not solved. */
function escalate2318() {
  const report = ok("tenant", "report", undefined, { complaint: "too cold" });
  for (const [questionId, answer] of [
    ["Q0", "No"],
    ["Q1", "Open area near the lift core"],
    ["Q2", "It keeps coming back"],
    ["Q3", "Yes"],
    ["Q4-thermostat", "Not sure"],
  ]) {
    ok("tenant", "answer", report.jobId, { questionId, answer });
  }
  ok("technician", "open-job", "2318");
  ok("technician", "tick", "2318", { causeId: "precool", type: "not-this" });
  ok("technician", "tick", "2318", { causeId: "min-airflow", type: "not-this" });
  ok("technician", "not-solved", "2318", IMPACT);
  expect(job("2318").status).toBe("escalated");
}

async function log(jobId: string, fixLine: string, whyLine: string, mode: "off" | "live" = "off", client?: ModelClient) {
  const r = await actionTurn(
    { seat: "senior-manager", action: "log-new-solution", jobId, payload: { fixLine, whyLine } },
    mode,
    client ? { client, keyPresent: true } : undefined,
    REAL_NOW
  );
  expect(r.ok, r.message).toBe(true);
}

function confirmParts(jobId: string, parts: [string, string][]) {
  for (const [part, value] of parts) ok("senior-manager", "confirm-part", jobId, { part, value });
}

/** Found it on thermostat-spot, the demo lines, each part confirmed: 2318's draft is saved, not tested yet. */
async function draft2318() {
  escalate2318();
  ok("senior-manager", "tick", "2318", { causeId: "thermostat-spot", type: "found" });
  await log("2318", DEMO_FIX, DEMO_WHY);
  confirmParts("2318", [
    ["rule-text", DEMO_FIX],
    ["fact", "fit-out-12m"],
    ["effect-1", "block:25"],
    ["effect-2", "put-first:21"],
  ]);
}

function runAndSend(jobId = "2318") {
  ok("senior-manager", "run-tests", jobId);
  ok("senior-manager", "send-to-hq", jobId);
  expect(solution(jobId).status).toBe("sent-to-hq");
}

async function sentToHq() {
  await draft2318();
  runAndSend("2318");
}

/** 2318's solution approved: v1.1 live in every building. */
async function approved2318() {
  await sentToHq();
  ok("hq", "approve-solution", "2318");
  expect(live()).toEqual({ "tower-a": "1.1", "building-b": "1.1" });
}

/** Building B's 2401 up to the senior manager: Open, Not this on its first two leads, Not solved. */
function escalate2401() {
  ok("technician", "open-job", "2401");
  const firstTwo = leadsForJob(memory.read(), job("2401"), "technician", REAL_NOW)
    .leads.slice(0, 2)
    .map((l) => l.causeId);
  expect(firstTwo).toHaveLength(2);
  for (const causeId of firstTwo) ok("technician", "tick", "2401", { causeId, type: "not-this" });
  ok("technician", "not-solved", "2401", IMPACT);
  expect(job("2401").status).toBe("escalated");
}

/** A second solution on 2401, every part confirmed, saved but not tested. */
async function draft2401() {
  escalate2401();
  ok("senior-manager", "tick", "2401", { causeId: "min-airflow", type: "found" });
  await log("2401", B_FIX, B_WHY);
  confirmParts("2401", B_PARTS);
  expect(solution("2401").draftFile).toBeDefined();
}

// ---- Major: Approve is refused when the draft's base is no longer the live version ----

const STALE_ROLLED_BACK =
  "This draft was built on v1.1, which was rolled back: every building is on v1.0 now, so approving it would bring back what v1.1 added. Decline it, and the senior manager logs the solution again on v1.0.";
const STALE_OLDER =
  "This draft was built on v1.0, but v1.1 is live in every building now, so approving it would drop what v1.1 added. Decline it, and the senior manager logs the solution again on v1.1.";

describe("C8b review: Approve needs the draft built on the version live now", () => {
  it("a draft built on v1.1, then v1.1 rolled back: Approve is refused with its reason, nothing changes, and v1.1's rule never comes back", async () => {
    await approved2318();
    await draft2401();
    expect(solution("2401").baseVersion).toBe("1.1");
    expect(solution("2401").version).toBe("1.2");
    ok("hq", "rollback", undefined, { version: "1.1" });
    expect(live()).toEqual({ "tower-a": "1.0", "building-b": "1.0" });
    runAndSend("2401");
    expect(solution("2401").testRun!.failed).toBe(0);

    // HQ sees it on the desk before pressing: the four gates still hold, and the base check fails with its reason.
    const view = desk().solutions.find((s) => s.jobId === "2401")!;
    expect(view.gates.every((g) => g.holds)).toBe(true);
    expect(view.baseCheck).toEqual({
      id: "base",
      label: "Built on the version live now",
      holds: false,
      word: "Fails",
      colour: "red",
      reason: STALE_ROLLED_BACK,
    });
    expect(view.canDecide).toBe(true);

    const before = JSON.stringify(memory.read());
    const r = press("hq", "approve-solution", "2401");
    expect(r.ok).toBe(false);
    expect(r.message).toBe(STALE_ROLLED_BACK);
    expect(JSON.stringify(memory.read())).toBe(before);
    expect(live()).toEqual({ "tower-a": "1.0", "building-b": "1.0" });
    expect(existsSync(signedPillPath("ts-cc", "1.2"))).toBe(false);
    expect(versionList(memory.read()).map((v) => [v.version, v.status])).toEqual([
      ["1.1", "rolled back"],
      ["1.0", "live"],
    ]);
    // S-1's card stays true: every building is on v1.0.
    expect(desk().solutions.find((s) => s.jobId === "2318")!.statusLine).toMatch(/every building is on v1\.0 again\.$/);
    expect(desk().rollback).toBeNull();
  });

  it("after that refusal HQ declines, and the senior manager logs the solution again on v1.0, which can go live without v1.1's rule", async () => {
    await approved2318();
    await draft2401();
    ok("hq", "rollback", undefined, { version: "1.1" });
    runAndSend("2401");
    expect(press("hq", "approve-solution", "2401").ok).toBe(false);
    ok("hq", "decline-solution", "2401", { reason: "Built on a rolled back version" });
    expect(job("2401").status).toBe("escalated");

    await log("2401", B_FIX, B_WHY);
    expect(solution("2401").baseVersion).toBe("1.0");
    expect(solution("2401").version).toBe("1.2");
    confirmParts("2401", B_PARTS);
    runAndSend("2401");
    expect(desk().solutions.find((s) => s.jobId === "2401" && s.status === "sent-to-hq")!.baseCheck).toBeNull();
    ok("hq", "approve-solution", "2401");
    expect(live()).toEqual({ "tower-a": "1.2", "building-b": "1.2" });
    const signed = parse(readFileSync(signedPillPath("ts-cc", "1.2"), "utf-8")) as Pill;
    expect(signed.rules.some((r) => r.id === "TS-CC-27" && r.rule === DEMO_FIX)).toBe(false);
    expect(versionList(memory.read())[0].line).toMatch(/^v1\.2 · .* · parent v1\.0$/);
  });

  it("a draft built on v1.0 while another solution went live as v1.1: Approve is refused, so v1.1's rule is never dropped", async () => {
    await sentToHq();
    await draft2401();
    expect(solution("2401").baseVersion).toBe("1.0");
    runAndSend("2401");
    ok("hq", "approve-solution", "2318");
    expect(live()).toEqual({ "tower-a": "1.1", "building-b": "1.1" });

    expect(desk().solutions.find((s) => s.jobId === "2401")!.baseCheck!.reason).toBe(STALE_OLDER);
    const before = JSON.stringify(memory.read());
    const r = press("hq", "approve-solution", "2401");
    expect(r.ok).toBe(false);
    expect(r.message).toBe(STALE_OLDER);
    expect(JSON.stringify(memory.read())).toBe(before);
    expect(live()).toEqual({ "tower-a": "1.1", "building-b": "1.1" });
  });

  it("a draft built on the version live now shows no base check, and the gates alone decide", async () => {
    await sentToHq();
    expect(desk().solutions[0].baseCheck).toBeNull();
    ok("hq", "approve-solution", "2318");
  });

  it("an approved solution's card says where the buildings are when a later version went live after its rollback", async () => {
    await approved2318();
    ok("hq", "rollback", undefined, { version: "1.1" });
    memory.update((s) => {
      s.jobs.find((j) => j.id === "2318")!.status = "escalated";
    });
    await log("2318", DEMO_FIX, DEMO_WHY);
    confirmParts("2318", [
      ["rule-text", DEMO_FIX],
      ["fact", "fit-out-12m"],
      ["effect-1", "block:25"],
      ["effect-2", "put-first:21"],
    ]);
    runAndSend("2318");
    ok("hq", "approve-solution", "2318");
    expect(live()).toEqual({ "tower-a": "1.2", "building-b": "1.2" });
    const first = desk().solutions.find((s) => s.id === "S-1")!;
    expect(first.statusLine).toBe(
      "Approved by HQ pill owner (role-played), 6 Oct, 10:00, then rolled back, 6 Oct, 10:00: every building went back to v1.0; v1.2 is live now."
    );
  });
});

// ---- Minor: a later solution starts the next version while an earlier draft waits ----

describe("C8b review: a later solution starts the next version (S16 item 8), even while an earlier draft waits", () => {
  it("2318's draft is v1.1; 2401's draft logged on the same live version is v1.2", async () => {
    await sentToHq();
    expect(solution("2318").version).toBe("1.1");
    await draft2401();
    expect(solution("2401").baseVersion).toBe("1.0");
    expect(solution("2401").version).toBe("1.2");
    const draft = parse(readFileSync(`${memory.runtimeDir()}/${solution("2401").draftFile}`, "utf-8")) as Pill;
    expect(draft.version).toBe("1.2");
  });

  it("a declined draft frees its number: after Decline, the next draft takes v1.1 again", async () => {
    await sentToHq();
    ok("hq", "decline-solution", "2318", { reason: "Check the drawing with the tenant first" });
    await log("2318", DEMO_FIX, DEMO_WHY);
    expect(solution("2318").version).toBe("1.1");
  });
});

// ---- Minor: each A4 request has its own id ----

describe("C8b review: each A4 request has its own id, whoever opened it", () => {
  it("an A3 request, an after-hours A4 and then HQ's Approve A4: three different ids", async () => {
    escalate2318();
    ok("senior-manager", "ask-outside-help", "2318", { need: "contractor", reason: "The air needs a specialist balance", needsMoney: true });
    ok("hq", "decide-outside-help", "2318", { decision: "approve", reason: "Book the balancing contractor now" });

    const report = ok("tenant", "report", undefined, { complaint: "too cold" }, AT_20);
    for (const [questionId, answer] of [
      ["Q0", "No"],
      ["Q1", "Somewhere else"],
      ["Q2", "Today"],
      ["Q3", "No"],
      ["Q4-after-hours", "Yes"],
    ]) {
      ok("tenant", "answer", report.jobId, { questionId, answer }, AT_20);
    }
    const afterHours = (memory.read().requests as { kind?: string }[]).filter((r) => r.kind === "A4");
    expect(afterHours).toHaveLength(1);

    // The after-hours report leaves an escalated 2318 where it is, so the senior manager goes on.
    expect(job("2318").status).toBe("escalated");
    ok("senior-manager", "tick", "2318", { causeId: "thermostat-spot", type: "found" });
    await log("2318", DEMO_FIX, DEMO_WHY);
    confirmParts("2318", [
      ["rule-text", DEMO_FIX],
      ["fact", "fit-out-12m"],
      ["effect-1", "block:25"],
      ["effect-2", "put-first:21"],
    ]);
    runAndSend("2318");
    ok("hq", "approve-solution", "2318");

    const ids = (memory.read().requests as { id: string; kind?: string }[]).map((r) => r.id);
    expect(ids.filter((id) => id.startsWith("A4-"))).toHaveLength(2);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---- Minor: HQ's "What needs me" drops what HQ has decided ----

async function hqNeeds(): Promise<string> {
  const { chatTurn } = await import("../lib/chat-turn");
  const r = await chatTurn({ seat: "hq", text: "What needs me", job: "2318" }, "off", undefined, REAL_NOW);
  expect(r.status).toBe(200);
  return r.status === 200 ? String(r.body.cards[0].body) : "";
}

describe("C8b review: HQ's What needs me lists only what still waits on HQ", () => {
  it("the solution sent to HQ is listed until HQ approves it", async () => {
    await sentToHq();
    expect(await hqNeeds()).toContain("New solution for job 2318 sent to HQ (A2)");
    ok("hq", "approve-solution", "2318");
    const after = await hqNeeds();
    expect(after).not.toContain("sent to HQ (A2)");
    expect(after).toBe("Nothing is waiting on you right now.");
  });

  it("a declined solution leaves the list, and a later one sent again is listed once", async () => {
    await sentToHq();
    ok("hq", "decline-solution", "2318", { reason: "Check the drawing with the tenant first" });
    expect(await hqNeeds()).not.toContain("sent to HQ (A2)");

    await log("2318", DEMO_FIX, DEMO_WHY);
    confirmParts("2318", [
      ["rule-text", DEMO_FIX],
      ["fact", "fit-out-12m"],
      ["effect-1", "block:25"],
      ["effect-2", "put-first:21"],
    ]);
    runAndSend("2318");
    const again = await hqNeeds();
    expect(again.split("New solution for job 2318 sent to HQ (A2)").length - 1).toBe(1);
  });

  it("an outside help request is listed until HQ decides it", async () => {
    escalate2318();
    ok("senior-manager", "ask-outside-help", "2318", { need: "contractor", reason: "The air needs a specialist balance", needsMoney: true });
    expect(await hqNeeds()).toContain("Outside help asked for job 2318 (A3)");
    ok("hq", "decide-outside-help", "2318", { decision: "decline", reason: "Try the fit-out contractor first" });
    expect(await hqNeeds()).not.toContain("Outside help asked for job 2318 (A3)");
  });

  it("the seat's notice log keeps every notice: only the chip's list drops what HQ decided", async () => {
    await sentToHq();
    ok("hq", "approve-solution", "2318");
    expect(seatView(memory.read(), "hq").notices.some((n) => n.kind === "solution-sent")).toBe(true);
  });
});

// ---- Minor: the Building B card shows only the newest version notice ----

describe("C8b review: the Building B card's version notice matches its live version", () => {
  const LIVE_11 = "v1.1 is live in every building (role-played approval by HQ).";
  const ROLLED_11 = "v1.1 was rolled back: every building is on v1.0 again (role-played decision by HQ).";

  it("after Approve then Roll back, home and the HQ seat show only the rolled-back notice under v1.0", async () => {
    await approved2318();
    expect(buildingBAlerts(memory.read()).map((n) => n.text)).toEqual([LIVE_11]);
    ok("hq", "rollback", undefined, { version: "1.1" });

    expect(buildingBAlerts(memory.read()).map((n) => n.text)).toEqual([ROLLED_11]);
    const card = desk().buildingB!;
    expect(card.version).toBe("1.0");
    expect(card.alerts.map((a) => a.text)).toEqual([ROLLED_11]);
    // The memory keeps both notices: nothing is deleted.
    expect(memory.read().notices.filter((n) => n.seat === "building-b-card").map((n) => n.text)).toEqual([LIVE_11, ROLLED_11]);
  });

  it("safety alerts all stay on the card, in their order, next to the newest version notice", async () => {
    await approved2318();
    ok("technician", "safety-pick", "2401", { stopId: "RS-04" });
    ok("hq", "rollback", undefined, { version: "1.1" });
    const alerts = buildingBAlerts(memory.read());
    expect(alerts.map((a) => a.kind)).toEqual(["alert", "rolled-back"]);
    expect(alerts[0].text).toMatch(/RS-04/);
    expect(desk().buildingB!.alerts.map((a) => a.kind)).toEqual(["alert", "rolled-back"]);
  });
});

// ---- Minor: the floor's jobs stay locked through Approve, shown by a press the status gate allows ----

describe("C8b review: an open red stop keeps its jobs locked through Approve", () => {
  it("with RS-04 open on 2318 and on 2401, Approve still works, and a technician tick on the in-progress 2401 is refused by the lock", async () => {
    await draft2318();
    ok("technician", "open-job", "2401");
    expect(job("2401").status).toBe("in-progress");
    // Both allowed by the status gate before the stops: 2401 is in progress.
    ok("technician", "safety-pick", "2318", { stopId: "RS-04" });
    ok("technician", "safety-pick", "2401", { stopId: "RS-04" });
    const stopsBefore = JSON.stringify(memory.read().openRedStops);

    runAndSend("2318");
    expect(solution("2318").testRun!.results.find((x) => x.id === "R-01")!.status).toBe("passed");
    ok("hq", "approve-solution", "2318");
    expect(live()).toEqual({ "tower-a": "1.1", "building-b": "1.1" });

    const state = memory.read();
    expect(JSON.stringify(state.openRedStops)).toBe(stopsBefore);
    expect(openStopsOnJob(state, memory.jobById(state, "2318")!).map((s) => s.stopId)).toEqual(["RS-04"]);
    expect(openStopsOnJob(state, memory.jobById(state, "2401")!).map((s) => s.stopId)).toEqual(["RS-04"]);

    // An open stop hides the leads (a safety pause), so the tick names precool, 2401's first lead on v1.0.
    const tick = press("technician", "tick", "2401", { causeId: "precool", type: "not-this" });
    expect(tick.ok).toBe(false);
    expect(tick.message).toBe("Safety stop open on this floor.");
    expect(job("2401").status).toBe("in-progress");
  });
});

// ---- Minor: Approve and Roll back word Building B's 2401 for the technician seat ----

function fakeClient(answer: string) {
  const calls: AiMessage[][] = [];
  const client: ModelClient = {
    async complete(messages) {
      calls.push(messages);
      return { content: answer, finish: "stop" };
    },
  };
  return { client, calls };
}

const WORDING = "Check this lead before the others.";

function keys2401(version: string): string[] {
  const state = memory.read();
  const j = memory.jobById(state, "2401")!;
  const pill = loadAndCheckPill("ts-cc", version);
  return leadsForJob(state, j, "technician", REAL_NOW).leads.map(
    (lead) => rankWordingSpec(pill, lead, { seat: "technician", version, job: j }).key
  );
}

describe("C8b review: after Approve and Roll back, 2401's live leads are worded for the technician seat", () => {
  it("Approve on Live: one call per 2401 lead on v1.1, each kept by its replay key, and the HQ seat's Building B card shows the wording", async () => {
    await sentToHq();
    const { client, calls } = fakeClient(WORDING);
    const aiBefore = memory.read().aiCalls ?? 0;
    const r = await actionTurn({ seat: "hq", action: "approve-solution", jobId: "2318" }, "live", { client, keyPresent: true }, REAL_NOW);
    expect(r.ok, r.message).toBe(true);

    const keys = keys2401("1.1");
    expect(keys.length).toBeGreaterThan(0);
    expect(calls).toHaveLength(keys.length);
    expect(memory.read().aiCalls).toBe(aiBefore + keys.length);
    const kept = memory.read().leadWordings ?? {};
    for (const key of keys) expect(kept[key]?.aiWording, key).toBe(WORDING);

    const card = seatView(memory.read(), "hq", "live", REAL_NOW).hq!.buildingB!;
    expect(card.version).toBe("1.1");
    expect(card.leads[0].causeId).toBe("thermostat-spot");
    for (const lead of card.leads) expect(lead.aiWording).toBe(WORDING);
  });

  it("Roll back on Live words 2401's leads again on v1.0", async () => {
    await sentToHq();
    ok("hq", "approve-solution", "2318");
    const { client, calls } = fakeClient(WORDING);
    const r = await actionTurn({ seat: "hq", action: "rollback", payload: { version: "1.1" } }, "live", { client, keyPresent: true }, REAL_NOW);
    expect(r.ok, r.message).toBe(true);
    const keys = keys2401("1.0");
    expect(calls).toHaveLength(keys.length);
    const kept = memory.read().leadWordings ?? {};
    for (const key of keys) expect(kept[key]?.aiWording, key).toBe(WORDING);
    const card = seatView(memory.read(), "hq", "live", REAL_NOW).hq!.buildingB!;
    expect(card.version).toBe("1.0");
    expect(card.leads[0].causeId).toBe("precool");
    for (const lead of card.leads) expect(lead.aiWording).toBe(WORDING);
  });

  it("a refused Approve or Roll back words nothing, and Off makes no call", async () => {
    const { client, calls } = fakeClient(WORDING);
    const refused = await actionTurn({ seat: "hq", action: "approve-solution", jobId: "2318" }, "live", { client, keyPresent: true }, REAL_NOW);
    expect(refused.ok).toBe(false);
    const none = await actionTurn({ seat: "hq", action: "rollback" }, "live", { client, keyPresent: true }, REAL_NOW);
    expect(none.ok).toBe(false);
    expect(calls).toHaveLength(0);

    await sentToHq();
    const off = await actionTurn({ seat: "hq", action: "approve-solution", jobId: "2318" }, "off", { client, keyPresent: true }, REAL_NOW);
    expect(off.ok, off.message).toBe(true);
    expect(calls).toHaveLength(0);
    expect(memory.read().leadWordings ?? {}).toEqual({});
  });
});
