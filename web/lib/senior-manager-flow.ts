/**
 * The senior manager's presses on the shared memory (S2, S3, S11, S16, S17,
 * C8a): log-new-solution, confirm-part, run-tests, send-to-hq,
 * ask-outside-help and clear-stop. Found it, Not this and Solved are the
 * technician's own code (technician-flow.ts), pressed from this seat.
 *
 * runAction's gate has already checked the seat, the status and the safety
 * lock. Each `...Refusal` reads the memory and never writes; each `apply...` is
 * called inside memory.update and plans again on the memory it is given.
 *
 * A new solution is born here, so it is honest and exact. The AI only drafts
 * the rule text and suggests the fact and effects from the code menu (S15's
 * new-solution job, worded before the update in action-turn.ts). Code keeps
 * each suggestion as a suggestion: nothing is saved until the senior manager
 * confirms each part with its own button, and anything off the menu is
 * refused. Once every part is confirmed, code builds the draft (S16 item 2),
 * saves it in the runtime folder and keeps its hash; a confirm that changes
 * the draft clears the stored test run (S16 item 7). The senior manager
 * approves nothing: HQ does (A2). No charge request opens here (S17).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { loadAndCheckPill, type Pill, type RedStop } from "./pill";
import { leadsForJob } from "./leads";
import { loadCauses } from "./causes";
import { loadBuildings } from "./facts";
import { factLabel } from "./fact-labels";
import { MENU_FACTS, checkCondition, type ConditionEffect } from "./conditions";
import { buildDraft, draftYaml, draftHash, draftFileName, checkSolutionLines, wordCount, nextVersion } from "./draft";
import { runDraftTests, type DraftTestRun } from "./draft-tests";
import { typedSafetyWords } from "./safety";
import { hideAmounts, scanNeverList } from "./never-list";
import { sgStamp } from "./self-check-flow";
import { seatLabel, dayMonth } from "./technician-flow";
import { newSolutionSpec, type AiOutcome, type NewSolution, type AiPlace } from "./ai";
import * as memory from "./memory";
import type { MemoryState, Job, JobStatus, OpenRedStop } from "./memory";

export interface FlowResult {
  ok: boolean;
  message: string;
  jobId?: string;
}

// ---- Labels on screen (S16 item 2, S11) ----

/** The rule text the AI drafted (S16 item 2). */
export const AI_DRAFTED = "AI drafted";
/** The fact and each effect the AI suggested (S16 item 2). */
export const AI_SUGGESTED = "AI suggested from the code menu";
/** The rule text with the AI off, or with no answer that passed (S15). */
export const FIX_LINE_WORD_FOR_WORD = "the fix line, word for word";
/** A fact or effect nobody suggested: the senior manager picks it (S15, S16 item 2). */
export const PICK_BY_HAND = "pick by hand from the menu";
export const PICKED_BY_HAND = "picked by hand";
export const TYPED = "typed by the senior manager";
export const CONFIRMED_SUFFIX = ", confirmed by the senior manager";

/** S11's tick for a stop whose who_to_call names the Fire Safety Manager. */
export const SAFETY_RECORD_LINE = "Safety record: Fire Safety Manager told and agreed (role-played)";
/** S11: the screen calls it a safety record, not an approval. */
export const SAFETY_RECORD_NOTE = "This is a safety record, not an approval.";

const WITH_HQ = "That draft is with HQ now: it waits for HQ's decision (A2).";
const NO_SOLUTION = "There is no new solution on this job yet.";
const NOT_SAVED = "Confirm each part first: nothing is saved until then, so there is no draft to test.";
const FOUND_FIRST = "Log new solution needs a found lead: tick Found it on the cause first.";
const FOUND_GONE = "The found lead is no longer a lead on this job. Tick Found it again.";

// ---- The solution record (S16 items 2, 5 and 7; S20 "solutions") ----

export type PartId = "rule-text" | "fact" | "effect-1" | "effect-2";
export const PART_IDS: PartId[] = ["rule-text", "fact", "effect-1", "effect-2"];

