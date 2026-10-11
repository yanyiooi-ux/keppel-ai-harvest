/**
 * Cases (S7).
 *
 * History cases from cases.json, plus cases from closed tickets.
 * A similar case shares the job's symptom fact and at least 2 facts
 * (the symptom counts as one). Weight = number of shared facts.
 */

import { readFileSync } from "fs";
import { join } from "path";
import type { Ticket } from "./rule-engine";
import { spotKey } from "./places";
import { factsFor, loadBuildings } from "./facts";
import { loadPlaces } from "./places";

export interface Case {
  id: string;
  building: string;
  floor: number;
  zone: string;
  facts: string[];
  cause: string;
  fix: string;
  why: string;
  fixedBy: string;
  confirmedBy: string | null;
  closedAt: string;
  nextCallAt: string | null;
}

export interface CasesFile {
  label: string;
  cases: Case[];
}

/** Load cases.json at call time, never via import. */
export function loadCases(): CasesFile {
  const filePath = join(process.cwd(), "data", "cases.json");
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as CasesFile;
}

/**
 * casesFromTickets: turns each closed ticket with a fix into a case.
 * cause = setpoint (fix action setpoint_up or setpoint_down),
 * facts from factsFor, why = fix.note, fixedBy = fix.fixerRole,
 * confirmedBy null, closedAt = reportedAt, next call = next call at same spot.
 */
export function casesFromTickets(allCalls: Ticket[]): Case[] {
  const buildings = loadBuildings();
  const places = loadPlaces();

  const cases: Case[] = [];

  for (const t of allCalls) {
    if (!t.fix) continue;
    if (t.fix.action !== "setpoint_up" && t.fix.action !== "setpoint_down") continue;

    // Find next call at the same spot after this ticket's report time
    const reportTime = new Date(t.reportedAt);
    const laterCalls = allCalls
      .filter(
        (c) =>
          spotKey(c) === spotKey(t) &&
          new Date(c.reportedAt) > reportTime
      )
      .sort((a, b) => new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime());

    const nextCallAt = laterCalls.length > 0 ? laterCalls[0].reportedAt : null;

    cases.push({
      id: t.id,
      building: t.building,
      floor: t.floor,
      zone: t.zone,
      facts: factsFor(t, allCalls, buildings, places),
      cause: "setpoint",
      fix: t.fix.note,
      why: t.fix.note,
      fixedBy: t.fix.fixerRole,
      confirmedBy: null,
      closedAt: t.reportedAt,
      nextCallAt,
    });
  }

  return cases;
}

/**
 * Whether a case is similar to a job. A case is similar when it has the
 * job's symptom fact, and the two share at least 2 facts (the symptom
 * counts as one).
 */
export function isSimilar(jobFacts: string[], caseFacts: string[]): boolean {
  // Find the job's symptom fact (first fact, one of cold-mornings, hot-afternoons, etc.)
  const symptomFacts = ["cold-mornings", "hot-afternoons", "cold-other", "hot-other"];
  const jobSymptom = jobFacts.find((f) => symptomFacts.includes(f));
  if (!jobSymptom) return false;

  // The case must have the same symptom
  if (!caseFacts.includes(jobSymptom)) return false;

  // Count shared facts
  const sharedFacts = jobFacts.filter((f) => caseFacts.includes(f));
  return sharedFacts.length >= 2;
}

/**
 * Weight = number of shared facts between the job and the case.
 */
export function similarWeight(jobFacts: string[], caseFacts: string[]): number {
  return jobFacts.filter((f) => caseFacts.includes(f)).length;
}

/**
 * All cases: history cases plus cases from tickets.
 */
export function allCases(allCalls: Ticket[]): Case[] {
  const history = loadCases().cases;
  const fromTickets = casesFromTickets(allCalls);
  return [...history, ...fromTickets];
}
