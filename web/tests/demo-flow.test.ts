/**
 * C10b: the whole demo, start to end, through the action functions (T-C10b).
 *
 * Every press goes through actionTurn, the code of POST /api/action (seat gate,
 * status gate, safety lock, then the body), and the typed words go through
 * chatTurn, the code of POST /api/chat. The order is T-C10b's: Reset; the
 * tenant's self-check on 2318; Open, 2 Not this ticks, Not solved; the senior
 * manager's Found it, Log new solution, confirms, Run tests, Send to HQ; HQ
 * Approve; 2401's first lead is thermostat-spot; the AOM's charge decision
 * (cut 9 is built, so it stays); the impact numbers; typed red words, then Raise
 * this stop; and AI off gives the same cards.
 *
 * On Replay, network blocked: tests/setup.ts keeps the key empty and makes any
 * fetch throw. The model client below counts its calls and must never be
 * called. Run rule 6 names no C10b test, so nothing here reads web/data/replay/:
 * the one saved answer this run uses is written into the test's own temp
 * folder. It is the AI's suggestion for the demo lines, the fact fit-out-12m
 * and "put step 21 first" as the only effect, the same suggestion C8a's run
 * rule 6 test reads (read only) from the recorded answer. The senior manager
 * changes the effects to block step 25 and put step 21 first, as the demo does.
 */

import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import * as memory from "../lib/memory";
import { runAction, openStopsOnJob, callsForState } from "../lib/actions";
import { actionTurn } from "../lib/action-turn";
import { chatTurn } from "../lib/chat-turn";
import { seatView, type SeatCard } from "../lib/seat-view";
import { leadsForJob } from "../lib/leads";
import { loadPill, loadAndCheckPill } from "../lib/pill";
import { currentSolution } from "../lib/senior-manager-flow";
import { impactFor, IMPACT_LABEL } from "../lib/impact";
import { loadImpactRates } from "../lib/impact-rates";
import { VISIT_BOOKED_LINE } from "../lib/self-check";
import { SEAT_IDS } from "../lib/permissions";
import { newSolutionSpec, saveReplay, REPLAY_BANNER, AI_OFF_LABEL, type AiDeps, type AiMode, type ModelClient } from "../lib/ai";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");
const v10 = loadPill("ts-cc", "1.0");

/** The demo solution (S16 item 2), from the role-played senior manager. */
const DEMO_FIX =
  "If the zone had a fit-out in the last 12 months, check where the thermostat sits against the fit-out drawing before any nudge.";
const DEMO_WHY =
  "The fit-out 8 months ago moved the core thermostat next to the new printer bay, so it reads warm and the box keeps cooling the open area.";

/** The AI's suggestion for the demo lines: the fact, and put step 21 first as the only effect. */
const SUGGESTION = JSON.stringify({ ruleText: DEMO_FIX, fact: "fit-out-12m", effects: [{ effect: "put-first", step: 21 }] });

/** The demo rule (S16): the senior manager's picks, each confirmed with its own button. */
const DEMO_PARTS: [string, string][] = [
  ["rule-text", DEMO_FIX],
  ["fact", "fit-out-12m"],
  ["effect-1", "block:25"],
  ["effect-2", "put-first:21"],
];

const COLD_CORE_KEEPS: [string, string][] = [
  ["Q0", "No"],
  ["Q1", "Open area near the lift core"],
  ["Q2", "It keeps coming back"],
  ["Q3", "Yes"],
  ["Q4-thermostat", "Not sure"],
];

const IMPACT = { hoursLost: 3, extraVisits: 2, contractorOrPartsNeeded: false };

/** T-C8b's charge request, word for word. */
const CHARGE_TEXT =
  'Tenant will hear: "Our contractor will move the wall thermostat back to the spot on your approved fit-out drawing, with your OK." This is work on the tenant\'s fit-out (TS-CC-11). Who pays?';

/** T-C9's tenant card after a decision of 350, word for word. */
const TENANT_CARD_350 =
  "What we will do: Our contractor will move the wall thermostat back to the spot on your approved fit-out drawing, with your OK. Cost: S$350, made-up demo amount. Approved by the AOM (role-played).";

