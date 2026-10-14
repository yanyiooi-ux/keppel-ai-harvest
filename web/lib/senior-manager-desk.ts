/**
 * The senior manager's desk (S21, C8a): what the senior manager seat shows
 * besides the chat. Read only: it never writes the memory and never calls the
 * AI.
 *
 * The jobs that came up to this seat, then the one on the desk with everything
 * attached, so nothing is asked again: how it came up, the facts, the ticks
 * with who made them, the impact record, the same filled checklist as the
 * technician's, its own ranked list, and the pill steps. Then the new
 * solution, part by part, with each part's label (AI drafted, AI suggested
 * from the code menu, or picked by hand), the saved draft's hash and its test
 * run; and any outside help asked of HQ. Besides the job: the pending cases
 * with Confirm cause (never for the fixer) and the open red stops with Clear
 * stop.
 *
 * Every word comes from the pill, the data, the engine or the stored press.
 */

import { loadAndCheckPill, type Pill } from "./pill";
import { factsForJob } from "./leads";
import { loadCauses } from "./causes";
import { loadBuildings } from "./facts";
import { factLabel } from "./fact-labels";
import { MENU_FACTS, BLOCK_STEPS, PUT_FIRST_STEPS } from "./conditions";
import { openJobDesk, type OpenJobDesk } from "./technician-desk";
import { sendToHqRefusal } from "./actions";
import { runtimeCaseOutcome } from "./calls";
import { impactLine, costLine, loadImpactRates } from "./impact-rates";
import { seatLabel, dayMonth, thirtyDayEnd } from "./technician-flow";
import {
  currentSolution,
  outsideHelpFor,
  needsSafetyRecord,
  openStopKey,
  partDisplay,
  parseEffect,
  effectRefusals,
  runCounts,
  PART_TITLES,
  AI_DRAFTED,
  AI_SUGGESTED,
  FIX_LINE_WORD_FOR_WORD,
  PICK_BY_HAND,
  PICKED_BY_HAND,
  TYPED,
  CONFIRMED_SUFFIX,
  SAFETY_RECORD_LINE,
  SAFETY_RECORD_NOTE,
  type PartId,
  type Solution,
  type SolutionPart,
} from "./senior-manager-flow";
import type { AiMode } from "./ai";
import type { CardColour } from "./seat-view";
import * as memory from "./memory";
import type { MemoryState, Job, JobStatus } from "./memory";

const SEAT = "senior-manager";

/** The jobs that are with the senior manager (S3): escalated, a new solution drafted, or waiting on HQ's A3 decision. */
const WITH_THE_SENIOR_MANAGER: JobStatus[] = ["escalated", "new-solution-drafted", "outside-help-requested"];

const STATUS_WORDS: Partial<Record<JobStatus, string>> = {
  escalated: "Escalated",
  "new-solution-drafted": "New solution drafted",
  "outside-help-requested": "Waiting on HQ (A3)",
};

// ---- Shapes the screen reads ----

export interface ManagerJobRow {
  id: string;
  place: string;
  complaint: string;
  status: JobStatus;
  statusWord: string;
  isOpen: boolean;
  /** Show job: puts this job on the desk. A view only, never a press. */
  canShow: boolean;
}

export interface ManagerPartView {
  id: PartId;
  title: string;
  /** Where the part's value came from (S16 item 2). */
  label: string;
  suggested: string | null;
  value: string | null;
  /** What the box holds now: the confirmed value, else the suggestion, else nothing. */
  shown: string;
  /** The shown value in words. */
  display: string;
  /** An effect's pill step text, read from the pill. */
  stepText?: string;
  confirmed: boolean;
  /** A status always carries its word (S21). */
  word: "Confirmed" | "To confirm";
  colour: CardColour;
}

export interface ManagerTestRunView {
  passed: number;
  failed: number;
  notApplicable: number;
  counts: string;
  hash7: string;
  /** The run was made on the draft as it is now. */
  current: boolean;
  lines: { id: string; title: string; label: string; status: string }[];
}

