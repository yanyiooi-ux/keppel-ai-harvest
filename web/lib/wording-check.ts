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
