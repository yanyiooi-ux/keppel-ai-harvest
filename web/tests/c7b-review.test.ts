/**
 * Review findings for C7b, each pinned before its fix.
 *
 * - A pick of a stop another seat already raised still shows that stop's card
 *   in the picking seat's chat (S11 "Picking one shows that stop's card"); only
 *   the same seat's second press shows nothing new.
 * - A technician with two jobs in progress can still reach the first one: the
 *   job list offers Show job, and the view shows the job asked for.
 * - The removed list holds capacity's reason too (T-C2d, S9).
 * - A press on a job that has moved past in-progress says why, not "Open the
 *   job first." or "That job is already open." (S3).
 *
 * Fake clients only, AI off. Nothing here reads web/data/replay/.
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as memory from "../lib/memory";
import { resetDemo, runAction } from "../lib/actions";
import { seatView } from "../lib/seat-view";
import { loadPill } from "../lib/pill";
import { mayPress } from "../lib/permissions";
import type { OpenJobDesk, TechnicianDesk } from "../lib/technician-desk";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");
const v10 = loadPill("ts-cc", "1.0");

beforeEach(() => {
  resetDemo(REAL_NOW);
});

function press(seat: string, action: string, jobId?: string, payload?: Record<string, unknown>) {
  return runAction({ seat, action, jobId, payload }, REAL_NOW);
}

function seatMessages(seat: string) {
  return memory.read().messages.filter((m) => m.seat === seat);
}

type Card = Record<string, unknown> & { kind: string };

function desk(show?: string): TechnicianDesk {
  const view = seatView(memory.read(), "technician", undefined, REAL_NOW, show);
  expect(view.desk).toBeDefined();
  return view.desk!;
}

function openJob(show?: string): OpenJobDesk {
  const open = desk(show).open;
  expect(open).not.toBeNull();
  return open!;
}

/** The tenant's self-check through the real presses; returns the job it landed on. */
function selfCheck(complaint: string, answers: [string, string][]): string {
  const report = press("tenant", "report", undefined, { complaint });
  expect(report.ok, report.message).toBe(true);
  for (const [questionId, answer] of answers) {
    const r = press("tenant", "answer", report.jobId, { questionId, answer });
    expect(r.ok, r.message).toBe(true);
  }
  return report.jobId!;
}

const HOT_WEST_BLINDS_DOWN: [string, string][] = [
  ["Q0", "No"],
  ["Q1", "West glass boardroom"],
  ["Q2", "This week"],
  ["Q3", "No"],
  ["Q4-blinds", "Yes"],
];

// ---- Major: a second seat's pick of a stop that is already open showed nothing ----

describe("C7b review: picking a stop another seat already raised shows that stop's card (S11)", () => {
  it("tenant raises RS-04 on 2318, then the technician picks RS-04: one stop, no new alert, the card in the technician's chat", () => {
    expect(press("tenant", "safety-pick", "2318", { stopId: "RS-04" }).ok).toBe(true);
    const alertsBefore = memory.read().notices.filter((n) => n.kind === "alert").length;
    const before = seatMessages("technician").length;

    const picked = press("technician", "safety-pick", "2318", { stopId: "RS-04" });
    expect(picked.ok, picked.message).toBe(true);
    expect(memory.read().openRedStops).toHaveLength(1);
    expect(memory.read().notices.filter((n) => n.kind === "alert")).toHaveLength(alertsBefore);

    const after = seatMessages("technician");
    expect(after).toHaveLength(before + 1);
    const rs04 = v10.red_stops.find((s) => s.id === "RS-04")!;
    const card = ((after.at(-1)!.cards ?? []) as Card[])[0];
    expect(card).toMatchObject({ kind: "red-stop", stopId: "RS-04", title: rs04.trigger, body: rs04.action, call: rs04.who_to_call });
  });

  it("the technician's own second pick then shows nothing new; the tenant's chat keeps its one card", () => {
    press("tenant", "safety-pick", "2318", { stopId: "RS-04" });
    press("technician", "safety-pick", "2318", { stopId: "RS-04" });
    const technician = seatMessages("technician").length;
    const tenant = seatMessages("tenant").length;

    const again = press("technician", "safety-pick", "2318", { stopId: "RS-04" });
    expect(again.ok).toBe(true);
    expect(again.message).toMatch(/already open/);
    expect(seatMessages("technician")).toHaveLength(technician);
    expect(seatMessages("tenant")).toHaveLength(tenant);
    expect(memory.read().openRedStops).toHaveLength(1);
  });
});

// ---- Major: a second open job left the first one out of reach ----

