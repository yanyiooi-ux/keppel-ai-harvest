/**
 * D1 review fixes, the words (no screen here; d1-review-ui.test.tsx has the screens).
 *
 * - The demo's own new solution words (lib/demo-words.ts) still hit the saved
 *   real AI answer in web/data/replay/, read only, so "Use the demo words"
 *   really brings the AI draft on Saved answers.
 * - The words that explain: what "speak first", "pill" and the AI switch mean,
 *   the receipt of a card that shows a saved AI answer, the short forms in a
 *   red stop, the seat labels and the opening line, /how's ranking steps, and
 *   what an effect does to its step. Each is short, plain, and changes only
 *   what a screen shows, never the engine's own line.
 */

import { describe, it, expect } from "vitest";
import { readdirSync } from "fs";
import { join } from "path";
import * as memory from "../lib/memory";
import { actionTurn } from "../lib/action-turn";
import { seatView } from "../lib/seat-view";
import { loadPill } from "../lib/pill";
import { howView } from "../lib/how";
import { SEAT_IDS, SEAT_LABELS } from "../lib/permissions";
import { openingLineFor } from "../lib/seat-opening";
import { REPLAY_BANNER } from "../lib/ai";
import { DEMO_FIX_LINE, DEMO_WHY_LINE } from "../lib/demo-words";
import {
  AI_MODE_HINTS,
  AI_MODE_WORDS,
  BUILDING_B_INTRO,
  GLOSSARY,
  PILL_MEANS,
  SPEAK_FIRST_MEANS,
  effectStepLead,
  glossFor,
  plainOpening,
  rankStepWords,
  receiptWords,
  seatLabelWords,
} from "../lib/plain-words";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");
const v10 = loadPill("ts-cc", "1.0");

/** A sentence a 7th grader reads: 20 words at most, no em dash, no bare acronym except AI. */
function readsPlain(text: string, what: string) {
  for (const sentence of text.split(/(?<=[.:?!])\s+/)) {
    expect(sentence.split(/\s+/).length, `${what}: "${sentence}"`).toBeLessThanOrEqual(20);
  }
  expect(text, what).not.toContain(String.fromCharCode(0x2014));
  const outside = text.replace(/\([^)]*\)/g, "");
  for (const caps of outside.match(/\b[A-Z]{2,}\b/g) ?? []) expect(caps, `${what}: "${text}"`).toBe("AI");
}

