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

/** How a job reached the senior manager (C7b): Not solved, or Send with the cause. */
export interface Escalation {
  route: "not-solved" | "send-with-cause";
  seat: string;
  at: string;
  /** The found lead it went up with, or null. */
  causeId: string | null;
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
  escalatedWith?: Escalation;
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
  /** Clear stop (C8a, S11): "Safety record: Fire Safety Manager told and agreed (role-played)", where the stop needs it. */
  safetyRecord?: string;
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
  kind:
    | "speak-first"
    | "low-confidence"
    | "alert"
    | "charge-request"
    | "escalated"
    /** C8a: a new solution sent to HQ (A2), and an outside help request (A3). */
    | "solution-sent"
    | "outside-help"
    /** C8b: a version went live everywhere, was rolled back, or HQ declined a solution (A2). */
    | "version-live"
    | "rolled-back"
    | "solution-declined";
  text: string;
  at: string;
  jobId?: string;
  spotKey?: string;
  /** An alert sent by typed safety words (S11): Raise this stop amends it instead of sending a second one. */
  typed?: boolean;
  /** The seat that pressed Raise this stop on a typed alert. */
  raisedBy?: string;
  /** The red stop an alert is about. Raise this stop finds the typed alert by it, not by its words. */
  stopId?: string;
  /**
   * The solution (S-n) or A3 request (A3-n) a notice to HQ asks about, so
   * "What needs me" drops it once HQ has decided it (C8b review); and the A4
   * request a charge-request notice to the AOM asks about (C9).
   */
  ref?: string;
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
  /** Saved by `solved` (C7b): the job's facts, the fix line and the one line of why (S7, S8). */
  facts?: string[];
  fix?: string;
  why?: string;
}

/** A rank wording made at a press (C7b), kept by its replay key so it shows only under the reason it worded. */
export interface StoredWording {
  aiWording: string | null;
  banner: string | null;
  notice: string | null;
  aiCalls: number;
}

/**
 * A version HQ approved (S16 items 8 to 11, C8b): like a commit. The signed
 * file itself lives in the runtime folder and is never written again. v1.0 is
 * not stored here: it ships in web/pills/ and A1 signed it.
 */
export interface VersionRecord {
  pillId: string;
  version: string;
  parent: string;
  /** SHA-256 of the signed file's YAML text: the draft the tests ran on. */
  hash: string;
  /** "HQ pill owner (role-played)". */
  signedBy: string;
  approvedBySeat: string;
  approvedAt: string;
  /** The why line of the solution it carries. */
  why: string;
  ruleId: string;
  jobId: string;
  solutionId: string;
  /** The signed file's name in the runtime folder's signed/ folder. */
  file: string;
  /** Set by Roll back (cut 10). Nothing is deleted: the version stays in the list. */
  rolledBackAt?: string;
  rolledBackBySeat?: string;
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
  /** The job each seat opened last (S2: the technician's home spot). Absent in the seed. */
  openJobBySeat?: Record<string, string>;
  /** Rank wordings made at a press, by replay key (C7b). Absent in the seed. */
  leadWordings?: Record<string, StoredWording>;
  /** The versions HQ approved, oldest first (C8b). Absent in the seed: v1.0 is A1's. */
  versions?: VersionRecord[];
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

/** web/data/runtime/, or the test worker's own folder next to its memory file. Drafts live here. */
export function runtimeDir(): string {
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
