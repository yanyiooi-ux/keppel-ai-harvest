import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join, resolve, sep } from "path";
import { parse } from "yaml";
import { loadPill, checkPill, loadAndCheckPillFile, type Pill, type Rule } from "../lib/pill";
import {
  canNudge,
  getActiveChecklist,
  computeRepeatFlag,
  checkRedStop,
  loadTickets,
  type Ticket,
} from "../lib/rule-engine";
import {
  checkCondition,
  screenSuggestion,
  MENU_FACTS,
  BLOCK_STEPS,
  PUT_FIRST_STEPS,
  ADVISORY_LABEL,
} from "../lib/conditions";
import { buildDraft, draftYaml, draftHash, saveDraft, ceCorrRef } from "../lib/draft";
import { GOLDEN_CASES, runGoldenCase } from "../lib/golden-cases";
import { runDraftTests } from "../lib/draft-tests";
import { rankLeads, type RankInput } from "../lib/rank";
import { loadCauses } from "../lib/causes";
import { allCases } from "../lib/cases";
import { allCalls, loadPlaces } from "../lib/places";
import { factsFor, loadBuildings } from "../lib/facts";

// ---- Shared data ----

const FIXTURE_PATH = join(process.cwd(), "tests", "fixtures", "ts-cc-v1.1.yaml");
const V10_PATH = join(process.cwd(), "pills", "ts-cc", "v1.0.yaml");
// Line endings are normalised, so a checkout with CRLF compares the same.
const fixtureText = readFileSync(FIXTURE_PATH, "utf-8").replace(/\r\n/g, "\n");
const v10Text = readFileSync(V10_PATH, "utf-8").replace(/\r\n/g, "\n");
const fixture = parse(fixtureText) as Pill;
const v10 = loadPill("ts-cc", "1.0");
const v10Ids = new Set(v10.rules.map((r) => r.id));
const fixtureNewRule = fixture.rules.find((r) => !v10Ids.has(r.id)) as Rule;

const tickets = loadTickets();
const calls = allCalls({});
const buildings = loadBuildings();
const places = loadPlaces();
const causes = loadCauses().causes;
const everyCase = allCases(calls);
const demoClock = new Date("2026-10-06T10:00:00+08:00");

// The demo solution from the role-played senior manager (S16 item 2).
const DEMO_FIX =
  "If the zone had a fit-out in the last 12 months, check where the thermostat sits against the fit-out drawing before any nudge.";
const DEMO_WHY =
  "The fit-out 8 months ago moved the core thermostat next to the new printer bay, so it reads warm and the box keeps cooling the open area.";
const DEMO_FACT = "fit-out-12m";
const DEMO_EFFECTS = [
  { effect: "block", step: 25 },
  { effect: "put-first", step: 21 },
];

function demoParts(over: Record<string, unknown> = {}) {
  return { fixLine: DEMO_FIX, whyLine: DEMO_WHY, fact: DEMO_FACT, effects: DEMO_EFFECTS, ...over };
}

function ticket(id: string): Ticket {
  const t = tickets.find((x) => x.id === id);
  if (!t) throw new Error(`Ticket ${id} not found`);
  return t;
}

/** The clock rule: the job's report time plus 20 minutes. */
function clockFor(t: Ticket): Date {
  return new Date(new Date(t.reportedAt).getTime() + 20 * 60 * 1000);
}

function checklistFor(pill: Pill, id: string) {
  const t = ticket(id);
  const facts = factsFor(t, calls, buildings, places);
  const repeatFlag = computeRepeatFlag(tickets, t, clockFor(t));
  const redStop = checkRedStop(pill, {});
  const canNudgeResult = canNudge(repeatFlag, redStop, {
    hadSetpointChangeInLast30Days: false,
    changeAmount: 1,
    isAiMakingChange: false,
    pill,
    facts,
  });
  return { ...getActiveChecklist(pill, { repeatFlag, redStop, canNudgeResult, facts }), canNudgeResult };
}

function rankInput(id: string, livePill: Pill): RankInput {
  const job = ticket(id);
  return {
    job: { ...job, facts: factsFor(job, calls, buildings, places) },
    seat: "technician",
    livePill,
    causes,
    allCases: everyCase,
    ticks: [],
    openRedStops: [],
    now: demoClock,
  };
}

const notRepeat = { isRepeat: false, reason: "", count: 1, hasOppositeFixes: false, relatedRuleIds: [] };
const notRed = { isRed: false, trigger: "", action: "", whoToCall: "", relatedRuleIds: [] };
const nudgeContext = { hadSetpointChangeInLast30Days: false, changeAmount: 1, isAiMakingChange: false };

