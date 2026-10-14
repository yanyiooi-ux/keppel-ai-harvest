/**
 * HQ's desk (S21's HQ row, C8b): what the HQ seat shows besides the chat. Read
 * only: it never writes the memory and never calls the AI.
 *
 * The A1 card; each new solution sent to HQ with its fix line, why line, rule
 * text and condition, each part labelled with where it came from, its test
 * counts and hash, and S16 item 8's gates with a word each; the live version
 * in each building; the versions list like commits, newest first, with Roll
 * back while a version above 1.0 is live; the outside help requests (A3); and
 * the Building B card: its live version and ticket 2401's first 3 live leads,
 * ranked by the same engine as the technician seat, at the demo clock. The
 * rank wording under a lead was made at a press and shows only under the
 * reason it worded (its replay key).
 *
 * Every word comes from the pill, the data, the engine or the stored press.
 */

import { loadAndCheckPill, type Pill } from "./pill";
import { leadsForJob } from "./leads";
import { loadCauses } from "./causes";
import { loadBuildings } from "./facts";
import { deskLead, type DeskLead } from "./technician-desk";
import { safetyList } from "./safety";
import { seatLabel, dayMonth } from "./technician-flow";
import { partDisplay, parseEffect, runCounts, PART_TITLES, type PartId, type Solution, type SolutionPart, type OutsideHelpRequest } from "./senior-manager-flow";
import { approveGates, baseRefusal, outsideHelpResult, BASE_CHECK_LABEL, HQ_SIGNATURE } from "./hq-flow";
import { versionList, liveVersion, versionRecord, BASE_VERSION, type VersionRow } from "./versions";
import { AI_OFF_LABEL, type AiMode } from "./ai";
import type { CardColour } from "./seat-view";
import type { MemoryState, Notice } from "./memory";

/** The ticket the Building B card ranks (S21). */
export const BUILDING_B_JOB_ID = "2401";

// ---- The labels S21 gives HQ ----

export const RULE_TEXT_AI = "AI drafted, confirmed by the senior manager";
export const RULE_TEXT_TYPED = "typed";
export const CONDITION_AI = "AI suggested from the code menu, confirmed by the senior manager";
export const CONDITION_BY_HAND = "picked by hand";

// ---- Shapes the screen reads ----

export interface HqGateView {
  id: string;
  label: string;
  holds: boolean;
  /** A status always carries its word (S21). */
  word: "Holds" | "Fails";
  colour: CardColour;
  reason: string | null;
}

export interface HqConditionLine {
  id: PartId;
  title: string;
  display: string;
  label: string;
  /** An effect's pill step text, read from the pill. */
  stepText?: string;
}

export interface HqSolutionView {
  id: string;
  jobId: string;
  place: string;
  status: Solution["status"];
  statusWord: string;
  colour: CardColour;
  statusLine: string;
  causeLabel: string;
  fixLine: string;
  whyLine: string;
  ruleText: string;
  ruleTextLabel: string;
  condition: HqConditionLine[];
  counts: string | null;
  passed: number | null;
  failed: number | null;
  notApplicable: number | null;
  hash7: string | null;
  version: string;
  baseVersion: string;
  /** S16 item 8, gate by gate. Only while the solution waits for HQ. */
  gates: HqGateView[];
  /**
   * Shown only when it fails (C8b review): the draft was built on a version
   * that is not live now, so Approve is refused with this reason.
   */
  baseCheck: HqGateView | null;
  /** Approve and Decline are offered (the solution waits for HQ). */
  canDecide: boolean;
  sentLine: string;
  receipt: string;
}

export interface HqRequestRow {
  id: string;
  jobId: string;
  lines: string[];
  status: OutsideHelpRequest["status"];
  statusWord: string;
  colour: CardColour;
  canDecide: boolean;
  /** "outside help approved (A3)" or "declined: {reason}" once decided. */
  result?: string;
}

