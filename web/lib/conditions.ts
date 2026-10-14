/**
 * The condition menu (S16 item 1).
 *
 * A new solution may only say what this menu allows. The menu is code: the AI
 * can suggest from it, but code decides, and anything off the menu is refused.
 *
 * - Fact (pick 1): fit-out-12m, repeat, opposite-fixes (S5).
 * - Effects (1 or 2): block step 25 only (the dial turn); put-first one of the
 *   listed steps. "First" means right after the safety section: steps 1 to 8
 *   always stay first, in order.
 * - Refused always: any effect on steps 1 to 8, 26, 28 or 31; any effect on a
 *   step whose rules include TS-CC-03, 04, 05, 08 or 26; any red step; anything
 *   that changes, blocks or reorders a red stop; lowering a colour.
 * - No fit, no rule: a note, shown as "advisory, not enforced". A note never
 *   enters a pill. A forced rule the menu refuses comes back as a note.
 *
 * The engine (canNudge, getActiveChecklist) and the ranking read the same
 * helpers below, so a rule means the same thing everywhere.
 */

import type { Pill, Rule, Colour, ChecklistStep } from "./pill";
import { factLabel } from "./fact-labels";

// ---- The menu ----

export const MENU_FACTS = ["fit-out-12m", "repeat", "opposite-fixes"] as const;
export type MenuFact = (typeof MENU_FACTS)[number];

export type EffectKind = "block" | "put-first";

export interface ConditionEffect {
  effect: EffectKind;
  step: number;
}

export interface RuleCondition {
  fact: MenuFact;
  effects: ConditionEffect[];
}

/** Block is allowed on the dial turn only. */
export const BLOCK_STEPS: readonly number[] = [25];

/** Put-first is allowed on these steps only. */
export const PUT_FIRST_STEPS: readonly number[] = [9, 10, 11, 12, 13, 15, 17, 18, 19, 20, 21, 22, 23, 29, 30];

/** Steps no rule may touch: the safety section, the approval step, the close-out and the out-of-scope stop. */
export const NEVER_STEPS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 26, 28, 31];

/** A step carrying any of these rules is out of reach of every rule. */
export const GUARDED_RULE_IDS: readonly string[] = ["TS-CC-03", "TS-CC-04", "TS-CC-05", "TS-CC-08", "TS-CC-26"];

/** The safety section: always first, in order, never hidden. */
export const SAFETY_STEPS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8];

export const ADVISORY_LABEL = "advisory, not enforced" as const;

/** applies_when for a drafted rule: the fact in words. */
export const FACT_WORDS: Record<MenuFact, string> = {
  "fit-out-12m": "The zone had a tenant fit-out in the last 12 months.",
  repeat: "The repeat flag is on for the floor and tenant.",
  "opposite-fixes": "Opposite fixes were made on zones of the floor in the last 30 days.",
};

const COLOUR_RANK: Record<string, number> = { green: 0, amber: 1, red: 2 };

const RED_STOP_REFUSAL = "A rule never changes, blocks or reorders a red stop.";

function isMenuFact(fact: unknown): fact is MenuFact {
  return typeof fact === "string" && (MENU_FACTS as readonly string[]).includes(fact);
}

function stepOf(pill: Pill, n: number): ChecklistStep | undefined {
  return (pill.checklist ?? []).find((s) => s.step === n);
}

function mentionsRedStop(key: string): boolean {
  return /red/i.test(key);
}