const REASON = "Fit-out work is the tenant's own";

const TS09 = v10.tenant_tips.filter((t) => t.rules.includes("TS-CC-09")).map((t) => t.text);

/** The fields only the AI layer sets on a card. Everything else is code and must not change with the switch. */
const AI_ONLY = ["aiWording", "aiBanner", "aiNotice", "aiOff"] as const;

const ownDirs: string[] = [];
afterAll(() => {
  for (const dir of ownDirs) rmSync(dir, { recursive: true, force: true });
});

/** What a judge would see after one step, with the AI-only fields kept apart. */
interface Snapshot {
  step: string;
  said: string;
  statuses: Record<string, string>;
  chats: Record<string, { from: string; text: string; cards: Record<string, unknown>[] }[]>;
  notices: Record<string, { kind: string; text: string }[]>;
  leads2318: string[];
  leads2401: string[];
  live: Record<string, string>;
  stops: { stopId: string; building: string; floor: number; lockedJobIds: string[] }[];
}

interface DemoRun {
  snapshots: Snapshot[];
  /** Every worded card's AI-only fields, as the seat shows them in this mode. */
  wordedCards: { seat: string; aiJob: string; aiOff?: string; aiBanner?: string }[];
  modelCalls: number;
}

function plainCard(card: SeatCard): Record<string, unknown> {
  const out: Record<string, unknown> = { ...card };
  for (const key of AI_ONLY) delete out[key];
  return out;
}

function leadLine(jobId: string): string[] {
  const state = memory.read();
  return leadsForJob(state, memory.jobById(state, jobId)!, "technician", REAL_NOW).leads.map(
    (l) => `${l.causeId} (${l.tier}): ${l.reason}`
  );
}

function first2401(): string {
  const state = memory.read();
  return leadsForJob(state, memory.jobById(state, "2401")!, "technician", REAL_NOW).leads[0].causeId;
}

function snapshot(step: string, said: string, mode: AiMode): Snapshot {
  const state = memory.read();
  const chats: Snapshot["chats"] = {};
  const notices: Snapshot["notices"] = {};
  for (const seat of SEAT_IDS) {
    const view = seatView(state, seat, mode, REAL_NOW);
    chats[seat] = view.messages.map((m) => ({ from: m.from, text: m.text, cards: (m.cards ?? []).map(plainCard) }));
    notices[seat] = view.notices;
  }
  return {
    step,
    said,
    statuses: Object.fromEntries(state.jobs.map((j) => [j.id, j.status])),
    chats,
    notices,
    leads2318: leadLine("2318"),
    leads2401: leadLine("2401"),
    live: { ...state.liveVersionByBuilding },
    stops: state.openRedStops.map((s) => ({
      stopId: s.stopId,
      building: s.building,
      floor: s.floor,
      lockedJobIds: [...s.lockedJobIds].sort(),
    })),
  };
}

/** Each worded card as the seat shows it in this mode. */
function wordedCards(mode: AiMode): DemoRun["wordedCards"] {
  const state = memory.read();
  const out: DemoRun["wordedCards"] = [];
  for (const seat of SEAT_IDS) {
    for (const m of seatView(state, seat, mode, REAL_NOW).messages) {
      for (const card of m.cards ?? []) {
        if (card.aiJob) out.push({ seat, aiJob: card.aiJob, aiOff: card.aiOff, aiBanner: card.aiBanner });
      }
    }
  }
  return out;
}

function tenantPip() {
  return memory.read().messages.filter((m) => m.seat === "tenant" && m.from === "pip");
}

function aiCount(): number {
  return memory.read().aiCalls ?? 0;
}

/**
 * The whole demo in one mode. Every step is checked as it happens; after each
 * one the run keeps a snapshot, so a second run with the AI off can be
 * compared card for card.
 */
