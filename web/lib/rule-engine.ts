/**
 * Rule engine: matches tickets to rules, computes the repeat flag,
 * and determines which checklist steps are active.
 *
 * Rule matching, step order, colours, the repeat flag, the never-list,
 * version states and the live version pointer are plain TypeScript here.
 * The model never decides any of them.
 */

import { readFileSync } from "fs";
import { join } from "path";
import type { Pill, Colour, ChecklistStep } from "./pill";

// ---- Types ----

export interface Ticket {
  id: string;
  label: string;
  building: string;
  buildingName: string;
  floor: number;
  tenant: string;
  zone: string;
  complaint: string;
  timeOfDay: string;
  complaintHour: string;
  reportedAt: string;
  intake: {
    where: string;
    when: string;
    sinceWhen: string;
  };
  fix: {
    action: string;
    amount: number;
    fixerRole: string;
    note: string;
  } | null;
  status: string;
  previousChangesOnFloor: boolean;
}

export interface TicketStore {
  tickets: Ticket[];
}

export interface RepeatFlagResult {
  isRepeat: boolean;
  reason: string;
  count: number;
  hasOppositeFixes: boolean;
  relatedRuleIds: string[];
}

export interface RedStopResult {
  isRed: boolean;
  trigger: string;
  action: string;
  whoToCall: string;
  relatedRuleIds: string[];
}

export interface StepGateResult {
  step: ChecklistStep;
  isGated: boolean;
  gatedBy: string;
  approverNeeded: string;
}

// ---- Ticket loading ----

export function loadTickets(): Ticket[] {
  const dataPath = join(process.cwd(), "data", "tickets.json");
  const raw = readFileSync(dataPath, "utf-8");
  return JSON.parse(raw) as Ticket[];
}

/**
 * Get all tickets for a specific building and floor.
 */
export function getTicketsForFloor(tickets: Ticket[], buildingId: string, floor: number): Ticket[] {
  return tickets.filter(
    (t) => t.building === buildingId && t.floor === floor
  );
}

/**
 * Get all tickets for a specific building, floor and tenant in the last N days.
 */
export function getRecentTickets(
  tickets: Ticket[],
  buildingId: string,
  floor: number,
  tenant: string,
  days: number,
  asOfDate: Date = new Date()
): Ticket[] {
  const cutoff = new Date(asOfDate);
  cutoff.setDate(cutoff.getDate() - days);

  return tickets.filter((t) => {
    if (t.building !== buildingId || t.floor !== floor || t.tenant !== tenant) {
      return false;
    }
    const reported = new Date(t.reportedAt);
    return reported >= cutoff && reported <= asOfDate;
  });
}

// ---- Repeat flag (rule TS-CC-09, team decision D6) ----

/**
 * Compute the repeat flag for a ticket.
 *
 * The repeat rule (D6): 2 or more comfort complaints from the same floor
 * and tenant in 30 days, OR opposite fixes on any zone of the floor in 30 days,
 * turns the repeat flag on.
 *
 * Opposite fixes means: one ticket raised the setpoint (setpoint_up)
 * and another lowered it (setpoint_down) on any zone of the same floor.
 */
export function computeRepeatFlag(
  allTickets: Ticket[],
  currentTicket: Ticket,
  asOfDate: Date = new Date()
): RepeatFlagResult {
  const recent = getRecentTickets(
    allTickets,
    currentTicket.building,
    currentTicket.floor,
    currentTicket.tenant,
    30,
    asOfDate
  );

  // Count includes the current ticket
  const count = recent.length;

  // Check for opposite fixes: setpoint_up and setpoint_down on any zone of the floor
  const floorTickets = getTicketsForFloor(
    allTickets,
    currentTicket.building,
    currentTicket.floor
  );
  const recentFloorTickets = floorTickets.filter((t) => {
    const reported = new Date(t.reportedAt);
    const cutoff = new Date(asOfDate);
    cutoff.setDate(cutoff.getDate() - 30);
    return reported >= cutoff && reported <= asOfDate;
  });

  const hasUp = recentFloorTickets.some(
    (t) => t.fix?.action === "setpoint_up"
  );
  const hasDown = recentFloorTickets.some(
    (t) => t.fix?.action === "setpoint_down"
  );
  const hasOppositeFixes = hasUp && hasDown;

  const isRepeat = count >= 2 || hasOppositeFixes;

  let reason = "";
  if (isRepeat) {
    const reasons: string[] = [];
    if (count >= 2) {
      reasons.push(`${count} comfort complaints from the same floor and tenant in 30 days`);
    }
    if (hasOppositeFixes) {
      reasons.push("opposite fixes (setpoint up and down) on zones of the same floor in 30 days");
    }
    reason = reasons.join(", ");
  }

  return {
    isRepeat,
    reason,
    count,
    hasOppositeFixes,
    relatedRuleIds: ["TS-CC-09"],
  };
}

