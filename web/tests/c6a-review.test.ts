/**
 * C6a review findings (S13, S14, S15, S20).
 *
 * Each block here failed before its fix. Fake clients only: tests/setup.ts
 * keeps the key empty and the network blocked, and tests/setup-replay.ts points
 * the replay folder at an empty temp folder. A test that needs a saved answer
 * writes it into its own temp folder.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  rankWording,
  rankWordingSpec,
  tenantReply,
  newSolution,
  newSolutionSpec,
  saveReplay,
  runAiJob,
  getClient,
  _resetClient,
  type ModelClient,
  type AiMessage,
} from "../lib/ai";
import { scanNeverList } from "../lib/never-list";
import { checkWording } from "../lib/wording-check";
import { handleTyped } from "../lib/chat";
import { wordChatCards, wordLeadsAndCount } from "../lib/ai-wording";
import { leadsForJob } from "../lib/leads";
import { loadPill, type TenantTip } from "../lib/pill";
import * as memory from "../lib/memory";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");
const v10 = loadPill("ts-cc", "1.0");
const SECRET = "FAKE-TEST-SECRET";
const VISIT = "A technician visit is booked.";
const TS09_TIPS: TenantTip[] = v10.tenant_tips.filter((t) => t.rules.includes("TS-CC-09"));
const GOOD_RANK = "This is the best first check for this spot.";

const DEMO_FIX =
  "If the zone had a fit-out in the last 12 months, check where the thermostat sits against the fit-out drawing before any nudge.";
const DEMO_WHY =
  "The fit-out 8 months ago moved the core thermostat next to the new printer bay, so it reads warm and the box keeps cooling the open area.";

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

function live(answer: string | null) {
  return { client: fakeClient(answer).client, keyPresent: true };
}

function ownTempDir(): string {
  return mkdtempSync(join(tmpdir(), "c6a-review-"));
}

function jobOf(id: string) {
  const job = memory.jobById(memory.read(), id);
  if (!job) throw new Error(`no job ${id}`);
  return job;
}

function placeFor(id: string, seat: string) {
  return { seat, version: "1.0", job: jobOf(id) };
}

const TOWER_A_23 = { tenant: "Northwind Advisory", building: "tower-a", floor: 23 };
const BUILDING_B_12 = { tenant: "Meridian Partners", building: "building-b", floor: 12 };

beforeEach(() => {
  memory.resetToSeed(REAL_NOW);
});

// ---- Blocker: never-cross-tenant checked only tenant names, never buildings or floors (S13 items 4 and 10) ----

describe("C6a review: the never-list blocks another building or floor, not just another tenant (S13 item 4)", () => {
  it("with the job's own place, another building or floor is never-cross-tenant", () => {
    for (const text of [
      "The team is also looking at Tower B.",
      "Your neighbours in Building B said the same.",
      "People on Level 12 said the same.",
      "The 5th floor said the same.",
      "Floor 7 is fine.",
      "Blk 5 had the same.",
      "Block C had the same.",
    ]) {
      expect(scanNeverList(v10, text, TOWER_A_23).violated, text).toContain("never-cross-tenant");
    }
    expect(scanNeverList(v10, "Tower A Level 23 had the same.", BUILDING_B_12).violated).toContain("never-cross-tenant");
  });

  it("the job's own building and floor pass, and so do plain words with no name in them", () => {
    for (const text of [
      "Tower A, Level 23, core zone.",
      "The building feels cold on this floor.",
      "I saw it in the building I work in.",
      "Check the BMS trend for ticket 2301.",
      "Block 25 and put step 21 first.",
      "Please do not block a grille.",
    ]) {
      expect(scanNeverList(v10, text, TOWER_A_23).violated, text).not.toContain("never-cross-tenant");
    }
    expect(scanNeverList(v10, "Building B Level 12, core zone.", BUILDING_B_12).violated).not.toContain("never-cross-tenant");
  });

  it("for HQ and the senior manager, both buildings count as their own; for other seats they do not", () => {
    const text = "Building B Level 12 had the same.";
    for (const seat of ["hq", "senior-manager"]) {
      expect(scanNeverList(v10, text, { ...TOWER_A_23, seat }).violated, seat).not.toContain("never-cross-tenant");
      expect(scanNeverList(v10, "Tower C had the same.", { ...TOWER_A_23, seat }).violated, seat).toContain("never-cross-tenant");
    }
    for (const seat of ["tenant", "technician", "aom-tower-a"]) {
      expect(scanNeverList(v10, text, { ...TOWER_A_23, seat }).violated, seat).toContain("never-cross-tenant");
    }
  });

  it("a tenant reply on 2318 that names another building or floor falls back to the tips word for word", async () => {
    for (const text of [
      "Thanks for telling us. The team is also looking at Tower B.",
      "Thanks for telling us. Your neighbours in Building B said the same.",
    ]) {
      const out = await tenantReply(v10, TS09_TIPS, VISIT, placeFor("2318", "tenant"), "live", live(text));
      expect(out.source, text).toBe("fallback");
      expect(out.value.lines).toEqual(TS09_TIPS.map((t) => t.text));
      expect(out.value.aiWording).toBeNull();
    }
  });

  it("rank wording that names another building falls back to the code reason, on 2318 and on Building B's 2401", async () => {
    const state = memory.read();
    const lead2318 = leadsForJob(state, jobOf("2318"), "technician", REAL_NOW).leads[0];
    const a = await rankWording(v10, lead2318, placeFor("2318", "technician"), "live", live("This is the best first check here and in Tower B."));
    expect(a.source).toBe("fallback");
    expect(a.value).toEqual({ code: lead2318.reason, aiWording: null });

    const lead2401 = leadsForJob(state, jobOf("2401"), "technician", REAL_NOW).leads[0];
    const b = await rankWording(v10, lead2401, placeFor("2401", "technician"), "live", live("This is the best first check, as in Tower A."));
    expect(b.source).toBe("fallback");
    expect(b.value.aiWording).toBeNull();

    const ok = await rankWording(v10, lead2401, placeFor("2401", "technician"), "live", live(GOOD_RANK));
    expect(ok.source).toBe("live");
  });

  it("a new solution whose text names another building falls back to the fix line", async () => {
    const answer = JSON.stringify({ kind: "note", text: "Building C had the same thing." });
    const out = await newSolution(v10, DEMO_FIX, DEMO_WHY, placeFor("2318", "senior-manager"), "live", live(answer));
    expect(out.source).toBe("fallback");
    expect(out.value.ruleText).toBe(DEMO_FIX);
    expect(out.value.suggestion).toBeNull();
  });

  it("a typed message naming another building gets the TS-CC-06 refusal card; the senior manager's does not", () => {
    const state = memory.read();
    const tech = handleTyped(state, "technician", "is Building B the same", "2318", REAL_NOW);
    expect(tech.matched).toBe("never-list");
    expect(tech.cards[0].stopId).toBe("RS-10");
    expect(tech.cards[0].receipt).toContain("AI calls: 0");

    const sm = handleTyped(state, "senior-manager", "is Building B the same", "2318", REAL_NOW);
    expect(sm.matched).not.toBe("never-list");
  });
});

// ---- Major: only worded cards and red cards had a receipt (S15 "Each card's receipt shows its AI calls") ----

describe("C6a review: every chat card's receipt shows its AI calls (S1, S15)", () => {
  const asked: [string, string, string | undefined][] = [
    ["technician", "what needs me", "2318"],
    ["technician", "show job", "2318"],
    ["technician", "dial?", "2318"],
    ["technician", "safety", "2318"],
    ["technician", "show job", undefined],
    ["technician", "the VAV box is buzzing", "2318"],
    ["aom-tower-a", "impact", "2318"],
    ["hq", "versions", "2318"],
  ];

  it.each(asked)("%s typing %j: the card's receipt has the pill version and AI calls 0", (seat, text, jobId) => {
    const reply = handleTyped(memory.read(), seat, text, jobId, REAL_NOW);
    expect(reply.cards.length).toBeGreaterThan(0);
    for (const card of reply.cards) {
      expect(card.receipt, `${card.kind} ${card.title ?? card.body}`).toContain("pill v1.0");
      expect(card.receipt).toContain("AI calls: 0");
    }
  });

  it("the Safety list card is never worded and keeps AI calls 0 with a fake client on", async () => {
    const state = memory.read();
    const list = handleTyped(state, "technician", "safety", "2318", REAL_NOW).cards;
    expect(list[0].kind).toBe("safety-list");
    const { client, calls } = fakeClient(GOOD_RANK);
    const out = await wordChatCards(list, { state, seat: "technician", jobId: "2318", mode: "live" }, { client, keyPresent: true });
    expect(calls).toHaveLength(0);
    expect(out[0].receipt).toContain("AI calls: 0");
  });

  it("through the chat path every card that comes back carries its AI calls, worded or not", async () => {
    const state = memory.read();
    const cards = [
      ...handleTyped(state, "technician", "why", "2318", REAL_NOW).cards,
      ...handleTyped(state, "technician", "what needs me", "2318", REAL_NOW).cards,
      ...handleTyped(state, "technician", "dial", "2318", REAL_NOW).cards,
      ...handleTyped(state, "technician", "safety", "2318", REAL_NOW).cards,
    ];
    const out = await wordChatCards(cards, { state, seat: "technician", jobId: "2318", mode: "live" }, live(GOOD_RANK));
    for (const card of out) expect(card.receipt, card.kind).toMatch(/AI calls: \d+/);
    expect(out[0].receipt).toBe("AI calls: 1");
  });
});

// ---- Major: the new solution's key test never called the real code (S15, run rule 5) ----

describe("C6a review: the new solution's free text is keyed by a hash of the exact fix and why lines (S15)", () => {
  it("newSolutionSpec's key: the same lines give the same key, one changed character gives another", () => {
    const place = placeFor("2318", "senior-manager");
    const a = newSolutionSpec(v10, DEMO_FIX, DEMO_WHY, place).key;
    expect(newSolutionSpec(v10, DEMO_FIX, DEMO_WHY, place).key).toBe(a);
    expect(newSolutionSpec(v10, `${DEMO_FIX} `, DEMO_WHY, place).key).not.toBe(a);
    expect(newSolutionSpec(v10, ` ${DEMO_FIX}`, DEMO_WHY, place).key).not.toBe(a);
    expect(newSolutionSpec(v10, DEMO_FIX.toLowerCase(), DEMO_WHY, place).key).not.toBe(a);
    expect(newSolutionSpec(v10, DEMO_FIX, `${DEMO_WHY}!`, place).key).not.toBe(a);
    expect(newSolutionSpec(v10, DEMO_FIX, DEMO_WHY, placeFor("2318", "hq")).key).not.toBe(a);
  });

  it("on Replay the saved answer for the exact lines shows; any change to either line is a mismatch and the fix line shows", async () => {
    const dir = ownTempDir();
    const place = placeFor("2318", "senior-manager");
    const answer = JSON.stringify({
      ruleText: "If the zone had a fit-out in the last 12 months, check the thermostat spot against the drawing first.",
      fact: "fit-out-12m",
      effects: [
        { effect: "block", step: 25 },
        { effect: "put-first", step: 21 },
      ],
    });
    saveReplay(newSolutionSpec(v10, DEMO_FIX, DEMO_WHY, place).key, { text: answer, pass: true }, dir);

    const exact = await newSolution(v10, DEMO_FIX, DEMO_WHY, place, "replay", { replayDir: dir });
    expect(exact.source).toBe("replay");
    expect(exact.banner).toBe("replay: saved real AI answer");
    expect(exact.value.ruleTextFrom).toBe("ai");

    for (const [fix, why] of [
      [`${DEMO_FIX} `, DEMO_WHY],
      [DEMO_FIX.replace("12 months", "12 Months"), DEMO_WHY],
      [DEMO_FIX, `${DEMO_WHY} `],
    ]) {
      const out = await newSolution(v10, fix, why, place, "replay", { replayDir: dir });
      expect(out.source).toBe("fallback");
      expect(out.banner).toBeNull();
      expect(out.value.ruleText).toBe(fix);
      expect(out.value.ruleTextFrom).toBe("fix-line");
      expect(out.value.suggestion).toBeNull();
    }
    rmSync(dir, { recursive: true, force: true });
  });
});

// ---- Major: no test isolated rank wording's 2-sentence limit (S15 table, S14) ----

describe("C6a review: rank wording's limit is 2 sentences, tested on its own", () => {
  const lead = { label: "Pre-cooling starts too late", reason: "Matched 3 of 4 similar cases.", checkText: "Check the start time." };
  const clean3 = "This is a good check. It is quick. Do it first.";
  const clean2 = "This is a good check. Do it first.";

  it("a clean 3-sentence answer fails on the sentence limit alone", () => {
    const code = [lead.label, lead.reason, lead.checkText].join(" ");
    expect(checkWording(clean3, code, "rank").errors).toEqual(["rank wording has 3 sentences, at most 2"]);
    expect(checkWording(clean2, code, "rank").errors).toEqual([]);
  });

  it("through rank-wording, a clean 3-sentence answer shows only the code reason; a clean 2-sentence one shows", async () => {
    const three = await rankWording(v10, lead, placeFor("2318", "technician"), "live", live(clean3));
    expect(three.source).toBe("fallback");
    expect(three.value).toEqual({ code: lead.reason, aiWording: null });

    const two = await rankWording(v10, lead, placeFor("2318", "technician"), "live", live(clean2));
    expect(two.source).toBe("live");
    expect(two.value).toEqual({ code: lead.reason, aiWording: clean2 });
  });
});

// ---- Major: the AI line could change a number that appears elsewhere in the code text (S14) ----

describe("C6a review: the AI line never changes a number (S14)", () => {
  // The 2318 precool reason, as rank.ts writes it.
  const code =
    "cold mornings + core zone: matched 3 of 4 similar cases that stayed fixed; 1 failed fix counts against. Close call, so the quicker check goes first (15 minutes).";

  it.each([
    "Only 1 of 4 similar cases stayed fixed.",
    "It matched 4 of 4 similar cases.",
    "The check takes 4 minutes.",
    "It matched 3 of 4 similar cases, so it goes 1st.",
    "Only one of four similar cases stayed fixed.",
    "It matched 3 of 15 cases.",
    "It matched 3 of 3.",
  ])("%s fails: each number is in the code text, but not saying this", (ai) => {
    const result = checkWording(ai, code, "rank");
    expect(result.passes).toBe(false);
    expect(result.shown).toEqual({ code, aiWording: null });
  });

  it("numbers said the way the code says them still pass", () => {
    for (const ai of [
      "It matched 3 of 4 similar cases.",
      "It matched 3 of 4.",
      "The check takes 15 minutes.",
      "Matched three of four similar cases, and the check takes 15 minutes.",
      "1 failed fix counts against it.",
      "A 15 minute check goes first.",
    ]) {
      expect(checkWording(ai, code, "rank").errors, ai).toEqual([]);
    }
  });

  it("on the Why? card for 2318, a changed number never shows as AI wording", async () => {
    const state = memory.read();
    const reply = handleTyped(state, "technician", "why", "2318", REAL_NOW);
    expect(reply.cards[0].body).toBe(code);
    for (const answer of [
      "Only 1 of 4 similar cases stayed fixed, and the check takes 4 minutes.",
      "It matched 4 of 4 similar cases, so it goes 1st.",
    ]) {
      const [card] = await wordChatCards(reply.cards, { state, seat: "technician", jobId: "2318", mode: "live" }, live(answer));
      expect(card.body).toBe(code);
      expect(card.aiWording, answer).toBeUndefined();
      expect(card.receipt).toBe("AI calls: 1");
    }
  });
});

// ---- Minor: Off never touches the replay folder, tested with a saved answer there ----

describe("C6a review: Off shows no saved answer, even one that would pass", () => {
  it("a passing saved answer in the replay folder is not read on Off", async () => {
    const dir = ownTempDir();
    const lead = { label: "L", reason: "Code reason.", checkText: "Check." };
    const place = placeFor("2318", "technician");
    const spec = rankWordingSpec(v10, lead, place);
    saveReplay(spec.key, { text: GOOD_RANK, pass: true }, dir);
    const { client, calls } = fakeClient(GOOD_RANK);

    const onReplay = await runAiJob(spec, "replay", { client, keyPresent: true, replayDir: dir });
    expect(onReplay.source).toBe("replay");

    const off = await runAiJob(spec, "off", { client, keyPresent: true, replayDir: dir });
    expect(calls).toHaveLength(0);
    expect(off.source).toBe("off");
    expect(off.aiText).toBeNull();
    expect(off.banner).toBeNull();
    expect(off.value).toEqual({ code: lead.reason, aiWording: null });
    rmSync(dir, { recursive: true, force: true });
  });
});

// ---- Minor: the OpenAI SDK retried a failed call twice inside one AI job ----

describe("C6a review: one AI job is one request to the model", () => {
  beforeEach(() => {
    _resetClient();
    vi.stubEnv("LLM_API_KEY", SECRET);
  });
  afterEach(() => {
    _resetClient();
    vi.unstubAllEnvs();
  });

  it("the TokenHub client never retries on its own, so the receipt's AI calls is the real count", () => {
    expect(getClient().maxRetries).toBe(0);
  });
});

// ---- Minor: the chat route's own steps had no test; an unknown seat was answered and stored ----

describe("C6a review: a typed message, through the route's own code", () => {
  it("a worded Why? card is stored with its AI line, and its AI calls are added to the memory's count", async () => {
    const { chatTurn } = await import("../lib/chat-turn");
    const before = memory.read().aiCalls ?? 0;
    const out = await chatTurn({ seat: "technician", text: "why", job: "2318" }, "live", live(GOOD_RANK));
    expect(out.status).toBe(200);
    expect(out.body.ok).toBe(true);
    const card = (out.body as { cards: { aiWording?: string; receipt?: string }[] }).cards[0];
    expect(card.aiWording).toBe(GOOD_RANK);
    expect(card.receipt).toBe("AI calls: 1");

    const after = memory.read();
    expect(after.aiCalls).toBe(before + 1);
    const stored = after.messages.filter((m) => m.seat === "technician" && m.from === "pip").at(-1)!;
    expect((stored.cards as { aiWording?: string }[])[0].aiWording).toBe(GOOD_RANK);
  });

  it("no answer anywhere adds 0 to the count", async () => {
    const { chatTurn } = await import("../lib/chat-turn");
    const before = memory.read().aiCalls ?? 0;
    const out = await chatTurn({ seat: "technician", text: "why", job: "2318" }, "replay");
    expect(out.status).toBe(200);
    expect(memory.read().aiCalls ?? 0).toBe(before);
  });

  it("an unknown seat gets 404, like /api/state, and nothing is stored", async () => {
    const { chatTurn } = await import("../lib/chat-turn");
    const before = JSON.stringify(memory.read().messages);
    const out = await chatTurn({ seat: "bogus", text: "why", job: "2318" }, "live", live(GOOD_RANK));
    expect(out.status).toBe(404);
    expect(out.body).toEqual({ ok: false, message: 'There is no seat called "bogus".' });
    expect(JSON.stringify(memory.read().messages)).toBe(before);
    expect(memory.read().messages.some((m) => m.seat === "bogus")).toBe(false);
  });

  it("a message with no text gets 400", async () => {
    const { chatTurn } = await import("../lib/chat-turn");
    const out = await chatTurn({ seat: "technician" }, "live");
    expect(out.status).toBe(400);
  });
});

// ---- Minor: Building B's rank-wording calls never reached the memory's AI call count (S20) ----

describe("C6a review: Building B's AI calls are counted in the memory (S20)", () => {
  it("3 live calls add 3; no calls add nothing", async () => {
    const before = memory.read().aiCalls ?? 0;
    const state = memory.read();
    const worded = await wordLeadsAndCount(state, jobOf("2401"), "technician", "live", live(GOOD_RANK), REAL_NOW);
    expect(worded.aiCalls).toBe(3);
    expect(worded.items.map((i) => i.lead)).toEqual(leadsForJob(state, jobOf("2401"), "technician", REAL_NOW).leads.slice(0, 3));
    expect(memory.read().aiCalls).toBe(before + 3);

    const none = await wordLeadsAndCount(memory.read(), jobOf("2401"), "technician", "replay", {}, REAL_NOW);
    expect(none.aiCalls).toBe(0);
    expect(memory.read().aiCalls).toBe(before + 3);
  });
});
