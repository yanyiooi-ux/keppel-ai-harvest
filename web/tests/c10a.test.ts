/**
 * C10a: the judges' page /how (S22, T-C10a).
 *
 * WHY is the Level 23 story worked out from tickets.json, and the impact
 * meter (S18) from the one memory; WHAT and HOW read the seats, the approvals,
 * the pill and the data; the live wall is the 5 real seat views on the one
 * memory. Every test calls the real code on the per-worker memory file, and a
 * temp copy of tickets.json shows nothing on the page is typed in.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import * as memory from "../lib/memory";
import { resetDemo, runAction, callsForState } from "../lib/actions";
import { actionTurn } from "../lib/action-turn";
import { seatView } from "../lib/seat-view";
import { impactFor, IMPACT_LABEL } from "../lib/impact";
import { loadImpactRates } from "../lib/impact-rates";
import { loadBuildings } from "../lib/facts";
import { loadCauses } from "../lib/causes";
import { loadCases } from "../lib/cases";
import { loadAndCheckPill } from "../lib/pill";
import { safetyList } from "../lib/safety";
import { SELF_CHECK_QUESTIONS } from "../lib/self-check";
import { CHARGE_CHOICES } from "../lib/charge-flow";
import { PART_TITLES, partDisplay } from "../lib/senior-manager-flow";
import { SEAT_LABELS, PIP_NEVER } from "../lib/permissions";
import { openingLineFor } from "../lib/seat-opening";
import { AOM_SPOT } from "../lib/aom-desk";
import { buildingBView } from "../lib/hq-desk";
import {
  whyStory,
  howView,
  liveSeats,
  loadHowSources,
  callsWith,
  LIVE_ORDER,
  CLOSE_LINE,
  ROLE_PLAYED_LINE,
  AI_NEW_SOLUTION_LINE,
  PASSES,
  type HowSources,
} from "../lib/how";
import type { Ticket } from "../lib/rule-engine";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");

const DEMO_FIX =
  "If the zone had a fit-out in the last 12 months, check where the thermostat sits against the fit-out drawing before any nudge.";
const DEMO_WHY =
  "The fit-out 8 months ago moved the core thermostat next to the new printer bay, so it reads warm and the box keeps cooling the open area.";

beforeEach(() => {
  resetDemo(REAL_NOW);
});

function fileTickets(): Ticket[] {
  return JSON.parse(readFileSync(join(process.cwd(), "data", "tickets.json"), "utf-8")) as Ticket[];
}

function press(seat: string, action: string, jobId?: string, payload?: Record<string, unknown>) {
  const r = runAction({ seat, action, jobId, payload }, REAL_NOW);
  expect(r.ok, `${action}: ${r.message}`).toBe(true);
  return r;
}

/** The C8 steps over the real presses, AI off, up to HQ's Approve. */
async function toApprove() {
  const report = press("tenant", "report", undefined, { complaint: "too cold" });
  for (const [questionId, answer] of [
    ["Q0", "No"],
    ["Q1", "Open area near the lift core"],
    ["Q2", "It keeps coming back"],
    ["Q3", "Yes"],
    ["Q4-thermostat", "Not sure"],
  ]) {
    press("tenant", "answer", report.jobId, { questionId, answer });
  }
  press("technician", "open-job", "2318");
  press("technician", "tick", "2318", { causeId: "precool", type: "not-this" });
  press("technician", "tick", "2318", { causeId: "min-airflow", type: "not-this" });
  press("technician", "not-solved", "2318", { hoursLost: 3, extraVisits: 2, contractorOrPartsNeeded: false });
  press("senior-manager", "tick", "2318", { causeId: "thermostat-spot", type: "found" });
  const logged = await actionTurn(
    { seat: "senior-manager", action: "log-new-solution", jobId: "2318", payload: { fixLine: DEMO_FIX, whyLine: DEMO_WHY } },
    "off",
    undefined,
    REAL_NOW
  );
  expect(logged.ok, logged.message).toBe(true);
  for (const [part, value] of [
    ["rule-text", DEMO_FIX],
    ["fact", "fit-out-12m"],
    ["effect-1", "block:25"],
    ["effect-2", "put-first:21"],
  ]) {
    press("senior-manager", "confirm-part", "2318", { part, value });
  }
  press("senior-manager", "run-tests", "2318");
  press("senior-manager", "send-to-hq", "2318");
  press("hq", "approve-solution", "2318");
}

