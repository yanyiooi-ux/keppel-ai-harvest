/**
 * D2: Story mode's script, run through the real route code.
 *
 * The 8 steps press what web/tests/demo-flow.test.ts presses, in its order and
 * with its payloads, through the same functions POST /api/reset, /api/action
 * and /api/chat run (resetDemo, actionTurn, chatTurn), and read what
 * GET /api/state reads (seatView). After each step the engine's state is
 * checked, and every number and claim in that step's caption is checked
 * against it: if they ever differ, the caption is wrong, never the engine.
 *
 * On Saved answers (Replay), network blocked: tests/setup.ts keeps the key
 * empty and makes any fetch throw. As in demo-flow, nothing here reads
 * web/data/replay/: the one saved answer this run needs (the AI's suggestion
 * for the demo's own words) is written into the test's own temp folder. The
 * model client counts its calls and must never be called.
 */

import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import * as memory from "../lib/memory";
import { resetDemo, openStopsOnJob } from "../lib/actions";
import { actionTurn } from "../lib/action-turn";
import { chatTurn } from "../lib/chat-turn";
import { seatView } from "../lib/seat-view";
import { leadsForJob } from "../lib/leads";
import { loadPill, loadAndCheckPill } from "../lib/pill";
import { currentSolution } from "../lib/senior-manager-flow";
import { loadCauses } from "../lib/causes";
import { SELF_CHECK_QUESTIONS } from "../lib/self-check";
import { CLOSE_LINE, whyStory, loadHowSources } from "../lib/how";
import { DEMO_FIX_LINE, DEMO_WHY_LINE } from "../lib/demo-words";
import { effectWord } from "../lib/plain-words";
import { newSolutionSpec, saveReplay, REPLAY_BANNER, type AiDeps, type ModelClient } from "../lib/ai";
import {
  STORY,
  STORY_CLOSE,
  STORY_LINK_MINUTES,
  STORY_PRESS_PACE_MS,
  storyHoldMs,
  storyStepFromQuery,
  runPress,
  runStep,
  type StoryPort,
  type StoryMemo,
  type PressResult,
} from "../lib/story";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");
const v10 = loadPill("ts-cc", "1.0");

// ---- demo-flow's presses, copied word for word from web/tests/demo-flow.test.ts ----

const COLD_CORE_KEEPS: [string, string][] = [
  ["Q0", "No"],
  ["Q1", "Open area near the lift core"],
  ["Q2", "It keeps coming back"],
  ["Q3", "Yes"],
  ["Q4-thermostat", "Not sure"],
];
const IMPACT = { hoursLost: 3, extraVisits: 2, contractorOrPartsNeeded: false };
const DEMO_FIX =
  "If the zone had a fit-out in the last 12 months, check where the thermostat sits against the fit-out drawing before any nudge.";
const DEMO_WHY =
  "The fit-out 8 months ago moved the core thermostat next to the new printer bay, so it reads warm and the box keeps cooling the open area.";
const DEMO_PARTS: [string, string][] = [
  ["rule-text", DEMO_FIX],
  ["fact", "fit-out-12m"],
  ["effect-1", "block:25"],
  ["effect-2", "put-first:21"],
];
const REASON = "Fit-out work is the tenant's own";
const SUGGESTION = JSON.stringify({ ruleText: DEMO_FIX, fact: "fit-out-12m", effects: [{ effect: "put-first", step: 21 }] });

/** Every call demo-flow makes after its Reset, in its order, as the routes receive them. */
const DEMO_FLOW_CALLS: unknown[] = [
  ["reset"],
  ["action", "tenant", "report", undefined, { complaint: "too cold" }],
  ...COLD_CORE_KEEPS.map(([questionId, answer]) => ["action", "tenant", "answer", "2319", { questionId, answer }]),
  ["action", "technician", "open-job", "2318", undefined],
  ["action", "technician", "tick", "2318", { causeId: "precool", type: "not-this" }],
  ["action", "technician", "tick", "2318", { causeId: "min-airflow", type: "not-this" }],
  ["action", "technician", "not-solved", "2318", IMPACT],
  ["action", "senior-manager", "tick", "2318", { causeId: "thermostat-spot", type: "found" }],
  ["action", "senior-manager", "log-new-solution", "2318", { fixLine: DEMO_FIX, whyLine: DEMO_WHY }],
  ...DEMO_PARTS.map(([part, value]) => ["action", "senior-manager", "confirm-part", "2318", { part, value }]),
  ["action", "senior-manager", "run-tests", "2318", undefined],
  ["action", "senior-manager", "send-to-hq", "2318", undefined],
  ["action", "hq", "approve-solution", "2318", undefined],
  ["action", "aom-tower-a", "decide-charge", "2318", { requestId: "A4-1", choice: "tenant-pays", amount: 350, reason: REASON }],
  ["chat", "tenant", "water dripping near the lights", "2318"],
  ["action", "tenant", "safety-pick", "2318", { stopId: "RS-04" }],
];

