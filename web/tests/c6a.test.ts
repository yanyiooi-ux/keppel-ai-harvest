/**
 * C6a: the AI words things, code decides (S13, S14, S15, T-C6a).
 *
 * Fake clients only. tests/setup.ts keeps the key empty and the network blocked,
 * and tests/setup-replay.ts points the replay folder at an empty temp folder, so
 * nothing here can reach Hunyuan or web/data/replay/. A test that needs a saved
 * answer writes it into its own temp folder.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, existsSync, readdirSync, mkdtempSync, rmSync } from "fs";
import { join, resolve, dirname } from "path";
import { tmpdir } from "os";
import {
  aiModeFrom,
  aiModeCookie,
  replayDir,
  replayKey,
  readReplay,
  saveReplay,
  openAiModelClient,
  loadPrompt,
  rankWording,
  rankWordingSpec,
  tenantReply,
  tenantReplySpec,
  newSolution,
  recordAnswer,
  runAiJob,
  AI_MAX_TOKENS,
  REPLAY_BANNER,
  AI_OFF_LABEL,
  type ModelClient,
  type AiMessage,
  type AiDeps,
} from "../lib/ai";
import { wordChatCards, wordLeads, isRedCard } from "../lib/ai-wording";
import { demoRecordTargets, recordMissing } from "../lib/ai-demo-targets";
import { handleTyped, applyTypedReply, type ChatCard } from "../lib/chat";
import { seatView } from "../lib/seat-view";
import { leadsForJob } from "../lib/leads";
import { loadPill, type Pill, type TenantTip } from "../lib/pill";
import { safetyCardForStop } from "../lib/safety";
import { checkRedStop } from "../lib/rule-engine";
import { MENU_FACTS, PUT_FIRST_STEPS, BLOCK_STEPS, ADVISORY_LABEL } from "../lib/conditions";
import * as memory from "../lib/memory";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");
const v10 = loadPill("ts-cc", "1.0");
const SECRET = "FAKE-TEST-SECRET";

const DEMO_FIX =
  "If the zone had a fit-out in the last 12 months, check where the thermostat sits against the fit-out drawing before any nudge.";
const DEMO_WHY =
  "The fit-out 8 months ago moved the core thermostat next to the new printer bay, so it reads warm and the box keeps cooling the open area.";

/** A wording that passes S13 and S14 for any lead: no number, no rule id, no blocked word. */
const GOOD_RANK = "This is the best first check for this spot.";

const tipsWith = (pill: Pill, ruleId: string): TenantTip[] => pill.tenant_tips.filter((t) => t.rules.includes(ruleId));
const TS09_TIPS = tipsWith(v10, "TS-CC-09");
const VISIT = "A technician visit is booked.";

/** A model client that answers with fixed text and records every message list it is sent. */
function fakeClient(answer: string | null) {
  const calls: AiMessage[][] = [];
  const client: ModelClient = {
    async complete(messages) {
      calls.push(messages);
      return { content: answer, finish: "stop" };
    },
  };
  return { client, calls };
}

/** A model client that fails the way the OpenAI SDK fails: an error with a status and a message. */
function failingClient(status: number, message: string) {
  const calls: AiMessage[][] = [];
  const client: ModelClient = {
    async complete(messages) {
      calls.push(messages);
      throw Object.assign(new Error(message), {
        status,
        headers: { authorization: `Bearer ${SECRET}` },
      });
    },
  };
  return { client, calls };
}

function ownTempDir(): string {
  return mkdtempSync(join(tmpdir(), "c6a-replay-"));
}

function jobOf(id: string) {
  const job = memory.jobById(memory.read(), id);
  if (!job) throw new Error(`no job ${id}`);
  return job;
}

function placeFor(id: string, seat: string) {
  return { seat, version: "1.0", job: jobOf(id) };
}

beforeEach(() => {
  memory.resetToSeed(REAL_NOW);
});

// ---- Run rule 6: one setting for the replay folder, empty in every test ----

describe("C6a: the replay folder is one setting, and every test starts with an empty one", () => {
  it("points at an empty temp folder, never web/data/replay/", () => {
    const dir = process.env.PILL_DESK_REPLAY_DIR;
    expect(dir).toBeDefined();
    expect(resolve(dir!)).not.toBe(resolve(process.cwd(), "data", "replay"));
    expect(resolve(dir!).startsWith(resolve(tmpdir()))).toBe(true);
    expect(existsSync(dir!)).toBe(true);
    expect(readdirSync(dir!)).toEqual([]);
    expect(replayDir()).toBe(dir);
  });

  it("ai.ts is server-only plus a re-export of ai-core.ts; ai-core.ts has no server-only import", () => {
    const aiLines = codeLines(readFileSync(join(process.cwd(), "lib", "ai.ts"), "utf-8"));
    expect(aiLines[0]).toBe('import "server-only";');
    for (const line of aiLines.slice(1)) expect(line).toMatch(/^export .* from "\.\/ai-core";$/);
    const core = codeLines(readFileSync(join(process.cwd(), "lib", "ai-core.ts"), "utf-8")).join("\n");
    expect(core).not.toMatch(/server-only/);
    expect(core).toMatch(/from "openai"/);
  });
});

