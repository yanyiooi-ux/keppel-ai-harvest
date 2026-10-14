/**
 * One function per button id in S2, called by POST /api/action.
 *
 * Every action runs the same gate first: the seat check and the status check
 * from permissions.ts, then the safety lock from S3. Only then does it touch
 * the memory. C4 writes the bodies for reset, safety-pick and confirm-cause;
 * C7a writes report and answer (the tenant's self-check, S10); the rest pass
 * their checks and say "not built yet", and C7b to C9 fill them.
 */

import { loadAndCheckPill } from "./pill";
import { safetyCardForStop, alertsForStop, alertNoticeText, locksForStop, safetyList, type SafetyCard } from "./safety";
import type { DraftTestRun } from "./draft-tests";
import { spotKey } from "./places";
import { callsForState, postSpeakFirst } from "./calls";
import { reportRefusal, startReport, planAnswer, applyAnswer } from "./self-check-flow";
import type { AiOutcome, TenantReply } from "./ai";
import { mayPress, alertSeatFor, SEAT_LABELS, type SeatId } from "./permissions";
import * as memory from "./memory";
import type { MemoryState, Job, OpenRedStop } from "./memory";

export { callsForState };

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
  /** The job a press made or landed on (report, answer). */
  jobId?: string;
}

/** What a press may carry besides the person's input: code-made, never from the request. */
export interface ActionExtras {
  /** The AI's tenant-reply, worded before the update (action-turn.ts). */
  tenantWording?: AiOutcome<TenantReply>;
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

  // Speak first goes to the senior manager's chat (S6), the same way the
  // self-check posts it.
  const state = memory.update((s) => {
    const openJobs = s.jobs.filter((j) => j.status === "reported");
    postSpeakFirst(s, openJobs, new Date(s.demoNow), s.demoNow);
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

  const buildingName = job ? job.buildingName : "Tower A";
  const card = safetyCardForStop(stop, version);

  // The same stop is already open on this spot: a second press opens no second
  // stop and sends no alert (S11). It stays open until Reset.
  const alreadyOpen = state.openRedStops.some(
    (s) =>
      s.clearedAt === null &&
      s.stopId === stopId &&
      s.source === source &&
      s.building === spot.building &&
      s.floor === spot.floor &&
      (stopId !== "RS-08" || s.zone === spot.zone)
  );
  if (alreadyOpen) {
    return {
      ok: true,
      message: `Red stop ${stopId} is already open here. No second alert.`,
      cards: [{ ...card, alerts: [] }],
    };
  }

  const openJobs = state.jobs.map((j) => ({
    id: j.id,
    building: j.building,
    floor: j.floor,
    zone: j.zone,
  }));
  const lockedJobIds = locksForStop(stopId, spot, openJobs, source);

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

  // Raise this stop after typed words sends no second alert (S11): it adds
  // "raised by {seat label}" to the alerts the typed words already sent. The
  // typed alert is found by its stop, so a change to the alert's words can
  // never bring the second alert back.
  const raisedBy = SEAT_LABELS[seat as SeatId] ?? seat;
  for (const alert of alerts) {
    const alertSeat = alertSeatFor(alert.seat, spot.building);
    const text = alertNoticeText(alert);
    const sent = state.notices.find(
      (n) =>
        n.kind === "alert" &&
        n.typed === true &&
        n.raisedBy === undefined &&
        n.seat === alertSeat &&
        n.stopId === alert.stopId &&
        (n.jobId ?? null) === (jobId ?? null)
    );
    if (sent) {
      sent.text = `${sent.text} · raised by ${raisedBy}`;
      sent.raisedBy = seat;
      continue;
    }
    state.notices.push({
      seat: alertSeat,
      kind: "alert",
      text,
      at: state.demoNow,
      jobId: jobId,
      stopId: alert.stopId,
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
 * A pick from the Safety list shows that stop's card in the pressing seat's
 * chat (S11): the pill's trigger, action and who to call, word for word, and
 * its receipt with AI calls 0. Call it inside memory.update.
 */
function storePickedCard(state: MemoryState, seat: string, result: ActionResult): void {
  const card = (result.cards ?? [])[0] as SafetyCard | undefined;
  if (!card) return;
  state.messages.push({
    seat,
    from: "pip",
    text: card.action,
    at: state.demoNow,
    cards: [
      {
        kind: "red-stop",
        stopId: card.id,
        title: card.trigger,
        body: card.action,
        call: card.whoToCall,
        receipt: card.receipt,
      },
    ],
  });
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

/** What send-to-hq reads from a stored solution: the draft's hash now and its stored test run. */
export interface StoredSolutionGate {
  hash?: string;
  testRun?: Partial<DraftTestRun>;
}

const NO_PASSING_RUN = "That draft has no passing test run on this exact draft yet.";

/**
 * send-to-hq needs a stored run with 0 failed whose hash equals the draft's
 * hash now (S16 item 7). The run is stored as runDraftTests returns it, where
 * `passed` and `failed` are counts, so a run that passed 21 cases and failed 1
 * is refused. A run in which nothing passed proves nothing and is refused too.
 * Returns the refusal, or null when the draft may go to HQ.
 */
export function sendToHqRefusal(solution: StoredSolutionGate | undefined): string | null {
  const run = solution?.testRun;
  const passing =
    run !== undefined &&
    typeof run.failed === "number" &&
    run.failed === 0 &&
    typeof run.passed === "number" &&
    run.passed > 0 &&
    typeof solution?.hash === "string" &&
    run.draftHash === solution.hash;
  return passing ? null : NO_PASSING_RUN;
}

/**
 * The gate every button goes through, then the body.
 * Nothing before a passed gate ever writes to the memory.
 */
export function runAction(input: ActionInput, realNow: Date = new Date(), extras: ActionExtras = {}): ActionResult {
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
      if (result.ok) storePickedCard(s, seat, result);
    });
    return result;
  }

  // The tenant's self-check (S10). A refusal is worked out on a read and never
  // writes; the press itself plans again inside the update.
  if (action === "report") {
    const refusal = reportRefusal(state, payload);
    if (refusal) return { ok: false, message: refusal };
    let result: ActionResult = { ok: false, message: "" };
    memory.update((s) => {
      result = startReport(s, seat, payload, memory.now(s, realNow));
    });
    return result;
  }

  if (action === "answer" && jobId) {
    const plan = planAnswer(state, jobId, payload);
    if (!plan.ok) return { ok: false, message: plan.message };
    let result: ActionResult = { ok: false, message: "" };
    memory.update((s) => {
      result = applyAnswer(s, seat, jobId, payload, memory.now(s, realNow), extras.tenantWording);
    });
    return result;
  }

  if (action === "send-to-hq") {
    const draft = (state.solutions as (StoredSolutionGate & { jobId?: string })[]).find(
      (s) => s.jobId === jobId
    );
    const refusal = sendToHqRefusal(draft);
    if (refusal) return { ok: false, message: refusal };
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
