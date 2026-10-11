/**
 * Safety stops (S11, S12).
 *
 * Safety is a stop, never an approval. A red stop says STOP and who to call,
 * word for word from the pill, with 0 AI calls.
 *
 * The Safety list: all 10 stops loaded from red_stops in the live pill at
 * run time, never typed into code.
 *
 * Typed safety words (S12): exact words and simple stems only. No typo matching.
 */

import type { Pill, RedStop, Rule } from "./pill";

// ---- Types ----

export interface SafetyCard {
  id: string;
  trigger: string;
  action: string;
  whoToCall: string;
  receipt: string;
  alerts: SafetyAlert[];
}

export interface SafetyAlert {
  seat: string;
  title: string;
  trigger: string;
  action: string;
  whoToCall: string;
  line: string;
}

export interface TypedSafetyResult {
  matchedStops: SafetyCard[];
  isPicker: boolean;
}

// ---- Safety list ----

/**
 * Load all 10 stops from the live pill's red_stops.
 */
export function safetyList(pill: Pill): RedStop[] {
  return pill.red_stops;
}

/**
 * Returns the safety card for a picked stop.
 * The card uses the pill's own words (trigger, action, who_to_call).
 */
export function safetyCardForStop(stop: RedStop, pillVersion: string): SafetyCard {
  return {
    id: stop.id,
    trigger: stop.trigger,
    action: stop.action,
    whoToCall: stop.who_to_call,
    receipt: `Red stop ${stop.id} · pill v${pillVersion} · AI calls: 0`,
    alerts: [],
  };
}

/**
 * Alerts for a stop, given the building name, floor, and seats to alert.
 * RS-01 to RS-09 alert the senior manager and the building's AOM.
 * RS-10 is a refusal card and alerts nobody.
 */
export function alertsForStop(
  stop: RedStop,
  buildingName: string,
  floor: number
): SafetyAlert[] {
  if (stop.id === "RS-10") {
    return [];
  }

  const title = `Red stop on ${buildingName}, Level ${floor}`;
  const line = `Red stop ${stop.id} · AI calls: 0`;

  return [
    {
      seat: "senior-manager",
      title,
      trigger: stop.trigger,
      action: stop.action,
      whoToCall: stop.who_to_call,
      line,
    },
    {
      seat: "aom",
      title,
      trigger: stop.trigger,
      action: stop.action,
      whoToCall: stop.who_to_call,
      line,
    },
  ];
}

// ---- Locks (S11) ----

/**
 * Which open jobs a stop locks.
 * RS-01 to RS-07 and RS-09: every open job on that building and floor.
 * RS-08 from the button: that ticket's zone only.
 * RS-08 from trend data: nothing.
 * RS-10: nothing (refusal card).
 */
export function locksForStop(
  stopId: string,
  jobSpot: { building: string; floor: number; zone: string },
  openJobs: { id: string; building: string; floor: number; zone: string }[],
  source: "button" | "trend" = "button"
): string[] {
  if (stopId === "RS-10") return [];
  if (stopId === "RS-08" && source === "trend") return [];

  if (stopId === "RS-08") {
    // Button-picked RS-08 locks that ticket's zone only
    return openJobs
      .filter(
        (j) =>
          j.building === jobSpot.building &&
          j.floor === jobSpot.floor &&
          j.zone === jobSpot.zone
      )
      .map((j) => j.id);
  }

  // RS-01 to RS-07 and RS-09: lock every open job on that building and floor
  return openJobs
    .filter(
      (j) => j.building === jobSpot.building && j.floor === jobSpot.floor
    )
    .map((j) => j.id);
}

/**
 * The lock line for a stop, read from the pill's not_when.
 * RS-01 to RS-04: TS-CC-03's not_when.
 * RS-05: TS-CC-04's not_when.
 * RS-06 and RS-07: TS-CC-05's not_when.
 * RS-08 and RS-09: no lock line.
 */
export function lockLineForStop(stopId: string, pill: Pill): string | null {
  if (stopId === "RS-08" || stopId === "RS-09") return null;

  const ruleIdMap: Record<string, string> = {
    "RS-01": "TS-CC-03",
    "RS-02": "TS-CC-03",
    "RS-03": "TS-CC-03",
    "RS-04": "TS-CC-03",
    "RS-05": "TS-CC-04",
    "RS-06": "TS-CC-05",
    "RS-07": "TS-CC-05",
  };

  const ruleId = ruleIdMap[stopId];
  if (!ruleId) return null;

  const rule = pill.rules.find((r) => r.id === ruleId);
  if (!rule) return null;

  return rule.not_when;
}

// ---- Typed safety words (S12) ----

/**
 * Word prep: lower case; drop apostrophes (can't becomes cant);
 * every other non-letter/digit becomes a space; split on spaces.
 */