const ownDirs: string[] = [];
afterAll(() => {
  for (const dir of ownDirs) rmSync(dir, { recursive: true, force: true });
});

/**
 * The route code as a story port: the same functions the routes call, with
 * the demo clock. Every call is recorded as the route would receive it.
 */
function enginePort(deps: AiDeps, replayDir: string, calls: unknown[]): StoryPort {
  return {
    async reset() {
      calls.push(["reset"]);
      const r = resetDemo(REAL_NOW);
      return { ok: r.ok, message: r.message };
    },
    async action({ seat, action, job, payload }) {
      calls.push(["action", seat, action, job, payload]);
      if (action === "log-new-solution" && job) {
        // As demo-flow does: the AI's suggestion for exactly these lines is a saved answer in this run's own folder.
        const key = newSolutionSpec(v10, DEMO_FIX, DEMO_WHY, {
          seat: "senior-manager",
          version: "1.0",
          job: memory.jobById(memory.read(), job)!,
        }).key;
        saveReplay(key, { text: SUGGESTION, pass: true }, replayDir);
      }
      const r = await actionTurn({ seat, action, jobId: job, payload }, "replay", deps, REAL_NOW);
      return { ok: r.ok, message: r.message, jobId: r.jobId };
    },
    async chat({ seat, text, job }) {
      calls.push(["chat", seat, text, job]);
      const out = await chatTurn({ seat, text, job }, "replay", deps, REAL_NOW);
      if (out.status !== 200) return { ok: false, message: out.body.message };
      return { ok: true, message: "", cards: out.body.cards };
    },
    async view(seat) {
      return seatView(memory.read(), seat, "replay", REAL_NOW);
    },
  };
}

function freshPort() {
  let modelCalls = 0;
  const counting: ModelClient = {
    async complete() {
      modelCalls += 1;
      return { content: SUGGESTION, finish: "stop" };
    },
  };
  const replayDir = mkdtempSync(join(tmpdir(), "pill-desk-story-"));
  ownDirs.push(replayDir);
  const calls: unknown[] = [];
  const port = enginePort({ client: counting, replayDir }, replayDir, calls);
  return { port, calls, modelCalls: () => modelCalls };
}

function leadIds(jobId: string): string[] {
  const state = memory.read();
  return leadsForJob(state, memory.jobById(state, jobId)!, "technician", REAL_NOW).leads.map((l) => l.causeId);
}

