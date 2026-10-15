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
  "TS-CC-25": { word: "Money questions go to the Asset Operations Manager", key: "money" },
  "TS-CC-26": { word: "Out of scope: stop and send it up", key: "out of scope" },
  // No fixed word for TS-CC-27 or later (D1 review): draft.ts gives that id to
  // whatever rule the senior manager writes first, so a fixed meaning could be
  // wrong. Every rule after the signed 26 reads as NEW_RULE_WORD.
};

/** A rule the team added after the signed 26 (TS-CC-27 and on). Its meaning is whatever the senior manager wrote. */
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
  // Short enough for the picker on a phone (D1 review); the plan's own draft words.
  21: { word: "Check where the thermostat sits first", key: "sensor" },
  22: { word: "Check for drafts near the lift first", key: "drafts" },
  23: { word: "Check the sun, the glass and the blinds first", key: "blinds" },
  29: { word: "Ask for an air balancing check first", key: "air balancing" },
  30: { word: "Let the Asset Operations Manager decide money first", key: "money" },
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
  A4: "Asset Operations Manager decides who pays",
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

/**
 * YY, 16 Oct (D4): the AOM seat reads "Asset Operations Manager" wherever a
 * person reads it. The seat id aom-tower-a and the engine's own lines stay.
 */
export const AOM_NAME = "Asset Operations Manager";

export const SEAT_WORDS: Record<SeatId, string> = {
  tenant: "Tenant",
  technician: "Technician",
  "senior-manager": "Senior manager",
  hq: "Head office (HQ)",
  "aom-tower-a": AOM_NAME,
};

/**
 * A line from the engine or a view with the AOM's short name read as the full
 * name: "AOM Tower A: Decide charge" reads "Asset Operations Manager, Tower A:
 * Decide charge". Render-time only; the line itself is left as it is.
 */
export function aomWords(text: string): string {
  return text.replace(/\bAOM,? Tower A\b/g, `${AOM_NAME}, Tower A`).replace(/\bAOM\b/g, AOM_NAME);
}

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

// ---- Words that need a short gloss (D1 review) ----

/**
 * What "speak first" means, said once where the notice shows. S6: the alert to
 * the senior manager (the chief engineer) when a spot trips the repeat flag;
 * quick fixes are off there until the cause is found.
 */
export const SPEAK_FIRST_MEANS =
  "Speak first means: this spot keeps calling, so the chief engineer is told first. No more quick dial turns here until the real cause is found.";

/** Why the Building B card is there, said before it (D1 review). */
export const BUILDING_B_INTRO =
  "Building B uses the same rule book. Watch its list of likely causes change once head office approves the new fix.";

/** What "pill" means, said where a judge first meets the word. */
export const PILL_MEANS = "The pill is the rule book: the signed steps and rules Pip follows for too-cold and too-hot calls.";

// ---- One name for the pill (D2 review) ----

/**
 * The thing that is fixed once and sent to every building has one name on
 * screen: the rule book. The engine's own words call it the pill, the brain or
 * the HQ pill owner's; this says them as the rule book. The receipt's "pill
 * v1.0" is the trace code and stays, explained once by PILL_MEANS.
 */
export function ruleBookWords(text: string): string {
  return text
    .replace(/\bHQ pill owner\b/g, "head office, owner of the rule book")
    .replace(/\bsame brain\b/g, "same rule book")
    .replace(/\bof the brain\b/g, "of the rule book");
}

/**
 * The line before the Building B card: why it is there, and once a new version
 * is live, what it changed there. Building B gets a new version the moment head
 * office approves it (S16), so nobody there does anything.
 */
export function buildingBLine(version: string, firstCause: string | null | undefined): string {
  if (version === "1.0" || !firstCause) return BUILDING_B_INTRO;
  return `Building B now runs version ${version} of the rule book. Its list starts with "${firstCause}". Nobody in Building B had to do anything.`;
}

// ---- A raised red stop (D2 review) ----

/**
 * What a press on a red stop did, said on the stop's card once it is raised.
 * The same rules as locksForStop and alertsForStop (safety.ts), checked by a
 * test: RS-10 locks nothing and alerts no one; a button RS-08 locks its zone;
 * every other stop locks the open jobs on its floor and alerts the senior
 * manager and the Asset Operations Manager. The stop's own words never change.
 */
export function raisedWords(stopId: string): string {
  if (stopId === "RS-10") return "This stop locks no work and sends no alert.";
  const where = stopId === "RS-08" ? "in this zone" : "on this floor";
  return `One press raised this stop. Open jobs ${where} are locked until someone clears it. Pip alerted the senior manager and the ${AOM_NAME}.`;
}

/** On a typed-words card whose stop was raised after it, in place of its Raise this stop button. */
export const RAISED_BELOW = "This stop was raised: see the card below.";

/** A check's source file in plain words: "(buildings.json)" reads "(from the building records)". */
export function sourceWords(text: string): string {
  return text.replace(/\(buildings\.json\)/g, "(from the building records)");
}

/**
 * A seat's opening line with its two notice names in plain words. The line
 * itself (seat-opening.ts) is left as it is.
 */
