/**
 * D1: plain words everywhere. The map (web/lib/plain-words.ts).
 *
 * Every code a judge can see has a plain word, written from the pill's own
 * text: each rule, step and stop word carries a key that must appear in the
 * pill (or the v1.1 fixture for TS-CC-27). The words read at about a 7th-grade
 * level: 20 words at most, no em dash, no acronym unless it is explained in
 * brackets. The tokenizer finds the codes in the engine's real sentences and
 * never loses a character of them.
 *
 * The last block runs the whole demo through the route code (AI off, so no
 * model and no saved answer) and checks every code that lands on any seat's
 * screen, step by step, has a plain word.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import YAML from "yaml";
import { loadPill } from "../lib/pill";
import { managerMenu } from "../lib/senior-manager-desk";
import { MENU_FACTS, PUT_FIRST_STEPS, BLOCK_STEPS } from "../lib/conditions";
import { FACT_LABELS } from "../lib/fact-labels";
import { SEAT_IDS } from "../lib/permissions";
import * as memory from "../lib/memory";
import { actionTurn } from "../lib/action-turn";
import { chatTurn } from "../lib/chat-turn";
import { seatView } from "../lib/seat-view";
import { CHIPS_BY_SEAT } from "../lib/chat";
import type { AiDeps, ModelClient } from "../lib/ai";
import {
  RULE_WORDS,
  STOP_WORDS,
  PUT_FIRST_WORDS,
  BLOCK_WORDS,
  TIER_WORDS,
  STATUS_WORDS,
  NOTICE_WORDS,
  APPROVAL_WORDS,
  APPROVAL_WHAT,
  SEAT_WORDS,
  FACT_WORDS,
  NEW_RULE_WORD,
  ruleWord,
  stopWord,
  effectWord,
  effectValueFromLabel,
  factIdFromLabel,
  factWord,
  codeWord,
  splitCodes,
  plainSentence,
  statusWord,
  tierWord,
  noticeWord,
  pipNeverLine,
  GATE_WORDS,
  gateWord,
} from "../lib/plain-words";
import { GATE_LABELS } from "../lib/hq-flow";
import { openingLineFor } from "../lib/seat-opening";
import { nextRuleId } from "../lib/draft";

const v10 = loadPill("ts-cc", "1.0");
const v11 = YAML.parse(readFileSync(join(process.cwd(), "tests", "fixtures", "ts-cc-v1.1.yaml"), "utf-8")) as {
  rules: { id: string; rule: string }[];
};

const has = (text: string, key: string) => text.toLowerCase().includes(key.toLowerCase());

/** A TypeScript string union, read from the source file, so a new value can never slip past the map. */
function unionFrom(file: string, start: RegExp): string[] {
  const src = readFileSync(join(process.cwd(), "lib", file), "utf-8");
  const at = src.search(start);
  expect(at, `${start} in lib/${file}`).toBeGreaterThan(-1);
  const body = src.slice(at, src.indexOf(";", at));
  return [...body.matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]);
}

