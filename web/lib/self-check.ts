/**
 * The tenant's self-check (S10): the fixed hands-off questions, which Q4 to
 * ask, the outcomes in S10 order, and the approved tips found by rule id.
 *
 * Pure code, 0 AI. The question texts are fixed here; the tips are never typed
 * here (S0 rule 5): they are read from `tenant_tips` in the live pill, by rule
 * id, never by position. This file imports nothing from the AI modules, so the
 * ai:record script can use its code line without reaching ai.ts.
 *
 * A tenant never touches plant, ceilings, power or lifts: every question only
 * asks what they can see or already know.
 */

import type { Pill, TenantTip } from "./pill";
import type { PlacesFile } from "./places";

export type QuestionId = "Q0" | "Q1" | "Q2" | "Q3" | "Q4-blinds" | "Q4-after-hours" | "Q4-thermostat";

export interface SelfCheckQuestion {
  id: QuestionId;
  text: string;
  answers: string[];
}

/** The S10 table, word for word. Every answer is a button. */
export const SELF_CHECK_QUESTIONS: SelfCheckQuestion[] = [
  {
    id: "Q0",
    text: "Before anything else: is there a burning smell, smoke, water dripping, a wet ceiling, or is anyone unwell?",
    answers: ["Yes", "No"],
  },
  { id: "Q1", text: "Where exactly?", answers: ["Open area near the lift core", "West glass boardroom", "Somewhere else"] },
  { id: "Q2", text: "Since when?", answers: ["Today", "This week", "It keeps coming back"] },
  { id: "Q3", text: "Has it happened before?", answers: ["Yes", "No"] },
  { id: "Q4-blinds", text: "Are the blinds down?", answers: ["Yes", "No, they are up"] },
  { id: "Q4-after-hours", text: "Is this after normal air-con hours?", answers: ["Yes", "No"] },
  {
    id: "Q4-thermostat",
    text: "Without touching it, does the wall thermostat screen show AUTO?",
    answers: ["Yes", "No", "Not sure"],
  },
];

export function questionById(id: string): SelfCheckQuestion | undefined {
  return SELF_CHECK_QUESTIONS.find((q) => q.id === id);
}

/** Q1's answer is the job's zone (places.json). "Somewhere else" is a zone of its own. */
export const ZONE_BY_PLACE: Record<string, string> = {
  "Open area near the lift core": "core",
  "West glass boardroom": "west",
  "Somewhere else": "other",
};

/** The two complaints Report a problem offers (run rule 16). */
export const COMPLAINTS = ["too cold", "too hot"] as const;
export type Complaint = (typeof COMPLAINTS)[number];

// ---- Code lines, whys and the note (S10), plain code ----

export const VISIT_BOOKED_LINE = "A technician visit is booked.";
export const AOM_COST_LINE = "The AOM will confirm any cost first.";
export const THERMOSTAT_NOTE = "Tenant says the thermostat does not show AUTO (looked, did not touch).";
export const WHY_BLINDS = "Self-check: afternoon sun on the west glass, blinds were up (tenant's answer).";
export const WHY_AFTER_HOURS = "Self-check: after normal air-con hours (tenant's answer).";

/** The A4 request a self-check opens (S10 outcome 3, S17). It never holds an amount. */
export function chargeRequestText(tenant: string, floor: number): string {
  return `After-hours air-con for ${tenant}, Level ${floor}`;
}

// ---- Which Q4 ----

