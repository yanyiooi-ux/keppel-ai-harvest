/**
 * Review findings for C8a, each pinned before its fix.
 *
 * - confirm-cause is allowed only from a pending case (S2), checked on the
 *   server, not only hidden on screen: a case whose spot called again within
 *   30 days has failed (S8), and a direct press on it is refused.
 * - The senior manager's Clear stop row is a red stop card (S11): the pill's
 *   action as its body and the receipt with the pill version.
 * - The cleared-stop card ends the typed reason with a full stop before the
 *   safety record line.
 * - A senior manager press on a job in the wrong status says where the job is,
 *   in plain words (S3), not a generic sentence.
 *
 * Fake clients only, AI off. Nothing here reads web/data/replay/.
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as memory from "../lib/memory";
import type { JobStatus } from "../lib/memory";
import { resetDemo, runAction, confirmCause } from "../lib/actions";
import { seatView } from "../lib/seat-view";
import { leadsForJob } from "../lib/leads";
import { loadPill } from "../lib/pill";
import { mayPress, ACTION_RULES } from "../lib/permissions";
import { openStopKey, SAFETY_RECORD_LINE, SAFETY_RECORD_NOTE } from "../lib/senior-manager-flow";
import type { ManagerDesk } from "../lib/senior-manager-desk";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");
const HOUR = 60 * 60 * 1000;
const v10 = loadPill("ts-cc", "1.0");

beforeEach(() => {
  resetDemo(REAL_NOW);
});

function pressAt(at: Date, seat: string, action: string, jobId?: string, payload?: Record<string, unknown>) {
  return runAction({ seat, action, jobId, payload }, at);
}

function press(seat: string, action: string, jobId?: string, payload?: Record<string, unknown>) {
  return pressAt(REAL_NOW, seat, action, jobId, payload);
}

function desk(at: Date = REAL_NOW): ManagerDesk {
  const view = seatView(memory.read(), "senior-manager", undefined, at);
  expect(view.manager).toBeDefined();
  return view.manager!;
}

/** The tenant's self-check through the real presses, at `at`; returns the job it landed on. */
function selfCheckAt(at: Date, complaint: string, answers: [string, string][]): string {
  const report = pressAt(at, "tenant", "report", undefined, { complaint });
  expect(report.ok, report.message).toBe(true);
  let last = report;
  for (const [questionId, answer] of answers) {
    last = pressAt(at, "tenant", "answer", report.jobId, { questionId, answer });
    expect(last.ok, last.message).toBe(true);
  }
  return last.jobId!;
}

const HOT_WEST_BLINDS_DOWN: [string, string][] = [
  ["Q0", "No"],
  ["Q1", "West glass boardroom"],
  ["Q2", "This week"],
  ["Q3", "No"],
  ["Q4-blinds", "Yes"],
];

/** The technician solves the west boardroom job with a lead it may fix; returns the saved case's id. */
function solveWestBoardroom(): { jobId: string; caseId: string } {
  const jobId = selfCheckAt(REAL_NOW, "too hot", HOT_WEST_BLINDS_DOWN);
  expect(press("technician", "open-job", jobId).ok).toBe(true);
  const job = memory.jobById(memory.read(), jobId)!;
  const lead = leadsForJob(memory.read(), job, "technician", REAL_NOW).leads.find((l) => l.fixAllowedHere)!;
  expect(lead).toBeDefined();
  expect(press("technician", "tick", jobId, { causeId: lead.causeId, type: "found" }).ok).toBe(true);
  const solved = press("technician", "solved", jobId, { whyLine: "The blinds were left up all afternoon." });
  expect(solved.ok, solved.message).toBe(true);
  const saved = memory.read().runtimeCases.find((c) => c.jobId === jobId)!;
  expect(saved).toBeDefined();
  return { jobId, caseId: saved.id };
}

// ---- Major: confirm-cause only from a pending case, on the server ----

describe("C8a review: confirm-cause is refused on a case that is not pending", () => {
  it("a case whose spot called again within 30 days has failed: a direct press is refused and changes nothing", () => {
    const { jobId, caseId } = solveWestBoardroom();
    const later = new Date(REAL_NOW.getTime() + HOUR);
    const again = selfCheckAt(later, "too hot", HOT_WEST_BLINDS_DOWN);
    expect(again).not.toBe(jobId);

    const after = new Date(later.getTime() + 60 * 1000);
    // The screen already hides it.
    expect(desk(after).cases.find((c) => c.id === caseId)).toBeUndefined();

    for (const seat of ["senior-manager", "hq"]) {
      const r = pressAt(after, seat, "confirm-cause", undefined, { caseId });
      expect(r.ok, seat).toBe(false);
      expect(r.message).toBe("Confirm cause is only for a pending case: the spot called again within 30 days, so this fix failed.");
    }
    expect(memory.read().runtimeCases.find((c) => c.id === caseId)!.confirmedBy).toBeNull();
  });

  it("confirmCause reads the same outcome as the senior manager's list", () => {
    const { caseId } = solveWestBoardroom();
    const later = new Date(REAL_NOW.getTime() + HOUR);
    selfCheckAt(later, "too hot", HOT_WEST_BLINDS_DOWN);
    const after = new Date(later.getTime() + 60 * 1000);
    const state = memory.read();
    const r = confirmCause(state, "senior-manager", caseId, after);
    expect(r.ok).toBe(false);
    expect(state.runtimeCases.find((c) => c.id === caseId)!.confirmedBy).toBeNull();
  });

  it("the same case is still confirmed while it is pending", () => {
    const { caseId } = solveWestBoardroom();
    expect(desk().cases.find((c) => c.id === caseId)!.canConfirm).toBe(true);
    const r = press("senior-manager", "confirm-cause", undefined, { caseId });
    expect(r.ok, r.message).toBe(true);
    expect(memory.read().runtimeCases.find((c) => c.id === caseId)!.confirmedBy).toBe("senior-manager");
  });
});