describe("D1: every rule, stop and step has a plain word from the pill's own text", () => {
  it("every rule in the v1.0 pill, each word grounded in its rule text", () => {
    expect(v10.rules).toHaveLength(26);
    for (const rule of v10.rules) {
      const entry = RULE_WORDS[rule.id];
      expect(entry, rule.id).toBeDefined();
      expect(has(String(rule.rule), entry.key), `${rule.id}'s key "${entry.key}"`).toBe(true);
      expect(ruleWord(rule.id)).toBe(entry.word);
      expect(ruleWord(rule.id)).not.toBe(NEW_RULE_WORD);
    }
  });

  it("TS-CC-27 and later get no fixed meaning: the id goes to whatever rule the senior manager writes first (D1 review)", () => {
    // draft.ts gives TS-CC-27 to the first new rule, whatever its fix line, fact and effects.
    expect(nextRuleId(v10)).toBe("TS-CC-27");
    expect(v11.rules.map((r) => r.id)).toContain("TS-CC-27");
    for (const id of ["TS-CC-27", "TS-CC-28", "TS-CC-40"]) {
      expect(RULE_WORDS[id], id).toBeUndefined();
      expect(ruleWord(id)).toBe(NEW_RULE_WORD);
      expect(codeWord(id)).toBe(NEW_RULE_WORD);
    }
    // So a sentence about a new rule that is not the demo's (blinds on hot afternoons) never reads as the thermostat.
    const said = plainSentence("v1.1 adds the rule TS-CC-27 (blinds first on hot afternoons).");
    expect(said).toBe(`v1.1 adds the rule “${NEW_RULE_WORD}” TS-CC-27 (blinds first on hot afternoons).`);
    expect(said.toLowerCase()).not.toContain("thermostat");
  });

  it("every red stop, its short name grounded in the stop's trigger", () => {
    expect(v10.red_stops).toHaveLength(10);
    for (const stop of v10.red_stops) {
      const entry = STOP_WORDS[stop.id];
      expect(entry, stop.id).toBeDefined();
      expect(has(stop.trigger, entry.key), `${stop.id}'s key "${entry.key}"`).toBe(true);
      expect(stopWord(stop.id)).toBe(entry.word);
    }
  });

  it("every step the menu may put first or block, grounded in the step's text", () => {
    for (const n of PUT_FIRST_STEPS) {
      const step = v10.checklist.find((s) => s.step === n)!;
      expect(PUT_FIRST_WORDS[n], `put-first ${n}`).toBeDefined();
      expect(has(step.text, PUT_FIRST_WORDS[n].key), `step ${n}'s key "${PUT_FIRST_WORDS[n].key}"`).toBe(true);
    }
    for (const n of BLOCK_STEPS) {
      const step = v10.checklist.find((s) => s.step === n)!;
      expect(BLOCK_WORDS[n], `block ${n}`).toBeDefined();
      expect(has(step.text, BLOCK_WORDS[n].key)).toBe(true);
    }
    // The demo's own picks, as the plan names them.
    expect(effectWord("block:25")).toBe("Don't just turn the dial");
    expect(effectWord("put-first:21")).toBe("Check where the thermostat sits first");
    expect(effectWord("none")).toBe("No second effect");
  });

  it("every effect the code menu offers has its own plain word, and its menu label maps back to it", () => {
    const menu = managerMenu(v10);
    expect(menu.effects.length).toBeGreaterThan(0);
    for (const e of menu.effects) {
      expect(effectWord(e.value), e.value).not.toBe(e.value);
      expect(effectWord(e.value)).not.toMatch(/^(Skip|Do) step/);
      expect(effectValueFromLabel(e.label)).toBe(e.value);
    }
    for (const f of menu.facts) {
      expect(factWord(f.value)).not.toBe(f.value);
      expect(factIdFromLabel(f.label)).toBe(f.value);
    }
  });
});

