/**
 * The tenant's self-check on the shared memory (S10), with speak first (S6) and
 * the A4 opening (S17).
 *
 * `report` makes a job in `self-check` and asks Q0. Each `answer` stores the
 * answer and asks the next question, or ends the self-check: Q0 Yes opens the
 * Safety list; otherwise the answers attach to an open job at the same spot
 * (2318 in the demo) or the self-check job becomes the new job (2319), and the
 * tenant gets the reply S10 names. Only buttons get here (S19).
 *
 * Code makes every reply: the code line and the tips word for word, in S10
 * order, always on screen. The AI's tenant-reply is only an extra "AI wording"
 * line, worded before memory.update and never inside it (S20), and used only
 * when its replay key is the key of the reply code makes here.
 */

import { loadAndCheckPill, type Pill, type TenantTip } from "./pill";
import type { Ticket } from "./rule-engine";
import { loadPlaces, allCalls } from "./places";
import { loadBuildings, repeatFlagFor } from "./facts";
import { callsForState, postSpeakFirst } from "./calls";
import { safetyListCard } from "./chat";
import { alertSeatFor } from "./permissions";
import { tenantReplySpec, type AiOutcome, type AiPlace, type TenantReply } from "./ai";
import * as memory from "./memory";
import type { MemoryState, Job, JobStatus } from "./memory";
import {
  COMPLAINTS,
  ZONE_BY_PLACE,
  THERMOSTAT_NOTE,
  questionById,
  nextQuestion,
  outcomeFor,
  tipsFor,
  replyText,
  replyRuleIds,
  whyFor,
  chargeRequestText,
  type SelfCheckQuestion,
  type SelfCheckOutcome,
  type QuestionId,
} from "./self-check";

export interface FlowResult {
  ok: boolean;
  message: string;
  jobId?: string;
}

/** The tenant seat's home spot (S2). Its tenant and building name come from buildings.json. */
export const TENANT_HOME = { building: "tower-a", floor: 23 };

/** A self-check question in the chat, with its answer buttons until it is answered. */
export interface QuestionCard {
  kind: "question";
  questionId: QuestionId;
  jobId: string;
  title: string;
  answers: string[];
  answered?: string;
  receipt: string;
}

/** The tenant's reply card: the code text always, the AI's wording only as an extra line. */
export interface TenantReplyCard {
  kind: "tenant-reply";
  jobId: string;
  body: string;
  tips: string[];
  receipt: string;
  aiJob: "tenant-reply";
  aiCalls: number;
  aiWording?: string;
  aiBanner?: string;
  aiNotice?: string;
  aiOff?: string;
}

/** An A4 charge request (S17). It names no amount: the AOM types one only when deciding. */
export interface ChargeRequest {
  id: string;
  kind: "A4";
  status: "open";
  seat: string;
  jobId: string;
  tenant: string;
  building: string;
  floor: number;
  text: string;
  openedAt: string;
}

/** The statuses a self-check outcome may move a job from (the self-check job, or one nobody has started on). */
const MOVES_FROM: Record<"visit-booked" | "pending-30-day", JobStatus[]> = {
  "visit-booked": ["self-check", "reported"],
  "pending-30-day": ["self-check", "reported", "visit-booked"],
};

/** Jobs a report can attach to: open, and not the self-check itself (S10 "an open job"). */
const OPEN_STATUSES: JobStatus[] = [
  "reported",
  "visit-booked",
  "in-progress",
  "escalated",
  "new-solution-drafted",
  "outside-help-requested",
];

// ---- Time, ids and names ----

const SG_OFFSET_MS = 8 * 60 * 60 * 1000;

/** A demo-clock time as the data writes it: "2026-10-06T10:00:00+08:00". */
export function sgStamp(at: Date): string {
  const iso = new Date(at.getTime() + SG_OFFSET_MS).toISOString();
  return `${iso.slice(0, 19)}+08:00`;
}

function sgHour(at: Date): number {
  return new Date(at.getTime() + SG_OFFSET_MS).getUTCHours();
}