export interface ManagerSolutionView {
  id: string;
  status: Solution["status"];
  statusLine: string;
  causeLabel: string;
  fixLine: string;
  whyLine: string;
  /** Red words in the typed lines (S12): a small flag only. */
  fixFlags: string[];
  whyFlags: string[];
  aiBanner?: string;
  aiNotice?: string;
  aiOff?: string;
  note?: { text: string; label: string; refusals: string[] };
  parts: ManagerPartView[];
  saved: boolean;
  savedLine: string;
  version: string;
  hash7: string | null;
  testRun: ManagerTestRunView | null;
  /** Parts may still be confirmed (the draft is not with HQ yet). */
  canEdit: boolean;
  /** A stored run with 0 failed on the draft's hash now (S16 item 7). */
  canSend: boolean;
  sendLine: string;
  receipt: string;
}

export interface ManagerOpenJob {
  /** The job through the senior manager's eyes: the same filled checklist, its own ranked list, the pill steps. */
  open: OpenJobDesk;
  cameUp: string | null;
  facts: string[];
  ticks: string[];
  impact: string | null;
  /** Escalated and not locked: Found it, Not this, Solved, Log new solution and Ask HQ for outside help. */
  editable: boolean;
  solution: ManagerSolutionView | null;
  outsideHelp: string[] | null;
}

export interface ManagerCaseRow {
  id: string;
  jobId: string;
  line: string;
  why: string;
  canConfirm: boolean;
  note?: string;
}

export interface ManagerStopRow {
  key: string;
  stopId: string;
  place: string;
  title: string;
  /** The stop's action, word for word from the pill: the red stop card's body (S11). */
  action?: string;
  call: string;
  /** "Red stop RS-xx · pill v{version} · AI calls: 0" (S11). */
  receipt?: string;
  opened: string;
  needsSafetyRecord: boolean;
  safetyRecordLabel?: string;
  note?: string;
}

export interface ManagerMenu {
  facts: { value: string; label: string }[];
  /** Each effect with its step's text, read from the pill, so the picker can show what it touches. */
  effects: { value: string; label: string; stepText?: string }[];
}

export interface ManagerDesk {
  title: string;
  jobs: ManagerJobRow[];
  open: ManagerOpenJob | null;
  cases: ManagerCaseRow[];
  stops: ManagerStopRow[];
  menu: ManagerMenu;
}

// ---- Small readers ----

function causeLabel(causeId: string): string {
  return loadCauses().causes.find((c) => c.id === causeId)?.label ?? causeId;
}

function buildingName(building: string): string {
  return loadBuildings().find((b) => b.id === building)?.name ?? building;
}

function livePill(state: MemoryState, building: string): Pill {
  return loadAndCheckPill("ts-cc", state.liveVersionByBuilding[building] ?? "1.0");
}

function timeOf(at: string): string {
  return `${dayMonth(at)}, ${at.slice(11, 16)}`;
}

// ---- The menu (S16 item 1): only what code allows ----

/** The facts and effects the code menu allows on this pill, for the part pickers. */
export function managerMenu(pill: Pill): ManagerMenu {
  const effects: ManagerMenu["effects"] = [];
  const add = (effect: "block" | "put-first", step: number) => {
    if (effectRefusals({ effect, step }, pill).length > 0) return;
    const value = `${effect}:${step}`;
    const text = pill.checklist.find((s) => s.step === step)?.text;
    effects.push({ value, label: partDisplay("effect-1", value), ...(text ? { stepText: text } : {}) });
  };
  for (const step of BLOCK_STEPS) add("block", step);
  for (const step of PUT_FIRST_STEPS) add("put-first", step);
  return { facts: MENU_FACTS.map((f) => ({ value: f, label: factLabel(f) })), effects };
}

// ---- The new solution, part by part ----

function partLabel(part: SolutionPart): string {
  const same = part.confirmed && part.value === part.suggested;
  if (part.id === "rule-text") {
    const from = part.suggestedBy === "ai" ? AI_DRAFTED : FIX_LINE_WORD_FOR_WORD;
    if (!part.confirmed) return from;
    return same ? `${from}${CONFIRMED_SUFFIX}` : TYPED;
  }
  if (!part.confirmed) return part.suggestedBy === "ai" ? AI_SUGGESTED : PICK_BY_HAND;
  return part.suggestedBy === "ai" && same ? `${AI_SUGGESTED}${CONFIRMED_SUFFIX}` : PICKED_BY_HAND;
}