describe("D1: every status, tier, notice, approval, seat and fact a screen shows", () => {
  it("every job status in memory.ts", () => {
    const statuses = unionFrom("memory.ts", /export type JobStatus =/);
    expect(statuses).toHaveLength(11);
    for (const s of statuses) {
      expect(STATUS_WORDS[s as keyof typeof STATUS_WORDS], s).toBeDefined();
      expect(statusWord(s)).not.toBe(s.replace(/-/g, " "));
    }
  });

  it("every notice kind in memory.ts", () => {
    const kinds = unionFrom("memory.ts", /kind:\s*\n\s*\| "speak-first"/);
    expect(kinds).toHaveLength(10);
    for (const k of kinds) {
      expect(NOTICE_WORDS[k as keyof typeof NOTICE_WORDS], k).toBeDefined();
      expect(noticeWord(k)).not.toBe(k.replace(/-/g, " "));
    }
  });

  it("every lead tier in rank.ts", () => {
    const tiers = unionFrom("rank.ts", /export type Tier =/);
    expect(tiers).toEqual(["found", "signed-rule", "case-backed", "low-confidence", "net-failed"]);
    for (const t of tiers) {
      expect(TIER_WORDS[t as keyof typeof TIER_WORDS], t).toBeDefined();
      expect(tierWord(t)).not.toBe(t.replace(/-/g, " "));
    }
  });

  it("every check HQ's approve waits on (S16 item 8), and the base check", () => {
    for (const id of [...Object.keys(GATE_LABELS), "base"]) {
      expect(GATE_WORDS[id], id).toBeDefined();
      expect(gateWord(id)).not.toBe(id);
    }
    // No function name on screen: "loadAndCheckPill" becomes words.
    expect(Object.values(GATE_WORDS).join(" ")).not.toMatch(/load|Check[A-Z]/);
  });

  it("A1 to A4, the seats and the facts", () => {
    expect(Object.keys(APPROVAL_WORDS)).toEqual(["A1", "A2", "A3", "A4"]);
    expect(APPROVAL_WORDS.A2).toBe("Head office approves a new fix");
    for (const seat of SEAT_IDS) expect(SEAT_WORDS[seat], seat).toBeDefined();
    for (const f of [...MENU_FACTS, ...Object.keys(FACT_LABELS)]) {
      expect(FACT_WORDS[f], f).toBeDefined();
    }
    expect(factWord("fit-out-12m")).toBe("Renovated in the last 12 months");
  });
});

describe("D1: the seat's Pip never line reads as a sentence on screen", () => {
  it("every seat's line becomes Pip will never ..., and the line itself is left alone", () => {
    for (const seat of SEAT_IDS) {
      const line = openingLineFor(seat).never;
      expect(line.startsWith("Pip never ")).toBe(true);
      expect(pipNeverLine(line)).toBe(line.replace("Pip never ", "Pip will never "));
    }
    expect(pipNeverLine(openingLineFor("technician").never)).toBe(
      "Pip will never approve anything, or use a fix the rules removed."
    );
  });
});

describe("D1: the words read at about a 7th-grade level", () => {
  const all: [string, string][] = [
    ...Object.entries(RULE_WORDS).map(([k, v]) => [k, v.word] as [string, string]),
    ...Object.entries(STOP_WORDS).map(([k, v]) => [k, v.word] as [string, string]),
    ...Object.entries(PUT_FIRST_WORDS).map(([k, v]) => [`put-first:${k}`, v.word] as [string, string]),
    ...Object.entries(BLOCK_WORDS).map(([k, v]) => [`block:${k}`, v.word] as [string, string]),
    ...Object.entries(TIER_WORDS),
    ...Object.entries(STATUS_WORDS),
    ...Object.entries(NOTICE_WORDS),
    ...Object.entries(APPROVAL_WORDS),
    ...Object.entries(APPROVAL_WHAT).map(([k, v]) => [`${k} what`, v] as [string, string]),
    ...Object.entries(SEAT_WORDS),
    ...Object.entries(GATE_WORDS),
    ...Object.entries(FACT_WORDS),
    ["new rule", NEW_RULE_WORD],
  ];

  it("short, no em dash, no code inside, no unexplained acronym", () => {
    expect(all.length).toBeGreaterThan(90);
    for (const [code, word] of all) {
      expect(word.split(/\s+/).length, code).toBeLessThanOrEqual(20);
      expect(word, code).not.toContain(String.fromCharCode(0x2014));
      expect(word, code).not.toMatch(/TS-CC|RS-\d|\bA[1-4]\b/);
      expect(word.trim(), code).not.toBe(code);
      // An acronym (2 or more capitals) is fine only as "AI", or explained before it in brackets.
      const outside = word.replace(/\([^)]*\)/g, "");
      for (const caps of outside.match(/\b[A-Z]{2,}\b/g) ?? []) {
        expect(caps, `${code}: "${word}"`).toBe("AI");
      }
    }
  });
});

