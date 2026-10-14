/**
 * Who may press which button (S2).
 *
 * One table, checked on the server in /api/action, not only hidden on screen.
 * A refusal returns a plain reason that names who may, and changes nothing.
 */

import type { JobStatus } from "./memory";

export const SEAT_IDS = [
  "tenant",
  "technician",
  "senior-manager",
  "hq",
  "aom-tower-a",
] as const;

export type SeatId = (typeof SEAT_IDS)[number];

export const SEAT_LABELS: Record<SeatId, string> = {
  tenant: "Tenant, Northwind Advisory (role-played)",
  technician: "Technician (role-played)",
  "senior-manager": "Senior manager: the FM contractor's chief engineer (role-played)",
  hq: "HQ pill owner: Keppel Technical Services lead (role-played)",
  "aom-tower-a": "AOM, Tower A: Keppel Asset Operations Manager (role-played)",
};

/**
 * Each seat's "Pip never" line, so /how can show it.
 */
export const PIP_NEVER: Record<SeatId, string> = {
  tenant: "touch plant, ceilings, power or lifts",
  technician: "approve anything, or use a fix the rules removed",
  "senior-manager": "approve their own new solution",
  hq: "approve a solution whose tests did not pass on this exact draft",
  "aom-tower-a": "let the AI write a price, fault or another tenant's data",
};

/**
 * "any" means the action does not read a job status.
 * "other" means the gate is not a job status: actions.ts checks it
 * (a pending case, an open red stop, a request, a live version).
 */
type StatusGate = JobStatus[] | "any" | "other";

export interface ActionRule {
  /** Which seats may press it, and from which job status. */
  seats: Partial<Record<SeatId, StatusGate>>;
  /** What it does, for /how and for the refusal text. */
  does: string;
  /** Named in the refusal when the wrong seat presses it. */
  whoMay: string;
}

export const ACTION_RULES: Record<string, ActionRule> = {
  report: {
    seats: { tenant: "any" },
    does: "Starts a self-check",
    whoMay: "Only the tenant can report a problem",
  },
  answer: {
    seats: { tenant: ["self-check"] },
    does: "Answers one self-check question",
    whoMay: "Only the tenant answers the self-check",
  },
  "safety-pick": {
    seats: {
      tenant: "any",
      technician: "any",
      "senior-manager": "any",
      hq: "any",
      "aom-tower-a": "any",
    },
    does: "Raises one red stop",
    whoMay: "Every seat can raise a safety stop",
  },
  "open-job": {
    seats: { technician: ["reported", "visit-booked"] },
    does: "Job to in-progress",
    whoMay: "Only the technician opens a job",
  },
  tick: {
    seats: { technician: ["in-progress"], "senior-manager": ["escalated"] },
    does: "Marks a lead found, not-this or clear",
    whoMay: "Only the technician or the senior manager ticks a lead",
  },
  solved: {
    seats: { technician: ["in-progress"], "senior-manager": ["escalated"] },
    does: "Job to pending-30-day and saves a case",
    whoMay: "Only the technician or the senior manager marks a job solved",
  },
  "send-with-cause": {
    seats: { technician: ["in-progress"] },
    does: "Job to escalated with the cause",
    whoMay: "Only the technician sends a job on with the cause",
  },
  "not-solved": {
    seats: { technician: ["in-progress"] },
    does: "Needs the impact record; job to escalated",
    whoMay: "Only the technician marks a job not solved",
  },
  "log-new-solution": {
    seats: { "senior-manager": ["escalated"] },
    does: "Starts a new solution draft",
    whoMay: "Only the senior manager logs a new solution",
  },
  "confirm-part": {
    seats: { "senior-manager": ["new-solution-drafted"] },
    does: "Confirms the fact, an effect or the rule text",
    whoMay: "Only the senior manager confirms a part of the draft",
  },
  "run-tests": {
    seats: { "senior-manager": ["new-solution-drafted"] },
    does: "Runs the draft's tests",
    whoMay: "Only the senior manager runs the draft's tests",
  },
  "send-to-hq": {
    seats: { "senior-manager": ["new-solution-drafted"] },
    does: "Sends the draft to HQ",
    whoMay: "Only the senior manager sends a draft to HQ",
  },
  "ask-outside-help": {
    seats: { "senior-manager": ["escalated"] },
    does: "A3 request to HQ",
    whoMay: "Only the senior manager asks for outside help (A3)",
  },
  "confirm-cause": {
    seats: { technician: "other", "senior-manager": "other", hq: "other" },
    does: "Confirms a pending case's cause",
    whoMay: "Only a staff seat confirms a cause",
  },
  "clear-stop": {
    seats: { "senior-manager": "other" },
    does: "Clears an open red stop",
    whoMay: "Only the senior manager clears a safety stop",
  },
  "tell-tenant-first": {
    seats: { "senior-manager": "other" },
    does: "Sends the approved tip to the tenant chat",
    whoMay: "Only the senior manager speaks to the tenant first",
  },
  "approve-solution": {
    seats: { hq: "other" },
    does: "Approves a new solution and distributes it",
    whoMay: "Only HQ approves a new solution (A2)",
  },
  "decline-solution": {
    seats: { hq: "other" },
    does: "Declines a new solution with a reason",
    whoMay: "Only HQ declines a new solution (A2)",
  },
  rollback: {
    seats: { hq: "other" },
    does: "Rolls a building back to an earlier version",
    whoMay: "Only HQ rolls a version back",
  },
  "decide-outside-help": {
    seats: { hq: "other" },
    does: "Approves or declines outside help",
    whoMay: "Only HQ decides outside help or money (A3)",
  },
  "decide-charge": {
    seats: { "aom-tower-a": "other" },
    does: "Decides whether the tenant is charged",
    whoMay: "Only the AOM decides a charge (A4)",
  },
  reset: {
    seats: {
      tenant: "any",
      technician: "any",
      "senior-manager": "any",
      hq: "any",
      "aom-tower-a": "any",
    },
    does: "Puts the demo back to the start",
    whoMay: "Every seat can reset the demo",
  },
};

