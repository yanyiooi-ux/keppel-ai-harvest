/**
 * HQ's presses on the shared memory (S2 A2 and A3, S16 items 8, 9 and 11,
 * S17, C8b): approve-solution, decline-solution, rollback and
 * decide-outside-help.
 *
 * runAction's gate has already checked the seat (only HQ). Each `...Refusal`
 * reads the memory and never writes; each `apply...` is called inside
 * memory.update and plans again on the memory it is given.
 *
 * Approve is where a new solution becomes the brain everywhere, so it is
 * exact: every gate of S16 item 8 is checked here on the server, each with its
 * plain reason, against the saved draft as it is now. Then the tested draft is
 * signed once into the runtime folder and never written again, every
 * building's live version moves at once (no per-building accept), the job's
 * case is saved, and only now may the A4 charge request open (S17). Nothing
 * here calls the AI and nothing here holds an amount.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { basename, dirname, join } from "path";
import { isDeepStrictEqual } from "util";
import { parse } from "yaml";
import { loadPill, loadAndCheckPillFile, signedPillPath, type Pill } from "./pill";
import { draftHash, wordCount } from "./draft";
import { GOLDEN_CASES } from "./golden-cases";
import { loadCauses } from "./causes";
import { factsForJob } from "./leads";
import { hideAmounts } from "./never-list";
import { sgStamp, nextChargeRequestId } from "./self-check-flow";
import type { ChargeRequest } from "./self-check-flow";
import { alertSeatFor } from "./permissions";
import { nextCaseId, seatLabel, dayMonth, SYMPTOM_FACTS } from "./technician-flow";
import { currentSolution, outsideHelpFor, runCounts, type Solution } from "./senior-manager-flow";
import { HQ_SIGNATURE, BASE_VERSION, liveVersion, versionRecord } from "./versions";
import * as memory from "./memory";
import type { MemoryState, Job, VersionRecord } from "./memory";

export { HQ_SIGNATURE };

/** A solution as HQ decides it: the senior manager's record, with HQ's decision on it. */
export type HqSolution = Solution;

export interface FlowResult {
  ok: boolean;
  message: string;
  jobId?: string;
}

// ---- Words ----

/** S16 item 9's notice to the senior manager, the AOM and the Building B card. */
export function liveNoticeText(version: string): string {
  return `v${version} is live in every building (role-played approval by HQ).`;
}

/** S16 item 11's notices, the same three places. */
export function rolledBackNoticeText(version: string, parent: string): string {
  return `v${version} was rolled back: every building is on v${parent} again (role-played decision by HQ).`;
}

/** S17's A4 request text, opened on Approve: what the tenant will hear, never an amount. */
export function approvalChargeText(tenantSolution: string): string {
  return `Tenant will hear: "${tenantSolution}" This is work on the tenant's fit-out (TS-CC-11). Who pays?`;
}

/** What a decided A3 request says on its card (S17). */
export function outsideHelpResult(decision: "approve" | "decline", reason: string): string {
  return decision === "approve" ? "outside help approved (A3)" : `declined: ${reason}`;
}

const NOT_WAITING = (jobId: string) => `There is no new solution from job ${jobId} waiting for HQ (A2).`;
const NO_ROLLBACK = `No version above v${BASE_VERSION} is live: there is nothing to roll back.`;
const NO_A3 = (jobId: string) => `There is no open outside help request on job ${jobId} (A3).`;

// ---- Small helpers ----

