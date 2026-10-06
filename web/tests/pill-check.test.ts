import { describe, it, expect } from "vitest";
import { loadPill, checkPill } from "../lib/pill";

describe("Pill v1.0 structural checks", () => {
  const pill = loadPill("ts-cc", "1.0");

  it("has pill_id ts-cc", () => {
    expect(pill.pill_id).toBe("ts-cc");
  });

  it("has version 1.0", () => {
    expect(pill.version).toBe("1.0");
  });

  it("has status approved", () => {
    expect(pill.status).toBe("approved");
  });

  it("has a contributor marked as not real", () => {
    expect(pill.contributor.real).toBe(false);
  });

  it("has exactly 26 rules (TS-CC-01 to TS-CC-26)", () => {
    const ids = pill.rules.map((r) => r.id);
    expect(ids).toHaveLength(26);
    for (let i = 1; i <= 26; i++) {
      expect(ids).toContain(`TS-CC-${String(i).padStart(2, "0")}`);
    }
  });

  it("does NOT include TS-CC-27 (reserved for v1.1)", () => {
    const ids = pill.rules.map((r) => r.id);
    expect(ids).not.toContain("TS-CC-27");
  });

  it("has the four core never-list items", () => {
    const ids = pill.never_list.map((n) => n.id);
    expect(ids).toContain("never-quote-price");
    expect(ids).toContain("never-admit-fault");
    expect(ids).toContain("never-cross-tenant");
    expect(ids).toContain("never-write-bms");
  });

  it("has 31 checklist steps, sequential 1 to 31", () => {
    const steps = pill.checklist.map((c) => c.step);
    expect(steps).toHaveLength(31);
    for (let i = 1; i <= 31; i++) {
      expect(steps).toContain(i);
    }
  });

  it("every checklist step references a rule that exists", () => {
    const ruleIds = new Set(pill.rules.map((r) => r.id));
    for (const item of pill.checklist) {
      for (const rid of item.rules) {
        expect(ruleIds.has(rid)).toBe(true);
      }
    }
  });

  it("every rule has a colour that is green, amber or red", () => {
    for (const rule of pill.rules) {
      expect(["green", "amber", "red"]).toContain(rule.colour);
    }
  });

  it("every rule has a because text", () => {
    for (const rule of pill.rules) {
      expect(rule.because.length).toBeGreaterThan(10);
    }
  });

  it("every rule has at least one source with a label", () => {
    for (const rule of pill.rules) {
      expect(rule.sources.length).toBeGreaterThan(0);
      for (const src of rule.sources) {
        expect(src.label).toBeTruthy();
      }
    }
  });

  it("every red stop references a rule that exists", () => {
    const ruleIds = new Set(pill.rules.map((r) => r.id));
    for (const rs of pill.red_stops) {
      for (const rid of rs.rules) {
        expect(ruleIds.has(rid)).toBe(true);
      }
    }
  });

  it("every tenant tip references a rule that exists", () => {
    const ruleIds = new Set(pill.rules.map((r) => r.id));
    for (const tip of pill.tenant_tips) {
      for (const rid of tip.rules) {
        expect(ruleIds.has(rid)).toBe(true);
      }
    }
  });

  it("passes all structural checks (checkPill returns no errors)", () => {
    const errors = checkPill(pill);
    if (errors.length > 0) {
      console.error("Pill check errors:", errors);
    }
    expect(errors).toEqual([]);
  });
});
