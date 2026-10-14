/**
 * C6b, before the first `npm run ai:record` (run rule 12, S0 rule 12, S15).
 *
 * Fake clients only. tests/setup.ts keeps the key empty and the network blocked,
 * and tests/setup-replay.ts points the replay folder at an empty temp folder, so
 * nothing here can reach Hunyuan or web/data/replay/. Every saved answer below
 * goes into the test's own temp folder.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { saveReplay, REPLAY_BANNER, type ModelClient, type AiMessage } from "../lib/ai";
import { demoRecordTargets, recordMissing } from "../lib/ai-demo-targets";
import { wordChatCards, wordLeads } from "../lib/ai-wording";
import { handleTyped } from "../lib/chat";
import type { Tick } from "../lib/rank";
import * as memory from "../lib/memory";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");
const SECRET = "FAKE-TEST-SECRET";

const DEMO_FIX =
  "If the zone had a fit-out in the last 12 months, check where the thermostat sits against the fit-out drawing before any nudge.";
const DEMO_WHY =
  "The fit-out 8 months ago moved the core thermostat next to the new printer bay, so it reads warm and the box keeps cooling the open area.";

/** Passes S13 and S14 for any lead: no number, no rule id, no blocked word. */
const GOOD_RANK = "This is the best first check for this spot.";

function ownTempDir(): string {
  return mkdtempSync(join(tmpdir(), "c6b-record-"));
}

/** Fails the way the OpenAI SDK fails: an error carrying a status, a message, headers and a URL. */
function failingClient(status: number | undefined, message: string) {
  const calls: AiMessage[][] = [];
  const client: ModelClient = {
    async complete(messages) {
      calls.push(messages);
      const err = Object.assign(new Error(message), {
        headers: { authorization: `Bearer ${SECRET}` },
        url: `https://tokenhub.example.invalid/v1?key=${SECRET}`,
      });
      if (status !== undefined) Object.assign(err, { status });
      throw err;
    },
  };
  return { client, calls };
}

beforeEach(() => {
  memory.resetToSeed(REAL_NOW);
});

describe("C6b run rule 12: ai-record's call-and-save path leaks nothing", () => {
  it("a 401 whose message holds a test secret: every line is only '401 AI unavailable', nothing is saved", async () => {
    const dir = ownTempDir();
    const lines: string[] = [];
    const targets = demoRecordTargets({ fixLine: DEMO_FIX, whyLine: DEMO_WHY });
    const { client, calls } = failingClient(401, `invalid key ${SECRET} at https://tokenhub.example.invalid`);

    const counts = await recordMissing(targets, client, { dir, log: (l) => lines.push(l) });

    expect(calls).toHaveLength(targets.length);
    expect(counts).toEqual({ passed: 0, failed: 0, unavailable: targets.length, skipped: 0 });
    expect(lines).toHaveLength(targets.length);
    for (const line of lines) expect(line).toBe("401 AI unavailable");
    expect(lines.join("\n")).not.toMatch(/FAKE-TEST-SECRET|Bearer|http|LLM_|Authorization/i);
    expect(readdirSync(dir)).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });

  it("an error with no status (a dropped connection): every line is only 'AI unavailable'", async () => {
    const dir = ownTempDir();
    const lines: string[] = [];
    const targets = demoRecordTargets({ fixLine: DEMO_FIX, whyLine: DEMO_WHY }, "tenant");
    const { client } = failingClient(undefined, `connect ECONNREFUSED https://tokenhub.example.invalid ${SECRET}`);

    await recordMissing(targets, client, { dir, log: (l) => lines.push(l) });

    expect(lines).toEqual(["AI unavailable"]);
    expect(readdirSync(dir)).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });

  it("every console call in ai-record.ts prints only a fixed phrase, the model id or a count", () => {
    const src = readFileSync(join(process.cwd(), "scripts", "ai-record.ts"), "utf-8");
    const calls = [...src.matchAll(/console\.(\w+)\(([\s\S]*?)\);/g)];
    expect(calls.length).toBeGreaterThan(3);
    const allowed = new Set(["model", "targets.length", "counts.passed", "counts.failed", "counts.unavailable", "counts.skipped"]);
    for (const [, method, args] of calls) {
      expect(method).toBe("log");
      const arg = args.trim();
      // One string or template literal, and nothing else: no err, no object, no env value.
      expect(arg).toMatch(/^(["`])[\s\S]*\1$/);
      for (const m of arg.matchAll(/\$\{([^}]*)\}/g)) expect(allowed.has(m[1].trim())).toBe(true);
    }
    expect(src).not.toMatch(/console\.(error|warn|info|debug|dir)\(/);
    expect(src).not.toMatch(/process\.env/);
  });
});

describe("C6b: the record targets land on the keys the app asks for", () => {
  /** A dir holding a passing answer on every demo target's key. */
  function dirWithEveryTarget(): string {
    const dir = ownTempDir();
    for (const t of demoRecordTargets({ fixLine: DEMO_FIX, whyLine: DEMO_WHY })) {
      saveReplay(t.spec.key, { text: GOOD_RANK, pass: true }, dir);
    }
    return dir;
  }

  const notThis = (causeId: string): Tick => ({ causeId, type: "not-this", seat: "technician" });
  const tickStates: Tick[][] = [[], [notThis("precool")], [notThis("precool"), notThis("min-airflow")]];

  for (const seat of ["technician", "senior-manager"]) {
    it(`2318's "Why?" for the ${seat} finds a saved answer before any tick, after one and after both`, async () => {
      const dir = dirWithEveryTarget();
      for (const ticks of tickStates) {
        const state = memory.read();
        const job = memory.jobById(state, "2318")!;
        job.ticks = ticks;
        const reply = handleTyped(state, seat, "why", "2318", REAL_NOW);
        const cards = await wordChatCards(reply.cards, { state, seat, jobId: "2318", mode: "replay" }, { replayDir: dir });
        const why = cards.find((c) => c.rankLead);
        expect(why, `ticks: ${ticks.map((t) => t.causeId).join(", ") || "none"}`).toBeDefined();
        expect(why!.aiBanner, `${seat}, ticks: ${ticks.map((t) => t.causeId).join(", ") || "none"}`).toBe(REPLAY_BANNER);
      }
      rmSync(dir, { recursive: true, force: true });
    });
  }

  it("the Building B card's 3 leads (2401, technician, v1.0) each find a saved answer", async () => {
    const dir = dirWithEveryTarget();
    const state = memory.read();
    const job = memory.jobById(state, "2401")!;
    const worded = await wordLeads(state, job, "technician", "replay", { replayDir: dir }, REAL_NOW);
    expect(worded.items).toHaveLength(3);
    for (const item of worded.items) expect(item.wording.banner).toBe(REPLAY_BANNER);
    rmSync(dir, { recursive: true, force: true });
  });
});
