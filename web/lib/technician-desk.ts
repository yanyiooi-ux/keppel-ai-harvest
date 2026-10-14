/**
 * The technician's desk (S21, C7b): what the technician seat shows besides the
 * chat. Read only: it never writes the memory and never calls the AI.
 *
 * The job list for Tower A, then the job the technician opened last: its
 * filled checklist (place tag, calls at this spot in 30 days, the repeat flag,
 * past fixes with their outcome, the fit-out, the tenant's self-check answers,
 * the RS-08 trend card), the ranked leads from rank.ts, ruled out and removed,
 * and the pill steps with S21's filled values. A locked job shows only its red
 * cards and lock lines (S11).
 *
 * Every word comes from the pill, the data or the engine. The AI's rank
 * wording was made at the press (action-turn.ts) and is shown only under the
 * reason it worded: it is looked up by the replay key of the lead code ranks
 * now, so a stale line can never sit under a new reason.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { loadAndCheckPill, type Pill, type Colour } from "./pill";
import { leadsForJob, factsForJob } from "./leads";
import { callsForState } from "./calls";
import { casesFromTickets, type Case } from "./cases";
import { outcomeOf } from "./outcome";
import { repeatFlagFor, loadBuildings } from "./facts";
import { placeTag, spotKey } from "./places";
import { getRecentTickets, getActiveChecklist, type Ticket, type RepeatFlagResult } from "./rule-engine";
import { lockLineForStop } from "./safety";
import { formatTime, type Lead, type Tier } from "./rank";
import { mayPress } from "./permissions";
import { openStopsOnJob } from "./actions";
import { dayMonth, thirtyDayEnd, selfCheckLines } from "./technician-flow";
import { rankWordingSpec, AI_OFF_LABEL, type AiMode } from "./ai";
import * as memory from "./memory";
import type { MemoryState, Job, JobStatus } from "./memory";
import type { CardColour } from "./seat-view";

// ---- Shapes the screen reads ----

export interface DeskLine {
  text: string;
  /** A colour word, always printed next to its colour (S21). */
  word?: string;
  colour?: CardColour;
}

export interface DeskCard {
  id: string;
  from: string;
  title: string;
  body?: string;
  lines?: DeskLine[];
  colour?: CardColour;
  colourWord?: string;
  /** A red stop's who_to_call, shown after "Call:" (S11). */
  call?: string;
  /** How code caught it, for example the RS-08 trend line. */
  codeLine?: string;
  receipt: string;
}

export interface DeskLead {
  causeId: string;
  label: string;
  tier: Tier;
  /** The colour word for a lead is its tier name (S21). */
  tierWord: string;
  reason: string;
  checkStep: number;
  checkText: string;
  checkTime: string;
  fixLine: string;
  fixAllowedHere: boolean;
  tick: "found" | "not-this" | null;
  receipt: string;
  aiWording?: string;
  aiBanner?: string;
  aiNotice?: string;
  aiOff?: string;
  aiCalls: number;
}

export interface DeskRemoved {
  causeId: string;
  label: string;
  reason: string;
}

export interface DeskStep {
  step: number;
  section: string;
  text: string;
  who: string;
  colour: Colour;
  colourWord: string;
  /** S21's filled value, for steps 1, 2, 3, 9, 10 and 11 only. */
  filled?: string;
}

export interface OpenJobDesk {
  jobId: string;
  title: string;
  status: JobStatus;
  statusLine: string;
  /** Ticks and the Solved, Send with the cause and Not solved presses are offered only while in progress. */
  inProgress: boolean;
  /** A safety stop on the job's spot: only its red cards and lock lines show (S11). */
  locked: { cards: DeskCard[]; lockLines: string[] } | null;
  checklist: DeskCard[];
  note: string;
  leads: DeskLead[];
  ruledOut: DeskLead[];
  removed: DeskRemoved[];
  steps: DeskStep[];
}

export interface DeskJobRow {
  id: string;
  place: string;
  complaint: string;
  reported: string;
  status: JobStatus;
  canOpen: boolean;
  /** On the desk now. */
  isOpen: boolean;
  /** An in-progress job that is not on the desk: Show job brings it back (a view, no press). */
  canShow?: boolean;
}

