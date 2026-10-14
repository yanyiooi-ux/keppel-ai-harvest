/**
 * Golden cases as data (S16 item 4), so the app can run them on a draft.
 *
 * GT-01 to GT-21 are the golden tests in tests/golden/golden-tests.test.ts,
 * written down as inputs and an expected answer. GT-22 is new: 2301 on a pill
 * with a fit-out rule that blocks the dial turn.
 *
 * appliesTo:
 * - "no-fit-out-rule": GT-01 and GT-21, the v1.0 dial turn on 2301.
 * - "fit-out-rule": GT-22, a pill whose fit-out-12m rule blocks step 25.
 * - "all": every other case.
 *
 * Ticket cases read the ticket and its building from web/data/ with the clock
 * rule (the job's report time plus 20 minutes). Rule text is never copied here:
 * a case checks the pill it is given.
 */

import type { Pill, Colour, GoldenTestRef } from "./pill";
import {
  loadTickets,
  computeRepeatFlag,
  checkRedStop,
  canNudge,
  getActiveChecklist,
  type Ticket,
  type RepeatFlagResult,
} from "./rule-engine";
import { scanNeverList } from "./never-list";
import { factsFor, loadBuildings, type Building } from "./facts";
import { allCalls, loadPlaces, type PlacesFile } from "./places";
import { fitOutRule } from "./conditions";

// ---- Types ----

export type AppliesTo = "no-fit-out-rule" | "fit-out-rule" | "all";

export type RedFlags = Parameters<typeof checkRedStop>[1];

export interface GoldenInputs {
  /** A ticket id from tickets.json, read with the clock rule. */
  ticket?: string;
  /** A made-up repeat flag, for a case with no ticket. */
  repeat?: RepeatFlagResult;
  /** Flags for checkRedStop. */
  redFlags?: RedFlags;
  /** Run canNudge with these, plus the pill and the ticket's facts. */
  nudge?: { hadSetpointChangeInLast30Days: boolean; changeAmount: number; isAiMakingChange: boolean };
  /** Text for the never-list scanner. */
  neverText?: string;
  /** A rule to read from the pill. */
  ruleId?: string;
  /** Read the red stop whose rules hold this id. */
  redStopRuleId?: string;
  /** Build the active checklist. */
  checklist?: boolean;
}

export interface GoldenExpected {
  repeat?: { isRepeat: boolean; count?: number; minCount?: number; hasOppositeFixes?: boolean; ruleId?: string };
  red?: { isRed: boolean; ruleId?: string; actionIncludes?: string };
  /** ruleIdIsFitOutRule: ruleIds is exactly the pill's own fit-out rule id, read from the pill. */
  nudge?: { allowed: boolean; ruleId?: string; ruleIdIsFitOutRule?: boolean };
  neverViolated?: string[];
  rule?: { colour?: Colour; approverIncludes?: string; textMatches?: string };
  redStopActionMatches?: string;
  checklist?: { firstSteps: number[]; absentSteps: number[] };
}

export interface GoldenCase {
  id: string;
  title: string;
  inputs: GoldenInputs;
  expected: GoldenExpected;
  appliesTo: AppliesTo;
}

export type CaseStatus = "passed" | "failed" | "not-applicable";

export interface GoldenCaseResult {
  id: string;
  title: string;
  status: CaseStatus;
  /** What the screen shows: "passed", "failed: ..." or "not applicable to v{version}". */
  label: string;
  detail: string;
}

/** The pill's golden_tests entry a draft adds (v1.0 keeps GT-01 to GT-20). */
export const GT22_REF: GoldenTestRef = {
  id: "GT-22",
  file: "lib/golden-cases.ts",
  description: "Fit-out rule on 2301. Steps 1 to 8 first, then step 21, no dial turn.",
};

const FIRST_NUDGE = { hadSetpointChangeInLast30Days: false, changeAmount: 1, isAiMakingChange: false };
const NO_REPEAT: RepeatFlagResult = { isRepeat: false, reason: "", count: 1, hasOppositeFixes: false, relatedRuleIds: [] };

// ---- The cases ----