export function prepWords(text: string): string[] {
  const lower = text.toLowerCase();
  // Drop apostrophes
  const noApos = lower.replace(/'/g, "");
  // Non-letter/digit becomes space
  const spaced = noApos.replace(/[^a-z0-9]/g, " ");
  // Split on spaces, remove empties
  return spaced.split(/\s+/).filter((w) => w.length > 0);
}

/**
 * Check if text has any non-Latin letters.
 */
function hasNonLatin(text: string): boolean {
  // Check for characters outside the Latin basic range
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    // Allow basic Latin letters, digits, space, apostrophe, common punctuation
    if (code > 0x017F) {
      return true;
    }
  }
  return false;
}

// Red phrases by stop id

const redPhrases: Record<string, string[]> = {
  "RS-01": [
    "smoke", "smokes", "smoked", "smoking", "smoky",
    "flame", "flames", "flaming",
    "on fire", "caught fire", "catch fire", "catching fire",
    "a fire", "fire alarm", "fire alarms",
  ],
  "RS-02": [
    "burning smell", "burning smells", "burnt smell", "burnt smells",
    "burned smell", "electrical smell", "electrical smells",
    "electric smell", "smell of burning", "smells of burning",
    "smelling of burning",
  ],
  "RS-03": [
    // Red on their own
    "sparks", "sparking", "sparked",
    "electrocuted", "electric shock", "electric shocks",
    "got a shock", "getting a shock", "gave me a shock",
  ],
  "RS-04": [
    "dripping from the ceiling", "drips from the ceiling",
    "water from the ceiling", "wet ceiling", "wet ceilings",
    "wet tile", "wet tiles", "ceiling leak", "ceiling leaks",
    "ceiling leaking", "leaking ceiling",
  ],
  "RS-05": [
    "hurt", "hurts", "injured", "injury", "injuries",
    "faint", "faints", "fainted", "fainting",
    "collapse", "collapses", "collapsed",
    "unconscious", "bleeding", "bleeds",
    "passed out", "chest pain", "chest pains",
    "cannot breathe", "cant breathe", "can not breathe",
    "not breathing",
    "fell off", "fell from", "fallen off", "fallen from",
    "electrocuted",
  ],
  "RS-06": [
    "fire damper", "fire dampers",
    "ahu tripping", "ahu tripped", "ahu trips", "ahu keeps tripping",
    "air handler tripping", "air handler tripped", "air handler trips",
    "smoke detector", "smoke detectors",
  ],
  "RS-07": [
    "chiller", "chillers", "refrigerant", "refrigerants", "chilled water",
  ],
  "RS-09": [
    "alone", "on my own", "by myself",
    "no permit", "without a permit",
    "not isolated", "no isolation", "without isolation",
  ],
};

// Exception phrases (never red)

const exceptionPhrases: string[] = [
  "keep warm", "keeps warm", "keeping warm",
  "fire alarm test", "fire alarm tests", "fire alarm testing",
  "false alarm", "false alarms",
  "fire up", "fires up", "fired up", "firing up",
  // "burning hot" is a conditional exception (handled separately)
];

// RS-03 pairs (object + danger words)

const rs03ObjectWords = [
  "heater", "heaters", "plug", "plugs", "cord", "cords",
  "socket", "sockets", "outlet", "outlets", "charger", "chargers",
  "adaptor", "adaptors", "adapter", "adapters",
  "extension", "extensions", "power strip", "power strips",
  "wire", "wires", "wiring", "cable", "cables", "plastic",
];

const rs03DangerWords = [
  "hot", "warm", "spark", "sparks", "sparking", "sparked",
  "scorch", "scorched", "scorching",
  "melt", "melted", "melting",
  "discoloured", "discolored",
  "smoking", "burning", "burnt", "burned",
  "smell", "smells", "smelling",
];

// RS-02 breaker pair

const rs02BreakerWords = ["breaker tripped", "breaker trips", "breaker tripping"];
const rs02SmellWords = ["smell", "smells", "smelling"];

// RS-04 ceiling pair

const rs04CeilingWords = ["ceiling", "ceilings"];
const rs04DripWords = ["drip", "drips", "dripping", "dripped", "leak", "leaks", "leaking", "leaked", "wet"];

// RS-04 electrics pair

const rs04WaterWords = [
  "water", "drip", "drips", "dripping", "dripped",
  "leak", "leaks", "leaking", "leaked", "wet",
  "pool", "pooling", "pooled", "puddle", "puddles",
  "flood", "flooding", "flooded",
];
const rs04ElectricWords = [
  "light", "lights", "lighting", "power", "socket", "sockets",
  "outlet", "outlets", "plug", "plugs", "electrical", "electric",
  "electrics", "db", "db room", "floor box", "floor boxes",
  "power box", "power boxes", "comms room", "server room",
  "pc", "pcs", "computer", "computers",
];

