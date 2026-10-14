/**
 * The judges' page /how (S22, C10a): what it shows, worked out from the data,
 * the pill, the engine and the one memory. Plain code, 0 AI.
 *
 * WHY is the Level 23 story from tickets.json (every date and number from the
 * tickets, buildings.json and trends.json) and the impact meter (S18) on the
 * same calls the AOM seat reads. WHAT is the 5 seats around one brain, who
 * approves what (A1 to A4) and S22's static "who passes what to whom" list.
 * HOW is code decides, the AI words, people approve; the 30-day rule; the 4
 * ranking steps; the safety stops read from the live pill; the AI's part in a
 * new solution; the brief's 8 questions. The live wall gets the 5 real seat
 * views, AOM Tower A first, and the demo steps as text.
 *
 * Nothing here writes the memory or calls the AI.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { loadTickets, type Ticket } from "./rule-engine";
import { loadBuildings, type Building } from "./facts";
import { loadImpactRates, type ImpactRates } from "./impact-rates";
import { impactFor, runOfCalls, type ImpactMeter } from "./impact";
import { loadCauses } from "./causes";
import { loadCases } from "./cases";
import { loadAndCheckPill } from "./pill";
import { safetyList } from "./safety";
import { SELF_CHECK_QUESTIONS } from "./self-check";
import { CHARGE_CHOICES } from "./charge-flow";
import { PART_TITLES, partDisplay } from "./senior-manager-flow";
import { SEAT_IDS, SEAT_LABELS, ACTION_RULES, type SeatId } from "./permissions";
import { openingLineFor } from "./seat-opening";
import { seatView, type SeatView } from "./seat-view";
import { dayMonth } from "./technician-flow";
import { AOM_SPOT } from "./aom-desk";
import { BUILDING_B_JOB_ID } from "./hq-desk";
import { BASE_VERSION } from "./versions";
import type { AiMode } from "./ai-mode";
import type { MemoryState } from "./memory";

// ---- Fixed lines (S22) ----

/** The footer, word for word (S22). */
export const CLOSE_LINE =
  "The checklist finds it faster, people approve only what matters, and every fix makes the next one faster.";

/** S22: one line says the seats are role-played with no login and all data is made up. */
export const ROLE_PLAYED_LINE =
  "Seats are role-played with no login, so anyone can open any seat and act as HQ. All buildings, tenants, tickets, cases, amounts and signatures are made up for the demo.";

/** S22: one line on the AI's part in a new solution (S16 item 2). */
export const AI_NEW_SOLUTION_LINE =
  "In a new solution the AI drafts the rule text and suggests the fact and effects from the fixed code menu; the senior manager confirms each part with its own button.";

/** The live wall's order (S22): AOM Tower A first, then the rest in S2 order. */
export const LIVE_ORDER: readonly SeatId[] = ["aom-tower-a", "tenant", "technician", "senior-manager", "hq"];

/** S22's static "who passes what to whom" list, in its own order. */
export const PASSES: { from: string; to: string; what: string }[] = [
  { from: "Tenant", to: "technician", what: "visit booked" },
  { from: "Technician", to: "senior manager", what: "not solved, with everything attached" },
  { from: "Senior manager", to: "HQ", what: "new solution, with its tests" },
  { from: "HQ", to: "every building", what: "approved version" },
  { from: "AOM", to: "tenant", what: "charge decision" },
];

/** The short seat names the top bar uses, for the demo steps. */
const SEAT_SHORT: Record<SeatId, string> = {
  tenant: "Tenant",
  technician: "Technician",
  "senior-manager": "Senior manager",
  hq: "HQ",
  "aom-tower-a": "AOM Tower A",
};

/** The job each seat page opens on (app/seat/[name]/page.tsx): the AOM has none of its own. */
const SEAT_JOB = "2318";

// ---- Sources ----

interface TrendsFile {
  label: string;
  building: string;
  floor: number;
  zones: Record<string, { description?: string }>;
}

export interface HowSources {
  tickets: Ticket[];
  buildings: Building[];
  trends: TrendsFile;
  rates: ImpactRates;
}

/** The data files, read at request time (S0 rule 10). Tests pass a temp copy of any of them. */
export function loadHowSources(): HowSources {
  return {
    tickets: loadTickets(),
    buildings: loadBuildings(),
    trends: JSON.parse(readFileSync(join(process.cwd(), "data", "trends.json"), "utf-8")) as TrendsFile,
    rates: loadImpactRates(),
  };
}

