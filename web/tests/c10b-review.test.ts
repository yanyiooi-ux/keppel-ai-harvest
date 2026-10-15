/**
 * C10b review fixes (two reviewers, checked on disk before any change).
 *
 * - T-C10b's "AI off gives the same cards" must bite on the AI. demo-flow's
 *   Replay run had only the new-solution answer in its own folder, so the
 *   tenant reply and every rank wording fell back to the code's words, and its
 *   snapshot held no desk. Here the test's own temp replay folder holds a
 *   passing saved answer for every demo AI job: the same targets npm run
 *   ai:record records (lib/ai-demo-targets.ts), built from the same code text,
 *   so each lands on the key the app asks for. They are written by the real
 *   record path with a fake client (run rule 6: a test writes its saved answers
 *   into its own temp folder; nothing here reads web/data/replay/). The Replay
 *   run must then really show the AI line and the banner on the tenant reply,
 *   the technician's leads, the senior manager's ranked list, the new solution
 *   and the Building B card, and every seat's whole view (chat cards and desk)
 *   must equal the Off run once the AI layer's own fields are set apart.
 * - Live with a key but an empty LLM_BASE_URL must never call the model: the
 *   OpenAI SDK would send the key to its own default host, not to TokenHub.
 *
 * No Hunyuan call anywhere: tests/setup.ts keeps the key empty and makes any
 * fetch throw, and the demo's model client counts its calls (0).
 */

import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import * as memory from "../lib/memory";
import { resetDemo } from "../lib/actions";
import { actionTurn } from "../lib/action-turn";
import { chatTurn } from "../lib/chat-turn";
import { seatView, type SeatView, type SeatCard } from "../lib/seat-view";
import type { DeskLead } from "../lib/technician-desk";
import { loadPill } from "../lib/pill";
import { VISIT_BOOKED_LINE } from "../lib/self-check";
import { SEAT_IDS } from "../lib/permissions";
import { demoRecordTargets, recordMissing } from "../lib/ai-demo-targets";
import {
  tenantReply,
  _resetClient,
  REPLAY_BANNER,
  AI_OFF_LABEL,
  type AiDeps,
  type AiMessage,
  type AiMode,
  type ModelClient,
} from "../lib/ai";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");
const v10 = loadPill("ts-cc", "1.0");

/** The demo solution (S16 item 2), from the role-played senior manager. */
const DEMO_FIX =
  "If the zone had a fit-out in the last 12 months, check where the thermostat sits against the fit-out drawing before any nudge.";
const DEMO_WHY =
  "The fit-out 8 months ago moved the core thermostat next to the new printer bay, so it reads warm and the box keeps cooling the open area.";

/** The saved answers this test writes into its own temp folder. Each passes its job's checks (the record path says so). */
const RANK_LINE = "This lead fits what the code found on this job.";
const TENANT_LINE = "Thank you for telling us. A technician visit is booked.";
const SUGGESTION = JSON.stringify({ ruleText: DEMO_FIX, fact: "fit-out-12m", effects: [{ effect: "put-first", step: 21 }] });

/** The demo rule (S16): the senior manager's picks, each confirmed with its own button. */
const DEMO_PARTS: [string, string][] = [
  ["rule-text", DEMO_FIX],
  ["fact", "fit-out-12m"],
  ["effect-1", "block:25"],
  ["effect-2", "put-first:21"],
];

const COLD_CORE_KEEPS: [string, string][] = [
  ["Q0", "No"],
  ["Q1", "Open area near the lift core"],
  ["Q2", "It keeps coming back"],
  ["Q3", "Yes"],
  ["Q4-thermostat", "Not sure"],
];

/** The field names only the AI layer sets, on a chat card, a lead, a solution or the Building B card. */
const AI_ONLY = ["aiWording", "aiBanner", "aiNotice", "aiOff"];

const ownDirs: string[] = [];
afterAll(() => {
  for (const dir of ownDirs) rmSync(dir, { recursive: true, force: true });
});

function ownDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "pill-desk-c10b-review-"));
  ownDirs.push(dir);
  return dir;
}

/** A fake model for the record path: a passing answer for each demo job, by what its input starts with. */
const recorder: ModelClient = {
  async complete(messages: AiMessage[]) {
    const input = messages[messages.length - 1].content;
    if (input.startsWith("Fix line:")) return { content: SUGGESTION, finish: "stop" };
    if (input.includes("Approved tips, word for word:")) return { content: TENANT_LINE, finish: "stop" };
    return { content: RANK_LINE, finish: "stop" };
  },
};

/** A deep copy without the AI layer's own fields. */
function withoutAi(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutAi);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (AI_ONLY.includes(k)) continue;
      out[k] = withoutAi(v);
    }
    return out;
  }
  return value;
}

/**
 * One seat's whole view with the AI layer set apart. Besides the AI line,
 * banner, notice and "AI off" label, the new solution's AI part is the AI
 * layer's own (S15: on Off the fact and effects are picked by hand): what the
 * AI suggested, the "where it came from" label (S16 item 2), its note, and,
 * until a part is confirmed, what its box shows from the suggestion. A
 * confirmed value, and everything code decides, is compared.
 */
function codeOnly(view: SeatView): SeatView {
  const copy = withoutAi(view) as SeatView;
  const solution = copy.manager?.open?.solution;
  if (solution) {
    delete solution.note;
    for (const part of solution.parts) {
      const loose = part as Partial<typeof part>;
      delete loose.suggested;
      delete loose.label;
      if (!part.confirmed) {
        delete loose.shown;
        delete loose.display;
        delete loose.stepText;
      }
    }
  }
  for (const s of copy.hq?.solutions ?? []) {
    delete (s as Partial<typeof s>).ruleTextLabel;
    for (const line of s.condition) delete (line as Partial<typeof line>).label;
  }
  return copy;
}

interface Step {
  step: string;
  statuses: Record<string, string>;
  live: Record<string, string>;
  stops: { stopId: string; lockedJobIds: string[] }[];
  /** Every seat's whole view as the seat shows it in this mode. */
  raw: Record<string, SeatView>;
}

function capture(step: string, mode: AiMode): Step {
  const state = memory.read();
  const raw: Record<string, SeatView> = {};
  for (const seat of SEAT_IDS) raw[seat] = seatView(state, seat, mode, REAL_NOW);
  return {
    step,
    statuses: Object.fromEntries(state.jobs.map((j) => [j.id, j.status])),
    live: { ...state.liveVersionByBuilding },
    stops: state.openRedStops.map((s) => ({ stopId: s.stopId, lockedJobIds: [...s.lockedJobIds].sort() })),
    raw,
  };
}

function compared(steps: Step[]) {
  return steps.map((s) => ({
    step: s.step,
    statuses: s.statuses,
    live: s.live,
    stops: s.stops,
    views: Object.fromEntries(Object.entries(s.raw).map(([seat, view]) => [seat, codeOnly(view)])),
  }));
}

