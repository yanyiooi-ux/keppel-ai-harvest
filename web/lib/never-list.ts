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
import { loadBuildings } from "./facts";

export interface ScanResult {
  violated: string[];
  items: { id: string; text: string }[];
}

/**
 * Whose text it is: the job's own tenant, building (its id, such as "tower-a",
 * or its name) and floor, and the seat. Without it, only tenant names count.
 */
export interface ScanContext {
  tenant?: string;
  building?: string;
  floor?: number;
  seat?: string;
}

/** For these seats both buildings count as their own (S13 item 4). */
const BOTH_BUILDINGS_SEATS = ["hq", "senior-manager"];

/**
 * The buildings and floors a text names: "Tower B", "Building B", "Block 5",
 * "Level 12", "Floor 7", "L12", "12th floor". A building needs its letter or
 * number right after the word, so "the building" and "this floor" name nothing.
 */
export function placesNamed(text: string): { buildings: string[]; floors: number[] } {
  const buildings: string[] = [];
  for (const m of text.matchAll(/\b(tower|building|block|blk)\s+([A-Z]|\d{1,3})\b/gi)) {
    const word = m[1].toLowerCase();
    // "I" is the word I. After "building" or "block" a small letter is a word,
    // not a name ("building a case", "block a grille"); after "tower" it is a name.
    // "block" with a number is the new-solution menu's verb ("block 25"), not a place.
    if (m[2] === "I" || m[2] === "i") continue;
    if (/^[a-z]$/.test(m[2]) && word !== "tower") continue;
    if (word === "block" && /^\d/.test(m[2])) continue;
    buildings.push(`${word} ${m[2].toLowerCase()}`);
  }
  const floors: number[] = [];
  for (const m of text.matchAll(/\b(?:level|floor|storey|lvl|flr)\s*#?\s*(\d{1,3})\b/gi)) floors.push(Number(m[1]));
  for (const m of text.matchAll(/\b(\d{1,3})(?:st|nd|rd|th)\s+(?:floor|storey|level)\b/gi)) floors.push(Number(m[1]));
  for (const m of text.matchAll(/\bL(\d{1,3})\b/g)) floors.push(Number(m[1]));
  return { buildings, floors };
}

/**
 * True when the text names a building or floor that is not the seat's own
 * (S13 item 4): the job's own building and floor, or, for HQ and the senior
 * manager, every building and floor in buildings.json. With no building in the
 * context there is nothing to compare with, so nothing is blocked.
 */
function namesAnotherPlace(text: string, context: ScanContext): boolean {
  if (!context.building) return false;
  const named = placesNamed(text);
  if (named.buildings.length === 0 && named.floors.length === 0) return false;

  const own = context.building.toLowerCase();
  const all = loadBuildings();
  const both = BOTH_BUILDINGS_SEATS.includes(context.seat ?? "");
  const mine = both ? all : all.filter((b) => b.id.toLowerCase() === own || b.name.toLowerCase() === own);
  const ownNames = new Set([own.replace(/-/g, " "), ...mine.map((b) => b.name.toLowerCase())]);
  const ownFloors = new Set<number>(
    both ? mine.flatMap((b) => b.floors.map((f) => f.floor)) : context.floor !== undefined ? [context.floor] : []
  );

  if (named.buildings.some((b) => !ownNames.has(b))) return true;
  if (ownFloors.size > 0 && named.floors.some((f) => !ownFloors.has(f))) return true;
  return false;
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
export function scanNeverList(pill: Pill, text: string, context?: ScanContext): ScanResult {
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
      // Another tenant's name, or a building or floor that is not the seat's
      // own (S13 item 4), checked against the context (tenant, building, floor, seat).
      if (context) {
        const knownTenants = ["northwind advisory", "meridian partners"];
        for (const t of knownTenants) {
          if (lower.includes(t) && context.tenant && !t.includes(context.tenant.toLowerCase())) {
            triggered = true;
            break;
          }
        }
        if (namesAnotherPlace(text, context)) triggered = true;
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
  text: string,
  context?: ScanContext
): { id: string; trigger: string; action: string; whoToCall: string; receipt: string; pointer: string } | null {
  const result = scanNeverList(pill, text, context);
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

  // The job's own tenant, building and floor are checked by scanNeverList
  // (never-cross-tenant), which tenantReplyOrTips runs with the same context.

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
  context: { tenant: string; building: string; floor: number; seat?: string }
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