describe("D1: the tokenizer finds the codes in the engine's own sentences", () => {
  const sentences = [
    "Low confidence, expert rule TS-CC-18: only 1 similar case so far.",
    "Repeat flag on: 5 calls in 30 days, with opposite fixes (TS-CC-09)",
    "Covered by the tenant's fit-out contract: goes through the AOM (TS-CC-11)",
    "Draft: confirm each part, run the tests, then send it to HQ (A2).",
    "Open now in Tower A: RS-04 on Level 23",
    "Charge request A4-1 · job 2318 · 2318 · v1.1 · a19bfa5",
  ];

  it("joins back to the very same sentence, so nothing the engine said is lost", () => {
    for (const s of sentences) {
      const joined = splitCodes(s)
        .map((p) => (p.kind === "text" ? p.text : p.code))
        .join("");
      expect(joined).toBe(s);
    }
  });

  it("finds rule ids, stop ids and bracketed approvals, and leaves request ids, jobs and versions alone", () => {
    const codes = (s: string) => splitCodes(s).flatMap((p) => (p.kind === "code" ? [p.code] : []));
    expect(codes(sentences[0])).toEqual(["TS-CC-18"]);
    expect(codes(sentences[1])).toEqual(["TS-CC-09"]);
    expect(codes(sentences[3])).toEqual(["A2"]);
    expect(codes(sentences[4])).toEqual(["RS-04"]);
    expect(codes(sentences[5])).toEqual([]);
    expect(codes("No code here at all.")).toEqual([]);
  });

  it("puts the plain words first and keeps the code after them", () => {
    expect(plainSentence(sentences[0])).toBe(
      "Low confidence, expert rule “Check the thermostat sensor is in the right spot” TS-CC-18: only 1 similar case so far."
    );
    expect(plainSentence(sentences[3])).toBe(
      "Draft: confirm each part, run the tests, then send it to HQ (Head office approves a new fix A2)."
    );
    expect(plainSentence(sentences[4])).toBe("Open now in Tower A: Water near the electrics RS-04 on Level 23");
  });

  it("a job status after \"Status: \" gets its plain words, as Show job says it (D1 review)", () => {
    const said = "Tower A, Level 23, Northwind Advisory. too cold, mornings, around 9am. Status: in-progress.";
    expect(splitCodes(said).flatMap((p) => (p.kind === "code" ? [p.code] : []))).toEqual(["in-progress"]);
    expect(plainSentence(said)).toBe(
      "Tower A, Level 23, Northwind Advisory. too cold, mornings, around 9am. Status: Technician is on it in-progress."
    );
    for (const status of Object.keys(STATUS_WORDS)) {
      const line = `Job 2318. Status: ${status}.`;
      expect(plainSentence(line), status).toBe(`Job 2318. Status: ${STATUS_WORDS[status as keyof typeof STATUS_WORDS]} ${status}.`);
      expect(splitCodes(line).map((p) => (p.kind === "text" ? p.text : p.code)).join("")).toBe(line);
    }
    // A status word anywhere else is left alone ("self-check" is also a card's name).
    expect(plainSentence("Self-check · pill v1.0 · AI calls: 0")).toBe("Self-check · pill v1.0 · AI calls: 0");
  });

  it("a safety alert's receipt line keeps its stop code bare, even inside a longer answer (D1 review)", () => {
    const alert = "Red stop on Tower A, Level 23\nWater dripping.\nCall: FM control room\nRed stop RS-04 · AI calls: 0 · raised by Tenant (role-played)";
    const needs = `Who pays? This is work on the tenant's fit-out (TS-CC-11).\n\n${alert}`;
    expect(plainSentence(needs)).toBe(
      `Who pays? This is work on the tenant's fit-out (“${RULE_WORDS["TS-CC-11"].word}” TS-CC-11).\n\n${alert}`
    );
    // A stop code in a sentence of its own still gets its name.
    expect(plainSentence("Open now in Tower A: RS-04 on Level 23")).toContain("Water near the electrics RS-04");
  });

  it("the pill's stop words, steps and tips carry no code, so the plain layer never touches them", () => {
    const pillText = [
      ...v10.red_stops.flatMap((s) => [s.trigger, s.action, s.who_to_call]),
      ...v10.checklist.map((s) => s.text),
      ...v10.tenant_tips.map((t) => t.text),
    ];
    for (const text of pillText) {
      expect(splitCodes(text).every((p) => p.kind === "text"), text).toBe(true);
      expect(plainSentence(text)).toBe(text);
    }
  });
});

