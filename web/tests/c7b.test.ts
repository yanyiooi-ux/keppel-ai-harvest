/**
 * C7b: the technician's chat (S9, S21, S3's impact record, S18's rates, T-C7b).
 * Job list, Open job, the filled checklist, the ranked leads with live ticks,
 * Solved, Send with the cause, Not solved, and the low-confidence notice.
 *
 * Fake clients only: tests/setup.ts keeps the key empty and the network
 * blocked, and tests/setup-replay.ts points the replay folder at an empty temp
 * folder. Only the run rule 6 block reads web/data/replay/, read only.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import * as memory from "../lib/memory";
import { resetDemo, runAction } from "../lib/actions";
import { actionTurn } from "../lib/action-turn";
import { chatTurn } from "../lib/chat-turn";
import { seatView } from "../lib/seat-view";
import { leadsForJob, factsForJob } from "../lib/leads";
import { loadPill } from "../lib/pill";
import { SEAT_LABELS } from "../lib/permissions";
import { THERMOSTAT_NOTE } from "../lib/self-check";
import { loadImpactRates, checkImpactRecord, impactCost } from "../lib/impact-rates";
import { technicianDesk, type TechnicianDesk, type OpenJobDesk } from "../lib/technician-desk";
import { lowConfidenceText } from "../lib/technician-flow";
import { rankWordingSpec, saveReplay, REPLAY_BANNER, AI_OFF_LABEL, type ModelClient, type AiMessage } from "../lib/ai";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");
const v10 = loadPill("ts-cc", "1.0");
const TECH = SEAT_LABELS.technician;

beforeEach(() => {
  resetDemo(REAL_NOW);
});

// ---- Helpers: every press goes through the real gate and body ----

function press(seat: string, action: string, jobId?: string, payload?: Record<string, unknown>) {
  return runAction({ seat, action, jobId, payload }, REAL_NOW);
}

function tick(causeId: string, type: "found" | "not-this" | "clear", jobId = "2318") {
  return press("technician", "tick", jobId, { causeId, type });
}

function desk(): TechnicianDesk {
  const view = seatView(memory.read(), "technician", undefined, REAL_NOW);
  expect(view.desk).toBeDefined();
  return view.desk!;
}

function openJob(): OpenJobDesk {
  const open = desk().open;
  expect(open).not.toBeNull();
  return open!;
}

function job(id: string) {
  return memory.jobById(memory.read(), id)!;
}

/** The tenant's self-check through the real presses; returns where it landed. */
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

const HOT_WEST_BLINDS_DOWN: [string, string][] = [
  ["Q0", "No"],
  ["Q1", "West glass boardroom"],
  ["Q2", "This week"],
  ["Q3", "No"],
  ["Q4-blinds", "Yes"],
];

const IMPACT = { hoursLost: 3, extraVisits: 2, contractorOrPartsNeeded: false };

function smNotices(kind: string) {
  return memory.read().notices.filter((n) => n.seat === "senior-manager" && n.kind === kind);
}

const rs08 = v10.red_stops.find((s) => s.id === "RS-08")!;

// ---- T-C7b bullet 1: the filled checklist ----

