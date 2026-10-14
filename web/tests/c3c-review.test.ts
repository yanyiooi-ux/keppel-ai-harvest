/**
 * Review fixes for C3c. Two reviewers read the C3c build; each test here proves
 * one finding they reported, against the real code. Old tests stay byte for byte.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "yaml";
import { loadPill, checkPill, type Pill } from "../lib/pill";
import { screenSuggestion } from "../lib/conditions";
import { buildDraft, draftYaml, draftHash } from "../lib/draft";
import { runDraftTests } from "../lib/draft-tests";
import { runAction, resetDemo, callsForState, sendToHqRefusal } from "../lib/actions";
import { handleTyped, applyTypedReply } from "../lib/chat";
import { seatView } from "../lib/seat-view";
import { leadsForJob, dialStanding } from "../lib/leads";
import { computeRepeatFlag, type Ticket } from "../lib/rule-engine";
import { SEAT_LABELS } from "../lib/permissions";
import * as memory from "../lib/memory";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");
const v10 = loadPill("ts-cc", "1.0");
const fixture = parse(
  readFileSync(join(process.cwd(), "tests", "fixtures", "ts-cc-v1.1.yaml"), "utf-8").replace(/\r\n/g, "\n")
) as Pill;

const DEMO_FIX =
  "If the zone had a fit-out in the last 12 months, check where the thermostat sits against the fit-out drawing before any nudge.";
const DEMO_WHY =
  "The fit-out 8 months ago moved the core thermostat next to the new printer bay, so it reads warm and the box keeps cooling the open area.";
const DEMO_EFFECTS = [
  { effect: "block", step: 25 },
  { effect: "put-first", step: 21 },
];

function stop(id: string) {
  const s = v10.red_stops.find((r) => r.id === id);
  if (!s) throw new Error(`no ${id}`);
  return s;
}

function alertNotices() {
  return memory.read().notices.filter((n) => n.kind === "alert");
}

/** S11: a code title, then trigger, action and who_to_call word for word, and the receipt. */
function expectFullAlert(text: string, stopId: string, title: string) {
  const s = stop(stopId);
  expect(text).toContain(title);
  expect(text).toContain(s.trigger);
  expect(text).toContain(s.action);
  expect(text).toContain(`Call: ${s.who_to_call}`);
  expect(text).toContain(`Red stop ${stopId} · AI calls: 0`);
}

// ---- Finding: stored safety alerts dropped who_to_call, the trigger and the receipt (S11) ----

describe("review C3c: every stored safety alert says who to call", () => {
  beforeEach(() => {
    resetDemo(REAL_NOW);
  });

  it("typed safety words store the full S11 alert for the senior manager and the AOM", () => {
    const reply = handleTyped(memory.read(), "tenant", "the ceiling is dripping", "2318", REAL_NOW);
    memory.update((s) => applyTypedReply(s, "tenant", "2318", reply));

    const alerts = alertNotices();
    expect(alerts.map((a) => a.seat).sort()).toEqual(["aom-tower-a", "senior-manager"]);
    for (const a of alerts) expectFullAlert(a.text, "RS-04", "Red stop on Tower A, Level 23");
  });

  it("a pick from the Safety list stores the full S11 alert", () => {
    runAction({ seat: "technician", action: "safety-pick", jobId: "2401", payload: { stopId: "RS-05" } }, REAL_NOW);

    const alerts = alertNotices();
    expect(alerts.map((a) => a.seat).sort()).toEqual(["building-b-card", "senior-manager"]);
    for (const a of alerts) expectFullAlert(a.text, "RS-05", "Red stop on Building B, Level 12");
  });

  it("the senior manager's screen gets the who-to-call line", () => {
    runAction({ seat: "technician", action: "safety-pick", jobId: "2318", payload: { stopId: "RS-04" } }, REAL_NOW);

    const view = seatView(memory.read(), "senior-manager");
    const alert = view.notices.find((n) => n.kind === "alert");
    expect(alert).toBeDefined();
    expect(alert!.text).toContain(`Call: ${stop("RS-04").who_to_call}`);
  });

  it("Raise this stop after typed words still sends no second alert, and the amended alert keeps every part", () => {
    const reply = handleTyped(memory.read(), "tenant", "the ceiling is dripping", "2318", REAL_NOW);
    memory.update((s) => applyTypedReply(s, "tenant", "2318", reply));
    runAction({ seat: "tenant", action: "safety-pick", jobId: "2318", payload: { stopId: "RS-04" } }, REAL_NOW);

    const alerts = alertNotices();
    expect(alerts).toHaveLength(2);
    for (const a of alerts) {
      expectFullAlert(a.text, "RS-04", "Red stop on Tower A, Level 23");
      expect(a.text).toContain(`raised by ${SEAT_LABELS.tenant}`);
    }
  });
});