describe("D1: every code that lands on a seat's screen during the demo has a plain word", () => {
  const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");
  const FIX =
    "If the zone had a fit-out in the last 12 months, check where the thermostat sits against the fit-out drawing before any nudge.";
  const WHY =
    "The fit-out 8 months ago moved the core thermostat next to the new printer bay, so it reads warm and the box keeps cooling the open area.";
  const never: ModelClient = {
    async complete() {
      throw new Error("the AI is off in this test");
    },
  };
  const deps: AiDeps = { client: never };

  it("all 5 seats, after every press of the demo (AI off)", async () => {
    const seen = new Map<string, Set<string>>([
      ["code", new Set()],
      ["tier", new Set()],
      ["status", new Set()],
      ["notice", new Set()],
      // A job status inside a card's own sentence ("Status: in-progress." from Show job), D1 review.
      ["card-status", new Set()],
      ["chip", new Set()],
    ]);

    const look = () => {
      const state = memory.read();
      for (const seat of SEAT_IDS) {
        const view = seatView(state, seat, "off", REAL_NOW);
        const text = JSON.stringify(view);
        for (const m of text.matchAll(/TS-CC-\d{2}|RS-\d{2}|\bA[1-4]\b(?!-)/g)) seen.get("code")!.add(m[0]);
        // A bare status code ("Status: in-progress."). A status already in words ("Status: new solution
        // drafted.", the desk's own line) is StatusLine's, which puts the code into words itself.
        for (const m of text.matchAll(/Status: ([a-z0-9-]+)\./g)) seen.get("card-status")!.add(m[1]);
        for (const n of view.notices) seen.get("notice")!.add(n.kind);
        for (const j of [...(view.desk?.jobs ?? []), ...(view.manager?.jobs ?? [])]) seen.get("status")!.add(j.status);
        const leads = [
          ...(view.desk?.open?.leads ?? []),
          ...(view.desk?.open?.ruledOut ?? []),
          ...(view.manager?.open?.open.leads ?? []),
          ...(view.manager?.open?.open.ruledOut ?? []),
          ...(view.hq?.buildingB?.leads ?? []),
        ];
        for (const l of leads) seen.get("tier")!.add(l.tier);
      }
    };

    const press = async (seat: string, action: string, jobId?: string, payload?: Record<string, unknown>) => {
      const r = await actionTurn({ seat, action, jobId, payload }, "off", deps, REAL_NOW);
      expect(r.ok, `${seat} ${action}: ${r.message}`).toBe(true);
      look();
      return r;
    };

    // Every chip on every seat (Show job, Why?, Dial?, What needs me, Versions, Impact), D1 review:
    // their answers are cards on screen too.
    const allChips = async () => {
      for (const seat of SEAT_IDS) {
        for (const chip of CHIPS_BY_SEAT[seat].filter((c) => c !== "Safety")) {
          const typed = await chatTurn({ seat, text: chip, job: seat === "aom-tower-a" ? undefined : "2318" }, "off", deps, REAL_NOW);
          expect(typed.status, `${seat} ${chip}`).toBe(200);
          seen.get("chip")!.add(chip);
        }
      }
      look();
    };

    await press("hq", "reset");
    const report = await press("tenant", "report", undefined, { complaint: "too cold" });
    for (const [q, a] of [
      ["Q0", "No"],
      ["Q1", "Open area near the lift core"],
      ["Q2", "It keeps coming back"],
      ["Q3", "Yes"],
      ["Q4-thermostat", "Not sure"],
    ]) {
      await press("tenant", "answer", report.jobId, { questionId: q, answer: a });
    }
    await press("technician", "open-job", "2318");
    await allChips();
    await press("technician", "tick", "2318", { causeId: "precool", type: "not-this" });
    await press("technician", "tick", "2318", { causeId: "min-airflow", type: "not-this" });
    await press("technician", "not-solved", "2318", { hoursLost: 3, extraVisits: 2, contractorOrPartsNeeded: false });
    await press("senior-manager", "tick", "2318", { causeId: "thermostat-spot", type: "found" });
    await press("senior-manager", "log-new-solution", "2318", { fixLine: FIX, whyLine: WHY });
    for (const [part, value] of [
      ["rule-text", FIX],
      ["fact", "fit-out-12m"],
      ["effect-1", "block:25"],
      ["effect-2", "put-first:21"],
    ]) {
      await press("senior-manager", "confirm-part", "2318", { part, value });
    }
    await press("senior-manager", "run-tests", "2318");
    await press("senior-manager", "send-to-hq", "2318");
    await press("hq", "approve-solution", "2318");
    const aom = seatView(memory.read(), "aom-tower-a", "off", REAL_NOW).aom!;
    await press("aom-tower-a", "decide-charge", "2318", {
      requestId: aom.charges[0].id,
      choice: "tenant-pays",
      amount: 350,
      reason: "Fit-out work is the tenant's own",
    });
    for (const text of ["What needs me", "Why?", "water dripping near the lights", "safety"]) {
      const typed = await chatTurn({ seat: "tenant", text, job: "2318" }, "off", deps, REAL_NOW);
      expect(typed.status).toBe(200);
      look();
    }
    await press("tenant", "safety-pick", "2318", { stopId: "RS-04" });
    await allChips();

    // The demo really put these on screen, so the check is not empty.
    expect(seen.get("code")).toEqual(expect.any(Set));
    for (const code of ["TS-CC-09", "TS-CC-18", "TS-CC-27", "RS-04", "RS-08", "A2", "A4"]) {
      expect(seen.get("code")!.has(code), code).toBe(true);
    }
    // Each code's words are its own: a signed rule never falls back to the new-rule words,
    // a new rule always does, and an approval is never left as its bare id.
    for (const code of seen.get("code")!) {
      const word = codeWord(code);
      expect(word, code).not.toBeNull();
      expect(word, code).not.toBe(code);
      if (/^TS-CC-\d{2}$/.test(code)) {
        const signed = v10.rules.some((r) => r.id === code);
        expect(word === NEW_RULE_WORD, `${code}: ${word}`).toBe(!signed);
      }
    }
    // A job status inside a card's sentence (Show job's "Status: in-progress.") reads in plain words.
    expect(seen.get("chip")!.has("Show job")).toBe(true);
    expect(seen.get("card-status")!.size).toBeGreaterThanOrEqual(2);
    for (const s of seen.get("card-status")!) {
      expect(STATUS_WORDS[s as keyof typeof STATUS_WORDS], s).toBeDefined();
      expect(plainSentence(`Status: ${s}.`), s).toBe(`Status: ${STATUS_WORDS[s as keyof typeof STATUS_WORDS]} ${s}.`);
    }
    for (const tier of seen.get("tier")!) expect(TIER_WORDS[tier as keyof typeof TIER_WORDS], tier).toBeDefined();
    for (const s of seen.get("status")!) expect(STATUS_WORDS[s as keyof typeof STATUS_WORDS], s).toBeDefined();
    for (const k of seen.get("notice")!) expect(NOTICE_WORDS[k as keyof typeof NOTICE_WORDS], k).toBeDefined();
    expect(seen.get("tier")!.size).toBeGreaterThanOrEqual(3);
    expect(seen.get("notice")!.size).toBeGreaterThanOrEqual(5);
  }, 60_000);
});
