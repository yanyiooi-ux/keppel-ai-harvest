/**
 * Causes (S7).
 *
 * Loads causes.json at call time. Each cause has its fields from S7.
 * checkStep text is read from the pill by checkStep number, never typed in.
 */

import { readFileSync } from "fs";
import { join } from "path";
import type { Pill } from "./pill";

export interface Cause {
  id: string;
  label: string;
  symptoms: string[];
  checkStep: number;
  checkMinutes: number;
  checkSeats: string[];
  fixStep: number | null;
  fixSeat: string;
  fixRoute: string;
  tenantSolution: string;
  tenantItem: boolean;
  red: boolean;
}

export interface CausesFile {
  label: string;
  causes: Cause[];
}

/** Load causes.json at call time, never via import. */
export function loadCauses(): CausesFile {
  const filePath = join(process.cwd(), "data", "causes.json");
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as CausesFile;
}

/**
 * Get the check text for a cause from the pill.
 * The check text is the text of the checklist step whose step number
 * matches the cause's checkStep.
 */
export function checkTextFor(cause: Cause, pill: Pill): string {
  const step = pill.checklist.find((s) => s.step === cause.checkStep);
  if (!step) {
    throw new Error(`Cause ${cause.id}: no pill step ${cause.checkStep}`);
  }
  return step.text;
}