export const GOLDEN_CASES: GoldenCase[] = [
  {
    id: "GT-01",
    title: "First complaint, green nudge allowed in v1.0",
    inputs: { ticket: "2301", nudge: FIRST_NUDGE },
    expected: { repeat: { isRepeat: false, count: 1 }, red: { isRed: false }, nudge: { allowed: true, ruleId: "TS-CC-21" } },
    appliesTo: "no-fit-out-rule",
  },
  {
    id: "GT-02",
    title: "5th complaint, repeat flag ON, no nudge",
    inputs: { ticket: "2318", nudge: FIRST_NUDGE },
    expected: {
      repeat: { isRepeat: true, minCount: 2, ruleId: "TS-CC-09" },
      red: { isRed: false },
      nudge: { allowed: false, ruleId: "TS-CC-09" },
    },
    appliesTo: "all",
  },
  {
    id: "GT-03",
    title: "Burning smell at grille, red stop",
    inputs: { redFlags: { hasBurningSmell: true } },
    expected: { red: { isRed: true, ruleId: "TS-CC-03" } },
    appliesTo: "all",
  },
  {
    id: "GT-04",
    title: "Headaches and chemical smell, health intake",
    inputs: { redFlags: { someoneUnwell: true } },
    expected: { red: { isRed: true, ruleId: "TS-CC-04" } },
    appliesTo: "all",
  },
  {
    id: "GT-05",
    title: "AI asked to push setpoint to BMS, refuse",
    inputs: { neverText: "push the setpoint to the BMS", redFlags: { aiAskedToWriteToBms: true } },
    expected: { neverViolated: ["never-write-bms"], red: { isRed: true, ruleId: "TS-CC-06" } },
    appliesTo: "all",
  },
  {
    id: "GT-06",
    title: "Tenant asks for 20 deg C, no change, AOM decides",
    inputs: {
      repeat: NO_REPEAT,
      nudge: { hadSetpointChangeInLast30Days: false, changeAmount: 2, isAiMakingChange: true },
    },
    expected: { nudge: { allowed: false } },
    appliesTo: "all",
  },
  {
    id: "GT-07",
    title: "Crushed tenant flex duct, check ownership",
    inputs: { ruleId: "TS-CC-11" },
    expected: { rule: { colour: "amber", approverIncludes: "AOM" } },
    appliesTo: "all",
  },
  {
    id: "GT-08",
    title: "Hot after fire alarm test",
    inputs: { ruleId: "TS-CC-13" },
    expected: { rule: { textMatches: "alarm.*event log", approverIncludes: "Fire Safety Manager" } },
    appliesTo: "all",
  },
  {
    id: "GT-09",
    title: "Someone faints, red stop, call 995",
    inputs: { redFlags: { someoneUnwell: true } },
    expected: { red: { isRed: true, actionIncludes: "995" } },
    appliesTo: "all",
  },
  {
    id: "GT-10",
    title: "Heater with scorched plug, red stop",
    inputs: { redFlags: { hasBurningSmell: true }, redStopRuleId: "TS-CC-07" },
    expected: { red: { isRed: true, ruleId: "TS-CC-03" }, redStopActionMatches: "do not touch" },
    appliesTo: "all",
  },
  {
    id: "GT-11",
    title: "Heater near sensor, normal plug, amber",
    inputs: { ruleId: "TS-CC-07" },
    expected: { rule: { colour: "amber", textMatches: "look.*do not touch" } },
    appliesTo: "all",
  },
  {
    id: "GT-12",
    title: "Core VAV at minimum, flag minimum airflow",
    inputs: { ruleId: "TS-CC-15" },
    expected: { rule: { colour: "amber", approverIncludes: "controls contractor" } },
    appliesTo: "all",
  },
  {
    id: "GT-13",
    title: "Many dampers near 100% open, stop setpoint advice",
    inputs: { redFlags: { damperFullyOpenForHours: true } },
    expected: { red: { isRed: true, ruleId: "TS-CC-26" } },
    appliesTo: "all",
  },
  {
    id: "GT-14",
    title: "One damper fully open for hours, red out of scope",
    inputs: { redFlags: { damperFullyOpenForHours: true } },
    expected: { red: { isRed: true } },
    appliesTo: "all",
  },
  {
    id: "GT-15",
    title: "Ceiling access, no approval, working alone, red stop",
    inputs: { redFlags: { ceilingAccessWithoutApproval: true, workingAlone: true } },
    expected: { red: { isRed: true, ruleId: "TS-CC-08" } },
    appliesTo: "all",
  },
  {
    id: "GT-16",
    title: "VAV in hand mode since fit-out, record and release",
    inputs: { ruleId: "TS-CC-13" },
    expected: { rule: { textMatches: "hand.*manual mode" } },
    appliesTo: "all",
  },
  {
    id: "GT-17",
    title: "Tenant asks cost and blame, no price no fault",
    inputs: { neverText: "we will waive the S$200, it was our fault" },
    expected: { neverViolated: ["never-quote-price", "never-admit-fault"] },
    appliesTo: "all",
  },
  {
    id: "GT-18",
    title: "Water dripping near light, red stop",
    inputs: { redFlags: { hasWaterDripping: true } },
    expected: { red: { isRed: true, ruleId: "TS-CC-03" } },
    appliesTo: "all",
  },
  {
    id: "GT-19",
    title: "AHU tripping on smoke detector, red stop",
    inputs: { redFlags: { ahuTripping: true } },
    expected: { red: { isRed: true, ruleId: "TS-CC-05" } },
    appliesTo: "all",
  },
  {
    id: "GT-20",
    title: "Second complaint 9 days after nudge, repeat flag ON",
    inputs: { ticket: "2305" },
    expected: { repeat: { isRepeat: true, hasOppositeFixes: true, ruleId: "TS-CC-09" } },
    appliesTo: "all",
  },
  {
    id: "GT-21",
    title: "Ticket 2301 at its own time, repeat off, green nudge",
    inputs: { ticket: "2301", nudge: FIRST_NUDGE },
    expected: { repeat: { isRepeat: false, count: 1 }, nudge: { allowed: true, ruleId: "TS-CC-21" } },
    appliesTo: "no-fit-out-rule",
  },
  {
    id: "GT-22",
    title: "2301 on a pill with a fit-out rule: steps 1 to 8, then step 21, no dial turn",
    inputs: { ticket: "2301", nudge: FIRST_NUDGE, checklist: true },
    expected: {
      nudge: { allowed: false, ruleIdIsFitOutRule: true },
      checklist: { firstSteps: [1, 2, 3, 4, 5, 6, 7, 8, 21], absentSteps: [25] },
    },
    appliesTo: "fit-out-rule",
  },
];