/**
 * The calls on the memory: the given tickets plus the jobs created at runtime,
 * the same set callsForState builds from tickets.json, so the meter here and
 * on the AOM seat always agree.
 */
export function callsWith(state: MemoryState, tickets: Ticket[]): Ticket[] {
  const ids = new Set(tickets.map((t) => t.id));
  const runtime = state.jobs.filter((j) => !ids.has(j.id) && j.status !== "self-check") as Ticket[];
  return [...tickets, ...runtime];
}

// ---- WHY: the story ----

export interface WhyCall {
  id: string;
  /** "15 Sep", Singapore time. */
  date: string;
  reportedAt: string;
  zone: string;
  /** The intake's words: "open area near the lift core". */
  where: string;
  /** The intake's words: "mornings, around 9am". */
  when: string;
  complaint: string;
  /** The fix note, word for word, or null while the call is open. */
  fixNote: string | null;
  /** The fix was a turn of the dial (a setpoint change). */
  dialTurn: boolean;
  status: "came-back" | "open" | "stayed-fixed";
  /** A status always carries its word (S21). */
  statusWord: "Came back" | "Still open" | "No call since";
  /** The next call at the spot within 30 days, when there is one. */
  next: { id: string; date: string } | null;
}

export interface WhyPattern {
  complaint: string;
  where: string;
  when: string;
  ids: string[];
}