describe("D1 review: the demo's own words still hit the saved real AI answer", () => {
  it("Log new solution with lib/demo-words.ts on Saved answers shows the saved AI draft, and the replay folder is untouched", async () => {
    const REPLAY = join(process.cwd(), "data", "replay");
    const before = readdirSync(REPLAY).sort();
    const deps = { replayDir: REPLAY };
    const press = async (seat: string, action: string, jobId?: string, payload?: Record<string, unknown>) => {
      const r = await actionTurn({ seat, action, jobId, payload }, "replay", deps, REAL_NOW);
      expect(r.ok, `${seat} ${action}: ${r.message}`).toBe(true);
      return r;
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
    await press("technician", "tick", "2318", { causeId: "precool", type: "not-this" });
    await press("technician", "tick", "2318", { causeId: "min-airflow", type: "not-this" });
    await press("technician", "not-solved", "2318", { hoursLost: 3, extraVisits: 2, contractorOrPartsNeeded: false });
    await press("senior-manager", "tick", "2318", { causeId: "thermostat-spot", type: "found" });
    await press("senior-manager", "log-new-solution", "2318", { fixLine: DEMO_FIX_LINE, whyLine: DEMO_WHY_LINE });

    const drafted = seatView(memory.read(), "senior-manager", "replay", REAL_NOW, "2318").manager!.open!.solution!;
    expect(drafted.aiBanner).toBe(REPLAY_BANNER);
    expect(drafted.parts.find((p) => p.id === "fact")!.suggested).toBe("fit-out-12m");
    expect(readdirSync(REPLAY).sort()).toEqual(before);
  }, 60_000);
});

describe("D1 review: words that explain", () => {
  it("speak first, pill, the Building B card and the AI switch each say what they mean, in plain words", () => {
    readsPlain(SPEAK_FIRST_MEANS, "speak first");
    expect(SPEAK_FIRST_MEANS).toMatch(/^Speak first means:/);
    expect(SPEAK_FIRST_MEANS).toContain("chief engineer");
    readsPlain(PILL_MEANS, "pill");
    expect(PILL_MEANS).toContain("rule book");
    readsPlain(BUILDING_B_INTRO, "Building B");
    for (const mode of ["live", "replay", "off"] as const) {
      readsPlain(AI_MODE_HINTS[mode], mode);
      expect(AI_MODE_HINTS[mode].startsWith(`${AI_MODE_WORDS[mode]}:`), mode).toBe(true);
    }
    // Replay never reads as a recording: it is the saved real answers, with no new call.
    expect(AI_MODE_WORDS.replay).toBe("Saved answers");
    expect(AI_MODE_HINTS.replay).toContain("No new AI call");
    expect(AI_MODE_HINTS.live).toContain("Hunyuan");
  });

  it("a receipt under a saved AI answer says the answer is shown and counts new calls only", () => {
    expect(receiptWords("Lead · pill v1.0 · AI calls: 0", 1)).toBe(
      "Lead · pill v1.0 · 1 saved AI answer shown, new AI calls: 0"
    );
    expect(receiptWords("Ranked by the same engine. AI calls: 0", 3)).toBe(
      "Ranked by the same engine. 3 saved AI answers shown, new AI calls: 0"
    );
    // No saved answer on the card: the receipt is left exactly as it is.
    expect(receiptWords("Lead · pill v1.0 · AI calls: 0", 0)).toBe("Lead · pill v1.0 · AI calls: 0");
    expect(receiptWords("Red stop RS-04 · pill v1.0 · AI calls: 0", 0)).toBe("Red stop RS-04 · pill v1.0 · AI calls: 0");
  });

  it("every short form in the red stops' own words is in the glossary, and the glossary finds it", () => {
    const stopText = v10.red_stops.flatMap((s) => [s.trigger, s.action, s.who_to_call]).join(" ");
    const used = [...new Set(stopText.match(/\b[A-Z]{2,4}\b/g) ?? [])].filter((c) => c !== "AI" && !/^RS$/.test(c));
    expect(used.length).toBeGreaterThan(0);
    for (const short of used) expect(GLOSSARY[short], short).toBeDefined();
    const rs04 = v10.red_stops.find((s) => s.id === "RS-04")!;
    expect(glossFor(rs04.who_to_call).map((g) => g.short)).toEqual(["LEW", "FM"]);
    expect(glossFor("Nothing short here.")).toEqual([]);
    for (const [short, means] of Object.entries(GLOSSARY)) readsPlain(means, short);
  });

  it("the seat labels and the opening lines read in plain words; the labels and lines themselves are left alone", () => {
    expect(seatLabelWords(SEAT_LABELS.hq)).toBe("Head office (HQ), owner of the rule book: Keppel Technical Services lead (role-played)");
    expect(seatLabelWords(SEAT_LABELS["aom-tower-a"])).toBe(
      "Building manager (AOM), Tower A: Keppel Asset Operations Manager (role-played)"
    );
    for (const seat of SEAT_IDS) expect(seatLabelWords(SEAT_LABELS[seat])).not.toMatch(/pill owner|^AOM,/);
    expect(SEAT_LABELS.hq).toContain("HQ pill owner");
    const sm = openingLineFor("senior-manager").text;
    expect(sm).toContain("the speak-first and low-confidence notices");
    expect(plainOpening(sm)).not.toMatch(/speak-first|low-confidence/);
    expect(plainOpening(sm)).toContain("warnings about spots that keep calling, and notes when Pip is not sure");
    for (const seat of SEAT_IDS) expect(plainOpening(openingLineFor(seat).text)).not.toMatch(/speak-first|low-confidence/);
  });

  it("/how's ranking steps lose their tier codes on screen; the view's own text still has them, so the change bites", () => {
    const steps = howView(memory.read()).rankSteps;
    const order = steps.find((s) => s.name === "Order")!.text;
    const why = steps.find((s) => s.name === "Show why")!.text;
    expect(order).toContain("then low confidence, then net failed.");
    expect(why).toContain("Every lead carries its code reason.");
    expect(rankStepWords(order)).not.toMatch(/low confidence|net failed/);
    expect(rankStepWords(order)).toContain("causes whose past fixes failed more often than they worked");
    expect(rankStepWords(why)).toContain("Every cause says why it is in that spot.");
  });

  it("an effect's step is introduced by what the effect does to it, so block never reads as its opposite", () => {
    expect(effectStepLead("block:25")).toBe("This stops the old step that said:");
    expect(effectStepLead("put-first:21")).toBe("This moves this step to the front:");
    expect(effectStepLead("none")).toBeNull();
  });
});