describe("T-C7b: open 2318 shows the filled checklist", () => {
  beforeEach(() => {
    const landed = selfCheck("too cold", COLD_CORE_KEEPS);
    expect(landed.jobId).toBe("2318");
    expect(press("technician", "open-job", "2318").ok).toBe(true);
  });

  function card(id: string) {
    const found = openJob().checklist.find((c) => c.id === id);
    expect(found, id).toBeDefined();
    return found!;
  }

  it("open-job moves 2318 to in-progress and it becomes the technician's open job", () => {
    expect(job("2318").status).toBe("in-progress");
    expect(openJob().jobId).toBe("2318");
    expect(openJob().inProgress).toBe(true);
  });

  it("the place tag: Tower A Level 23, core, VAV-23-C1", () => {
    const place = card("place");
    expect(place.title).toBe("Tower A, Level 23, core");
    expect(place.body).toContain("VAV-23-C1");
  });

  it("5 calls at this spot in 30 days, each with its date and what it changed", () => {
    const calls = card("calls");
    expect(calls.title).toBe("5 calls at this spot in 30 days");
    const lines = calls.lines!.map((l) => l.text);
    expect(lines).toHaveLength(5);
    const dated = [
      ["15 Sep", "2301", "Raised zone setpoint by 1 deg C, tenant informed."],
      ["19 Sep", "2305", "Lowered zone setpoint by 1 deg C, tenant informed."],
      ["24 Sep", "2310", "Raised zone setpoint by 1 deg C again."],
      ["29 Sep", "2315", "Lowered zone setpoint by 1 deg C again."],
      ["6 Oct", "2318", "nothing changed yet"],
    ];
    dated.forEach(([date, id, changed], i) => {
      expect(lines[i].startsWith(`${date} · ${id}`), lines[i]).toBe(true);
      expect(lines[i]).toContain(changed);
    });
  });

  it("the repeat flag with opposite fixes, and the checklist note", () => {
    const repeat = card("repeat");
    expect(repeat.title).toBe("Repeat flag on: 5 calls in 30 days, with opposite fixes (TS-CC-09)");
    expect(repeat.body).toBe("Repeat flag is on. No nudge. Find the cause and call the FM chief engineer.");
    expect(repeat.colourWord).toBe("Repeat");
  });

  it('4 past dial turns, each "Failed: the spot called again"', () => {
    const past = card("past-fixes");
    const lines = past.lines!;
    expect(lines).toHaveLength(4);
    expect(lines.map((l) => l.text.split(" · ")[0])).toEqual(["2301", "2305", "2310", "2315"]);
    for (const line of lines) {
      expect(line.word).toBe("Failed");
      expect(line.text).toContain("Failed: the spot called again");
    }
  });

  it("the fit-out from buildings.json: 8 months ago", () => {
    expect(card("fit-out").title).toBe("Fit-out 8 months ago");
  });

  it("the tenant's self-check answers and the thermostat note", () => {
    const answers = card("self-check").lines!.map((l) => l.text);
    expect(answers).toEqual([
      "Before anything else: is there a burning smell, smoke, water dripping, a wet ceiling, or is anyone unwell? No",
      "Where exactly? Open area near the lift core",
      "Since when? It keeps coming back",
      "Has it happened before? Yes",
      "Without touching it, does the wall thermostat screen show AUTO? Not sure",
      THERMOSTAT_NOTE,
    ]);
  });

  it("the RS-08 trend card word for word from the pill, AI calls 0, and it locks nothing", () => {
    const trend = card("trend-RS-08");
    expect(trend.title).toBe(rs08.trigger);
    expect(trend.body).toBe(rs08.action);
    expect(trend.call).toBe(rs08.who_to_call);
    expect(trend.colour).toBe("red");
    expect(trend.colourWord).toBe("Stop");
    expect(trend.receipt).toBe("Red stop RS-08 · pill v1.0 · AI calls: 0");
    expect(trend.codeLine).toContain("9 of 14");
    expect(memory.read().openRedStops).toHaveLength(0);
  });

  it("a job with no self-check says so instead of inventing answers", () => {
    resetDemo(REAL_NOW);
    press("technician", "open-job", "2318");
    expect(card("self-check").title).toBe("No self-check on this job yet");
    expect(card("self-check").lines ?? []).toEqual([]);
  });
});

// ---- T-C7b bullet 2: the ranked leads and live ticks ----