// ---- Finding: a second Raise this stop press sent a fresh alert and opened a second stop (S11) ----

describe("review C3c: pressing the same stop again changes nothing", () => {
  beforeEach(() => {
    resetDemo(REAL_NOW);
  });

  it("a second Raise this stop on the same job opens no second stop and sends no alert", () => {
    const reply = handleTyped(memory.read(), "technician", "the heater plug is scorched and smoking", "2401", REAL_NOW);
    memory.update((s) => applyTypedReply(s, "technician", "2401", reply));
    const typedCount = alertNotices().length;

    runAction({ seat: "technician", action: "safety-pick", jobId: "2401", payload: { stopId: "RS-01" } }, REAL_NOW);
    const second = runAction(
      { seat: "technician", action: "safety-pick", jobId: "2401", payload: { stopId: "RS-01" } },
      REAL_NOW
    );
    expect(second.ok).toBe(true);

    const after = memory.read();
    expect(after.openRedStops.filter((s) => s.stopId === "RS-01")).toHaveLength(1);
    expect(alertNotices()).toHaveLength(typedCount);
  });

  it("a second Safety-list pick of an open stop opens no second stop and sends no alert", () => {
    runAction({ seat: "technician", action: "safety-pick", jobId: "2318", payload: { stopId: "RS-04" } }, REAL_NOW);
    runAction({ seat: "aom-tower-a", action: "safety-pick", payload: { stopId: "RS-04" } }, REAL_NOW);

    expect(memory.read().openRedStops).toHaveLength(1);
    expect(alertNotices()).toHaveLength(2);
  });
});

// ---- Finding: the AI's new-solution answer in the S15 shape was always an empty note ----

describe("review C3c: the new-solution answer in S15's shape", () => {
  it("{ ruleText, fact, effects } that fits the menu is screened as a rule with that text", () => {
    const screened = screenSuggestion({ ruleText: DEMO_FIX, fact: "fit-out-12m", effects: DEMO_EFFECTS }, v10);
    expect(screened).toEqual({
      kind: "rule",
      text: DEMO_FIX,
      condition: { fact: "fit-out-12m", effects: DEMO_EFFECTS },
      colour: "green",
    });
  });

  it("a forced rule in S15's shape that blocks step 8 comes back as a note that shows its text", () => {
    const text = "Skip the ceiling safety plan when the zone had a fit-out.";
    const screened = screenSuggestion({ ruleText: text, fact: "fit-out-12m", effects: [{ effect: "block", step: 8 }] }, v10);
    expect(screened.kind).toBe("note");
    if (screened.kind !== "note") throw new Error("expected a note");
    expect(screened.text).toBe(text);
    expect(screened.label).toBe("advisory, not enforced");
    expect(screened.refusals.length).toBeGreaterThan(0);
  });
});

// ---- Finding: send-to-hq read the run's passed count as a yes/no flag (S16 item 7) ----

describe("review C3c: send-to-hq needs a stored run with 0 failed", () => {
  const blockOnly = buildDraft(
    v10,
    { fixLine: DEMO_FIX, whyLine: DEMO_WHY, fact: "fit-out-12m", effects: [{ effect: "block", step: 25 }] },
    REAL_NOW
  );
  const demo = buildDraft(v10, { fixLine: DEMO_FIX, whyLine: DEMO_WHY, fact: "fit-out-12m", effects: DEMO_EFFECTS }, REAL_NOW);
  if (!blockOnly.ok || !demo.ok) throw new Error("both drafts are menu-legal");
  const failingYaml = draftYaml(blockOnly.pill);
  const failingRun = runDraftTests(failingYaml, { now: REAL_NOW });
  const passingYaml = draftYaml(demo.pill);
  const passingRun = runDraftTests(passingYaml, { now: REAL_NOW });

  beforeEach(() => {
    resetDemo(REAL_NOW);
  });

  it("a run with a failed case, stored as runDraftTests returns it, is refused", () => {
    expect(failingRun.failed).toBeGreaterThan(0);
    expect(failingRun.passed).toBeGreaterThan(0);
    memory.update((s) => {
      s.solutions = [{ jobId: "2318", hash: draftHash(failingYaml), testRun: failingRun }];
      s.jobs.find((j) => j.id === "2318")!.status = "new-solution-drafted";
    });
    const result = runAction({ seat: "senior-manager", action: "send-to-hq", jobId: "2318" }, REAL_NOW);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/no passing test run/);
  });

  it("the gate passes only 0 failed on this exact draft hash", () => {
    expect(passingRun.failed).toBe(0);
    const hash = draftHash(passingYaml);
    expect(sendToHqRefusal({ hash, testRun: passingRun })).toBeNull();
    expect(sendToHqRefusal({ hash: draftHash(failingYaml), testRun: failingRun })).toMatch(/no passing test run/);
    expect(sendToHqRefusal({ hash: draftHash(failingYaml), testRun: passingRun })).toMatch(/no passing test run/);
    expect(sendToHqRefusal({ hash })).toMatch(/no passing test run/);
    expect(sendToHqRefusal(undefined)).toMatch(/no passing test run/);
  });
});