describe("C7b review: with two jobs in progress, the first stays reachable (Show job)", () => {
  function twoJobsOpen(): string {
    expect(press("technician", "open-job", "2318").ok).toBe(true);
    const second = selfCheck("too hot", HOT_WEST_BLINDS_DOWN);
    expect(second).toBe("2319");
    expect(memory.jobById(memory.read(), "2319")!.status).toBe("visit-booked");
    expect(press("technician", "open-job", "2319").ok).toBe(true);
    return second;
  }

  it("the job list offers Show job on the in-progress job that is not on the desk", () => {
    twoJobsOpen();
    const rows = desk().jobs;
    const first = rows.find((j) => j.id === "2318")!;
    const second = rows.find((j) => j.id === "2319")!;
    expect(first.status).toBe("in-progress");
    expect(first.isOpen).toBe(false);
    expect(first.canShow).toBe(true);
    expect(second.isOpen).toBe(true);
    expect(second.canShow).toBe(false);
    expect(desk().open!.jobId).toBe("2319");
  });

  it("asking for 2318 shows its desk with its leads and presses; 2319 then offers Show job", () => {
    twoJobsOpen();
    const open = openJob("2318");
    expect(open.jobId).toBe("2318");
    expect(open.inProgress).toBe(true);
    expect(open.leads.map((l) => l.causeId)).toEqual(["precool", "min-airflow", "thermostat-spot"]);
    const rows = desk("2318").jobs;
    expect(rows.find((j) => j.id === "2318")).toMatchObject({ isOpen: true, canShow: false });
    expect(rows.find((j) => j.id === "2319")).toMatchObject({ isOpen: false, canShow: true });
  });

  it("a tick on 2318 shows on its desk at once", () => {
    twoJobsOpen();
    expect(press("technician", "tick", "2318", { causeId: "precool", type: "not-this" }).ok).toBe(true);
    expect(openJob("2318").leads[0].causeId).toBe("min-airflow");
  });

  it("a job the technician may not work on is never shown: the desk keeps the open job", () => {
    twoJobsOpen();
    expect(openJob("2401").jobId).toBe("2319");
    expect(openJob("no-such-job").jobId).toBe("2319");
    resetDemo(REAL_NOW);
    expect(press("technician", "open-job", "2318").ok).toBe(true);
    const third = selfCheck("too hot", HOT_WEST_BLINDS_DOWN);
    // 2319 is visit-booked and not opened yet: Open job, not Show job.
    expect(openJob(third).jobId).toBe("2318");
    expect(desk().jobs.find((j) => j.id === third)).toMatchObject({ canOpen: true, canShow: false });
  });
});

// ---- Minor: capacity's removal reason was never checked ----

describe("C7b review: the removed list carries capacity's reason (T-C2d, S9)", () => {
  it("capacity: Does not explain too cold.", () => {
    press("technician", "open-job", "2318");
    expect(openJob().removed.find((r) => r.causeId === "capacity")!.reason).toBe("Does not explain too cold.");
  });
});

// ---- Minor: a press on a job past in-progress gave the wrong reason ----

describe("C7b review: a press on a job that moved on says why (S3)", () => {
  it("after Send with the cause, tick, Solved, Not solved and Open job on 2318 say it is escalated", () => {
    press("technician", "open-job", "2318");
    press("technician", "tick", "2318", { causeId: "thermostat-spot", type: "found" });
    expect(press("technician", "send-with-cause", "2318").ok).toBe(true);
    expect(memory.jobById(memory.read(), "2318")!.status).toBe("escalated");

    const presses: [string, Record<string, unknown> | undefined][] = [
      ["tick", { causeId: "precool", type: "not-this" }],
      ["solved", { whyLine: "It was the thermostat spot." }],
      ["not-solved", { hoursLost: 1, extraVisits: 1, contractorOrPartsNeeded: false }],
      ["send-with-cause", undefined],
      ["open-job", undefined],
    ];
    for (const [action, payload] of presses) {
      const refused = press("technician", action, "2318", payload);
      expect(refused.ok, action).toBe(false);
      expect(refused.message, action).not.toBe("Open the job first.");
      expect(refused.message, action).not.toMatch(/already open/);
      expect(refused.message, action).toMatch(/escalated/);
    }
  });

  it("a solved job waiting for its 30-day check says so", () => {
    for (const action of ["tick", "solved", "not-solved", "send-with-cause", "open-job"]) {
      const result = mayPress("technician", action, "pending-30-day");
      expect(result.allowed, action).toBe(false);
      expect(result.reason, action).toMatch(/30-day check/);
    }
  });

  it("a job not opened yet still says Open the job first; an open one still says it is open", () => {
    expect(mayPress("technician", "tick", "reported").reason).toBe("Open the job first.");
    expect(mayPress("technician", "solved", "visit-booked").reason).toBe("Open the job first.");
    expect(mayPress("technician", "open-job", "in-progress").reason).toBe("That job is already open.");
  });
});

// ---- Minor: two spec lines on where an amount may show ----

describe("C7b review: the impact record's cost in the senior manager's chat", () => {
  it.todo(
    "QUESTION C7b review: S13 item 9 says \"Amounts appear only in code-made cards: the impact meter (S18) and the AOM's charge card (S17).\" T-C7b says \"the senior manager's chat gets it with a cost from the made-up rates\", and S3 says the impact record is \"shown to the senior manager and the AOM\". Built: the senior manager's escalation notice shows the cost (S$420). Should the senior manager's chat show the amount?"
  );
});