// Picker words (cut 4: tested as not red, no picker shown)

const pickerWords = [
  "heater", "heaters", "water", "leak", "leaks", "leaking",
  "drip", "drips", "dripping", "wet", "pooling", "puddle", "puddles",
  "alarm", "alarms", "fire", "fires", "smell", "smells", "smelly",
  "fumes", "gas", "breaker", "breakers",
  "melting", "melted", "shock", "shocks", "shocked",
  "burning", "burnt", "flood", "flooding", "flooded",
  "unwell", "dizzy", "headache", "headaches", "sick",
  "short of breath", "breathless",
];

/**
 * Find all phrases (red and exception) in the word list.
 * Returns matched phrases with their positions and types.
 */
interface PhraseMatch {
  phrase: string;
  words: string[];
  startIndex: number;
  type: "red" | "exception";
  stopId?: string;
}

function findPhrases(words: string[]): PhraseMatch[] {
  const matches: PhraseMatch[] = [];

  // Collect all phrases to search: red phrases (by stop) and exceptions
  const allPhrases: { phrase: string; type: "red" | "exception"; stopId?: string }[] = [];

  for (const [stopId, phrases] of Object.entries(redPhrases)) {
    for (const phrase of phrases) {
      allPhrases.push({ phrase, type: "red", stopId });
    }
  }
  for (const phrase of exceptionPhrases) {
    allPhrases.push({ phrase, type: "exception" });
  }

  // "burning hot" is an exception only when no RS-03 object word is in the message
  const hasRS03Object = words.some((w) => rs03ObjectWords.includes(w));
  if (!hasRS03Object) {
    allPhrases.push({ phrase: "burning hot", type: "exception" });
  }

  // Search for each phrase in the word list
  for (const { phrase, type, stopId } of allPhrases) {
    const phraseWords = phrase.split(/\s+/);
    for (let i = 0; i <= words.length - phraseWords.length; i++) {
      let found = true;
      for (let j = 0; j < phraseWords.length; j++) {
        if (words[i + j] !== phraseWords[j]) {
          found = false;
          break;
        }
      }
      if (found) {
        matches.push({
          phrase,
          words: phraseWords,
          startIndex: i,
          type,
          stopId,
        });
      }
    }
  }

  return matches;
}

/**
 * Resolve matched phrases: longest first, a phrase uses up its words.
 * A shorter phrase that needs a used-up word does not match.
 * An exception beats a red phrase only when it is longer.
 * On equal length, red wins.
 * Two red phrases of equal length that overlap both match.
 */
function resolvePhrases(matches: PhraseMatch[]): { redMatches: PhraseMatch[]; usedWords: Set<number> } {
  // Sort by length (longest first), red before exception on equal length
  const sorted = [...matches].sort((a, b) => {
    if (b.words.length !== a.words.length) return b.words.length - a.words.length;
    // On equal length, red wins (comes first)
    if (a.type === "red" && b.type === "exception") return -1;
    if (a.type === "exception" && b.type === "red") return 1;
    return 0;
  });

  const usedWords = new Set<number>();
  const redMatches: PhraseMatch[] = [];

  for (const match of sorted) {
    // Check if any word in this match is already used
    let canMatch = true;
    for (let i = 0; i < match.words.length; i++) {
      if (usedWords.has(match.startIndex + i)) {
        canMatch = false;
        break;
      }
    }

    if (canMatch) {
      // Use up the words
      for (let i = 0; i < match.words.length; i++) {
        usedWords.add(match.startIndex + i);
      }
      if (match.type === "red") {
        redMatches.push(match);
      }
    }
  }

  return { redMatches, usedWords };
}

/**
 * Check RS-03 pairs (object + danger word).
 * A pair is one word from each list, anywhere in the message.
 * A pair may use words that a red phrase used, but never words an exception used.
 * A pair uses up nothing.
 */
function checkRS03Pairs(words: string[], exceptionUsedWords: Set<number>): boolean {
  const hasObject = words.some((w, i) => rs03ObjectWords.includes(w) && !exceptionUsedWords.has(i));
  const hasDanger = words.some((w, i) => rs03DangerWords.includes(w) && !exceptionUsedWords.has(i));
  return hasObject && hasDanger;
}

/**
 * Check RS-02 breaker pair.
 */