function checkEffect(raw: unknown, pill: Pill, seen: Set<number>): string[] {
  const out: string[] = [];
  if (!raw || typeof raw !== "object") {
    return ["An effect is block or put-first on one checklist step."];
  }
  const e = raw as Record<string, unknown>;

  const touchesRed =
    Object.keys(e).some(mentionsRedStop) || (typeof e.step === "string" && /^RS-/i.test(e.step));
  if (touchesRed) out.push(RED_STOP_REFUSAL);

  if (e.effect !== "block" && e.effect !== "put-first") {
    out.push(`The effect "${String(e.effect)}" is not on the menu: only block or put-first.`);
  }
  for (const key of Object.keys(e)) {
    if (!["effect", "step", "colour"].includes(key) && !mentionsRedStop(key)) {
      out.push(`"${key}" is not on the menu.`);
    }
  }

  if (typeof e.step !== "number" || !Number.isInteger(e.step)) {
    if (!touchesRed) out.push("An effect names one checklist step by its number.");
    return out;
  }

  const n = e.step;
  const step = stepOf(pill, n);
  if (!step) {
    out.push(`There is no step ${n}.`);
    return out;
  }

  if (seen.has(n)) out.push(`Step ${n} has two effects; one effect per step.`);
  seen.add(n);

  if (SAFETY_STEPS.includes(n)) {
    out.push(`Step ${n} is in the safety section: steps 1 to 8 always stay first, in order.`);
  } else if (NEVER_STEPS.includes(n)) {
    out.push(`Step ${n} is never changed by a rule.`);
  }
  const guarded = step.rules.filter((r) => GUARDED_RULE_IDS.includes(r));
  if (guarded.length > 0) {
    out.push(`Step ${n} carries ${guarded.join(", ")}, so no rule may touch it.`);
  }
  if (step.colour === "red") {
    out.push(`Step ${n} is red: no rule may touch a red step.`);
  }
  if (e.effect === "block" && !BLOCK_STEPS.includes(n)) {
    out.push(`Block is allowed on step 25 (the dial turn) only, not on step ${n}.`);
  }
  if (e.effect === "put-first" && !PUT_FIRST_STEPS.includes(n)) {
    out.push(`Put-first is not allowed on step ${n}.`);
  }
  if (e.colour !== undefined) {
    const asked = COLOUR_RANK[String(e.colour)];
    if (asked === undefined || asked < COLOUR_RANK[step.colour]) {
      out.push(`A rule never lowers a colour: step ${n} stays ${step.colour}.`);
    } else if (e.colour !== step.colour) {
      out.push(`A rule never recolours a step: step ${n} stays ${step.colour}.`);
    }
  }
  return out;
}

/**
 * Every refusal for a condition, in plain words. [] means it fits the menu.
 * `colour` is the rule's own colour, checked against the first effect's step
 * colour: a rule is never lower than the step it starts from.
 */
export function checkCondition(condition: unknown, pill: Pill, colour?: Colour | string): string[] {
  if (!condition || typeof condition !== "object") {
    return ["A rule needs a condition from the menu: one fact and 1 or 2 effects."];
  }
  const c = condition as Record<string, unknown>;
  const refusals: string[] = [];

  for (const key of Object.keys(c)) {
    if (key === "fact" || key === "effects") continue;
    refusals.push(mentionsRedStop(key) ? RED_STOP_REFUSAL : `"${key}" is not on the menu.`);
  }

  if (!isMenuFact(c.fact)) {
    refusals.push(`The fact "${String(c.fact)}" is not on the menu: pick fit-out-12m, repeat or opposite-fixes.`);
  }

  const effects = Array.isArray(c.effects) ? (c.effects as unknown[]) : [];
  if (effects.length < 1 || effects.length > 2) {
    refusals.push("A rule has 1 or 2 effects.");
  }

  const seen = new Set<number>();
  for (const raw of effects) {
    refusals.push(...checkEffect(raw, pill, seen));
  }

  if (colour !== undefined) {
    const own = COLOUR_RANK[String(colour)];
    const first = effects[0] as Record<string, unknown> | undefined;
    const step = first && typeof first.step === "number" ? stepOf(pill, first.step) : undefined;
    if (own === undefined) {
      refusals.push(`The colour "${String(colour)}" is not green, amber or red.`);
    } else if (step && own < COLOUR_RANK[step.colour]) {
      refusals.push(
        `A rule never lowers a colour: its first effect is on step ${step.step}, which is ${step.colour}, so the rule cannot be ${colour}.`
      );
    }
  }

  return [...new Set(refusals)];
}

/** The colour a drafted rule takes: its first effect's step colour. */
export function colourForCondition(condition: RuleCondition, pill: Pill): Colour | undefined {
  const first = condition.effects[0];
  return first ? stepOf(pill, first.step)?.colour : undefined;
}

// ---- AI suggestions: a rule from the menu, or a note ----

export type ScreenedSuggestion =
  | { kind: "rule"; text: string; condition: RuleCondition; colour: Colour }
  | { kind: "note"; text: string; label: typeof ADVISORY_LABEL; refusals: string[] };

/**
 * Screen what the AI suggested. The new-solution answer comes in S15's shape:
 * `{ ruleText, fact, effects }` or `{ kind: "note", text }`; `{ kind: "rule",
 * text, fact, effects }` is read too. A note stays a note. A rule that fits the
 * menu comes back as a rule with its colour from code. A rule the menu refuses
 * comes back as a note, "advisory, not enforced", that shows the rule's text,
 * with every refusal.
 */
