/**
 * The demo's AI jobs, for `npm run ai:record` (S15 record mode, C6b).
 *
 * Each target is the same job spec the app runs, built from the same code
 * text, so a recorded answer lands on exactly the replay key the app asks for:
 * rank wording for 2318's leads (technician and senior manager, each before
 * and after each Not this tick) and for 2401's leads on v1.0 and on the v1.1
 * fixture; the tenant reply for 2318's visit-booked tips
 * (TS-CC-09); and the new solution from the fix line and why line it is given.
 *
 * It reads the seed, never the live memory, and runs at the demo clock.
 * This file and everything it imports must never import ai.ts or server-only:
 * ai-record runs it with tsx, outside Next.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { loadAndCheckPill, loadAndCheckPillFile, type Pill } from "./pill";
import { leadsForJob } from "./leads";
import { DEMO_NOW, type MemoryState, type Job } from "./memory";
import type { Tick } from "./rank";
import {
  rankWordingSpec,
  tenantReplySpec,
  newSolutionSpec,
  recordAnswer,
  readReplay,
  replayDir,
  type AiJobSpec,
  type ModelClient,
} from "./ai-core";

import { VISIT_BOOKED_LINE } from "./self-check";

/** The code line of a booked visit (S10 outcome 4), from the self-check itself. The tenant reply's replay key hashes it. */
export { VISIT_BOOKED_LINE };

export interface RecordTarget {
  spec: AiJobSpec<unknown>;
}

const CLOCK = new Date(DEMO_NOW);

function seedState(): MemoryState {
  const seed = JSON.parse(readFileSync(join(process.cwd(), "data", "seed-state.json"), "utf-8")) as MemoryState;
  seed.demoNow = DEMO_NOW;
  seed.resetRealTime = DEMO_NOW;
  return seed;
}

function fixturePill(): Pill {
  return loadAndCheckPillFile(join(process.cwd(), "tests", "fixtures", "ts-cc-v1.1.yaml"));
}

function notThis(causeId: string): Tick {
  return { causeId, type: "not-this", seat: "technician" };
}

function rankTargets(state: MemoryState, job: Job, seat: string, ticks: Tick[], pill: Pill): RecordTarget[] {
  const withTicks: Job = { ...job, ticks };
  const leads = leadsForJob(state, withTicks, seat, CLOCK, pill).leads;
  const place = { seat, version: pill.version, job: withTicks };
  return leads.map((lead) => ({ spec: rankWordingSpec(pill, lead, place) as AiJobSpec<unknown> }));
}

/**
 * Every demo answer to record. `only` picks one job: rank, tenant or solution.
 */
export function demoRecordTargets(
  lines: { fixLine: string; whyLine: string },
  only?: "rank" | "tenant" | "solution"
): RecordTarget[] {
  const state = seedState();
  const job2318 = state.jobs.find((j) => j.id === "2318");
  const job2401 = state.jobs.find((j) => j.id === "2401");
  if (!job2318 || !job2401) throw new Error("the seed has no 2318 or 2401");
  const v10 = loadAndCheckPill("ts-cc", "1.0");
  const targets: RecordTarget[] = [];

  if (!only || only === "rank") {
    // 2318 through both seats, at each tick state of the demo: before any tick,
    // after Not this on precool, and after Not this on min-airflow too. The
    // senior manager hears about 2318 at Reset (speak first, S6), so a "Why?"
    // there can come before the technician's ticks as well as after them.
    const tickStates: Tick[][] = [[], [notThis("precool")], [notThis("precool"), notThis("min-airflow")]];
    for (const seat of ["technician", "senior-manager"]) {
      for (const ticks of tickStates) targets.push(...rankTargets(state, job2318, seat, ticks, v10));
    }
    targets.push(
      ...rankTargets(state, job2401, "technician", [], v10),
      ...rankTargets(state, job2401, "technician", [], fixturePill())
    );
  }

  if (!only || only === "tenant") {
    const tips = v10.tenant_tips.filter((t) => t.rules.includes("TS-CC-09"));
    targets.push({
      spec: tenantReplySpec(v10, tips, VISIT_BOOKED_LINE, { seat: "tenant", version: "1.0", job: job2318 }) as AiJobSpec<unknown>,
    });
  }

  if (!only || only === "solution") {
    targets.push({
      spec: newSolutionSpec(v10, lines.fixLine, lines.whyLine, {
        seat: "senior-manager",
        version: "1.0",
        job: job2318,
      }) as AiJobSpec<unknown>,
    });
  }

  // One answer per key: the same lead and reason on two tick states is one answer.
  const seen = new Set<string>();
  return targets.filter((t) => (seen.has(t.spec.key) ? false : (seen.add(t.spec.key), true)));
}

export interface RecordCounts {
  passed: number;
  failed: number;
  unavailable: number;
  skipped: number;
}

/**
 * Record only what is missing, or saved with its pass flag false. An answer
 * already saved and passed is never called again.
 */
export async function recordMissing(
  targets: RecordTarget[],
  client: ModelClient,
  opts: { dir?: string; log?: (line: string) => void } = {}
): Promise<RecordCounts> {
  const dir = opts.dir ?? replayDir();
  const counts: RecordCounts = { passed: 0, failed: 0, unavailable: 0, skipped: 0 };
  for (const target of targets) {
    if (readReplay(target.spec.key, dir)?.pass) {
      counts.skipped += 1;
      continue;
    }
    const result = await recordAnswer(target.spec, client, { dir, log: opts.log });
    if (result === "passed") counts.passed += 1;
    else if (result === "failed-checks") counts.failed += 1;
    else counts.unavailable += 1;
  }
  return counts;
}
