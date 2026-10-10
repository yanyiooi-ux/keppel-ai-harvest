/**
 * Pill loader and checker.
 *
 * Rule matching, step order, colours, the repeat flag, the never-list,
 * version states and the live version pointer are plain TypeScript here.
 * The model never decides any of them.
 *
 * This module reads a pill YAML file from web/pills/ using fs at request time,
 * never via import (an import is frozen at build time).
 */

import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "yaml";

// ---- Types ----

export type Colour = "green" | "amber" | "red";

export interface RuleSource {
  ref: string;
  url?: string;
  label: string;
}

export interface Rule {
  id: string;
  colour: Colour;
  approver: string;
  section: string;
  label: string;
  rule: string;
  because: string;
  applies_when: string;
  not_when: string;
  sources: RuleSource[];
}

export interface ChecklistStep {
  step: number;
  section: string;
  text: string;
  who: string;
  colour: Colour;
  rules: string[];
}

export interface RedStop {
  trigger: string;
  action: string;
  who_to_call: string;
  rules: string[];
  id: string;
}

export interface TenantTip {
  text: string;
  rules: string[];
}

export interface NeverItem {
  id: string;
  text: string;
}

export interface Guardrail {
  id: string;
  text: string;
}

export interface GoldenTestRef {
  id: string;
  file: string;
  description: string;
}

export interface Pill {
  pill_id: string;
  version: string;
  case_study: string;
  title: string;
  status: string;
  label: string;
  contributor: {
    role: string;
    real: boolean;
    note: string;
  };
  golden_tests: GoldenTestRef[];
  never_list: NeverItem[];
  guardrails: Guardrail[];
  rules: Rule[];
  checklist: ChecklistStep[];
  red_stops: RedStop[];
  tenant_tips: TenantTip[];
}

// ---- Loader ----

/**
 * Load a pill version from web/pills/<pill_id>/<version>.yaml.
 * Uses fs at call time, never import.
 */
export function loadPill(pillId: string, version: string): Pill {
  const pillsDir = join(process.cwd(), "pills");
  // File naming: v1.0.yaml, v1.1.yaml, etc.
  const fileName = version.startsWith("v") ? `${version}.yaml` : `v${version}.yaml`;
  const filePath = join(pillsDir, pillId, fileName);
  const raw = readFileSync(filePath, "utf-8");
  return parse(raw) as Pill;
}

/**
 * Run all structural checks on a pill and throw if any fail.
 * The error message joins all errors with "; ".
 */
export function assertPillOk(pill: Pill): Pill {
  const errors = checkPill(pill);
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
  return pill;
}

/**
 * Load a pill and run all structural checks.
 * Throws if any check fails.
 */
export function loadAndCheckPill(pillId: string, version: string): Pill {
  return assertPillOk(loadPill(pillId, version));
}

// ---- Checker ----

/**
 * Run all structural checks on a pill.
 * Returns an array of error strings (empty if all pass).
 */
