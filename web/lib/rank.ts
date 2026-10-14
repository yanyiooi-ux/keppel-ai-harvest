/**
 * Ranking in 4 steps (S9).
 *
 * rankLeads(input) is pure code. It imports nothing from the AI modules.
 * The same input always gives the same output.
 *
 * Step a: Rules first (remove causes).
 * Step b: Match facts (similar cases, outcomes, score).
 * Step c: Order (tiers, close groups).
 * Step d: Show why (code reasons, never AI).
 */

import type { Pill, ChecklistStep, Rule } from "./pill";
import type { Ticket, RepeatFlagResult } from "./rule-engine";
import { canNudge } from "./rule-engine";
import type { Cause } from "./causes";
import type { Case } from "./cases";
import { isSimilar, similarWeight } from "./cases";
import { outcomeOf } from "./outcome";
import { spotKey } from "./places";
import { blockingRule, putFirstRule } from "./conditions";
import { factLabel } from "./fact-labels";
import { SEAT_LABELS, type SeatId } from "./permissions";

// ---- Types ----

export type Tier = "found" | "signed-rule" | "case-backed" | "low-confidence" | "net-failed";

export interface Tick {
  causeId: string;
  type: "found" | "not-this";
  /** The seat that made the tick. The found and ruled-out reasons name it (S9). */
  seat?: string;
}

export interface Lead {
  causeId: string;
  label: string;
  tier: Tier;
  score: number;
  W: number;
  F: number;
  N: number;
  P: number;
  reason: string;
  checkStep: number;
  checkText: string;
  checkMinutes: number;
  fixRoute: string;
  fixAllowedHere: boolean;
}

export interface RemovedLead {
  causeId: string;
  label: string;
  reason: string;
}

export interface RankResult {
  leads: Lead[];
  ruledOut: Lead[];
  removed: RemovedLead[];
  alertSeniorManager: boolean;
}

export interface RankInput {
  job: Ticket & { facts: string[] };
  seat: string;
  livePill: Pill;
  causes: Cause[];
  allCases: Case[];
  ticks: Tick[];
  openRedStops: { spotKey: string; id: string }[];
  now: Date;
  /**
   * The job's real repeat flag (computeRepeatFlag with the clock rule), so the
   * dial lead's removal quotes canNudge's real reason. Without it, the flag is
   * read from the job's facts alone.
   */
  repeatFlag?: RepeatFlagResult;
}

// ---- Fact labels (S9 {fact label}) come from S5's "Label on screen", in fact-labels.ts ----

/** The first sentence of a text, without its full stop. "v1.1" does not end a sentence. */
function firstSentence(text: string): string {
  const end = text.search(/\.(\s|$)/);
  return end === -1 ? text : text.slice(0, end);
}

// ---- Time formatting (S9 {time}) ----

function formatTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minutes`;
  }
  if (minutes < 1440) {
    const hours = Math.round(minutes / 60);
    return `${hours} hours`;
  }
  const days = Math.round(minutes / 1440);
  return `${days} days`;
}

// ---- Step a: Rules first ----

function getCheckStep(pill: Pill, stepNum: number): ChecklistStep | undefined {
  return pill.checklist.find((s) => s.step === stepNum);
}

function getStepRuleIds(pill: Pill, stepNum: number): string[] {
  const step = getCheckStep(pill, stepNum);
  return step ? step.rules : [];
}

function hasOpenRedStopOnSpot(input: RankInput): boolean {
  const jobSpot = spotKey(input.job);
  return input.openRedStops.some((s) => s.spotKey === jobSpot);
}

/**
 * Step a: Remove causes by rules.
 * Returns { leads, removed }.
 */
function stepA_remove(input: RankInput): { leads: Lead[]; removed: RemovedLead[] } {
  const leads: Lead[] = [];
  const removed: RemovedLead[] = [];
  const jobSpot = spotKey(input.job);
  const hasRedStop = hasOpenRedStopOnSpot(input);

  // Job direction: "cold" for too cold, "hot" for too hot
  const direction = input.job.complaint === "too cold" ? "cold" : "hot";

  for (const cause of input.causes) {
    const step = getCheckStep(input.livePill, cause.checkStep);
    const checkText = step ? step.text : "";
    let lead: Lead = {
      causeId: cause.id,
      label: cause.label,
      tier: "low-confidence",
      score: 0,
      W: 0,
      F: 0,
      N: 0,
      P: 0,
      reason: "",
      checkStep: cause.checkStep,
      checkText,
      checkMinutes: cause.checkMinutes,
      fixRoute: cause.fixRoute,
      fixAllowedHere: input.seat === cause.fixSeat && cause.fixSeat !== "none",
    };

    // 1. Symptoms don't include direction
    if (!cause.symptoms.includes(direction)) {
      removed.push({
        causeId: cause.id,
        label: cause.label,
        reason: `Does not explain too ${direction}.`,
      });
      continue;
    }

    // 2. Red cause or open red stop on spot
    if (cause.red) {
      removed.push({
        causeId: cause.id,
        label: cause.label,
        reason: `Red: out of scope. ${cause.fixRoute}.`,
      });
      continue;
    }

    // Lock: open red stop on the job's spot removes every lead
    if (hasRedStop) {
      removed.push({
        causeId: cause.id,
        label: cause.label,
        reason: "Locked by an open red stop on this spot.",
      });
      continue;
    }

    // 3. Seat not in checkSeats
    if (!cause.checkSeats.includes(input.seat)) {
      removed.push({
        causeId: cause.id,
        label: cause.label,
        reason: "This check is the senior manager's.",
      });
      continue;
    }

    // 4. canNudge for setpoint
    if (cause.id === "setpoint") {
      const hadSetpointChange = input.allCases.some(
        (c) =>
          c.building === input.job.building &&
          c.floor === input.job.floor &&
          c.zone === input.job.zone &&
          c.cause === "setpoint" &&
          new Date(c.closedAt) <= new Date(input.job.reportedAt) &&
          (new Date(input.job.reportedAt).getTime() - new Date(c.closedAt).getTime()) <= 30 * 24 * 60 * 60 * 1000
      );

      // The repeat flag for canNudge: the real one when the caller has it
      const repeatFlag: RepeatFlagResult = input.repeatFlag ?? {
        isRepeat: input.job.facts.includes("repeat"),
        reason: input.job.facts.includes("repeat") ? "repeat flag" : "",
        count: 0,
        hasOppositeFixes: input.job.facts.includes("opposite-fixes"),
        relatedRuleIds: ["TS-CC-09"],
      };

      const redStop = { isRed: false, trigger: "", action: "", whoToCall: "", relatedRuleIds: [] };

      const nudge = canNudge(repeatFlag, redStop, {
        hadSetpointChangeInLast30Days: hadSetpointChange,
        changeAmount: 1,
        isAiMakingChange: false,
        pill: input.livePill,
        facts: input.job.facts,
      });

      if (!nudge.allowed) {
        removed.push({
          causeId: cause.id,
          label: cause.label,
          reason: `Removed by ${nudge.ruleIds.join(", ")}: ${firstSentence(nudge.reason)}.`,
        });
        continue;
      }
    }

    // 4b. A live rule whose fact is true blocks this cause's check or fix step
    const blocker = blockingRule(input.livePill, { facts: input.job.facts }, [cause.checkStep, cause.fixStep]);
    if (blocker) {
      removed.push({
        causeId: cause.id,
        label: cause.label,
        reason: `Removed by rule ${blocker.id} (v${input.livePill.version}).`,
      });
      continue;
    }

    // 5. Warranty/contract: tenantItem + fit-out-12m
    if (cause.tenantItem && input.job.facts.includes("fit-out-12m")) {
      lead.fixAllowedHere = false;
      lead.fixRoute = "Covered by the tenant's fit-out contract: goes through the AOM (TS-CC-11)";
    }

    leads.push(lead);
  }

  return { leads, removed };
}

// ---- Step b: Match facts ----

interface CaseStats {
  W: number;
  F: number;
  N: number;
  P: number;
  score: number;
}

function stepB_match(input: RankInput, leads: Lead[]): Lead[] {
  return leads.map((lead) => {
    const causeCases = input.allCases.filter((c) => c.cause === lead.causeId);

    // Find similar cases
    const similar = causeCases.filter((c) => isSimilar(input.job.facts, c.facts));

    let W = 0;
    let F = 0;
    let P = 0;
    let score = 0;

    for (const c of similar) {
      const weight = similarWeight(input.job.facts, c.facts);
      const result = outcomeOf(c, input.now);

      if (result.outcome === "won") {
        W++;
        score += weight;
      } else if (result.outcome === "failed") {
        F++;
        score -= weight;
      } else {
        P++;
      }
    }

    const N = W + F;

    return {
      ...lead,
      W,
      F,
      N,
      P,
      score,
    };
  });
}

// ---- Step c: Order ----

/**
 * The signed rule that puts this lead's check first: a rule in the live pill whose
 * condition fact is true for the job and which has a put-first effect on the
 * lead's checkStep. v1.0 has no such rule.
 */
function signedRuleFor(input: RankInput, lead: Lead): Rule | undefined {
  return putFirstRule(input.livePill, { facts: input.job.facts }, lead.checkStep);
}

function stepC_order(input: RankInput, leads: Lead[]): { leads: Lead[]; ruledOut: Lead[] } {
  const tickedFound = input.ticks.filter((t) => t.type === "found").map((t) => t.causeId);
  const tickedNotThis = input.ticks.filter((t) => t.type === "not-this").map((t) => t.causeId);

  // Split into found, ruledOut, and the rest
  const found: Lead[] = [];
  const ruledOut: Lead[] = [];
  const rest: Lead[] = [];

  for (const lead of leads) {
    if (tickedFound.includes(lead.causeId)) {
      found.push({ ...lead, tier: "found" as Tier });
    } else if (tickedNotThis.includes(lead.causeId)) {
      ruledOut.push(lead);
    } else {
      rest.push(lead);
    }
  }

  // Assign tiers to the rest
  const tiered = rest.map((lead) => {
    let tier: Tier;
    if (signedRuleFor(input, lead)) {
      tier = "signed-rule";
    } else if (lead.N >= 3 && lead.score > 0) {
      tier = "case-backed";
    } else if (lead.N < 3) {
      tier = "low-confidence";
    } else {
      // N >= 3 and score <= 0
      tier = "net-failed";
    }
    return { ...lead, tier };
  });

  // Sort by tier priority, then by tier-specific rules
  const tierOrder: Record<Tier, number> = {
    "found": 0,
    "signed-rule": 1,
    "case-backed": 2,
    "low-confidence": 3,
    "net-failed": 4,
  };

  // Separate by tier
  const byTier: Record<Tier, Lead[]> = {
    "found": [],
    "signed-rule": [],
    "case-backed": [],
    "low-confidence": [],
    "net-failed": [],
  };

  for (const lead of tiered) {
    byTier[lead.tier].push(lead);
  }

  // Sort signed-rule: checkMinutes, then file order
  byTier["signed-rule"].sort((a, b) => a.checkMinutes - b.checkMinutes);

  // Sort case-backed: close groups
  byTier["case-backed"] = sortCloseGroups(byTier["case-backed"]);

  // Sort low-confidence: checkMinutes, then checkStep
  byTier["low-confidence"].sort((a, b) => {
    if (a.checkMinutes !== b.checkMinutes) return a.checkMinutes - b.checkMinutes;
    return a.checkStep - b.checkStep;
  });

  // Sort net-failed: score high first, then file order
  byTier["net-failed"].sort((a, b) => b.score - a.score);

  // Combine: found, signed-rule, case-backed, low-confidence, net-failed
  const ordered = [
    ...found,
    ...byTier["signed-rule"],
    ...byTier["case-backed"],
    ...byTier["low-confidence"],
    ...byTier["net-failed"],
  ];

  // ruledOut in tick order
  const orderedRuledOut: Lead[] = [];
  for (const tick of input.ticks) {
    if (tick.type === "not-this") {
      const found = ruledOut.find((l) => l.causeId === tick.causeId);
      if (found) orderedRuledOut.push(found);
    }
  }

  return { leads: ordered, ruledOut: orderedRuledOut };
}

/**
 * Close groups (S9): sort case-backed leads by score, high first.
 * Take the top score s. The group is every lead with score >= s - 2.
 * Order the group by checkMinutes (quicker first), then score, then file order.
 * Repeat on the rest.
 */
function sortCloseGroups(leads: Lead[]): Lead[] {
  if (leads.length === 0) return [];

  const sorted = [...leads].sort((a, b) => b.score - a.score);
  const result: Lead[] = [];

  while (sorted.length > 0) {
    const topScore = sorted[0].score;
    const group: Lead[] = [];
    const rest: Lead[] = [];

    for (const lead of sorted) {
      if (lead.score >= topScore - 2) {
        group.push(lead);
      } else {
        rest.push(lead);
      }
    }

    // Sort group by checkMinutes, then score, then file order
    group.sort((a, b) => {
      if (a.checkMinutes !== b.checkMinutes) return a.checkMinutes - b.checkMinutes;
      if (b.score !== a.score) return b.score - a.score;
      return a.checkStep - b.checkStep;
    });

    result.push(...group);

    // Clear sorted and fill with rest
    sorted.length = 0;
    sorted.push(...rest);
  }

  return result;
}

// ---- Step d: Show why ----

/** {seat label} (S9): the label of the seat that made the tick, else of the seat looking. */
function tickSeatLabel(input: RankInput, causeId: string, type: Tick["type"]): string {
  const tick = input.ticks.find((t) => t.causeId === causeId && t.type === type);
  const seat = tick?.seat ?? input.seat;
  return SEAT_LABELS[seat as SeatId] ?? seat;
}

function buildReason(input: RankInput, lead: Lead, closeCallLead: Lead | null): string {
  const jobFacts = input.job.facts;

  // {facts}: job's facts in fact order, leaving out equipment facts,
  // that appear in at least one similar decided case of this cause;
  // first 3, labels joined with " + "
  const causeCases = input.allCases.filter(
    (c) => c.cause === lead.causeId && (outcomeOf(c, input.now).outcome === "won" || outcomeOf(c, input.now).outcome === "failed")
  );

  const equipmentFacts = ["vav", "fcu"];
  const relevantFacts = jobFacts.filter(
    (f) => !equipmentFacts.includes(f) && causeCases.some((c) => c.facts.includes(f))
  );
  const top3 = relevantFacts.slice(0, 3).map(factLabel);
  const factsStr = top3.join(" + ");

  if (lead.tier === "found") {
    return `Checked: found it (${tickSeatLabel(input, lead.causeId, "found")}).`;
  }

  if (lead.tier === "signed-rule") {
    const rule = signedRuleFor(input, lead);
    const ruleId = rule?.id ?? "";
    const version = input.livePill.version;
    let reason = `Signed expert rule ${ruleId} (v${version}): ${factLabel(rule?.condition?.fact ?? "")} puts this check first.`;
    if (lead.N > 0) {
      reason += ` ${lead.W} of ${lead.N} similar cases stayed fixed so far.`;
    }
    return reason;
  }

  if (lead.tier === "case-backed") {
    let reason = `${factsStr}: matched ${lead.W} of ${lead.N} similar cases that stayed fixed`;
    if (lead.F === 1) {
      reason += "; 1 failed fix counts against";
    } else if (lead.F >= 2) {
      reason += `; ${lead.F} failed fixes count against`;
    }
    reason += ".";
    if (closeCallLead) {
      reason += ` Close call, so the quicker check goes first (${formatTime(lead.checkMinutes)}).`;
    }
    return reason;
  }

  if (lead.tier === "low-confidence") {
    const ruleId = getStepRuleIds(input.livePill, lead.checkStep)[0] ?? "";
    let reason = `Low confidence, expert rule ${ruleId}: `;
    if (lead.N === 0) {
      reason += "no similar cases yet.";
    } else if (lead.N === 1) {
      reason += "only 1 similar case so far.";
    } else if (lead.N === 2) {
      reason += "only 2 similar cases so far.";
    }
    return reason;
  }

  // net-failed
  let reason = `${factsStr}: only ${lead.W} of ${lead.N} similar cases stayed fixed; `;
  if (lead.F === 1) {
    reason += "1 failed fix counts against.";
  } else {
    reason += `${lead.F} failed fixes count against.`;
  }
  return reason;
}

// ---- Main ----

export function rankLeads(input: RankInput): RankResult {
  // Step a: remove
  const { leads: stepALeads, removed } = stepA_remove(input);

  // Step b: match
  const matched = stepB_match(input, stepALeads);

  // Step c: order
  const { leads: ordered, ruledOut } = stepC_order(input, matched);

  // Step d: reasons
  // Check for close-call: a lead that was moved above a higher-scored lead
  const caseBacked = ordered.filter((l) => l.tier === "case-backed");
  let closeCallLead: Lead | null = null;
  if (caseBacked.length >= 2) {
    // Check if the first case-backed lead has a lower score than the second
    // but was put first due to close groups (quicker check)
    // Actually, close call is when a lead with lower score goes first
    // because of the close-group rule (within 2 of top score, quicker check)
    const sorted = [...caseBacked].sort((a, b) => b.score - a.score);
    const topScore = sorted[0].score;
    if (sorted[0].causeId !== caseBacked[0].causeId && caseBacked[0].score >= topScore - 2) {
      closeCallLead = caseBacked[0];
    }
  }

  const leadsWithReasons = ordered.map((lead) => ({
    ...lead,
    reason: buildReason(input, lead, lead === closeCallLead ? closeCallLead : null),
  }));

  const ruledOutWithReasons = ruledOut.map((lead) => ({
    ...lead,
    reason: `Checked: not this (${tickSeatLabel(input, lead.causeId, "not-this")}).`,
  }));

  // alertSeniorManager: when the first live lead is low-confidence, or no live lead is left
  const alertSeniorManager =
    leadsWithReasons.length === 0 ||
    leadsWithReasons[0].tier === "low-confidence";

  return {
    leads: leadsWithReasons,
    ruledOut: ruledOutWithReasons,
    removed,
    alertSeniorManager,
  };
}