const SG_OFFSET_MS = 8 * 60 * 60 * 1000;

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * True when a report time is outside the air-con hours in places.json, read in
 * Singapore time (the data's +08:00), never the machine's own time zone.
 */
export function isAfterAcHours(reportedAt: string, acHours: PlacesFile["acHours"]): boolean {
  const sg = new Date(new Date(reportedAt).getTime() + SG_OFFSET_MS);
  const day = sg.getUTCDay();
  const minutes = sg.getUTCHours() * 60 + sg.getUTCMinutes();
  const inside =
    acHours.days.includes(day) && minutes >= minutesOf(acHours.start) && minutes < minutesOf(acHours.end);
  return !inside;
}

/** S10's Q4 rows, in order: too hot in the west boardroom, then outside air-con hours, then the thermostat. */
export function q4For(
  complaint: string,
  zone: string | undefined,
  reportedAt: string,
  acHours: PlacesFile["acHours"]
): QuestionId {
  if (complaint === "too hot" && zone === "west") return "Q4-blinds";
  if (isAfterAcHours(reportedAt, acHours)) return "Q4-after-hours";
  return "Q4-thermostat";
}

export interface SelfCheckContext {
  complaint: string;
  reportedAt: string;
  acHours: PlacesFile["acHours"];
}

/** The question to ask next, or null when the self-check is over. Q0 Yes ends it at once. */
export function nextQuestion(answers: Record<string, string>, ctx: SelfCheckContext): QuestionId | null {
  if (!("Q0" in answers)) return "Q0";
  if (answers.Q0 === "Yes") return null;
  for (const id of ["Q1", "Q2", "Q3"] as const) {
    if (!(id in answers)) return id;
  }
  const q4 = q4For(ctx.complaint, ZONE_BY_PLACE[answers.Q1], ctx.reportedAt, ctx.acHours);
  return q4 in answers ? null : q4;
}

// ---- Outcomes, checked in S10 order ----

export type SelfCheckOutcome =
  | { kind: "safety" }
  | { kind: "blinds" }
  | { kind: "after-hours" }
  | { kind: "visit"; repeatTips: boolean; thermostatNote: boolean };

/**
 * 1. Q0 Yes: the Safety list. 2. Blinds up: the TS-CC-20 tip, no visit.
 * 3. After hours Yes: the TS-CC-12 tip and the A4 request, no visit.
 * 4. Otherwise a visit, with the TS-CC-09 tips when the spot has the repeat
 * flag, or Q2 is "It keeps coming back", or Q3 is "Yes".
 */
export function outcomeFor(answers: Record<string, string>, spotHasRepeat: boolean): SelfCheckOutcome {
  if (answers.Q0 === "Yes") return { kind: "safety" };
  if (answers["Q4-blinds"] === "No, they are up") return { kind: "blinds" };
  if (answers["Q4-after-hours"] === "Yes") return { kind: "after-hours" };
  return {
    kind: "visit",
    repeatTips: spotHasRepeat || answers.Q2 === "It keeps coming back" || answers.Q3 === "Yes",
    thermostatNote: answers["Q4-thermostat"] === "No" || answers["Q4-thermostat"] === "Not sure",
  };
}

/** The tips for an outcome, by rule id, word for word from the pill, in the pill's own order. */
export function tipsFor(pill: Pill, outcome: SelfCheckOutcome): TenantTip[] {
  const tips = pill.tenant_tips ?? [];
  const having = (rule: string) => tips.filter((t) => t.rules.includes(rule));
  switch (outcome.kind) {
    case "safety":
      return [];
    case "blinds":
      return having("TS-CC-20");
    case "after-hours":
      return having("TS-CC-12");
    case "visit":
      if (outcome.repeatTips) return having("TS-CC-09");
      // "the tip whose rules are TS-CC-01 and TS-CC-09": exactly those two.
      return tips.filter(
        (t) => t.rules.length === 2 && t.rules.includes("TS-CC-01") && t.rules.includes("TS-CC-09")
      );
  }
}

/**
 * The reply's code line (empty when S10 gives none) and the lines the tenant
 * reads, in S10 order: a visit is the code line then the tips; after hours is
 * the tip then the code line; blinds up is the tip alone.
 */
export function replyText(outcome: SelfCheckOutcome, tips: TenantTip[]): { codeLine: string; lines: string[] } {
  const tipLines = tips.map((t) => t.text);
  if (outcome.kind === "visit") return { codeLine: VISIT_BOOKED_LINE, lines: [VISIT_BOOKED_LINE, ...tipLines] };
  if (outcome.kind === "after-hours") return { codeLine: AOM_COST_LINE, lines: [...tipLines, AOM_COST_LINE] };
  return { codeLine: "", lines: tipLines };
}

/** The code-made why of a self-check that ends with a tip (S8: every closed job has one line of why). */
export function whyFor(outcome: SelfCheckOutcome): string | null {
  if (outcome.kind === "blinds") return WHY_BLINDS;
  if (outcome.kind === "after-hours") return WHY_AFTER_HOURS;
  return null;
}

/** The rule ids a reply's receipt names: every rule of its tips, once each, sorted. */
export function replyRuleIds(tips: TenantTip[]): string[] {
  return [...new Set(tips.flatMap((t) => t.rules))].sort();
}