export interface TechnicianDesk {
  title: string;
  jobs: DeskJobRow[];
  open: OpenJobDesk | null;
}

/** The technician's building (S21: "Job list for Tower A"). */
const TECHNICIAN_BUILDING = "tower-a";
const SEAT = "technician";

/**
 * The jobs that are the technician's to work on (S2 open-job, S3): waiting for
 * a visit or open. A job a tip closed is no job for the technician (T-C7a); the
 * job the technician opened stays listed whatever it moved to.
 */
const FOR_THE_TECHNICIAN: JobStatus[] = ["reported", "visit-booked", "in-progress"];

// ---- Small readers ----

interface TrendsFile {
  label: string;
  building: string;
  floor: number;
  zones: Record<
    string,
    { damperFullOpenHours?: string; damperFullOpenDays?: number; damperFullOpenOutOfDays?: number }
  >;
}

function loadTrends(): TrendsFile {
  return JSON.parse(readFileSync(join(process.cwd(), "data", "trends.json"), "utf-8")) as TrendsFile;
}

function fitOutMonths(job: Job): number | null {
  const floor = loadBuildings()
    .find((b) => b.id === job.building)
    ?.floors.find((f) => f.floor === job.floor);
  return floor ? floor.fitOutCompletedMonths : null;
}

