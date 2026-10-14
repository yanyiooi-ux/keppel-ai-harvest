/**
 * The draft of a new solution (S16 items 2 and 7).
 *
 * Code fills every field checkPill needs. The fact and the effects come only
 * from the menu in conditions.ts; anything off the menu is refused and nothing
 * is built. A draft is the base pill (v1.0 or the live version) plus the new
 * rule, version one step up, GT-22 added to golden_tests. It is saved in the
 * memory's runtime folder (web/data/runtime/), never in web/pills/ts-cc/.
 *
 * The source ref's date is the date of the `now` the caller gives (the demo
 * clock), in Singapore time, never the real clock.
 */

import { createHash } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { stringify } from "yaml";
import { checkPill, type Pill, type Rule } from "./pill";
import { checkCondition, colourForCondition, FACT_WORDS, type MenuFact, type RuleCondition } from "./conditions";
import { GT22_REF } from "./golden-cases";
import { runtimeDir } from "./memory";

/** Fixed templates for the fields a person does not write (S16 item 2). */
export const NEW_RULE_TEMPLATES = {
  approver: "Senior manager confirmed each part (role-played). HQ pill owner (role-played) approves the version.",
  section: "new solution",
  label: "senior manager correction",
  not_when: "Never ahead of the safety steps. Steps 1 to 8 and every red stop always come first.",
  sourceLabel: "senior manager correction (role-played)",
} as const;

export interface SolutionParts {
  /** The fix line, 3 to 30 words. */
  fixLine: string;
  /** The why line, 3 to 30 words. It goes into `because`. */
  whyLine: string;
  /** The confirmed rule text. With the AI off it is the fix line word for word. */
  ruleText?: string;
  /** From the menu only. */
  fact: unknown;
  /** From the menu only. */
  effects: unknown;
}

export type BuildRuleResult = { ok: true; rule: Rule } | { ok: false; refusals: string[] };
export type BuildDraftResult = { ok: true; pill: Pill; rule: Rule } | { ok: false; refusals: string[] };

const SG_OFFSET_MS = 8 * 60 * 60 * 1000;

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

/** Fix and why lines are 3 to 30 words each. */
export function checkSolutionLines(fixLine: string, whyLine: string): string[] {
  const out: string[] = [];
  for (const [name, line] of [
    ["fix line", fixLine],
    ["why line", whyLine],
  ] as const) {
    const n = wordCount(line ?? "");
    if (n < 3 || n > 30) out.push(`The ${name} needs 3 to 30 words; it has ${n}.`);
  }
  return out;
}

/** "CE-CORR-<YYYY-MM-DD>", the date of `now` in Singapore time. */
export function ceCorrRef(now: Date): string {
  return `CE-CORR-${new Date(now.getTime() + SG_OFFSET_MS).toISOString().slice(0, 10)}`;
}

/** "1.0" becomes "1.1"; "1.9" becomes "1.10". */
export function nextVersion(version: string): string {
  const m = /^(\d+)\.(\d+)$/.exec(version);
  if (!m) throw new Error(`version ${version} is not major.minor`);
  return `${m[1]}.${Number(m[2]) + 1}`;
}

/** The next free rule id, TS-CC-27 first. */
export function nextRuleId(pill: Pill): string {
  let top = 26;
  for (const r of pill.rules ?? []) {
    const m = /^TS-CC-(\d{2,})$/.exec(r.id ?? "");
    if (m) top = Math.max(top, Number(m[1]));
  }
  return `TS-CC-${String(top + 1).padStart(2, "0")}`;
}

/** Build the new rule from confirmed parts. Refuses anything off the menu. */
export function buildNewRule(base: Pill, parts: SolutionParts, now: Date): BuildRuleResult {
  const refusals = checkSolutionLines(parts.fixLine, parts.whyLine);

  const rawCondition = { fact: parts.fact, effects: parts.effects };
  const menuRefusals = checkCondition(rawCondition, base);
  refusals.push(...menuRefusals);

  const ruleText = (parts.ruleText ?? parts.fixLine ?? "").trim();
  if (ruleText.length === 0) refusals.push("The rule needs its text.");

  if (refusals.length > 0) return { ok: false, refusals };

  const condition: RuleCondition = {
    fact: parts.fact as MenuFact,
    effects: (parts.effects as { effect: "block" | "put-first"; step: number }[]).map((e) => ({
      effect: e.effect,
      step: e.step,
    })),
  };
  const colour = colourForCondition(condition, base);
  if (!colour) return { ok: false, refusals: ["The first effect names no step in the pill."] };

  // Field order matches the pill's own rules, so the YAML reads the same.
  const rule: Rule = {
    id: nextRuleId(base),
    colour,
    approver: NEW_RULE_TEMPLATES.approver,
    section: NEW_RULE_TEMPLATES.section,
    label: NEW_RULE_TEMPLATES.label,
    rule: ruleText,
    because: parts.whyLine.trim(),
    applies_when: FACT_WORDS[condition.fact],
    not_when: NEW_RULE_TEMPLATES.not_when,
    sources: [{ ref: ceCorrRef(now), label: NEW_RULE_TEMPLATES.sourceLabel }],
    condition,
  };
  return { ok: true, rule };
}

/** The base pill plus the new rule, version one step up, GT-22 in golden_tests once. */
export function buildDraft(base: Pill, parts: SolutionParts, now: Date): BuildDraftResult {
  const built = buildNewRule(base, parts, now);
  if (!built.ok) return built;

  const hasGt22 = (base.golden_tests ?? []).some((g) => g.id === GT22_REF.id);
  const pill: Pill = {
    ...base,
    version: nextVersion(base.version),
    golden_tests: hasGt22 ? [...base.golden_tests] : [...(base.golden_tests ?? []), { ...GT22_REF }],
    rules: [...base.rules, built.rule],
  };

  const errors = checkPill(pill);
  if (errors.length > 0) return { ok: false, refusals: errors };
  return { ok: true, pill, rule: built.rule };
}

/** The draft as YAML text, the same way v1.0.yaml is written. */
export function draftYaml(pill: Pill): string {
  return stringify(pill);
}

/** SHA-256 of the draft's YAML text (S16 item 7). */
export function draftHash(yamlText: string): string {
  return createHash("sha256").update(yamlText, "utf8").digest("hex");
}

export function draftFileName(pill: Pill): string {
  return `${pill.pill_id}-v${pill.version}-draft.yaml`;
}

/** Save a draft into the runtime folder. Never into web/pills/. */
export function saveDraft(pill: Pill): { path: string; yaml: string; hash: string } {
  const dir = runtimeDir();
  mkdirSync(dir, { recursive: true });
  const yaml = draftYaml(pill);
  const path = join(dir, draftFileName(pill));
  writeFileSync(path, yaml, "utf-8");
  return { path, yaml, hash: draftHash(yaml) };
}