/**
 * safety.ts names the AOM generically, because a red stop does not know which
 * building it is in. S11 sends the alert to that building's AOM chat, and only
 * Tower A has an AOM seat: Building B's alerts belong on its card (S21).
 */
export function alertSeatFor(genericSeat: string, building: string): string {
  if (genericSeat !== "aom") return genericSeat;
  return building === "tower-a" ? "aom-tower-a" : "building-b-card";
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
}

/** Where a job went after the technician's part, for a refused press on it (S3). */
const MOVED_ON: Partial<Record<JobStatus, string>> = {
  escalated: "That job is escalated: it is with the senior manager now.",
  "new-solution-drafted": "That job is escalated: the senior manager is drafting a new solution for it.",
  "outside-help-requested": "That job is escalated: it waits for HQ's decision on outside help (A3).",
  "approved-and-distributed": "That job is solved: its new solution is live and it waits for its 30-day check.",
  "pending-30-day": "That job is solved: it waits for its 30-day check.",
  won: "That job is closed: it passed its 30-day check.",
  failed: "That job is closed: the spot called again within 30 days.",
};

/**
 * Where a job is, for a refused senior manager press on it (C8a): the presses
 * that need escalated or new-solution-drafted say why in plain words (S3).
 */
const NOT_UP_YET = "That job has not come up to the senior manager yet.";
const SENIOR_MANAGER_WHERE: Partial<Record<JobStatus, string>> = {
  reported: NOT_UP_YET,
  "visit-booked": NOT_UP_YET,
  "in-progress": NOT_UP_YET,
  escalated: "That job has no new solution drafted yet: log a new solution first.",
  "new-solution-drafted": "That job has a new solution drafted: it waits for its tests and HQ's decision (A2).",
  "outside-help-requested": "That job waits for HQ's decision on outside help (A3).",
  "approved-and-distributed": MOVED_ON["approved-and-distributed"],
  "pending-30-day": MOVED_ON["pending-30-day"],
  won: MOVED_ON.won,
  failed: MOVED_ON.failed,
};

/**
 * The seat check and, where the gate is a job status, the status check.
 * Gates that are not a job status ("other") are checked in actions.ts.
 */
export function mayPress(
  seat: string,
  actionId: string,
  jobStatus?: JobStatus
): PermissionResult {
  const rule = ACTION_RULES[actionId];
  if (!rule) {
    return { allowed: false, reason: `There is no button called "${actionId}".` };
  }

  const gate = rule.seats[seat as SeatId];
  if (gate === undefined) {
    return { allowed: false, reason: `${rule.whoMay}.` };
  }

  if (gate === "any" || gate === "other") {
    return { allowed: true };
  }

  if (jobStatus === undefined) {
    return { allowed: false, reason: "Pick a job first." };
  }

  if (!gate.includes(jobStatus)) {
    // A job in the self-check is not reported yet (S10), so it is neither open
    // nor waiting to be opened.
    if (jobStatus === "self-check") {
      return { allowed: false, reason: "That job is still in the tenant's self-check." };
    }
    // The technician's presses (open-job, and those that need in-progress) on
    // a job that has moved on say where it went (S3: a refused move says why).
    if (actionId === "open-job" || gate.includes("in-progress")) {
      if (actionId === "open-job" && jobStatus === "in-progress") {
        return { allowed: false, reason: "That job is already open." };
      }
      if (actionId !== "open-job" && (jobStatus === "reported" || jobStatus === "visit-booked")) {
        return { allowed: false, reason: "Open the job first." };
      }
      const movedOn = MOVED_ON[jobStatus];
      if (movedOn) return { allowed: false, reason: movedOn };
    }
    if (seat === "senior-manager") {
      const where = SENIOR_MANAGER_WHERE[jobStatus];
      if (where) return { allowed: false, reason: where };
    }
    return {
      allowed: false,
      reason: `Not from here: this job is ${jobStatus}, and ${rule.does.toLowerCase()} needs ${gate.join(" or ")}.`,
    };
  }

  return { allowed: true };
}
