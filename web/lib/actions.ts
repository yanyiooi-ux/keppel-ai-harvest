/**
 * One function per button id in S2, called by POST /api/action.
 *
 * Every action runs the same gate first: the seat check and the status check
 * from permissions.ts, then the safety lock from S3. Only then does it touch
 * the memory. C4 writes the bodies for reset, safety-pick and confirm-cause;
 * the rest pass their checks and say "not built yet", and C7a to C9 fill them.
 */

import { readFileSync } from "fs";
import { join } from "path";
import type { Ticket } from "./rule-engine";
import { loadAndCheckPill } from "./pill";
import { safetyCardForStop, alertsForStop, locksForStop, safetyList } from "./safety";
import { allCalls, spotKey } from "./places";
import { speakFirstNotices } from "./speak-first";
import { mayPress, alertSeatFor } from "./permissions";
import * as memory from "./memory";
import type { MemoryState, Job, OpenRedStop } from "./memory";

/** Buttons that a safety stop on the job's spot locks (S3). */
const LOCKED_BY_SAFETY = [
  "tick",
  "solved",
  "not-solved",
  "send-with-cause",
  "log-new-solution",
];

export interface ActionInput {
  seat: string;
  action: string;
  jobId?: string;
  payload?: Record<string, unknown>;
}

export interface ActionResult {
  ok: boolean;
  message: string;
  cards?: unknown[];
  notBuiltYet?: boolean;
}

/**
 * Every ticket in tickets.json plus the jobs created at runtime.
 * The seed jobs are already in tickets.json, so they are not counted twice.
 */
export function callsForState(state: MemoryState): Ticket[] {
  const fileIds = new Set(
    (JSON.parse(
      readFileSync(join(process.cwd(), "data", "tickets.json"), "utf-8")
    ) as Ticket[]).map((t) => t.id)
  );
  const runtimeOnly = state.jobs.filter((j) => !fileIds.has(j.id)) as Ticket[];
  return allCalls({ tickets: runtimeOnly });
}

/** The stops open on a job's spot right now. */
export function openStopsOnJob(state: MemoryState, job: Job): OpenRedStop[] {
  return state.openRedStops.filter(
    (s) => s.clearedAt === null && s.lockedJobIds.includes(job.id)
  );
}

/**
 * Reset (S20): seed back, runtime cleared, then speak first runs.
 */
export function resetDemo(realNow: Date = new Date()): ActionResult {
  memory.resetToSeed(realNow);

  const state = memory.update((s) => {
    const calls = callsForState(s);
    const openJobs = s.jobs.filter((j) => j.status === "reported");
    const posted = speakFirstNotices(
      openJobs as Ticket[],
      calls,
      s.speakFirstNotices,
      new Date(s.demoNow)
    );
    for (const notice of posted) {
      s.speakFirstNotices.push({ spotKey: notice.spotKey, postedAt: s.demoNow });
      s.notices.push({
        seat: "technician",
        kind: "speak-first",
        text: notice.text,
        at: s.demoNow,
        jobId: notice.job.id,
        spotKey: notice.spotKey,
      });
    }
  });

  return {
    ok: true,
    message: `Demo reset. ${state.notices.length} speak-first notice${
      state.notices.length === 1 ? "" : "s"
    }.`,
  };
}

/**
 * Raise one red stop (S11): the card and its alerts go into the memory,
 * and the stop locks the jobs that locksForStop names.
 */
export function safetyPick(
  state: MemoryState,
  seat: string,
  stopId: string,
  jobId: string | undefined,
  source: "button" | "trend"
): ActionResult {
  const job = jobId ? memory.jobById(state, jobId) : undefined;
  const spot = job
    ? { building: job.building, floor: job.floor, zone: job.zone }
    : { building: "tower-a", floor: 23, zone: "core" };

  const version = state.liveVersionByBuilding[spot.building] ?? "1.0";
  const pill = loadAndCheckPill("ts-cc", version);
  const stop = safetyList(pill).find((s) => s.id === stopId);
  if (!stop) {
    return { ok: false, message: `There is no red stop called "${stopId}".` };
  }

  const openJobs = state.jobs.map((j) => ({
    id: j.id,
    building: j.building,
    floor: j.floor,
    zone: j.zone,
  }));
  const lockedJobIds = locksForStop(stopId, spot, openJobs, source);

  const buildingName = job ? job.buildingName : "Tower A";
  const card = safetyCardForStop(stop, version);
  const alerts = alertsForStop(stop, buildingName, spot.floor);

  state.openRedStops.push({
    stopId,
    building: spot.building,
    floor: spot.floor,
    zone: spot.zone,
    jobId: jobId ?? null,
    source,
    openedBySeat: seat,
    openedAt: state.demoNow,
    clearedBySeat: null,
    clearedAt: null,
    clearedReason: null,
    lockedJobIds,
  });

  for (const alert of alerts) {
    state.notices.push({
      seat: alertSeatFor(alert.seat, spot.building),
      kind: "alert",
      text: `${alert.title}: ${alert.action}`,
      at: state.demoNow,
      jobId: jobId,
    });
  }

  return {
    ok: true,
    message: `Red stop ${stopId} raised. ${lockedJobIds.length} job${
      lockedJobIds.length === 1 ? "" : "s"
    } locked.`,
    cards: [{ ...card, alerts }],
  };
}

