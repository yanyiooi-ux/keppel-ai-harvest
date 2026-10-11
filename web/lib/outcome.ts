/**
 * Outcome and points (S8).
 *
 * outcomeOf(case, asOfDate):
 * - failed: repeat at same spot within 30 days of close
 *   (nextCallAt is within 30 days of closedAt, and now <= 30 days since close)
 * - pending: no repeat, under 30 days since close
 * - won: no repeat, 30 days or more since close
 * - unconfirmed: fixedBy == confirmedBy (the fixer confirmed alone)
 *
 * Points: won = +weight, failed = -weight, pending = 0, unconfirmed = 0.
 */

import type { Case } from "./cases";

export type Outcome = "won" | "failed" | "pending" | "unconfirmed";

export interface OutcomeResult {
  outcome: Outcome;
  points: number;
}

/**
 * Returns the outcome of a case as of the given date.
 *
 * - unconfirmed: when fixedBy == confirmedBy (the fixer confirmed alone)
 * - failed: repeat at same spot within 30 days of close
 * - pending: no repeat, under 30 days since close
 * - won: no repeat, 30 days or more since close
 */
export function outcomeOf(
  c: Case,
  asOfDate: Date
): OutcomeResult {
  // Unconfirmed: the fixer confirmed alone (fixedBy == confirmedBy)
  if (c.confirmedBy !== null && c.fixedBy === c.confirmedBy) {
    return { outcome: "unconfirmed", points: 0 };
  }

  const closedAt = new Date(c.closedAt);
  const oneDayMs = 24 * 60 * 60 * 1000;
  const thirtyDaysMs = 30 * oneDayMs;
  const daysSinceClose = (asOfDate.getTime() - closedAt.getTime()) / oneDayMs;

  // Failed: repeat at same spot within 30 days of close
  if (c.nextCallAt) {
    const nextCall = new Date(c.nextCallAt);
    const daysToNextCall = (nextCall.getTime() - closedAt.getTime()) / oneDayMs;
    if (daysToNextCall <= 30 && daysSinceClose >= daysToNextCall) {
      return { outcome: "failed", points: 0 }; // points set by caller with weight
    }
  }

  // Pending: under 30 days since close
  if (daysSinceClose < 30) {
    return { outcome: "pending", points: 0 };
  }

  // Won: 30 days or more since close, no repeat
  return { outcome: "won", points: 0 };
}

/**
 * Points for a case given its outcome and weight.
 * won: +weight, failed: -weight, pending: 0, unconfirmed: 0.
 */
export function pointsFor(outcome: Outcome, weight: number): number {
  switch (outcome) {
    case "won":
      return weight;
    case "failed":
      return -weight;
    default:
      return 0;
  }
}

/**
 * Full outcome with points based on the weight.
 */
export function outcomeWithPoints(
  c: Case,
  asOfDate: Date,
  weight: number
): OutcomeResult {
  const result = outcomeOf(c, asOfDate);
  return {
    outcome: result.outcome,
    points: pointsFor(result.outcome, weight),
  };
}
