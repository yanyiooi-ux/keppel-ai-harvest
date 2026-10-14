/**
 * C6b: the saved real AI answers in web/data/replay/ (T-C6b, run rules 6 and 12).
 *
 * Run rule 6: the tests C6b adds may point the replay setting at
 * web/data/replay/, read only. Nothing here writes, deletes or calls Hunyuan:
 * tests/setup.ts keeps the key empty and the network blocked, and every call
 * below is on Replay.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { demoRecordTargets } from "../lib/ai-demo-targets";

const REPLAY = join(process.cwd(), "data", "replay");

/** The demo lines ai-record.ts records the new solution from (S16). */
const DEMO_FIX =
  "If the zone had a fit-out in the last 12 months, check where the thermostat sits against the fit-out drawing before any nudge.";
const DEMO_WHY =
  "The fit-out 8 months ago moved the core thermostat next to the new printer bay, so it reads warm and the box keeps cooling the open area.";

function savedFiles(): string[] {
  return existsSync(REPLAY) ? readdirSync(REPLAY) : [];
}

describe("T-C6b: web/data/replay/ holds answers with text and pass flags only", () => {
  it("holds saved answers", () => {
    expect(savedFiles().length).toBeGreaterThan(0);
  });

  it('no saved file holds "LLM_", "Authorization" or "http"', () => {
    for (const name of savedFiles()) {
      const raw = readFileSync(join(REPLAY, name), "utf-8");
      expect(raw, name).not.toMatch(/LLM_/);
      expect(raw, name).not.toMatch(/authorization/i);
      expect(raw, name).not.toMatch(/http/i);
    }
  });

  it("every file is only { text, pass }, under a demo target's replay key", () => {
    const keys = new Set(demoRecordTargets({ fixLine: DEMO_FIX, whyLine: DEMO_WHY }).map((t) => `${t.spec.key}.json`));
    for (const name of savedFiles()) {
      expect(keys.has(name), name).toBe(true);
      const saved = JSON.parse(readFileSync(join(REPLAY, name), "utf-8")) as Record<string, unknown>;
      expect(Object.keys(saved).sort(), name).toEqual(["pass", "text"]);
      expect(typeof saved.text, name).toBe("string");
      expect(typeof saved.pass, name).toBe("boolean");
    }
  });
});

/**
 * Run rule 12: the tenant reply on Replay, with the same input the record
 * command used (2318's visit-booked TS-CC-09 tips, the code line "A technician
 * visit is booked.", seat tenant, v1.0), should get the banner. After 3 tries
 * the saved answer still failed its checks, so this is an it.todo with its
 * "not recorded" line. The body to put back once a passing answer is recorded
 * (imports: tenantReply and REPLAY_BANNER from ../lib/ai, VISIT_BOOKED_LINE from
 * ../lib/ai-demo-targets, loadPill from ../lib/pill, and ../lib/memory):
 *
 *   memory.resetToSeed(REAL_NOW);
 *   const job = memory.jobById(memory.read(), "2318")!;
 *   const tips = v10.tenant_tips.filter((t) => t.rules.includes("TS-CC-09"));
 *   const out = await tenantReply(v10, tips, VISIT_BOOKED_LINE, { seat: "tenant", version: "1.0", job }, "replay", { replayDir: REPLAY });
 *   expect(out.banner).toBe(REPLAY_BANNER);
 *   expect(out.source).toBe("replay");
 *   expect(out.aiCalls).toBe(0);
 */
describe("C6b run rule 12: the tenant reply on Replay finds the saved real answer", () => {
  it.todo(
    "not recorded: tenant-reply for 2318 (the TS-CC-09 visit-booked tips); after 3 tries the saved answer failed its checks (4 sentences, at most 3)"
  );
});
