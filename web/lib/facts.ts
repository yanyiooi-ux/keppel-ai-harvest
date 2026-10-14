/**
 * Facts (S5).
 *
 * factsFor(job, allCalls, buildings, places) returns fact ids
 * in the fixed order from S5. The clock rule: the job's report
 * time plus 20 minutes as asOfDate, never the real clock and
 * never the demo clock.
 */

import { readFileSync } from "fs";
import { join } from "path";
import type { Ticket, RepeatFlagResult } from "./rule-engine";
import { computeRepeatFlag } from "./rule-engine";
import { placeTag, type PlacesFile, type PlaceSpot } from "./places";

export interface BuildingFloor {
  floor: number;
  tenant: string;
  fitOutCompletedMonths: number;
  leaseEndsInMonths: number;
  zones: string[];
}

export interface Building {
  id: string;
  name: string;
  type: string;
  label: string;
  floors: BuildingFloor[];
}

/**
 * Load buildings.json at call time, never via import.
 */
export function loadBuildings(): Building[] {
  const filePath = join(process.cwd(), "data", "buildings.json");
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as Building[];
}

/**
 * Returns the spot for a job from places, or null if not found.
 */
function findSpot(places: PlacesFile, job: { building: string; floor: number; zone: string }): PlaceSpot | undefined {
  return places.spots.find(
    (s) => s.building === job.building && s.floor === job.floor && s.zone === job.zone
  );
}

/**
 * Returns the fitOutCompletedMonths for a job's floor from buildings.json.
 */
function fitOutMonths(buildings: Building[], job: { building: string; floor: number }): number | null {
  const b = buildings.find((b) => b.id === job.building);
  if (!b) return null;
  const f = b.floors.find((f) => f.floor === job.floor);
  if (!f) return null;
  return f.fitOutCompletedMonths;
}

/** The clock rule: the job's report time plus 20 minutes. */
function clockFor(job: Ticket): Date {
  return new Date(new Date(job.reportedAt).getTime() + 20 * 60 * 1000);
}

/**
 * The job's repeat flag with the clock rule, the same one factsFor reads the
 * repeat and opposite-fixes facts from.
 */
export function repeatFlagFor(job: Ticket, allCalls: Ticket[]): RepeatFlagResult {
  return computeRepeatFlag(allCalls, job, clockFor(job));
}

/**
 * Returns fact ids in the fixed order of S5.
 *
 * Order 1: exactly one symptom fact (cold-mornings, hot-afternoons,
 * cold-other, hot-other).
 * Order 2: zone fact (core-zone, west-zone, east-zone).
 * Order 3: repeat (if computeRepeatFlag.isRepeat).
 * Order 4: opposite-fixes (if computeRepeatFlag.hasOppositeFixes).
 * Order 5: fit-out-12m (if fitOutCompletedMonths <= 12).
 * Order 6: equipment type (vav, fcu).
 */
export function factsFor(
  job: Ticket,
  allCalls: Ticket[],
  buildings: Building[],
  places: PlacesFile
): string[] {
  const facts: string[] = [];

  // Order 1: symptom
  if (job.complaint === "too cold" && job.timeOfDay === "morning") {
    facts.push("cold-mornings");
  } else if (job.complaint === "too hot" && job.timeOfDay === "afternoon") {
    facts.push("hot-afternoons");
  } else if (job.complaint === "too cold") {
    facts.push("cold-other");
  } else if (job.complaint === "too hot") {
    facts.push("hot-other");
  }

  // Order 2: zone
  if (job.zone === "core") {
    facts.push("core-zone");
  } else if (job.zone === "west") {
    facts.push("west-zone");
  } else if (job.zone === "east") {
    facts.push("east-zone");
  }

  // Order 3 and 4: repeat and opposite-fixes
  const repeat = repeatFlagFor(job, allCalls);
  if (repeat.isRepeat) {
    facts.push("repeat");
  }
  if (repeat.hasOppositeFixes) {
    facts.push("opposite-fixes");
  }

  // Order 5: fit-out-12m
  const months = fitOutMonths(buildings, job);
  if (months !== null && months <= 12) {
    facts.push("fit-out-12m");
  }

  // Order 6: equipment type
  const spot = findSpot(places, job);
  if (spot) {
    if (spot.equipmentType === "vav") {
      facts.push("vav");
    } else if (spot.equipmentType === "fcu") {
      facts.push("fcu");
    }
  }

  return facts;
}