// ---- 1. The fixture (S16 item 6) ----

describe("T-C3c: the v1.1 fixture", () => {
  it("passes checkPill with 0 errors, and loadAndCheckPillFile does not throw", () => {
    expect(checkPill(fixture)).toEqual([]);
    expect(() => loadAndCheckPillFile(FIXTURE_PATH)).not.toThrow();
  });

  it("equals v1.0 apart from exactly 3 changes: version 1.1, the new rule, GT-22", () => {
    expect(fixture.version).toBe("1.1");
    expect(fixture.rules).toHaveLength(v10.rules.length + 1);
    expect(fixture.golden_tests).toHaveLength(v10.golden_tests.length + 1);
    expect(fixture.golden_tests[fixture.golden_tests.length - 1].id).toBe("GT-22");
    const rebuilt = {
      ...v10,
      version: "1.1",
      rules: [...v10.rules, fixtureNewRule],
      golden_tests: [...v10.golden_tests, fixture.golden_tests[fixture.golden_tests.length - 1]],
    };
    expect(fixture).toEqual(rebuilt);
  });

  it("the new rule is the demo rule, TS-CC-27", () => {
    expect(fixtureNewRule.id).toBe("TS-CC-27");
    expect(fixtureNewRule.rule).toBe(DEMO_FIX);
    expect(fixtureNewRule.condition).toEqual({ fact: DEMO_FACT, effects: DEMO_EFFECTS });
  });

  it("its red_stops equal v1.0's", () => {
    expect(fixture.red_stops).toEqual(v10.red_stops);
  });

  it("the new rule's source ref starts CE-CORR- and is the demo clock's date", () => {
    expect(fixtureNewRule.sources).toHaveLength(1);
    expect(fixtureNewRule.sources[0].ref.startsWith("CE-CORR-")).toBe(true);
    expect(fixtureNewRule.sources[0].ref).toBe("CE-CORR-2026-10-06");
  });

  it("v1.0's golden_tests list stays GT-01 to GT-20", () => {
    expect(v10.golden_tests.map((g) => g.id)).toEqual(
      Array.from({ length: 20 }, (_, i) => `GT-${String(i + 1).padStart(2, "0")}`)
    );
  });
});

// ---- 2. checkPill's condition check (S4 item 6) ----

describe("T-C3c: checkPill checks an extra rule against the menu", () => {
  it("an extra rule with no condition is refused", () => {
    const { condition: _drop, ...bare } = fixtureNewRule;
    void _drop;
    const broken = { ...fixture, rules: [...v10.rules, bare as Rule] };
    expect(checkPill(broken).some((e) => e.includes("TS-CC-27") && e.includes("condition"))).toBe(true);
  });

  it("an extra rule whose condition blocks step 8 is refused", () => {
    const broken = {
      ...fixture,
      rules: [...v10.rules, { ...fixtureNewRule, condition: { fact: DEMO_FACT, effects: [{ effect: "block", step: 8 }] } }],
    } as Pill;
    expect(checkPill(broken).some((e) => e.includes("TS-CC-27"))).toBe(true);
  });

  it("an extra rule id that is not TS-CC-27 or higher is refused", () => {
    const broken = { ...fixture, rules: [...v10.rules, { ...fixtureNewRule, id: "RULE-1" }] };
    expect(checkPill(broken).some((e) => e.includes("RULE-1"))).toBe(true);
  });

  it("v1.0 still refuses any extra rule, even one with a valid condition", () => {
    const broken = { ...v10, rules: [...v10.rules, fixtureNewRule] };
    expect(checkPill(broken).some((e) => e.includes("TS-CC-27"))).toBe(true);
  });
});

// ---- 3. canNudge reads the pill (S16 item 3) ----