describe("T-C7b: the ranked leads match T-C2d and each tick re-ranks on the next read", () => {
  beforeEach(() => {
    press("technician", "open-job", "2318");
  });

  it("precool, min-airflow, thermostat-spot with S9's exact reasons, check text, check time and fix line", () => {
    const leads = openJob().leads;
    expect(leads.map((l) => l.causeId)).toEqual(["precool", "min-airflow", "thermostat-spot"]);
    expect(leads[0].reason).toBe(
      "cold mornings + core zone: matched 3 of 4 similar cases that stayed fixed; 1 failed fix counts against. Close call, so the quicker check goes first (15 minutes)."
    );
    expect(leads[1].reason).toBe(
      "cold mornings + core zone + repeat: matched 3 of 4 similar cases that stayed fixed; 1 failed fix counts against."
    );
    expect(leads[2].reason).toBe("Low confidence, expert rule TS-CC-18: only 1 similar case so far.");
    expect(leads[0].checkText).toBe(v10.checklist.find((s) => s.step === 17)!.text);
    expect(leads[0].checkTime).toBe("15 minutes");
    expect(leads[2].checkTime).toBe("20 minutes");
    expect(leads[0].fixLine).toBe("Senior manager changes the start-up schedule");
    expect(leads[2].fixLine).toBe("Covered by the tenant's fit-out contract: goes through the AOM (TS-CC-11)");
    expect(leads.map((l) => l.tierWord)).toEqual(["case backed", "case backed", "low confidence"]);
  });

  it("removed holds setpoint (TS-CC-09), sun-west and capacity, and rebalance, with their reasons", () => {
    const removed = openJob().removed;
    expect(removed.map((r) => r.causeId).sort()).toEqual(["capacity", "rebalance", "setpoint", "sun-west"]);
    expect(removed.find((r) => r.causeId === "setpoint")!.reason).toMatch(/^Removed by TS-CC-09: /);
    expect(removed.find((r) => r.causeId === "sun-west")!.reason).toBe("Does not explain too cold.");
    expect(removed.find((r) => r.causeId === "rebalance")!.reason).toBe("This check is the senior manager's.");
  });

  it("the view's leads are exactly leadsForJob's: the screen never ranks on its own", () => {
    const state = memory.read();
    const engine = leadsForJob(state, memory.jobById(state, "2318")!, "technician", REAL_NOW);
    expect(openJob().leads.map((l) => [l.causeId, l.reason])).toEqual(engine.leads.map((l) => [l.causeId, l.reason]));
  });

  it("Not this on precool: min-airflow first on the next read; precool ruled out with who ticked it", () => {
    expect(tick("precool", "not-this").ok).toBe(true);
    const open = openJob();
    expect(open.leads[0].causeId).toBe("min-airflow");
    expect(open.ruledOut.map((l) => l.causeId)).toEqual(["precool"]);
    expect(open.ruledOut[0].reason).toBe(`Checked: not this (${TECH}).`);
    expect(job("2318").ticks).toEqual([{ causeId: "precool", type: "not-this", seat: "technician" }]);
  });

  it("then Not this on min-airflow: thermostat-spot first, low confidence; clear on min-airflow brings it back first", () => {
    tick("precool", "not-this");
    tick("min-airflow", "not-this");
    expect(openJob().leads[0].causeId).toBe("thermostat-spot");
    expect(openJob().leads[0].tier).toBe("low-confidence");
    expect(tick("min-airflow", "clear").ok).toBe(true);
    expect(openJob().leads[0].causeId).toBe("min-airflow");
    expect(openJob().ruledOut.map((l) => l.causeId)).toEqual(["precool"]);
  });

  it("Found it puts that lead first as found and sets the found lead; one found lead per job", () => {
    expect(tick("thermostat-spot", "found").ok).toBe(true);
    expect(openJob().leads[0].causeId).toBe("thermostat-spot");
    expect(openJob().leads[0].reason).toBe(`Checked: found it (${TECH}).`);
    expect(job("2318").foundLeadId).toBe("thermostat-spot");

    expect(tick("precool", "found").ok).toBe(true);
    const ticks = job("2318").ticks;
    expect(ticks.filter((t) => t.type === "found")).toEqual([{ causeId: "precool", type: "found", seat: "technician" }]);
    expect(job("2318").foundLeadId).toBe("precool");
    expect(openJob().leads.map((l) => l.causeId)).toContain("thermostat-spot");
  });

  it("a lead the rules removed cannot be ticked; the refusal quotes its removal and nothing changes", () => {
    const refused = tick("setpoint", "found");
    expect(refused.ok).toBe(false);
    expect(refused.message).toContain("Removed by TS-CC-09");
    expect(job("2318").ticks).toEqual([]);
    expect(job("2318").foundLeadId).toBeNull();
  });

  it("a tick needs a lead of this job and one of found, not-this or clear", () => {
    expect(tick("no-such-cause", "found").ok).toBe(false);
    expect(press("technician", "tick", "2318", { causeId: "precool", type: "maybe" }).ok).toBe(false);
    expect(job("2318").ticks).toEqual([]);
  });

  it("a tick before the job is open is refused (S3)", () => {
    resetDemo(REAL_NOW);
    const refused = tick("precool", "not-this");
    expect(refused.ok).toBe(false);
    expect(refused.message).toBe("Open the job first.");
  });
});

describe("T-C7b: typing never changes a tick (S19)", () => {
  it("typed words about ticks leave every tick and the found lead exactly as they were", async () => {
    press("technician", "open-job", "2318");
    tick("precool", "not-this");
    tick("thermostat-spot", "found");
    const before = job("2318");
    for (const text of ["found it", "not this", "tick precool", "clear the ticks", "min-airflow found", "solved", "not solved"]) {
      await chatTurn({ seat: "technician", text, job: "2318" }, "off", {}, REAL_NOW);
    }
    const after = job("2318");
    expect(after.ticks).toEqual(before.ticks);
    expect(after.foundLeadId).toBe(before.foundLeadId);
    expect(after.status).toBe("in-progress");
  });
});

// ---- T-C7b bullet 3: Not solved needs the impact record ----

