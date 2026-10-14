/**
 * One function per button id in S2, called by POST /api/action.
 *
 * Every action runs the same gate first: the seat check and the status check
 * from permissions.ts, then the safety lock from S3. Only then does it touch
 * the memory. C4 writes the bodies for reset, safety-pick and confirm-cause;
 * C7a writes report and answer (the tenant's self-check, S10); C7b writes the
 * technician's open-job, tick, solved, send-with-cause and not-solved
 * (technician-flow.ts); C8a writes the senior manager's log-new-solution,
 * confirm-part, run-tests, send-to-hq, ask-outside-help and clear-stop
 * (senior-manager-flow.ts); C8b writes HQ's approve-solution,
 * decline-solution, rollback and decide-outside-help (hq-flow.ts); C9 writes
 * the AOM's decide-charge (charge-flow.ts). tell-tenant-first is cut 2: it
 * passes its checks and says "not built yet".
 */

import { loadAndCheckPill } from "./pill";
import { safetyCardForStop, alertsForStop, alertNoticeText, locksForStop, safetyList, type SafetyCard } from "./safety";
import type { DraftTestRun } from "./draft-tests";
import { spotKey } from "./places";
import { callsForState, postSpeakFirst, runtimeCaseOutcome } from "./calls";
import { reportRefusal, startReport, planAnswer, applyAnswer, sgStamp } from "./self-check-flow";
import type { AiOutcome, TenantReply } from "./ai";
import { mayPress, alertSeatFor, SEAT_LABELS, type SeatId } from "./permissions";
import {
  applyOpenJob,
  applyTick,
  applySolved,
  applySendWithCause,
  applyNotSolved,
  tickRefusal,
  solvedRefusal,
  sendWithCauseRefusal,
  notSolvedRefusal,
  postLowConfidenceNotice,
} from "./technician-flow";
import {
  currentSolution,
  logNewSolutionRefusal,
  applyLogNewSolution,
  confirmPartRefusal,
  applyConfirmPart,
  planRunTests,
  runTestsRefusal,
  applyRunTests,
  sentRefusal,
  applySendToHq,
  askOutsideHelpRefusal,
  applyAskOutsideHelp,
  clearStopRefusal,
  applyClearStop,
} from "./senior-manager-flow";
import {
  approveRefusal,
  applyApprove,
  declineRefusal,
  applyDecline,
  rollbackRefusal,
  applyRollback,
  decideOutsideHelpRefusal,
  applyDecideOutsideHelp,
} from "./hq-flow";
import { decideChargeRefusal, applyDecideCharge } from "./charge-flow";
import type { NewSolution } from "./ai";
import * as memory from "./memory";
import type { MemoryState, Job, OpenRedStop } from "./memory";

export { callsForState };

/** The low-confidence notice (S9) lives with the presses that raise it (technician-flow.ts). */
export { postLowConfidenceNotice };

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
  /** A pick of a stop already open there: no second stop and no alert (S11). */
  alreadyOpen?: boolean;
  /** The pressing seat's chat already holds that open stop's card, so the pick shows nothing new. */
  alreadyShown?: boolean;
}