// ---- WHY: the Level 23 story from tickets.json ----

describe("T-C10a: the WHY story comes from tickets.json", () => {
  it("is Tower A Level 23's 5 calls in time order, with their dates from the data", () => {
    const s = loadHowSources();
    const story = whyStory(s.tickets, s.buildings, s.trends)!;
    expect(story.place).toBe("Tower A Level 23");
    expect(story.tenant).toBe("Northwind Advisory");
    expect(story.calls.map((c) => c.id)).toEqual(["2301", "2305", "2310", "2315", "2318"]);
    expect(story.calls.map((c) => c.date)).toEqual(["15 Sep", "19 Sep", "24 Sep", "29 Sep", "6 Oct"]);
    const byId = new Map(fileTickets().map((t) => [t.id, t]));
    for (const call of story.calls) {
      const t = byId.get(call.id)!;
      expect(call.reportedAt).toBe(t.reportedAt);
      expect(call.complaint).toBe(t.complaint);
      expect(call.where).toBe(t.intake.where);
      expect(call.when).toBe(t.intake.when);
      expect(call.fixNote).toBe(t.fix ? t.fix.note : null);
    }
  });

  it("says 5 calls in 21 days, the first 4 closed with a dial turn that came back, 2318 still open, never fixed", () => {
    const s = loadHowSources();
    const story = whyStory(s.tickets, s.buildings, s.trends)!;
    expect(story.days).toBe(21);
    expect(story.dialTurns).toBe(4);
    expect(story.openIds).toEqual(["2318"]);
    expect(story.neverFixed).toBe(true);
    expect(story.calls.slice(0, 4).every((c) => c.dialTurn && c.status === "came-back")).toBe(true);
    expect(story.calls.slice(0, 4).map((c) => c.next?.id)).toEqual(["2305", "2310", "2315", "2318"]);
    expect(story.calls[4].status).toBe("open");
    expect(story.calls[4].statusWord).toBe("Still open");
    expect(story.calls[0].statusWord).toBe("Came back");
    expect(story.headline).toBe("Tower A Level 23 called 5 times in 21 days, and the cause was never fixed");
    expect(story.summary).toBe("4 closed with a dial turn, and every one came back. 2318 is still open.");
  });

  it("groups the calls into too cold in the core mornings and too hot in the west afternoons", () => {
    const s = loadHowSources();
    const story = whyStory(s.tickets, s.buildings, s.trends)!;
    expect(story.patterns).toEqual([
      { complaint: "too cold", where: "open area near the lift core", when: "mornings, around 9am", ids: ["2301", "2310", "2318"] },
      { complaint: "too hot", where: "west glass boardroom", when: "afternoons, 2 to 5pm", ids: ["2305", "2315"] },
    ]);
  });

  it("reads the fit-out and the lease from buildings.json and the cause line from the trend data", () => {
    const s = loadHowSources();
    const story = whyStory(s.tickets, s.buildings, s.trends)!;
    const floor = loadBuildings().find((b) => b.id === "tower-a")!.floors.find((f) => f.floor === 23)!;
    expect(story.fitOutMonths).toBe(floor.fitOutCompletedMonths);
    expect(story.fitOutMonths).toBe(8);
    expect(story.leaseEndsInMonths).toBe(10);
    const trends = JSON.parse(readFileSync(join(process.cwd(), "data", "trends.json"), "utf-8"));
    expect(story.causeLine).toBe(trends.zones.core.description);
  });

  it("uses the same run of calls and the same days as the meter", () => {
    const s = loadHowSources();
    const story = whyStory(s.tickets, s.buildings, s.trends)!;
    const meter = impactFor(AOM_SPOT, s.tickets, s.rates)!;
    expect(story.calls.map((c) => c.id)).toEqual(meter.before.callIds);
    expect(story.days).toBe(meter.before.days);
  });
});