describe("T-C7b: Not solved needs the impact record (S3) and reaches the senior manager with a cost from the made-up rates", () => {
  beforeEach(() => {
    selfCheck("too cold", COLD_CORE_KEEPS);
    press("technician", "open-job", "2318");
    tick("precool", "not-this");
    tick("min-airflow", "not-this");
  });

  it("with no impact record it is refused and nothing changes", () => {
    const refused = press("technician", "not-solved", "2318");
    expect(refused.ok).toBe(false);
    expect(refused.message).toMatch(/impact record/);
    expect(job("2318").status).toBe("in-progress");
    expect(job("2318").impact).toBeNull();
    expect(smNotices("escalated")).toHaveLength(0);
  });

  it("with the record: escalated, the record and its cost on the job, S$420 for 3 hours and 2 visits", () => {
    const sent = press("technician", "not-solved", "2318", IMPACT);
    expect(sent.ok, sent.message).toBe(true);
    const after = job("2318");
    expect(after.status).toBe("escalated");
    expect(after.impact).toEqual({ ...IMPACT, cost: 420 });
    expect(after.escalatedWith).toMatchObject({ route: "not-solved", seat: "technician", causeId: null });
  });

  it("the senior manager's chat gets everything attached: place, ticks with who, self-check answers, the impact record and cost", () => {
    press("technician", "not-solved", "2318", IMPACT);
    const notices = smNotices("escalated");
    expect(notices).toHaveLength(1);
    const text = notices[0].text;
    expect(notices[0].jobId).toBe("2318");
    expect(text).toContain("Not solved: job 2318, Tower A, Level 23, core (VAV-23-C1), too cold.");
    expect(text).toContain(`Morning start-up runs too cold: not this (${TECH})`);
    expect(text).toContain(`Core box held at minimum airflow: not this (${TECH})`);
    expect(text).toContain("Since when? It keeps coming back");
    expect(text).toContain(THERMOSTAT_NOTE);
    expect(text).toContain("3 hours lost, 2 extra visits, contractor or parts needed: no");
    expect(text).toContain("S$420");
    expect(text).toContain("AI calls: 0");
  });

  it("the technician's chat says where the job went and the record, but no amount (S3 shows the cost to the senior manager and the AOM)", () => {
    press("technician", "not-solved", "2318", IMPACT);
    const said = memory.read().messages.filter((m) => m.seat === "technician" && m.from === "pip");
    expect(said.at(-1)!.text).toContain("escalated");
    expect(said.at(-1)!.text).toContain("3 hours lost, 2 extra visits");
    expect(said.at(-1)!.text).not.toMatch(/S\$|\$\s*\d/);
  });

  it("a record out of range is refused: hours above 100, visits above 10 or not whole, contractor not yes or no", () => {
    for (const bad of [
      { ...IMPACT, hoursLost: 101 },
      { ...IMPACT, hoursLost: -1 },
      { ...IMPACT, extraVisits: 11 },
      { ...IMPACT, extraVisits: 1.5 },
      { ...IMPACT, hoursLost: "three" },
      { hoursLost: 3, extraVisits: 2 },
    ]) {
      const refused = press("technician", "not-solved", "2318", bad as Record<string, unknown>);
      expect(refused.ok, JSON.stringify(bad)).toBe(false);
    }
    expect(job("2318").status).toBe("in-progress");
  });
});

// ---- T-C7b bullet 4: Solved refused on someone else's fix; Send with the cause ----

describe("T-C7b: Found it on thermostat-spot, then Solved is refused; Send with the cause escalates with the cause", () => {
  beforeEach(() => {
    press("technician", "open-job", "2318");
    tick("thermostat-spot", "found");
  });

  it('Solved: refused, "this fix belongs to the senior manager"; nothing is saved', () => {
    const refused = press("technician", "solved", "2318", { whyLine: "The thermostat sits beside the new printer bay." });
    expect(refused.ok).toBe(false);
    expect(refused.message).toContain("this fix belongs to the senior manager");
    expect(job("2318").status).toBe("in-progress");
    expect(memory.read().runtimeCases).toHaveLength(0);
  });

  it("Send with the cause: escalated with thermostat-spot as its cause, and the senior manager hears it", () => {
    const sent = press("technician", "send-with-cause", "2318");
    expect(sent.ok, sent.message).toBe(true);
    const after = job("2318");
    expect(after.status).toBe("escalated");
    expect(after.foundLeadId).toBe("thermostat-spot");
    expect(after.escalatedWith).toMatchObject({ route: "send-with-cause", seat: "technician", causeId: "thermostat-spot" });
    const notices = smNotices("escalated");
    expect(notices).toHaveLength(1);
    expect(notices[0].text).toContain("Sent with the cause: job 2318");
    expect(notices[0].text).toContain(`Found: Thermostat in the wrong spot after a fit-out (${TECH})`);
    expect(notices[0].text).toContain("Covered by the tenant's fit-out contract: goes through the AOM (TS-CC-11)");
  });

  it("Send with the cause needs a found lead", () => {
    tick("thermostat-spot", "clear");
    const refused = press("technician", "send-with-cause", "2318");
    expect(refused.ok).toBe(false);
    expect(refused.message).toMatch(/Found it/);
    expect(job("2318").status).toBe("in-progress");
  });
});

