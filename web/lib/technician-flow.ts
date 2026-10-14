/**
 * The technician's presses on the shared memory (S2, S3, S9, C7b): open-job,
 * tick, solved, send-with-cause and not-solved, plus the low-confidence notice.
 *
 * runAction's gate has already checked the seat, the status and the safety
 * lock. Each `...Refusal` reads the memory and never writes; each `apply...` is
 * called inside memory.update and plans again on the memory it is given, so a
 * press that raced another one is refused rather than applied on stale facts.
 *
 * Code decides everything here: which lead may be ticked, whose fix it is, the
 * status, the case and the cost. The technician approves nothing, and a fix
 * already in the brain needs no approval (S1, S2). Plain code, 0 AI.
 */

import { leadsForJob, factsForJob } from "./leads";
import { loadCauses } from "./causes";
import { placeTag } from "./places";
import { mayPress, SEAT_LABELS, type SeatId } from "./permissions";
import { SELF_CHECK_QUESTIONS } from "./self-check";
import { hideAmounts } from "./never-list";
import { sgStamp } from "./self-check-flow";
import { checkImpactRecord, impactCost, impactLine, costLine, loadImpactRates } from "./impact-rates";
import type { Lead } from "./rank";
import * as memory from "./memory";
import type { MemoryState, Job, RuntimeCase } from "./memory";

export interface FlowResult {
  ok: boolean;
  message: string;
  jobId?: string;
}

const TICK_TYPES = ["found", "not-this", "clear"] as const;
type TickType = (typeof TICK_TYPES)[number];

/** The symptom facts (S5): a case keeps the one its job has. HQ's approval saves a case the same way (C8b). */
export const SYMPTOM_FACTS = ["cold-mornings", "hot-afternoons", "cold-other", "hot-other"];

const SG_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A date as S8 writes it, in Singapore time: "5 Nov". */
export function dayMonth(at: Date | string): string {
  const sg = new Date(new Date(at).getTime() + SG_OFFSET_MS);
  return `${sg.getUTCDate()} ${MONTHS[sg.getUTCMonth()]}`;
}

/** The last day of a case's 30-day check, as S8 writes it. */
export function thirtyDayEnd(closedAt: string): string {
  return dayMonth(new Date(new Date(closedAt).getTime() + 30 * DAY_MS));
}

export function seatLabel(seat: string | undefined): string {
  return seat ? SEAT_LABELS[seat as SeatId] ?? seat : "";
}

function causeLabel(causeId: string): string {
  return loadCauses().causes.find((c) => c.id === causeId)?.label ?? causeId;
}

/** The tenant's self-check answers in question order, as "question answer" (S10). */
export function selfCheckLines(job: Job): string[] {
  return SELF_CHECK_QUESTIONS.filter((q) => job.selfCheckAnswers[q.id] !== undefined).map(
    (q) => `${q.text} ${job.selfCheckAnswers[q.id]}`
  );
}

// ---- The low-confidence notice (S9) ----

/** S9's notice, word for word. */
export function lowConfidenceText(jobId: string): string {
  return `Low confidence on job ${jobId}: the top cause has fewer than 3 similar cases. Please take a look.`;
}

/**
 * The low-confidence notice (S9) reaches the senior manager once per job.
 * `at` is the demo clock's time now (S20); old callers keep the old default.
 */
export function postLowConfidenceNotice(
  state: MemoryState,
  jobId: string,
  text: string,
  at: string = state.demoNow
): boolean {
  if (state.lowConfidenceJobIds.includes(jobId)) return false;
  state.lowConfidenceJobIds.push(jobId);
  state.notices.push({
    seat: "senior-manager",
    kind: "low-confidence",
    text,
    at,
    jobId,
  });
  return true;
}

/** After a press that can change the ranking: when S9 says alert, the senior manager hears it once. */
function alertIfLowConfidence(state: MemoryState, job: Job, seat: string, realNow: Date, at: string): void {
  // The notice is for the senior manager; their own ticks do not alert themselves.
  if (seat === "senior-manager") return;
  if (leadsForJob(state, job, seat, realNow).alertSeniorManager) {
    postLowConfidenceNotice(state, job.id, lowConfidenceText(job.id), at);
  }
}

function stampNow(state: MemoryState, realNow: Date): string {
  return sgStamp(memory.now(state, realNow));
}

