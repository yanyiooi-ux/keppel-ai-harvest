/**
 * Wording checks (S14).
 *
 * Code runs these checks on the AI output, never on the human input.
 * The AI never decides which rules apply or who wins.
 */

import type { Pill } from "./pill";

export interface WordingCheckResult {
  passes: boolean;
  errors: string[];
}

/**
 * Check rank wording (S14).
 * The rank reason is at most 2 sentences.
 */
export function checkRankWording(reason: string): WordingCheckResult {
  const errors: string[] = [];

  // At most 2 sentences
  const sentenceCount = (reason.match(/[.!?]+/g) || []).length;
  if (sentenceCount > 2) {
    errors.push("rank reason must be at most 2 sentences");
  }

  return {
    passes: errors.length === 0,
    errors,
  };
}

/**
 * Check tenant reply wording (S14).
 * At most 3 sentences.
 * No quote, no fault, no promise.
 */
export function checkTenantReplyWording(reply: string): WordingCheckResult {
  const errors: string[] = [];

  // At most 3 sentences
  const sentenceCount = (reply.match(/[.!?]+/g) || []).length;
  if (sentenceCount > 3) {
    errors.push("tenant reply must be at most 3 sentences");
  }

  // No quote, no fault, no promise (the never-list checks this too)
  const lower = reply.toLowerCase();
  if (/\$\s*\d/.test(lower)) errors.push("no quote");
  if (lower.includes("our fault") || lower.includes("liable")) errors.push("no fault");
  if (lower.includes("today") || lower.includes("tomorrow")) errors.push("no promise");

  return {
    passes: errors.length === 0,
    errors,
  };
}

/**
 * Check solution rule text wording (S14).
 * The draft rule is checked against the senior manager's fix line.
 */
export function checkSolutionWording(
  ruleText: string,
  fixLine: string
): WordingCheckResult {
  const errors: string[] = [];

  // The rule text must contain the key words from the fix line
  const fixWords = fixLine.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const ruleLower = ruleText.toLowerCase();
  const missingWords = fixWords.filter((w) => !ruleLower.includes(w));
  if (missingWords.length > 2) {
    errors.push(`rule text missing key words from fix line: ${missingWords.join(", ")}`);
  }

  return {
    passes: errors.length === 0,
    errors,
  };
}

/**
 * Check chip wording (S14).
 * At most 5 words, no quote, no fault.
 */
export function checkChipWording(chip: string): WordingCheckResult {
  const errors: string[] = [];

  // At most 5 words
  const wordCount = chip.split(/\s+/).filter((w) => w.length > 0).length;
  if (wordCount > 5) {
    errors.push("chip must be at most 5 words");
  }

  // No quote, no fault
  const lower = chip.toLowerCase();
  if (/\$\s*\d/.test(lower)) errors.push("no quote in chip");
  if (lower.includes("fault") || lower.includes("liable")) errors.push("no fault in chip");

  return {
    passes: errors.length === 0,
    errors,
  };
}

// ---- S14: the full check on any AI sentence shown under a code card or reason ----

/** Words the AI may use only when the code text it words uses them too (S14). */
export const BLOCKED_UNLESS_CODE_USES = [
  "unplug", "reset", "switch", "bypass", "override", "open", "isolate", "climb", "wedge", "turn",
  "pull the plug", "remove", "touch", "move", "disconnect", "restart", "power off", "shut", "cut", "tape",
] as const;

/** Phrases the AI may never use (S14). */
export const BLOCKED_ALWAYS = [
  "safe to touch", "fine to touch", "ok to touch", "ok to handle", "no danger", "guaranteed", "definitely",
] as const;

const WORD_NUMBERS: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9",
  ten: "10", eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15", sixteen: "16",
  seventeen: "17", eighteen: "18", nineteen: "19", twenty: "20", thirty: "30", forty: "40", fifty: "50",
  sixty: "60", seventy: "70", eighty: "80", ninety: "90", hundred: "100",
};

/** Word numbers become digits first (S14). */
export function digitsForWordNumbers(text: string): string {
  return text.replace(/\b[a-z]+\b/gi, (w) => WORD_NUMBERS[w.toLowerCase()] ?? w);
}

/** Sentences end at . ! or ? followed by a space or the end; "v1.1" and "3.5" do not end one. */
export function sentenceCount(text: string): number {
  return text
    .trim()
    .split(/[.!?]+(?:\s+|$)/)
    .filter((s) => s.trim().length > 0).length;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True when the text uses the word or phrase, with its usual endings (turn, turns, turned, turning). */
function usesWord(text: string, word: string): boolean {
  const stem = word.endsWith("e") ? `(?:${escapeRe(word)}|${escapeRe(word.slice(0, -1))})` : escapeRe(word);
  return new RegExp(`\\b${stem}(?:s|es|d|ed|ing)?\\b`, "i").test(text);
}

function tokens(text: string): { numbers: Set<string>; ruleIds: Set<string>; versions: Set<string> } {
  const t = digitsForWordNumbers(text);
  const ruleIds = new Set((t.match(/\bTS-CC-\d+\b/gi) ?? []).map((x) => x.toUpperCase()));
  const versions = new Set((t.match(/\bv\d+(?:\.\d+)+\b/gi) ?? []).map((x) => x.toLowerCase()));
  const numbers = new Set(t.match(/\d+(?:\.\d+)?/g) ?? []);
  return { numbers, ruleIds, versions };
}

export interface WordingResult {
  passes: boolean;
  errors: string[];
  /** What the screen shows: the code text always; the AI wording only when it passes. */
  shown: { code: string; aiWording: string | null };
}

/**
 * The S14 wording check. `codeText` is the code card or reason the AI words;
 * it always stays on screen. A fail shows only the code text.
 */
export function checkWording(aiText: string, codeText: string, kind: "rank" | "tenant"): WordingResult {
  const errors: string[] = [];
  const ai = digitsForWordNumbers(aiText);

  const max = kind === "rank" ? 2 : 3;
  const sentences = sentenceCount(ai);
  if (sentences > max) errors.push(`${kind === "rank" ? "rank wording" : "a tenant reply"} has ${sentences} sentences, at most ${max}`);

  const mine = tokens(aiText);
  const theirs = tokens(codeText);
  for (const id of mine.ruleIds) if (!theirs.ruleIds.has(id)) errors.push(`rule ${id} is not in the code text`);
  for (const v of mine.versions) if (!theirs.versions.has(v)) errors.push(`version ${v} is not in the code text`);
  for (const n of mine.numbers) if (!theirs.numbers.has(n)) errors.push(`the number ${n} is not in the code text`);

  for (const word of BLOCKED_UNLESS_CODE_USES) {
    if (usesWord(ai, word) && !usesWord(codeText, word)) errors.push(`"${word}" is blocked unless the code text uses it`);
  }
  const lower = ai.toLowerCase();
  for (const phrase of BLOCKED_ALWAYS) {
    if (lower.includes(phrase)) errors.push(`"${phrase}" is always blocked`);
  }

  const passes = errors.length === 0;
  return { passes, errors, shown: { code: codeText, aiWording: passes ? aiText : null } };
}