describe("T-C10a: change a date in a temp copy of tickets.json and the story changes", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "pill-desk-c10a-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function tempCopy(change: (tickets: Ticket[]) => void): Ticket[] {
    const path = join(dir, "tickets.json");
    writeFileSync(path, readFileSync(join(process.cwd(), "data", "tickets.json"), "utf-8"), "utf-8");
    const tickets = JSON.parse(readFileSync(path, "utf-8")) as Ticket[];
    change(tickets);
    writeFileSync(path, JSON.stringify(tickets, null, 2), "utf-8");
    return JSON.parse(readFileSync(path, "utf-8")) as Ticket[];
  }

  it("2301 three days earlier: 12 Sep and 24 days", () => {
    const tickets = tempCopy((t) => {
      t.find((x) => x.id === "2301")!.reportedAt = "2026-09-12T09:05:00+08:00";
    });
    const s = loadHowSources();
    const story = whyStory(tickets, s.buildings, s.trends)!;
    expect(story.calls[0].date).toBe("12 Sep");
    expect(story.days).toBe(24);
    expect(story.headline).toBe("Tower A Level 23 called 5 times in 24 days, and the cause was never fixed");
  });

  it("2318 given a fix: no call is still open, and the dial turns go up to 5", () => {
    const tickets = tempCopy((t) => {
      const open = t.find((x) => x.id === "2318")!;
      open.fix = { action: "setpoint_up", amount: 1, fixerRole: "technician", note: "Raised zone setpoint by 1 deg C." };
    });
    const s = loadHowSources();
    const story = whyStory(tickets, s.buildings, s.trends)!;
    expect(story.openIds).toEqual([]);
    expect(story.dialTurns).toBe(5);
    expect(story.calls[4].fixNote).toBe("Raised zone setpoint by 1 deg C.");
    // The last fix has no call after it, so the story no longer says never fixed.
    expect(story.calls[4].status).toBe("stayed-fixed");
    expect(story.neverFixed).toBe(false);
    expect(story.headline).toBe("Tower A Level 23 called 5 times in 21 days");
  });

  it("howView reads whatever tickets it is given", () => {
    const tickets = tempCopy((t) => {
      t.find((x) => x.id === "2305")!.reportedAt = "2026-09-20T15:10:00+08:00";
    });
    const sources: HowSources = { ...loadHowSources(), tickets };
    const view = howView(memory.read(), sources);
    expect(view.why!.calls[1].date).toBe("20 Sep");
    expect(howView(memory.read()).why!.calls[1].date).toBe("19 Sep");
  });
});

// ---- The meter, the seats and the Building B card from the one memory ----