export interface WhyStory {
  spotKey: string;
  /** "Tower A Level 23". */
  place: string;
  tenant: string;
  calls: WhyCall[];
  /** Whole calendar days in Singapore time, first call to last. */
  days: number;
  dialTurns: number;
  openIds: string[];
  /** No closed call stayed fixed. */
  neverFixed: boolean;
  patterns: WhyPattern[];
  fitOutMonths: number | null;
  leaseEndsInMonths: number | null;
  /** What the trend data shows at the open call's zone, word for word from trends.json. */
  causeLine: string | null;
  headline: string;
  summary: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const SG_OFFSET_MS = 8 * 60 * 60 * 1000;

function sgDay(at: string): number {
  return Math.floor((new Date(at).getTime() + SG_OFFSET_MS) / DAY_MS);
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * The Level 23 story (S22 WHY), worked out from the tickets it is given: the
 * spot's run of calls (the same run the impact meter replays), each call's
 * date, words and fix, whether the spot called again, and the totals. Pure:
 * it reads only what it is given. Null when the spot has no calls.
 */
export function whyStory(
  tickets: Ticket[],
  buildings: Building[],
  trends: TrendsFile,
  spotKey: string = AOM_SPOT
): WhyStory | null {
  const run = runOfCalls(spotKey, tickets);
  if (run.length === 0) return null;

  const calls: WhyCall[] = run.map((t, i) => {
    const after = run[i + 1];
    const next = after ? { id: after.id, date: dayMonth(after.reportedAt) } : null;
    const status: WhyCall["status"] = t.fix === null ? "open" : next ? "came-back" : "stayed-fixed";
    return {
      id: t.id,
      date: dayMonth(t.reportedAt),
      reportedAt: t.reportedAt,
      zone: t.zone,
      where: t.intake.where,
      when: t.intake.when,
      complaint: t.complaint,
      fixNote: t.fix ? t.fix.note : null,
      dialTurn: Boolean(t.fix && t.fix.action.startsWith("setpoint_")),
      status,
      statusWord: status === "open" ? "Still open" : status === "came-back" ? "Came back" : "No call since",
      next,
    };
  });

  const patterns: WhyPattern[] = [];
  for (const t of run) {
    const found = patterns.find((p) => p.complaint === t.complaint && p.where === t.intake.where);
    if (found) found.ids.push(t.id);
    else patterns.push({ complaint: t.complaint, where: t.intake.where, when: t.intake.when, ids: [t.id] });
  }

  const first = run[0];
  const last = run[run.length - 1];
  const days = sgDay(last.reportedAt) - sgDay(first.reportedAt);
  const dialTurns = calls.filter((c) => c.dialTurn).length;
  const openIds = calls.filter((c) => c.status === "open").map((c) => c.id);
  const neverFixed = !calls.some((c) => c.status === "stayed-fixed");
  const closed = calls.filter((c) => c.status !== "open");
  const allCameBack = closed.length > 0 && closed.every((c) => c.status === "came-back");

  const floor = buildings.find((b) => b.id === first.building)?.floors.find((f) => f.floor === first.floor);
  const openCall = run.find((t) => t.fix === null);
  const trendsHere = trends.building === first.building && trends.floor === first.floor;
  const causeLine = openCall && trendsHere ? trends.zones[openCall.zone]?.description ?? null : null;

  const place = `${first.buildingName} Level ${first.floor}`;
  const headline = `${place} called ${plural(run.length, "time")} in ${plural(days, "day")}${
    neverFixed ? ", and the cause was never fixed" : ""
  }`;
  let summary = `${dialTurns} closed with a dial turn${allCameBack && dialTurns > 0 ? ", and every one came back" : ""}.`;
  if (openIds.length > 0) summary += ` ${openIds.join(" and ")} ${openIds.length === 1 ? "is" : "are"} still open.`;

  return {
    spotKey,
    place,
    tenant: first.tenant,
    calls,
    days,
    dialTurns,
    openIds,
    neverFixed,
    patterns,
    fitOutMonths: floor ? floor.fitOutCompletedMonths : null,
    leaseEndsInMonths: floor ? floor.leaseEndsInMonths : null,
    causeLine,
    headline,
    summary,
  };
}

// ---- The demo steps (the bar on the live wall) ----

export interface DemoStep {
  /** "bar" is the live wall's own bar. */
  seat: SeatId | "bar";
  who: string;
  text: string;
}

function causeLabel(id: string): string {
  return loadCauses().causes.find((c) => c.id === id)?.label ?? id;
}

function answer(questionId: string, index: number): string {
  return SELF_CHECK_QUESTIONS.find((q) => q.id === questionId)?.answers[index] ?? "";
}

/**
 * The demo as text, in the T-C10b order: which seat, which button. The labels
 * are the ones the screen shows, read from the code and the data. The demo
 * rule is S16's: the fact fit-out-12m, block step 25 and put step 21 first.
 */
export function demoSteps(): DemoStep[] {
  const precool = causeLabel("precool");
  const minAirflow = causeLabel("min-airflow");
  const thermostat = causeLabel("thermostat-spot");
  const part = (id: "fact" | "effect-1" | "effect-2", value: string) => `${PART_TITLES[id]} (${partDisplay(id, value)})`;
  const choices = CHARGE_CHOICES.map((c) => c.label);

  return [
    {
      seat: "bar",
      who: "This bar",
      text: "Press Reset demo. Every chat starts again from the made-up seed, at the demo clock.",
    },
    {
      seat: "tenant",
      who: SEAT_SHORT.tenant,
      text: `Report a problem, then Too cold. Answer ${answer("Q0", 1)}, ${answer("Q1", 0)}, ${answer("Q2", 2)}, ${answer("Q3", 0)} and ${answer("Q4-thermostat", 2)}. The answers attach to ${SEAT_JOB} and a visit is booked.`,
    },
    {
      seat: "technician",
      who: SEAT_SHORT.technician,
      text: `Open job on ${SEAT_JOB}. Not this on "${precool}", then on "${minAirflow}". Not solved: fill in the hours lost, the extra visits and contractor or parts, then Send to the senior manager.`,
    },
    {
      seat: "senior-manager",
      who: SEAT_SHORT["senior-manager"],
      text: `On ${SEAT_JOB}, Found it on "${thermostat}". Log new solution: type the fix line and the why line (3 to 30 words each), then Log it. For each part, pick this in its box (change the AI's suggestion where it differs), then Confirm: ${PART_TITLES["rule-text"]}, ${part("fact", "fit-out-12m")}, ${part("effect-1", "block:25")}, ${part("effect-2", "put-first:21")}. Run tests, then Send to HQ.`,
    },
    {
      seat: "hq",
      who: SEAT_SHORT.hq,
      text: `Approve and send to all buildings. Every building goes live on the new version, and the Building B card puts "${thermostat}" first.`,
    },
    {
      seat: "aom-tower-a",
      who: SEAT_SHORT["aom-tower-a"],
      text: `Decide charge on the A4 request: ${choices[0]} (a whole-number amount), ${choices[1]} or ${choices[2]}, each with a reason of 3 words or more. The tenant's chat then gets the card.`,
    },
  ];
}

// ---- The brief's 8 questions ----

/** docs/challenge/keppel-brief.md, "The solution diagram must answer these 8 questions", word for word. */
const BRIEF_QUESTIONS = [
  "What specific business problem is being addressed?",
  "Whose expertise is captured, and how is knowledge that is not already documented obtained?",
  "How does the captured expertise become reusable, rather than a one-off answer?",
  "How would an Asset Operations Manager use and supervise it, check its recommendations, and know when a human must step in?",
  "Why is it more than a chatbot or a search tool?",
  "How are feedback, outcome data and new expertise reviewed, validated, versioned and approved after deployment?",
  "How could it extend from one asset or domain to many assets, business units or the whole enterprise?",
  "What is a credible path to build it with current or near-term technology?",
];

function briefAnswers(story: WhyStory | null, cases: number): string[] {
  const problem = story
    ? `Tickets close but causes stay: ${story.place} called ${plural(story.calls.length, "time")} in ${plural(story.days, "day")}${
        story.neverFixed && story.dialTurns > 0 ? ", and every dial turn came back" : ""
      }.`
    : "Tickets close but causes stay, so the same spot calls again.";
  return [
    problem,
    "The FM contractor's chief engineer (role-played): when they solve a job that came up, their fix line and why line become a draft rule that is tested before it counts.",
    `Every solved job is saved as a case that ranks the next job (${cases} made-up past cases to start), and an approved rule goes live in every building at once.`,
    "The AOM watches the impact meter, gets every safety alert for Tower A, sees the live version and decides every charge to a tenant (A4); a red stop always says who to call.",
    "Code ranks, routes and locks, and only button presses change anything; the AI only words what code decided.",
    "A fix wins only after 30 days with no repeat; a new rule needs passing tests and HQ's approval (A2), goes out as a new version and can be rolled back.",
    "A building is a row in the data and a spot is a building and floor, so one approved version reaches every building, as Building B shows.",
    "It runs today: a Next.js app, Tencent Hunyuan through TokenHub for the wording, and the pill as plain YAML in Git; the next step is a one-building pilot.",
  ];
}

// ---- The view ----

export interface HowSeat {
  id: SeatId;
  label: string;
  href: string;
  /** What the seat is for, its opening line (C5b). */
  does: string;
  /** The approvals this seat gives, read from ACTION_RULES: "A2", "A3", "A4". */
  approves: string[];
  /** "Pip never ...", the same line the server's table holds (S2). */
  never: string;
}

export interface HowApproval {
  id: "A1" | "A2" | "A3" | "A4";
  what: string;
  who: string;
  where: string;
  /** A1 only: the memory's own line. */
  line?: string;
}

export interface HowView {
  why: WhyStory | null;
  meter: ImpactMeter | null;
  brain: { pill: string; version: string; causes: number; cases: number };
  seats: HowSeat[];
  buildingB: { title: string; version: string; line: string };
  approvals: HowApproval[];
  passes: typeof PASSES;
  /** Code decides, the AI words, people approve (S1). */
  roles: { who: string; text: string }[];
  thirtyDay: string[];
  rankSteps: { name: string; text: string }[];
  safety: { line: string; stops: { id: string; trigger: string }[] };
  aiNewSolution: string;
  questions: { n: number; question: string; answer: string }[];
  rolePlayed: string;
  demoSteps: DemoStep[];
  closeLine: string;
}

/** Which approvals (A2 to A4) a seat gives, read from the S2 table the server checks. */
function approvalsBy(seat: SeatId): string[] {
  const gives: [string, string][] = [
    ["approve-solution", "A2"],
    ["decide-outside-help", "A3"],
    ["decide-charge", "A4"],
  ];
  return gives.filter(([action]) => seat in ACTION_RULES[action].seats).map(([, id]) => id);
}

/** Everything /how shows above the live wall, from the one memory and the data. */
export function howView(state: MemoryState, sources: HowSources = loadHowSources()): HowView {
  const why = whyStory(sources.tickets, sources.buildings, sources.trends);
  const meter = impactFor(AOM_SPOT, callsWith(state, sources.tickets), sources.rates);
  const towerA = state.liveVersionByBuilding["tower-a"] ?? BASE_VERSION;
  const pill = loadAndCheckPill("ts-cc", towerA);
  const cases = loadCases().cases.length;
  const bJob = state.jobs.find((j) => j.id === BUILDING_B_JOB_ID);
  const bVersion = bJob ? state.liveVersionByBuilding[bJob.building] ?? BASE_VERSION : BASE_VERSION;

  return {
    why,
    meter,
    brain: { pill: "TS-CC", version: towerA, causes: loadCauses().causes.length, cases },
    seats: SEAT_IDS.map((id) => ({
      id,
      label: SEAT_LABELS[id],
      href: `/seat/${id}`,
      does: openingLineFor(id).text,
      approves: approvalsBy(id),
      never: openingLineFor(id).never,
    })),
    buildingB: {
      title: "Building B, Level 12 (made up)",
      version: bVersion,
      line: `A card, not a seat: its live version and ticket ${BUILDING_B_JOB_ID}'s first 3 causes, ranked by the same engine.`,
    },
    approvals: [
      {
        id: "A1",
        what: "Version 1 of the brain",
        who: "Two senior experts (role-played), shown as already signed",
        where: "A card on the HQ seat and here",
        line: state.a1Line,
      },
      { id: "A2", what: "A new solution", who: "HQ, after its tests pass", where: "HQ: Approve and send to all buildings" },
      { id: "A3", what: "Outside help or money beyond the senior manager", who: "HQ", where: "HQ: Approve or Decline outside help" },
      { id: "A4", what: "Charging the tenant", who: "AOM, Tower A", where: "AOM Tower A: Decide charge" },
    ],
    passes: PASSES,
    roles: [
      { who: "Code decides", text: "every rank, state, lock, number and hand-off. The same input always gives the same answer." },
      {
        who: "The AI words",
        text: "rank reasons, tenant replies from approved tips and a new rule's text (Tencent Hunyuan). It never ranks, and a person confirms anything that counts. Switch it off and every card, rank and number stays the same.",
      },
      {
        who: "People approve",
        text: "only at A1 to A4. Typing never changes anything; only buttons do. Safety is a stop, not an approval.",
      },
    ],
    thirtyDay: [
      "A fix counts as a win only after 30 days with no repeat at the same spot.",
      "A repeat inside 30 days counts against the cause that was fixed, so a fix that came back loses points.",
      "The person who fixed it cannot confirm the cause alone, and every closed job carries one line of why.",
    ],
    rankSteps: [
      {
        name: "Rules first",
        text: "Drop the causes that do not explain the complaint, the red ones, the checks that are not this seat's and the ones a live rule blocks. A fix on the tenant's fit-out stays a lead, but goes through the AOM.",
      },
      {
        name: "Match the facts",
        text: `Compare the job's facts with ${cases} made-up past cases and the tickets. Only 30-day wins add points; failed fixes take them away.`,
      },
      {
        name: "Order",
        text: "Found it first, then a signed rule, then causes backed by 3 or more cases (close scores: the quicker check first), then low confidence, then net failed.",
      },
      {
        name: "Show why",
        text: 'Every lead carries its code reason. Under 3 similar cases it says "low confidence, expert rule"; when the top lead is low confidence, or no lead is left, the senior manager is told.',
      },
    ],
    safety: {
      line: `${safetyList(pill).length} red stops from pill v${pill.version}, always in the pill's own words, with who to call. AI calls: 0. Typed safety words show the stop and alert people; only a button press locks the floor.`,
      stops: safetyList(pill).map((s) => ({ id: s.id, trigger: s.trigger })),
    },
    aiNewSolution: AI_NEW_SOLUTION_LINE,
    questions: BRIEF_QUESTIONS.map((question, i) => ({ n: i + 1, question, answer: briefAnswers(why, cases)[i] })),
    rolePlayed: ROLE_PLAYED_LINE,
    demoSteps: demoSteps(),
    closeLine: CLOSE_LINE,
  };
}

// ---- The live wall ----

export interface LiveSeat {
  seat: SeatId;
  label: string;
  href: string;
  /** The seat's view on the one memory, the same shape /api/state returns. */
  initial: SeatView;
  opening: { text: string; never: string };
  jobId?: string;
}

/** The 5 real seat views for the live wall, AOM Tower A first (S22). */
export function liveSeats(state: MemoryState, mode?: AiMode, realNow: Date = new Date()): LiveSeat[] {
  return LIVE_ORDER.map((seat) => ({
    seat,
    label: SEAT_LABELS[seat],
    href: `/seat/${seat}`,
    initial: seatView(state, seat, mode, realNow),
    opening: openingLineFor(seat),
    ...(seat === "aom-tower-a" ? {} : { jobId: SEAT_JOB }),
  }));
}