export interface HqBuildingB {
  /** The ticket it ranks: 2401. */
  jobId: string;
  from: string;
  title: string;
  version: string;
  ticket: string;
  leads: DeskLead[];
  alerts: { kind: string; text: string }[];
  /** Its own Safety, as on home (S21): the stops open in Building B, and the pill's list. */
  openHere: string[];
  stops: { id: string; trigger: string }[];
  aiOff?: string;
  receipt: string;
}

export interface HqDesk {
  title: string;
  a1: { title: string; line: string; receipt: string };
  live: { building: string; name: string; version: string }[];
  solutions: HqSolutionView[];
  versions: VersionRow[];
  /** Roll back, while a version above 1.0 is live (cut 10). */
  rollback: { version: string; parent: string; line: string } | null;
  requests: HqRequestRow[];
  buildingB: HqBuildingB | null;
}

// ---- Small readers ----

function causeLabel(causeId: string): string {
  return loadCauses().causes.find((c) => c.id === causeId)?.label ?? causeId;
}

function buildingName(building: string): string {
  return loadBuildings().find((b) => b.id === building)?.name ?? building;
}

function timeOf(at: string): string {
  return `${dayMonth(at)}, ${at.slice(11, 16)}`;
}

function sentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

// ---- A solution sent to HQ ----

/** The rule text's label for HQ (S21): the AI's draft confirmed as it stood, else typed. */
function ruleTextLabel(part: SolutionPart): string {
  return part.suggestedBy === "ai" && part.confirmed && part.value === part.suggested ? RULE_TEXT_AI : RULE_TEXT_TYPED;
}

/** Each part of the condition's label for HQ (S21): the AI's suggestion confirmed as it stood, else picked by hand. */
function conditionLabel(part: SolutionPart): string {
  return part.suggestedBy === "ai" && part.confirmed && part.value === part.suggested ? CONDITION_AI : CONDITION_BY_HAND;
}

const STATUS: Record<Solution["status"], { word: string; colour: CardColour }> = {
  draft: { word: "Draft", colour: "amber" },
  "sent-to-hq": { word: "Sent to HQ", colour: "amber" },
  "approved-and-distributed": { word: "Approved and distributed", colour: "green" },
  declined: { word: "Declined", colour: "red" },
};

/**
 * An approved solution's card says where its version stands now (C8b render
 * check): live everywhere, rolled back, or followed by a later version.
 */
function statusLine(state: MemoryState, s: Solution): string {
  if (s.status === "approved-and-distributed") {
    const approved = `Approved by ${HQ_SIGNATURE}${s.decidedAt ? `, ${timeOf(s.decidedAt)}` : ""}`;
    const record = versionRecord(state, s.version);
    const live = liveVersion(state);
    if (record?.rolledBackAt) {
      const rolled = `${approved}, then rolled back, ${timeOf(record.rolledBackAt)}`;
      // A later version may have gone live since: the card says where the buildings are now.
      return live === record.parent
        ? `${rolled}: every building is on v${record.parent} again.`
        : `${rolled}: every building went back to v${record.parent}; v${live} is live now.`;
    }
    if (live !== s.version) return `${approved}: v${s.version} went live in every building; v${live} is live now.`;
    return `${approved}: v${s.version} is live in every building.`;
  }
  if (s.status === "declined") {
    return `Declined by HQ${s.decidedAt ? `, ${timeOf(s.decidedAt)}` : ""}: ${sentence(s.declineReason ?? "")}`;
  }
  return "Waiting for your decision (A2): approve and send it to all buildings, or decline it with a reason.";
}