export const PART_TITLES: Record<PartId, string> = {
  "rule-text": "Rule text",
  fact: "Fact",
  "effect-1": "Effect 1",
  "effect-2": "Effect 2",
};

/**
 * One part of the draft, confirmed with its own button. An effect is written
 * "block:25" or "put-first:21"; "none" is no second effect.
 */
export interface SolutionPart {
  id: PartId;
  /** What the box held first: the AI's suggestion, or the fix line for the rule text. Null when nothing was suggested. */
  suggested: string | null;
  suggestedBy: "ai" | "fix-line" | null;
  /** The confirmed value, or null until it is confirmed. */
  value: string | null;
  confirmed: boolean;
  confirmedAt?: string;
}

export interface SolutionAi {
  source: "live" | "replay" | "fallback" | "off" | "none";
  /** "replay: saved real AI answer". */
  banner: string | null;
  /** "<status> AI unavailable, using replay". */
  notice: string | null;
  /** "AI off". */
  aiOff: string | null;
  aiCalls: number;
  /** A suggestion the menu has no rule for: shown as "advisory, not enforced", never in a pill. */
  note: { text: string; label: string; refusals: string[] } | null;
}

export interface Solution {
  id: string;
  jobId: string;
  status: "draft" | "sent-to-hq";
  /** The found lead: the cause. */
  causeId: string;
  fixLine: string;
  whyLine: string;
  /** Red words in the typed lines (S12): stop ids, shown as a small flag. No alert, no lock. */
  flags: { fixLine: string[]; whyLine: string[] };
  /** The live version the draft starts from, and the version it becomes. */
  baseVersion: string;
  version: string;
  loggedBy: string;
  loggedAt: string;
  ai: SolutionAi;
  parts: SolutionPart[];
  /** Set once every part is confirmed and the draft is saved in the runtime folder. */
  draftFile?: string;
  /** SHA-256 of the saved draft's YAML text: the draft's hash now (S16 item 7). */
  hash?: string;
  ruleId?: string;
  /** The stored test run, with the hash it saw. A confirm that changes the draft clears it. */
  testRun?: DraftTestRun;
  sentBy?: string;
  sentAt?: string;
}

/** An A3 request (S17): what is needed, why, and whether it needs money. Never an amount. */
export interface OutsideHelpRequest {
  id: string;
  kind: "A3";
  status: "open";
  seat: "hq";
  jobId: string;
  need: "contractor" | "budget";
  reason: string;
  needsMoney: boolean;
  askedBy: string;
  openedAt: string;
}

/** The job's newest solution. */
export function currentSolution(state: MemoryState, jobId: string | undefined): Solution | undefined {
  if (!jobId) return undefined;
  const mine = (state.solutions as Solution[]).filter((s) => s && s.jobId === jobId);
  return mine[mine.length - 1];
}

/** The job's newest A3 request. */
export function outsideHelpFor(state: MemoryState, jobId: string): OutsideHelpRequest | undefined {
  const mine = (state.requests as OutsideHelpRequest[]).filter((r) => r && r.kind === "A3" && r.jobId === jobId);
  return mine[mine.length - 1];
}

// ---- Small helpers ----

function stampNow(state: MemoryState, realNow: Date): string {
  return sgStamp(memory.now(state, realNow));
}