/** A source file's code lines, with comments taken out (a comment may name what the code must not import). */
function codeLines(src: string): string[] {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

// ---- S15: where the switch starts ----

describe("C6a: REPLAY_MODE only sets where the AI switch starts; the cookie wins after that", () => {
  it("1 starts on Replay, anything else on Live", () => {
    expect(aiModeFrom(undefined, "1")).toBe("replay");
    expect(aiModeFrom(undefined, "0")).toBe("live");
    expect(aiModeFrom(undefined, undefined)).toBe("live");
    expect(aiModeFrom("", "1")).toBe("replay");
  });

  it("a picked position wins over REPLAY_MODE, and junk in the cookie is ignored", () => {
    expect(aiModeFrom("off", "1")).toBe("off");
    expect(aiModeFrom("live", "1")).toBe("live");
    expect(aiModeFrom("replay", "0")).toBe("replay");
    expect(aiModeFrom("loud", "1")).toBe("replay");
    expect(aiModeFrom("loud", "0")).toBe("live");
  });

  it("the switch saves its position as a cookie for the whole site", () => {
    const cookie = aiModeCookie("off");
    expect(cookie.startsWith("pill-desk-ai=off;")).toBe(true);
    expect(cookie).toContain("path=/");
  });
});

// ---- S15: Hunyuan, then a replay with the banner, then the fallback ----

describe("C6a: every call goes Hunyuan, then a replay with the banner, then the fallback", () => {
  const lead = { label: "Pre-cooling starts too late", reason: "Code reason for the test.", checkText: "Check the start time." };

  it("Live with a key: the model's answer shows as an extra line and the code reason stays", async () => {
    const { client, calls } = fakeClient(GOOD_RANK);
    const out = await rankWording(v10, lead, placeFor("2318", "technician"), "live", { client, keyPresent: true });
    expect(calls).toHaveLength(1);
    expect(out.source).toBe("live");
    expect(out.aiCalls).toBe(1);
    expect(out.value).toEqual({ code: lead.reason, aiWording: GOOD_RANK });
    expect(out.banner).toBeNull();
  });

  it("an error falls to the saved answer, with the banner", async () => {
    const dir = ownTempDir();
    const place = placeFor("2318", "technician");
    saveReplay(rankWordingSpec(v10, lead, place).key, { text: GOOD_RANK, pass: true }, dir);
    const lines: string[] = [];
    const { client } = failingClient(500, "upstream down");
    const out = await rankWording(v10, lead, place, "live", { client, keyPresent: true, replayDir: dir, log: (l) => lines.push(l) });
    expect(out.source).toBe("replay");
    expect(out.banner).toBe("replay: saved real AI answer");
    expect(REPLAY_BANNER).toBe("replay: saved real AI answer");
    expect(out.value.aiWording).toBe(GOOD_RANK);
    expect(out.notice).toBe("500 AI unavailable, using replay");
    expect(lines).toEqual(["500 AI unavailable, using replay"]);
    rmSync(dir, { recursive: true, force: true });
  });

  it("an error with no saved answer falls to the code reason only", async () => {
    const { client } = failingClient(503, "busy");
    const out = await rankWording(v10, lead, placeFor("2318", "technician"), "live", { client, keyPresent: true, log: () => {} });
    expect(out.source).toBe("fallback");
    expect(out.value).toEqual({ code: lead.reason, aiWording: null });
    expect(out.aiCalls).toBe(1);
  });

  it("an empty key turns replay on by itself: the model is never called", async () => {
    const dir = ownTempDir();
    const place = placeFor("2318", "technician");
    saveReplay(rankWordingSpec(v10, lead, place).key, { text: GOOD_RANK, pass: true }, dir);
    const { client, calls } = fakeClient("anything");
    const out = await rankWording(v10, lead, place, "live", { client, keyPresent: false, replayDir: dir });
    expect(calls).toHaveLength(0);
    expect(out.source).toBe("replay");
    expect(out.aiCalls).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });

  it("with no deps at all, the empty test key means no call: the client is never built", async () => {
    expect(process.env.LLM_API_KEY).toBe("");
    const out = await rankWording(v10, lead, placeFor("2318", "technician"), "live");
    expect(out.source).toBe("fallback");
    expect(out.aiCalls).toBe(0);
  });

  it("Replay never calls the model, even with a key", async () => {
    const { client, calls } = fakeClient(GOOD_RANK);
    const out = await rankWording(v10, lead, placeFor("2318", "technician"), "replay", { client, keyPresent: true });
    expect(calls).toHaveLength(0);
    expect(out.source).toBe("fallback");
  });

  it("a saved answer whose pass flag is false is never shown", async () => {
    const dir = ownTempDir();
    const place = placeFor("2318", "technician");
    saveReplay(rankWordingSpec(v10, lead, place).key, { text: GOOD_RANK, pass: false }, dir);
    const out = await rankWording(v10, lead, place, "replay", { replayDir: dir });
    expect(out.source).toBe("fallback");
    expect(out.value.aiWording).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  it("a saved answer is checked again before it shows", async () => {
    const dir = ownTempDir();
    const place = placeFor("2318", "technician");
    saveReplay(rankWordingSpec(v10, lead, place).key, { text: "Unplug the heater first.", pass: true }, dir);
    const out = await rankWording(v10, lead, place, "replay", { replayDir: dir });
    expect(out.source).toBe("fallback");
    rmSync(dir, { recursive: true, force: true });
  });

  it("a model answer that fails its checks falls through and is never shown", async () => {
    const { client } = fakeClient("One. Two. Three.");
    const out = await rankWording(v10, lead, placeFor("2318", "technician"), "live", { client, keyPresent: true });
    expect(out.source).toBe("fallback");
    expect(out.value.aiWording).toBeNull();
    expect(out.aiText).toBeNull();
  });

  it("a live answer that fails its checks, or has no content, shows only the code text, never a replay (S14, S15)", async () => {
    const dir = ownTempDir();
    const place = placeFor("2318", "technician");
    saveReplay(rankWordingSpec(v10, lead, place).key, { text: GOOD_RANK, pass: true }, dir);
    for (const answer of ["One. Two. Three.", null]) {
      const { client, calls } = fakeClient(answer);
      const out = await rankWording(v10, lead, place, "live", { client, keyPresent: true, replayDir: dir });
      expect(calls).toHaveLength(1);
      expect(out.source).toBe("fallback");
      expect(out.value).toEqual({ code: lead.reason, aiWording: null });
      expect(out.banner).toBeNull();
      expect(out.notice).toBeNull();
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it("a call that never answers times out and falls back, showing only the fixed phrase", async () => {
    const client: ModelClient = {
      complete: (_messages, signal) =>
        new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error(`aborted ${SECRET}`)))),
    };
    const lines: string[] = [];
    const out = await rankWording(v10, lead, placeFor("2318", "technician"), "live", {
      client,
      keyPresent: true,
      timeoutMs: 20,
      log: (l) => lines.push(l),
    });
    expect(out.source).toBe("fallback");
    expect(out.notice).toBe("AI unavailable, using replay");
    expect(lines).toEqual(["AI unavailable, using replay"]);
  });
});

// ---- S15: replay keys ----

describe("C6a: replay keys are seat, job, pill version, AI job and a hash of the code text", () => {
  const lead = { label: "Pre-cooling starts too late", reason: "Code reason for the test.", checkText: "Check the start time." };

  it("the same input gives the same key, and each part changes it", () => {
    const base = { aiJob: "rank-wording", seat: "technician", jobId: "2318", version: "1.0", text: "abc" } as const;
    expect(replayKey(base)).toBe(replayKey({ ...base }));
    expect(replayKey({ ...base, seat: "senior-manager" })).not.toBe(replayKey(base));
    expect(replayKey({ ...base, jobId: "2401" })).not.toBe(replayKey(base));
    expect(replayKey({ ...base, version: "1.1" })).not.toBe(replayKey(base));
    expect(replayKey({ ...base, aiJob: "tenant-reply" })).not.toBe(replayKey(base));
    expect(replayKey({ ...base, text: "abd" })).not.toBe(replayKey(base));
  });

  it("a saved answer for another code reason is a mismatch: no replay, the fallback shows", async () => {
    const dir = ownTempDir();
    const place = placeFor("2318", "technician");
    saveReplay(rankWordingSpec(v10, lead, place).key, { text: GOOD_RANK, pass: true }, dir);
    const changed = { ...lead, reason: "Code reason for the test, changed." };
    const out = await rankWording(v10, changed, place, "replay", { replayDir: dir });
    expect(out.source).toBe("fallback");
    const otherSeat = await rankWording(v10, lead, placeFor("2318", "senior-manager"), "replay", { replayDir: dir });
    expect(otherSeat.source).toBe("fallback");
    rmSync(dir, { recursive: true, force: true });
  });

  it("the new solution's free text is keyed by a hash of the exact fix and why lines", () => {
    const place = placeFor("2318", "senior-manager");
    const a = newSolutionKey(DEMO_FIX, DEMO_WHY, place);
    expect(newSolutionKey(DEMO_FIX, DEMO_WHY, place)).toBe(a);
    expect(newSolutionKey(`${DEMO_FIX} `, DEMO_WHY, place)).not.toBe(a);
    expect(newSolutionKey(DEMO_FIX, `${DEMO_WHY}!`, place)).not.toBe(a);
  });

  it("a saved file holds only the answer text and its pass flag", () => {
    const dir = ownTempDir();
    const path = saveReplay("k-test", { text: GOOD_RANK, pass: true }, dir);
    const saved = JSON.parse(readFileSync(path, "utf-8"));
    expect(Object.keys(saved).sort()).toEqual(["pass", "text"]);
    expect(readReplay("k-test", dir)).toEqual({ text: GOOD_RANK, pass: true });
    expect(readReplay("not-there", dir)).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });
});

function newSolutionKey(fix: string, why: string, place: ReturnType<typeof placeFor>): string {
  return replayKey({ aiJob: "new-solution", seat: place.seat, jobId: place.job.id, version: place.version, text: `${fix}\n${why}` });
}

// ---- S15: hy3 thinks first ----

describe("C6a: the model client reads only content (hy3 streams its thinking first)", () => {
  function fakeOpenAi(chunks: unknown[]) {
    const seen: { body: Record<string, unknown>; opts: Record<string, unknown> }[] = [];
    const openai = {
      chat: {
        completions: {
          create: async (body: Record<string, unknown>, opts: Record<string, unknown>) => {
            seen.push({ body, opts });
            return (async function* () {
              for (const c of chunks) yield c;
            })();
          },
        },
      },
    };
    return { openai, seen };
  }

  it("skips reasoning_content and returns only content, with AI_MAX_TOKENS and a stream", async () => {
    const { openai, seen } = fakeOpenAi([
      { choices: [{ delta: { reasoning_content: "thinking about it" } }] },
      { choices: [{ delta: { content: "Hello " } }] },
      { choices: [{ delta: { content: "there." }, finish_reason: "stop" }] },
    ]);
    const client = openAiModelClient(openai, "model-x");
    const controller = new AbortController();
    const reply = await client.complete([{ role: "user", content: "hi" }], controller.signal);
    expect(reply).toEqual({ content: "Hello there.", finish: "stop" });
    expect(seen[0].body.max_tokens).toBe(AI_MAX_TOKENS);
    expect(seen[0].body.stream).toBe(true);
    expect(seen[0].body.model).toBe("model-x");
    expect(seen[0].opts.signal).toBe(controller.signal);
  });

  it("finish length with no content is no answer, and the fallback shows", async () => {
    const { openai } = fakeOpenAi([
      { choices: [{ delta: { reasoning_content: "still thinking" } }] },
      { choices: [{ delta: {}, finish_reason: "length" }] },
    ]);
    const client = openAiModelClient(openai, "model-x");
    const reply = await client.complete([{ role: "user", content: "hi" }], new AbortController().signal);
    expect(reply.content).toBeNull();

    const lead = { label: "L", reason: "Code reason.", checkText: "Check." };
    const out = await rankWording(v10, lead, placeFor("2318", "technician"), "live", { client, keyPresent: true });
    expect(out.source).toBe("fallback");
    expect(JSON.stringify(out)).not.toContain("thinking");
  });
});

// ---- T-C6a ----

describe("T-C6a: no key gives the replay banner, then the fallback, and the same cards", () => {
  it("Building B's leads: a saved answer shows with the banner, the rest fall back, the leads never change", async () => {
    const state = memory.read();
    const job = jobOf("2401");
    const ranked = leadsForJob(state, job, "technician", REAL_NOW).leads.slice(0, 3);
    expect(ranked).toHaveLength(3);

    const dir = ownTempDir();
    const place = { seat: "technician", version: "1.0", job };
    saveReplay(rankWordingSpec(v10, ranked[0], place).key, { text: GOOD_RANK, pass: true }, dir);

    const withReplay = await wordLeads(state, job, "technician", "live", { replayDir: dir }, REAL_NOW);
    expect(withReplay.items.map((i) => i.lead)).toEqual(ranked);
    expect(withReplay.items[0].wording.source).toBe("replay");
    expect(withReplay.items[0].wording.banner).toBe("replay: saved real AI answer");
    expect(withReplay.items[0].wording.value).toEqual({ code: ranked[0].reason, aiWording: GOOD_RANK });
    expect(withReplay.items[1].wording.source).toBe("fallback");
    expect(withReplay.items[2].wording.value.aiWording).toBeNull();
    expect(withReplay.aiCalls).toBe(0);

    const none = await wordLeads(state, job, "technician", "live", {}, REAL_NOW);
    expect(none.items.map((i) => i.lead)).toEqual(ranked);
    expect(none.items.every((i) => i.wording.source === "fallback")).toBe(true);
    expect(none.items.map((i) => i.wording.value.code)).toEqual(ranked.map((l) => l.reason));
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("T-C6a: AI off gives the same cards and ranks, the AI off label, the tips and the fix line", () => {
  it("leads: same order, same reasons, no call, and the AI off label", async () => {
    const state = memory.read();
    const job = jobOf("2401");
    const { client, calls } = fakeClient(GOOD_RANK);
    const off = await wordLeads(state, job, "technician", "off", { client, keyPresent: true }, REAL_NOW);
    expect(calls).toHaveLength(0);
    expect(off.items.map((i) => i.lead)).toEqual(leadsForJob(state, job, "technician", REAL_NOW).leads.slice(0, 3));
    expect(off.aiOff).toBe("AI off");
    expect(AI_OFF_LABEL).toBe("AI off");
    expect(off.items.every((i) => i.wording.value.aiWording === null)).toBe(true);
    expect(off.aiCalls).toBe(0);
  });

  it("tenant reply: the tips word for word", async () => {
    const { client, calls } = fakeClient("Thanks, we are on it.");
    const out = await tenantReply(v10, TS09_TIPS, VISIT, placeFor("2318", "tenant"), "off", { client, keyPresent: true });
    expect(calls).toHaveLength(0);
    expect(out.value.lines).toEqual(TS09_TIPS.map((t) => t.text));
    expect(out.value.codeLine).toBe(VISIT);
    expect(out.aiOff).toBe("AI off");
  });

  it("new solution: the fix line is the rule text, fact and effects picked by hand", async () => {
    const { client, calls } = fakeClient("{}");
    const out = await newSolution(v10, DEMO_FIX, DEMO_WHY, placeFor("2318", "senior-manager"), "off", { client, keyPresent: true });
    expect(calls).toHaveLength(0);
    expect(out.value.ruleText).toBe(DEMO_FIX);
    expect(out.value.ruleTextFrom).toBe("fix-line");
    expect(out.value.suggestion).toBeNull();
    expect(out.value.conditionFrom).toBe("by-hand");
    expect(out.aiOff).toBe("AI off");
  });

  it("a stored worded card shows on Off as the same card with the AI off label and no AI line", async () => {
    const dir = ownTempDir();
    const state = memory.read();
    const reply = handleTyped(state, "technician", "why", "2318", REAL_NOW);
    const why = reply.cards[0];
    expect(why.rankLead).toBeDefined();
    const place = placeFor("2318", "technician");
    const spec = rankWordingSpec(v10, { label: why.rankLead!.label, reason: why.body!, checkText: why.rankLead!.checkText }, place);
    saveReplay(spec.key, { text: GOOD_RANK, pass: true }, dir);

    const cards = await wordChatCards(reply.cards, { state, seat: "technician", jobId: "2318", mode: "replay" }, { replayDir: dir });
    memory.update((s) => applyTypedReply(s, "technician", "2318", { ...reply, cards }));

    const onReplay = seatView(memory.read(), "technician", "replay").messages.at(-1)!.cards![0];
    const onOff = seatView(memory.read(), "technician", "off").messages.at(-1)!.cards![0];
    expect(onReplay.aiWording).toBe(GOOD_RANK);
    expect(onReplay.aiOff).toBeUndefined();
    expect(onOff.aiWording).toBeUndefined();
    expect(onOff.aiBanner).toBeUndefined();
    expect(onOff.aiOff).toBe("AI off");
    for (const field of ["kind", "title", "body", "receipt", "rankLead"] as const) {
      expect(onOff[field]).toEqual(onReplay[field]);
    }
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("T-C6a: red cards are never worded", () => {
  it("RS-04, the RS-08 card, the TS-CC-06 refusal and the Safety list keep AI calls 0 with a fake client on", async () => {
    const state = memory.read();
    const { client, calls } = fakeClient(GOOD_RANK);
    const deps: AiDeps = { client, keyPresent: true };

    const typedRed = handleTyped(state, "technician", "water dripping near the lights", "2318", REAL_NOW).cards;
    expect(typedRed.map((c) => c.stopId)).toContain("RS-04");

    const rs08 = v10.red_stops.find((s) => s.id === "RS-08")!;
    const picked = safetyCardForStop(rs08, "1.0");
    const trend = checkRedStop(v10, { damperFullyOpenForHours: true });
    expect(trend.id).toBe("RS-08");
    const rs08Cards: ChatCard[] = [
      { kind: "red-stop", stopId: picked.id, title: picked.trigger, body: picked.action, receipt: picked.receipt },
      { kind: "red-stop", stopId: trend.id!, title: trend.trigger!, body: trend.action!, receipt: picked.receipt },
    ];

    const refusal = handleTyped(state, "technician", "push the setpoint to the BMS", "2318", REAL_NOW).cards;
    expect(refusal[0].kind).toBe("refusal");
    expect(refusal[0].stopId).toBe("RS-10");

    const list = handleTyped(state, "technician", "safety", "2318", REAL_NOW).cards;
    expect(list[0].kind).toBe("safety-list");

    // Even a red card that somehow carries a lead to word is never sent.
    const sneaky: ChatCard = { ...typedRed[0], rankLead: { label: "x", checkText: "y" } };

    const all = [...typedRed, ...rs08Cards, ...refusal, ...list, sneaky];
    for (const card of all) expect(isRedCard(card)).toBe(true);

    const out = await wordChatCards(all, { state, seat: "technician", jobId: "2318", mode: "live" }, deps);
    expect(calls).toHaveLength(0);
    expect(out).toEqual(all);
    for (const card of out.filter((c) => c.kind !== "safety-list")) {
      expect(card.receipt).toContain("AI calls: 0");
    }
  });
});

describe("T-C6a: the tenant reply", () => {
  it("a 4-sentence reply fails and the tips show word for word", async () => {
    const { client } = fakeClient("We hear you. A technician will come. Please note the time. Thank you.");
    const out = await tenantReply(v10, TS09_TIPS, VISIT, placeFor("2318", "tenant"), "live", { client, keyPresent: true });
    expect(out.source).toBe("fallback");
    expect(out.value.lines).toEqual(TS09_TIPS.map((t) => t.text));
    expect(out.value.aiWording).toBeNull();
  });

  it("a short reply that passes S13 and S14 shows", async () => {
    const good = "Thanks for telling us. Please note the time and the spot each time it feels uncomfortable, and tell the helpdesk.";
    const { client } = fakeClient(good);
    const out = await tenantReply(v10, TS09_TIPS, VISIT, placeFor("2318", "tenant"), "live", { client, keyPresent: true });
    expect(out.source).toBe("live");
    expect(out.value.lines).toEqual([good]);
    expect(out.value.tips).toEqual(TS09_TIPS.map((t) => t.text));
  });

  it("a reply naming the cause falls back to the tips (S13 item 10)", async () => {
    const { client } = fakeClient("because your fit-out moved the thermostat, it feels cold.");
    const out = await tenantReply(v10, TS09_TIPS, VISIT, placeFor("2318", "tenant"), "live", { client, keyPresent: true });
    expect(out.value.lines).toEqual(TS09_TIPS.map((t) => t.text));
  });

  it("the tenant prompt's input never holds a cause line or a tenant's name", async () => {
    const causes = JSON.parse(readFileSync(join(process.cwd(), "data", "causes.json"), "utf-8")).causes as {
      label: string;
      tenantSolution: string;
      fixRoute: string;
    }[];
    for (const id of ["2318", "2401"]) {
      const job = {
        ...jobOf(id),
        foundLeadId: "thermostat-spot",
        whyLine: DEMO_WHY,
        notes: ["Tenant says the thermostat does not show AUTO (looked, did not touch)."],
      };
      const { client, calls } = fakeClient("Thanks.");
      await tenantReply(v10, TS09_TIPS, VISIT, { seat: "tenant", version: "1.0", job }, "live", { client, keyPresent: true });
      expect(calls).toHaveLength(1);
      const sent = JSON.stringify(calls[0]);
      expect(sent).not.toContain(DEMO_WHY);
      expect(sent).not.toContain("thermostat-spot");
      for (const c of causes) {
        expect(sent).not.toContain(c.label);
        expect(sent).not.toContain(c.tenantSolution);
        expect(sent).not.toContain(c.fixRoute);
      }
      expect(sent).not.toContain("Meridian Partners");
      expect(sent).not.toContain("Northwind Advisory");
      expect(sent).not.toContain(job.notes[0]);
      const user = calls[0].find((m) => m.role === "user")!.content;
      for (const tip of TS09_TIPS) expect(user).toContain(tip.text);
      expect(user).toContain(VISIT);
    }
  });
});

describe("T-C6a: a fake 401 shows and logs only the status and the fixed phrase", () => {
  const consoleNames = ["log", "info", "warn", "error", "debug"] as const;
  let spies: ReturnType<typeof vi.spyOn>[] = [];

  beforeEach(() => {
    spies = consoleNames.map((name) => vi.spyOn(console, name).mockImplementation(() => {}));
  });
  afterEach(() => {
    for (const s of spies) s.mockRestore();
  });

  function printed(): string {
    return JSON.stringify(spies.map((s) => s.mock.calls));
  }

  it("rank wording, tenant reply and new solution: only '401 AI unavailable, using replay'", async () => {
    const message = `401 Incorrect API key provided: ${SECRET}. See the base URL.`;
    const lead = { label: "L", reason: "Code reason.", checkText: "Check." };
    const outs = [
      await rankWording(v10, lead, placeFor("2318", "technician"), "live", { client: failingClient(401, message).client, keyPresent: true }),
      await tenantReply(v10, TS09_TIPS, VISIT, placeFor("2318", "tenant"), "live", { client: failingClient(401, message).client, keyPresent: true }),
      await newSolution(v10, DEMO_FIX, DEMO_WHY, placeFor("2318", "senior-manager"), "live", { client: failingClient(401, message).client, keyPresent: true }),
    ];
    for (const out of outs) {
      expect(out.notice).toBe("401 AI unavailable, using replay");
      expect(JSON.stringify(out)).not.toContain(SECRET);
      expect(JSON.stringify(out)).not.toContain("Incorrect API key");
      expect(out.source).toBe("fallback");
    }
    const logCalls = spies[0].mock.calls;
    expect(logCalls).toEqual([
      ["401 AI unavailable, using replay"],
      ["401 AI unavailable, using replay"],
      ["401 AI unavailable, using replay"],
    ]);
    expect(printed()).not.toContain(SECRET);
    expect(printed()).not.toContain("Bearer");
  });
});

describe("T-C6a: the new solution", () => {
  it("a fake answer that blocks step 8 comes back as a note", async () => {
    const answer = JSON.stringify({
      ruleText: "Check the fit-out drawing before anything else.",
      fact: "fit-out-12m",
      effects: [{ effect: "block", step: 8 }],
    });
    const { client } = fakeClient(answer);
    const out = await newSolution(v10, DEMO_FIX, DEMO_WHY, placeFor("2318", "senior-manager"), "live", { client, keyPresent: true });
    expect(out.source).toBe("live");
    expect(out.value.suggestion?.kind).toBe("note");
    expect(out.value.suggestion?.kind === "note" && out.value.suggestion.label).toBe(ADVISORY_LABEL);
    expect(out.value.suggestion?.text).toBe("Check the fit-out drawing before anything else.");
    expect(out.value.ruleText).toBe(DEMO_FIX);
    expect(out.value.ruleTextFrom).toBe("fix-line");
    expect(out.value.conditionFrom).toBe("by-hand");
  });

  it("an answer that fits the menu is a suggestion from the code menu, in a code fence or not", async () => {
    const rule = {
      ruleText: "If the zone had a fit-out in the last 12 months, check the thermostat spot against the drawing first.",
      fact: "fit-out-12m",
      effects: [
        { effect: "block", step: 25 },
        { effect: "put-first", step: 21 },
      ],
    };
    for (const answer of [JSON.stringify(rule), "```json\n" + JSON.stringify(rule) + "\n```"]) {
      const { client } = fakeClient(answer);
      const out = await newSolution(v10, DEMO_FIX, DEMO_WHY, placeFor("2318", "senior-manager"), "live", { client, keyPresent: true });
      expect(out.value.suggestion?.kind).toBe("rule");
      expect(out.value.ruleText).toBe(rule.ruleText);
      expect(out.value.ruleTextFrom).toBe("ai");
      expect(out.value.conditionFrom).toBe("ai");
      if (out.value.suggestion?.kind === "rule") {
        expect(out.value.suggestion.condition).toEqual({ fact: "fit-out-12m", effects: rule.effects });
      }
    }
  });

  it("an AI note stays a note; text that is not JSON, or fails S13, falls back to the fix line", async () => {
    const note = await newSolution(v10, DEMO_FIX, DEMO_WHY, placeFor("2318", "senior-manager"), "live", {
      client: fakeClient(JSON.stringify({ kind: "note", text: "Nothing on the menu fits this." })).client,
      keyPresent: true,
    });
    expect(note.value.suggestion?.kind).toBe("note");
    expect(note.value.ruleText).toBe(DEMO_FIX);

    for (const bad of [
      "Sure! Here is a rule.",
      JSON.stringify({ ruleText: "Waive the fee, it was our fault.", fact: "repeat", effects: [{ effect: "put-first", step: 21 }] }),
    ]) {
      const out = await newSolution(v10, DEMO_FIX, DEMO_WHY, placeFor("2318", "senior-manager"), "live", {
        client: fakeClient(bad).client,
        keyPresent: true,
      });
      expect(out.source).toBe("fallback");
      expect(out.value.ruleText).toBe(DEMO_FIX);
      expect(out.value.suggestion).toBeNull();
    }
  });

  it("its input is the fix line, the why line and the menu's steps from the pill", async () => {
    const { client, calls } = fakeClient("{}");
    await newSolution(v10, DEMO_FIX, DEMO_WHY, placeFor("2318", "senior-manager"), "live", { client, keyPresent: true });
    const user = calls[0].find((m) => m.role === "user")!.content;
    expect(user).toContain(DEMO_FIX);
    expect(user).toContain(DEMO_WHY);
    for (const n of [...BLOCK_STEPS, ...PUT_FIRST_STEPS]) {
      const step = v10.checklist.find((s) => s.step === n)!;
      expect(user).toContain(`${n}: ${step.text}`);
    }
  });
});

// ---- S14: rank wording checks ----

describe("C6a: rank wording is at most 2 sentences and passes S13 and S14", () => {
  const lead = { label: "Pre-cooling starts too late", reason: "Matched 3 of 4 similar cases.", checkText: "Check the start time." };

  it.each([
    ["three sentences", "One. Two. Three."],
    ["a blocked word", "Unplug the heater first."],
    ["a number the code never said", "Matched 5 of 5 similar cases."],
    ["a rule id the code never said", "TS-CC-09 says so."],
    ["a price", "It costs $200 to fix."],
    ["always blocked", "It is safe to touch."],
  ])("%s fails and only the code reason shows", async (_name, text) => {
    const { client } = fakeClient(text);
    const out = await rankWording(v10, lead, placeFor("2318", "technician"), "live", { client, keyPresent: true });
    expect(out.value).toEqual({ code: lead.reason, aiWording: null });
  });

  it("numbers the code said may be used", async () => {
    const { client } = fakeClient("This matched 3 of 4 similar cases, so check it first.");
    const out = await rankWording(v10, lead, placeFor("2318", "technician"), "live", { client, keyPresent: true });
    expect(out.value.aiWording).toBe("This matched 3 of 4 similar cases, so check it first.");
  });

  it("its input is only the lead's label, code reason and check text", async () => {
    const { client, calls } = fakeClient(GOOD_RANK);
    await rankWording(v10, lead, placeFor("2318", "technician"), "live", { client, keyPresent: true });
    const user = calls[0].find((m) => m.role === "user")!.content;
    expect(user).toBe(`Lead: ${lead.label}\nCode reason: ${lead.reason}\nCheck: ${lead.checkText}`);
  });
});

// ---- The prompts ----

describe("C6a: the prompts live in web/prompts/ so judges can read them", () => {
  it("each job sends its prompt file as the system message", async () => {
    const lead = { label: "L", reason: "Code reason.", checkText: "Check." };
    const seen: Record<string, AiMessage[]> = {};
    const record = (name: string, answer: string) => {
      const f = fakeClient(answer);
      return { deps: { client: f.client, keyPresent: true }, after: () => (seen[name] = f.calls[0]) };
    };
    const r = record("rank-wording", GOOD_RANK);
    await rankWording(v10, lead, placeFor("2318", "technician"), "live", r.deps);
    r.after();
    const t = record("tenant-reply", "Thanks.");
    await tenantReply(v10, TS09_TIPS, VISIT, placeFor("2318", "tenant"), "live", t.deps);
    t.after();
    const n = record("new-solution", "{}");
    await newSolution(v10, DEMO_FIX, DEMO_WHY, placeFor("2318", "senior-manager"), "live", n.deps);
    n.after();

    for (const name of ["rank-wording", "tenant-reply", "new-solution"] as const) {
      const file = readFileSync(join(process.cwd(), "prompts", `${name}.md`), "utf-8");
      expect(loadPrompt(name)).toBe(file);
      expect(seen[name][0]).toEqual({ role: "system", content: file });
    }
  });

  it("tenant-reply.md holds TS-CC-02's limits word for word, read from the pill", () => {
    const rule = v10.rules.find((r) => r.id === "TS-CC-02")!.rule;
    const limits = rule.slice(rule.indexOf("No cause"), rule.indexOf("building settings.") + "building settings.".length);
    expect(limits).toBe("No cause, no blame, no price, no promised date, no comfort range, no building settings.");
    expect(loadPrompt("tenant-reply")).toContain(limits);
    expect(loadPrompt("tenant-reply")).toMatch(/at most 3 sentences/i);
  });

  it("new-solution.md holds the C3c menu as conditions.ts has it", () => {
    const prompt = loadPrompt("new-solution");
    for (const fact of MENU_FACTS) expect(prompt).toContain(fact);
    expect(prompt).toContain(PUT_FIRST_STEPS.join(", "));
    expect(prompt).toMatch(/block step 25/);
    expect(prompt).toContain('"kind": "note"');
    expect(prompt).toContain("1 to 8, 26, 28 or 31");
    expect(prompt).toContain("TS-CC-03, 04, 05, 08 or 26");
  });

  it("rank-wording.md asks for at most 2 sentences", () => {
    expect(loadPrompt("rank-wording")).toMatch(/at most 2 sentences/i);
  });
});

// ---- The Why? chip, worded through the chat route's path ----

describe("C6a: the Why? card gets an AI wording line under its code reason", () => {
  it("the typed Why? card carries its lead's label and check text, read from the ranking", () => {
    const state = memory.read();
    const first = leadsForJob(state, jobOf("2318"), "technician", REAL_NOW).leads[0];
    const card = handleTyped(state, "technician", "why", "2318", REAL_NOW).cards[0];
    expect(card.body).toBe(first.reason);
    expect(card.rankLead).toEqual({ label: first.label, checkText: first.checkText });
  });

  it("live: the AI line is extra, the code reason stays, the receipt shows 1 AI call", async () => {
    const state = memory.read();
    const reply = handleTyped(state, "technician", "why", "2318", REAL_NOW);
    const { client } = fakeClient(GOOD_RANK);
    const [card] = await wordChatCards(reply.cards, { state, seat: "technician", jobId: "2318", mode: "live" }, { client, keyPresent: true });
    expect(card.body).toBe(reply.cards[0].body);
    expect(card.title).toBe(reply.cards[0].title);
    expect(card.aiJob).toBe("rank-wording");
    expect(card.aiWording).toBe(GOOD_RANK);
    expect(card.receipt).toBe("AI calls: 1");
  });

  it("no answer anywhere: the same card with no AI line and AI calls 0", async () => {
    const state = memory.read();
    const reply = handleTyped(state, "technician", "why", "2318", REAL_NOW);
    const [card] = await wordChatCards(reply.cards, { state, seat: "technician", jobId: "2318", mode: "replay" });
    expect(card.body).toBe(reply.cards[0].body);
    expect(card.aiWording).toBeUndefined();
    expect(card.aiBanner).toBeUndefined();
    expect(card.receipt).toBe("AI calls: 0");
  });

  it("Off: the card says AI off and makes no call", async () => {
    const state = memory.read();
    const reply = handleTyped(state, "technician", "why", "2318", REAL_NOW);
    const { client, calls } = fakeClient(GOOD_RANK);
    const [card] = await wordChatCards(reply.cards, { state, seat: "technician", jobId: "2318", mode: "off" }, { client, keyPresent: true });
    expect(calls).toHaveLength(0);
    expect(card.aiOff).toBe("AI off");
    expect(card.aiWording).toBeUndefined();
  });
});

// ---- Item 6: the record path (no Hunyuan in this part) ----

describe("C6a: ai:record's call-and-save path, with a fake client", () => {
  it("ignores REPLAY_MODE, calls the model and saves only the text and its pass flag", async () => {
    expect(process.env.REPLAY_MODE).toBe("1");
    const dir = ownTempDir();
    const lead = { label: "L", reason: "Code reason.", checkText: "Check." };
    const place = placeFor("2318", "technician");
    const spec = rankWordingSpec(v10, lead, place);

    const good = fakeClient(GOOD_RANK);
    expect(await recordAnswer(spec, good.client, { dir, log: () => {} })).toBe("passed");
    expect(good.calls).toHaveLength(1);
    expect(readReplay(spec.key, dir)).toEqual({ text: GOOD_RANK, pass: true });

    const bad = fakeClient("Unplug it.");
    expect(await recordAnswer(spec, bad.client, { dir, log: () => {} })).toBe("failed-checks");
    expect(readReplay(spec.key, dir)).toEqual({ text: "Unplug it.", pass: false });
    rmSync(dir, { recursive: true, force: true });
  });

  it("a recorded answer is what the app finds on Replay: the keys agree", async () => {
    const dir = ownTempDir();
    const lead = { label: "L", reason: "Code reason.", checkText: "Check." };
    const place = placeFor("2318", "technician");
    await recordAnswer(rankWordingSpec(v10, lead, place), fakeClient(GOOD_RANK).client, { dir, log: () => {} });
    const out = await rankWording(v10, lead, place, "replay", { replayDir: dir });
    expect(out.source).toBe("replay");
    expect(out.banner).toBe("replay: saved real AI answer");
    rmSync(dir, { recursive: true, force: true });
  });

  it("an error saves nothing and prints only the status and 'AI unavailable'", async () => {
    const dir = ownTempDir();
    const lines: string[] = [];
    const spec = rankWordingSpec(v10, { label: "L", reason: "R.", checkText: "C." }, placeFor("2318", "technician"));
    const out = await recordAnswer(spec, failingClient(401, `bad key ${SECRET}`).client, { dir, log: (l) => lines.push(l) });
    expect(out).toBe("unavailable");
    expect(lines).toEqual(["401 AI unavailable"]);
    expect(readdirSync(dir)).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });

  it("the demo targets: rank wording for 2318 and 2401 (v1.0 and the fixture), the tenant reply, the new solution", () => {
    const targets = demoRecordTargets({ fixLine: DEMO_FIX, whyLine: DEMO_WHY });
    const jobs = new Set(targets.map((t) => t.spec.aiJob));
    expect(jobs).toEqual(new Set(["rank-wording", "tenant-reply", "new-solution"]));
    expect(new Set(targets.map((t) => t.spec.key)).size).toBe(targets.length);

    // The key for Building B's first lead on v1.0 is the key the app's Building B card asks for.
    const state = memory.read();
    const job = jobOf("2401");
    const first = leadsForJob(state, job, "technician", REAL_NOW).leads[0];
    const appKey = rankWordingSpec(v10, first, { seat: "technician", version: "1.0", job }).key;
    expect(targets.map((t) => t.spec.key)).toContain(appKey);

    // The 2318 visit-booked tips (TS-CC-09) and the demo solution are there.
    const tenantKey = tenantReplySpec(v10, TS09_TIPS, VISIT, placeFor("2318", "tenant")).key;
    expect(targets.map((t) => t.spec.key)).toContain(tenantKey);
    expect(targets.map((t) => t.spec.key)).toContain(newSolutionKey(DEMO_FIX, DEMO_WHY, placeFor("2318", "senior-manager")));

    // 2401 on the fixture (v1.1) is keyed on version 1.1.
    expect(targets.some((t) => t.spec.key.includes("__2401__v1.1__"))).toBe(true);
  });

  it("recordMissing records only what is missing or failed, and counts the rest", async () => {
    const dir = ownTempDir();
    const all = demoRecordTargets({ fixLine: DEMO_FIX, whyLine: DEMO_WHY });
    const targets = all.filter((t) => t.spec.aiJob === "rank-wording").slice(0, 3);
    saveReplay(targets[0].spec.key, { text: GOOD_RANK, pass: true }, dir);
    saveReplay(targets[1].spec.key, { text: "Unplug it.", pass: false }, dir);
    const { client, calls } = fakeClient(GOOD_RANK);
    const counts = await recordMissing(targets, client, { dir, log: () => {} });
    expect(calls).toHaveLength(2);
    expect(counts).toEqual({ passed: 2, failed: 0, unavailable: 0, skipped: 1 });
    rmSync(dir, { recursive: true, force: true });
  });

  it("ai-record.ts imports ai-core.ts, loads the env file with a no-op logger and ignores REPLAY_MODE", () => {
    const src = readFileSync(join(process.cwd(), "scripts", "ai-record.ts"), "utf-8");
    expect(src).toMatch(/from "\.\.\/lib\/ai-core"/);
    expect(src).not.toMatch(/from "\.\.\/lib\/ai"/);
    expect(src).toMatch(/loadEnvConfig\(process\.cwd\(\), false, \{ info\(\) \{\}, error\(\) \{\} \}\)/);
    expect(src).not.toMatch(/REPLAY_MODE/);
    for (const call of src.match(/console\.\w+\([^;]*\);/g) ?? []) {
      expect(call).not.toMatch(/\berr\b|message|headers|BASE_URL|baseURL|API_KEY/);
    }
  });

  it("nothing ai-record.ts imports reaches ai.ts or server-only", () => {
    const seen = new Set<string>();
    const walk = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      const src = codeLines(readFileSync(file, "utf-8")).join("\n");
      expect(src).not.toMatch(/from "server-only"|import "server-only"/);
      for (const m of src.matchAll(/from "(\.{1,2}\/[^"]+)"/g)) {
        const target = resolve(dirname(file), m[1]);
        expect(target).not.toBe(resolve(process.cwd(), "lib", "ai"));
        const withExt = existsSync(`${target}.ts`) ? `${target}.ts` : existsSync(`${target}.tsx`) ? `${target}.tsx` : null;
        if (withExt) walk(withExt);
      }
    };
    walk(join(process.cwd(), "scripts", "ai-record.ts"));
    expect(seen.size).toBeGreaterThan(3);
  });

  it("package.json runs it as npm run ai:record with tsx", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8"));
    expect(pkg.scripts["ai:record"]).toBe("tsx scripts/ai-record.ts");
  });
});

// ---- runAiJob is the one chain every job uses ----

describe("C6a: runAiJob is the one chain, and Off never touches the model or the replay folder", () => {
  it("Off returns the fallback with the AI off label and 0 calls", async () => {
    const { client, calls } = fakeClient("x");
    const out = await runAiJob(
      { aiJob: "rank-wording", key: "k", messages: [], accept: () => "ai", fallback: () => "code" },
      "off",
      { client, keyPresent: true }
    );
    expect(calls).toHaveLength(0);
    expect(out).toMatchObject({ value: "code", source: "off", aiOff: "AI off", aiCalls: 0 });
  });
});
