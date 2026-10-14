/**
 * Builds the ranking input from the shared memory.
 *
 * rank.ts is pure and takes everything it needs as arguments, so this is the
 * one place that reads the data files and the memory for it. The screens and
 * the chat both come through here, so they can never rank differently.
 */

import { loadAndCheckPill, type Pill } from "./pill";
import { loadCauses } from "./causes";
import { allCases } from "./cases";
import { loadBuildings } from "./facts";
import { factsFor, repeatFlagFor } from "./facts";
import { loadPlaces, spotKey } from "./places";
import { rankLeads } from "./rank";
import type { RankResult } from "./rank";
import type { Ticket } from "./rule-engine";
import { callsForState } from "./actions";
import * as memory from "./memory";
import type { MemoryState, Job } from "./memory";

export function factsForJob(state: MemoryState, job: Job): string[] {
  return factsFor(job as Ticket, callsForState(state), loadBuildings(), loadPlaces());
}

/**
 * The ranked leads for one job, through one seat's eyes.
 *
 * `livePill` is the building's live pill unless one is given. ai:record passes
 * the v1.1 fixture to record 2401's wording as it ranks after HQ approves (C6b).
 */
export function leadsForJob(
  state: MemoryState,
  job: Job,
  seat: string,
  realNow: Date = new Date(),
  livePill?: Pill
): RankResult {
  const version = state.liveVersionByBuilding[job.building] ?? "1.0";
  const causesFile = loadCauses();
  const calls = callsForState(state);

  return rankLeads({
    job: { ...(job as Ticket), facts: factsForJob(state, job) },
    seat,
    livePill: livePill ?? loadAndCheckPill("ts-cc", version),
    causes: causesFile.causes,
    allCases: allCases(calls),
    ticks: job.ticks,
    openRedStops: state.openRedStops
      .filter((s) => s.clearedAt === null)
      .map((s) => ({ spotKey: `${s.building}/${s.floor}`, id: s.stopId })),
    now: memory.now(state, realNow),
    repeatFlag: repeatFlagFor(job as Ticket, calls),
  });
}

/** The dial lead's standing for this job, for the "Dial?" chip (S19). */
export function dialStanding(
  state: MemoryState,
  job: Job,
  seat: string,
  realNow: Date = new Date()
): { allowed: boolean; reason: string } {
  const result = leadsForJob(state, job, seat, realNow);

  const removed = result.removed.find((r) => r.causeId === "setpoint");
  if (removed) return { allowed: false, reason: removed.reason };

  const lead = result.leads.find((l) => l.causeId === "setpoint");
  if (lead) return { allowed: true, reason: lead.reason };

  const ruledOut = result.ruledOut.find((l) => l.causeId === "setpoint");
  if (ruledOut) return { allowed: false, reason: ruledOut.reason };

  return { allowed: false, reason: "The dial is not a lead on this job." };
}

export { spotKey };