async function runDemo(mode: AiMode): Promise<DemoRun> {
  let modelCalls = 0;
  const counting: ModelClient = {
    async complete() {
      modelCalls += 1;
      return { content: SUGGESTION, finish: "stop" };
    },
  };
  const replayDir = mkdtempSync(join(tmpdir(), "pill-desk-demo-flow-"));
  ownDirs.push(replayDir);
  const deps: AiDeps = { client: counting, replayDir };
  const snapshots: Snapshot[] = [];

  async function press(seat: string, action: string, jobId?: string, payload?: Record<string, unknown>) {
    const r = await actionTurn({ seat, action, jobId, payload }, mode, deps, REAL_NOW);
    expect(r.ok, `${seat} ${action}: ${r.message}`).toBe(true);
    return r;
  }
  function keep(step: string, said: string) {
    snapshots.push(snapshot(step, said, mode));
  }

  // ---- 1. Reset ----
  const reset = await press("hq", "reset");
  const seed = memory.read();
  expect(seed.demoNow).toBe("2026-10-06T10:00:00+08:00");
  expect(seed.jobs.map((j) => [j.id, j.status])).toEqual([
    ["2318", "reported"],
    ["2401", "reported"],
  ]);
  expect(seed.liveVersionByBuilding).toEqual({ "tower-a": "1.0", "building-b": "1.0" });
  expect(seed.solutions).toEqual([]);
  expect(seed.requests).toEqual([]);
  expect(seed.openRedStops).toEqual([]);
  const speakFirst = seed.notices.filter((n) => n.kind === "speak-first");
  expect(speakFirst).toHaveLength(1);
  expect(speakFirst[0].seat).toBe("senior-manager");
  expect(speakFirst[0].text).toContain("5 times in 30 days, with opposite fixes");
  expect(aiCount()).toBe(0);
  keep("Reset", reset.message);

  // ---- 2. The tenant's self-check on 2318 ----
  const report = await press("tenant", "report", undefined, { complaint: "too cold" });
  let last = report;
  for (const [questionId, answer] of COLD_CORE_KEEPS) {
    last = await press("tenant", "answer", report.jobId, { questionId, answer });
  }
  // The answers attach to the open job on the same spot: 2318, and no new job (S10).
  expect(last.jobId).toBe("2318");
  const afterCheck = memory.read();
  expect(afterCheck.jobs.map((j) => j.id)).toEqual(["2318", "2401"]);
  expect(memory.jobById(afterCheck, "2318")!.status).toBe("visit-booked");
  expect(memory.jobById(afterCheck, "2318")!.selfCheckAnswers).toEqual(Object.fromEntries(COLD_CORE_KEEPS));
  const reply = tenantPip().at(-1)!.cards!.at(-1) as SeatCard;
  expect(reply.kind).toBe("tenant-reply");
  expect(reply.body).toBe([VISIT_BOOKED_LINE, ...TS09].join(" "));
  expect(reply.receipt).toContain("AI calls: 0");
  expect(afterCheck.notices.filter((n) => n.kind === "speak-first")).toHaveLength(1);
  keep("Tenant self-check on 2318", last.message);

  // ---- 3. The technician: Open, 2 Not this ticks, Not solved ----
  const opened = await press("technician", "open-job", "2318");
  expect(memory.jobById(memory.read(), "2318")!.status).toBe("in-progress");
  expect(leadLine("2318").map((l) => l.split(" ")[0])).toEqual(["precool", "min-airflow", "thermostat-spot"]);
  keep("Technician: Open job", opened.message);

  await press("technician", "tick", "2318", { causeId: "precool", type: "not-this" });
  const ticked = await press("technician", "tick", "2318", { causeId: "min-airflow", type: "not-this" });
  const afterTicks = memory.read();
  const ranked = leadsForJob(afterTicks, memory.jobById(afterTicks, "2318")!, "technician", REAL_NOW);
  expect(ranked.leads[0].causeId).toBe("thermostat-spot");
  expect(ranked.leads[0].tier).toBe("low-confidence");
  expect(ranked.alertSeniorManager).toBe(true);
  expect(afterTicks.notices.filter((n) => n.seat === "senior-manager" && n.kind === "low-confidence")).toHaveLength(1);
  keep("Technician: 2 Not this ticks", ticked.message);

  const notSolved = await press("technician", "not-solved", "2318", IMPACT);
  const escalated = memory.read();
  expect(memory.jobById(escalated, "2318")!.status).toBe("escalated");
  const escalation = escalated.notices.filter((n) => n.seat === "senior-manager" && n.kind === "escalated");
  expect(escalation).toHaveLength(1);
  expect(escalation[0].text).toContain("S$420");
  keep("Technician: Not solved", notSolved.message);

  // ---- 4. The senior manager: Found it, Log new solution, confirms, Run tests, Send to HQ ----
  const found = await press("senior-manager", "tick", "2318", { causeId: "thermostat-spot", type: "found" });
  keep("Senior manager: Found it", found.message);

  // The AI's suggestion for the demo lines, saved in this run's own replay folder.
  const job2318 = memory.jobById(memory.read(), "2318")!;
  const key = newSolutionSpec(v10, DEMO_FIX, DEMO_WHY, { seat: "senior-manager", version: "1.0", job: job2318 }).key;
  saveReplay(key, { text: SUGGESTION, pass: true }, replayDir);

  const logged = await press("senior-manager", "log-new-solution", "2318", { fixLine: DEMO_FIX, whyLine: DEMO_WHY });
  expect(memory.jobById(memory.read(), "2318")!.status).toBe("new-solution-drafted");
  const drafted = seatView(memory.read(), "senior-manager", mode, REAL_NOW, "2318").manager!.open!.solution!;
  const shown = Object.fromEntries(drafted.parts.map((p) => [p.id, p.shown]));
  expect(shown["rule-text"]).toBe(DEMO_FIX);
  if (mode === "replay") {
    // The AI's suggestion fills the boxes; the senior manager changes both effects below.
    expect(drafted.aiBanner).toBe(REPLAY_BANNER);
    expect(shown).toEqual({ "rule-text": DEMO_FIX, fact: "fit-out-12m", "effect-1": "put-first:21", "effect-2": "none" });
  } else {
    // AI off: the fix line is the rule text, and the fact and effects are picked by hand.
    expect(drafted.aiOff).toBe(AI_OFF_LABEL);
    expect(drafted.parts.filter((p) => p.id !== "rule-text").map((p) => p.suggested)).toEqual([null, null, null]);
  }
  keep("Senior manager: Log new solution", logged.message);

  let confirmed = logged;
  for (const [part, value] of DEMO_PARTS) {
    confirmed = await press("senior-manager", "confirm-part", "2318", { part, value });
  }
  const saved = currentSolution(memory.read(), "2318")!;
  expect(saved.parts.map((p) => [p.id, p.value, p.confirmed])).toEqual(DEMO_PARTS.map(([part, value]) => [part, value, true]));
  expect(saved.hash!.slice(0, 7)).toBe("a19bfa5");
  keep("Senior manager: confirms", confirmed.message);

  const tests = await press("senior-manager", "run-tests", "2318");
  expect(tests.message).toBe("Tests: 23 passed, 0 failed, 2 not applicable on draft v1.1 · a19bfa5.");
  const run = currentSolution(memory.read(), "2318")!.testRun!;
  expect(run).toMatchObject({ passed: 23, failed: 0, notApplicable: 2, ok: true, version: "1.1" });
  expect(run.draftHash).toBe(saved.hash);
  keep("Senior manager: Run tests", tests.message);

  const sent = await press("senior-manager", "send-to-hq", "2318");
  expect(currentSolution(memory.read(), "2318")!.status).toBe("sent-to-hq");
  // Nothing is live before HQ approves: Building B still ranks precool first.
  expect(first2401()).toBe("precool");
  expect(memory.read().liveVersionByBuilding).toEqual({ "tower-a": "1.0", "building-b": "1.0" });
  keep("Senior manager: Send to HQ", sent.message);

  // ---- 5. HQ Approve ----
  const approved = await press("hq", "approve-solution", "2318");
  const afterApprove = memory.read();
  expect(afterApprove.liveVersionByBuilding).toEqual({ "tower-a": "1.1", "building-b": "1.1" });
  expect(memory.jobById(afterApprove, "2318")!.status).toBe("pending-30-day");
  expect(currentSolution(afterApprove, "2318")!.status).toBe("approved-and-distributed");
  const a4 = (afterApprove.requests as { kind?: string; id: string; status: string; seat: string; text: string }[]).filter(
    (r) => r && r.kind === "A4"
  );
  expect(a4).toHaveLength(1);
  expect(a4[0]).toMatchObject({ status: "open", seat: "aom-tower-a", text: CHARGE_TEXT });
  keep("HQ: Approve", approved.message);

  // ---- 6. 2401's first lead is thermostat-spot ----
  expect(first2401()).toBe("thermostat-spot");
  const buildingB = seatView(memory.read(), "hq", mode, REAL_NOW).hq!.buildingB!;
  expect(buildingB.version).toBe("1.1");
  expect(buildingB.leads[0].causeId).toBe("thermostat-spot");

  // ---- 7. The AOM's charge decision (A4, cut 9 built) ----
  const tenantBefore = JSON.stringify(seatView(memory.read(), "tenant", mode, REAL_NOW));
  expect(tenantBefore).not.toContain("What we will do");
  expect(tenantBefore).not.toMatch(/S\$|\bSGD\b|dollar/i);
  const pipBefore = tenantPip().length;
  const aiBeforeCharge = aiCount();
  const decided = await press("aom-tower-a", "decide-charge", "2318", {
    requestId: a4[0].id,
    choice: "tenant-pays",
    amount: 350,
    reason: REASON,
  });
  const tenantAfter = tenantPip();
  expect(tenantAfter).toHaveLength(pipBefore + 1);
  expect(tenantAfter.at(-1)!.text).toBe(TENANT_CARD_350);
  expect((tenantAfter.at(-1)!.cards![0] as SeatCard).body).toBe(TENANT_CARD_350);
  expect(aiCount()).toBe(aiBeforeCharge);
  keep("AOM: Decide charge", decided.message);

  // ---- 8. The impact numbers (S18) on the AOM seat ----
  const aom = seatView(memory.read(), "aom-tower-a", mode, REAL_NOW).aom!;
  expect(aom.meter).toEqual(impactFor("tower-a/23", callsForState(memory.read()), loadImpactRates()));
  expect(aom.meter!.label).toBe(IMPACT_LABEL);
  expect(aom.meter!.before).toMatchObject({
    calls: 5,
    visits: 5,
    seniorChecks: 0,
    daysLine: "not fixed after 21 days",
    repeatCalls: 4,
    costLine: "S$600 and counting",
  });
  expect(aom.meter!.withPillDesk).toMatchObject({
    calls: 2,
    visits: 2,
    seniorChecks: 1,
    daysLine: "4 days",
    repeatCalls: 1,
    costLine: "S$420",
  });
  expect(aom.impactRecords).toEqual([
    {
      jobId: "2318",
      line: "Impact record: 3 hours lost, 2 extra visits, contractor or parts needed: no. Cost: S$420 (made-up rates: S$60 an hour, a visit is 2 hours).",
    },
  ]);
  expect(aom.charges[0].tenantCard).toBe(TENANT_CARD_350);

  // ---- 9. Typed red words lock nothing; Raise this stop locks Tower A Level 23 ----
  const live = loadAndCheckPill("ts-cc", "1.1");
  const rs04 = live.red_stops.find((s) => s.id === "RS-04")!;
  expect(rs04).toEqual(v10.red_stops.find((s) => s.id === "RS-04"));
  const aiBeforeSafety = aiCount();
  const typed = await chatTurn({ seat: "tenant", text: "water dripping near the lights", job: "2318" }, mode, deps, REAL_NOW);
  expect(typed.status).toBe(200);
  if (typed.status !== 200) throw new Error("the typed words were refused");
  expect(typed.body.cards.map((c) => c.stopId)).toEqual(["RS-04"]);
  const red = typed.body.cards[0];
  expect(red).toMatchObject({
    kind: "red-stop",
    title: rs04.trigger,
    body: rs04.action,
    call: rs04.who_to_call,
    receipt: "Red stop RS-04 · pill v1.1 · AI calls: 0",
    raiseStopId: "RS-04",
    jobId: "2318",
  });
  expect(red.aiJob).toBeUndefined();
  const afterTyped = memory.read();
  expect(afterTyped.openRedStops).toEqual([]);
  expect(openStopsOnJob(afterTyped, memory.jobById(afterTyped, "2318")!)).toEqual([]);
  expect(aiCount()).toBe(aiBeforeSafety);
  const typedAlerts = afterTyped.notices.filter((n) => n.kind === "alert" && n.stopId === "RS-04");
  expect(typedAlerts.map((n) => n.seat).sort()).toEqual(["aom-tower-a", "senior-manager"]);
  keep('Typed "water dripping near the lights"', typed.body.cards[0].body ?? "");

  const raised = await press("tenant", "safety-pick", red.jobId, { stopId: red.raiseStopId });
  const afterRaise = memory.read();
  expect(afterRaise.openRedStops).toHaveLength(1);
  expect(afterRaise.openRedStops[0]).toMatchObject({ stopId: "RS-04", building: "tower-a", floor: 23, source: "button" });
  expect(afterRaise.openRedStops[0].lockedJobIds).toContain("2318");
  expect(afterRaise.openRedStops[0].lockedJobIds).not.toContain("2401");
  expect(openStopsOnJob(afterRaise, memory.jobById(afterRaise, "2318")!)).toHaveLength(1);
  expect(openStopsOnJob(afterRaise, memory.jobById(afterRaise, "2401")!)).toEqual([]);
  // Raise this stop sends no second alert.
  expect(afterRaise.notices.filter((n) => n.kind === "alert" && n.stopId === "RS-04")).toHaveLength(typedAlerts.length);
  expect(aiCount()).toBe(aiBeforeSafety);
  keep("Raise this stop", raised.message);

  // ---- No model call anywhere ----
  expect(modelCalls).toBe(0);
  expect(aiCount()).toBe(0);

  return { snapshots, wordedCards: wordedCards(mode), modelCalls };
}