function solutionView(state: MemoryState, s: Solution, place: string): HqSolutionView {
  const pill: Pill = loadAndCheckPill("ts-cc", s.baseVersion);
  const part = (id: PartId) => s.parts.find((p) => p.id === id)!;
  const rule = part("rule-text");
  const condition: HqConditionLine[] = [];
  for (const id of ["fact", "effect-1", "effect-2"] as PartId[]) {
    const p = part(id);
    if (id === "effect-2" && (p.value === "none" || p.value === null)) continue;
    const line: HqConditionLine = { id, title: PART_TITLES[id], display: partDisplay(id, p.value), label: conditionLabel(p) };
    const effect = id === "fact" ? null : parseEffect(p.value ?? "");
    const step = effect ? pill.checklist.find((c) => c.step === effect.step) : undefined;
    if (step) line.stepText = step.text;
    condition.push(line);
  }

  const run = s.testRun;
  const waiting = s.status === "sent-to-hq";
  const stale = waiting ? baseRefusal(state, s) : null;
  // A rolled-back version's solution keeps its approval, and says it was rolled back.
  const rolledBack = s.status === "approved-and-distributed" && Boolean(versionRecord(state, s.version)?.rolledBackAt);
  return {
    id: s.id,
    jobId: s.jobId,
    place,
    status: s.status,
    statusWord: rolledBack ? "Approved, then rolled back" : STATUS[s.status].word,
    colour: rolledBack ? "amber" : STATUS[s.status].colour,
    statusLine: statusLine(state, s),
    causeLabel: causeLabel(s.causeId),
    fixLine: s.fixLine,
    whyLine: s.whyLine,
    ruleText: rule.value ?? "",
    ruleTextLabel: ruleTextLabel(rule),
    condition,
    counts: run ? runCounts(run) : null,
    passed: run ? run.passed : null,
    failed: run ? run.failed : null,
    notApplicable: run ? run.notApplicable : null,
    hash7: s.hash ? s.hash.slice(0, 7) : null,
    version: s.version,
    baseVersion: s.baseVersion,
    gates: waiting
      ? approveGates(state, s).map((g) => ({
          id: g.id,
          label: g.label,
          holds: g.holds,
          word: g.holds ? "Holds" : "Fails",
          colour: g.holds ? "green" : "red",
          reason: g.reason,
        }))
      : [],
    baseCheck: stale
      ? { id: "base", label: BASE_CHECK_LABEL, holds: false, word: "Fails", colour: "red", reason: stale }
      : null,
    canDecide: waiting,
    sentLine: `Sent by ${seatLabel(s.sentBy)}${s.sentAt ? `, ${timeOf(s.sentAt)}` : ""}.`,
    receipt: `New solution · draft v${s.version} on v${s.baseVersion} · AI calls: ${s.ai.aiCalls}`,
  };
}

/** The solutions that reached HQ: those waiting first, then the decided ones, newest first. */
function solutionViews(state: MemoryState): HqSolutionView[] {
  const sent = (state.solutions as Solution[]).filter((s) => s && s.status !== "draft");
  const order = (s: Solution) => (s.status === "sent-to-hq" ? 0 : 1);
  return [...sent]
    .reverse()
    .sort((a, b) => order(a) - order(b))
    .map((s) => {
      const job = state.jobs.find((j) => j.id === s.jobId);
      const place = job ? `${job.buildingName}, Level ${job.floor}, ${job.zone}` : "";
      return solutionView(state, s, place);
    });
}

// ---- Outside help (A3) ----

const REQUEST_STATUS: Record<OutsideHelpRequest["status"], { word: string; colour: CardColour }> = {
  open: { word: "Waiting on you", colour: "amber" },
  approved: { word: "Approved", colour: "green" },
  declined: { word: "Declined", colour: "red" },
};

function requestRows(state: MemoryState): HqRequestRow[] {
  const all = (state.requests as OutsideHelpRequest[]).filter((r) => r && r.kind === "A3");
  const order = (r: OutsideHelpRequest) => (r.status === "open" ? 0 : 1);
  return [...all]
    .reverse()
    .sort((a, b) => order(a) - order(b))
    .map((r) => {
      const job = state.jobs.find((j) => j.id === r.jobId);
      const where = job ? `${job.buildingName}, Level ${job.floor}, ${job.zone}` : "";
      const row: HqRequestRow = {
        id: r.id,
        jobId: r.jobId,
        lines: [
          `Job ${r.jobId}${where ? `, ${where}` : ""}: ${r.need === "contractor" ? "a contractor" : "budget"}.`,
          `Reason: ${r.reason}`,
          `Needs money: ${r.needsMoney ? "yes" : "no"}. No amount: HQ decides money (A3).`,
          `Asked by ${seatLabel(r.askedBy)}, ${timeOf(r.openedAt)}.`,
        ],
        status: r.status,
        statusWord: REQUEST_STATUS[r.status].word,
        colour: REQUEST_STATUS[r.status].colour,
        canDecide: r.status === "open",
      };
      if (r.status !== "open") row.result = outsideHelpResult(r.status === "approved" ? "approve" : "decline", r.decisionReason ?? "");
      return row;
    });
}

