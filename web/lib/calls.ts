/**
 * The calls at every spot, and speak first (S5, S6), on the shared memory.
 *
 * Both Reset (actions.ts) and the tenant's self-check (self-check-flow.ts) use
 * these, so a speak-first notice is posted the same way whoever triggers it.
 */

import { readFileSync } from "fs";
import { join } from "path";
import type { Ticket } from "./rule-engine";
import { allCalls, spotKey } from "./places";
import { speakFirstNotices } from "./speak-first";
import { outcomeOf, type Outcome } from "./outcome";
import type { MemoryState, Job, RuntimeCase } from "./memory";

/**
 * Every ticket in tickets.json plus the jobs created at runtime.
 * The seed jobs are already in tickets.json, so they are not counted twice.
 * A job still in `self-check` is not a call yet: its answers may attach to an
 * open job at the same spot instead (S10), and then it never becomes one.
 */
export function callsForState(state: MemoryState): Ticket[] {
  const fileIds = new Set(
    (JSON.parse(
      readFileSync(join(process.cwd(), "data", "tickets.json"), "utf-8")
    ) as Ticket[]).map((t) => t.id)
  );
  const runtimeOnly = state.jobs.filter(
    (j) => !fileIds.has(j.id) && j.status !== "self-check"
  ) as Ticket[];
  return allCalls({ tickets: runtimeOnly });
}

/**
 * The outcome of a case saved at runtime, at `now` (S8): its repeat is the
 * first call at the same spot after it was fixed. The senior manager's case
 * list and the confirm-cause press read this same answer, so a fix the spot
 * already called back on is neither offered nor confirmed (S2: "a pending
 * case").
 */
export function runtimeCaseOutcome(state: MemoryState, c: RuntimeCase, now: Date): Outcome {
  const spot = spotKey(c);
  const next = callsForState(state)
    .filter((t) => spotKey(t) === spot && new Date(t.reportedAt) > new Date(c.fixedAt))
    .sort((a, b) => new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime())[0];
  return outcomeOf(
    {
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
    },
    now
  ).outcome;
}

/**
 * Speak first (S6) for these jobs: when a spot trips the repeat flag and has no
 * speak-first notice in the last 30 days, one notice goes in the senior
 * manager's chat, and the spot's speak-first flag is set (the AOM seat reads
 * it). Never twice for the same spot inside 30 days. Call it inside
 * memory.update. Returns how many it posted.
 */
export function postSpeakFirst(state: MemoryState, jobs: Job[], asOf: Date, stamp: string): number {
  const posted = speakFirstNotices(jobs as Ticket[], callsForState(state), state.speakFirstNotices, asOf);
  for (const notice of posted) {
    state.speakFirstNotices.push({ spotKey: notice.spotKey, postedAt: stamp });
    state.notices.push({
      seat: "senior-manager",
      kind: "speak-first",
      text: notice.text,
      at: stamp,
      jobId: notice.job.id,
      spotKey: notice.spotKey,
    });
  }
  return posted.length;
}
