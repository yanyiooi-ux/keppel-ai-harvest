/**
 * Plain words for every code a judge can see (D1, 15 Oct: "plain words
 * everywhere").
 *
 * A render-time layer only. Nothing here changes what the engine says, what an
 * API returns, the pill's text, the safety stop wording, the tips, or any code
 * reason that feeds a saved AI answer. The screens put these words first and
 * keep the code after them as a small grey tag, so a judge can still trace it.
 *
 * Each rule, step and stop word was written from the pill's own text
 * (web/pills/ts-cc/v1.0.yaml, and the v1.1 fixture for TS-CC-27). Its `key` is
 * a word from that text, and a test checks the key is really there, so a plain
 * word can never drift away from what the code does.
 *
 * Pure and safe in the browser: it imports only types and the fact labels
 * (which import nothing).
 */

import { FACT_LABELS } from "./fact-labels";
import type { JobStatus, Notice } from "./memory";
import type { Tier } from "./rank";
import type { SeatId } from "./permissions";

export interface Grounded {
  /** The plain words a judge reads. */
  word: string;
  /** A word or phrase from the pill's own text for this code (checked by a test). */
  key: string;
}

// ---- The pill's rules ----

export const RULE_WORDS: Record<string, Grounded> = {
  "TS-CC-01": { word: "Ask 3 short questions, safety first", key: "safety screen" },
  "TS-CC-02": { word: "Send the tenant approved words only", key: "approved text" },
  "TS-CC-03": { word: "Smoke or fire: follow the fire plan", key: "fire emergency plan" },
  "TS-CC-04": { word: "Someone is hurt: call 995", key: "hurt" },
  "TS-CC-05": { word: "Fault in the air or fire system: never bypass it", key: "bypass" },
  "TS-CC-06": { word: "The AI never changes a building system", key: "building system" },
  "TS-CC-07": { word: "Heater under a desk: look, do not touch", key: "heater" },
  "TS-CC-08": { word: "Ceiling work needs a named yes and a safe setup", key: "ceiling" },
  "TS-CC-09": { word: "The repeat rule: no more quick fixes", key: "repeat flag" },
  "TS-CC-10": { word: "Renovated lately: get the renovation file", key: "fit-out file" },
  "TS-CC-11": { word: "Renovation items: check who owns them first", key: "ownership" },
  "TS-CC-12": { word: "Check the time of day first", key: "time pattern" },
  "TS-CC-13": { word: "Look for leftover manual settings", key: "overrides" },
  "TS-CC-14": { word: "Read the temperature records first", key: "trend" },
  "TS-CC-15": { word: "Air box stuck at low airflow: tell the chief engineer", key: "minimum airflow" },
  "TS-CC-16": { word: "Do not warm the air for the whole floor", key: "supply air temperature" },
  "TS-CC-17": { word: "Agree a visit time with the tenant", key: "access" },
  "TS-CC-18": { word: "Check the thermostat sensor is in the right spot", key: "sensor" },
  "TS-CC-19": { word: "Measure what people feel at their desks", key: "measure" },
  "TS-CC-20": { word: "Hot glass room: think sun first", key: "sun" },
  "TS-CC-21": { word: "First call: one small turn of the dial is allowed", key: "nudge" },
  "TS-CC-22": { word: "More dial turns need the chief engineer's yes", key: "setpoint change" },
  "TS-CC-23": { word: "Write everything on the ticket", key: "ticket" },
  "TS-CC-24": { word: "No simple fault, or the renovation: send it up", key: "escalate" },
  "TS-CC-25": { word: "Money questions go to the building manager", key: "money" },
  "TS-CC-26": { word: "Out of scope: stop and send it up", key: "out of scope" },
  // The demo's new rule (v1.1): the senior manager's fix line, approved by HQ.
  "TS-CC-27": { word: "Renovated lately: check the thermostat spot first", key: "thermostat" },
};

/** A rule added later than the demo's own. */
export const NEW_RULE_WORD = "A new rule the team added";

// ---- The red stops (a short name only; the stop's own words always show in full) ----

export const STOP_WORDS: Record<string, Grounded> = {
  "RS-01": { word: "Fire, smoke or a burning smell", key: "smoke" },
  "RS-02": { word: "Burning or electrical smell", key: "electrical smell" },
  "RS-03": { word: "Scorched plug, heater or socket", key: "scorched" },
  "RS-04": { word: "Water near the electrics", key: "water" },
  "RS-05": { word: "Someone is hurt or unwell", key: "hurt" },
  "RS-06": { word: "Air system or fire damper fault", key: "fire damper" },
  "RS-07": { word: "Cooling plant or gas leak", key: "refrigerant" },
  "RS-08": { word: "Air box stuck open, or no rule fits", key: "damper" },
  "RS-09": { word: "Unsafe ceiling work", key: "ceiling" },
  "RS-10": { word: "Asked the AI for something it may not do", key: "AI" },
};

// ---- Checklist steps, as the new rule's effects use them ----