describe("T-C10a: the impact meter and the 5 chats render from the one memory", () => {
  it("the meter is impactFor on the memory's calls, the same as the AOM seat's", () => {
    const state = memory.read();
    const view = howView(state);
    expect(callsWith(state, fileTickets())).toEqual(callsForState(state));
    expect(view.meter).toEqual(impactFor(AOM_SPOT, callsForState(state), loadImpactRates()));
    expect(view.meter).toEqual(seatView(state, "aom-tower-a", "off", REAL_NOW).aom!.meter);
    expect(view.meter!.before.costLine).toBe("S$600 and counting");
    expect(view.meter!.withPillDesk!.costLine).toBe("S$420");
    expect(view.meter!.label).toBe(IMPACT_LABEL);
  });

  it("a job written to the memory shows on the meter, as it does on the AOM seat", () => {
    memory.update((s) => {
      const base = s.jobs.find((j) => j.id === "2318")!;
      s.jobs.push({
        ...JSON.parse(JSON.stringify(base)),
        id: "2319",
        reportedAt: "2026-10-06T09:40:00+08:00",
        status: "visit-booked",
        ticks: [],
      });
    });
    const state = memory.read();
    const view = howView(state);
    expect(view.meter!.before.calls).toBe(6);
    expect(view.meter).toEqual(seatView(state, "aom-tower-a", "off", REAL_NOW).aom!.meter);
  });

  it("the live wall is the 5 seats, AOM Tower A first, each its real seat view", () => {
    expect([...LIVE_ORDER]).toEqual(["aom-tower-a", "tenant", "technician", "senior-manager", "hq"]);
    const state = memory.read();
    const seats = liveSeats(state, "off", REAL_NOW);
    expect(seats.map((s) => s.seat)).toEqual([...LIVE_ORDER]);
    for (const s of seats) {
      expect(s.initial).toEqual(seatView(state, s.seat, "off", REAL_NOW));
      expect(s.opening).toEqual(openingLineFor(s.seat));
      expect(s.href).toBe(`/seat/${s.seat}`);
    }
    // The same job each seat page opens on.
    expect(seats.find((s) => s.seat === "aom-tower-a")!.jobId).toBeUndefined();
    expect(seats.filter((s) => s.seat !== "aom-tower-a").every((s) => s.jobId === "2318")).toBe(true);
  });

  it("the seats follow a press on the memory", () => {
    press("tenant", "report", undefined, { complaint: "too cold" });
    const seats = liveSeats(memory.read(), "off", REAL_NOW);
    const tenant = seats.find((s) => s.seat === "tenant")!;
    expect(tenant.initial.messages.length).toBeGreaterThan(0);
    expect(tenant.initial).toEqual(seatView(memory.read(), "tenant", "off", REAL_NOW));
  });

  it("the Building B card's first lead turns to the thermostat check only after HQ approves", async () => {
    expect(buildingBView(memory.read(), REAL_NOW, "off")!.leads[0].causeId).toBe("precool");
    await toApprove();
    const card = buildingBView(memory.read(), REAL_NOW, "off")!;
    expect(card.leads[0].causeId).toBe("thermostat-spot");
    expect(card.version).toBe("1.1");
  });
});

// ---- WHAT ----

describe("C10a: WHAT, the 5 seats around one brain", () => {
  it("counts the brain from the data: the live version, the causes and the cases", () => {
    const view = howView(memory.read());
    expect(view.brain.version).toBe("1.0");
    expect(view.brain.causes).toBe(loadCauses().causes.length);
    expect(view.brain.cases).toBe(loadCases().cases.length);
  });

  it("the brain's version follows the memory after HQ approves", async () => {
    await toApprove();
    expect(howView(memory.read()).brain.version).toBe("1.1");
  });

  it("names the 5 seats with their labels, what each is for, what each approves and the Pip never line", () => {
    const view = howView(memory.read());
    expect(view.seats.map((s) => s.id)).toEqual(["tenant", "technician", "senior-manager", "hq", "aom-tower-a"]);
    for (const seat of view.seats) {
      expect(seat.label).toBe(SEAT_LABELS[seat.id]);
      expect(seat.does).toBe(openingLineFor(seat.id).text);
      expect(seat.never).toBe(`Pip never ${PIP_NEVER[seat.id]}.`);
      expect(seat.href).toBe(`/seat/${seat.id}`);
    }
    const approves = Object.fromEntries(view.seats.map((s) => [s.id, s.approves]));
    expect(approves).toEqual({
      tenant: [],
      technician: [],
      "senior-manager": [],
      hq: ["A2", "A3"],
      "aom-tower-a": ["A4"],
    });
  });

  it("Building B is a card, not a seat, with its live version", () => {
    const view = howView(memory.read());
    expect(view.seats.some((s) => (s.id as string) === "building-b")).toBe(false);
    expect(view.buildingB.title).toBe("Building B, Level 12 (made up)");
    expect(view.buildingB.version).toBe("1.0");
  });

  it("who approves what: A1 to A4 only, A1 with the memory's own line", () => {
    const state = memory.read();
    const view = howView(state);
    expect(view.approvals.map((a) => a.id)).toEqual(["A1", "A2", "A3", "A4"]);
    expect(view.approvals[0].line).toBe(state.a1Line);
    expect(view.approvals.map((a) => a.who)).toEqual([
      "Two senior experts (role-played), shown as already signed",
      "HQ, after its tests pass",
      "HQ",
      "AOM, Tower A",
    ]);
  });

  it("the static who-passes-what-to-whom list is S22's five lines", () => {
    expect(PASSES).toEqual([
      { from: "Tenant", to: "technician", what: "visit booked" },
      { from: "Technician", to: "senior manager", what: "not solved, with everything attached" },
      { from: "Senior manager", to: "HQ", what: "new solution, with its tests" },
      { from: "HQ", to: "every building", what: "approved version" },
      { from: "AOM", to: "tenant", what: "charge decision" },
    ]);
    expect(howView(memory.read()).passes).toEqual(PASSES);
  });
});

