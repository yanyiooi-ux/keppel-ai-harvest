/**
 * Review findings for C10a, in code: what /how tells a judge must be what the
 * code does.
 *
 * - The brief's question 3 said "Every closed job becomes a case". A
 *   self-check that closes with a tip (blinds up) closes the job and saves no
 *   case; only a solved job (Solved, or HQ's Approve) is saved as a case (S2).
 * - The "Show why" ranking step said any lead under 3 similar cases makes the
 *   senior manager be told. S9 tells them only when the first live lead is low
 *   confidence, or no live lead is left.
 * - The senior manager's demo step listed the parts to confirm but never said
 *   to change a suggested pick that differs, so Confirm on what the AI put in
 *   the boxes gave a different draft from the demo rule.
 *
 * Fake AI client only; nothing here reaches the network.
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as memory from "../lib/memory";
import { resetDemo, runAction } from "../lib/actions";
import { actionTurn } from "../lib/action-turn";
import { leadsForJob } from "../lib/leads";
import { seatView } from "../lib/seat-view";
import { howView } from "../lib/how";
import { PART_TITLES, partDisplay } from "../lib/senior-manager-flow";
import type { ModelClient } from "../lib/ai";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");

const DEMO_FIX =
  "If the zone had a fit-out in the last 12 months, check where the thermostat sits against the fit-out drawing before any nudge.";
const DEMO_WHY =
  "The fit-out 8 months ago moved the core thermostat next to the new printer bay, so it reads warm and the box keeps cooling the open area.";

beforeEach(() => {
  resetDemo(REAL_NOW);
});

function press(seat: string, action: string, jobId?: string, payload?: Record<string, unknown>) {
  const r = runAction({ seat, action, jobId, payload }, REAL_NOW);
  expect(r.ok, `${action}: ${r.message}`).toBe(true);
  return r;
}

function selfCheck(complaint: string, answers: [string, string][]): string {
  const report = press("tenant", "report", undefined, { complaint });
  for (const [questionId, answer] of answers) press("tenant", "answer", report.jobId, { questionId, answer });
  return report.jobId!;
}

/** The demo up to the senior manager's Found it: the tenant's self-check on 2318, two Not this, Not solved. */
function toFoundIt() {
  selfCheck("too cold", [
    ["Q0", "No"],
    ["Q1", "Open area near the lift core"],
    ["Q2", "It keeps coming back"],
    ["Q3", "Yes"],
    ["Q4-thermostat", "Not sure"],
  ]);
  press("technician", "open-job", "2318");
  press("technician", "tick", "2318", { causeId: "precool", type: "not-this" });
  press("technician", "tick", "2318", { causeId: "min-airflow", type: "not-this" });
  press("technician", "not-solved", "2318", { hoursLost: 3, extraVisits: 2, contractorOrPartsNeeded: false });
  press("senior-manager", "tick", "2318", { causeId: "thermostat-spot", type: "found" });
}

describe("C10a review: the brief's question 3 says only what the code saves as a case", () => {
  it("a self-check closed with the blinds tip closes the job and saves no case, so the answer speaks of solved jobs", () => {
    const before = memory.read().runtimeCases.length;
    const jobId = selfCheck("too hot", [
      ["Q0", "No"],
      ["Q1", "West glass boardroom"],
      ["Q2", "Today"],
      ["Q3", "No"],
      ["Q4-blinds", "No, they are up"],
    ]);
    const state = memory.read();
    expect(memory.jobById(state, jobId)!.status).toBe("pending-30-day");
    expect(state.runtimeCases).toHaveLength(before);

    const answer = howView(state).questions[2].answer;
    expect(answer).not.toMatch(/every closed job/i);
    expect(answer).toMatch(/^Every solved job is saved as a case that ranks the next job/);
  });

  it("a solved job is saved as a case: HQ's Approve saves 2318's", async () => {
    toFoundIt();
    await actionTurn(
      { seat: "senior-manager", action: "log-new-solution", jobId: "2318", payload: { fixLine: DEMO_FIX, whyLine: DEMO_WHY } },
      "off",
      undefined,
      REAL_NOW
    );
    for (const [part, value] of [
      ["rule-text", DEMO_FIX],
      ["fact", "fit-out-12m"],
      ["effect-1", "block:25"],
      ["effect-2", "put-first:21"],
    ]) {
      press("senior-manager", "confirm-part", "2318", { part, value });
    }
    press("senior-manager", "run-tests", "2318");
    press("senior-manager", "send-to-hq", "2318");
    const before = memory.read().runtimeCases.length;
    press("hq", "approve-solution", "2318");
    const after = memory.read().runtimeCases;
    expect(after).toHaveLength(before + 1);
    expect(after[after.length - 1].jobId).toBe("2318");
  });
});