function pipCard(state: MemoryState, seat: string, job: Job, title: string, body: string, at: string): void {
  const version = state.liveVersionByBuilding[job.building] ?? "1.0";
  state.messages.push({
    seat,
    from: "pip",
    text: `${title}: ${body}`,
    at,
    cards: [{ kind: "answer", title, body, jobId: job.id, receipt: `pill v${version} · AI calls: 0` }],
  });
}

// ---- open-job ----

/**
 * Open job (S2): reported or visit-booked to in-progress. The job becomes the
 * seat's open job, which is also the technician's home spot (S2).
 */
export function applyOpenJob(state: MemoryState, seat: string, jobId: string, realNow: Date): FlowResult {
  const job = memory.jobById(state, jobId);
  if (!job) return { ok: false, message: `There is no job called "${jobId}".` };
  const gate = mayPress(seat, "open-job", job.status);
  if (!gate.allowed) return { ok: false, message: gate.reason! };

  job.status = "in-progress";
  state.openJobBySeat = { ...(state.openJobBySeat ?? {}), [seat]: job.id };
  alertIfLowConfidence(state, job, seat, realNow, stampNow(state, realNow));
  return { ok: true, message: `Job ${job.id} is open.`, jobId: job.id };
}

// ---- tick ----

/** Why a tick is refused, or null. A lead the rules removed is never ticked (S2's "Pip never" line). */
export function tickRefusal(
  state: MemoryState,
  seat: string,
  job: Job,
  payload: Record<string, unknown> | undefined,
  realNow: Date
): string | null {
  const type = payload?.type;
  if (!TICK_TYPES.includes(type as TickType)) return 'A tick is "found", "not-this" or "clear".';
  const causeId = String(payload?.causeId ?? "");
  const rank = leadsForJob(state, job, seat, realNow);
  const removed = rank.removed.find((r) => r.causeId === causeId);
  if (removed) return `That lead was removed, so it cannot be ticked. ${removed.reason}`;
  const known = [...rank.leads, ...rank.ruledOut].some((l) => l.causeId === causeId);
  if (!known) return `There is no lead called "${causeId}" on job ${job.id}.`;
  return null;
}

/**
 * Found it, Not this or clear (S9): one tick per lead, one found lead per job,
 * and clear undoes a tick. The ranking reads the ticks, so the next read of the
 * view (the press reloads it at once) shows the new order.
 */
export function applyTick(
  state: MemoryState,
  seat: string,
  jobId: string,
  payload: Record<string, unknown> | undefined,
  realNow: Date
): FlowResult {
  const job = memory.jobById(state, jobId);
  if (!job) return { ok: false, message: `There is no job called "${jobId}".` };
  const refusal = tickRefusal(state, seat, job, payload, realNow);
  if (refusal) return { ok: false, message: refusal };

  const type = payload!.type as TickType;
  const causeId = String(payload!.causeId);
  job.ticks = job.ticks.filter((t) => t.causeId !== causeId && !(type === "found" && t.type === "found"));
  if (type !== "clear") job.ticks.push({ causeId, type, seat });
  job.foundLeadId = job.ticks.find((t) => t.type === "found")?.causeId ?? null;

  alertIfLowConfidence(state, job, seat, realNow, stampNow(state, realNow));
  const said = type === "clear" ? "Tick cleared" : type === "found" ? "Found it" : "Not this";
  return { ok: true, message: `${said}: ${causeLabel(causeId)}.`, jobId: job.id };
}

// ---- The found lead and whose fix it is ----

function foundLead(state: MemoryState, seat: string, job: Job, realNow: Date): Lead | null | "none" {
  const found = job.ticks.find((t) => t.type === "found");
  if (!found) return "none";
  return leadsForJob(state, job, seat, realNow).leads.find((l) => l.causeId === found.causeId && l.tier === "found") ?? null;
}

const FOUND_FIRST = "tick Found it on the cause first.";
const FOUND_GONE = "The found lead is no longer a lead on this job. Tick Found it again.";

/** Whose fix a found lead is, when this seat may not do it (S9 step a, S17). */
function whoseFix(seat: string, lead: Lead): string {
  const cause = loadCauses().causes.find((c) => c.id === lead.causeId);
  if (!cause || cause.fixSeat === "none") return "this fix needs outside help: Ask HQ, A3";
  if (cause.fixSeat !== seat) return `this fix belongs to the ${cause.fixSeat.replace(/-/g, " ")}`;
  return `this fix is covered by the tenant's fit-out contract: it goes through the AOM (TS-CC-11)`;
}