// ---- HOW ----

describe("C10a: HOW, code decides, the AI words, people approve at A1 to A4", () => {
  it("lists the 10 safety stops from the live pill, with 0 AI calls", () => {
    const view = howView(memory.read());
    const pill = loadAndCheckPill("ts-cc", "1.0");
    expect(view.safety.stops).toEqual(safetyList(pill).map((s) => ({ id: s.id, trigger: s.trigger })));
    expect(view.safety.stops).toHaveLength(10);
    expect(view.safety.line).toMatch(/AI calls: 0/);
  });

  it("has the 4 ranking steps in order, the 30-day rule and the cases counted from the data", () => {
    const view = howView(memory.read());
    expect(view.rankSteps.map((s) => s.name)).toEqual(["Rules first", "Match the facts", "Order", "Show why"]);
    expect(view.rankSteps[1].text).toContain(`${loadCases().cases.length} made-up past cases`);
    expect(view.thirtyDay[0]).toBe("A fix counts as a win only after 30 days with no repeat at the same spot.");
  });

  it("gives the AI's part in a new solution in one line", () => {
    expect(AI_NEW_SOLUTION_LINE).toBe(
      "In a new solution the AI drafts the rule text and suggests the fact and effects from the fixed code menu; the senior manager confirms each part with its own button."
    );
    expect(howView(memory.read()).aiNewSolution).toBe(AI_NEW_SOLUTION_LINE);
  });

  it("asks the brief's 8 questions word for word, each with a one-line answer", () => {
    const brief = readFileSync(join(process.cwd(), "..", "docs", "challenge", "keppel-brief.md"), "utf-8").replace(
      /\r\n/g,
      "\n"
    );
    const section = brief.slice(brief.indexOf("## The solution diagram must answer these 8 questions"));
    const asked = [...section.matchAll(/^(\d)\. ([\s\S]+?)(?=\n\d\. |\n\n)/gm)]
      .slice(0, 8)
      .map((m) => m[2].replace(/\s*\n\s*/g, " ").trim());
    expect(asked).toHaveLength(8);
    const view = howView(memory.read());
    expect(view.questions.map((q) => q.question)).toEqual(asked);
    for (const q of view.questions) {
      expect(q.answer).not.toMatch(/\n/);
      expect(q.answer.length).toBeGreaterThan(20);
      expect(q.answer.length).toBeLessThan(200);
    }
    // The problem's answer carries the story's own numbers.
    expect(view.questions[0].answer).toContain("5 times in 21 days");
  });

  it("says the seats are role-played with no login and all data is made up", () => {
    expect(ROLE_PLAYED_LINE).toMatch(/role-played with no login/);
    expect(ROLE_PLAYED_LINE).toMatch(/made up/);
    expect(howView(memory.read()).rolePlayed).toBe(ROLE_PLAYED_LINE);
  });
});