describe("C10a review: the Show why step says when the senior manager is told, as S9", () => {
  it("a low-confidence lead in third place tells nobody; only a low-confidence first lead does", () => {
    const seed = memory.read();
    const ranked = leadsForJob(seed, memory.jobById(seed, "2318")!, "technician", REAL_NOW);
    expect(ranked.leads.map((l) => l.causeId)).toEqual(["precool", "min-airflow", "thermostat-spot"]);
    expect(ranked.leads[2].tier).toBe("low-confidence");
    expect(ranked.alertSeniorManager).toBe(false);

    press("technician", "open-job", "2318");
    press("technician", "tick", "2318", { causeId: "precool", type: "not-this" });
    press("technician", "tick", "2318", { causeId: "min-airflow", type: "not-this" });
    const ticked = memory.read();
    const after = leadsForJob(ticked, memory.jobById(ticked, "2318")!, "technician", REAL_NOW);
    expect(after.leads[0].causeId).toBe("thermostat-spot");
    expect(after.leads[0].tier).toBe("low-confidence");
    expect(after.alertSeniorManager).toBe(true);

    const step = howView(ticked).rankSteps.find((s) => s.name === "Show why")!;
    expect(step.text).not.toMatch(/Under 3 similar cases it says "low confidence, expert rule" and the senior manager is told/);
    expect(step.text).toContain('Under 3 similar cases it says "low confidence, expert rule"');
    expect(step.text).toContain("when the top lead is low confidence, or no lead is left, the senior manager is told");
  });
});

describe("C10a review: the senior manager's demo step says to change a suggested pick that differs", () => {
  /** The AI's suggestion the saved answer holds: the fact, and put step 21 first as the only effect. */
  const SUGGESTION = JSON.stringify({ ruleText: DEMO_FIX, fact: "fit-out-12m", effects: [{ effect: "put-first", step: 21 }] });
  const fake: ModelClient = {
    async complete() {
      return { content: SUGGESTION, finish: "stop" };
    },
  };

  it("when the AI fills Effect 1 with put step 21 first, the boxes differ from the step's picks, and the step says to change them", async () => {
    toFoundIt();
    const logged = await actionTurn(
      { seat: "senior-manager", action: "log-new-solution", jobId: "2318", payload: { fixLine: DEMO_FIX, whyLine: DEMO_WHY } },
      "live",
      { client: fake, keyPresent: true },
      REAL_NOW
    );
    expect(logged.ok, logged.message).toBe(true);
    const parts = seatView(memory.read(), "senior-manager", "live", REAL_NOW).manager!.open!.solution!.parts;
    const shown = Object.fromEntries(parts.map((p) => [p.id, p.shown]));
    expect(shown["effect-1"]).toBe("put-first:21");
    expect(shown["effect-2"]).toBe("none");

    const step = howView(memory.read()).demoSteps.find((s) => s.seat === "senior-manager")!;
    const picks = [
      ["fact", "fit-out-12m"],
      ["effect-1", "block:25"],
      ["effect-2", "put-first:21"],
    ] as const;
    // The step's own picks differ from what the AI put in two of the boxes.
    expect(picks.filter(([part, value]) => shown[part] !== value).map(([part]) => part)).toEqual(["effect-1", "effect-2"]);
    for (const [part, value] of picks) expect(step.text).toContain(`${PART_TITLES[part]} (${partDisplay(part, value)})`);
    expect(step.text).toContain("change the AI's suggestion where it differs");
    expect(step.text).toContain("then Confirm");
  });
});