// ---- Red stop check ----

/**
 * Check if a ticket triggers a red stop.
 * Red stops are: safety signs (burning smell, smoke, water, unwell person),
 * plant causes, and capacity limits (damper fully open for hours).
 *
 * In the demo, ticket 2318 does NOT trigger a red stop (it is a repeat
 * comfort complaint, not a safety issue). The red stop check is here
 * for golden tests GT-03, GT-09, GT-10, GT-14, GT-15, GT-18, GT-19.
 */
export function checkRedStop(
  pill: Pill,
  context: {
    hasBurningSmell?: boolean;
    hasSmoke?: boolean;
    hasWaterDripping?: boolean;
    someoneUnwell?: boolean;
    ahuTripping?: boolean;
    damperFullyOpenForHours?: boolean;
    chillerCause?: boolean;
    ceilingAccessWithoutApproval?: boolean;
    workingAlone?: boolean;
    aiAskedToWriteToBms?: boolean;
    aiAskedToQuotePrice?: boolean;
    aiAskedToAdmitFault?: boolean;
    noApprovedRuleCovers?: boolean;
  }
): RedStopResult {
  for (const rs of pill.red_stops) {
    let triggered = false;

    if (rs.rules.includes("TS-CC-03")) {
      if (context.hasBurningSmell || context.hasSmoke || context.hasWaterDripping) {
        triggered = true;
      }
    }
    if (rs.rules.includes("TS-CC-04")) {
      if (context.someoneUnwell) {
        triggered = true;
      }
    }
    if (rs.rules.includes("TS-CC-05")) {
      if (context.ahuTripping || context.chillerCause) {
        triggered = true;
      }
    }
    if (rs.rules.includes("TS-CC-26")) {
      if (context.damperFullyOpenForHours || context.noApprovedRuleCovers) {
        triggered = true;
      }
    }
    if (rs.rules.includes("TS-CC-08")) {
      if (context.ceilingAccessWithoutApproval || context.workingAlone) {
        triggered = true;
      }
    }
    if (rs.rules.includes("TS-CC-06")) {
      if (
        context.aiAskedToWriteToBms ||
        context.aiAskedToQuotePrice ||
        context.aiAskedToAdmitFault
      ) {
        triggered = true;
      }
    }

    if (triggered) {
      return {
        isRed: true,
        trigger: rs.trigger,
        action: rs.action,
        whoToCall: rs.who_to_call,
        relatedRuleIds: rs.rules,
      };
    }
  }

  return {
    isRed: false,
    trigger: "",
    action: "",
    whoToCall: "",
    relatedRuleIds: [],
  };
}

// ---- Never-list check ----

/**
 * Check if a proposed AI output crosses the never-list.
 * Returns the violated never-list items, if any.
 */
export function checkNeverList(
  pill: Pill,
  proposedOutput: {
    quotesPrice?: boolean;
    admitsFault?: boolean;
    showsOtherTenantData?: boolean;
    writeToBms?: boolean;
  }
): { violated: string[]; items: { id: string; text: string }[] } {
  const violated: string[] = [];
  const items: { id: string; text: string }[] = [];

  for (const item of pill.never_list) {
    let triggered = false;
    if (item.id === "never-quote-price" && proposedOutput.quotesPrice) {
      triggered = true;
    }
    if (item.id === "never-admit-fault" && proposedOutput.admitsFault) {
      triggered = true;
    }
    if (item.id === "never-cross-tenant" && proposedOutput.showsOtherTenantData) {
      triggered = true;
    }
    if (item.id === "never-write-bms" && proposedOutput.writeToBms) {
      triggered = true;
    }
    if (triggered) {
      violated.push(item.id);
      items.push(item);
    }
  }

  return { violated, items };
}

// ---- First-complaint nudge check (rule TS-CC-21) ----