describe("T-C3c: canNudge reads the pill, not a version string", () => {
  it("with the fixture as pill and the fit-out fact: blocked, with the fixture's new rule id", () => {
    const r = canNudge(notRepeat, notRed, { ...nudgeContext, pill: fixture, facts: ["fit-out-12m"] });
    expect(r.allowed).toBe(false);
    expect(r.ruleIds).toEqual([fixtureNewRule.id]);
  });

  it("the old field hadFitOutInLast12Months also makes the fit-out fact true", () => {
    const r = canNudge(notRepeat, notRed, { ...nudgeContext, pill: fixture, hadFitOutInLast12Months: true });
    expect(r.allowed).toBe(false);
    expect(r.ruleIds).toEqual([fixtureNewRule.id]);
  });

  it("with v1.0 as pill and the fit-out fact: allowed (TS-CC-21)", () => {
    const r = canNudge(notRepeat, notRed, { ...nudgeContext, pill: v10, facts: ["fit-out-12m"] });
    expect(r.allowed).toBe(true);
    expect(r.ruleIds).toEqual(["TS-CC-21"]);
  });

  it("with the fixture but no fit-out fact: allowed", () => {
    const r = canNudge(notRepeat, notRed, { ...nudgeContext, pill: fixture, facts: ["cold-mornings", "core-zone"] });
    expect(r.allowed).toBe(true);
  });

  it("pillVersion is accepted and ignored: \"1.1\" with a fit-out and no pill is allowed", () => {
    const r = canNudge(notRepeat, notRed, { ...nudgeContext, hadFitOutInLast12Months: true, pillVersion: "1.1" });
    expect(r.allowed).toBe(true);
  });

  it("nothing keys on TS-CC-27 or 1.1: the same rule as TS-CC-31 in v2.4 blocks with TS-CC-31", () => {
    const renamed = {
      ...fixture,
      version: "2.4",
      rules: [...v10.rules, { ...fixtureNewRule, id: "TS-CC-31" }],
    };
    const r = canNudge(notRepeat, notRed, { ...nudgeContext, pill: renamed, facts: ["fit-out-12m"] });
    expect(r.allowed).toBe(false);
    expect(r.ruleIds).toEqual(["TS-CC-31"]);
  });

  it("a repeat job is still stopped by TS-CC-09 first", () => {
    const repeat = { ...notRepeat, isRepeat: true, reason: "5 complaints", count: 5 };
    const r = canNudge(repeat, notRed, { ...nudgeContext, pill: fixture, facts: ["repeat", "fit-out-12m"] });
    expect(r.allowed).toBe(false);
    expect(r.ruleIds).toEqual(["TS-CC-09"]);
  });
});

// ---- 4. getActiveChecklist applies the conditions ----

describe("T-C3c: the active checklist under the fixture and under v1.0", () => {
  const safetyThen21 = [1, 2, 3, 4, 5, 6, 7, 8, 21];

  for (const id of ["2301", "2401"]) {
    it(`${id} under the fixture: steps 1 to 8 in order, then step 21, no step 25, the rest in order`, () => {
      const { steps } = checklistFor(fixture, id);
      const order = steps.map((s) => s.step);
      expect(order.slice(0, 9)).toEqual(safetyThen21);
      expect(order).not.toContain(25);
      const rest = order.slice(9);
      expect(rest).toEqual(
        Array.from({ length: 31 }, (_, i) => i + 1).filter((n) => n > 8 && n !== 21 && n !== 25)
      );
    });
  }

  it("2301 on v1.0 gets the dial turn: step 25 is there, all 31 in order, nudge allowed", () => {
    const { steps, canNudgeResult } = checklistFor(v10, "2301");
    expect(steps.map((s) => s.step)).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
    expect(canNudgeResult.allowed).toBe(true);
    expect(canNudgeResult.ruleIds).toEqual(["TS-CC-21"]);
  });

  it("2301 under the fixture: the nudge is blocked by the fixture's new rule", () => {
    const { canNudgeResult } = checklistFor(fixture, "2301");
    expect(canNudgeResult.allowed).toBe(false);
    expect(canNudgeResult.ruleIds).toEqual([fixtureNewRule.id]);
  });
});

// ---- 5. The menu (S16 item 1) ----

