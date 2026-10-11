/**
 * Place tags and calls (S5).
 *
 * placeTag(job) returns { building, floor, zone, equipment }.
 * spotKey(job) is "<building>/<floor>".
 * allCalls(state) is every ticket in tickets.json plus every runtime job,
 * in the Ticket shape, with fix: null for runtime jobs.
 */

import { readFileSync } from "fs";
import { join } from "path";
import type { Ticket } from "./rule-engine";

export interface PlaceSpot {
  building: string;
  floor: number;
  zone: string;
  equipment: string;
  equipmentType: string;
}

export interface PlacesFile {
  label: string;
  acHours: { start: string; end: string; days: number[] };
  spots: PlaceSpot[];
}

/** Load places.json at call time, never via import. */
export function loadPlaces(): PlacesFile {
  const filePath = join(process.cwd(), "data", "places.json");
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as PlacesFile;
}

/**
 * Returns { building, floor, zone, equipment } for a job.
 * A zone not in places.json gets equipment "unknown".
 */
export function placeTag(job: { building: string; floor: number; zone: string }): {
  building: string;
  floor: number;
  zone: string;
  equipment: string;
} {
  const places = loadPlaces();
  const spot = places.spots.find(
    (s) =>
      s.building === job.building &&
      s.floor === job.floor &&
      s.zone === job.zone
  );
  return {
    building: job.building,
    floor: job.floor,
    zone: job.zone,
    equipment: spot ? spot.equipment : "unknown",
  };
}

/**
 * Returns "<building>/<floor>", for example "tower-a/23".
 */
export function spotKey(job: { building: string; floor: number }): string {
  return `${job.building}/${job.floor}`;
}

/**
 * Every ticket in tickets.json plus every job created at runtime,
 * in the Ticket shape, with fix: null for runtime jobs.
 */
export function allCalls(state: { tickets?: Ticket[] }): Ticket[] {
  const filePath = join(process.cwd(), "data", "tickets.json");
  const raw = readFileSync(filePath, "utf-8");
  const fileTickets = JSON.parse(raw) as Ticket[];
  const runtimeTickets = state.tickets ?? [];
  return [...fileTickets, ...runtimeTickets];
}
