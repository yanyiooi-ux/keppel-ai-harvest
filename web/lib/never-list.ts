/**
 * Never-list scanner (S13).
 *
 * Runs on every AI output and on every typed message.
 * Scans text for: prices, free offers, fault, other tenants/buildings/floors,
 * building system writes.
 * Returns the pill's never_list ids.
 */

import type { Pill, TenantTip } from "./pill";
import { checkWording } from "./wording-check";

export interface ScanResult {
  violated: string[];
  items: { id: string; text: string }[];
}

// Money marks and words
const moneyMarks = ["$", "s$", "sgd"];
const moneyWords = ["bucks", "dollars", "cents"];

// Free offer words
const freeOfferWords = [
  "waive", "waived", "waiving",
  "on the house", "complimentary",
  "goodwill credit", "refund", "rebate", "discount",
  "rent-free", "free of charge",
  "compensation", "compensate", "reimburse",
];

// Fault words
const faultWords = [
  "our fault", "our mistake", "our error",
  "sorry for our error", "we will cover it",
  "that one is on us", "we are responsible", "liable", "liability",
];

// Building system words
const bmsWords = [
  "write to the bms", "push it to the bms", "push to the system",
  "setpoint to the bms", "bms override", "override the",
  "change the schedule",
];

// For "push (up to 3 words) to the BMS"
function matchPushToBms(text: string): boolean {
  const lower = text.toLowerCase();
  // "push ... to the bms" with up to 3 words between push and "to the bms"
  const words = lower.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    if (words[i] === "push") {
      // Find "to the bms" within 4 words after "push"
      for (let j = i + 1; j <= Math.min(i + 4, words.length - 2); j++) {
        if (words[j] === "to" && words[j + 1] === "the" && words[j + 2] === "bms") {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Check if text has a money mark or money word next to a number.
 */
function matchPrice(text: string): boolean {
  const lower = text.toLowerCase();

  // $200, S$200, S$ 200
  if (/\$\s*\d/.test(lower)) return true;
  if (/s\$\s*\d/.test(lower)) return true;

  // SGD 200, 200 SGD
  if (/sgd\s*\d/.test(lower)) return true;
  if (/\d\s*sgd/.test(lower)) return true;

  // 200 bucks, two hundred dollars, cents
  if (/\d+\s*(bucks|dollars|cents)/.test(lower)) return true;
  if (/(two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|fifty|hundred|thousand)\s+(hundred|thousand)?\s*(dollars|bucks|cents)/.test(lower)) return true;

  return false;
}

/**
 * The never-list scanner. Replaces checkNeverList.
 * Scans text and returns the pill's never_list ids that were violated.
 */
export function scanNeverList(
  pill: Pill,
  text: string,
  context?: { tenant?: string; building?: string; floor?: number }
): ScanResult {
  const lower = text.toLowerCase();
  const violated: string[] = [];
  const items: { id: string; text: string }[] = [];

  for (const item of pill.never_list) {
    let triggered = false;

    if (item.id === "never-quote-price") {
      if (matchPrice(text)) triggered = true;
      if (freeOfferWords.some((w) => lower.includes(w))) triggered = true;
    }

    if (item.id === "never-admit-fault") {
      if (faultWords.some((w) => lower.includes(w))) triggered = true;
    }

    if (item.id === "never-cross-tenant") {
      // Check for other tenant names, buildings, or floors
      // This is checked against the context (tenant, building, floor)
      // For now, check for known tenant names not matching the context
      if (context) {
        const knownTenants = ["northwind advisory", "meridian partners"];
        for (const t of knownTenants) {
          if (lower.includes(t) && context.tenant && !t.includes(context.tenant.toLowerCase())) {
            triggered = true;
            break;
          }
        }
      } else {
        // Without context, any tenant name triggers
        if (knownTenantNames.some((t) => lower.includes(t))) triggered = true;
      }
    }

    if (item.id === "never-write-bms") {
      if (bmsWords.some((w) => lower.includes(w))) triggered = true;
      if (matchPushToBms(text)) triggered = true;
    }

    if (triggered) {
      violated.push(item.id);
      items.push(item);
    }
  }

  return { violated, items };
}

const knownTenantNames = ["northwind advisory", "meridian partners"];

/**
 * The 7 must-pass phrases (S13 item 7).
 * These should NOT trigger the scanner.
 */
const mustPassPhrases = [
  "1 deg C",
  "Level 23",
  "v1.1",
  "TS-CC-09",
  "ticket 2301",
  "check the BMS trend",
  "bump it 2 degrees",
];

/**
 * Test whether a phrase should pass (not trigger the scanner).
 */
export function passesNeverList(pill: Pill, text: string): boolean {
  const result = scanNeverList(pill, text);
  return result.violated.length === 0;
}

/**
 * The refusal card for a typed message that hits the never-list (S13 item 8).
 * Returns RS-10 card with AI calls 0 and a pointer line.
 */
export function neverListRefusalCard(
  pill: Pill,
  text: string
): { id: string; trigger: string; action: string; whoToCall: string; receipt: string; pointer: string } | null {
  const result = scanNeverList(pill, text);
  if (result.violated.length === 0) return null;

  const stop = pill.red_stops.find((s) => s.id === "RS-10");
  if (!stop) return null;

  let pointer = "";
  if (result.violated.includes("never-quote-price") || result.violated.includes("never-admit-fault")) {
    pointer = "Money and fault are the AOM's decision (A4)";
  }
  if (result.violated.includes("never-write-bms")) {
    pointer = "Settings are the senior manager's";
  }

  return {
    id: "RS-10",
    trigger: stop.trigger,
    action: stop.action,
    whoToCall: stop.who_to_call,
    receipt: `Red stop RS-10 · pill v${pill.version} · AI calls: 0`,
    pointer,
  };
}

/**
 * Hide amounts in text (S13 item 9).
 * Every amount becomes "[amount hidden]".
 */
export function hideAmounts(text: string): string {
  // Replace $200, S$200, S$ 200 with [amount hidden]
  let result = text.replace(/s?\$\s*\d+/gi, "[amount hidden]");
  // Replace SGD 200, 200 SGD
  result = result.replace(/sgd\s*\d+/gi, "[amount hidden]");
  result = result.replace(/\d+\s*sgd/gi, "[amount hidden]");
  // Replace 200 bucks, 200 dollars, 200 cents
  result = result.replace(/\d+\s*(bucks|dollars|cents)/gi, "[amount hidden]");
  // Replace two/three/etc hundred dollars
  result = result.replace(/(two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|fifty|hundred|thousand)\s+(hundred|thousand)?\s*(dollars|bucks|cents)/gi, "[amount hidden]");
  return result;
}

/**
 * Extra blocks on AI-drafted tenant text (S13 item 10).
 * TS-CC-02: "No cause, no blame, no price, no promised date,
 * no comfort range, no building settings."
 */
const tenantBlockWords = [
  "cause", "caused", "because", "due to", "the reason",
  "blame",
  "your fit-out", "your contractor", "your printer", "your heater",
  "today", "tomorrow", "tonight",
  "by monday", "by tuesday", "by wednesday", "by thursday", "by friday", "by saturday", "by sunday",
  "next week", "within",
  "degree", "degrees", "deg", "setpoint", "bms", "schedule",
];

/**
 * Check AI tenant text for extra blocks (S13 item 10).
 * Returns true if the text passes, false if it fails.
 * A fail falls back to the tips word for word.
 */
export function checkTenantText(
  text: string,
  context: { tenant: string; building: string; floor: number }
): { passes: boolean; violations: string[] } {
  const lower = text.toLowerCase();
  const violations: string[] = [];

  // Check for blocked words
  for (const word of tenantBlockWords) {
    if (lower.includes(word)) {
      violations.push(word);
    }
  }

  // Check at most 3 sentences
  const sentenceCount = (text.match(/[.!?]+/g) || []).length;
  if (sentenceCount > 3) {
    violations.push("too many sentences");
  }

  // Check against the job's own tenant, building and floor
  // (handled by scanNeverList for cross-tenant)

  return {
    passes: violations.length === 0,
    violations,
  };
}

/**
 * What the tenant sees (S10, S13 item 10, S14): the AI's wording of the chosen
 * tips when it passes the never-list (against the job's own tenant, building and
 * floor), the extra tenant-text blocks and the S14 wording check; otherwise, or
 * with the AI off, the chosen tips word for word from the pill.
 */
export function tenantReplyOrTips(
  pill: Pill,
  aiText: string | null,
  tips: TenantTip[],
  context: { tenant: string; building: string; floor: number }
): { source: "ai" | "tips"; lines: string[]; violations: string[] } {
  const tipLines = tips.map((t) => t.text);
  if (aiText === null || aiText.trim().length === 0) {
    return { source: "tips", lines: tipLines, violations: [] };
  }

  const violations = [
    ...scanNeverList(pill, aiText, context).violated,
    ...checkTenantText(aiText, context).violations,
    ...checkWording(aiText, tipLines.join(" "), "tenant").errors,
  ];
  return violations.length === 0
    ? { source: "ai", lines: [aiText], violations }
    : { source: "tips", lines: tipLines, violations };
}