describe("T-C3c: the condition menu", () => {
  const fit = (effects: unknown[], fact: unknown = DEMO_FACT) => ({ fact, effects });

  it("the menu is 3 facts, block on step 25 only, put-first on the 15 listed steps", () => {
    expect([...MENU_FACTS]).toEqual(["fit-out-12m", "repeat", "opposite-fixes"]);
    expect([...BLOCK_STEPS]).toEqual([25]);
    expect([...PUT_FIRST_STEPS]).toEqual([9, 10, 11, 12, 13, 15, 17, 18, 19, 20, 21, 22, 23, 29, 30]);
  });

  it("the demo condition fits the menu", () => {
    expect(checkCondition(fit(DEMO_EFFECTS), v10, "green")).toEqual([]);
  });

  it("every allowed put-first step fits, with its own step colour", () => {
    for (const step of PUT_FIRST_STEPS) {
      const colour = v10.checklist.find((s) => s.step === step)!.colour;
      expect(checkCondition(fit([{ effect: "put-first", step }]), v10, colour)).toEqual([]);
    }
  });

  for (const step of [5, 6, 8, 31]) {
    it(`refuses block on step ${step}`, () => {
      expect(checkCondition(fit([{ effect: "block", step }]), v10).length).toBeGreaterThan(0);
    });
  }

  it("refuses put-first on step 25", () => {
    expect(checkCondition(fit([{ effect: "put-first", step: 25 }]), v10).length).toBeGreaterThan(0);
  });

  it("refuses any effect on step 26", () => {
    expect(checkCondition(fit([{ effect: "block", step: 26 }]), v10).length).toBeGreaterThan(0);
    expect(checkCondition(fit([{ effect: "put-first", step: 26 }]), v10).length).toBeGreaterThan(0);
  });

  it("refuses any effect on a step whose rules include TS-CC-03, 04, 05, 08 or 26", () => {
    const guarded = ["TS-CC-03", "TS-CC-04", "TS-CC-05", "TS-CC-08", "TS-CC-26"];
    const steps = v10.checklist.filter((s) => s.rules.some((r) => guarded.includes(r))).map((s) => s.step);
    // read from the pill: 14, 16, 24 and 27 sit outside the safety section
    expect(steps).toEqual(expect.arrayContaining([14, 16, 24, 27]));
    for (const step of steps) {
      const carried = v10.checklist.find((s) => s.step === step)!.rules.filter((r) => guarded.includes(r));
      for (const effect of ["block", "put-first"]) {
        const refusals = checkCondition(fit([{ effect, step }]), v10);
        // refused because of the guarded rule itself, not only because the step is off the list
        expect(
          refusals.some((r) => carried.some((id) => r.includes(id))),
          `${effect} ${step}: ${refusals.join(" | ")}`
        ).toBe(true);
      }
    }
  });

  it("refuses anything touching a red stop", () => {
    expect(checkCondition(fit([{ effect: "block", redStop: "RS-04" }]), v10).length).toBeGreaterThan(0);
    expect(checkCondition(fit([{ effect: "put-first", step: "RS-01" }]), v10).length).toBeGreaterThan(0);
    expect(checkCondition(fit([{ effect: "reorder", redStop: "RS-08" }]), v10).length).toBeGreaterThan(0);
    expect(
      checkCondition(fit([{ effect: "put-first", step: 21, redStop: "RS-02" }]), v10).some((r) =>
        r.toLowerCase().includes("red stop")
      )
    ).toBe(true);
  });

  it("refuses lowering a colour: a green rule that puts amber step 10 first", () => {
    const refusals = checkCondition(fit([{ effect: "put-first", step: 10 }]), v10, "green");
    expect(refusals.some((r) => r.toLowerCase().includes("colour"))).toBe(true);
  });

  it("refuses lowering a colour: an effect that recolours a step down", () => {
    const refusals = checkCondition(fit([{ effect: "put-first", step: 19, colour: "green" }]), v10, "amber");
    expect(refusals.some((r) => r.toLowerCase().includes("colour"))).toBe(true);
  });

  it("refuses a fact that is not on the menu, and 0 or 3 effects", () => {
    expect(checkCondition(fit(DEMO_EFFECTS, "cold-mornings"), v10).length).toBeGreaterThan(0);
    expect(checkCondition(fit([]), v10).length).toBeGreaterThan(0);
    expect(
      checkCondition(
        fit([
          { effect: "block", step: 25 },
          { effect: "put-first", step: 21 },
          { effect: "put-first", step: 17 },
        ]),
        v10
      ).length
    ).toBeGreaterThan(0);
  });

  it("a drafted rule that blocks step 8 comes back as a note, advisory, not enforced", () => {
    const text = "Skip the ceiling safety plan when the zone had a fit-out.";
    const screened = screenSuggestion(
      { kind: "rule", text, fact: DEMO_FACT, effects: [{ effect: "block", step: 8 }] },
      v10
    );
    expect(screened.kind).toBe("note");
    if (screened.kind !== "note") throw new Error("expected a note");
    expect(screened.text).toBe(text);
    expect(screened.label).toBe("advisory, not enforced");
    expect(ADVISORY_LABEL).toBe("advisory, not enforced");
    expect(screened.refusals.length).toBeGreaterThan(0);
  });

  it("an AI note stays a note, and the demo suggestion stays a rule", () => {
    const note = screenSuggestion({ kind: "note", text: "Nothing on the menu fits this one." }, v10);
    expect(note).toEqual({
      kind: "note",
      text: "Nothing on the menu fits this one.",
      label: "advisory, not enforced",
      refusals: [],
    });
    const rule = screenSuggestion({ kind: "rule", text: DEMO_FIX, fact: DEMO_FACT, effects: DEMO_EFFECTS }, v10);
    expect(rule).toEqual({
      kind: "rule",
      text: DEMO_FIX,
      condition: { fact: DEMO_FACT, effects: DEMO_EFFECTS },
      colour: "green",
    });
  });
});