/** The whole demo in one mode, through actionTurn and chatTurn, keeping every seat's view after each step. */
async function runDemo(mode: AiMode, replayDir: string): Promise<{ steps: Step[]; modelCalls: number }> {
  let modelCalls = 0;
  const counting: ModelClient = {
    async complete() {
      modelCalls += 1;
      return { content: null, finish: "stop" };
    },
  };
  const deps: AiDeps = { client: counting, replayDir };
  const steps: Step[] = [];

  async function press(seat: string, action: string, jobId?: string, payload?: Record<string, unknown>) {
    const r = await actionTurn({ seat, action, jobId, payload }, mode, deps, REAL_NOW);
    expect(r.ok, `${mode}: ${seat} ${action}: ${r.message}`).toBe(true);
    return r;
  }

  await press("hq", "reset");
  steps.push(capture("Reset", mode));

  const report = await press("tenant", "report", undefined, { complaint: "too cold" });
  for (const [questionId, answer] of COLD_CORE_KEEPS) await press("tenant", "answer", report.jobId, { questionId, answer });
  steps.push(capture("Tenant self-check on 2318", mode));

  await press("technician", "open-job", "2318");
  steps.push(capture("Technician: Open job", mode));
  await press("technician", "tick", "2318", { causeId: "precool", type: "not-this" });
  await press("technician", "tick", "2318", { causeId: "min-airflow", type: "not-this" });
  steps.push(capture("Technician: 2 Not this ticks", mode));
  await press("technician", "not-solved", "2318", { hoursLost: 3, extraVisits: 2, contractorOrPartsNeeded: false });
  steps.push(capture("Technician: Not solved", mode));

  await press("senior-manager", "tick", "2318", { causeId: "thermostat-spot", type: "found" });
  steps.push(capture("Senior manager: Found it", mode));
  await press("senior-manager", "log-new-solution", "2318", { fixLine: DEMO_FIX, whyLine: DEMO_WHY });
  steps.push(capture("Senior manager: Log new solution", mode));
  for (const [part, value] of DEMO_PARTS) await press("senior-manager", "confirm-part", "2318", { part, value });
  steps.push(capture("Senior manager: confirms", mode));
  await press("senior-manager", "run-tests", "2318");
  steps.push(capture("Senior manager: Run tests", mode));
  await press("senior-manager", "send-to-hq", "2318");
  steps.push(capture("Senior manager: Send to HQ", mode));

  await press("hq", "approve-solution", "2318");
  steps.push(capture("HQ: Approve", mode));

  const a4 = (memory.read().requests as { kind?: string; id: string }[]).find((r) => r && r.kind === "A4")!;
  await press("aom-tower-a", "decide-charge", "2318", {
    requestId: a4.id,
    choice: "tenant-pays",
    amount: 350,
    reason: "Fit-out work is the tenant's own",
  });
  steps.push(capture("AOM: Decide charge", mode));

  const typed = await chatTurn({ seat: "tenant", text: "water dripping near the lights", job: "2318" }, mode, deps, REAL_NOW);
  if (typed.status !== 200) throw new Error("the typed words were refused");
  steps.push(capture('Typed "water dripping near the lights"', mode));
  const red = typed.body.cards[0];
  await press("tenant", "safety-pick", red.jobId, { stopId: red.raiseStopId });
  steps.push(capture("Raise this stop", mode));

  return { steps, modelCalls };
}

function at(steps: Step[], name: string): Step {
  const found = steps.find((s) => s.step === name);
  if (!found) throw new Error(`no step ${name}`);
  return found;
}

function tenantReplyCard(step: Step): SeatCard {
  const cards = step.raw.tenant.messages.flatMap((m) => m.cards ?? []).filter((c) => c.kind === "tenant-reply");
  expect(cards).toHaveLength(1);
  return cards[0];
}

function worded(leads: DeskLead[]): boolean {
  return leads.length > 0 && leads.every((l) => l.aiWording === RANK_LINE && l.aiBanner === REPLAY_BANNER && l.aiOff === undefined);
}

function offLabelled(leads: DeskLead[]): boolean {
  return leads.length > 0 && leads.every((l) => l.aiOff === AI_OFF_LABEL && l.aiWording === undefined && l.aiBanner === undefined);
}