function whyWords(payload: Record<string, unknown> | undefined): string {
  return typeof payload?.whyLine === "string" ? payload.whyLine.trim().replace(/\s+/g, " ") : "";
}

// ---- solved ----

/** Why Solved is refused, or null: a found lead this seat may fix, and one line of why, 3 to 30 words. */
export function solvedRefusal(
  state: MemoryState,
  seat: string,
  job: Job,
  payload: Record<string, unknown> | undefined,
  realNow: Date
): string | null {
  const lead = foundLead(state, seat, job, realNow);
  if (lead === "none") return `Solved needs a found lead: ${FOUND_FIRST}`;
  if (lead === null) return FOUND_GONE;
  if (!lead.fixAllowedHere) {
    const next = seat === "technician" ? " Press Send with the cause." : "";
    return `Solved is refused: ${whoseFix(seat, lead)}.${next}`;
  }
  const words = whyWords(payload).split(" ").filter(Boolean).length;
  if (words < 3 || words > 30) return "Solved needs one line of why: 3 to 30 words.";
  return null;
}

/** The next free runtime case id, R-01 first. */
export function nextCaseId(state: MemoryState): string {
  let n = state.runtimeCases.length + 1;
  const taken = new Set(state.runtimeCases.map((c) => c.id));
  while (taken.has(`R-${String(n).padStart(2, "0")}`)) n += 1;
  return `R-${String(n).padStart(2, "0")}`;
}

/**
 * Solved (S2, S7, S8): the job goes to pending-30-day with its one line of why,
 * and a case is saved for the 30-day rule. It is a win only after 30 days with
 * no repeat at the spot and a second person confirming the cause. No approval.
 */
export function applySolved(
  state: MemoryState,
  seat: string,
  jobId: string,
  payload: Record<string, unknown> | undefined,
  realNow: Date
): FlowResult {
  const job = memory.jobById(state, jobId);
  if (!job) return { ok: false, message: `There is no job called "${jobId}".` };
  const refusal = solvedRefusal(state, seat, job, payload, realNow);
  if (refusal) return { ok: false, message: refusal };

  const lead = foundLead(state, seat, job, realNow) as Lead;
  const at = stampNow(state, realNow);
  // Amounts never sit in a typed line (S13 item 9).
  const why = hideAmounts(whyWords(payload));
  const facts = factsForJob(state, job);

  job.status = "pending-30-day";
  job.whyLine = why;
  job.fixerSeat = seat;
  job.foundLeadId = lead.causeId;

  const saved: RuntimeCase = {
    id: nextCaseId(state),
    jobId: job.id,
    building: job.building,
    floor: job.floor,
    zone: job.zone,
    symptom: facts.find((f) => SYMPTOM_FACTS.includes(f)) ?? "",
    causeId: lead.causeId,
    fixedAt: at,
    fixedBy: seat,
    confirmedBy: null,
    facts,
    fix: lead.fixRoute,
    why,
  };
  state.runtimeCases.push(saved);

  pipCard(
    state,
    seat,
    job,
    `Job ${job.id} solved`,
    `Saved as a case: ${lead.label}. Why: ${why} It counts as a win only after 30 days with no repeat at this spot (check until ${thirtyDayEnd(at)}), and a second person confirms the cause.`,
    at
  );
  return { ok: true, message: `Job ${job.id} solved. It waits for its 30-day check.`, jobId: job.id };
}

// ---- send-with-cause and not-solved: the senior manager gets everything attached ----

/**
 * The senior manager's notice for an escalated job (S1 step 5, S21): the place,
 * the found cause and its fix line, the ticks with who made them, the tenant's
 * self-check answers and notes, and the impact record with its cost. Code text,
 * 0 AI, so nothing has to be asked twice.
 */