// ---- 6. The draft (S16 item 2) and the demo built by hand ----

describe("T-C3c: the demo solution built by hand from the menu", () => {
  const built = buildDraft(v10, demoParts(), demoClock);

  it("is accepted, and its rule equals the fixture's rule", () => {
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error(built.refusals.join("; "));
    expect(built.rule).toEqual(fixtureNewRule);
  });

  it("passes checkPill", () => {
    if (!built.ok) throw new Error("not built");
    expect(checkPill(built.pill)).toEqual([]);
  });

  it("the whole draft equals the fixture, and its YAML is the fixture byte for byte", () => {
    if (!built.ok) throw new Error("not built");
    expect(built.pill).toEqual(fixture);
    expect(draftYaml(built.pill)).toBe(fixtureText);
  });

  it("AI off: the rule text is the fix line word for word, because holds the why line", () => {
    if (!built.ok) throw new Error("not built");
    expect(built.rule.rule).toBe(DEMO_FIX);
    expect(built.rule.because).toContain(DEMO_WHY);
  });

  it("the CE-CORR date comes from the now it is given, in Singapore time, never the real clock", () => {
    // 07:00 in Singapore is still the day before in UTC
    expect(ceCorrRef(new Date("2026-10-07T07:00:00+08:00"))).toBe("CE-CORR-2026-10-07");
    expect(ceCorrRef(demoClock)).toBe("CE-CORR-2026-10-06");
    const later = buildDraft(v10, demoParts(), new Date("2026-11-02T09:00:00+08:00"));
    if (!later.ok) throw new Error("not built");
    expect(later.rule.sources[0].ref).toBe("CE-CORR-2026-11-02");
  });

  it("a rule the menu refuses builds nothing", () => {
    const refused = buildDraft(v10, demoParts({ effects: [{ effect: "block", step: 8 }] }), demoClock);
    expect(refused.ok).toBe(false);
    if (refused.ok) throw new Error("expected a refusal");
    expect(refused.refusals.length).toBeGreaterThan(0);
  });

  it("fix and why lines must be 3 to 30 words each", () => {
    expect(buildDraft(v10, demoParts({ fixLine: "Check thermostat." }), demoClock).ok).toBe(false);
    const long = Array.from({ length: 31 }, () => "word").join(" ");
    expect(buildDraft(v10, demoParts({ whyLine: long }), demoClock).ok).toBe(false);
    const thirty = Array.from({ length: 30 }, () => "word").join(" ");
    expect(buildDraft(v10, demoParts({ whyLine: thirty }), demoClock).ok).toBe(true);
  });

  it("a draft on top of v1.1 takes the next free id and version, and adds GT-22 only once", () => {
    const next = buildDraft(
      fixture,
      demoParts({ fact: "repeat", effects: [{ effect: "put-first", step: 18 }] }),
      demoClock
    );
    if (!next.ok) throw new Error(next.refusals.join("; "));
    expect(next.pill.version).toBe("1.2");
    expect(next.rule.id).toBe("TS-CC-28");
    expect(next.pill.golden_tests.filter((g) => g.id === "GT-22")).toHaveLength(1);
    expect(checkPill(next.pill)).toEqual([]);
  });

  it("the base pill is not changed by building a draft", () => {
    const before = JSON.stringify(v10);
    buildDraft(v10, demoParts(), demoClock);
    expect(JSON.stringify(v10)).toBe(before);
  });
});

describe("T-C3c: a draft lives in the runtime folder, never in pills/ts-cc", () => {
  it("saveDraft writes into the memory's runtime folder and nowhere under pills/", () => {
    const built = buildDraft(v10, demoParts(), demoClock);
    if (!built.ok) throw new Error("not built");
    const pillsBefore = readdirSync(join(process.cwd(), "pills", "ts-cc")).sort();

    const saved = saveDraft(built.pill);

    const runtime = resolve(`${process.env.PILL_DESK_STATE_FILE}.runtime`);
    expect(resolve(saved.path).startsWith(runtime + sep)).toBe(true);
    expect(resolve(saved.path).includes(`${sep}pills${sep}`)).toBe(false);
    expect(readFileSync(saved.path, "utf-8")).toBe(saved.yaml);
    expect(saved.hash).toBe(draftHash(saved.yaml));
    expect(readdirSync(join(process.cwd(), "pills", "ts-cc")).sort()).toEqual(pillsBefore);
    expect(() => loadAndCheckPillFile(saved.path)).not.toThrow();
  });
});

