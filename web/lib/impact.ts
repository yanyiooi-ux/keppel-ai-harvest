/**
 * The impact meter (S18, C9): what the repeat calls at one spot cost, worked
 * out by replaying the tickets. Nothing is typed in and nothing is hard-coded:
 * change a date in tickets.json, or a rate in impact-rates.json, and the
 * numbers change.
 *
 * The run of calls is the spot's tickets in time order, each within 30 days of
 * the one before. A spot with a gap longer than that has more than one run;
 * the meter shows the newest, the one "and counting" is about.
 *
 * Before is the run as it happened: one visit per call, no senior manager
 * check, and the spot is not fixed yet. With Pill Desk replays the same calls
 * and stops at the first one where computeRepeatFlag (the clock rule, the
 * call's report time plus 20 minutes) is on: that visit gets one senior
 * manager check, and the meter assumes the cause is found there.
 *
 * The cost uses the made-up rates the same way the impact record does (S3,
 * QUESTIONS.md question 7): a visit is visitHours at hourlyRateSgd, a senior
 * check is seniorCheckHours at hourlyRateSgd. Plain code, 0 AI.
 */

import type { Ticket } from "./rule-engine";
import { repeatFlagFor } from "./facts";
import { spotKey as spotKeyOf } from "./places";
import { dayMonth } from "./technician-flow";
import type { ImpactRates } from "./impact-rates";

/** S18: the card always shows this. */
export const IMPACT_LABEL =
  "Worked out on made-up demo data. It assumes the cause is found on the visit where the repeat is caught.";

const DAY_MS = 24 * 60 * 60 * 1000;
const SG_OFFSET_MS = 8 * 60 * 60 * 1000;
const RUN_GAP_MS = 30 * DAY_MS;

export interface ImpactSide {
  calls: number;
  visits: number;
  seniorChecks: number;
  /** Whole calendar days in Singapore time. */
  days: number;
  /** "not fixed after 21 days" (Before) or "4 days" (With Pill Desk). */
  daysLine: string;
  repeatCalls: number;
  /** Made-up S$. */
  cost: number;
  /** "S$600 and counting" (Before) or "S$420" (With Pill Desk). */
  costLine: string;
  /** The tickets counted, in time order. */
  callIds: string[];
}

export interface ImpactCaught extends ImpactSide {
  /** The call where the repeat flag first comes on. */
  caughtId: string;
  /** "19 Sep". */
  caughtOn: string;
}

export interface ImpactMeter {
  spotKey: string;
  /** "Tower A Level 23". */
  place: string;
  label: string;
  before: ImpactSide;
  /** Null when no call in the run turns the repeat flag on: there is nothing to catch. */
  withPillDesk: ImpactCaught | null;
}

/** The calendar day of a time in Singapore, as a whole number. */
function sgDay(at: string): number {
  return Math.floor((new Date(at).getTime() + SG_OFFSET_MS) / DAY_MS);
}

function daysBetween(first: Ticket, last: Ticket): number {
  return sgDay(last.reportedAt) - sgDay(first.reportedAt);
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** The spot's newest run: its tickets in time order, each within 30 days of the one before. */
export function runOfCalls(spotKey: string, allTickets: Ticket[]): Ticket[] {
  const atSpot = allTickets
    .filter((t) => spotKeyOf(t) === spotKey)
    .sort((a, b) => new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime());
  let run: Ticket[] = [];
  for (const t of atSpot) {
    const prev = run[run.length - 1];
    if (prev && new Date(t.reportedAt).getTime() - new Date(prev.reportedAt).getTime() > RUN_GAP_MS) run = [];
    run.push(t);
  }
  return run;
}

/**
 * The meter for one spot (S18), or null when the spot has no calls. Pure: it
 * reads only what it is given.
 */
export function impactFor(spotKey: string, allTickets: Ticket[], rates: ImpactRates): ImpactMeter | null {
  const run = runOfCalls(spotKey, allTickets);
  if (run.length === 0) return null;

  const visitCost = rates.visitHours * rates.hourlyRateSgd;
  const seniorCost = rates.seniorCheckHours * rates.hourlyRateSgd;

  const first = run[0];
  const last = run[run.length - 1];
  const beforeDays = daysBetween(first, last);
  const beforeCost = run.length * visitCost;
  const before: ImpactSide = {
    calls: run.length,
    visits: run.length,
    seniorChecks: 0,
    days: beforeDays,
    daysLine: `not fixed after ${plural(beforeDays, "day")}`,
    repeatCalls: run.length - 1,
    cost: beforeCost,
    costLine: `S$${beforeCost} and counting`,
    callIds: run.map((t) => t.id),
  };

  // The first call in the run where the repeat flag comes on, read with the
  // clock rule against every call given, exactly as the technician sees it.
  const caughtAt = run.findIndex((t) => repeatFlagFor(t, allTickets).isRepeat);
  let withPillDesk: ImpactCaught | null = null;
  if (caughtAt >= 0) {
    const counted = run.slice(0, caughtAt + 1);
    const caught = run[caughtAt];
    const days = daysBetween(first, caught);
    const cost = counted.length * visitCost + seniorCost;
    withPillDesk = {
      calls: counted.length,
      visits: counted.length,
      seniorChecks: 1,
      days,
      daysLine: plural(days, "day"),
      repeatCalls: caughtAt,
      cost,
      costLine: `S$${cost}`,
      callIds: counted.map((t) => t.id),
      caughtId: caught.id,
      caughtOn: dayMonth(caught.reportedAt),
    };
  }

  return {
    spotKey,
    place: `${first.buildingName} Level ${first.floor}`,
    label: IMPACT_LABEL,
    before,
    withPillDesk,
  };
}

/** The meter in plain lines, for the AOM's Impact chip (S19): the same numbers as the card. */
export function impactLines(meter: ImpactMeter): string[] {
  const b = meter.before;
  const lines = [
    `Before: ${plural(b.calls, "call")}, ${plural(b.visits, "visit")}, ${b.seniorChecks} senior manager checks, ${b.daysLine}, ${plural(b.repeatCalls, "repeat call")}, ${b.costLine}.`,
  ];
  const w = meter.withPillDesk;
  lines.push(
    w
      ? `With Pill Desk: caught at ${w.caughtId} on ${w.caughtOn}. ${plural(w.calls, "call")}, ${plural(w.visits, "visit")}, ${plural(w.seniorChecks, "senior manager check")}, ${w.daysLine}, ${plural(w.repeatCalls, "repeat call")}, ${w.costLine}.`
      : "With Pill Desk: no repeat caught at this spot yet."
  );
  lines.push(meter.label);
  return lines;
}