// ---- Minor: found and ruled-out reasons named the seat id, not the seat label (S9) ----

describe("review C3c: found and ruled-out reasons name the seat label", () => {
  beforeEach(() => {
    resetDemo(REAL_NOW);
  });

  it("ticks with no seat recorded name the viewing seat's label", () => {
    memory.update((s) => {
      s.jobs.find((j) => j.id === "2318")!.ticks = [
        { causeId: "precool", type: "not-this" },
        { causeId: "thermostat-spot", type: "found" },
      ];
    });
    const state = memory.read();
    const result = leadsForJob(state, state.jobs.find((j) => j.id === "2318")!, "technician", REAL_NOW);
    expect(result.leads[0].reason).toBe(`Checked: found it (${SEAT_LABELS.technician}).`);
    expect(result.ruledOut[0].reason).toBe(`Checked: not this (${SEAT_LABELS.technician}).`);
  });

  it("a tick records who made it, and the reason names that seat", () => {
    memory.update((s) => {
      s.jobs.find((j) => j.id === "2318")!.ticks = [
        { causeId: "precool", type: "not-this", seat: "technician" },
        { causeId: "thermostat-spot", type: "found", seat: "senior-manager" },
      ];
    });
    const state = memory.read();
    const result = leadsForJob(state, state.jobs.find((j) => j.id === "2318")!, "technician", REAL_NOW);
    expect(result.leads[0].reason).toBe(`Checked: found it (${SEAT_LABELS["senior-manager"]}).`);
    expect(result.ruledOut[0].reason).toBe(`Checked: not this (${SEAT_LABELS.technician}).`);
  });
});

// ---- Minor: Dial? read a made-up repeat reason (S9 step a, S19) ----

describe("review C3c: the dial lead's removal gives canNudge's real repeat reason", () => {
  beforeEach(() => {
    resetDemo(REAL_NOW);
  });

  it("2318's setpoint removal quotes the real repeat flag, read with the clock rule", () => {
    const state = memory.read();
    const job = state.jobs.find((j) => j.id === "2318")!;
    const asOf = new Date(new Date(job.reportedAt).getTime() + 20 * 60 * 1000);
    const repeat = computeRepeatFlag(callsForState(state), job as Ticket, asOf);
    expect(repeat.isRepeat).toBe(true);
    expect(repeat.reason.length).toBeGreaterThan(0);

    const dial = dialStanding(state, job, "technician", REAL_NOW);
    expect(dial.allowed).toBe(false);
    expect(dial.reason).toBe(`Removed by TS-CC-09: Repeat flag is on: ${repeat.reason}.`);
  });
});

// ---- Minor: checkPill let an old rule TS-CC-01 to 26 carry a condition (S4 item 6, S16) ----

describe("review C3c: only a new-solution rule carries a condition", () => {
  function withConditionOn(pill: Pill, ruleId: string): Pill {
    const copy = JSON.parse(JSON.stringify(pill)) as Pill;
    copy.rules.find((r) => r.id === ruleId)!.condition = {
      fact: "repeat",
      effects: [{ effect: "put-first", step: 20 }],
    };
    return copy;
  }

  it("v1.0 with a condition on TS-CC-17 is refused", () => {
    const errors = checkPill(withConditionOn(v10, "TS-CC-17"));
    expect(errors.some((e) => e.includes("TS-CC-17"))).toBe(true);
  });

  it("the v1.1 fixture with a condition on TS-CC-17 is refused, and the fixture itself still passes", () => {
    expect(checkPill(fixture)).toEqual([]);
    const errors = checkPill(withConditionOn(fixture, "TS-CC-17"));
    expect(errors.some((e) => e.includes("TS-CC-17"))).toBe(true);
  });
});

// ---- Minor, a spec question for YY (run rule 8), logged in .codebuddy/plans/QUESTIONS.md ----

describe("review C3c: GT-22 and hand-picked fit-out rules", () => {
  it.todo(
    "QUESTION C3c: S16 item 4 makes GT-22 expect step 21 right after steps 1 to 8 for any pill whose fit-out-12m rule blocks step 25, so a menu-legal fit-out rule that puts another step first (or none) always fails its tests and can never reach HQ. Is that intended, or should GT-22 apply only to the demo rule?"
  );
});