/** "Put step n first" in plain words, for every step the code menu may put first. */
export const PUT_FIRST_WORDS: Record<number, Grounded> = {
  9: { word: "Look at the last 30 days of calls first", key: "complaint history" },
  10: { word: "Apply the repeat rule first", key: "repeat rule" },
  11: { word: "Get the renovation file first", key: "fit-out file" },
  12: { word: "Check who owns the renovation items first", key: "ownership" },
  13: { word: "Check if it is outside air-con hours first", key: "air-con hours" },
  15: { word: "Read the 2-week temperature records first", key: "2-week trend" },
  17: { word: "Check the morning start-up settings first", key: "pre-cool" },
  18: { word: "Check if the air box is stuck at low airflow first", key: "minimum airflow" },
  19: { word: "Send any warmer-air idea to the chief engineer first", key: "supply air temperature" },
  20: { word: "Agree a visit time with the tenant first", key: "agree a time" },
  21: { word: "Check where the thermostat sensor sits first", key: "sensor" },
  22: { word: "Check for drafts near the lift first", key: "drafts" },
  23: { word: "Check the sun, the glass and the blinds first", key: "blinds" },
  29: { word: "Ask for an air balancing check first", key: "air balancing" },
  30: { word: "Let the building manager decide money first", key: "money" },
};

/** "Block step n" in plain words: the code menu allows block on the dial turn (step 25) only. */
export const BLOCK_WORDS: Record<number, Grounded> = {
  25: { word: "Don't just turn the dial", key: "setpoint nudge" },
};

// ---- Lead tiers (rank.ts) ----

export const TIER_WORDS: Record<Tier, string> = {
  found: "This is the cause",
  "signed-rule": "An approved rule puts this first",
  "case-backed": "Past cases back this up",
  "low-confidence": "Not sure yet: under 3 past cases",
  "net-failed": "Past fixes for this mostly failed",
};

// ---- Job statuses ----

export const STATUS_WORDS: Record<JobStatus, string> = {
  reported: "Reported, not looked at yet",
  "self-check": "Tenant is answering questions",
  "visit-booked": "Visit booked",
  "in-progress": "Technician is on it",
  "pending-30-day": "Fixed, now watched for 30 days",
  won: "Fixed for good: no call in 30 days",
  failed: "Came back within 30 days",
  escalated: "Sent up to the senior manager",
  "new-solution-drafted": "New fix being written",
  "approved-and-distributed": "New fix approved and sent out",
  "outside-help-requested": "Waiting on head office for outside help",
};

// ---- Notices ----

export const NOTICE_WORDS: Record<Notice["kind"], string> = {
  "speak-first": "This spot keeps calling",
  "low-confidence": "Pip is not sure yet",
  alert: "Safety alert",
  "charge-request": "Who pays?",
  escalated: "Sent up to you",
  "solution-sent": "New fix sent to head office",
  "outside-help": "Outside help asked",
  "version-live": "New version is live",
  "rolled-back": "Version rolled back",
  "solution-declined": "New fix turned down",
};

// ---- The 4 approvals ----

export const APPROVAL_IDS = ["A1", "A2", "A3", "A4"] as const;
export type ApprovalId = (typeof APPROVAL_IDS)[number];

export const APPROVAL_WORDS: Record<ApprovalId, string> = {
  A1: "Experts signed version 1",
  A2: "Head office approves a new fix",
  A3: "Head office approves outside help or money",
  A4: "Building manager decides who pays",
};

/** What each approval is about, short, for "Approves ..." lines. */
export const APPROVAL_WHAT: Record<ApprovalId, string> = {
  A1: "version 1",
  A2: "new fixes",
  A3: "outside help or money",
  A4: "who pays",
};

// ---- The checks before HQ may approve a new fix (S16 item 8, hq-flow.ts) ----

export const GATE_WORDS: Record<string, string> = {
  tests: "Every test passed, and every case was run",
  hash: "The tests ran on this exact draft",
  "red-stops": "The safety stops did not change",
  "pill-check": "The new version passes the pill's own checks",
  // Already plain in hq-flow.ts (BASE_CHECK_LABEL), so the same words.
  base: "Built on the version live now",
};

export function gateWord(id: string): string {
  return GATE_WORDS[id] ?? id;
}

// ---- Seats ----

export const SEAT_WORDS: Record<SeatId, string> = {
  tenant: "Tenant",
  technician: "Technician",
  "senior-manager": "Senior manager",
  hq: "Head office (HQ)",
  "aom-tower-a": "Building manager (AOM)",
};

// ---- Facts (S5) ----

export const FACT_WORDS: Record<string, string> = {
  "cold-mornings": "Cold in the mornings",
  "hot-afternoons": "Hot in the afternoons",
  "cold-other": "Too cold",
  "hot-other": "Too hot",
  "core-zone": "Middle of the floor, near the lifts",
  "west-zone": "West side, by the windows",
  "east-zone": "East side of the floor",
  repeat: "This spot keeps calling",
  "opposite-fixes": "Turned up, then down again",
  "fit-out-12m": "Renovated in the last 12 months",
  vav: "Air box (VAV)",
  fcu: "Fan coil unit",
};

