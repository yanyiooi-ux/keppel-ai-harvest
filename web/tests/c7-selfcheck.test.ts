/**
 * C7 selfcheck (run rule 3f): T-C7a and T-C7b bullets that had no test of their
 * own once the technician's desk existed.
 *
 * T-C7a "no job for the technician" was proven in C7a by the open-job gate
 * alone; C7b added the technician's job list, so the list itself must not offer
 * a job that ended with a tip.
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as memory from "../lib/memory";
import { resetDemo, runAction } from "../lib/actions";
import { seatView } from "../lib/seat-view";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");

beforeEach(() => {
  resetDemo(REAL_NOW);
});

function press(seat: string, action: string, jobId?: string, payload?: Record<string, unknown>) {
  return runAction({ seat, action, jobId, payload }, REAL_NOW);
}

function selfCheck(complaint: string, answers: [string, string][]) {
  const report = press("tenant", "report", undefined, { complaint });
  let last = report;
  for (const [questionId, answer] of answers) {
    last = press("tenant", "answer", report.jobId, { questionId, answer });
    expect(last.ok, last.message).toBe(true);
  }
  return last;
}

function jobList() {
  return seatView(memory.read(), "technician", undefined, REAL_NOW).desk!.jobs;
}

describe("T-C7a: hot, west boardroom, blinds up leaves no job for the technician", () => {
  it("the technician's job list does not show the job a tip closed", () => {
    const landed = selfCheck("too hot", [
      ["Q0", "No"],
      ["Q1", "West glass boardroom"],
      ["Q2", "This week"],
      ["Q3", "No"],
      ["Q4-blinds", "No, they are up"],
    ]);
    expect(landed.jobId).toBe("2319");
    expect(memory.jobById(memory.read(), "2319")!.status).toBe("pending-30-day");
    expect(jobList().map((j) => j.id)).toEqual(["2318"]);
  });

  it("a booked visit is on the list, with Open job", () => {
    selfCheck("too hot", [
      ["Q0", "No"],
      ["Q1", "West glass boardroom"],
      ["Q2", "This week"],
      ["Q3", "No"],
      ["Q4-blinds", "Yes"],
    ]);
    const visit = jobList().find((j) => j.id === "2319");
    expect(visit).toBeDefined();
    expect(visit!.status).toBe("visit-booked");
    expect(visit!.canOpen).toBe(true);
  });

  it("the job the technician opened stays on the list after it moves on, marked as theirs", () => {
    press("technician", "open-job", "2318");
    press("technician", "not-solved", "2318", { hoursLost: 1, extraVisits: 0, contractorOrPartsNeeded: false });
    const row = jobList().find((j) => j.id === "2318");
    expect(row).toBeDefined();
    expect(row!.status).toBe("escalated");
    expect(row!.isOpen).toBe(true);
    expect(row!.canOpen).toBe(false);
  });
});