function oneLine(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

/** A typed reason ends its own sentence, so the next words read as the next sentence. */
function sentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function stampNow(state: MemoryState, realNow: Date): string {
  return sgStamp(memory.now(state, realNow));
}

function timeOf(at: string): string {
  return `${dayMonth(at)}, ${at.slice(11, 16)}`;
}

function causeOf(causeId: string) {
  return loadCauses().causes.find((c) => c.id === causeId);
}

function hqCard(state: MemoryState, seat: string, jobId: string | undefined, title: string, body: string, receipt: string, at: string): void {
  state.messages.push({
    seat,
    from: "pip",
    text: `${title}: ${body}`,
    at,
    cards: [{ kind: "answer", title, body, ...(jobId ? { jobId } : {}), receipt }],
  });
}

/** Every building there is: the live pointers, which Reset seeds for both. */
function buildingIds(state: MemoryState): string[] {
  return Object.keys(state.liveVersionByBuilding);
}

/** The senior manager, the AOM and the Building B card (S16 items 9 and 11). Building B has no AOM seat: its card. */
const NOTICE_SEATS = ["senior-manager", alertSeatFor("aom", "tower-a"), alertSeatFor("aom", "building-b")];

// ---- approve-solution (A2): S16 item 8's gates ----

export type GateId = "tests" | "hash" | "red-stops" | "pill-check";

export interface ApproveGate {
  id: GateId;
  label: string;
  holds: boolean;
  /** The plain reason it fails, or null when it holds. */
  reason: string | null;
}

export const GATE_LABELS: Record<GateId, string> = {
  tests: "Tests: a stored run with 0 failed, every case run",
  hash: "The tests ran on this exact draft (its hash now)",
  "red-stops": "Red stops: equal to v1.0's",
  "pill-check": "Pill check: the draft passes loadAndCheckPill",
};

/** Every check a run must hold (S16 item 5): checkPill, the red stops, every golden case and R-01. */
export const EVERY_CASE: string[] = ["checkPill", "red-stops", ...GOLDEN_CASES.map((c) => c.id), "R-01"];

function draftPath(s: Solution): string | null {
  return s.draftFile ? join(memory.runtimeDir(), s.draftFile) : null;
}

/** The saved draft's YAML text as it is now, or null when it is missing. */
function draftText(s: Solution): string | null {
  const path = draftPath(s);
  return path && existsSync(path) ? readFileSync(path, "utf-8") : null;
}

/**
 * S16 item 8, gate by gate, on the saved draft as it is now: a stored run with
 * 0 failed and every case run; the run's hash is the draft's hash now; the
 * draft's red_stops equal v1.0's; it passes loadAndCheckPill. Reads only.
 */
export function approveGates(state: MemoryState, s: Solution): ApproveGate[] {
  void state;
  const text = draftText(s);
  const hashNow = text === null ? null : draftHash(text);
  const run = s.testRun;

  const tests: string[] = [];
  if (!run) {
    tests.push("No test run is stored on this draft: the senior manager runs the tests first.");
  } else {
    const failedCount = Math.max(
      typeof run.failed === "number" ? run.failed : 0,
      (run.results ?? []).filter((r) => r.status === "failed").length
    );
    if (failedCount > 0 || typeof run.failed !== "number") {
      tests.push(`The stored test run has ${failedCount} failed: approval needs 0 failed.`);
    }
    const ran = new Set((run.results ?? []).map((r) => r.id));
    const missing = EVERY_CASE.filter((id) => !ran.has(id));
    if (missing.length > 0) tests.push(`The stored test run did not run every case: ${missing.join(", ")} missing.`);
    if (!(typeof run.passed === "number" && run.passed > 0)) tests.push("Nothing passed in the stored test run, so it proves nothing.");
  }

  let hash: string | null = null;
  if (hashNow === null) hash = "The saved draft is missing, so it cannot be checked against its tests.";
  else if (!run) hash = "There is no test run to hold against the draft's hash.";
  else if (run.draftHash !== hashNow || s.hash !== hashNow) {
    hash = "The draft changed since the tests: the senior manager runs them again on this exact draft.";
  }

  let pill: Pill | null = null;
  if (text !== null) {
    try {
      pill = parse(text) as Pill;
    } catch {
      pill = null;
    }
  }
  const v10 = loadPill(pill?.pill_id || "ts-cc", BASE_VERSION);
  let redStops: string | null = null;
  if (!pill) redStops = "The saved draft cannot be read, so its red stops cannot be checked.";
  else if (!isDeepStrictEqual(pill.red_stops, v10.red_stops)) {
    redStops = "The draft's red stops differ from v1.0's: a new solution never changes a red stop.";
  }

  let pillCheck: string | null = null;
  const path = draftPath(s);
  if (text === null || !path) pillCheck = "The saved draft is missing, so it cannot pass the pill check.";
  else {
    try {
      loadAndCheckPillFile(path);
    } catch (err) {
      // checkPill's own words about the draft's fields: code text, never an AI or network error.
      pillCheck = `The draft fails the pill check: ${(err as Error).message}.`;
    }
  }

  const gate = (id: GateId, reason: string | null): ApproveGate => ({ id, label: GATE_LABELS[id], holds: reason === null, reason });
  return [
    gate("tests", tests.length > 0 ? tests.join(" ") : null),
    gate("hash", hash),
    gate("red-stops", redStops),
    gate("pill-check", pillCheck),
  ];
}

/** The job's solution waiting for HQ, or undefined. */
function waitingSolution(state: MemoryState, jobId: string): Solution | undefined {
  const s = currentSolution(state, jobId);
  return s && s.status === "sent-to-hq" ? s : undefined;
}

export const BASE_CHECK_LABEL = "Built on the version live now";

/**
 * Why a draft cannot go live on the base it was built on, or null (C8b
 * review). The draft is its base plus one rule, so approving it puts its whole
 * base live in every building. When the base is not what every building runs
 * now, that would quietly bring back a version HQ rolled back, or drop what a
 * later approval added. HQ declines it, and the senior manager logs the
 * solution again on the live version. Reads only.
 */
export function baseRefusal(state: MemoryState, s: Solution): string | null {
  const lives = Object.values(state.liveVersionByBuilding);
  if (lives.length > 0 && lives.every((v) => v === s.baseVersion)) return null;
  const live = liveVersion(state);
  const again = `Decline it, and the senior manager logs the solution again on v${live}.`;
  if (versionRecord(state, s.baseVersion)?.rolledBackAt) {
    return `This draft was built on v${s.baseVersion}, which was rolled back: every building is on v${live} now, so approving it would bring back what v${s.baseVersion} added. ${again}`;
  }
  return `This draft was built on v${s.baseVersion}, but v${live} is live in every building now, so approving it would drop what v${live} added. ${again}`;
}

/** Why Approve is refused, or null: a solution sent to HQ, every gate of S16 item 8, and a base that is live now. */
export function approveRefusal(state: MemoryState, job: Job): string | null {
  const s = waitingSolution(state, job.id);
  if (!s) return NOT_WAITING(job.id);
  const reasons = approveGates(state, s)
    .filter((g) => !g.holds)
    .map((g) => g.reason as string);
  const base = baseRefusal(state, s);
  if (base) reasons.push(base);
  if (reasons.length > 0) return reasons.join(" ");
  const pillId = (parse(draftText(s)!) as Pill).pill_id || "ts-cc";
  if (versionRecord(state, s.version) || existsSync(signedPillPath(pillId, s.version))) {
    return `v${s.version} is already signed: a later solution starts the next version.`;
  }
  return null;
}

/**
 * Approve and send to all buildings (A2, S16 items 8 and 9). The tested draft
 * is signed once ("wx": never over an existing file) and frozen; every
 * building's live version moves at once; the version is recorded like a
 * commit; the job's case is saved as pending (fixed by the senior manager,
 * confirmed by HQ) and the job waits for its 30-day check; notices go to the
 * senior manager, the AOM and the Building B card; and, when the found lead is
 * a tenant item on a floor with a fit-out in the last 12 months, the A4 charge
 * request opens for the AOM (S17). No amount, ever.
 */
export function applyApprove(state: MemoryState, seat: string, jobId: string, realNow: Date): FlowResult {
  const job = memory.jobById(state, jobId);
  if (!job) return { ok: false, message: `There is no job called "${jobId}".` };
  const refusal = approveRefusal(state, job);
  if (refusal) return { ok: false, message: refusal };

  const s = waitingSolution(state, jobId)!;
  const at = stampNow(state, realNow);
  const text = draftText(s)!;
  const pill = parse(text) as Pill;
  const pillId = pill.pill_id || "ts-cc";
  const hash = draftHash(text);

  // Signed once and frozen: the exact draft the tests ran on.
  const signed = signedPillPath(pillId, s.version);
  mkdirSync(dirname(signed), { recursive: true });
  writeFileSync(signed, text, { encoding: "utf-8", flag: "wx" });

  const record: VersionRecord = {
    pillId,
    version: s.version,
    parent: s.baseVersion,
    hash,
    signedBy: HQ_SIGNATURE,
    approvedBySeat: seat,
    approvedAt: at,
    why: s.whyLine,
    ruleId: s.ruleId ?? "",
    jobId: job.id,
    solutionId: s.id,
    file: basename(signed),
  };
  state.versions = [...(state.versions ?? []), record];

  // Distribution (S16 item 9): every building at once, no per-building accept.
  for (const building of buildingIds(state)) state.liveVersionByBuilding[building] = s.version;

  s.status = "approved-and-distributed";
  s.decidedBy = seat;
  s.decidedAt = at;

  // The job's case: cause = the found lead, its facts, the fix and why lines.
  const facts = factsForJob(state, job);
  const caseId = nextCaseId(state);
  state.runtimeCases.push({
    id: caseId,
    jobId: job.id,
    building: job.building,
    floor: job.floor,
    zone: job.zone,
    symptom: facts.find((f) => SYMPTOM_FACTS.includes(f)) ?? "",
    causeId: s.causeId,
    fixedAt: at,
    fixedBy: s.loggedBy,
    confirmedBy: seat,
    facts,
    fix: s.fixLine,
    why: s.whyLine,
  });
  job.status = "pending-30-day";
  job.whyLine = s.whyLine;
  job.fixerSeat = s.loggedBy;
  job.foundLeadId = s.causeId;

  const live = liveNoticeText(s.version);
  for (const to of NOTICE_SEATS) state.notices.push({ seat: to, kind: "version-live", text: live, at, jobId: job.id });

  // A4 opens here and only here (S17): a tenant item on a floor with a fit-out in the last 12 months.
  const cause = causeOf(s.causeId);
  let charge = "";
  if (cause?.tenantItem && facts.includes("fit-out-12m")) {
    const request: ChargeRequest & { causeId: string; tenantSolution: string } = {
      id: nextChargeRequestId(state),
      kind: "A4",
      status: "open",
      seat: alertSeatFor("aom", job.building),
      jobId: job.id,
      tenant: job.tenant,
      building: job.building,
      floor: job.floor,
      text: approvalChargeText(cause.tenantSolution),
      openedAt: at,
      causeId: cause.id,
      tenantSolution: cause.tenantSolution,
    };
    state.requests.push(request);
    state.notices.push({ seat: request.seat, kind: "charge-request", text: request.text, at, jobId: job.id });
    charge = " The AOM has a charge request to decide (A4); the tenant hears nothing until then.";
  }

  hqCard(
    state,
    seat,
    job.id,
    `Approved: v${s.version}`,
    `${live} Signed: ${HQ_SIGNATURE}, ${timeOf(at)}. Job ${job.id}'s case ${caseId} waits for its 30-day check.${charge}`,
    `Version v${s.version} · ${hash.slice(0, 7)} · tests: ${runCounts(s.testRun!)} · AI calls: 0`,
    at
  );
  return { ok: true, message: `${live} Job ${job.id} waits for its 30-day check.`, jobId: job.id };
}

// ---- decline-solution (A2) ----

export function declineRefusal(state: MemoryState, job: Job, payload: Record<string, unknown> | undefined): string | null {
  if (!waitingSolution(state, job.id)) return NOT_WAITING(job.id);
  if (wordCount(oneLine(payload?.reason)) < 3) return "Decline needs a reason of 3 words or more.";
  return null;
}

/** Decline (S2): the job goes back to escalated with HQ's reason; nothing goes live and no request opens. */
export function applyDecline(
  state: MemoryState,
  seat: string,
  jobId: string,
  payload: Record<string, unknown> | undefined,
  realNow: Date
): FlowResult {
  const job = memory.jobById(state, jobId);
  if (!job) return { ok: false, message: `There is no job called "${jobId}".` };
  const refusal = declineRefusal(state, job, payload);
  if (refusal) return { ok: false, message: refusal };

  const s = waitingSolution(state, jobId)!;
  const at = stampNow(state, realNow);
  const reason = hideAmounts(oneLine(payload!.reason));
  s.status = "declined";
  s.decidedBy = seat;
  s.decidedAt = at;
  s.declineReason = reason;
  job.status = "escalated";

  state.notices.push({
    seat: "senior-manager",
    kind: "solution-declined",
    text: `HQ declined the new solution for job ${job.id} (A2): ${sentence(reason)} The job is back with you. · AI calls: 0`,
    at,
    jobId: job.id,
  });
  hqCard(
    state,
    seat,
    job.id,
    `Declined: job ${job.id}`,
    `Draft v${s.version} stays out of every building. Reason: ${sentence(reason)} The job is back with the senior manager.`,
    "New solution · AI calls: 0",
    at
  );
  return { ok: true, message: `Declined. Job ${job.id} is back with the senior manager.`, jobId: job.id };
}

// ---- rollback (cut 10) ----

/** Why Roll back is refused, or null: a live version above 1.0, and the one named, if any, is the live one. */
export function rollbackRefusal(state: MemoryState, payload: Record<string, unknown> | undefined): string | null {
  const current = liveVersion(state);
  if (current === BASE_VERSION || !versionRecord(state, current)) return NO_ROLLBACK;
  const named = payload?.version;
  if (typeof named === "string" && named !== current) return `v${named} is not the live version: v${current} is.`;
  return null;
}

/**
 * Roll back (S16 item 11): every building back to the live version's parent.
 * Nothing is deleted: the signed file, the drafts, the cases and the record
 * stay, and the list shows the version as rolled back.
 */
export function applyRollback(state: MemoryState, seat: string, payload: Record<string, unknown> | undefined, realNow: Date): FlowResult {
  const refusal = rollbackRefusal(state, payload);
  if (refusal) return { ok: false, message: refusal };

  const record = versionRecord(state, liveVersion(state))!;
  const at = stampNow(state, realNow);
  record.rolledBackAt = at;
  record.rolledBackBySeat = seat;
  for (const building of buildingIds(state)) state.liveVersionByBuilding[building] = record.parent;

  const text = rolledBackNoticeText(record.version, record.parent);
  for (const to of NOTICE_SEATS) state.notices.push({ seat: to, kind: "rolled-back", text, at, jobId: record.jobId });
  hqCard(
    state,
    seat,
    undefined,
    `Rolled back: v${record.version}`,
    `${text} Nothing is deleted: v${record.version} stays in the versions list as rolled back, and its cases stay.`,
    `Version v${record.version} · ${record.hash.slice(0, 7)} · AI calls: 0`,
    at
  );
  return { ok: true, message: text };
}

// ---- decide-outside-help (A3, cut 8) ----

export function decideOutsideHelpRefusal(state: MemoryState, job: Job, payload: Record<string, unknown> | undefined): string | null {
  const request = outsideHelpFor(state, job.id);
  if (!request || request.status !== "open") return NO_A3(job.id);
  if (payload?.decision !== "approve" && payload?.decision !== "decline") return "Pick Approve or Decline.";
  const reason = oneLine(payload?.reason);
  if (wordCount(reason) < 3) return "Approve or Decline needs a reason of 3 words or more.";
  if (hideAmounts(reason) !== reason) return "Leave the amount out: no amount goes in the text (S13).";
  return null;
}

/** HQ decides outside help (S17 A3): either way the job goes back to escalated, with the decision on its card. */
export function applyDecideOutsideHelp(
  state: MemoryState,
  seat: string,
  jobId: string,
  payload: Record<string, unknown> | undefined,
  realNow: Date
): FlowResult {
  const job = memory.jobById(state, jobId);
  if (!job) return { ok: false, message: `There is no job called "${jobId}".` };
  const refusal = decideOutsideHelpRefusal(state, job, payload);
  if (refusal) return { ok: false, message: refusal };

  const request = outsideHelpFor(state, job.id)!;
  const decision = payload!.decision as "approve" | "decline";
  const reason = oneLine(payload!.reason);
  const at = stampNow(state, realNow);
  request.status = decision === "approve" ? "approved" : "declined";
  request.decidedBy = seat;
  request.decidedAt = at;
  request.decisionReason = reason;
  job.status = "escalated";

  const result = outsideHelpResult(decision, reason);
  state.notices.push({
    seat: "senior-manager",
    kind: "outside-help",
    text: `HQ decided on outside help for job ${job.id}: ${sentence(result)}${decision === "approve" ? ` Reason: ${sentence(reason)}` : ""} The job is back with you. · AI calls: 0`,
    at,
    jobId: job.id,
  });
  hqCard(
    state,
    seat,
    job.id,
    `Outside help for job ${job.id} (A3)`,
    `${sentence(result)}${decision === "approve" ? ` Reason: ${sentence(reason)}` : ""} Decided by ${seatLabel(seat)}. The job is back with the senior manager.`,
    "Outside help · AI calls: 0",
    at
  );
  return { ok: true, message: `${sentence(result)} Job ${job.id} is back with the senior manager.`, jobId: job.id };
}