export function escalationNoticeText(
  state: MemoryState,
  job: Job,
  route: "not-solved" | "send-with-cause",
  seat: string,
  realNow: Date
): string {
  const tag = placeTag(job);
  const head = route === "not-solved" ? "Not solved" : "Sent with the cause";
  const lines = [
    `${head}: job ${job.id}, ${job.buildingName}, Level ${job.floor}, ${job.zone} (${tag.equipment}), ${job.complaint}.`,
  ];

  const found = job.ticks.find((t) => t.type === "found");
  if (found) {
    const lead = leadsForJob(state, job, seat, realNow).leads.find((l) => l.causeId === found.causeId);
    const fix = lead?.fixRoute ?? loadCauses().causes.find((c) => c.id === found.causeId)?.fixRoute ?? "";
    lines.push(`Found: ${causeLabel(found.causeId)} (${seatLabel(found.seat ?? seat)}). Fix: ${fix}.`);
  } else {
    lines.push("Found: no cause yet.");
  }

  const notThis = job.ticks.filter((t) => t.type === "not-this");
  lines.push(
    notThis.length > 0
      ? `Checked: ${notThis.map((t) => `${causeLabel(t.causeId)}: not this (${seatLabel(t.seat ?? seat)})`).join("; ")}.`
      : "Checked: no lead ruled out yet."
  );

  const answers = selfCheckLines(job);
  lines.push(answers.length > 0 ? `Self-check: ${answers.join("; ")}.` : "Self-check: none on this job.");
  for (const note of job.notes) lines.push(`Note: ${note}`);

  if (job.impact && typeof job.impact.cost === "number") {
    lines.push(`Impact record: ${impactLine(job.impact)}. Cost: ${costLine(job.impact.cost, loadImpactRates())}.`);
  }
  lines.push(`Sent by ${seatLabel(seat)} · AI calls: 0`);
  return lines.join("\n");
}

function escalate(
  state: MemoryState,
  seat: string,
  job: Job,
  route: "not-solved" | "send-with-cause",
  realNow: Date,
  at: string
): void {
  job.status = "escalated";
  job.escalatedWith = { route, seat, at, causeId: job.foundLeadId };
  state.notices.push({
    seat: "senior-manager",
    kind: "escalated",
    text: escalationNoticeText(state, job, route, seat, realNow),
    at,
    jobId: job.id,
  });
}

/** Why Send with the cause is refused, or null: a found lead whose fix is someone else's. */
export function sendWithCauseRefusal(state: MemoryState, seat: string, job: Job, realNow: Date): string | null {
  const lead = foundLead(state, seat, job, realNow);
  if (lead === "none") return `Send with the cause needs a found lead: ${FOUND_FIRST}`;
  if (lead === null) return FOUND_GONE;
  if (lead.fixAllowedHere) return "This fix is yours to make: press Solved with one line of why.";
  return null;
}

/** Send with the cause (S2): the job goes to the senior manager with its found cause. */
export function applySendWithCause(state: MemoryState, seat: string, jobId: string, realNow: Date): FlowResult {
  const job = memory.jobById(state, jobId);
  if (!job) return { ok: false, message: `There is no job called "${jobId}".` };
  const refusal = sendWithCauseRefusal(state, seat, job, realNow);
  if (refusal) return { ok: false, message: refusal };

  const at = stampNow(state, realNow);
  const label = causeLabel(job.foundLeadId ?? "");
  escalate(state, seat, job, "send-with-cause", realNow, at);
  pipCard(
    state,
    seat,
    job,
    `Job ${job.id} escalated`,
    `Sent to the senior manager with the cause (${label}) and everything attached.`,
    at
  );
  return { ok: true, message: `Job ${job.id} went to the senior manager with its cause.`, jobId: job.id };
}

/** Why Not solved is refused, or null: it needs the impact record (S3). */
export function notSolvedRefusal(payload: Record<string, unknown> | undefined): string | null {
  const check = checkImpactRecord(payload);
  return check.ok ? null : check.message;
}

/**
 * Not solved (S3): the impact record and its cost from the made-up rates are
 * stored on the job, and the job goes to the senior manager with everything
 * attached.
 */
export function applyNotSolved(
  state: MemoryState,
  seat: string,
  jobId: string,
  payload: Record<string, unknown> | undefined,
  realNow: Date
): FlowResult {
  const job = memory.jobById(state, jobId);
  if (!job) return { ok: false, message: `There is no job called "${jobId}".` };
  const check = checkImpactRecord(payload);
  if (!check.ok) return { ok: false, message: check.message };

  const rates = loadImpactRates();
  const cost = impactCost(check.record, rates);
  const at = stampNow(state, realNow);
  job.impact = { ...check.record, cost };
  escalate(state, seat, job, "not-solved", realNow, at);
  pipCard(
    state,
    seat,
    job,
    `Job ${job.id} escalated`,
    // S3: the cost is shown to the senior manager and the AOM; the technician's
    // card names the record only (S13 item 9 keeps amounts out of chat).
    `Not solved, sent to the senior manager with everything attached. Impact record: ${impactLine(job.impact)}. Its cost goes to the senior manager and the AOM.`,
    at
  );
  return { ok: true, message: `Job ${job.id} went to the senior manager with its impact record.`, jobId: job.id };
}