// ---- Solved on a fix the technician may do ----

describe("C7b: Solved needs a found lead the technician may fix and one line of why (3 to 30 words); no approval", () => {
  let hotJob = "";
  beforeEach(() => {
    const landed = selfCheck("too hot", HOT_WEST_BLINDS_DOWN);
    hotJob = landed.jobId!;
    expect(hotJob).toBe("2319");
    expect(job(hotJob).status).toBe("visit-booked");
    expect(press("technician", "open-job", hotJob).ok).toBe(true);
  });

  it("sun-west is a lead the technician may fix on the hot west job", () => {
    const sun = openJob().leads.find((l) => l.causeId === "sun-west");
    expect(sun).toBeDefined();
    expect(sun!.fixAllowedHere).toBe(true);
  });

  it("Solved with no found lead is refused", () => {
    const refused = press("technician", "solved", hotJob, { whyLine: "Afternoon sun on the west glass, blinds were open." });
    expect(refused.ok).toBe(false);
    expect(refused.message).toMatch(/Found it/);
  });

  it("a why line under 3 or over 30 words is refused", () => {
    tick("sun-west", "found", hotJob);
    expect(press("technician", "solved", hotJob, { whyLine: "Sun glare" }).ok).toBe(false);
    expect(press("technician", "solved", hotJob, { whyLine: Array(31).fill("word").join(" ") }).ok).toBe(false);
    expect(press("technician", "solved", hotJob, {}).ok).toBe(false);
    expect(job(hotJob).status).toBe("in-progress");
  });

  it("Solved: pending-30-day, the why and the fixer stored, a case saved for the 30-day rule, no request opened", () => {
    tick("sun-west", "found", hotJob);
    const requestsBefore = memory.read().requests.length;
    const why = "Afternoon sun on the west glass; the blinds were left open after the meeting.";
    const solved = press("technician", "solved", hotJob, { whyLine: why });
    expect(solved.ok, solved.message).toBe(true);

    const after = job(hotJob);
    expect(after.status).toBe("pending-30-day");
    expect(after.whyLine).toBe(why);
    expect(after.fixerSeat).toBe("technician");

    const cases = memory.read().runtimeCases;
    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({
      jobId: hotJob,
      building: "tower-a",
      floor: 23,
      zone: "west",
      causeId: "sun-west",
      fixedBy: "technician",
      confirmedBy: null,
      why,
      fix: "Blinds tip now; lasting shading is the AOM's call",
      fixedAt: "2026-10-06T10:00:00+08:00",
    });
    expect(cases[0].facts).toEqual(factsForJob(memory.read(), after));
    expect(cases[0].symptom).toBe("hot-other");
    expect(memory.read().requests).toHaveLength(requestsBefore);
  });

  it("an amount typed in the why line is stored as [amount hidden] (S13 item 9)", () => {
    tick("sun-west", "found", hotJob);
    press("technician", "solved", hotJob, { whyLine: "Blinds were up, new film would cost S$200 later." });
    expect(job(hotJob).whyLine).toContain("[amount hidden]");
    expect(job(hotJob).whyLine).not.toContain("200");
  });

  it("Send with the cause on a fix the technician may do is refused: press Solved", () => {
    tick("sun-west", "found", hotJob);
    const refused = press("technician", "send-with-cause", hotJob);
    expect(refused.ok).toBe(false);
    expect(refused.message).toMatch(/Solved/);
  });
});

// ---- T-C7b bullet 5: the low-confidence notice ----

describe("T-C7b: the low-confidence notice reaches the senior manager exactly once", () => {
  it("after the second Not this on 2318, once; clearing and ticking again adds none", () => {
    press("technician", "open-job", "2318");
    tick("precool", "not-this");
    expect(smNotices("low-confidence")).toHaveLength(0);
    tick("min-airflow", "not-this");
    const notices = smNotices("low-confidence");
    expect(notices).toHaveLength(1);
    expect(notices[0].text).toBe(lowConfidenceText("2318"));
    expect(notices[0].text).toBe(
      "Low confidence on job 2318: the top cause has fewer than 3 similar cases. Please take a look."
    );
    expect(notices[0].jobId).toBe("2318");
    // Stamped on the demo clock (S20).
    expect(notices[0].at).toBe("2026-10-06T10:00:00+08:00");

    tick("min-airflow", "clear");
    tick("min-airflow", "not-this");
    expect(smNotices("low-confidence")).toHaveLength(1);
  });

  it("no notice while the first live lead is case-backed", () => {
    press("technician", "open-job", "2318");
    tick("precool", "not-this");
    tick("precool", "clear");
    expect(smNotices("low-confidence")).toHaveLength(0);
  });
});