// ---- Lookups ----

export function ruleWord(id: string): string {
  if (RULE_WORDS[id]) return RULE_WORDS[id].word;
  return /^TS-CC-\d{2}$/.test(id) ? NEW_RULE_WORD : id;
}

export function stopWord(id: string): string {
  return STOP_WORDS[id]?.word ?? "Safety stop";
}

export function tierWord(tier: string): string {
  return TIER_WORDS[tier as Tier] ?? tier.replace(/-/g, " ");
}

export function statusWord(status: string): string {
  return STATUS_WORDS[status as JobStatus] ?? status.replace(/-/g, " ");
}

export function noticeWord(kind: string): string {
  return NOTICE_WORDS[kind as Notice["kind"]] ?? kind.replace(/-/g, " ");
}

export function approvalWord(id: string): string {
  return APPROVAL_WORDS[id as ApprovalId] ?? id;
}

export function seatWord(seat: string): string {
  return SEAT_WORDS[seat as SeatId] ?? seat;
}

export function factWord(id: string): string {
  return FACT_WORDS[id] ?? FACT_LABELS[id] ?? id;
}

/** The fact id behind a fact label on screen ("renovation in the last 12 months" is fit-out-12m). */
export function factIdFromLabel(label: string): string | null {
  return Object.keys(FACT_LABELS).find((id) => FACT_LABELS[id] === label) ?? null;
}

/** An effect value from the code menu ("block:25", "put-first:21", "none") in plain words. */
export function effectWord(value: string): string {
  if (value === "none") return "No second effect";
  const m = /^(block|put-first):(\d+)$/.exec(value);
  if (!m) return value;
  const step = Number(m[2]);
  const found = m[1] === "block" ? BLOCK_WORDS[step] : PUT_FIRST_WORDS[step];
  if (found) return found.word;
  return m[1] === "block" ? `Skip step ${step}` : `Do step ${step} first`;
}

/** The effect value behind its menu label ("Block step 25", "Put step 21 first"), or null. */
export function effectValueFromLabel(label: string): string | null {
  const block = /^Block step (\d+)$/.exec(label);
  if (block) return `block:${block[1]}`;
  const first = /^Put step (\d+) first$/.exec(label);
  if (first) return `put-first:${first[1]}`;
  return label === "No second effect" ? "none" : null;
}

/**
 * The seat's "Pip never ..." line as a sentence a judge reads easily: "Pip
 * will never approve anything". The line itself (seat-opening.ts, the same
 * table the server checks) is left as it is.
 */
export function pipNeverLine(line: string): string {
  return line.replace(/^Pip never /, "Pip will never ");
}

/** "1.1" or "v1.1" as words. */
export function versionWord(version: string): string {
  return `version ${version.replace(/^v/, "")}`;
}

// ---- Codes inside a sentence ----

export type CodeKind = "rule" | "stop" | "approval";

export type TextPart = { kind: "text"; text: string } | { kind: "code"; code: string; codeKind: CodeKind; word: string };

/**
 * The codes a sentence can carry: a rule id, a red stop id, or an approval in
 * brackets ("(A2)"). Request ids such as A4-1 and job numbers are left alone.
 */
const CODE_PATTERN = /TS-CC-\d{2}|RS-\d{2}|\(A[1-4]\)/g;

/** Plain words for one code, or null when the code is not one this layer knows. */
export function codeWord(code: string): string | null {
  if (/^TS-CC-\d{2}$/.test(code)) return ruleWord(code);
  if (/^RS-\d{2}$/.test(code)) return STOP_WORDS[code]?.word ?? null;
  if (/^A[1-4]$/.test(code)) return approvalWord(code);
  return null;
}

/**
 * Splits a sentence into its own words and the codes in it, each code with its
 * plain words. Joining the text parts and the codes gives back the sentence
 * exactly, so nothing the engine said is lost.
 */
export function splitCodes(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(CODE_PATTERN)) {
    const at = m.index ?? 0;
    const raw = m[0];
    const code = raw.startsWith("(") ? raw.slice(1, -1) : raw;
    const word = codeWord(code);
    if (word === null) continue;
    const kind: CodeKind = code.startsWith("TS-CC") ? "rule" : code.startsWith("RS") ? "stop" : "approval";
    const before = text.slice(last, at) + (raw.startsWith("(") ? "(" : "");
    if (before) parts.push({ kind: "text", text: before });
    parts.push({ kind: "code", code, codeKind: kind, word });
    last = at + raw.length - (raw.startsWith("(") ? 1 : 0);
  }
  const rest = text.slice(last);
  if (rest) parts.push({ kind: "text", text: rest });
  return parts;
}

/** The sentence as a judge reads it, in one string: each code's plain words, then the code. */
export function plainSentence(text: string): string {
  return splitCodes(text)
    .map((p) => (p.kind === "text" ? p.text : p.codeKind === "rule" ? `“${p.word}” ${p.code}` : `${p.word} ${p.code}`))
    .join("");
}