export function screenSuggestion(suggestion: unknown, pill: Pill): ScreenedSuggestion {
  const s = suggestion && typeof suggestion === "object" ? (suggestion as Record<string, unknown>) : {};
  const text = typeof s.ruleText === "string" ? s.ruleText : typeof s.text === "string" ? s.text : "";
  const note = (refusals: string[]): ScreenedSuggestion => ({ kind: "note", text, label: ADVISORY_LABEL, refusals });

  if (s.kind === "note") return note([]);
  const isRule =
    s.kind === "rule" || (s.kind === undefined && ("ruleText" in s || "fact" in s || "effects" in s));
  if (!isRule) return note(["The suggestion is neither a rule nor a note."]);
  if (text.trim().length === 0) return note(["A rule needs its rule text."]);

  // Everything except the text, the kind and a suggested colour is part of the condition.
  const { kind: _kind, text: _text, ruleText: _ruleText, colour: suggestedColour, ...conditionPart } = s;
  void _kind;
  void _text;
  void _ruleText;

  const fromCode = Array.isArray(conditionPart.effects)
    ? colourForCondition(conditionPart as unknown as RuleCondition, pill)
    : undefined;
  const refusals = checkCondition(conditionPart, pill, (suggestedColour as string | undefined) ?? fromCode);
  if (refusals.length > 0 || !fromCode) {
    return note(refusals.length > 0 ? refusals : ["A rule needs a condition from the menu."]);
  }

  const condition: RuleCondition = {
    fact: conditionPart.fact as MenuFact,
    effects: (conditionPart.effects as ConditionEffect[]).map((e) => ({ effect: e.effect, step: e.step })),
  };
  return { kind: "rule", text, condition, colour: fromCode };
}

// ---- What a pill's conditions do to a job (engine and ranking share these) ----

export interface FactContext {
  facts?: string[];
  hadFitOutInLast12Months?: boolean;
}

/** A fact is true when facts holds it, or, for fit-out-12m, when the old fit-out field is true. */
export function factIsTrue(fact: string, ctx: FactContext): boolean {
  if ((ctx.facts ?? []).includes(fact)) return true;
  return fact === "fit-out-12m" && ctx.hadFitOutInLast12Months === true;
}

/** Rules that carry a condition the menu accepts, in pill order. A refused condition does nothing. */
export function conditionRules(pill: Pill): Rule[] {
  return (pill.rules ?? []).filter(
    (r) => r.condition !== undefined && checkCondition(r.condition, pill, r.colour).length === 0
  );
}

/** Condition rules whose fact is true for this job. */
export function liveConditionRules(pill: Pill, ctx: FactContext): Rule[] {
  return conditionRules(pill).filter((r) => factIsTrue(r.condition!.fact, ctx));
}

/** The first live rule that blocks any of these steps. */
export function blockingRule(pill: Pill, ctx: FactContext, steps: (number | null)[]): Rule | undefined {
  const wanted = steps.filter((s): s is number => typeof s === "number");
  return liveConditionRules(pill, ctx).find((r) =>
    r.condition!.effects.some((e) => e.effect === "block" && wanted.includes(e.step))
  );
}

/** The first live rule that puts this step first. */
export function putFirstRule(pill: Pill, ctx: FactContext, step: number): Rule | undefined {
  return liveConditionRules(pill, ctx).find((r) =>
    r.condition!.effects.some((e) => e.effect === "put-first" && e.step === step)
  );
}

/** Steps hidden for this job. The safety section is never among them. */
export function blockedSteps(pill: Pill, ctx: FactContext): number[] {
  const out: number[] = [];
  for (const r of liveConditionRules(pill, ctx)) {
    for (const e of r.condition!.effects) {
      if (e.effect === "block" && !out.includes(e.step) && !SAFETY_STEPS.includes(e.step)) out.push(e.step);
    }
  }
  return out;
}

/** Steps put first for this job, in rule order then effect order. */
export function putFirstSteps(pill: Pill, ctx: FactContext): number[] {
  const out: number[] = [];
  for (const r of liveConditionRules(pill, ctx)) {
    for (const e of r.condition!.effects) {
      if (e.effect === "put-first" && !out.includes(e.step) && !SAFETY_STEPS.includes(e.step)) out.push(e.step);
    }
  }
  return out;
}

/** The pill's fit-out rule, if it has one: fact fit-out-12m and a block on the dial turn. */
export function fitOutRule(pill: Pill): Rule | undefined {
  return conditionRules(pill).find(
    (r) => r.condition!.fact === "fit-out-12m" && r.condition!.effects.some((e) => e.effect === "block" && e.step === 25)
  );
}

/** The dial-turn block reason, built from the rule and the pill, never typed per rule. */
export function dialBlockReason(rule: Rule, pill: Pill): string {
  const label = factLabel(rule.condition!.fact);
  const lead = label.charAt(0).toUpperCase() + label.slice(1);
  return `${lead} blocks the dial turn (signed rule ${rule.id}, v${pill.version}). ${rule.rule}`;
}