describe("T-C10b: the whole demo through the action functions, on Replay, network blocked", () => {
  it("runs every step in the T-C10b order, and AI off gives the same cards", async () => {
    // Network blocked, no key, Replay (tests/setup.ts).
    expect(process.env.LLM_API_KEY).toBe("");
    expect(process.env.REPLAY_MODE).toBe("1");
    expect(() => (globalThis.fetch as unknown as () => unknown)()).toThrow("network blocked in tests");
    // The press really is the action function: a refused press changes nothing and says who may.
    expect(runAction({ seat: "technician", action: "approve-solution", jobId: "2318" }, REAL_NOW).ok).toBe(false);

    const replay = await runDemo("replay");
    expect(replay.modelCalls).toBe(0);
    expect(replay.snapshots.map((s) => s.step)).toEqual([
      "Reset",
      "Tenant self-check on 2318",
      "Technician: Open job",
      "Technician: 2 Not this ticks",
      "Technician: Not solved",
      "Senior manager: Found it",
      "Senior manager: Log new solution",
      "Senior manager: confirms",
      "Senior manager: Run tests",
      "Senior manager: Send to HQ",
      "HQ: Approve",
      "AOM: Decide charge",
      'Typed "water dripping near the lights"',
      "Raise this stop",
    ]);

    // AI off: the same demo, the same cards, step by step.
    const off = await runDemo("off");
    expect(off.modelCalls).toBe(0);
    expect(off.snapshots).toEqual(replay.snapshots);

    // The worded cards are the same cards; only the AI layer's label differs.
    expect(replay.wordedCards.length).toBeGreaterThan(0);
    expect(off.wordedCards.map((c) => [c.seat, c.aiJob])).toEqual(replay.wordedCards.map((c) => [c.seat, c.aiJob]));
    expect(off.wordedCards.every((c) => c.aiOff === AI_OFF_LABEL)).toBe(true);
    expect(replay.wordedCards.every((c) => c.aiOff === undefined)).toBe(true);

    console.log("demo flow: all steps passed");
  }, 60000);
});