function partView(part: SolutionPart, pill: Pill): ManagerPartView {
  const shown = part.value ?? part.suggested ?? (part.id === "effect-2" ? "none" : "");
  const view: ManagerPartView = {
    id: part.id,
    title: PART_TITLES[part.id],
    label: partLabel(part),
    suggested: part.suggested,
    value: part.value,
    shown,
    display: partDisplay(part.id, shown),
    confirmed: part.confirmed,
    word: part.confirmed ? "Confirmed" : "To confirm",
    colour: part.confirmed ? "green" : "amber",
  };
  const effect = part.id.startsWith("effect") ? parseEffect(shown) : null;
  const step = effect ? pill.checklist.find((s) => s.step === effect.step) : undefined;
  if (step) view.stepText = step.text;
  return view;
}

function solutionView(s: Solution): ManagerSolutionView {
  const pill = loadAndCheckPill("ts-cc", s.baseVersion);
  const saved = Boolean(s.hash && s.draftFile);
  const hash7 = s.hash ? s.hash.slice(0, 7) : null;
  const canEdit = s.status === "draft";
  const canSend = canEdit && sendToHqRefusal(s) === null;
  const run = s.testRun;

  const view: ManagerSolutionView = {
    id: s.id,
    status: s.status,
    statusLine:
      s.status === "draft"
        ? "Draft: confirm each part, run the tests, then send it to HQ (A2)."
        : "Sent to HQ: it waits for HQ's decision (A2).",
    causeLabel: causeLabel(s.causeId),
    fixLine: s.fixLine,
    whyLine: s.whyLine,
    fixFlags: s.flags.fixLine,
    whyFlags: s.flags.whyLine,
    parts: s.parts.map((p) => partView(p, pill)),
    saved,
    savedLine: saved
      ? `Every part is confirmed: draft v${s.version} saved in the runtime folder · ${hash7}`
      : "Nothing is saved until each part is confirmed.",
    version: s.version,
    hash7,
    testRun: run
      ? {
          passed: run.passed,
          failed: run.failed,
          notApplicable: run.notApplicable,
          counts: runCounts(run),
          hash7: run.draftHash.slice(0, 7),
          current: run.draftHash === s.hash,
          lines: run.results.map((r) => ({ id: r.id, title: r.title, label: r.label, status: r.status })),
        }
      : null,
    canEdit,
    canSend,
    sendLine: !canEdit
      ? `Sent to HQ by ${seatLabel(s.sentBy)}${s.sentAt ? `, ${timeOf(s.sentAt)}` : ""}.`
      : canSend
        ? "Send to HQ is open: the tests passed on this exact draft."
        : saved
          ? "Send to HQ needs a passing test run on this exact draft."
          : "Send to HQ needs every part confirmed, then a passing test run.",
    receipt: `New solution · pill v${s.baseVersion} · AI calls: ${s.ai.aiCalls}`,
  };
  if (s.ai.banner) view.aiBanner = s.ai.banner;
  if (s.ai.notice) view.aiNotice = s.ai.notice;
  if (s.ai.aiOff) view.aiOff = s.ai.aiOff;
  if (s.ai.note) view.note = s.ai.note;
  return view;
}

// ---- The job on the desk ----

function cameUpLine(job: Job): string | null {
  const how = job.escalatedWith;
  if (!how) return null;
  const head = how.route === "not-solved" ? "Not solved" : `Sent with the cause (${causeLabel(how.causeId ?? "")})`;
  return `${head} by ${seatLabel(how.seat)}, ${timeOf(how.at)}.`;
}

function tickLines(job: Job): string[] {
  return job.ticks.map(
    (t) =>
      `${causeLabel(t.causeId)}: ${t.type === "found" ? "Found it" : "Not this"} (${t.seat ? seatLabel(t.seat) : "who: not recorded"})`
  );
}

function impactText(job: Job): string | null {
  if (!job.impact) return null;
  const cost = typeof job.impact.cost === "number" ? ` Cost: ${costLine(job.impact.cost, loadImpactRates())}.` : "";
  return `${impactLine(job.impact)}.${cost}`;
}

function outsideHelpLines(state: MemoryState, job: Job): string[] | null {
  const request = outsideHelpFor(state, job.id);
  if (!request) return null;
  return [
    `Asked HQ for ${request.need === "contractor" ? "a contractor" : "budget"} (A3), ${timeOf(request.openedAt)}.`,
    `Reason: ${request.reason}`,
    `Needs money: ${request.needsMoney ? "yes" : "no"}.`,
    "Waiting for HQ's decision.",
  ];
}