describe("C10b review: AI off gives the same cards, against a Replay run that really shows AI lines", () => {
  it("every demo AI job has a passing saved answer in this test's own folder, written by the real record path", async () => {
    const dir = ownDir();
    const targets = demoRecordTargets({ fixLine: DEMO_FIX, whyLine: DEMO_WHY });
    const counts = await recordMissing(targets, recorder, { dir, log: () => {} });
    expect(counts).toEqual({ passed: targets.length, failed: 0, unavailable: 0, skipped: 0 });
    expect(new Set(targets.map((t) => t.spec.aiJob))).toEqual(new Set(["rank-wording", "tenant-reply", "new-solution"]));
  });

  it("the Replay run shows the AI line and banner on every desk, and every seat's whole view equals Off, step by step", async () => {
    expect(process.env.LLM_API_KEY).toBe("");
    expect(() => (globalThis.fetch as unknown as () => unknown)()).toThrow("network blocked in tests");

    const replayDir = ownDir();
    await recordMissing(demoRecordTargets({ fixLine: DEMO_FIX, whyLine: DEMO_WHY }), recorder, { dir: replayDir, log: () => {} });

    const replay = await runDemo("replay", replayDir);
    const off = await runDemo("off", replayDir);
    expect(replay.modelCalls).toBe(0);
    expect(off.modelCalls).toBe(0);
    expect(replay.steps).toHaveLength(14);

    // The Replay run really carries AI lines, with the banner, where a judge sees them.
    // The tenant reply (C7a): the AI line under the tips, which stay word for word.
    const replyOnReplay = tenantReplyCard(at(replay.steps, "Tenant self-check on 2318"));
    expect(replyOnReplay.aiWording).toBe(TENANT_LINE);
    expect(replyOnReplay.aiBanner).toBe(REPLAY_BANNER);
    const replyOff = tenantReplyCard(at(off.steps, "Tenant self-check on 2318"));
    expect(replyOff.aiWording).toBeUndefined();
    expect(replyOff.aiOff).toBe(AI_OFF_LABEL);
    expect(replyOff.body).toBe(replyOnReplay.body);
    expect(replyOnReplay.body).toContain(VISIT_BOOKED_LINE);

    // The technician's leads (C7b), at Open job and after the 2 Not this ticks.
    for (const name of ["Technician: Open job", "Technician: 2 Not this ticks"]) {
      expect(worded(at(replay.steps, name).raw.technician.desk!.open!.leads), `replay ${name}`).toBe(true);
      expect(offLabelled(at(off.steps, name).raw.technician.desk!.open!.leads), `off ${name}`).toBe(true);
    }

    // The senior manager's own ranked list (C8a) once 2318 comes up.
    const managerLeads = at(replay.steps, "Technician: Not solved").raw["senior-manager"].manager!.open!.open.leads;
    expect(worded(managerLeads)).toBe(true);
    expect(offLabelled(at(off.steps, "Technician: Not solved").raw["senior-manager"].manager!.open!.open.leads)).toBe(true);

    // The new solution (C8a): the AI's draft and suggestion with the banner; on Off, the fix line and picks by hand.
    const draft = at(replay.steps, "Senior manager: Log new solution").raw["senior-manager"].manager!.open!.solution!;
    expect(draft.aiBanner).toBe(REPLAY_BANNER);
    expect(draft.parts.find((p) => p.id === "fact")!.suggested).toBe("fit-out-12m");
    const draftOff = at(off.steps, "Senior manager: Log new solution").raw["senior-manager"].manager!.open!.solution!;
    expect(draftOff.aiOff).toBe(AI_OFF_LABEL);
    expect(draftOff.parts.filter((p) => p.id !== "rule-text").map((p) => p.suggested)).toEqual([null, null, null]);

    // The Building B card (C8b) after HQ's Approve: 2401 on v1.1, thermostat-spot first, worded with the banner.
    const buildingB = at(replay.steps, "HQ: Approve").raw.hq.hq!.buildingB!;
    expect(buildingB.version).toBe("1.1");
    expect(buildingB.leads[0].causeId).toBe("thermostat-spot");
    expect(worded(buildingB.leads)).toBe(true);
    const buildingBOff = at(off.steps, "HQ: Approve").raw.hq.hq!.buildingB!;
    expect(buildingBOff.aiOff).toBe(AI_OFF_LABEL);
    expect(offLabelled(buildingBOff.leads)).toBe(true);

    // Red cards never reach the AI, on either run.
    const redOnReplay = at(replay.steps, 'Typed "water dripping near the lights"')
      .raw.tenant.messages.flatMap((m) => m.cards ?? [])
      .filter((c) => c.kind === "red-stop");
    expect(redOnReplay.length).toBeGreaterThan(0);
    expect(redOnReplay.every((c) => c.aiJob === undefined && c.aiWording === undefined && c.aiBanner === undefined)).toBe(true);

    // AI off gives the same cards: every seat's whole view, at every step, once the AI layer is set apart.
    expect(compared(off.steps)).toEqual(compared(replay.steps));

    // The comparison reaches the desks: had the AI line replaced one code field on a Replay desk, it would differ.
    for (const [name, leadsOf] of [
      ["Technician: Open job", (v: Record<string, SeatView>) => v.technician.desk!.open!.leads],
      ["HQ: Approve", (v: Record<string, SeatView>) => v.hq.hq!.buildingB!.leads],
    ] as const) {
      const bent = compared(replay.steps);
      leadsOf(bent.find((s) => s.step === name)!.views)[0].reason = RANK_LINE;
      expect(compared(off.steps), name).not.toEqual(bent);
    }
  }, 120000);
});