// ---- Minor: the Clear stop row is a red stop card (S11) ----

describe("C8a review: the Clear stop row carries the stop's action and the full receipt", () => {
  for (const stopId of ["RS-01", "RS-04"]) {
    it(`${stopId}'s row has the pill's action word for word and "Red stop ${stopId} · pill v1.0 · AI calls: 0"`, () => {
      expect(press("technician", "safety-pick", "2318", { stopId }).ok).toBe(true);
      const def = v10.red_stops.find((s) => s.id === stopId)!;
      const row = desk().stops.find((s) => s.stopId === stopId)!;
      expect(row.title).toBe(def.trigger);
      expect(row.action).toBe(def.action);
      expect(row.call).toBe(def.who_to_call);
      expect(row.receipt).toBe(`Red stop ${stopId} · pill v1.0 · AI calls: 0`);
    });
  }
});

// ---- Minor: the cleared-stop card reads as sentences ----

describe("C8a review: the cleared-stop card ends the reason with a full stop", () => {
  function clearedCardBody(): string {
    const card = memory.read().messages.filter((m) => m.seat === "senior-manager").pop()!;
    return String((card.cards?.[0] as { body?: string }).body);
  }

  it("a reason with no full stop gets one before the safety record line", () => {
    expect(press("technician", "safety-pick", "2318", { stopId: "RS-01" }).ok).toBe(true);
    const open = memory.read().openRedStops.find((s) => s.stopId === "RS-01" && s.clearedAt === null)!;
    const r = press("senior-manager", "clear-stop", undefined, {
      stop: openStopKey(open),
      reason: "the alarm was tested",
      safetyRecord: true,
    });
    expect(r.ok, r.message).toBe(true);
    expect(clearedCardBody()).toContain(`Reason: the alarm was tested. ${SAFETY_RECORD_LINE}. ${SAFETY_RECORD_NOTE}`);
    // What was typed is stored as typed.
    expect(memory.read().openRedStops.find((s) => s.stopId === "RS-01")!.clearedReason).toBe("the alarm was tested");
  });

  it("a reason that already ends a sentence gets no second full stop", () => {
    expect(press("technician", "safety-pick", "2318", { stopId: "RS-04" }).ok).toBe(true);
    const open = memory.read().openRedStops.find((s) => s.stopId === "RS-04" && s.clearedAt === null)!;
    expect(press("senior-manager", "clear-stop", undefined, { stop: openStopKey(open), reason: "Ceiling is dry again." }).ok).toBe(true);
    const body = clearedCardBody();
    expect(body).toMatch(/Reason: Ceiling is dry again\.$/);
    expect(body).not.toContain("..");
  });
});

// ---- Minor: plain wrong-status reasons for the senior manager's presses (S3) ----

describe("C8a review: a senior manager press on the wrong status says where the job is", () => {
  it("Ask HQ for outside help on a job already waiting on HQ", () => {
    memory.update((s) => {
      memory.jobById(s, "2318")!.status = "outside-help-requested";
    });
    const r = press("senior-manager", "ask-outside-help", "2318", { need: "contractor", reason: "The air needs balancing", needsMoney: false });
    expect(r.ok).toBe(false);
    expect(r.message).toBe("That job waits for HQ's decision on outside help (A3).");
  });

  it("Send to HQ on an escalated job with no draft", () => {
    memory.update((s) => {
      memory.jobById(s, "2318")!.status = "escalated";
    });
    const r = press("senior-manager", "send-to-hq", "2318");
    expect(r.ok).toBe(false);
    expect(r.message).toBe("That job has no new solution drafted yet: log a new solution first.");
  });

  it("Log new solution on a job that already has a draft", () => {
    expect(mayPress("senior-manager", "log-new-solution", "new-solution-drafted").reason).toBe(
      "That job has a new solution drafted: it waits for its tests and HQ's decision (A2)."
    );
  });

  it("a job that has not come up to the senior manager", () => {
    for (const status of ["reported", "visit-booked", "in-progress"] as JobStatus[]) {
      expect(mayPress("senior-manager", "tick", status).reason, status).toBe(
        "That job has not come up to the senior manager yet."
      );
    }
  });

  it("a solved job says it is solved", () => {
    expect(mayPress("senior-manager", "solved", "pending-30-day").reason).toBe("That job is solved: it waits for its 30-day check.");
  });

  it("no senior manager press on any status falls back to the generic sentence", () => {
    const statuses: JobStatus[] = [
      "reported",
      "self-check",
      "visit-booked",
      "in-progress",
      "pending-30-day",
      "won",
      "failed",
      "escalated",
      "new-solution-drafted",
      "approved-and-distributed",
      "outside-help-requested",
    ];
    for (const [action, rule] of Object.entries(ACTION_RULES)) {
      const gate = rule.seats["senior-manager"];
      if (!Array.isArray(gate)) continue;
      for (const status of statuses) {
        const result = mayPress("senior-manager", action, status);
        if (result.allowed) continue;
        expect(result.reason, `${action} on ${status}`).not.toMatch(/Not from here/);
        expect(result.reason, `${action} on ${status}`).not.toMatch(/\ba3\b|\bhq\b/);
      }
    }
  });
});
