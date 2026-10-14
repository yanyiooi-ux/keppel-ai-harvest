/**
 * The made-up rates (S18) and the technician's impact record (S3).
 *
 * The rates file is read at call time, never imported, so a changed rate shows
 * on the next read. The impact record is three answers from the Not solved
 * form: hours lost (0 to 100), extra visits needed (0 to 10, whole) and
 * "contractor or parts needed" (yes or no). Code adds the cost; nobody types a
 * price. Plain code, 0 AI.
 */

import { readFileSync } from "fs";
import { join } from "path";
import type { ImpactRecord } from "./memory";

export interface ImpactRates {
  label: string;
  visitHours: number;
  seniorCheckHours: number;
  hourlyRateSgd: number;
}

/** web/data/impact-rates.json, labelled "made up for the demo" (S18). */
export function loadImpactRates(): ImpactRates {
  return JSON.parse(readFileSync(join(process.cwd(), "data", "impact-rates.json"), "utf-8")) as ImpactRates;
}

export type ImpactCheck =
  | { ok: true; record: ImpactRecord }
  | { ok: false; message: string };

export const IMPACT_NEEDED =
  "Not solved needs the impact record: hours lost (0 to 100), extra visits needed (0 to 10), and contractor or parts needed (yes or no).";

function numberIn(value: unknown, min: number, max: number, whole: boolean): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < min || value > max) return null;
  if (whole && !Number.isInteger(value)) return null;
  return value;
}

/** The S3 ranges. Anything missing or out of range is refused with what the record needs. */
export function checkImpactRecord(payload: Record<string, unknown> | undefined): ImpactCheck {
  const hoursLost = numberIn(payload?.hoursLost, 0, 100, false);
  const extraVisits = numberIn(payload?.extraVisits, 0, 10, true);
  const contractor = payload?.contractorOrPartsNeeded;
  if (hoursLost === null || extraVisits === null || typeof contractor !== "boolean") {
    return { ok: false, message: IMPACT_NEEDED };
  }
  return { ok: true, record: { hoursLost, extraVisits, contractorOrPartsNeeded: contractor } };
}

/**
 * The record's cost in made-up S$: hours lost at the hourly rate, plus each
 * extra visit's hours at the hourly rate. S18 has no rate for a contractor or
 * parts, so that answer is shown but not costed (QUESTIONS.md question 7).
 */
export function impactCost(record: ImpactRecord, rates: ImpactRates): number {
  return Math.round(
    record.hoursLost * rates.hourlyRateSgd + record.extraVisits * rates.visitHours * rates.hourlyRateSgd
  );
}

/** The record in words, the same everywhere it shows: "3 hours lost, 2 extra visits, contractor or parts needed: no". */
export function impactLine(record: ImpactRecord): string {
  const hours = `${record.hoursLost} hour${record.hoursLost === 1 ? "" : "s"} lost`;
  const visits = `${record.extraVisits} extra visit${record.extraVisits === 1 ? "" : "s"}`;
  return `${hours}, ${visits}, contractor or parts needed: ${record.contractorOrPartsNeeded ? "yes" : "no"}`;
}

/** How the cost was made, so nobody reads it as a quote: "S$420 (made-up rates: S$60 an hour, a visit is 2 hours)". */
export function costLine(cost: number, rates: ImpactRates): string {
  return `S$${cost} (made-up rates: S$${rates.hourlyRateSgd} an hour, a visit is ${rates.visitHours} hours)`;
}