/**
 * Check if the first-complaint nudge (TS-CC-21) is allowed.
 * Conditions:
 * - No repeat flag
 * - No red stop
 * - No setpoint change on that zone in the last 30 days
 * - The change is at most 1 deg C
 * - The AI does not make the change itself
 *
 * In v1.0, the floor checks are NOT a gate for this nudge.
 * In v1.1 (reserved TS-CC-27), a fit-out in the last 12 months blocks the nudge.
 */
export function canNudge(
  repeatFlag: RepeatFlagResult,
  redStop: RedStopResult,
  context: {
    hadSetpointChangeInLast30Days?: boolean;
    changeAmount?: number;
    isAiMakingChange?: boolean;
    hadFitOutInLast12Months?: boolean;
    pillVersion?: string;
  }
): { allowed: boolean; reason: string; ruleIds: string[] } {
  if (repeatFlag.isRepeat) {
    return {
      allowed: false,
      reason: `Repeat flag is on: ${repeatFlag.reason}. No nudge. Call the FM chief engineer.`,
      ruleIds: ["TS-CC-09"],
    };
  }

  if (redStop.isRed) {
    return {
      allowed: false,
      reason: `Red stop: ${redStop.trigger}. No setpoint advice.`,
      ruleIds: redStop.relatedRuleIds,
    };
  }

  if (context.hadSetpointChangeInLast30Days) {
    return {
      allowed: false,
      reason: "The zone had a setpoint change in the last 30 days. Any further change needs the FM chief engineer's yes.",
      ruleIds: ["TS-CC-22"],
    };
  }

  if (context.changeAmount !== undefined && context.changeAmount > 1) {
    return {
      allowed: false,
      reason: "The change is above 1 deg C. Any change above 1 deg C needs the FM chief engineer's yes.",
      ruleIds: ["TS-CC-22"],
    };
  }

  if (context.isAiMakingChange) {
    return {
      allowed: false,
      reason: "The AI never makes the change itself. A person makes any approved change by hand.",
      ruleIds: ["TS-CC-06"],
    };
  }

  // v1.1 reserved rule: fit-out in last 12 months blocks the nudge
  if (context.pillVersion === "1.1" && context.hadFitOutInLast12Months) {
    return {
      allowed: false,
      reason: "Zone had a tenant fit-out in the last 12 months. Check where the thermostat sits against the fit-out drawing first. (v1.1 rule, reserved TS-CC-27)",
      ruleIds: ["TS-CC-27"],
    };
  }

  return {
    allowed: true,
    reason: "First complaint, no repeat flag, no red stop, no change on the zone in 30 days. ONE setpoint nudge of at most 1 deg C is allowed, logged.",
    ruleIds: ["TS-CC-21"],
  };
}

// ---- Step gating ----

/**
 * Determine which checklist steps are gated (locked until a named person says yes).
 * Green steps are not gated. Amber steps are gated by their approver. Red steps are stops.
 */
export function getStepGates(
  pill: Pill
): StepGateResult[] {
  return pill.checklist.map((step) => {
    const isGated = step.colour === "amber" || step.colour === "red";
    const gatedBy = step.colour === "amber" ? step.who : step.colour === "red" ? "stop" : "";
    return {
      step,
      isGated,
      gatedBy,
      approverNeeded: step.who,
    };
  });
}

// ---- Get the active checklist for a ticket ----

/**
 * Get the active checklist steps for a ticket, given its context.
 * This determines which steps the technician should follow.
 */
export function getActiveChecklist(
  pill: Pill,
  context: {
    repeatFlag: RepeatFlagResult;
    redStop: RedStopResult;
    canNudgeResult: { allowed: boolean; reason: string; ruleIds: string[] };
  }
): { steps: ChecklistStep[]; note: string } {
  // If a red stop is triggered, only show the red stop steps
  if (context.redStop.isRed) {
    const redSteps = pill.checklist.filter((s) => s.colour === "red");
    return {
      steps: redSteps,
      note: `Red stop: ${context.redStop.trigger}. Follow the red stop. The comfort checklist waits.`,
    };
  }

  // If the repeat flag is on, skip the first-complaint nudge step
  const steps = pill.checklist.filter((s) => {
    if (context.repeatFlag.isRepeat && s.rules.includes("TS-CC-21") && !s.rules.includes("TS-CC-22")) {
      return false;
    }
    return true;
  });

  return {
    steps,
    note: context.repeatFlag.isRepeat
      ? "Repeat flag is on. No nudge. Find the cause and call the FM chief engineer."
      : "First complaint. Follow the checklist in order.",
  };
}
