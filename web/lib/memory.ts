/**
 * The one shared memory (S20).
 *
 * Every chat reads and writes the same file, web/data/state.json, with fs at
 * request time. The file is never imported, so a running server always sees
 * the latest write.
 *
 * update() re-reads, applies a plain function with no await inside, writes a
 * temp file and renames it over state.json. A rename is atomic on the same
 * volume, so a slow AI call and a button press at the same time both survive:
 * the AI call runs before or after an update, never inside one.
 */

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, rmSync, readdirSync } from "fs";
import { join } from "path";
import type { Ticket } from "./rule-engine";
import type { Tick } from "./rank";

export const DEMO_NOW = "2026-10-06T10:00:00+08:00";

export type JobStatus =
  | "reported"
  | "self-check"
  | "visit-booked"
  | "in-progress"
  | "pending-30-day"
  | "won"
  | "failed"
  | "escalated"
  | "new-solution-drafted"
  | "approved-and-distributed"
  | "outside-help-requested";

export interface ImpactRecord {
  hoursLost: number;
  extraVisits: number;
  contractorOrPartsNeeded: boolean;
  cost?: number;
}

export interface Job extends Ticket {
  status: JobStatus;
  ticks: Tick[];
  selfCheckAnswers: Record<string, string>;
  foundLeadId: string | null;
  whyLine: string | null;
  fixerSeat: string | null;
  impact: ImpactRecord | null;
  notes: string[];
}

export interface OpenRedStop {
  stopId: string;
  building: string;
  floor: number;
  zone: string;
  jobId: string | null;
  source: "button" | "trend";
  openedBySeat: string;
  openedAt: string;
  clearedBySeat: string | null;
  clearedAt: string | null;
  clearedReason: string | null;
  lockedJobIds: string[];
}

export interface ChatMessage {
  seat: string;
  from: "person" | "pip";
  text: string;
  at: string;
  cards?: unknown[];
}

export interface Notice {
  seat: string;
  kind: "speak-first" | "low-confidence" | "alert";
  text: string;
  at: string;
  jobId?: string;
  spotKey?: string;
}

export interface RuntimeCase {
  id: string;
  jobId: string;
  building: string;
  floor: number;
  zone: string;
  symptom: string;
  causeId: string;
  fixedAt: string;
  fixedBy: string;
  confirmedBy: string | null;
}

export interface MemoryState {
  label: string;
  demoNow: string;
  resetRealTime: string;
  liveVersionByBuilding: Record<string, string>;
  a1Line: string;
  jobs: Job[];
  runtimeCases: RuntimeCase[];
  solutions: unknown[];
  requests: unknown[];
  openRedStops: OpenRedStop[];
  messages: ChatMessage[];
  notices: Notice[];
  speakFirstNotices: { spotKey: string; postedAt: string }[];
  lowConfidenceJobIds: string[];
  aiCalls: number;
}

function dataDir(): string {
  return join(process.cwd(), "data");
}

/**
 * The live memory file. Tests point this at their own copy so parallel test
 * files cannot clobber each other's demo.
 */
function statePath(): string {
  return process.env.PILL_DESK_STATE_FILE ?? join(dataDir(), "state.json");
}

/**
 * Every write gets its own temp name. A fixed one races: two writers landing
 * together would rename the same path, and the loser fails with ENOENT or, on
 * Windows, EPERM. The 2-second poll and a button press land together often.
 */
let writeCounter = 0;
function tempPath(): string {
  writeCounter += 1;
  return `${statePath()}.${process.pid}.${writeCounter}.tmp`;
}

function seedPath(): string {
  return join(dataDir(), "seed-state.json");
}

function runtimeDir(): string {
  const override = process.env.PILL_DESK_STATE_FILE;
  return override ? `${override}.runtime` : join(dataDir(), "runtime");
}

/**
 * Read the memory. Falls back to the seed when the live file is missing,
 * which is the first run after a fresh clone.
 */
export function read(): MemoryState {
  const live = statePath();
  const path = existsSync(live) ? live : seedPath();
  return JSON.parse(readFileSync(path, "utf-8")) as MemoryState;
}

/**
 * Apply a plain change to the memory and write it safely.
 * fn must not await: AI calls run before or after an update, never inside.
 */
export function update(fn: (state: MemoryState) => void): MemoryState {
  const state = read();
  fn(state);
  const temp = tempPath();
  writeFileSync(temp, JSON.stringify(state, null, 2), "utf-8");
  renameSync(temp, statePath());
  return state;
}

/**
 * The demo clock: demoNow plus the real time passed since Reset.
 * Engine functions take now as an argument so tests can set it.
 */
export function now(state: MemoryState, realNow: Date = new Date()): Date {
  const demo = new Date(state.demoNow).getTime();
  const since = realNow.getTime() - new Date(state.resetRealTime).getTime();
  return new Date(demo + Math.max(0, since));
}

/**
 * Reset (S20): copy the seed over the memory, clear runtime/, stamp the clock.
 * Speak first runs in resetDemo() in actions.ts, which has the tickets.
 */
export function resetToSeed(realNow: Date = new Date()): MemoryState {
  const seed = JSON.parse(readFileSync(seedPath(), "utf-8")) as MemoryState;
  seed.demoNow = DEMO_NOW;
  seed.resetRealTime = realNow.toISOString();

  const runtime = runtimeDir();
  if (existsSync(runtime)) {
    for (const name of readdirSync(runtime)) {
      rmSync(join(runtime, name), { recursive: true, force: true });
    }
  } else {
    mkdirSync(runtime, { recursive: true });
  }

  const temp = tempPath();
  writeFileSync(temp, JSON.stringify(seed, null, 2), "utf-8");
  renameSync(temp, statePath());
  return seed;
}

/**
 * The jobs a seat may see. Every seat sees every job in this demo;
 * the seat only changes which buttons are offered (S2).
 */
export function jobById(state: MemoryState, jobId: string): Job | undefined {
  return state.jobs.find((j) => j.id === jobId);
}