/**
 * Confirm a pending case's cause. Refused for the seat that fixed it,
 * because a cause needs a second person (S8).
 */
export function confirmCause(
  state: MemoryState,
  seat: string,
  caseId: string
): ActionResult {
  const runtimeCase = state.runtimeCases.find((c) => c.id === caseId);
  if (!runtimeCase) {
    return { ok: false, message: `There is no case called "${caseId}".` };
  }
  if (runtimeCase.fixedBy === seat) {
    return {
      ok: false,
      message: "A cause needs a second person: the seat that fixed it cannot confirm it.",
    };
  }
  if (runtimeCase.confirmedBy) {
    return { ok: false, message: "That cause is already confirmed." };
  }
  runtimeCase.confirmedBy = seat;
  return { ok: true, message: `Cause confirmed by ${seat}.` };
}

/**
 * The low-confidence notice (S9) reaches the senior manager once per job.
 */
export function postLowConfidenceNotice(
  state: MemoryState,
  jobId: string,
  text: string
): boolean {
  if (state.lowConfidenceJobIds.includes(jobId)) return false;
  state.lowConfidenceJobIds.push(jobId);
  state.notices.push({
    seat: "senior-manager",
    kind: "low-confidence",
    text,
    at: state.demoNow,
    jobId,
  });
  return true;
}

/**
 * The gate every button goes through, then the body.
 * Nothing before a passed gate ever writes to the memory.
 */
export function runAction(input: ActionInput, realNow: Date = new Date()): ActionResult {
  const { seat, action, jobId, payload } = input;

  if (action === "reset") {
    const gate = mayPress(seat, action);
    if (!gate.allowed) return { ok: false, message: gate.reason! };
    return resetDemo(realNow);
  }

  const state = memory.read();
  const job = jobId ? memory.jobById(state, jobId) : undefined;

  if (jobId && !job) {
    return { ok: false, message: `There is no job called "${jobId}".` };
  }

  const gate = mayPress(seat, action, job?.status);
  if (!gate.allowed) return { ok: false, message: gate.reason! };

  if (job && LOCKED_BY_SAFETY.includes(action) && openStopsOnJob(state, job).length > 0) {
    return { ok: false, message: "Safety stop open on this floor." };
  }

  if (action === "safety-pick") {
    const stopId = String(payload?.stopId ?? "");
    const source = payload?.source === "trend" ? "trend" : "button";
    let result: ActionResult = { ok: false, message: "" };
    memory.update((s) => {
      result = safetyPick(s, seat, stopId, jobId, source);
    });
    return result;
  }

  if (action === "send-to-hq") {
    const draft = (state.solutions as { jobId?: string; testRun?: { passed?: boolean; draftHash?: string }; hash?: string }[]).find(
      (s) => s.jobId === jobId
    );
    if (!draft || !draft.testRun?.passed || draft.testRun.draftHash !== draft.hash) {
      return {
        ok: false,
        message: "That draft has no passing test run on this exact draft yet.",
      };
    }
  }

  if (action === "confirm-cause") {
    const caseId = String(payload?.caseId ?? "");
    let result: ActionResult = { ok: false, message: "" };
    memory.update((s) => {
      result = confirmCause(s, seat, caseId);
    });
    return result;
  }

  return {
    ok: true,
    message: `"${action}" passed its checks. Not built yet.`,
    notBuiltYet: true,
  };
}

/** The spot key of a job, for the screens. */
export function jobSpotKey(job: Job): string {
  return spotKey(job);
}