describe("C10b review: Live sends the key only to a configured base URL", () => {
  const FAKE = "FAKE-TEST-SECRET";
  const tips = v10.tenant_tips.filter((t) => t.rules.includes("TS-CC-09"));

  async function withEnv<T>(key: string, baseUrl: string, run: () => Promise<T>): Promise<T> {
    const before = { key: process.env.LLM_API_KEY, url: process.env.LLM_BASE_URL };
    process.env.LLM_API_KEY = key;
    process.env.LLM_BASE_URL = baseUrl;
    _resetClient();
    try {
      return await run();
    } finally {
      if (before.key === undefined) delete process.env.LLM_API_KEY;
      else process.env.LLM_API_KEY = before.key;
      if (before.url === undefined) delete process.env.LLM_BASE_URL;
      else process.env.LLM_BASE_URL = before.url;
      _resetClient();
    }
  }

  function place() {
    resetDemo(REAL_NOW);
    const job = memory.jobById(memory.read(), "2318")!;
    return { seat: "tenant", version: "1.0", job };
  }

  function counter() {
    const box = { calls: 0 };
    const client: ModelClient = {
      async complete() {
        box.calls += 1;
        return { content: TENANT_LINE, finish: "stop" };
      },
    };
    return { box, client };
  }

  it("a key with an empty LLM_BASE_URL makes no call on Live, even with a client at hand: the tips show", async () => {
    const { box, client } = counter();
    const out = await withEnv(FAKE, "", () => tenantReply(v10, tips, VISIT_BOOKED_LINE, place(), "live", { client, replayDir: ownDir() }));
    expect(box.calls).toBe(0);
    expect(out.aiCalls).toBe(0);
    expect(out.source).toBe("fallback");
    expect(out.notice).toBeNull();
    expect(out.value.lines).toEqual(tips.map((t) => t.text));
  });

  it("a key with an empty LLM_BASE_URL never builds the SDK client on Live: no call and no AI unavailable line", async () => {
    const lines: string[] = [];
    const out = await withEnv(FAKE, "   ", () =>
      tenantReply(v10, tips, VISIT_BOOKED_LINE, place(), "live", { replayDir: ownDir(), log: (l) => lines.push(l) })
    );
    expect(out.aiCalls).toBe(0);
    expect(out.notice).toBeNull();
    expect(lines).toEqual([]);
  });

  it("a key with a base URL still calls the model on Live (the guard stops only the empty base URL)", async () => {
    const { box, client } = counter();
    const out = await withEnv(FAKE, "https://tokenhub.example.test/v1", () =>
      tenantReply(v10, tips, VISIT_BOOKED_LINE, place(), "live", { client, replayDir: ownDir() })
    );
    expect(box.calls).toBe(1);
    expect(out.aiCalls).toBe(1);
    expect(out.source).toBe("live");
    expect(out.value.aiWording).toBe(TENANT_LINE);
  });
});
