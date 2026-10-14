/**
 * Versions like commits (S16 items 8, 10 and 11, C8b).
 *
 * v1.0 ships in web/pills/ and A1 signed it (two senior experts,
 * role-played). Every later version is a draft HQ approved: its file is signed
 * once into the runtime folder's signed/ folder and never written again, and
 * the memory keeps its record: parent, hash, who signed it and when, and its
 * why line. Roll back only moves the live pointers; it deletes nothing, so a
 * rolled-back version stays in the list.
 *
 * Read only. Every word comes from the memory, the pill files or A1's line.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { signedPillPath } from "./pill";
import { draftHash, nextVersion } from "./draft";
import { dayMonth } from "./technician-flow";
import type { CardColour } from "./seat-view";
import type { MemoryState, VersionRecord } from "./memory";

export { signedPillPath };

/** Who signs a version HQ approves (S16 item 8). */
export const HQ_SIGNATURE = "HQ pill owner (role-played)";

export const BASE_VERSION = "1.0";

export type VersionStatus = "live" | "rolled back" | "earlier";

export interface VersionRow {
  version: string;
  /** The version it was built on; null for v1.0. */
  parent: string | null;
  hash7: string;
  /** "v1.1 · 3f2a9c1 · approved by HQ pill owner (role-played) · parent v1.0" (S16 item 10). */
  line: string;
  status: VersionStatus;
  /** A status always carries its word (S21). */
  statusWord: string;
  colour: CardColour;
  signedBy: string;
  /** "6 Oct, 10:05"; null for v1.0, which A1 signed before the demo. */
  when: string | null;
  why: string | null;
  ruleId: string | null;
}

const STATUS_WORDS: Record<VersionStatus, { word: string; colour: CardColour }> = {
  live: { word: "Live", colour: "green" },
  "rolled back": { word: "Rolled back", colour: "amber" },
  earlier: { word: "Earlier", colour: "none" },
};

/** "1.10" is newer than "1.9". */
export function compareVersions(a: string, b: string): number {
  const [am, an] = a.split(".").map(Number);
  const [bm, bn] = b.split(".").map(Number);
  return am !== bm ? am - bm : an - bn;
}

/** The versions HQ approved, oldest first. */
export function versionRecords(state: MemoryState): VersionRecord[] {
  return state.versions ?? [];
}

/** The newest version live in any building now. Distribution and rollback move every building together. */
export function liveVersion(state: MemoryState): string {
  const live = Object.values(state.liveVersionByBuilding);
  return live.length === 0 ? BASE_VERSION : live.reduce((a, b) => (compareVersions(a, b) >= 0 ? a : b));
}

/** The record of a version HQ approved, or undefined (v1.0 has none). */
export function versionRecord(state: MemoryState, version: string): VersionRecord | undefined {
  return versionRecords(state).find((r) => r.version === version);
}

/**
 * The version a new solution becomes (S16 item 8: a later solution starts the
 * next version): one step above its base, past every version already made,
 * live, rolled back, shipped or signed. A rolled-back v1.1 is never built again.
 */
export function nextFreeVersion(state: MemoryState, base: string, pillId = "ts-cc"): string {
  const taken = (v: string) =>
    versionRecords(state).some((r) => r.version === v) ||
    existsSync(signedPillPath(pillId, v)) ||
    existsSync(join(process.cwd(), "pills", pillId, `v${v}.yaml`));
  let version = nextVersion(base);
  while (taken(version)) version = nextVersion(version);
  return version;
}

function whenOf(at: string): string {
  return `${dayMonth(at)}, ${at.slice(11, 16)}`;
}

function shippedHash7(version: string, pillId = "ts-cc"): string {
  const path = join(process.cwd(), "pills", pillId, `v${version}.yaml`);
  return existsSync(path) ? draftHash(readFileSync(path, "utf-8")).slice(0, 7) : "";
}

function statusOf(state: MemoryState, version: string, rolledBack: boolean): VersionStatus {
  if (Object.values(state.liveVersionByBuilding).includes(version)) return "live";
  return rolledBack ? "rolled back" : "earlier";
}

/**
 * The versions list HQ sees (S16 item 10), newest first: each approved version
 * with its hash, who approved it, its parent, when and its why line, then v1.0
 * with A1's signature.
 */
export function versionList(state: MemoryState): VersionRow[] {
  const rows: VersionRow[] = [...versionRecords(state)].reverse().map((r) => {
    const status = statusOf(state, r.version, Boolean(r.rolledBackAt));
    const hash7 = r.hash.slice(0, 7);
    return {
      version: r.version,
      parent: r.parent,
      hash7,
      line: `v${r.version} · ${hash7} · approved by ${r.signedBy} · parent v${r.parent}${r.rolledBackAt ? " · rolled back" : ""}`,
      status,
      statusWord: STATUS_WORDS[status].word,
      colour: STATUS_WORDS[status].colour,
      signedBy: r.signedBy,
      when: whenOf(r.approvedAt),
      why: r.why,
      ruleId: r.ruleId || null,
    };
  });

  // A1's line names the version first ("v1.0 signed by ..."): the row keeps only who signed it.
  const signedBy = state.a1Line.replace(/^v1\.0\s+/, "");
  const hash7 = shippedHash7(BASE_VERSION);
  const status = statusOf(state, BASE_VERSION, false);
  rows.push({
    version: BASE_VERSION,
    parent: null,
    hash7,
    line: `v${BASE_VERSION} · ${hash7} · ${signedBy}`,
    status,
    statusWord: STATUS_WORDS[status].word,
    colour: STATUS_WORDS[status].colour,
    signedBy,
    when: null,
    why: null,
    ruleId: null,
  });
  return rows;
}