function checkRS02Pairs(words: string[], exceptionUsedWords: Set<number>): boolean {
  // breaker tripped/trips/tripping is a multi-word phrase
  const hasBreaker = words.some((w, i) => {
    if (exceptionUsedWords.has(i)) return false;
    // Check multi-word phrases
    const multi = ["breaker tripped", "breaker trips", "breaker tripping"];
    for (const mp of multi) {
      const mpWords = mp.split(/\s+/);
      if (i + mpWords.length <= words.length) {
        let match = true;
        for (let j = 0; j < mpWords.length; j++) {
          if (words[i + j] !== mpWords[j]) {
            match = false;
            break;
          }
        }
        if (match) return true;
      }
    }
    return false;
  });
  const hasSmell = words.some((w, i) => rs02SmellWords.includes(w) && !exceptionUsedWords.has(i));
  return hasBreaker && hasSmell;
}

/**
 * Check RS-04 ceiling pair.
 */
function checkRS04CeilingPair(words: string[], exceptionUsedWords: Set<number>): boolean {
  const hasCeiling = words.some((w, i) => rs04CeilingWords.includes(w) && !exceptionUsedWords.has(i));
  const hasDrip = words.some((w, i) => rs04DripWords.includes(w) && !exceptionUsedWords.has(i));
  return hasCeiling && hasDrip;
}

/**
 * Check RS-04 electrics pair.
 */
function checkRS04ElectricsPair(words: string[], exceptionUsedWords: Set<number>): boolean {
  const hasWater = words.some((w, i) => rs04WaterWords.includes(w) && !exceptionUsedWords.has(i));
  const hasElectric = words.some((w, i) => {
    if (exceptionUsedWords.has(i)) return false;
    // Check multi-word phrases
    const multi = ["db room", "floor box", "floor boxes", "power box", "power boxes", "comms room", "server room"];
    for (const mp of multi) {
      const mpWords = mp.split(/\s+/);
      if (i + mpWords.length <= words.length) {
        let match = true;
        for (let j = 0; j < mpWords.length; j++) {
          if (words[i + j] !== mpWords[j]) {
            match = false;
            break;
          }
        }
        if (match) return true;
      }
    }
    // Single word
    return rs04ElectricWords.includes(w);
  });
  return hasWater && hasElectric;
}

/**
 * Main typed safety words function.
 * Returns matched stops (as SafetyCards) and whether picker should show.
 *
 * Cut 4: the "Is this a safety problem?" picker is skipped.
 * Q0 and red words stay. Picker words are tested as not red.
 */
export function typedSafetyWords(
  text: string,
  pill: Pill
): TypedSafetyResult {
  const words = prepWords(text);

  // Find all phrases
  const allMatches = findPhrases(words);

  // Resolve: longest first, use up words
  const { redMatches, usedWords } = resolvePhrases(allMatches);

  // Collect matched stop ids
  const matchedStopIds = new Set<string>();

  for (const match of redMatches) {
    if (match.stopId) {
      matchedStopIds.add(match.stopId);
    }
  }

  // Check pairs (RS-02, RS-03, RS-04)
  // Pairs may use words that a red phrase used, but never words an exception used.
  // Build the set of exception-used words only
  const exceptionUsedWords = new Set<number>();
  const sorted = [...allMatches].sort((a, b) => {
    if (b.words.length !== a.words.length) return b.words.length - a.words.length;
    if (a.type === "red" && b.type === "exception") return -1;
    if (a.type === "exception" && b.type === "red") return 1;
    return 0;
  });
  for (const match of sorted) {
    if (match.type !== "exception") continue;
    let canMatch = true;
    for (let i = 0; i < match.words.length; i++) {
      if (exceptionUsedWords.has(match.startIndex + i)) {
        canMatch = false;
        break;
      }
    }
    if (canMatch) {
      for (let i = 0; i < match.words.length; i++) {
        exceptionUsedWords.add(match.startIndex + i);
      }
    }
  }

  // RS-02 breaker pair
  if (checkRS02Pairs(words, exceptionUsedWords)) {
    matchedStopIds.add("RS-02");
  }

  // RS-03 pairs
  if (checkRS03Pairs(words, exceptionUsedWords)) {
    matchedStopIds.add("RS-03");
  }

  // RS-04 ceiling pair
  if (checkRS04CeilingPair(words, exceptionUsedWords)) {
    matchedStopIds.add("RS-04");
  }

  // RS-04 electrics pair
  if (checkRS04ElectricsPair(words, exceptionUsedWords)) {
    matchedStopIds.add("RS-04");
  }

  // "burning hot" exception: only when no RS-03 object word is in the message
  // Already handled by exceptionPhrases list

  // Build matched stops in YAML order
  const matchedStops: SafetyCard[] = [];
  for (const stop of pill.red_stops) {
    if (matchedStopIds.has(stop.id)) {
      matchedStops.push(safetyCardForStop(stop, pill.version));
    }
  }

  // Cut 4: picker is skipped. isPicker is always false.
  // Non-Latin letters would get picker if nothing is red, but cut 4 removes the picker.
  const isPicker = false;

  return { matchedStops, isPicker };
}