// ---- 7. draftHash (S16 item 7) ----

describe("T-C3c: draftHash changes when the draft changes, and only then", () => {
  it("is the SHA-256 of the YAML text, 64 hex characters", () => {
    expect(draftHash(fixtureText)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("the same draft built twice has the same hash; so does the YAML read back and written again", () => {
    const a = buildDraft(v10, demoParts(), demoClock);
    const b = buildDraft(v10, demoParts(), demoClock);
    if (!a.ok || !b.ok) throw new Error("not built");
    expect(draftHash(draftYaml(a.pill))).toBe(draftHash(draftYaml(b.pill)));
    expect(draftHash(draftYaml(parse(draftYaml(a.pill)) as Pill))).toBe(draftHash(draftYaml(a.pill)));
    expect(draftHash(draftYaml(a.pill))).toBe(draftHash(fixtureText));
  });

  it("a changed rule text, why line or effect changes the hash", () => {
    const base = buildDraft(v10, demoParts(), demoClock);
    const text = buildDraft(v10, demoParts({ ruleText: "Check the thermostat spot against the drawing first." }), demoClock);
    const why = buildDraft(v10, demoParts({ whyLine: "The thermostat sits beside the new printer bay now." }), demoClock);
    const effect = buildDraft(v10, demoParts({ effects: [{ effect: "block", step: 25 }] }), demoClock);
    if (!base.ok || !text.ok || !why.ok || !effect.ok) throw new Error("not built");
    const h = draftHash(draftYaml(base.pill));
    expect(draftHash(draftYaml(text.pill))).not.toBe(h);
    expect(draftHash(draftYaml(why.pill))).not.toBe(h);
    expect(draftHash(draftYaml(effect.pill))).not.toBe(h);
  });
});

// ---- 8. Golden cases (S16 item 4) ----

describe("T-C3c: golden cases in web/lib/golden-cases.ts", () => {
  it("GT-01 to GT-22, each with id, title, inputs, expected answer and appliesTo", () => {
    expect(GOLDEN_CASES.map((c) => c.id)).toEqual(
      Array.from({ length: 22 }, (_, i) => `GT-${String(i + 1).padStart(2, "0")}`)
    );
    for (const c of GOLDEN_CASES) {
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.inputs).toBeDefined();
      expect(c.expected).toBeDefined();
      expect(["no-fit-out-rule", "fit-out-rule", "all"]).toContain(c.appliesTo);
    }
  });

  it("GT-01 and GT-21 are no-fit-out-rule, GT-22 is fit-out-rule, the rest all", () => {
    const by = Object.fromEntries(GOLDEN_CASES.map((c) => [c.id, c.appliesTo]));
    expect(by["GT-01"]).toBe("no-fit-out-rule");
    expect(by["GT-21"]).toBe("no-fit-out-rule");
    expect(by["GT-22"]).toBe("fit-out-rule");
    for (const c of GOLDEN_CASES.filter((x) => !["GT-01", "GT-21", "GT-22"].includes(x.id))) {
      expect(c.appliesTo, c.id).toBe("all");
    }
  });

  it("on v1.0 every case passes except GT-22, which is not applicable to v1.0", () => {
    for (const c of GOLDEN_CASES) {
      const r = runGoldenCase(c, v10);
      if (c.id === "GT-22") {
        expect(r.status).toBe("not-applicable");
        expect(r.label).toBe("not applicable to v1.0");
      } else {
        expect(r.status, `${c.id}: ${r.detail}`).toBe("passed");
      }
    }
  });

  it("a golden case that bites: GT-03 fails on a pill whose RS-02 no longer cites TS-CC-03", () => {
    const broken = {
      ...v10,
      red_stops: v10.red_stops.map((rs) => (rs.id === "RS-02" ? { ...rs, rules: ["TS-CC-05"] } : rs)),
    };
    const gt03 = GOLDEN_CASES.find((c) => c.id === "GT-03")!;
    expect(runGoldenCase(gt03, broken).status).toBe("failed");
  });
});

// ---- 9. Run tests on a draft (S16 item 5) ----

describe("T-C3c: run tests on the fixture", () => {
  const run = runDraftTests(fixtureText, { now: demoClock });
  const byId = Object.fromEntries(run.results.map((r) => [r.id, r]));

  it("GT-22 and R-01 pass", () => {
    expect(byId["GT-22"].status, byId["GT-22"].detail).toBe("passed");
    expect(byId["R-01"].status, byId["R-01"].detail).toBe("passed");
  });

  it("GT-01 and GT-21 show not applicable to v1.1, never passed", () => {
    expect(byId["GT-01"].status).toBe("not-applicable");
    expect(byId["GT-01"].label).toBe("not applicable to v1.1");
    expect(byId["GT-21"].status).toBe("not-applicable");
    expect(byId["GT-21"].label).toBe("not applicable to v1.1");
  });

  it("checkPill, the red stops and GT-02 to GT-20 pass; 0 failed", () => {
    expect(byId["checkPill"].status).toBe("passed");
    expect(byId["red-stops"].status).toBe("passed");
    for (let i = 2; i <= 20; i++) {
      const id = `GT-${String(i).padStart(2, "0")}`;
      expect(byId[id].status, `${id}: ${byId[id].detail}`).toBe("passed");
    }
    expect(run.failed).toBe(0);
    expect(run.passed).toBe(23);
    expect(run.notApplicable).toBe(2);
    expect(run.ok).toBe(true);
  });

  it("stores the draft hash it saw, and the version", () => {
    expect(run.draftHash).toBe(draftHash(fixtureText));
    expect(run.version).toBe("1.1");
  });

  it("on v1.0 itself GT-22 and R-01 are not applicable to v1.0, and GT-01 passes", () => {
    const v10Run = runDraftTests(v10Text, { now: demoClock });
    const r = Object.fromEntries(v10Run.results.map((x) => [x.id, x]));
    expect(r["GT-22"].label).toBe("not applicable to v1.0");
    expect(r["R-01"].label).toBe("not applicable to v1.0");
    expect(r["GT-01"].status).toBe("passed");
  });

  it("a draft with a changed red stop fails the red stop check and checkPill", () => {
    const broken = draftYaml({
      ...fixture,
      red_stops: fixture.red_stops.map((rs) => (rs.id === "RS-04" ? { ...rs, action: "Carry on." } : rs)),
    });
    const bad = runDraftTests(broken, { now: demoClock });
    const r = Object.fromEntries(bad.results.map((x) => [x.id, x]));
    expect(r["red-stops"].status).toBe("failed");
    expect(r["checkPill"].status).toBe("failed");
    expect(bad.ok).toBe(false);
    expect(bad.failed).toBeGreaterThan(0);
  });

  it("R-01 fails a fit-out rule that puts first a check the cold jobs do not rank first (step 23, sun on the west glass)", () => {
    const built = buildDraft(
      v10,
      demoParts({ effects: [{ effect: "block", step: 25 }, { effect: "put-first", step: 23 }] }),
      demoClock
    );
    if (!built.ok) throw new Error(built.refusals.join("; "));
    const r = runDraftTests(draftYaml(built.pill), { now: demoClock }).results.find((x) => x.id === "R-01")!;
    expect(r.status).toBe("failed");
  });

  it("R-01 checks every open job whose facts make the rule's fact true: 2318 and 2401", () => {
    const r = runDraftTests(fixtureText, { now: demoClock }).results.find((x) => x.id === "R-01")!;
    expect(r.detail).toContain("2318");
    expect(r.detail).toContain("2401");
  });
});

// ---- S0 rule 5: pill words come from the pill ----

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe("T-C3c: pill words are read from the pill, never typed in", () => {
  it("web/app and web/lib hold none of the red stop texts (30+ chars) or the TS-CC-03, 04, 05 not_when lines", () => {
    // the C3a guard asks git for web/app from inside web/, so it reads no files; this one reads them
    const files = [...sourceFiles(join(process.cwd(), "app")), ...sourceFiles(join(process.cwd(), "lib"))];
    expect(files.length).toBeGreaterThan(30);
    const all = files.map((f) => readFileSync(f, "utf-8")).join("\n");
    const snippets: string[] = [];
    for (const rs of v10.red_stops) {
      for (const field of [rs.trigger, rs.action, rs.who_to_call]) if (field.length >= 30) snippets.push(field.slice(0, 30));
    }
    for (const id of ["TS-CC-03", "TS-CC-04", "TS-CC-05"]) {
      const notWhen = v10.rules.find((r) => r.id === id)!.not_when;
      if (notWhen.length >= 30) snippets.push(notWhen.slice(0, 30));
    }
    for (const s of snippets) expect(all, s).not.toContain(s);
  });

  it("the C3c modules hold no rule text, step text, red stop text or tenant tip from the pill", () => {
    const mine = ["conditions.ts", "draft.ts", "draft-tests.ts", "golden-cases.ts", "fact-labels.ts"].map((f) =>
      readFileSync(join(process.cwd(), "lib", f), "utf-8")
    );
    const snippets = [
      ...v10.rules.flatMap((r) => [r.rule, r.not_when, r.because]),
      ...v10.checklist.map((s) => s.text),
      ...v10.red_stops.flatMap((rs) => [rs.trigger, rs.action, rs.who_to_call]),
      ...v10.tenant_tips.map((t) => t.text),
    ]
      .filter((t) => t.length >= 30)
      .map((t) => t.slice(0, 30));
    for (const src of mine) for (const s of snippets) expect(src, s).not.toContain(s);
  });
});

// ---- 10. Ranking with the rule (S9, S16 item 3) ----

describe("T-C3c: ranking reads the same conditions", () => {
  it("2401 with the fixture live: thermostat-spot first (signed-rule, TS-CC-27), then precool, min-airflow", () => {
    const result = rankLeads(rankInput("2401", fixture));
    expect(result.leads.map((l) => l.causeId)).toEqual(["thermostat-spot", "precool", "min-airflow"]);
    expect(result.leads[0].tier).toBe("signed-rule");
    expect(result.leads[0].reason.startsWith("Signed expert rule TS-CC-27 (v1.1)")).toBe(true);
  });

  it("the signed-rule reason names the rule's fact by its S5 label", () => {
    const lead = rankLeads(rankInput("2401", fixture)).leads[0];
    const tail = lead.N > 0 ? ` ${lead.W} of ${lead.N} similar cases stayed fixed so far.` : "";
    expect(lead.reason).toBe(
      `Signed expert rule TS-CC-27 (v1.1): renovation in the last 12 months puts this check first.${tail}`
    );
  });

  it("2401 with the fixture live: setpoint is removed by TS-CC-27", () => {
    const result = rankLeads(rankInput("2401", fixture));
    const sp = result.removed.find((r) => r.causeId === "setpoint");
    expect(sp).toBeDefined();
    expect(sp!.reason.startsWith("Removed by TS-CC-27:")).toBe(true);
    expect(result.leads.find((l) => l.causeId === "setpoint")).toBeUndefined();
  });

  it("2401 with v1.0 live: thermostat-spot is third", () => {
    const result = rankLeads(rankInput("2401", v10));
    expect(result.leads[2].causeId).toBe("thermostat-spot");
    expect(result.leads[2].tier).toBe("low-confidence");
  });

  it("2401 with v1.0 live: the setpoint reason uses the S5 label for the fit-out fact", () => {
    const sp = rankLeads(rankInput("2401", v10)).leads.find((l) => l.causeId === "setpoint")!;
    expect(sp.reason).toBe(
      "cold mornings + core zone + renovation in the last 12 months: only 2 of 4 similar cases stayed fixed; 2 failed fixes count against."
    );
  });

  it("2318 with the fixture live: thermostat-spot first; setpoint still removed by TS-CC-09 (repeat comes first)", () => {
    const result = rankLeads(rankInput("2318", fixture));
    expect(result.leads[0].causeId).toBe("thermostat-spot");
    expect(result.leads[0].tier).toBe("signed-rule");
    expect(result.alertSeniorManager).toBe(false);
    const sp = result.removed.find((r) => r.causeId === "setpoint")!;
    expect(sp.reason).toContain("TS-CC-09");
  });

  it("a rule whose fact is false for the job changes nothing", () => {
    const repeatRule = buildDraft(
      v10,
      demoParts({ fact: "opposite-fixes", effects: [{ effect: "put-first", step: 21 }] }),
      demoClock
    );
    if (!repeatRule.ok) throw new Error(repeatRule.refusals.join("; "));
    // 2401 has no opposite fixes, so it ranks as on v1.0
    const onDraft = rankLeads(rankInput("2401", repeatRule.pill)).leads.map((l) => l.causeId);
    const onV10 = rankLeads(rankInput("2401", v10)).leads.map((l) => l.causeId);
    expect(onDraft).toEqual(onV10);
  });
});
