/**
 * Speak first (S6).
 *
 * speakFirstFor(job, allCalls) returns { fire, count, opposite, spotKey }
 * from the repeat flag. It runs on Reset for every open job.
 *
 * When fire is true and no speak-first notice exists for that spot
 * in the last 30 days (demo clock), code posts one notice.
 * Never twice for the same spot inside 30 days.
 *
 * The shared memory comes in C4. Here, the pure part: which notices
 * to post, given the jobs and the notices already there.
 */

import type { Ticket } from "./rule-engine";
import { computeRepeatFlag } from "./rule-engine";
import { spotKey } from "./places";

export interface SpeakFirstResult {
  fire: boolean;
  count: number;
  opposite: boolean;
  spotKey: string;
}

/**
 * Returns { fire, count, opposite, spotKey } from the repeat flag.
 * fire is true when the repeat flag is on.
 *
 * Whether to actually post depends on existing notices
 * (see shouldPostSpeakFirst).
 */
export function speakFirstFor(job: Ticket, allCalls: Ticket[]): SpeakFirstResult {
  const reportTime = new Date(job.reportedAt);
  const asOfDate = new Date(reportTime.getTime() + 20 * 60 * 1000);

  const repeat = computeRepeatFlag(allCalls, job, asOfDate);

  return {
    fire: repeat.isRepeat,
    count: repeat.count,
    opposite: repeat.hasOppositeFixes,
    spotKey: spotKey(job),
  };
}

/**
 * A speak-first notice already posted for a spot.
 */
export interface SpeakFirstNotice {
  spotKey: string;
  postedAt: string; // ISO date
}

/**
 * Whether to post a speak-first notice for a job, given the notices
 * already posted. Returns true when fire is true and no notice exists
 * for that spot in the last 30 days (relative to asOfDate).
 */
export function shouldPostSpeakFirst(
  job: Ticket,
  allCalls: Ticket[],
  existingNotices: SpeakFirstNotice[],
  asOfDate: Date = new Date()
): boolean {
  const result = speakFirstFor(job, allCalls);
  if (!result.fire) return false;

  // Check if a notice exists for this spot in the last 30 days
  const cutoff = new Date(asOfDate);
  cutoff.setDate(cutoff.getDate() - 30);

  const hasRecent = existingNotices.some(
    (n) =>
      n.spotKey === result.spotKey &&
      new Date(n.postedAt) >= cutoff &&
      new Date(n.postedAt) <= asOfDate
  );

  return !hasRecent;
}

/**
 * The notice text (code, 0 AI), exactly as S6.
 */
export function speakFirstNoticeText(
  job: Ticket,
  allCalls: Ticket[]
): string {
  const result = speakFirstFor(job, allCalls);
  const buildingName = job.buildingName;
  const floor = job.floor;
  const count = result.count;
  const oppositePart = result.opposite ? ", with opposite fixes" : "";

  return `Speak first: ${buildingName} Level ${floor} has called ${count} times in 30 days${oppositePart} (repeat flag, TS-CC-09). Quick fixes are off for this spot. Find the cause before they call again.`;
}

/**
 * For a set of open jobs, returns the notices to post (those that
 * fire and have no existing notice for the same spot in 30 days).
 * Each spot gets at most one notice.
 */
export function speakFirstNotices(
  jobs: Ticket[],
  allCalls: Ticket[],
  existingNotices: SpeakFirstNotice[],
  asOfDate: Date = new Date()
): { job: Ticket; text: string; spotKey: string }[] {
  const notices: { job: Ticket; text: string; spotKey: string }[] = [];
  const postedSpots = new Set<string>();

  for (const job of jobs) {
    const result = speakFirstFor(job, allCalls);
    if (!result.fire) continue;
    if (postedSpots.has(result.spotKey)) continue;

    if (shouldPostSpeakFirst(job, allCalls, [...existingNotices, ...notices.map((n) => ({
      spotKey: n.spotKey,
      postedAt: new Date(asOfDate).toISOString(),
    }))], asOfDate)) {
      notices.push({
        job,
        text: speakFirstNoticeText(job, allCalls),
        spotKey: result.spotKey,
      });
      postedSpots.add(result.spotKey);
    }
  }

  return notices;
}