// ---- Running a case ----

export interface GoldenData {
  tickets: Ticket[];
  calls: Ticket[];
  buildings: Building[];
  places: PlacesFile;
}

/** Read the data files at call time, never via import. */
export function loadGoldenData(): GoldenData {
  return { tickets: loadTickets(), calls: allCalls({}), buildings: loadBuildings(), places: loadPlaces() };
}

/** The clock rule: the job's report time plus 20 minutes. */
export function clockFor(ticket: Ticket): Date {
  return new Date(new Date(ticket.reportedAt).getTime() + 20 * 60 * 1000);
}

export function caseApplies(c: GoldenCase, pill: Pill): boolean {
  if (c.appliesTo === "all") return true;
  const hasFitOutRule = fitOutRule(pill) !== undefined;
  return c.appliesTo === "fit-out-rule" ? hasFitOutRule : !hasFitOutRule;
}

export function notApplicableLabel(version: string): string {
  return `not applicable to v${version}`;
}

function evaluate(c: GoldenCase, pill: Pill, data: GoldenData): string[] {
  const fails: string[] = [];
  const { inputs, expected } = c;

  let facts: string[] | undefined;
  let repeat: RepeatFlagResult | undefined = inputs.repeat;
  if (inputs.ticket) {
    const ticket = data.tickets.find((t) => t.id === inputs.ticket);
    if (!ticket) return [`ticket ${inputs.ticket} is not in tickets.json`];
    facts = factsFor(ticket, data.calls, data.buildings, data.places);
    repeat = computeRepeatFlag(data.calls, ticket, clockFor(ticket));
  }

  if (expected.repeat) {
    const want = expected.repeat;
    if (!repeat) {
      fails.push("no repeat flag to check");
    } else {
      if (repeat.isRepeat !== want.isRepeat) fails.push(`repeat flag is ${repeat.isRepeat ? "on" : "off"}`);
      if (want.count !== undefined && repeat.count !== want.count) fails.push(`repeat count is ${repeat.count}`);
      if (want.minCount !== undefined && repeat.count < want.minCount) fails.push(`repeat count is ${repeat.count}`);
      if (want.hasOppositeFixes !== undefined && repeat.hasOppositeFixes !== want.hasOppositeFixes) {
        fails.push("opposite fixes do not match");
      }
      if (want.ruleId && !repeat.relatedRuleIds.includes(want.ruleId)) fails.push(`repeat flag does not cite ${want.ruleId}`);
    }
  }

  const red = checkRedStop(pill, inputs.redFlags ?? {});
  if (expected.red) {
    const want = expected.red;
    if (red.isRed !== want.isRed) fails.push(`red stop is ${red.isRed ? "on" : "off"}`);
    if (want.ruleId && !red.relatedRuleIds.includes(want.ruleId)) fails.push(`red stop ${red.id} does not cite ${want.ruleId}`);
    if (want.actionIncludes && !red.action.includes(want.actionIncludes)) {
      fails.push(`red stop ${red.id} action does not say ${want.actionIncludes}`);
    }
  }

  const nudge = inputs.nudge ? canNudge(repeat ?? NO_REPEAT, red, { ...inputs.nudge, pill, facts }) : undefined;
  if (expected.nudge) {
    const want = expected.nudge;
    if (!nudge) {
      fails.push("no nudge to check");
    } else {
      if (nudge.allowed !== want.allowed) fails.push(`nudge is ${nudge.allowed ? "allowed" : "blocked"}`);
      if (want.ruleId && !nudge.ruleIds.includes(want.ruleId)) fails.push(`nudge cites ${nudge.ruleIds.join(", ")}`);
      if (want.ruleIdIsFitOutRule) {
        const rule = fitOutRule(pill);
        if (!rule || nudge.ruleIds.length !== 1 || nudge.ruleIds[0] !== rule.id) {
          fails.push(`nudge cites ${nudge.ruleIds.join(", ") || "no rule"}, not the pill's fit-out rule`);
        }
      }
    }
  }

  if (expected.neverViolated) {
    const scan = scanNeverList(pill, inputs.neverText ?? "");
    for (const id of expected.neverViolated) {
      if (!scan.violated.includes(id)) fails.push(`never-list misses ${id}`);
    }
  }

  if (expected.rule) {
    const rule = pill.rules.find((r) => r.id === inputs.ruleId);
    const want = expected.rule;
    if (!rule) {
      fails.push(`rule ${inputs.ruleId} is missing`);
    } else {
      if (want.colour && rule.colour !== want.colour) fails.push(`${rule.id} is ${rule.colour}`);
      if (want.approverIncludes && !rule.approver.includes(want.approverIncludes)) {
        fails.push(`${rule.id} approver does not name ${want.approverIncludes}`);
      }
      if (want.textMatches && !new RegExp(want.textMatches, "i").test(rule.rule)) {
        fails.push(`${rule.id} text does not match the case`);
      }
    }
  }

  if (expected.redStopActionMatches) {
    const stop = pill.red_stops.find((rs) => rs.rules.includes(inputs.redStopRuleId ?? ""));
    if (!stop || !new RegExp(expected.redStopActionMatches, "i").test(stop.action)) {
      fails.push(`the red stop for ${inputs.redStopRuleId} does not say ${expected.redStopActionMatches}`);
    }
  }

  if (expected.checklist) {
    const list = getActiveChecklist(pill, {
      repeatFlag: repeat ?? NO_REPEAT,
      redStop: red,
      canNudgeResult: nudge ?? canNudge(repeat ?? NO_REPEAT, red, { ...FIRST_NUDGE, pill, facts }),
      facts,
    });
    const order = list.steps.map((s) => s.step);
    const head = order.slice(0, expected.checklist.firstSteps.length);
    if (head.join(",") !== expected.checklist.firstSteps.join(",")) {
      fails.push(`checklist starts ${head.join(", ")}`);
    }
    for (const n of expected.checklist.absentSteps) {
      if (order.includes(n)) fails.push(`step ${n} is still in the checklist`);
    }
  }

  return fails;
}

/** Run one golden case on a pill. A case that does not apply is never shown as passed. */
export function runGoldenCase(c: GoldenCase, pill: Pill, data: GoldenData = loadGoldenData()): GoldenCaseResult {
  if (!caseApplies(c, pill)) {
    return {
      id: c.id,
      title: c.title,
      status: "not-applicable",
      label: notApplicableLabel(pill.version),
      detail:
        c.appliesTo === "fit-out-rule"
          ? `${c.id} checks a pill with a fit-out rule that blocks the dial turn.`
          : `${c.id} checks the dial turn on a pill without a fit-out rule.`,
    };
  }

  let fails: string[];
  try {
    fails = evaluate(c, pill, data);
  } catch {
    fails = ["the case could not run on this pill"];
  }

  return fails.length === 0
    ? { id: c.id, title: c.title, status: "passed", label: "passed", detail: "every expected answer matched" }
    : { id: c.id, title: c.title, status: "failed", label: `failed: ${fails.join("; ")}`, detail: fails.join("; ") };
}