export function plainOpening(text: string): string {
  return text.replace(
    "the speak-first and low-confidence notices",
    "warnings about spots that keep calling, and notes when Pip is not sure"
  );
}

/** A seat's label (SEAT_LABELS) with its short names in plain words. The label itself is left as it is. */
export function seatLabelWords(label: string): string {
  return label
    .replace(/^HQ pill owner:/, "Head office (HQ), owner of the rule book:")
    .replace(/^AOM, Tower A: Keppel Asset Operations Manager/, `${AOM_NAME}, Tower A: Keppel`)
    .replace(/^AOM, Tower A:/, `${AOM_NAME}, Tower A:`);
}

/** The AI switch's three positions in plain words (S15's Live, Replay, Off). */
export const AI_MODE_WORDS = {
  live: "Live",
  replay: "Saved answers",
  off: "Off",
} as const;

/** One short line on what the switch's position does right now. */
export const AI_MODE_HINTS = {
  live: "Live: Pip asks Tencent's Hunyuan AI now, a new AI call each time.",
  replay: "Saved answers: real answers from Tencent's Hunyuan AI, saved earlier. No new AI call is made.",
  off: "Off: no AI at all. Every card shows the code's own words.",
} as const;

/**
 * A card's receipt when the AI line on it is a saved answer (S15 replay): its
 * "AI calls: 0" counts new calls only, so it says so, and says a saved answer
 * is shown. Any other receipt is left as it is.
 */
export function receiptWords(receipt: string, savedShown: number): string {
  if (savedShown <= 0) return receipt;
  const said = savedShown === 1 ? "1 saved AI answer shown" : `${savedShown} saved AI answers shown`;
  return receipt.replace(/AI calls: (\d+)/, (_m, n: string) => `${said}, new AI calls: ${n}`);
}

/** Short forms in the pill's own words, explained in a line under them (the words themselves never change). */
export const GLOSSARY: Record<string, string> = {
  LEW: "licensed electrical worker",
  AHU: "air handling unit, the big fan unit",
  VAV: "air box that sets how much cool air comes out",
  FCU: "fan coil unit",
  BMS: "building control system",
  FM: "facilities management",
  AOM: "Asset Operations Manager",
  SCDF: "Singapore's fire and ambulance service",
  CERT: "the building's own emergency response team",
};

/** The short forms a text uses, in the order the glossary lists them, each with its meaning. */
export function glossFor(text: string): { short: string; means: string }[] {
  return Object.entries(GLOSSARY)
    .filter(([short]) => new RegExp(`\\b${short}\\b`).test(text))
    .map(([short, means]) => ({ short, means }));
}

/** /how's ranking steps with their tier codes in plain words (the view's own text is left as it is). */
export function rankStepWords(text: string): string {
  return text
    .replace("then low confidence, then net failed.", "then causes with under 3 past cases, then causes whose past fixes failed more often than they worked.")
    .replace("Every lead carries its code reason.", "Every cause says why it is in that spot.");
}

/**
 * The step an effect works on, said before the step's own words so it never
 * reads as the opposite of the effect: block stops that step, put-first moves
 * it to the front.
 */
export function effectStepLead(value: string): string | null {
  if (value.startsWith("block:")) return "This stops the old step that said:";
  if (value.startsWith("put-first:")) return "This moves this step to the front:";
  return null;
}

// ---- Codes inside a sentence ----

export type CodeKind = "rule" | "stop" | "approval" | "status";

export type TextPart = { kind: "text"; text: string } | { kind: "code"; code: string; codeKind: CodeKind; word: string };

/**
 * The codes a sentence can carry: a rule id, a red stop id, an approval in
 * brackets ("(A2)"), or a job status right after "Status: ". Request ids such
 * as A4-1 and job numbers are left alone.
 */
const CODE_PATTERN = new RegExp(
  `TS-CC-\\d{2}|RS-\\d{2}|\\(A[1-4]\\)|(?<=Status: )(?:${Object.keys(STATUS_WORDS)
    .sort((a, b) => b.length - a.length)
    .join("|")})\\b`,
  "g"
);

/** Plain words for one code, or null when the code is not one this layer knows. */
export function codeWord(code: string): string | null {
  if (/^TS-CC-\d{2}$/.test(code)) return ruleWord(code);
  if (/^RS-\d{2}$/.test(code)) return STOP_WORDS[code]?.word ?? null;
  if (/^A[1-4]$/.test(code)) return approvalWord(code);
  if (code in STATUS_WORDS) return STATUS_WORDS[code as JobStatus];
  return null;
}

/** A red stop's receipt line ("Red stop RS-04 · ..."): the trace line of a safety card, left word for word. */
function inStopReceipt(text: string, at: number): boolean {
  return text.slice(Math.max(0, at - 9), at) === "Red stop " && text.slice(at + 5, at + 8) === " · ";
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
    // A safety alert's receipt keeps its stop code bare (S11): no name is put into it.
    if (code.startsWith("RS-") && inStopReceipt(text, at)) continue;
    const word = codeWord(code);
    if (word === null) continue;
    const kind: CodeKind = code.startsWith("TS-CC")
      ? "rule"
      : code.startsWith("RS")
        ? "stop"
        : /^A[1-4]$/.test(code)
          ? "approval"
          : "status";
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