// ---- The pill steps with S21's filled values ----

describe("C7b: the pill steps with the S21 filled values", () => {
  beforeEach(() => {
    selfCheck("too cold", COLD_CORE_KEEPS);
    press("technician", "open-job", "2318");
  });

  function step(n: number) {
    return openJob().steps.find((s) => s.step === n);
  }

  it("steps 1 to 8 first, in order; no dial turn (step 25) while the repeat flag is on", () => {
    const steps = openJob().steps.map((s) => s.step);
    expect(steps.slice(0, 8)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(steps).not.toContain(25);
  });

  it("each step's text is the pill's, word for word, with its colour word", () => {
    for (const s of openJob().steps) {
      expect(s.text).toBe(v10.checklist.find((c) => c.step === s.step)!.text);
    }
    expect(step(9)!.colourWord).toBe("Do it");
    expect(step(10)!.colourWord).toBe("Senior manager's step");
    expect(step(5)!.colourWord).toBe("Stop");
    expect(step(30)!.colourWord).toBe("AOM decides");
  });

  it("filled values for steps 1, 2, 3, 9, 10 and 11; other steps show the pill text only", () => {
    expect(step(1)!.filled).toBe("No safety signs reported by the tenant");
    expect(step(2)!.filled).toContain("Open area near the lift core");
    expect(step(2)!.filled).toContain("It keeps coming back");
    expect(step(2)!.filled).toContain("mornings, around 9am");
    expect(step(3)!.filled).toBe("Fit-out 8 months ago (building data)");
    expect(step(9)!.filled).toBe("5 calls at this spot in 30 days: 2301, 2305, 2310, 2315, 2318");
    expect(step(10)!.filled).toBe("Repeat flag on: 5 calls in 30 days, with opposite fixes (TS-CC-09)");
    expect(step(11)!.filled).toBe("Fit-out 8 months ago: pull the fit-out file");
    expect(step(4)!.filled).toBeUndefined();
    expect(step(17)!.filled).toBeUndefined();
  });

  it("with no self-check, step 1 says the tenant was not asked", () => {
    resetDemo(REAL_NOW);
    press("technician", "open-job", "2318");
    expect(step(1)!.filled).toBe("Not asked: no self-check on this job");
  });
});

// ---- The job list ----

describe("C7b: the job list for Tower A", () => {
  it("lists Tower A's jobs, never Building B's or one still in the self-check, with Open job where S2 allows", () => {
    press("tenant", "report", undefined, { complaint: "too hot" });
    const jobs = desk().jobs;
    expect(jobs.map((j) => j.id)).toEqual(["2318"]);
    expect(jobs[0].canOpen).toBe(true);
    expect(jobs[0].status).toBe("reported");
    expect(desk().open).toBeNull();

    press("technician", "open-job", "2318");
    const after = desk().jobs;
    expect(after[0].canOpen).toBe(false);
    expect(after[0].isOpen).toBe(true);
    expect(after[0].status).toBe("in-progress");
  });

  it("only the technician seat gets the desk", () => {
    expect(seatView(memory.read(), "tenant", undefined, REAL_NOW).desk).toBeUndefined();
    expect(seatView(memory.read(), "senior-manager", undefined, REAL_NOW).desk).toBeUndefined();
  });

  it("after Not solved the open job shows escalated and no longer offers the in-progress presses", () => {
    press("technician", "open-job", "2318");
    press("technician", "not-solved", "2318", IMPACT);
    const open = openJob();
    expect(open.status).toBe("escalated");
    expect(open.inProgress).toBe(false);
    expect(open.statusLine).toContain("senior manager");
  });
});

// ---- A locked job ----

describe("C7b: a locked job shows only its red cards and the lock line (S11)", () => {
  it("RS-04 raised on 2318: the stop's own words and TS-CC-03's not_when; no checklist, no leads", () => {
    press("technician", "open-job", "2318");
    press("technician", "safety-pick", "2318", { stopId: "RS-04" });
    const open = openJob();
    const rs04 = v10.red_stops.find((s) => s.id === "RS-04")!;
    expect(open.locked).not.toBeNull();
    expect(open.locked!.cards.map((c) => [c.title, c.body, c.call])).toEqual([[rs04.trigger, rs04.action, rs04.who_to_call]]);
    expect(open.locked!.lockLines).toEqual([v10.rules.find((r) => r.id === "TS-CC-03")!.not_when]);
    expect(open.checklist).toEqual([]);
    expect(open.leads).toEqual([]);
    expect(open.steps).toEqual([]);
  });
});

// ---- The orchestrator's C7a leftover: a second Raise this stop ----

describe("C7b: a second Raise this stop shows nothing new", () => {
  for (const seat of ["technician", "tenant"]) {
    it(`${seat}: the typed card's Raise this stop twice stores the raised card once`, async () => {
      await chatTurn({ seat, text: "water dripping near the lights", job: "2318" }, "off", {}, REAL_NOW);
      const count = () => memory.read().messages.filter((m) => m.seat === seat).length;
      const before = count();
      expect(press(seat, "safety-pick", "2318", { stopId: "RS-04" }).ok).toBe(true);
      expect(count()).toBe(before + 1);
      const again = press(seat, "safety-pick", "2318", { stopId: "RS-04" });
      expect(again.ok).toBe(true);
      expect(again.message).toMatch(/already open/);
      expect(count()).toBe(before + 1);
      expect(memory.read().openRedStops).toHaveLength(1);
    });
  }
});

// ---- S18 rates and the cost ----

describe("C7b: web/data/impact-rates.json (S18) and the impact record's cost (S3)", () => {
  it("is labelled made up, with S18's rates", () => {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "data", "impact-rates.json"), "utf-8"));
    expect(raw).toEqual({ label: "made up for the demo", visitHours: 2, seniorCheckHours: 3, hourlyRateSgd: 60 });
    expect(loadImpactRates()).toEqual(raw);
  });

  it("the cost comes from the rates it is given: hours lost at the hourly rate plus each extra visit's hours", () => {
    expect(impactCost(IMPACT, loadImpactRates())).toBe(420);
    expect(impactCost(IMPACT, { label: "test", visitHours: 1, seniorCheckHours: 3, hourlyRateSgd: 100 })).toBe(500);
    expect(impactCost({ hoursLost: 0, extraVisits: 0, contractorOrPartsNeeded: true }, loadImpactRates())).toBe(0);
  });

  it("checkImpactRecord takes the S3 ranges and says what is missing", () => {
    expect(checkImpactRecord({ hoursLost: 0, extraVisits: 0, contractorOrPartsNeeded: true })).toEqual({
      ok: true,
      record: { hoursLost: 0, extraVisits: 0, contractorOrPartsNeeded: true },
    });
    expect(checkImpactRecord({ hoursLost: 100, extraVisits: 10, contractorOrPartsNeeded: false }).ok).toBe(true);
    const missing = checkImpactRecord(undefined);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.message).toMatch(/hours lost.*extra visits.*contractor or parts/);
  });

  it.todo(
    "QUESTION C7b: S3 says code adds the impact record's cost from the made-up rates in impact-rates.json, and S18's rates are a visit's hours, a senior check's hours and an hourly rate. Built: hours lost x the hourly rate + extra visits x a visit's hours x the hourly rate; contractor or parts needed has no rate, so it is shown but not costed. Is that the cost YY wants?"
  );
});