/** What a press may carry besides the person's input: code-made, never from the request. */
export interface ActionExtras {
  /** The AI's tenant-reply, worded before the update (action-turn.ts). */
  tenantWording?: AiOutcome<TenantReply>;
  /** The AI's new-solution draft and suggestion, made before the update (action-turn.ts, C8a). */
  solutionWording?: AiOutcome<NewSolution>;
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
 * and the stop locks the jobs that locksForStop names. `at` is the demo
 * clock's time now (S20); runAction passes it.
 */
export function safetyPick(
  state: MemoryState,
  seat: string,
  stopId: string,
  jobId: string | undefined,
  source: "button" | "trend",
  at: string = state.demoNow
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
  // stop and sends no alert (S11). It stays open until Reset. Picking it still
  // shows its card in a seat that has not seen it yet (S11: "Picking one shows
  // that stop's card"); the same seat's second press shows nothing new.
  const open = state.openRedStops.find(
    (s) =>
      s.clearedAt === null &&
      s.stopId === stopId &&
      s.source === source &&
      s.building === spot.building &&
      s.floor === spot.floor &&
      (stopId !== "RS-08" || s.zone === spot.zone)
  );
  if (open) {
    return {
      ok: true,
      message: `Red stop ${stopId} is already open here. No second alert.`,
      cards: [{ ...card, alerts: [] }],
      alreadyOpen: true,
      alreadyShown: seatShowsPickedCard(state, seat, stopId, open.openedAt),
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
    openedAt: at,
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
      at,
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
 * True when the seat's chat already holds the picked card of a stop opened at
 * `since`: a card from a pick, not a typed-words card (that one carries Raise
 * this stop). A card from before the stop opened is for an earlier stop.
 */
function seatShowsPickedCard(state: MemoryState, seat: string, stopId: string, since: string): boolean {
  const from = new Date(since).getTime();
  return state.messages.some(
    (m) =>
      m.seat === seat &&
      m.from === "pip" &&
      new Date(m.at).getTime() >= from &&
      ((m.cards ?? []) as { kind?: string; stopId?: string; raiseStopId?: string }[]).some(
        (c) => c.kind === "red-stop" && c.stopId === stopId && c.raiseStopId === undefined
      )
  );
}

/**
 * A pick from the Safety list shows that stop's card in the pressing seat's
 * chat (S11): the pill's trigger, action and who to call, word for word, and
 * its receipt with AI calls 0. Call it inside memory.update, with the demo
 * clock's time now (S20).
 */
function storePickedCard(state: MemoryState, seat: string, result: ActionResult, at: string): void {
  const card = (result.cards ?? [])[0] as SafetyCard | undefined;
  if (!card) return;
  state.messages.push({
    seat,
    from: "pip",
    text: card.action,
    at,
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

export const NOT_PENDING =
  "Confirm cause is only for a pending case: the spot called again within 30 days, so this fix failed.";

/**
 * Confirm a pending case's cause. Refused for the seat that fixed it,
 * because a cause needs a second person (S8), and for a case that is not
 * pending (S2): checked here on the server, at the demo clock's now, with the
 * same outcome the senior manager's list reads, not only hidden on screen.
 */
export function confirmCause(
  state: MemoryState,
  seat: string,
  caseId: string,
  realNow: Date = new Date()
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
  if (runtimeCaseOutcome(state, runtimeCase, memory.now(state, realNow)) === "failed") {
    return { ok: false, message: NOT_PENDING };
  }
  runtimeCase.confirmedBy = seat;
  return { ok: true, message: `Cause confirmed by ${seat}.` };
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
      const at = sgStamp(memory.now(s, realNow));
      result = safetyPick(s, seat, stopId, jobId, source, at);
      // A stop already open there shows its card once in each seat's chat:
      // the same seat's second press shows nothing new (S11).
      if (result.ok && !result.alreadyShown) storePickedCard(s, seat, result, at);
    });
    return result;
  }

  // The technician's presses (C7b, technician-flow.ts). Each refusal is worked
  // out on a read and never writes; the press plans again inside the update.
  if (job && TECHNICIAN_PRESSES.includes(action)) {
    const refusal = technicianRefusal(state, seat, action, job, payload, realNow);
    if (refusal) return { ok: false, message: refusal };
    let result: ActionResult = { ok: false, message: "" };
    memory.update((s) => {
      result = applyTechnicianPress(s, seat, action, job.id, payload, realNow);
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

  // The senior manager's presses (C8a, senior-manager-flow.ts). Each refusal is
  // worked out on a read and never writes; the press plans again inside the update.
  if (job && action === "log-new-solution") {
    const refusal = logNewSolutionRefusal(state, seat, job, payload, realNow);
    if (refusal) return { ok: false, message: refusal };
    let result: ActionResult = { ok: false, message: "" };
    memory.update((s) => {
      result = applyLogNewSolution(s, seat, job.id, payload, realNow, extras.solutionWording);
    });
    return result;
  }

  if (job && action === "confirm-part") {
    const refusal = confirmPartRefusal(state, job, payload);
    if (refusal) return { ok: false, message: refusal };
    let result: ActionResult = { ok: false, message: "" };
    memory.update((s) => {
      result = applyConfirmPart(s, seat, job.id, payload, realNow);
    });
    return result;
  }

  if (job && action === "run-tests") {
    const refusal = runTestsRefusal(state, job);
    if (refusal) return { ok: false, message: refusal };
    // The run is pure code on a read; the update only stores it if the draft is unchanged.
    const plan = planRunTests(state, job, realNow);
    if (!plan.ok) return { ok: false, message: plan.message };
    let result: ActionResult = { ok: false, message: "" };
    memory.update((s) => {
      result = applyRunTests(s, seat, job.id, plan.run, realNow);
    });
    return result;
  }

  if (action === "send-to-hq") {
    const sent = sentRefusal(state, jobId);
    if (sent) return { ok: false, message: sent };
    const refusal = sendToHqRefusal(currentSolution(state, jobId));
    if (refusal) return { ok: false, message: refusal };
    if (job) {
      let result: ActionResult = { ok: false, message: "" };
      memory.update((s) => {
        // Plan again on the memory the update reads: the run must still be on this exact draft.
        const again = sentRefusal(s, job.id) ?? sendToHqRefusal(currentSolution(s, job.id));
        result = again ? { ok: false, message: again } : applySendToHq(s, seat, job.id, realNow);
      });
      return result;
    }
  }

  if (job && action === "ask-outside-help") {
    const refusal = askOutsideHelpRefusal(payload);
    if (refusal) return { ok: false, message: refusal };
    let result: ActionResult = { ok: false, message: "" };
    memory.update((s) => {
      result = applyAskOutsideHelp(s, seat, job.id, payload, realNow);
    });
    return result;
  }

  if (action === "clear-stop") {
    const refusal = clearStopRefusal(state, payload);
    if (refusal) return { ok: false, message: refusal };
    let result: ActionResult = { ok: false, message: "" };
    memory.update((s) => {
      result = applyClearStop(s, seat, payload, realNow);
    });
    return result;
  }

  // HQ's presses (C8b, hq-flow.ts): A2 approve or decline, rollback, A3. The
  // gate above has checked the seat. Each refusal is worked out on a read and
  // never writes; the press plans again inside the update. Approve is not one
  // of the presses a safety stop locks (S3): the stop stays open (T-C8b).
  if (HQ_JOB_PRESSES.includes(action)) {
    if (!job) return { ok: false, message: "Pick a job first." };
    const refusal = hqRefusal(state, action, job, payload);
    if (refusal) return { ok: false, message: refusal };
    let result: ActionResult = { ok: false, message: "" };
    memory.update((s) => {
      result = applyHqPress(s, seat, action, job.id, payload, realNow);
    });
    return result;
  }

  if (action === "rollback") {
    const refusal = rollbackRefusal(state, payload);
    if (refusal) return { ok: false, message: refusal };
    let result: ActionResult = { ok: false, message: "" };
    memory.update((s) => {
      result = applyRollback(s, seat, payload, realNow);
    });
    return result;
  }

  if (action === "confirm-cause") {
    const caseId = String(payload?.caseId ?? "");
    let result: ActionResult = { ok: false, message: "" };
    memory.update((s) => {
      result = confirmCause(s, seat, caseId, realNow);
    });
    return result;
  }

  // The AOM's charge decision (C9, charge-flow.ts, S17 A4). The gate above has
  // checked the seat. No AI call: code posts the tenant's card.
  if (action === "decide-charge") {
    const refusal = decideChargeRefusal(state, jobId, payload);
    if (refusal) return { ok: false, message: refusal };
    let result: ActionResult = { ok: false, message: "" };
    memory.update((s) => {
      result = applyDecideCharge(s, seat, jobId, payload, realNow);
    });
    return result;
  }

  return {
    ok: true,
    message: `"${action}" passed its checks. Not built yet.`,
    notBuiltYet: true,
  };
}

/** The presses technician-flow.ts builds (C7b). The gate above has checked the seat, status and lock. */
const TECHNICIAN_PRESSES = ["open-job", "tick", "solved", "send-with-cause", "not-solved"];

function technicianRefusal(
  state: MemoryState,
  seat: string,
  action: string,
  job: Job,
  payload: Record<string, unknown> | undefined,
  realNow: Date
): string | null {
  if (action === "tick") return tickRefusal(state, seat, job, payload, realNow);
  if (action === "solved") return solvedRefusal(state, seat, job, payload, realNow);
  if (action === "send-with-cause") return sendWithCauseRefusal(state, seat, job, realNow);
  if (action === "not-solved") return notSolvedRefusal(payload);
  return null;
}

function applyTechnicianPress(
  state: MemoryState,
  seat: string,
  action: string,
  jobId: string,
  payload: Record<string, unknown> | undefined,
  realNow: Date
): ActionResult {
  if (action === "open-job") return applyOpenJob(state, seat, jobId, realNow);
  if (action === "tick") return applyTick(state, seat, jobId, payload, realNow);
  if (action === "solved") return applySolved(state, seat, jobId, payload, realNow);
  if (action === "send-with-cause") return applySendWithCause(state, seat, jobId, realNow);
  return applyNotSolved(state, seat, jobId, payload, realNow);
}

/** HQ's presses on a job (C8b). Roll back names a version, not a job. */
const HQ_JOB_PRESSES = ["approve-solution", "decline-solution", "decide-outside-help"];

function hqRefusal(
  state: MemoryState,
  action: string,
  job: Job,
  payload: Record<string, unknown> | undefined
): string | null {
  if (action === "approve-solution") return approveRefusal(state, job);
  if (action === "decline-solution") return declineRefusal(state, job, payload);
  return decideOutsideHelpRefusal(state, job, payload);
}

function applyHqPress(
  state: MemoryState,
  seat: string,
  action: string,
  jobId: string,
  payload: Record<string, unknown> | undefined,
  realNow: Date
): ActionResult {
  if (action === "approve-solution") return applyApprove(state, seat, jobId, realNow);
  if (action === "decline-solution") return applyDecline(state, seat, jobId, payload, realNow);
  return applyDecideOutsideHelp(state, seat, jobId, payload, realNow);
}

/** The spot key of a job, for the screens. */
export function jobSpotKey(job: Job): string {
  return spotKey(job);
}