function oneLine(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function causeLabel(causeId: string): string {
  return loadCauses().causes.find((c) => c.id === causeId)?.label ?? causeId;
}

function buildingName(building: string): string {
  return loadBuildings().find((b) => b.id === building)?.name ?? building;
}

function livePill(state: MemoryState, building: string): Pill {
  return loadAndCheckPill("ts-cc", state.liveVersionByBuilding[building] ?? "1.0");
}

function pipCard(state: MemoryState, seat: string, jobId: string | undefined, title: string, body: string, receipt: string, at: string): void {
  state.messages.push({
    seat,
    from: "pip",
    text: `${title}: ${body}`,
    at,
    cards: [{ kind: "answer", title, body, ...(jobId ? { jobId } : {}), receipt }],
  });
}

/** "block:25" for { effect: "block", step: 25 }. */
export function effectValue(effect: ConditionEffect): string {
  return `${effect.effect}:${effect.step}`;
}

/** { effect, step } for "block:25" or "put-first:21", else null. */
export function parseEffect(value: string): ConditionEffect | null {
  const m = /^(block|put-first):(\d+)$/.exec(value);
  return m ? { effect: m[1] as ConditionEffect["effect"], step: Number(m[2]) } : null;
}

/** What a part's value says on screen: "Block step 25", "Put step 21 first", a fact's label. */
export function partDisplay(id: PartId, value: string | null): string {
  if (value === null || value === "") return id === "rule-text" ? "No rule text yet" : "Not picked yet";
  if (id === "rule-text") return value;
  if (id === "fact") return factLabel(value);
  if (value === "none") return "No second effect";
  const effect = parseEffect(value);
  if (!effect) return value;
  return effect.effect === "block" ? `Block step ${effect.step}` : `Put step ${effect.step} first`;
}

/** The menu refusals for one effect on this pill (S16 item 1). [] means it fits the menu. */
export function effectRefusals(effect: ConditionEffect, pill: Pill): string[] {
  return checkCondition({ fact: MENU_FACTS[0], effects: [effect] }, pill);
}

/** Red words in typed text (S12): the stops they match, in YAML order. A flag only: no alert, no lock. */
export function redWordFlags(text: string, pill: Pill): string[] {
  return typedSafetyWords(text, pill).matchedStops.map((s) => s.id);
}

/** The found lead on this job through this seat's eyes, "none" with no Found it, or null when it is no lead any more. */
function foundLead(state: MemoryState, seat: string, job: Job, realNow: Date) {
  const found = job.ticks.find((t) => t.type === "found");
  if (!found) return "none" as const;
  return leadsForJob(state, job, seat, realNow).leads.find((l) => l.causeId === found.causeId && l.tier === "found") ?? null;
}

// ---- log-new-solution ----

/** The fix line and the why line as they are kept: one line each, amounts hidden (S13 item 9). */
export function solutionLines(payload: Record<string, unknown> | undefined): { fixLine: string; whyLine: string } {
  return { fixLine: hideAmounts(oneLine(payload?.fixLine)), whyLine: hideAmounts(oneLine(payload?.whyLine)) };
}

/** Why Log new solution is refused, or null: a found lead, and a fix line and a why line of 3 to 30 words each. */
export function logNewSolutionRefusal(
  state: MemoryState,
  seat: string,
  job: Job,
  payload: Record<string, unknown> | undefined,
  realNow: Date
): string | null {
  const lead = foundLead(state, seat, job, realNow);
  if (lead === "none") return FOUND_FIRST;
  if (lead === null) return FOUND_GONE;
  const { fixLine, whyLine } = solutionLines(payload);
  const refusals = checkSolutionLines(fixLine, whyLine);
  return refusals.length > 0 ? refusals.join(" ") : null;
}

/** What the AI words for a Log new solution press (S15 new-solution): the live pill, the lines and the place. */
export function solutionToWord(
  state: MemoryState,
  seat: string,
  job: Job,
  payload: Record<string, unknown> | undefined
): { pill: Pill; fixLine: string; whyLine: string; place: AiPlace } {
  const version = state.liveVersionByBuilding[job.building] ?? "1.0";
  const { fixLine, whyLine } = solutionLines(payload);
  return { pill: loadAndCheckPill("ts-cc", version), fixLine, whyLine, place: { seat, version, job } };
}

/**
 * Log new solution (S16 item 2): the draft's four parts, each waiting for its
 * own Confirm. The AI's answer is kept only when its replay key is the key of
 * exactly these lines; otherwise the rule text is the fix line word for word
 * and the fact and effects are picked by hand. No draft file, no hash, no
 * request: nothing is saved until each part is confirmed.
 */
export function applyLogNewSolution(
  state: MemoryState,
  seat: string,
  jobId: string,
  payload: Record<string, unknown> | undefined,
  realNow: Date,
  wording?: AiOutcome<NewSolution>
): FlowResult {
  const job = memory.jobById(state, jobId);
  if (!job) return { ok: false, message: `There is no job called "${jobId}".` };
  const refusal = logNewSolutionRefusal(state, seat, job, payload, realNow);
  if (refusal) return { ok: false, message: refusal };

  const ask = solutionToWord(state, seat, job, payload);
  const key = newSolutionSpec(ask.pill, ask.fixLine, ask.whyLine, ask.place).key;
  const outcome = wording && wording.key === key ? wording : null;
  const value: NewSolution = outcome
    ? outcome.value
    : { ruleText: ask.fixLine, ruleTextFrom: "fix-line", suggestion: null, conditionFrom: "by-hand" };
  const rule = value.suggestion?.kind === "rule" ? value.suggestion : null;
  const note =
    value.suggestion?.kind === "note"
      ? { text: value.suggestion.text, label: value.suggestion.label, refusals: value.suggestion.refusals }
      : null;
  const effects = rule ? rule.condition.effects : [];
  const lead = foundLead(state, seat, job, realNow);
  const causeId = lead && lead !== "none" ? lead.causeId : job.foundLeadId ?? "";
  const at = stampNow(state, realNow);
  const aiCalls = outcome?.aiCalls ?? 0;

  const solution: Solution = {
    id: `S-${state.solutions.length + 1}`,
    jobId: job.id,
    status: "draft",
    causeId,
    fixLine: ask.fixLine,
    whyLine: ask.whyLine,
    flags: { fixLine: redWordFlags(ask.fixLine, ask.pill), whyLine: redWordFlags(ask.whyLine, ask.pill) },
    baseVersion: ask.place.version,
    version: nextVersion(ask.pill.version),
    loggedBy: seat,
    loggedAt: at,
    ai: {
      source: outcome?.source ?? "none",
      banner: outcome?.banner ?? null,
      notice: outcome?.notice ?? null,
      aiOff: outcome?.aiOff ?? null,
      aiCalls,
      note,
    },
    parts: [
      {
        id: "rule-text",
        suggested: value.ruleText,
        suggestedBy: value.ruleTextFrom === "ai" ? "ai" : "fix-line",
        value: null,
        confirmed: false,
      },
      { id: "fact", suggested: rule ? rule.condition.fact : null, suggestedBy: rule ? "ai" : null, value: null, confirmed: false },
      {
        id: "effect-1",
        suggested: effects[0] ? effectValue(effects[0]) : null,
        suggestedBy: effects[0] ? "ai" : null,
        value: null,
        confirmed: false,
      },
      {
        id: "effect-2",
        suggested: effects[1] ? effectValue(effects[1]) : null,
        suggestedBy: effects[1] ? "ai" : null,
        value: null,
        confirmed: false,
      },
    ],
  };

  state.solutions.push(solution);
  state.aiCalls = (state.aiCalls ?? 0) + aiCalls;
  job.status = "new-solution-drafted";

  pipCard(
    state,
    seat,
    job.id,
    `New solution drafted for job ${job.id}`,
    `Cause: ${causeLabel(causeId)}. Confirm each part with its own button: nothing is saved until each part is confirmed. Then Run tests, then Send to HQ (A2).`,
    `New solution · pill v${solution.baseVersion} · AI calls: ${aiCalls}`,
    at
  );
  return { ok: true, message: `New solution drafted for job ${job.id}: confirm each part.`, jobId: job.id };
}

// ---- confirm-part ----

type ConfirmPlan =
  | { ok: false; message: string }
  | {
      ok: true;
      solution: Solution;
      partId: PartId;
      value: string;
      /** The draft, when this confirm completes every part. */
      draft: { pill: Pill; yaml: string; hash: string; ruleId: string } | null;
    };

function solutionGate(state: MemoryState, job: Job): { ok: false; message: string } | { ok: true; solution: Solution } {
  const solution = currentSolution(state, job.id);
  if (!solution) return { ok: false, message: NO_SOLUTION };
  if (solution.status !== "draft") return { ok: false, message: WITH_HQ };
  return { ok: true, solution };
}

/** The confirmed parts as buildDraft reads them. */
function partsFor(solution: Solution, parts: SolutionPart[]) {
  const get = (id: PartId) => parts.find((p) => p.id === id)!.value ?? "";
  const effects = [get("effect-1"), get("effect-2")]
    .filter((v) => v !== "none" && v !== "")
    .map((v) => parseEffect(v))
    .filter((e): e is ConditionEffect => e !== null);
  return { fixLine: solution.fixLine, whyLine: solution.whyLine, ruleText: get("rule-text"), fact: get("fact"), effects };
}

function planConfirm(state: MemoryState, job: Job, payload: Record<string, unknown> | undefined): ConfirmPlan {
  const gate = solutionGate(state, job);
  if (!gate.ok) return gate;
  const solution = gate.solution;
  const partId = payload?.part as PartId;
  if (!PART_IDS.includes(partId)) {
    return { ok: false, message: 'Confirm one part: "rule-text", "fact", "effect-1" or "effect-2".' };
  }
  const raw = typeof payload?.value === "string" ? payload.value : "";
  const base = loadAndCheckPill("ts-cc", solution.baseVersion);
  let value: string;

  if (partId === "rule-text") {
    value = oneLine(raw);
    if (value.length === 0) return { ok: false, message: "The rule text cannot be empty." };
    const context = { tenant: job.tenant, building: job.building, floor: job.floor, seat: "senior-manager" };
    if (hideAmounts(value) !== value || scanNeverList(base, value, context).violated.length > 0) {
      return {
        ok: false,
        message: "The rule text may not quote a price, admit fault, name another tenant, building or floor, or write to the BMS (S13).",
      };
    }
  } else if (partId === "fact") {
    if (!(MENU_FACTS as readonly string[]).includes(raw)) {
      return { ok: false, message: `The fact "${raw}" is not on the menu: pick fit-out-12m, repeat or opposite-fixes.` };
    }
    value = raw;
  } else if (raw === "none") {
    if (partId === "effect-1") return { ok: false, message: "Effect 1 is needed: a rule has 1 or 2 effects." };
    value = raw;
  } else {
    const effect = parseEffect(raw);
    if (!effect) return { ok: false, message: "An effect is block or put-first on one checklist step, from the menu." };
    const refusals = effectRefusals(effect, base);
    if (refusals.length > 0) return { ok: false, message: refusals.join(" ") };
    value = raw;
  }

  const parts = solution.parts.map((p) => (p.id === partId ? { ...p, value, confirmed: true } : p));
  if (!parts.every((p) => p.confirmed)) return { ok: true, solution, partId, value, draft: null };

  const built = buildDraft(base, partsFor(solution, parts), new Date(solution.loggedAt));
  if (!built.ok) return { ok: false, message: built.refusals.join(" ") };
  const yaml = draftYaml(built.pill);
  return { ok: true, solution, partId, value, draft: { pill: built.pill, yaml, hash: draftHash(yaml), ruleId: built.rule.id } };
}

/** Why confirm-part is refused, or null. */
export function confirmPartRefusal(state: MemoryState, job: Job, payload: Record<string, unknown> | undefined): string | null {
  const plan = planConfirm(state, job, payload);
  return plan.ok ? null : plan.message;
}

/**
 * Confirm one part (S16 items 2 and 7). Once every part is confirmed, code
 * builds the draft from the confirmed parts and saves it in the runtime
 * folder, never in web/pills/. A confirm that changes the draft clears the
 * stored test run.
 */
export function applyConfirmPart(
  state: MemoryState,
  seat: string,
  jobId: string,
  payload: Record<string, unknown> | undefined,
  realNow: Date
): FlowResult {
  const job = memory.jobById(state, jobId);
  if (!job) return { ok: false, message: `There is no job called "${jobId}".` };
  const plan = planConfirm(state, job, payload);
  if (!plan.ok) return plan;

  const { solution, partId, value, draft } = plan;
  const at = stampNow(state, realNow);
  const part = solution.parts.find((p) => p.id === partId)!;
  part.value = value;
  part.confirmed = true;
  part.confirmedAt = at;

  const said = [`Confirmed: ${PART_TITLES[partId].toLowerCase()} (${partDisplay(partId, value)}).`];
  if (draft) {
    const dir = memory.runtimeDir();
    mkdirSync(dir, { recursive: true });
    const name = `${solution.id}-${draftFileName(draft.pill)}`;
    writeFileSync(join(dir, name), draft.yaml, "utf-8");
    const changed = solution.hash !== draft.hash;
    solution.draftFile = name;
    solution.hash = draft.hash;
    solution.ruleId = draft.ruleId;
    said.push(`Every part is confirmed: draft v${solution.version} saved (${draft.hash.slice(0, 7)}).`);
    if (changed && solution.testRun) {
      delete solution.testRun;
      said.push("The draft changed, so its test run was cleared.");
    }
  }
  void seat;
  return { ok: true, message: said.join(" "), jobId: job.id };
}

// ---- run-tests ----

/** Jobs R-01 ranks: every open job in the memory (S16 item 5). A job still in the self-check is not a call yet. */
const OPEN_FOR_R01: JobStatus[] = [
  "reported",
  "visit-booked",
  "in-progress",
  "escalated",
  "new-solution-drafted",
  "outside-help-requested",
];

/**
 * Run tests on the saved draft (S16 item 5), on a read: checkPill, the red
 * stops, every golden case and R-01, at the demo clock, over the open jobs in
 * the memory. The run keeps the hash it saw. Never writes.
 */
export function planRunTests(
  state: MemoryState,
  job: Job,
  realNow: Date
): { ok: false; message: string } | { ok: true; run: DraftTestRun } {
  const gate = solutionGate(state, job);
  if (!gate.ok) return gate;
  const solution = gate.solution;
  if (!solution.hash || !solution.draftFile) return { ok: false, message: NOT_SAVED };
  const path = join(memory.runtimeDir(), solution.draftFile);
  if (!existsSync(path)) return { ok: false, message: "The saved draft is missing: confirm a part again to save it." };
  const yaml = readFileSync(path, "utf-8");
  if (draftHash(yaml) !== solution.hash) {
    return { ok: false, message: "The saved draft does not match its hash: confirm a part again to save it." };
  }
  const openJobs = state.jobs.filter((j) => OPEN_FOR_R01.includes(j.status));
  return { ok: true, run: runDraftTests(yaml, { now: memory.now(state, realNow), openJobs }) };
}

export function runTestsRefusal(state: MemoryState, job: Job): string | null {
  const gate = solutionGate(state, job);
  if (!gate.ok) return gate.message;
  if (!gate.solution.hash || !gate.solution.draftFile) return NOT_SAVED;
  return null;
}

/** "23 passed, 0 failed, 2 not applicable". */
export function runCounts(run: Pick<DraftTestRun, "passed" | "failed" | "notApplicable">): string {
  return `${run.passed} passed, ${run.failed} failed, ${run.notApplicable} not applicable`;
}

/** Store a run made on a read. Refused when the draft changed in between. */
export function applyRunTests(state: MemoryState, seat: string, jobId: string, run: DraftTestRun, realNow: Date): FlowResult {
  const job = memory.jobById(state, jobId);
  if (!job) return { ok: false, message: `There is no job called "${jobId}".` };
  const gate = solutionGate(state, job);
  if (!gate.ok) return gate;
  const solution = gate.solution;
  if (solution.hash !== run.draftHash) return { ok: false, message: "The draft changed while the tests ran: run them again." };

  solution.testRun = run;
  const at = stampNow(state, realNow);
  const line = `${runCounts(run)} on draft v${run.version} · ${run.draftHash.slice(0, 7)}.`;
  pipCard(state, seat, job.id, `Tests on the new solution for job ${job.id}`, line, `Draft tests · pill v${run.version} · AI calls: 0`, at);
  return { ok: true, message: `Tests: ${line}`, jobId: job.id };
}

// ---- send-to-hq ----

/** Refused once the draft is with HQ. The run gate (sendToHqRefusal) lives in actions.ts. */
export function sentRefusal(state: MemoryState, jobId: string | undefined): string | null {
  return currentSolution(state, jobId)?.status === "sent-to-hq" ? WITH_HQ : null;
}

/**
 * Send to HQ (S2, S16 item 7): the gate has seen a stored run with 0 failed on
 * the draft's hash now. The solution goes to HQ with one notice; the job waits
 * on HQ's decision (A2). The draft is frozen for this seat.
 */
export function applySendToHq(state: MemoryState, seat: string, jobId: string, realNow: Date): FlowResult {
  const job = memory.jobById(state, jobId);
  if (!job) return { ok: false, message: `There is no job called "${jobId}".` };
  const gate = solutionGate(state, job);
  if (!gate.ok) return gate;
  const solution = gate.solution;
  const run = solution.testRun!;
  const at = stampNow(state, realNow);
  const hash7 = (solution.hash ?? "").slice(0, 7);

  solution.status = "sent-to-hq";
  solution.sentBy = seat;
  solution.sentAt = at;

  state.notices.push({
    seat: "hq",
    kind: "solution-sent",
    text: [
      `New solution for job ${job.id} sent to HQ (A2): ${job.buildingName}, Level ${job.floor}, ${job.zone}. Cause: ${causeLabel(solution.causeId)}.`,
      `Fix line: ${solution.fixLine}`,
      `Why line: ${solution.whyLine}`,
      `Draft v${solution.version} · ${hash7} · tests: ${runCounts(run)}.`,
      `Sent by ${seatLabel(seat)} · AI calls: 0`,
    ].join("\n"),
    at,
    jobId: job.id,
  });
  pipCard(
    state,
    seat,
    job.id,
    `Sent to HQ: job ${job.id}`,
    `Draft v${solution.version} · ${hash7} went to HQ with its tests (${runCounts(run)}). HQ approves or declines it (A2). Nothing goes live and no charge request opens before HQ approves.`,
    `New solution · pill v${solution.baseVersion} · AI calls: 0`,
    at
  );
  return { ok: true, message: `Job ${job.id}'s new solution went to HQ.`, jobId: job.id };
}

// ---- ask-outside-help (A3, cut 8) ----

/** Why Ask HQ for outside help is refused, or null (S17 A3). */
export function askOutsideHelpRefusal(payload: Record<string, unknown> | undefined): string | null {
  if (payload?.need !== "contractor" && payload?.need !== "budget") {
    return "Ask HQ needs what is needed: a contractor or budget.";
  }
  const reason = oneLine(payload?.reason);
  if (wordCount(reason) < 3) return "Ask HQ needs a reason of 3 words or more.";
  if (hideAmounts(reason) !== reason) {
    return "Leave the amount out: no amount goes in the text (S13), and HQ decides money (A3).";
  }
  if (typeof payload?.needsMoney !== "boolean") return "Say whether it needs money: yes or no.";
  return null;
}

/** Ask HQ for outside help (S17 A3): the request and a notice reach HQ; the job waits on HQ. */
export function applyAskOutsideHelp(
  state: MemoryState,
  seat: string,
  jobId: string,
  payload: Record<string, unknown> | undefined,
  realNow: Date
): FlowResult {
  const job = memory.jobById(state, jobId);
  if (!job) return { ok: false, message: `There is no job called "${jobId}".` };
  const refusal = askOutsideHelpRefusal(payload);
  if (refusal) return { ok: false, message: refusal };

  const at = stampNow(state, realNow);
  const need = payload!.need as "contractor" | "budget";
  const reason = oneLine(payload!.reason);
  const needsMoney = payload!.needsMoney as boolean;
  const count = (state.requests as { kind?: string }[]).filter((r) => r && r.kind === "A3").length;
  const request: OutsideHelpRequest = {
    id: `A3-${count + 1}`,
    kind: "A3",
    status: "open",
    seat: "hq",
    jobId: job.id,
    need,
    reason,
    needsMoney,
    askedBy: seat,
    openedAt: at,
  };
  state.requests.push(request);
  job.status = "outside-help-requested";

  const what = need === "contractor" ? "a contractor" : "budget";
  state.notices.push({
    seat: "hq",
    kind: "outside-help",
    text: [
      `Outside help asked for job ${job.id} (A3): ${what}. ${job.buildingName}, Level ${job.floor}, ${job.zone}.`,
      `Reason: ${reason}`,
      `Needs money: ${needsMoney ? "yes" : "no"}.`,
      `Asked by ${seatLabel(seat)} · AI calls: 0`,
    ].join("\n"),
    at,
    jobId: job.id,
  });
  pipCard(
    state,
    seat,
    job.id,
    `Asked HQ for outside help: job ${job.id}`,
    `${what}, needs money: ${needsMoney ? "yes" : "no"}. HQ approves or declines it (A3), and the job comes back to you either way.`,
    `Outside help · AI calls: 0`,
    at
  );
  return { ok: true, message: `Job ${job.id} waits for HQ's decision on outside help (A3).`, jobId: job.id };
}

// ---- clear-stop (S11, cut 6) ----

/** One open stop, named so a press can find it again. */
export function openStopKey(stop: OpenRedStop): string {
  return [stop.stopId, stop.building, stop.floor, stop.zone, stop.source, stop.openedAt].join("|");
}

/** True when the stop's who_to_call, read from the pill, names the Fire Safety Manager (RS-01 and RS-06 in v1.0). */
export function needsSafetyRecord(stop: RedStop): boolean {
  return /Fire Safety Manager/.test(stop.who_to_call);
}

function stopFor(state: MemoryState, payload: Record<string, unknown> | undefined): { open: OpenRedStop; def: RedStop } | null {
  const key = typeof payload?.stop === "string" ? payload.stop : "";
  const open = state.openRedStops.find((s) => s.clearedAt === null && openStopKey(s) === key);
  if (!open) return null;
  const def = livePill(state, open.building).red_stops.find((s) => s.id === open.stopId);
  return def ? { open, def } : null;
}

/** Why Clear stop is refused, or null: an open stop, a reason of 3 words or more, and the safety record where needed. */
export function clearStopRefusal(state: MemoryState, payload: Record<string, unknown> | undefined): string | null {
  const found = stopFor(state, payload);
  if (!found) return "There is no open red stop like that.";
  if (wordCount(oneLine(payload?.reason)) < 3) return "Clear stop needs a reason of 3 words or more.";
  if (needsSafetyRecord(found.def) && payload?.safetyRecord !== true) {
    return `This stop's who to call names the Fire Safety Manager: tick "${SAFETY_RECORD_LINE}" first. ${SAFETY_RECORD_NOTE}`;
  }
  return null;
}

/** Clear stop (S11): logged with who and when, and the safety record where needed. The jobs it locked unlock. */
export function applyClearStop(
  state: MemoryState,
  seat: string,
  payload: Record<string, unknown> | undefined,
  realNow: Date
): FlowResult {
  const refusal = clearStopRefusal(state, payload);
  if (refusal) return { ok: false, message: refusal };
  const { open, def } = stopFor(state, payload)!;
  const at = stampNow(state, realNow);
  const reason = hideAmounts(oneLine(payload!.reason));
  open.clearedBySeat = seat;
  open.clearedAt = at;
  open.clearedReason = reason;
  const record = needsSafetyRecord(def);
  if (record) open.safetyRecord = SAFETY_RECORD_LINE;

  const body = [
    `Cleared by ${seatLabel(seat)}, ${dayMonth(at)} ${at.slice(11, 16)}. Reason: ${reason}`,
    ...(record ? [`${SAFETY_RECORD_LINE}.`, SAFETY_RECORD_NOTE] : []),
  ].join(" ");
  const version = state.liveVersionByBuilding[open.building] ?? "1.0";
  pipCard(
    state,
    seat,
    open.jobId ?? undefined,
    `Red stop ${open.stopId} cleared on ${buildingName(open.building)}, Level ${open.floor}`,
    body,
    `Red stop ${open.stopId} · pill v${version} · AI calls: 0`,
    at
  );
  return { ok: true, message: `Red stop ${open.stopId} cleared.` };
}