/** The clock rule (S5): the job's report time plus 20 minutes. */
function clockFor(job: Job): Date {
  return new Date(new Date(job.reportedAt).getTime() + 20 * 60 * 1000);
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Step 10's line and the repeat card's title: the repeat flag with its count and rule. */
function repeatLine(repeat: RepeatFlagResult): string {
  const on = repeat.isRepeat ? "on" : "off";
  const opposite = repeat.hasOppositeFixes ? ", with opposite fixes" : "";
  return `Repeat flag ${on}: ${plural(repeat.count, "call", "calls")} in 30 days${opposite} (${repeat.relatedRuleIds.join(", ")})`;
}

/** S21's colour words for a pill step. */
function stepColourWord(colour: Colour, who: string): string {
  if (colour === "green") return "Do it";
  if (colour === "red") return "Stop";
  return /Asset Operations Manager|\bAOM\b/.test(who) ? "AOM decides" : "Senior manager's step";
}

function statusLine(status: JobStatus): string {
  switch (status) {
    case "in-progress":
      return "In progress: check the leads in order and tick each one, then Solved, Send with the cause or Not solved.";
    case "escalated":
      return "Escalated: with the senior manager, everything attached.";
    case "pending-30-day":
      return "Solved: it waits for its 30-day check.";
    default:
      return `Status: ${status.replace(/-/g, " ")}.`;
  }
}

function receipt(pill: Pill, what = "Code"): string {
  return `${what} · pill v${pill.version} · AI calls: 0`;
}

// ---- The filled checklist (S21) ----

function callsCard(job: Job, recent: Ticket[], pill: Pill): DeskCard {
  return {
    id: "calls",
    from: "Calls at this spot",
    title: `${plural(recent.length, "call", "calls")} at this spot in 30 days`,
    lines: recent.map((c) => {
      const changed = c.fix ? c.fix.note : c.id === job.id ? "this job, nothing changed yet" : "no change logged";
      return { text: `${dayMonth(c.reportedAt)} · ${c.id} · ${c.zone}, ${c.complaint}: ${changed}` };
    }),
    receipt: receipt(pill),
  };
}

/** S8's outcome of a past fix at the spot, with its colour word (S21: Won, Failed, Pending). */
function outcomeLine(c: Case, now: Date): DeskLine {
  const result = outcomeOf(c, now).outcome;
  const head = `${c.id} · ${dayMonth(c.closedAt)} · ${c.fix}`;
  if (result === "failed") return { text: `${head} · Failed: the spot called again`, word: "Failed", colour: "red" };
  if (result === "won") return { text: `${head} · Won: no repeat in 30 days`, word: "Won", colour: "green" };
  if (result === "unconfirmed") {
    return { text: `${head} · needs a second person to confirm the cause`, word: "Pending", colour: "amber" };
  }
  return { text: `${head} · pending, 30-day check until ${thirtyDayEnd(c.closedAt)}`, word: "Pending", colour: "amber" };
}

/** The fixes already tried at this spot: from closed tickets and from the cases saved at runtime. */
function pastFixes(state: MemoryState, job: Job, calls: Ticket[]): Case[] {
  const spot = spotKey(job);
  const reported = new Date(job.reportedAt).getTime();
  const fromTickets = casesFromTickets(calls).filter(
    (c) => c.id !== job.id && spotKey(c) === spot && new Date(c.closedAt).getTime() <= reported
  );
  const fromRuntime: Case[] = state.runtimeCases
    .filter((c) => c.jobId !== job.id && spotKey(c) === spot)
    .map((c) => {
      const next = calls
        .filter((t) => spotKey(t) === spot && new Date(t.reportedAt) > new Date(c.fixedAt))
        .sort((a, b) => new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime())[0];
      return {
        id: c.id,
        building: c.building,
        floor: c.floor,
        zone: c.zone,
        facts: c.facts ?? [],
        cause: c.causeId,
        fix: c.fix ?? c.causeId,
        why: c.why ?? "",
        fixedBy: c.fixedBy,
        confirmedBy: c.confirmedBy,
        closedAt: c.fixedAt,
        nextCallAt: next ? next.reportedAt : null,
      };
    });
  return [...fromTickets, ...fromRuntime].sort(
    (a, b) => new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime()
  );
}

/** RS-08 from trend data (S11): a card in the filled checklist of the trend file's floor. It locks nothing. */
function trendCards(job: Job, pill: Pill): DeskCard[] {
  const trends = loadTrends();
  if (trends.building !== job.building || trends.floor !== job.floor) return [];
  const stop = pill.red_stops.find((s) => s.id === "RS-08");
  if (!stop) return [];
  return Object.entries(trends.zones)
    .filter(([, zone]) => (zone.damperFullOpenDays ?? 0) > 0)
    .map(([name, zone], i) => ({
      id: i === 0 ? `trend-${stop.id}` : `trend-${stop.id}-${name}`,
      from: `${stop.id} · trend data`,
      title: stop.trigger,
      body: stop.action,
      call: stop.who_to_call,
      colour: "red" as const,
      colourWord: "Stop",
      codeLine: `Caught from trend data, no AI: the ${name} zone's VAV damper sat fully open ${zone.damperFullOpenHours ?? "for hours"} on ${zone.damperFullOpenDays} of ${zone.damperFullOpenOutOfDays ?? "?"} days (made up for the demo). It locks nothing.`,
      receipt: `Red stop ${stop.id} · pill v${pill.version} · AI calls: 0`,
    }));
}

function checklistCards(
  state: MemoryState,
  job: Job,
  pill: Pill,
  calls: Ticket[],
  recent: Ticket[],
  repeat: RepeatFlagResult,
  note: string,
  now: Date
): DeskCard[] {
  const tag = placeTag(job);
  const months = fitOutMonths(job);
  const past = pastFixes(state, job, calls);
  const answers = selfCheckLines(job);
  const selfCheck = [...answers, ...job.notes].map((text) => ({ text }));

  return [
    {
      id: "place",
      from: "Place tag",
      title: `${job.buildingName}, Level ${job.floor}, ${job.zone}`,
      body: `Equipment ${tag.equipment} · ${job.tenant} · ${job.complaint}, ${job.intake.when}`,
      receipt: receipt(pill),
    },
    callsCard(job, recent, pill),
    {
      id: "repeat",
      from: "Repeat flag",
      title: repeatLine(repeat),
      body: note,
      colour: repeat.isRepeat ? "amber" : "green",
      colourWord: repeat.isRepeat ? "Repeat" : "No repeat",
      receipt: receipt(pill),
    },
    {
      id: "past-fixes",
      from: "Past fixes at this spot",
      title: past.length > 0 ? plural(past.length, "past fix", "past fixes") : "No past fixes at this spot",
      lines: past.map((c) => outcomeLine(c, now)),
      receipt: receipt(pill),
    },
    {
      id: "fit-out",
      from: "Fit-out (building data)",
      title: months === null ? "No fit-out on record" : `Fit-out ${months} months ago`,
      body:
        months === null
          ? undefined
          : `Renovation in the last 12 months: ${months <= 12 ? "yes" : "no"} (buildings.json).`,
      receipt: receipt(pill),
    },
    {
      id: "self-check",
      from: "Tenant's self-check",
      title: answers.length > 0 ? "Self-check answers" : "No self-check on this job yet",
      lines: selfCheck,
      receipt: receipt(pill),
    },
    ...trendCards(job, pill),
  ];
}

// ---- The pill steps with S21's filled values ----

function filledValue(step: number, job: Job, recent: Ticket[], repeat: RepeatFlagResult): string | undefined {
  const a = job.selfCheckAnswers;
  const months = fitOutMonths(job);
  switch (step) {
    case 1:
      if (a.Q0 === "No") return "No safety signs reported by the tenant";
      if (a.Q0 === "Yes") return "The tenant reported a safety sign (self-check): follow the red stop";
      return "Not asked: no self-check on this job";
    case 2: {
      const intake = `Intake: ${job.intake.where}, ${job.intake.when}, ${job.intake.sinceWhen}.`;
      if (a.Q1 === undefined) return intake;
      return `Tenant: ${a.Q1}, ${a.Q2 ?? "not asked"}, happened before: ${a.Q3 ?? "not asked"}. ${intake}`;
    }
    case 3:
      return months === null ? undefined : `Fit-out ${months} months ago (building data)`;
    case 9:
      return `${plural(recent.length, "call", "calls")} at this spot in 30 days: ${recent.map((c) => c.id).join(", ")}`;
    case 10:
      return repeatLine(repeat);
    case 11:
      return months === null ? undefined : `Fit-out ${months} months ago: pull the fit-out file`;
    default:
      return undefined;
  }
}

// ---- Leads, with the rank wording made at the press ----

/** One ranked lead as a desk shows it, with the rank wording kept at the press. HQ's Building B card reads it too (C8b). */
export function deskLead(
  lead: Lead,
  job: Job,
  pill: Pill,
  state: MemoryState,
  mode: AiMode | undefined,
  worded: boolean,
  seat: string
): DeskLead {
  const tick = job.ticks.find((t) => t.causeId === lead.causeId)?.type ?? null;
  const out: DeskLead = {
    causeId: lead.causeId,
    label: lead.label,
    tier: lead.tier,
    tierWord: lead.tier.replace(/-/g, " "),
    reason: lead.reason,
    checkStep: lead.checkStep,
    checkText: lead.checkText,
    checkTime: formatTime(lead.checkMinutes),
    fixLine: lead.fixRoute,
    fixAllowedHere: lead.fixAllowedHere,
    tick,
    receipt: `Lead · pill v${pill.version} · AI calls: 0`,
    aiCalls: 0,
  };
  if (!worded) return out;
  if (mode === "off") return { ...out, aiOff: AI_OFF_LABEL };

  const key = rankWordingSpec(pill, lead, { seat, version: pill.version, job }).key;
  const stored = state.leadWordings?.[key];
  if (!stored) return out;
  out.aiCalls = stored.aiCalls;
  out.receipt = `Lead · pill v${pill.version} · AI calls: ${stored.aiCalls}`;
  if (stored.aiWording) out.aiWording = stored.aiWording;
  if (stored.banner) out.aiBanner = stored.banner;
  if (stored.notice) out.aiNotice = stored.notice;
  return out;
}

// ---- The open job ----

function lockedView(state: MemoryState, job: Job, pill: Pill): OpenJobDesk["locked"] {
  const stops = openStopsOnJob(state, job);
  if (stops.length === 0) return null;
  const cards: DeskCard[] = [];
  const lockLines: string[] = [];
  for (const open of stops) {
    const stop = pill.red_stops.find((s) => s.id === open.stopId);
    if (!stop) continue;
    cards.push({
      id: `lock-${stop.id}`,
      from: stop.id,
      title: stop.trigger,
      body: stop.action,
      call: stop.who_to_call,
      colour: "red",
      colourWord: "Stop",
      receipt: `Red stop ${stop.id} · pill v${pill.version} · AI calls: 0`,
    });
    const line = lockLineForStop(stop.id, pill);
    if (line && !lockLines.includes(line)) lockLines.push(line);
  }
  return { cards, lockLines };
}

/**
 * One job on a desk: its filled checklist, its ranked leads and the pill steps,
 * through one seat's eyes. The technician's desk uses it, and so does the
 * senior manager's (C8a: the same filled checklist, its own ranked list).
 */
export function openJobDesk(
  state: MemoryState,
  job: Job,
  realNow: Date,
  mode: AiMode | undefined,
  seat: string = SEAT
): OpenJobDesk {
  const pill = loadAndCheckPill("ts-cc", state.liveVersionByBuilding[job.building] ?? "1.0");
  const base = {
    jobId: job.id,
    title: `Job ${job.id} · ${job.buildingName}, Level ${job.floor}, ${job.zone}`,
    status: job.status,
    statusLine: statusLine(job.status),
    inProgress: job.status === "in-progress",
  };

  const locked = lockedView(state, job, pill);
  if (locked) {
    return { ...base, locked, checklist: [], note: "", leads: [], ruledOut: [], removed: [], steps: [] };
  }

  const calls = callsForState(state);
  const repeat = repeatFlagFor(job as Ticket, calls);
  const recent = getRecentTickets(calls, job.building, job.floor, job.tenant, 30, clockFor(job)).sort(
    (a, b) => new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime()
  );
  const facts = factsForJob(state, job);
  const active = getActiveChecklist(pill, {
    repeatFlag: repeat,
    redStop: { isRed: false, id: "", trigger: "", action: "", whoToCall: "", relatedRuleIds: [] },
    canNudgeResult: { allowed: !repeat.isRepeat, reason: "", ruleIds: [] },
    facts,
  });

  const rank = leadsForJob(state, job, seat, realNow);
  const now = memory.now(state, realNow);

  return {
    ...base,
    locked: null,
    checklist: checklistCards(state, job, pill, calls, recent, repeat, active.note, now),
    note: active.note,
    leads: rank.leads.map((lead) => deskLead(lead, job, pill, state, mode, true, seat)),
    ruledOut: rank.ruledOut.map((lead) => deskLead(lead, job, pill, state, mode, false, seat)),
    removed: rank.removed.map((r) => ({ causeId: r.causeId, label: r.label, reason: r.reason })),
    steps: active.steps.map((s) => {
      const step: DeskStep = {
        step: s.step,
        section: s.section,
        text: s.text,
        who: s.who,
        colour: s.colour,
        colourWord: stepColourWord(s.colour, s.who),
      };
      const filled = filledValue(s.step, job, recent, repeat);
      if (filled !== undefined) step.filled = filled;
      return step;
    }),
  };
}

/**
 * The technician seat's desk. `mode` is where the AI switch stands: on Off the
 * leads carry the "AI off" label and no AI line (S15).
 *
 * The desk shows the job the technician opened last (S2's home spot), or
 * `show`, another Tower A job the technician has open (in progress), so a
 * second Open job never leaves the first one out of reach. Showing is a view
 * only: it writes nothing, and every press still goes through the server's gate.
 */
export function technicianDesk(
  state: MemoryState,
  realNow: Date = new Date(),
  mode?: AiMode,
  show?: string
): TechnicianDesk {
  const openId = state.openJobBySeat?.[SEAT];
  const asked = show ? memory.jobById(state, show) : undefined;
  const shownId =
    asked && asked.building === TECHNICIAN_BUILDING && (asked.status === "in-progress" || asked.id === openId)
      ? asked.id
      : openId;
  const jobs = state.jobs
    .filter((j) => j.building === TECHNICIAN_BUILDING && (FOR_THE_TECHNICIAN.includes(j.status) || j.id === openId))
    .sort((a, b) => a.id.localeCompare(b.id));
  const open = shownId ? memory.jobById(state, shownId) : undefined;

  return {
    title: "Jobs in Tower A",
    jobs: jobs.map((j) => ({
      id: j.id,
      place: `Level ${j.floor}, ${j.zone}`,
      complaint: j.complaint,
      reported: `${dayMonth(j.reportedAt)}, ${j.reportedAt.slice(11, 16)}`,
      status: j.status,
      canOpen: mayPress(SEAT, "open-job", j.status).allowed,
      isOpen: open?.id === j.id,
      canShow: open?.id !== j.id && (j.status === "in-progress" || j.id === openId),
    })),
    open: open ? openJobDesk(state, open, realNow, mode) : null,
  };
}