function managerOpenJob(state: MemoryState, job: Job, realNow: Date, mode: AiMode | undefined): ManagerOpenJob {
  const open = openJobDesk(state, job, realNow, mode, SEAT);
  const solution = currentSolution(state, job.id);
  return {
    open,
    cameUp: cameUpLine(job),
    facts: factsForJob(state, job).map(factLabel),
    ticks: tickLines(job),
    impact: impactText(job),
    editable: job.status === "escalated" && open.locked === null,
    solution: solution ? solutionView(solution) : null,
    outsideHelp: outsideHelpLines(state, job),
  };
}

// ---- Pending cases (S8, cut 7) and open red stops (S11, cut 6) ----

function caseRows(state: MemoryState, realNow: Date): ManagerCaseRow[] {
  const now = memory.now(state, realNow);
  const rows: ManagerCaseRow[] = [];
  for (const c of state.runtimeCases) {
    if (c.confirmedBy) continue;
    // Confirm cause is for a pending case (S2): a fix the spot already called
    // back on is not. The press reads the same outcome on the server.
    if (runtimeCaseOutcome(state, c, now) === "failed") continue;
    const mine = c.fixedBy === SEAT;
    const row: ManagerCaseRow = {
      id: c.id,
      jobId: c.jobId,
      line: `${c.id} · job ${c.jobId} · ${causeLabel(c.causeId)} · fixed by ${seatLabel(c.fixedBy)} · pending, 30-day check until ${thirtyDayEnd(c.fixedAt)}`,
      why: c.why ?? "",
      canConfirm: !mine,
    };
    if (mine) row.note = "You fixed this one: a second person confirms the cause.";
    rows.push(row);
  }
  return rows;
}

function stopRows(state: MemoryState): ManagerStopRow[] {
  const rows: ManagerStopRow[] = [];
  for (const open of state.openRedStops) {
    if (open.clearedAt !== null) continue;
    const pill = livePill(state, open.building);
    const def = pill.red_stops.find((s) => s.id === open.stopId);
    if (!def) continue;
    const needs = needsSafetyRecord(def);
    const row: ManagerStopRow = {
      key: openStopKey(open),
      stopId: open.stopId,
      place: `${buildingName(open.building)}, Level ${open.floor}${open.stopId === "RS-08" ? `, ${open.zone}` : ""}`,
      title: def.trigger,
      action: def.action,
      call: def.who_to_call,
      receipt: `Red stop ${open.stopId} · pill v${pill.version} · AI calls: 0`,
      opened: `Raised by ${seatLabel(open.openedBySeat)}, ${timeOf(open.openedAt)}. ${open.lockedJobIds.length} job${open.lockedJobIds.length === 1 ? "" : "s"} locked.`,
      needsSafetyRecord: needs,
    };
    if (needs) {
      row.safetyRecordLabel = SAFETY_RECORD_LINE;
      row.note = SAFETY_RECORD_NOTE;
    }
    rows.push(row);
  }
  return rows;
}

// ---- The desk ----

/**
 * The senior manager seat's desk. `show` is Show job: another job with the
 * senior manager to put on the desk (a view only). Otherwise the first one.
 * `mode` is where the AI switch stands: on Off the leads carry "AI off".
 */
export function managerDesk(
  state: MemoryState,
  realNow: Date = new Date(),
  mode?: AiMode,
  show?: string
): ManagerDesk {
  const jobs = state.jobs
    .filter((j) => WITH_THE_SENIOR_MANAGER.includes(j.status))
    .sort((a, b) => a.id.localeCompare(b.id));
  const shown = jobs.find((j) => j.id === show) ?? jobs[0];

  return {
    title: "Jobs with you",
    jobs: jobs.map((j) => ({
      id: j.id,
      place: `${j.buildingName}, Level ${j.floor}, ${j.zone}`,
      complaint: j.complaint,
      status: j.status,
      statusWord: STATUS_WORDS[j.status] ?? j.status,
      isOpen: shown?.id === j.id,
      canShow: shown?.id !== j.id,
    })),
    open: shown ? managerOpenJob(state, shown, realNow, mode) : null,
    cases: caseRows(state, realNow),
    stops: stopRows(state),
    menu: managerMenu(livePill(state, shown?.building ?? "tower-a")),
  };
}