function timeOfDayFor(hour: number): string {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

/** The next free id in a building's series: one above the highest call or job there (2319 for Tower A). */
export function nextFreeId(state: MemoryState, building: string): string {
  const ids = allCalls({ tickets: state.jobs })
    .filter((t) => t.building === building)
    .map((t) => Number(t.id))
    .filter((n) => Number.isFinite(n));
  return String(ids.length > 0 ? Math.max(...ids) + 1 : 1);
}

function homeNames(): { buildingName: string; tenant: string } {
  const building = loadBuildings().find((b) => b.id === TENANT_HOME.building);
  const floor = building?.floors.find((f) => f.floor === TENANT_HOME.floor);
  if (!building || !floor) throw new Error("buildings.json has no tenant home spot");
  return { buildingName: building.name, tenant: floor.tenant };
}

function livePill(state: MemoryState, building: string): Pill {
  return loadAndCheckPill("ts-cc", state.liveVersionByBuilding[building] ?? "1.0");
}

function questionCard(question: SelfCheckQuestion, jobId: string, pill: Pill): QuestionCard {
  return {
    kind: "question",
    questionId: question.id,
    jobId,
    title: question.text,
    answers: [...question.answers],
    receipt: `Self-check · pill v${pill.version} · AI calls: 0`,
  };
}

function runningSelfCheck(state: MemoryState, tenant: string): Job | undefined {
  return state.jobs.find(
    (j) =>
      j.status === "self-check" &&
      j.tenant === tenant &&
      j.building === TENANT_HOME.building &&
      j.floor === TENANT_HOME.floor
  );
}

// ---- report ----

/** Why a report is refused, or null. Reads the memory, never writes it. */
export function reportRefusal(state: MemoryState, payload: Record<string, unknown> | undefined): string | null {
  const complaint = payload?.complaint;
  if (!COMPLAINTS.includes(complaint as (typeof COMPLAINTS)[number])) {
    return 'Pick "Too cold" or "Too hot".';
  }
  const running = runningSelfCheck(state, homeNames().tenant);
  if (running) return `Answer the questions on job ${running.id} first.`;
  return null;
}

/**
 * Report a problem (S2 `report`): a job in `self-check` with the next free id,
 * reported now on the demo clock, and the Q0 card. Call it inside memory.update.
 */
export function startReport(
  state: MemoryState,
  seat: string,
  payload: Record<string, unknown> | undefined,
  now: Date
): FlowResult {
  const refusal = reportRefusal(state, payload);
  if (refusal) return { ok: false, message: refusal };

  const complaint = String(payload!.complaint);
  const { buildingName, tenant } = homeNames();
  const id = nextFreeId(state, TENANT_HOME.building);
  const reportedAt = sgStamp(now);
  const hour = sgHour(now);
  const calls = callsForState(state);

  const job: Job = {
    id,
    label: "made up for the demo",
    building: TENANT_HOME.building,
    buildingName,
    floor: TENANT_HOME.floor,
    tenant,
    zone: "unknown",
    complaint,
    timeOfDay: timeOfDayFor(hour),
    complaintHour: reportedAt.slice(11, 16),
    reportedAt,
    intake: { where: "not asked yet", when: `reported at ${reportedAt.slice(11, 16)}`, sinceWhen: "not asked yet" },
    fix: null,
    status: "self-check",
    previousChangesOnFloor: calls.some(
      (c) => c.building === TENANT_HOME.building && c.floor === TENANT_HOME.floor && c.fix !== null
    ),
    ticks: [],
    selfCheckAnswers: {},
    foundLeadId: null,
    whyLine: null,
    fixerSeat: null,
    impact: null,
    notes: [],
  };
  state.jobs.push(job);

  const q0 = questionById("Q0")!;
  state.messages.push({ seat, from: "person", text: `Report a problem: ${complaint}`, at: reportedAt });
  state.messages.push({ seat, from: "pip", text: q0.text, at: reportedAt, cards: [questionCard(q0, id, livePill(state, job.building))] });

  return { ok: true, message: `Self-check started on job ${id}.`, jobId: id };
}

// ---- answer ----

/** How a finished self-check ends: the outcome, where it lands, and the reply code makes. */
export interface SelfCheckEnd {
  outcome: SelfCheckOutcome;
  /** The open job the answers attach to, or null for a new job. */
  attachTo: Job | null;
  pill: Pill;
  tips: TenantTip[];
  codeLine: string;
  lines: string[];
  /** Where the tenant reply is about: seat tenant, the live version, the job it lands on. Never sent to the AI. */
  place: AiPlace;
}

export type AnswerPlan =
  | { ok: false; message: string }
  | {
      ok: true;
      job: Job;
      question: SelfCheckQuestion;
      answer: string;
      answers: Record<string, string>;
      next: SelfCheckQuestion | null;
      end: SelfCheckEnd | null;
    };

function attachTarget(state: MemoryState, job: Job): Job | undefined {
  return state.jobs.find(
    (j) =>
      j.id !== job.id &&
      OPEN_STATUSES.includes(j.status) &&
      j.tenant === job.tenant &&
      j.building === job.building &&
      j.floor === job.floor &&
      j.zone === job.zone
  );
}

/**
 * What an answer does, worked out from the memory without writing it: the
 * refusal, or the next question, or how the self-check ends.
 */
export function planAnswer(
  state: MemoryState,
  jobId: string,
  payload: Record<string, unknown> | undefined
): AnswerPlan {
  const job = memory.jobById(state, jobId);
  if (!job || job.status !== "self-check") return { ok: false, message: "This self-check is already over." };

  const ctx = { complaint: job.complaint, reportedAt: job.reportedAt, acHours: loadPlaces().acHours };
  const due = nextQuestion(job.selfCheckAnswers, ctx);
  const question = due ? questionById(due) : undefined;
  if (!question) return { ok: false, message: "This self-check is already over." };
  if (payload?.questionId !== question.id) {
    return { ok: false, message: `That question is already answered. Now: ${question.text}` };
  }
  const answer = String(payload?.answer ?? "");
  if (!question.answers.includes(answer)) return { ok: false, message: "Pick one of the answers shown." };

  const answers = { ...job.selfCheckAnswers, [question.id]: answer };
  const nextId = nextQuestion(answers, ctx);
  if (nextId) return { ok: true, job, question, answer, answers, next: questionById(nextId)!, end: null };

  // The self-check is over. Where it lands decides the repeat flag that picks the tips.
  const shaped: Job = {
    ...job,
    zone: answers.Q1 ? ZONE_BY_PLACE[answers.Q1] : job.zone,
    selfCheckAnswers: answers,
  };
  const pill = livePill(state, job.building);
  const attachTo = answers.Q0 === "Yes" ? null : attachTarget(state, shaped) ?? null;
  const lands = attachTo ?? shaped;
  const calls = attachTo ? callsForState(state) : [...callsForState(state), { ...shaped, status: "visit-booked" } as Ticket];
  const outcome = outcomeFor(answers, repeatFlagFor(lands as Ticket, calls).isRepeat);
  const tips = tipsFor(pill, outcome);
  const { codeLine, lines } = replyText(outcome, tips);
  return {
    ok: true,
    job,
    question,
    answer,
    answers,
    next: null,
    end: {
      outcome,
      attachTo,
      pill,
      tips,
      codeLine,
      lines,
      place: { seat: "tenant", version: pill.version, job: lands },
    },
  };
}

/** The tenant reply the AI may word, or null when the self-check does not end with tips. */
export function replyToWord(plan: AnswerPlan): SelfCheckEnd | null {
  if (!plan.ok || !plan.end || plan.end.outcome.kind === "safety" || plan.end.tips.length === 0) return null;
  return plan.end;
}

function eachCard(state: MemoryState, fn: (card: Record<string, unknown>) => void): void {
  for (const message of state.messages) {
    for (const card of (message.cards ?? []) as Record<string, unknown>[]) fn(card);
  }
}

function replyCard(end: SelfCheckEnd, jobId: string, wording: AiOutcome<TenantReply> | undefined): TenantReplyCard {
  const aiCalls = wording?.aiCalls ?? 0;
  const card: TenantReplyCard = {
    kind: "tenant-reply",
    jobId,
    body: end.lines.join(" "),
    tips: end.tips.map((t) => t.text),
    receipt: `${replyRuleIds(end.tips).join(", ")} · pill v${end.pill.version} · AI calls: ${aiCalls}`,
    aiJob: "tenant-reply",
    aiCalls,
  };
  if (wording?.value.aiWording) card.aiWording = wording.value.aiWording;
  if (wording?.banner) card.aiBanner = wording.banner;
  if (wording?.notice) card.aiNotice = wording.notice;
  if (wording?.aiOff) card.aiOff = wording.aiOff;
  return card;
}

/**
 * Store one answer and do what it leads to (S10). Call it inside memory.update;
 * it plans again on the memory it is given, so a press that raced another one
 * is refused rather than applied twice. `wording` is the AI's tenant-reply,
 * worded before the update; it is used only when its key is this reply's key.
 */
export function applyAnswer(
  state: MemoryState,
  seat: string,
  jobId: string,
  payload: Record<string, unknown> | undefined,
  now: Date,
  wording?: AiOutcome<TenantReply>
): FlowResult {
  const plan = planAnswer(state, jobId, payload);
  if (!plan.ok) return plan;

  const stamp = sgStamp(now);
  const { job, question, answer, answers } = plan;

  eachCard(state, (card) => {
    if (card.kind === "question" && card.jobId === job.id && card.questionId === question.id && card.answered === undefined) {
      card.answered = answer;
    }
  });
  state.messages.push({ seat, from: "person", text: answer, at: stamp });

  job.selfCheckAnswers = answers;
  if (question.id === "Q1") {
    job.zone = ZONE_BY_PLACE[answer];
    job.intake.where = answer.toLowerCase();
  }
  if (question.id === "Q2") job.intake.sinceWhen = answer.toLowerCase();

  if (plan.next) {
    state.messages.push({
      seat,
      from: "pip",
      text: plan.next.text,
      at: stamp,
      cards: [questionCard(plan.next, job.id, livePill(state, job.building))],
    });
    return { ok: true, message: `Answer saved. Next: ${plan.next.text}`, jobId: job.id };
  }

  const end = plan.end!;

  // 1. Q0 Yes: the Safety list (S11), no more questions; the job stays reported.
  if (end.outcome.kind === "safety") {
    job.status = "reported";
    state.messages.push({
      seat,
      from: "pip",
      text: "Safety first",
      at: stamp,
      cards: [{ ...safetyListCard(end.pill), jobId: job.id }],
    });
    postSpeakFirst(state, [job], now, stamp);
    return { ok: true, message: "Safety first: pick what you see from the list.", jobId: job.id };
  }

  // Attach, do not duplicate: the answers go to the open job, and the self-check job goes.
  let target = job;
  if (end.attachTo) {
    target = memory.jobById(state, end.attachTo.id)!;
    target.selfCheckAnswers = { ...answers };
    eachCard(state, (card) => {
      if (card.jobId === job.id) card.jobId = target.id;
    });
    state.jobs = state.jobs.filter((j) => j.id !== job.id);
  }

  const status = end.outcome.kind === "visit" ? "visit-booked" : "pending-30-day";
  if (MOVES_FROM[status].includes(target.status)) {
    target.status = status;
    const why = whyFor(end.outcome);
    if (why) target.whyLine = why;
  }
  if (end.outcome.kind === "visit" && end.outcome.thermostatNote && !target.notes.includes(THERMOSTAT_NOTE)) {
    target.notes.push(THERMOSTAT_NOTE);
  }

  // 3. After hours Yes: the A4 request for the AOM (S17). No amount, ever.
  if (end.outcome.kind === "after-hours") {
    const request: ChargeRequest = {
      id: `A4-${state.requests.length + 1}`,
      kind: "A4",
      status: "open",
      seat: alertSeatFor("aom", target.building),
      jobId: target.id,
      tenant: target.tenant,
      building: target.building,
      floor: target.floor,
      text: chargeRequestText(target.tenant, target.floor),
      openedAt: stamp,
    };
    state.requests.push(request);
    state.notices.push({ seat: request.seat, kind: "charge-request", text: request.text, at: stamp, jobId: target.id });
  }

  // Speak first runs either way (S6): once per spot in 30 days, so 2318 gets no second notice.
  postSpeakFirst(state, [target], now, stamp);

  // The AI's wording counts only when it worded exactly this reply.
  const fits = wording !== undefined && wording.key === tenantReplySpec(end.pill, end.tips, end.codeLine, { ...end.place, job: target }).key;
  const card = replyCard(end, target.id, fits ? wording : undefined);
  state.messages.push({ seat, from: "pip", text: card.body, at: stamp, cards: [card] });
  state.aiCalls = (state.aiCalls ?? 0) + (wording?.aiCalls ?? 0);

  const said =
    end.outcome.kind === "visit"
      ? `Visit booked on job ${target.id}.`
      : `Tip sent, no visit. Job ${target.id} waits for its 30-day check.`;
  return { ok: true, message: said, jobId: target.id };
}