function numbersIn(text: string): string[] {
  return text.match(/\d+(?:\.\d+)?/g) ?? [];
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z"“])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function words(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

const causeLabel = (id: string) => loadCauses().causes.find((c) => c.id === id)!.label;

describe("D2: the story script", () => {
  it("has 8 steps, one seat each, in the demo's order", () => {
    expect(STORY).toHaveLength(8);
    expect(STORY.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(STORY.map((s) => s.seat)).toEqual([
      "tenant",
      "technician",
      "technician",
      "technician",
      "senior-manager",
      "hq",
      "aom-tower-a",
      "tenant",
    ]);
    // Every press in a step is made from the seat that step shows, so the screen is always the one acting.
    for (const step of STORY) {
      for (const press of step.presses) {
        if (press.kind !== "reset") expect(press.seat, `step ${step.n}: ${press.label}`).toBe(step.seat);
      }
    }
  });

  it("types the demo's own words, so the saved real AI draft shows", () => {
    const log = STORY.flatMap((s) => s.presses).find((p) => p.kind === "action" && p.action === "log-new-solution");
    expect(log && log.kind === "action" ? log.payload : null).toEqual({ fixLine: DEMO_FIX_LINE, whyLine: DEMO_WHY_LINE });
    expect(DEMO_FIX_LINE).toBe(DEMO_FIX);
    expect(DEMO_WHY_LINE).toBe(DEMO_WHY);
  });

  it("names each press the way the screen does", () => {
    const labels = STORY.flatMap((s) => s.presses.map((p) => p.label));
    expect(labels.some((l) => l.includes(`"${causeLabel("precool")}"`))).toBe(true);
    expect(labels.some((l) => l.includes(`"${causeLabel("min-airflow")}"`))).toBe(true);
    expect(labels.some((l) => l.includes(`"${causeLabel("thermostat-spot")}"`))).toBe(true);
    expect(labels.some((l) => l.includes(effectWord("block:25")))).toBe(true);
    expect(labels.some((l) => l.includes(effectWord("put-first:21")))).toBe(true);
    for (const label of labels) {
      expect(label.length, label).toBeGreaterThan(3);
      expect(label, label).not.toMatch(/\b(HQ|AOM|VAV|TS-CC|RS-\d)/);
    }
  });

  it("writes every caption in short, plain sentences", () => {
    for (const step of STORY) {
      for (const sentence of sentences(step.caption)) {
        expect(words(sentence), `step ${step.n}: ${sentence}`).toBeLessThanOrEqual(20);
      }
      // No short form a judge would have to look up.
      expect(step.caption, `step ${step.n}`).not.toMatch(/\b(HQ|AOM|VAV|FCU|FM|BMS|LEW|A[1-4]|TS-CC|RS-\d\d|pill)\b/);
      expect(step.title.length).toBeGreaterThan(3);
      expect(words(step.title)).toBeLessThanOrEqual(7);
    }
    expect(STORY_CLOSE).toBe(CLOSE_LINE);
  });

  it("holds each step 6 to 9 seconds, longer for a longer caption", () => {
    for (const step of STORY) {
      const hold = storyHoldMs(step.caption);
      expect(hold).toBeGreaterThanOrEqual(6000);
      expect(hold).toBeLessThanOrEqual(9000);
    }
    expect(storyHoldMs("One two three.")).toBe(6000);
    expect(storyHoldMs(Array(80).fill("word").join(" "))).toBe(9000);
    const short = Array(26).fill("w").join(" ");
    const long = Array(32).fill("w").join(" ");
    expect(storyHoldMs(long)).toBeGreaterThan(storyHoldMs(short));
  });

  it("says how long the story takes, and the whole run fits in it", () => {
    const presses = STORY.reduce((sum, s) => sum + s.presses.length, 0);
    // Each press shows "Pip is checking" at least 400 ms, then the pace before the next.
    const estimate = STORY.reduce((sum, s) => sum + storyHoldMs(s.caption), 0) + presses * (400 + STORY_PRESS_PACE_MS);
    expect(estimate).toBeLessThanOrEqual(STORY_LINK_MINUTES * 60000);
    expect(estimate).toBeGreaterThan((STORY_LINK_MINUTES - 1) * 60000);
  });

  it("reads ?step= as a step from 1 to 8, and nothing else", () => {
    expect(storyStepFromQuery("1")).toBe(1);
    expect(storyStepFromQuery("8")).toBe(8);
    expect(storyStepFromQuery(["3"])).toBe(3);
    for (const bad of [undefined, "", "0", "9", "2.5", "x", "-1", " 3"]) expect(storyStepFromQuery(bad)).toBeUndefined();
  });
});

describe("D2: the story runs the real app, step by step, and every caption is true", () => {
  it("presses demo-flow's presses in its order, and each step's state and caption check out", async () => {
    expect(process.env.LLM_API_KEY).toBe("");
    expect(process.env.REPLAY_MODE).toBe("1");
    expect(() => (globalThis.fetch as unknown as () => unknown)()).toThrow("network blocked in tests");

    const { port, calls, modelCalls } = freshPort();
    const memo: StoryMemo = {};
    const pill = loadAndCheckPill("ts-cc", "1.0");
    let aiBefore = 0;

    for (const step of STORY) {
      if (step.n === 8) aiBefore = memory.read().aiCalls ?? 0;
      const run = await runStep(step, port, memo);
      expect(run, `step ${step.n}: ${run.message}`).toMatchObject({ ok: true });
      const state = memory.read();
      const job = memory.jobById(state, "2318")!;
      const nums = numbersIn(step.caption);

      switch (step.n) {
        case 1: {
          // "A tenant on Level 23 says it is too cold. Before anyone visits, Pip asks 5 quick questions, safety first. Then a visit is booked."
          expect(nums).toEqual(["23", "5"]);
          expect(job.floor).toBe(23);
          expect(job.complaint).toBe("too cold");
          const questions = seatView(state, "tenant", "replay", REAL_NOW).messages.flatMap((m) =>
            (m.cards ?? []).filter((c) => c.kind === "question")
          );
          expect(questions).toHaveLength(5);
          expect(Object.keys(job.selfCheckAnswers ?? {})).toHaveLength(5);
          // The first is the safety question, from the self-check's own list.
          expect(questions[0].title).toBe(SELF_CHECK_QUESTIONS.find((q) => q.id === "Q0")!.text);
          expect(questions[0].questionId).toBe("Q0");
          expect(questions[0].title).toMatch(/burning smell, smoke, water dripping/);
          expect(job.status).toBe("visit-booked");
          break;
        }
        case 2: {
          // "... this spot called 5 times in 21 days. The 4 earlier fixes were all a turn of the dial, and every one came back."
          expect(nums).toEqual(["5", "21", "4"]);
          expect(job.status).toBe("in-progress");
          const story = whyStory(loadHowSources().tickets, loadHowSources().buildings, loadHowSources().trends)!;
          expect(story.calls).toHaveLength(5);
          expect(story.days).toBe(21);
          expect(story.dialTurns).toBe(4);
          const closed = story.calls.filter((c) => c.status !== "open");
          expect(closed).toHaveLength(4);
          expect(closed.every((c) => c.dialTurn && c.status === "came-back")).toBe(true);
          // What the technician's screen shows: the calls card and the past fixes, all failed.
          const open = seatView(state, "technician", "replay", REAL_NOW).desk!.open!;
          expect(open.checklist.find((c) => c.id === "calls")!.lines).toHaveLength(5);
          const past = open.checklist.find((c) => c.id === "past-fixes")!.lines!;
          expect(past).toHaveLength(4);
          expect(past.every((l) => l.word === "Failed" && /setpoint/.test(l.text))).toBe(true);
          // "best bet first": the list before any tick.
          expect(leadIds("2318")).toEqual(["precool", "min-airflow", "thermostat-spot"]);
          break;
        }
        case 3: {
          // "The technician rules out two, and the list re-ranks at once. The thermostat spot is now on top, but few past cases back it, so Pip tells the senior manager."
          expect(nums).toEqual([]);
          expect(step.caption).toContain("rules out two");
          const ranked = leadsForJob(state, job, "technician", REAL_NOW);
          expect(ranked.leads.map((l) => l.causeId)).toEqual(["thermostat-spot"]);
          expect(ranked.leads[0].tier).toBe("low-confidence");
          const open = seatView(state, "technician", "replay", REAL_NOW).desk!.open!;
          expect(open.ruledOut.map((l) => l.causeId).sort()).toEqual(["min-airflow", "precool"]);
          expect(state.notices.filter((n) => n.seat === "senior-manager" && n.kind === "low-confidence")).toHaveLength(1);
          break;
        }
        case 4: {
          // "The technician notes the time lost: 3 hours and 2 extra visits. Pip sends the job up to the senior manager with everything attached ..."
          expect(nums).toEqual(["3", "2"]);
          expect(job.status).toBe("escalated");
          const up = state.notices.filter((n) => n.seat === "senior-manager" && n.kind === "escalated");
          expect(up).toHaveLength(1);
          expect(up[0].text).toContain(`${IMPACT.hoursLost} hours lost, ${IMPACT.extraVisits} extra visits`);
          // Everything attached: the self-check answers and the ticks travel with it.
          expect(up[0].text).toContain("Self-check:");
          expect(up[0].text).toContain("Checked:");
          break;
        }
        case 5: {
          // "The senior manager finds the real cause: since the renovation, the thermostat sits in the wrong spot. The AI drafts the new rule from a saved real answer. ... All 23 tests pass, so it goes to head office."
          expect(nums).toEqual(["23"]);
          expect(causeLabel("thermostat-spot")).toMatch(/wrong spot after a fit-out/);
          const sm = seatView(state, "senior-manager", "replay", REAL_NOW).manager!;
          const solution = currentSolution(state, "2318")!;
          expect(solution.status).toBe("sent-to-hq");
          expect(solution.parts.every((p) => p.confirmed)).toBe(true);
          expect(solution.testRun).toMatchObject({ passed: 23, failed: 0, ok: true });
          expect(sm.open!.solution!.aiBanner).toBe(REPLAY_BANNER);
          expect(sm.open!.open.leads[0]).toMatchObject({ causeId: "thermostat-spot", tier: "found" });
          // Nothing is live before head office approves.
          expect(state.liveVersionByBuilding).toEqual({ "tower-a": "1.0", "building-b": "1.0" });
          break;
        }
        case 6: {
          // "Head office approves it once. Every building now runs version 1.1 at the same time. Building B now checks the thermostat first."
          expect(nums).toEqual(["1.1"]);
          expect(Object.values(state.liveVersionByBuilding)).toEqual(["1.1", "1.1"]);
          expect(leadIds("2401")[0]).toBe("thermostat-spot");
          const b = seatView(state, "hq", "replay", REAL_NOW).hq!.buildingB!;
          expect(b.version).toBe("1.1");
          expect(b.leads[0].causeId).toBe("thermostat-spot");
          expect(job.status).toBe("pending-30-day");
          break;
        }
        case 7: {
          // "The building manager sees what the repeat calls have cost: S$600 so far. Moving the thermostat is work on the tenant's renovation, so the manager decides the tenant pays a made-up S$350."
          expect(nums).toEqual(["600", "350"]);
          const aom = seatView(state, "aom-tower-a", "replay", REAL_NOW).aom!;
          expect(aom.meter!.before).toMatchObject({ cost: 600, costLine: "S$600 and counting", repeatCalls: 4 });
          expect(aom.charges).toHaveLength(1);
          expect(aom.charges[0].text).toMatch(/move the wall thermostat/);
          expect(aom.charges[0].text).toContain("work on the tenant's fit-out");
          expect(aom.charges[0].decision).toMatchObject({ choiceLabel: "Tenant pays", costLine: "S$350, made-up demo amount" });
          const tenantLast = seatView(state, "tenant", "replay", REAL_NOW).messages.at(-1)!;
          expect(tenantLast.text).toContain("Cost: S$350, made-up demo amount.");
          break;
        }
        case 8: {
          // "Typing "water dripping near the lights" brings up the stop in the building's own approved words. No AI is used. One press raises the stop and locks work on that floor."
          expect(nums).toEqual([]);
          const live = loadAndCheckPill("ts-cc", "1.1");
          const rs04 = live.red_stops.find((s) => s.id === "RS-04")!;
          expect(rs04).toEqual(pill.red_stops.find((s) => s.id === "RS-04"));
          const red = seatView(state, "tenant", "replay", REAL_NOW)
            .messages.flatMap((m) => m.cards ?? [])
            .filter((c) => c.kind === "red-stop");
          expect(red.length).toBeGreaterThanOrEqual(1);
          expect(red[0]).toMatchObject({ title: rs04.trigger, body: rs04.action, call: rs04.who_to_call });
          expect(red[0].receipt).toContain("AI calls: 0");
          expect(red[0].aiJob).toBeUndefined();
          expect(memory.read().aiCalls ?? 0).toBe(aiBefore);
          expect(state.openRedStops).toHaveLength(1);
          expect(state.openRedStops[0]).toMatchObject({ stopId: "RS-04", building: "tower-a", floor: 23 });
          expect(openStopsOnJob(state, job)).toHaveLength(1);
          expect(openStopsOnJob(state, memory.jobById(state, "2401")!)).toEqual([]);
          break;
        }
      }
    }

    // The very presses demo-flow makes, in its order, as the routes received them.
    expect(calls).toEqual(DEMO_FLOW_CALLS);
    expect(modelCalls()).toBe(0);
    expect(memory.read().aiCalls ?? 0).toBe(0);
  }, 60000);

  it("never fakes a success: a press out of order comes back refused, with the app's own reason", async () => {
    const { port } = freshPort();
    resetDemo(REAL_NOW);
    // Head office's Approve before anything was sent to it.
    const approve = STORY.find((s) => s.n === 6)!;
    const run = await runStep(approve, port, {});
    expect(run.ok).toBe(false);
    expect(run.failedAt).toBe(0);
    expect(run.message.length).toBeGreaterThan(10);
    expect(memory.read().liveVersionByBuilding).toEqual({ "tower-a": "1.0", "building-b": "1.0" });
  });

  it("stops when the app gives it nothing to press: no charge request, or no stop to raise", async () => {
    const { port } = freshPort();
    resetDemo(REAL_NOW);
    const charge = STORY.find((s) => s.n === 7)!.presses[0];
    const noCharge: PressResult = await runPress(charge, port, {});
    expect(noCharge.ok).toBe(false);
    expect(noCharge.message).toMatch(/no charge request/i);

    const raise = STORY.find((s) => s.n === 8)!.presses[1];
    const noStop = await runPress(raise, port, {});
    expect(noStop.ok).toBe(false);
    expect(noStop.message).toMatch(/no safety stop/i);
    expect(memory.read().openRedStops).toEqual([]);
  });

  it("a press that never got through says so in plain words", async () => {
    const broken: StoryPort = {
      reset: async () => {
        throw new Error("socket hang up");
      },
      action: async () => {
        throw new Error("socket hang up");
      },
      chat: async () => {
        throw new Error("socket hang up");
      },
      view: async () => {
        throw new Error("socket hang up");
      },
    };
    const r = await runPress(STORY[0].presses[0], broken, {});
    expect(r).toEqual({ ok: false, message: "That did not go through. Check the connection, then try again." });
  });
});