// ---- The bar's demo steps and the footer ----

describe("C10a: the demo steps as text, in the T-C10b order", () => {
  it("names the seat for each step: Reset, tenant, technician, senior manager, HQ, AOM", () => {
    const steps = howView(memory.read()).demoSteps;
    expect(steps.map((s) => s.seat)).toEqual(["bar", "tenant", "technician", "senior-manager", "hq", "aom-tower-a"]);
    expect(steps.map((s) => s.who)).toEqual(["This bar", "Tenant", "Technician", "Senior manager", "HQ", "AOM Tower A"]);
  });

  it("names each button with the words the screen shows", () => {
    const steps = howView(memory.read()).demoSteps;
    const label = (id: string) => loadCauses().causes.find((c) => c.id === id)!.label;
    const answers = (id: string) => SELF_CHECK_QUESTIONS.find((q) => q.id === id)!.answers;

    expect(steps[0].text).toContain("Reset demo");
    expect(steps[1].text).toContain("Report a problem");
    expect(steps[1].text).toContain("Too cold");
    for (const a of [answers("Q0")[1], answers("Q1")[0], answers("Q2")[2], answers("Q3")[0], answers("Q4-thermostat")[2]]) {
      expect(steps[1].text).toContain(a);
    }
    expect(steps[2].text).toContain("Open job");
    expect(steps[2].text).toContain(`Not this on "${label("precool")}"`);
    expect(steps[2].text).toContain(`"${label("min-airflow")}"`);
    expect(steps[2].text).toContain("Not solved");
    expect(steps[2].text).toContain("Send to the senior manager");
    expect(steps[3].text).toContain(`Found it on "${label("thermostat-spot")}"`);
    expect(steps[3].text).toContain("Log new solution");
    for (const [part, value] of [
      ["fact", "fit-out-12m"],
      ["effect-1", "block:25"],
      ["effect-2", "put-first:21"],
    ] as const) {
      expect(steps[3].text).toContain(`${PART_TITLES[part]} (${partDisplay(part, value)})`);
    }
    expect(steps[3].text).toContain("Run tests");
    expect(steps[3].text).toContain("Send to HQ");
    expect(steps[4].text).toContain("Approve and send to all buildings");
    expect(steps[4].text).toContain(label("thermostat-spot"));
    expect(steps[5].text).toContain("Decide charge");
    for (const c of CHARGE_CHOICES) expect(steps[5].text).toContain(c.label);
  });

  it("never plays itself: the steps are text, with no timer in the live wall", () => {
    const live = readFileSync(join(process.cwd(), "app", "components", "how", "HowLive.tsx"), "utf-8");
    expect(live).not.toMatch(/setTimeout/);
    expect(live).not.toMatch(/autoPlay|autoplay/);
  });

  it("the footer's close line is word for word", () => {
    expect(CLOSE_LINE).toBe(
      "The checklist finds it faster, people approve only what matters, and every fix makes the next one faster."
    );
    expect(howView(memory.read()).closeLine).toBe(CLOSE_LINE);
  });
});

describe("C10a: the page is one React route on the one memory", () => {
  const page = readFileSync(join(process.cwd(), "app", "how", "page.tsx"), "utf-8");

  it("reads the memory at request time", () => {
    expect(page).toContain('export const dynamic = "force-dynamic"');
    expect(page).toContain("memory.read()");
  });

  it("renders the story, the live wall with the real seat views, and the close line", () => {
    expect(page).toContain("<HowStory");
    expect(page).toContain("<HowLive");
    expect(page).toContain("liveSeats(");
    expect(page).toContain("buildingBView(");
    expect(page).toContain("view.closeLine");
  });
});
