/**
 * The calls at every spot, and speak first (S5, S6), on the shared memory.
 *
 * Both Reset (actions.ts) and the tenant's self-check (self-check-flow.ts) use
 * these, so a speak-first notice is posted the same way whoever triggers it.
 */

import { readFileSync } from "fs";
import { join } from "path";
import type { Ticket } from "./rule-engine";
import { allCalls } from "./places";
import { speakFirstNotices } from "./speak-first";
import type { MemoryState, Job } from "./memory";

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