// ---- The Building B card (S21) ----

/** The version notices S16 items 9 and 11 send to the Building B card. */
const VERSION_NOTICE_KINDS = ["version-live", "rolled-back"];

/**
 * The Building B card's notices, on home and on the HQ seat: every safety
 * alert S11 routes there, in order, and only the newest version notice, so the
 * line under the card's live version never contradicts it (C8b review). The
 * memory keeps every notice; only the card shows fewer.
 */
export function buildingBNotices(state: MemoryState): Notice[] {
  const mine = state.notices.filter((n) => n.seat === "building-b-card");
  const newestVersion = mine.map((n) => VERSION_NOTICE_KINDS.includes(n.kind)).lastIndexOf(true);
  return mine.filter((n, i) => !VERSION_NOTICE_KINDS.includes(n.kind) || i === newestVersion);
}

/**
 * Building B, Level 12 (made up): its live version and ticket 2401's first 3
 * live leads, ranked for the technician seat at the demo clock. Its safety
 * alerts and version notices land here (S11, S16 items 9 and 11).
 */
export function buildingBView(state: MemoryState, realNow: Date = new Date(), mode?: AiMode): HqBuildingB | null {
  const job = state.jobs.find((j) => j.id === BUILDING_B_JOB_ID);
  if (!job) return null;
  const version = state.liveVersionByBuilding[job.building] ?? BASE_VERSION;
  const pill = loadAndCheckPill("ts-cc", version);
  const leads = leadsForJob(state, job, "technician", realNow)
    .leads.slice(0, 3)
    .map((lead) => deskLead(lead, job, pill, state, mode, true, "technician"));
  const aiCalls = leads.reduce((sum, l) => sum + l.aiCalls, 0);
  const view: HqBuildingB = {
    jobId: job.id,
    from: "Another building, same brain",
    title: "Building B, Level 12 (made up)",
    version,
    ticket: `Ticket ${job.id}, ${job.tenant}: ${job.complaint}, ${job.intake.when}.`,
    leads,
    alerts: buildingBNotices(state).map((n) => ({ kind: n.kind, text: n.text })),
    openHere: state.openRedStops.filter((s) => s.clearedAt === null && s.building === job.building).map((s) => s.stopId),
    stops: safetyList(pill).map((stop) => ({ id: stop.id, trigger: stop.trigger })),
    receipt: `Ranked by the same engine as the technician seat, at the demo clock. AI calls: ${aiCalls}`,
  };
  if (mode === "off") view.aiOff = AI_OFF_LABEL;
  return view;
}

// ---- The desk ----

export function hqDesk(state: MemoryState, realNow: Date = new Date(), mode?: AiMode): HqDesk {
  const current = liveVersion(state);
  const record = versionRecord(state, current);
  return {
    title: "Your desk: approvals, versions and outside help",
    a1: {
      title: "A1: version 1 of the brain",
      line: state.a1Line,
      receipt: `A1 · pill v${BASE_VERSION} · AI calls: 0`,
    },
    live: Object.entries(state.liveVersionByBuilding).map(([building, version]) => ({
      building,
      name: buildingName(building),
      version,
    })),
    solutions: solutionViews(state),
    versions: versionList(state),
    rollback:
      current !== BASE_VERSION && record
        ? {
            version: record.version,
            parent: record.parent,
            line: `Roll back v${record.version}: every building goes back to v${record.parent}. Nothing is deleted.`,
          }
        : null,
    requests: requestRows(state),
    buildingB: buildingBView(state, realNow, mode),
  };
}