describe("C7b: a Confirm cause list on the technician seat", () => {
  it.todo(
    "QUESTION C7b: S8 says the Confirm cause list on the technician and HQ seats goes only under cut 7, and run rule 4 builds cut 5 to 10, but S21's technician row and C7b's items name no Confirm cause button. Not built on the technician seat. Should it be?"
  );
});

// ---- Rank wording (S15, cut 5 built): worded at the press, never on a poll ----

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

describe("C7b: rank wording on the technician's leads (S14, S15)", () => {
  it("Live: each live lead is worded once at the press, the calls are counted, and a poll makes no call", async () => {
    const { client, calls } = fakeClient("Check this lead before the others.");
    const result = await actionTurn(
      { seat: "technician", action: "open-job", jobId: "2318" },
      "live",
      { client, keyPresent: true },
      REAL_NOW
    );
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(3);
    expect(memory.read().aiCalls).toBe(3);

    const leads = seatView(memory.read(), "technician", "live", REAL_NOW).desk!.open!.leads;
    for (const lead of leads) {
      expect(lead.aiWording).toBe("Check this lead before the others.");
      expect(lead.aiCalls).toBe(1);
      expect(lead.reason.length).toBeGreaterThan(0);
    }
    seatView(memory.read(), "technician", "live", REAL_NOW);
    seatView(memory.read(), "technician", "live", REAL_NOW);
    expect(calls).toHaveLength(3);
  });

  it("the AI never changes an order or a reason: the leads equal the code's on every switch position", async () => {
    const { client } = fakeClient("Check this lead before the others.");
    await actionTurn({ seat: "technician", action: "open-job", jobId: "2318" }, "live", { client, keyPresent: true }, REAL_NOW);
    const code = leadsForJob(memory.read(), job("2318"), "technician", REAL_NOW).leads.map((l) => [l.causeId, l.reason]);
    for (const mode of ["live", "replay", "off"] as const) {
      const leads = seatView(memory.read(), "technician", mode, REAL_NOW).desk!.open!.leads;
      expect(leads.map((l) => [l.causeId, l.reason])).toEqual(code);
    }
  });

  it("Off: no AI line, the AI off label, and no call", async () => {
    const { client, calls } = fakeClient("Check this lead before the others.");
    await actionTurn({ seat: "technician", action: "open-job", jobId: "2318" }, "off", { client, keyPresent: true }, REAL_NOW);
    expect(calls).toHaveLength(0);
    const leads = seatView(memory.read(), "technician", "off", REAL_NOW).desk!.open!.leads;
    for (const lead of leads) {
      expect(lead.aiWording).toBeUndefined();
      expect(lead.aiOff).toBe(AI_OFF_LABEL);
    }
  });

  it("a wording shows only under the reason it worded: after Found it, the found lead's new reason has none", async () => {
    const dir = mkdtempSync(join(tmpdir(), "c7b-replay-"));
    try {
      // Saved answers for the three leads as code ranks them before any tick.
      const state = memory.read();
      const before = leadsForJob(state, job("2318"), "technician", REAL_NOW).leads;
      for (const lead of before) {
        const key = rankWordingSpec(v10, lead, { seat: "technician", version: "1.0", job: job("2318") }).key;
        saveReplay(key, { text: "Check this lead before the others.", pass: true }, dir);
      }
      await actionTurn({ seat: "technician", action: "open-job", jobId: "2318" }, "replay", { replayDir: dir }, REAL_NOW);
      expect(seatView(memory.read(), "technician", "replay", REAL_NOW).desk!.open!.leads.every((l) => l.aiBanner === REPLAY_BANNER)).toBe(
        true
      );

      // A tick stored with no new wording: thermostat-spot's reason is now "Checked: found it (...)".
      press("technician", "tick", "2318", { causeId: "thermostat-spot", type: "found" });
      const leads = seatView(memory.read(), "technician", "replay", REAL_NOW).desk!.open!.leads;
      expect(leads[0].causeId).toBe("thermostat-spot");
      expect(leads[0].aiWording).toBeUndefined();
      expect(leads[0].aiBanner).toBeUndefined();
      for (const lead of leads.slice(1)) expect(lead.aiBanner).toBe(REPLAY_BANNER);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a refused press words nothing", async () => {
    const { client, calls } = fakeClient("Check this lead before the others.");
    const refused = await actionTurn(
      { seat: "technician", action: "tick", jobId: "2318", payload: { causeId: "precool", type: "not-this" } },
      "live",
      { client, keyPresent: true },
      REAL_NOW
    );
    expect(refused.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

// ---- Run rule 6: rank wording on 2318 through this part's real code path, on Replay ----

describe("C7b run rule 6: rank wording on 2318 on Replay finds the saved real answers", () => {
  it('Open job 2318 on Replay: each lead carries the banner "replay: saved real AI answer", read only', async () => {
    const REPLAY = join(process.cwd(), "data", "replay");
    const filesBefore = readdirSync(REPLAY).sort();
    const result = await actionTurn(
      { seat: "technician", action: "open-job", jobId: "2318" },
      "replay",
      { replayDir: REPLAY },
      REAL_NOW
    );
    expect(result.ok).toBe(true);
    const leads = seatView(memory.read(), "technician", "replay", REAL_NOW).desk!.open!.leads;
    expect(leads.map((l) => l.causeId)).toEqual(["precool", "min-airflow", "thermostat-spot"]);
    for (const lead of leads) {
      expect(lead.aiBanner, lead.causeId).toBe(REPLAY_BANNER);
      expect(typeof lead.aiWording).toBe("string");
      expect(lead.aiCalls).toBe(0);
    }
    expect(readdirSync(REPLAY).sort()).toEqual(filesBefore);
  });
});

// ---- The desk is built from the one memory ----

describe("C7b: technicianDesk reads the memory it is given", () => {
  it("returns the same desk as seatView", () => {
    press("technician", "open-job", "2318");
    expect(technicianDesk(memory.read(), REAL_NOW)).toEqual(desk());
  });
});