export function checkPill(pill: Pill): string[] {
  const errors: string[] = [];

  // 1. Pill metadata
  if (!pill.pill_id) errors.push("pill_id is missing");
  if (!pill.version) errors.push("version is missing");
  if (!pill.title) errors.push("title is missing");
  if (!pill.status) errors.push("status is missing");
  if (!["draft", "approved", "retired"].includes(pill.status)) {
    errors.push(`status must be draft, approved or retired, got "${pill.status}"`);
  }
  if (!pill.contributor) {
    errors.push("contributor is missing");
  } else {
    if (!pill.contributor.role) errors.push("contributor.role is missing");
    if (typeof pill.contributor.real !== "boolean") {
      errors.push("contributor.real must be true or false");
    }
  }

  // 2. Never-list
  const neverIds = new Set<string>();
  for (const item of pill.never_list ?? []) {
    if (!item.id) errors.push(`never-list item missing id: "${item.text}"`);
    if (neverIds.has(item.id)) errors.push(`never-list duplicate id: ${item.id}`);
    neverIds.add(item.id);
    if (!item.text) errors.push(`never-list item ${item.id} has no text`);
  }
  // Must include the four core never-items
  const mustHave = [
    "never-quote-price",
    "never-admit-fault",
    "never-cross-tenant",
    "never-write-bms",
  ];
  for (const id of mustHave) {
    if (!neverIds.has(id)) {
      errors.push(`never-list must include ${id}`);
    }
  }

  // 3. Rules
  const ruleIds = new Set<string>();
  const expectedRuleIds: string[] = [];
  for (let i = 1; i <= 26; i++) {
    expectedRuleIds.push(`TS-CC-${String(i).padStart(2, "0")}`);
  }

  for (const rule of pill.rules ?? []) {
    if (!rule.id) {
      errors.push("a rule has no id");
      continue;
    }
    if (ruleIds.has(rule.id)) errors.push(`duplicate rule id: ${rule.id}`);
    ruleIds.add(rule.id);

    if (!["green", "amber", "red"].includes(rule.colour)) {
      errors.push(`rule ${rule.id} colour must be green, amber or red, got "${rule.colour}"`);
    }
    if (!rule.approver) errors.push(`rule ${rule.id} has no approver`);
    if (!rule.section) errors.push(`rule ${rule.id} has no section`);
    if (!rule.label) errors.push(`rule ${rule.id} has no label`);
    if (!rule.rule) errors.push(`rule ${rule.id} has no rule text`);
    if (!rule.because) errors.push(`rule ${rule.id} has no because text`);
    if (!rule.applies_when) errors.push(`rule ${rule.id} has no applies_when`);
    if (!rule.not_when) errors.push(`rule ${rule.id} has no not_when`);
    if (!rule.sources || rule.sources.length === 0) {
      errors.push(`rule ${rule.id} has no sources`);
    } else {
      for (const src of rule.sources) {
        if (!src.ref) errors.push(`rule ${rule.id} has a source with no ref`);
        if (!src.label) errors.push(`rule ${rule.id} source ${src.ref} has no label`);
      }
    }
  }

  // 4. Version-aware rule set check
  // v1.0 must have exactly TS-CC-01 to TS-CC-26, not TS-CC-27.
  // Any other version must have TS-CC-01 to TS-CC-26, and each extra rule
  // needs a valid condition (S16 — condition check comes in C3c).
  for (const id of expectedRuleIds) {
    if (!ruleIds.has(id)) {
      errors.push(`pill must include rule ${id}`);
    }
  }
  if (pill.version === "1.0" && ruleIds.has("TS-CC-27")) {
    errors.push("v1.0 must NOT include TS-CC-27 (reserved for v1.1)");
  }
  if (pill.version === "1.0") {
    // v1.0 must have exactly 26 rules, no extras
    const extraRules = (pill.rules ?? []).filter(
      (r) => !expectedRuleIds.includes(r.id)
    );
    for (const r of extraRules) {
      errors.push(`v1.0 must not include extra rule ${r.id}`);
    }
  }

  // 5. Checklist
  const stepNumbers: number[] = [];
  for (const item of pill.checklist ?? []) {
    if (!item.step) {
      errors.push("a checklist item has no step number");
      continue;
    }
    stepNumbers.push(item.step);
    if (!item.section) errors.push(`checklist step ${item.step} has no section`);
    if (!item.text) errors.push(`checklist step ${item.step} has no text`);
    if (!item.who) errors.push(`checklist step ${item.step} has no who`);
    if (!["green", "amber", "red"].includes(item.colour)) {
      errors.push(`checklist step ${item.step} colour must be green, amber or red`);
    }
    if (!item.rules || item.rules.length === 0) {
      errors.push(`checklist step ${item.step} has no rules`);
    } else {
      for (const rid of item.rules) {
        if (!ruleIds.has(rid)) {
          errors.push(`checklist step ${item.step} references unknown rule ${rid}`);
        }
      }
    }
  }

  // Steps must be sequential 1..N
  const sorted = [...stepNumbers].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== i + 1) {
      errors.push(`checklist steps must be sequential 1..N, gap or duplicate at ${i + 1}`);
      break;
    }
  }

  // 6. Red stops
  const redStopIds = new Set<string>();
  const expectedRedStopIds = [
    "RS-01", "RS-02", "RS-03", "RS-04", "RS-05",
    "RS-06", "RS-07", "RS-08", "RS-09", "RS-10",
  ];
  for (const rs of pill.red_stops ?? []) {
    if (!rs.trigger) errors.push("a red stop has no trigger");
    if (!rs.action) errors.push("a red stop has no action");
    if (!rs.who_to_call) errors.push("a red stop has no who_to_call");
    if (!rs.rules || rs.rules.length === 0) {
      errors.push("a red stop has no rules");
    } else {
      for (const rid of rs.rules) {
        if (!ruleIds.has(rid)) {
          errors.push(`red stop references unknown rule ${rid}`);
        }
      }
    }
    // Red stop id validation (S4 item 1)
    if (!rs.id) {
      errors.push("a red stop has no id");
    } else {
      if (redStopIds.has(rs.id)) {
        errors.push(`duplicate red stop id: ${rs.id}`);
      }
      redStopIds.add(rs.id);
      if (pill.version === "1.0" && !expectedRedStopIds.includes(rs.id)) {
        errors.push(`v1.0 red stop id ${rs.id} is not in RS-01 to RS-10`);
      }
    }
  }
  // v1.0 must have exactly RS-01 to RS-10
  if (pill.version === "1.0") {
    for (const id of expectedRedStopIds) {
      if (!redStopIds.has(id)) {
        errors.push(`v1.0 must include red stop ${id}`);
      }
    }
  }

  // S4 item 6: any version's red_stops must equal v1.0's exactly.
  // Compare count, order, and every field (id, trigger, action, who_to_call, rules).
  if (pill.version !== "1.0" && pill.red_stops) {
    const v10 = loadPill(pill.pill_id, "1.0");
    const v10Stops = v10.red_stops ?? [];
    if (pill.red_stops.length !== v10Stops.length) {
      errors.push("red_stops count differs from v1.0");
    } else {
      for (let i = 0; i < pill.red_stops.length; i++) {
        const a = pill.red_stops[i];
        const b = v10Stops[i];
        if (a.id !== b.id) {
          errors.push(`red stop RS-${String(i + 1).padStart(2, "0")} id differs: "${a.id}" vs v1.0 "${b.id}"`);
        }
        if (a.trigger !== b.trigger) {
          errors.push(`red stop ${a.id} trigger differs from v1.0`);
        }
        if (a.action !== b.action) {
          errors.push(`red stop ${a.id} action differs from v1.0`);
        }
        if (a.who_to_call !== b.who_to_call) {
          errors.push(`red stop ${a.id} who_to_call differs from v1.0`);
        }
        if (JSON.stringify(a.rules) !== JSON.stringify(b.rules)) {
          errors.push(`red stop ${a.id} rules differ from v1.0`);
        }
      }
    }
  }

  // 7. Tenant tips
  for (const tip of pill.tenant_tips ?? []) {
    if (!tip.text) errors.push("a tenant tip has no text");
    if (!tip.rules || tip.rules.length === 0) {
      errors.push("a tenant tip has no rules");
    } else {
      for (const rid of tip.rules) {
        if (!ruleIds.has(rid)) {
          errors.push(`tenant tip references unknown rule ${rid}`);
        }
      }
    }
  }

  // 8. Golden tests
  for (const gt of pill.golden_tests ?? []) {
    if (!gt.id) errors.push("a golden test has no id");
    if (!gt.file) errors.push(`golden test ${gt.id} has no file`);
    if (!gt.description) errors.push(`golden test ${gt.id} has no description`);
  }

  return errors;
}

/**
 * Get the live pill version for a building from the demo store.
 * Returns the version string, e.g. "1.0".
 */
export function getLiveVersion(buildingId: string): string {
  const statePath = join(process.cwd(), "data", "state.json");
  try {
    const raw = readFileSync(statePath, "utf-8");
    const state = JSON.parse(raw);
    return state.decisions?.[buildingId]?.liveVersion ?? state.livePillVersion ?? "1.0";
  } catch {
    return "1.0";
  }
}
