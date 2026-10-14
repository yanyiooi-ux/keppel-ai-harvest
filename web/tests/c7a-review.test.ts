/**
 * Review findings for C7a, each pinned before its fix.
 *
 * - A typed red card carries its who_to_call for the "Call:" line (S11) and the
 *   job its Raise this stop press goes to (S19).
 * - Every stamp a press or a typed message writes uses the demo clock (S20).
 * - The tenant reply holds exactly the number of tips S10 names, so an empty
 *   reply can never pass.
 * - A staff press on a job still in the self-check says so.
 *
 * Fake clients only, AI off. Nothing here reads web/data/replay/.
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as memory from "../lib/memory";
import { resetDemo, runAction } from "../lib/actions";
import { actionTurn } from "../lib/action-turn";
import { chatTurn } from "../lib/chat-turn";
import { handleTyped } from "../lib/chat";
import { seatView } from "../lib/seat-view";
import { loadPill } from "../lib/pill";
import { safetyList } from "../lib/safety";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");
const PLUS_3_MIN = new Date("2026-10-06T10:03:00+08:00");
const PLUS_5_MIN = new Date("2026-10-06T10:05:00+08:00");
const AT_20 = new Date("2026-10-06T20:00:00+08:00");
const v10 = loadPill("ts-cc", "1.0");
const whoToCall = (id: string) => safetyList(v10).find((s) => s.id === id)!.who_to_call;

type Card = Record<string, unknown> & { kind: string };

beforeEach(() => {
  resetDemo(REAL_NOW);
});

function tenantCards(): Card[] {
  return memory
    .read()
    .messages.filter((m) => m.seat === "tenant" && m.from === "pip")
    .flatMap((m) => (m.cards ?? []) as Card[]);
}

async function selfCheck(complaint: string, steps: [string, string][], at: Date = REAL_NOW): Promise<string> {
  const report = await actionTurn({ seat: "tenant", action: "report", payload: { complaint } }, "off", {}, at);
  expect(report.ok, report.message).toBe(true);
  const jobId = report.jobId!;
  for (const [questionId, answer] of steps) {
    const r = await actionTurn({ seat: "tenant", action: "answer", jobId, payload: { questionId, answer } }, "off", {}, at);
    expect(r.ok, `${questionId} ${answer}: ${r.message}`).toBe(true);
  }
  return jobId;
}

// ---- Blocker: a typed red card has no Call line and nothing to raise it with ----

describe("C7a review: a typed red card says who to call and which job its Raise this stop is for", () => {
  it("water dripping from the ceiling in the tenant chat: RS-04 with its who_to_call word for word", () => {
    const reply = handleTyped(memory.read(), "tenant", "water dripping from the ceiling", "2318", REAL_NOW);
    const card = reply.cards.find((c) => c.stopId === "RS-04")!;
    expect(card.kind).toBe("red-stop");
    expect(card.call).toBe(whoToCall("RS-04"));
    expect(card.call!.length).toBeGreaterThan(0);
    expect(card.raiseStopId).toBe("RS-04");
    expect(card.jobId).toBe("2318");
  });

  it("several stops matched: each card carries its own who_to_call", () => {
    // T-C3a: "smoking socket" shows RS-01 and RS-03.
    const reply = handleTyped(memory.read(), "tenant", "smoking socket", "2318", REAL_NOW);
    expect(reply.cards.map((c) => c.stopId)).toEqual(["RS-01", "RS-03"]);
    for (const card of reply.cards) {
      expect(card.call).toBe(whoToCall(card.stopId!));
      expect(card.raiseStopId).toBe(card.stopId);
    }
  });

  it("a seat with no job: the card carries no job, so the press attaches to the seat's home spot", () => {
    const reply = handleTyped(memory.read(), "aom-tower-a", "the ceiling is dripping", undefined, REAL_NOW);
    const card = reply.cards.find((c) => c.stopId === "RS-04")!;
    expect(card.call).toBe(whoToCall("RS-04"));
    expect(card.jobId).toBeUndefined();
  });

  it("the stored copy the poll brings keeps the Call line, and the card's own press raises the stop with no second alert", async () => {
    const out = await chatTurn({ seat: "tenant", text: "smoking socket", job: "2318" }, "off");
    expect(out.status).toBe(200);

    const view = seatView(memory.read(), "tenant", "off");
    const stored = view.messages[view.messages.length - 1].cards!;
    expect(stored.map((c) => c.call)).toEqual([whoToCall("RS-01"), whoToCall("RS-03")]);

    const alertsBefore = memory.read().notices.filter((n) => n.kind === "alert").length;
    expect(alertsBefore).toBeGreaterThan(0);
    const rs01 = stored.find((c) => c.stopId === "RS-01")!;
    const press = runAction(
      { seat: "tenant", action: "safety-pick", jobId: rs01.jobId, payload: { stopId: rs01.raiseStopId } },
      REAL_NOW
    );
    expect(press.ok, press.message).toBe(true);

    const after = memory.read();
    expect(after.openRedStops.map((s) => s.stopId)).toEqual(["RS-01"]);
    expect(after.openRedStops[0].lockedJobIds).toContain("2318");
    expect(after.notices.filter((n) => n.kind === "alert")).toHaveLength(alertsBefore);
  });
});

// ---- Minor: stamps used the time of the last Reset, not the demo clock ----

describe("C7a review: every stamp uses the demo clock (S20)", () => {
  it("a Safety pick 5 minutes after Reset stamps its card, its stop and its alerts 10:05", () => {
    const press = runAction({ seat: "tenant", action: "safety-pick", jobId: "2318", payload: { stopId: "RS-04" } }, PLUS_5_MIN);
    expect(press.ok, press.message).toBe(true);

    const state = memory.read();
    const picked = state.messages.filter((m) => m.seat === "tenant" && m.from === "pip");
    expect(picked.map((m) => m.at)).toEqual(["2026-10-06T10:05:00+08:00"]);
    expect(state.openRedStops[0].openedAt).toBe("2026-10-06T10:05:00+08:00");
    const alerts = state.notices.filter((n) => n.kind === "alert");
    expect(alerts.length).toBeGreaterThan(0);
    for (const a of alerts) expect(a.at).toBe("2026-10-06T10:05:00+08:00");
  });

  it("a typed message 3 minutes after Reset stamps the message, Pip's card and the typed alerts 10:03", async () => {
    const out = await chatTurn({ seat: "tenant", text: "the ceiling is dripping", job: "2318" }, "off", undefined, PLUS_3_MIN);
    expect(out.status).toBe(200);

    const state = memory.read();
    const mine = state.messages.filter((m) => m.seat === "tenant");
    expect(mine.map((m) => m.at)).toEqual(["2026-10-06T10:03:00+08:00", "2026-10-06T10:03:00+08:00"]);
    const alerts = state.notices.filter((n) => n.kind === "alert");
    expect(alerts.length).toBeGreaterThan(0);
    for (const a of alerts) expect(a.at).toBe("2026-10-06T10:03:00+08:00");
  });

  it("a pick in the middle of a self-check is never stamped earlier than the answers before it", async () => {
    const at = new Date("2026-10-06T10:07:00+08:00");
    const id = await selfCheck("too cold", [["Q0", "Yes"]], at);
    runAction({ seat: "tenant", action: "safety-pick", jobId: id, payload: { stopId: "RS-04" } }, at);
    const stamps = memory.read().messages.filter((m) => m.seat === "tenant").map((m) => m.at);
    for (const s of stamps) expect(s).toBe("2026-10-06T10:07:00+08:00");
  });
});

// ---- Minor: the tip tests found their expected tips with the code's own filter ----

describe("C7a review: the tenant reply holds the number of tips S10 names", () => {
  it("blinds up: exactly 1 tip, the blinds tip, and the reply is not empty", async () => {
    await selfCheck("too hot", [
      ["Q0", "No"],
      ["Q1", "West glass boardroom"],
      ["Q2", "This week"],
      ["Q3", "No"],
      ["Q4-blinds", "No, they are up"],
    ]);
    const card = tenantCards().at(-1)!;
    expect(card.kind).toBe("tenant-reply");
    expect(card.tips as string[]).toHaveLength(1);
    expect((card.tips as string[])[0]).toContain("lowering the blinds");
    expect(String(card.body).length).toBeGreaterThan(0);
  });

  it("after hours Yes: exactly 1 tip, the after-hours request tip, then the AOM line", async () => {
    await selfCheck(
      "too cold",
      [
        ["Q0", "No"],
        ["Q1", "Somewhere else"],
        ["Q2", "Today"],
        ["Q3", "No"],
        ["Q4-after-hours", "Yes"],
      ],
      AT_20
    );
    const card = tenantCards().at(-1)!;
    expect(card.tips as string[]).toHaveLength(1);
    expect((card.tips as string[])[0]).toContain("after-hours air-con request");
    expect(String(card.body)).toMatch(/after-hours air-con request[\s\S]*The AOM will confirm any cost first\.$/);
  });

  // Every Tower A Level 23 spot has the repeat flag in the demo data, so the
  // one-tip visit reply is reached only through tipsFor (tests/c7a.test.ts).
  it("It keeps coming back: exactly the 2 TS-CC-09 tips, the report tip and the steady-settings tip", async () => {
    await selfCheck("too cold", [
      ["Q0", "No"],
      ["Q1", "Open area near the lift core"],
      ["Q2", "It keeps coming back"],
      ["Q3", "Yes"],
      ["Q4-thermostat", "Yes"],
    ]);
    const tips = tenantCards().at(-1)!.tips as string[];
    expect(tips).toHaveLength(2);
    expect(tips.some((t) => t.includes("note the time and the exact spot"))).toBe(true);
    expect(tips.some((t) => t.includes("keep settings steady"))).toBe(true);
  });
});

// ---- Minor: open-job on a job still in the self-check said "already open" ----

describe("C7a review: a staff press on a job still in the self-check", () => {
  it("open-job says the job is still in the tenant's self-check, not that it is open", async () => {
    const report = await actionTurn({ seat: "tenant", action: "report", payload: { complaint: "too cold" } }, "off", {}, REAL_NOW);
    expect(memory.jobById(memory.read(), report.jobId!)!.status).toBe("self-check");

    const press = runAction({ seat: "technician", action: "open-job", jobId: report.jobId }, REAL_NOW);
    expect(press.ok).toBe(false);
    expect(press.message).toBe("That job is still in the tenant's self-check.");
    expect(press.message).not.toContain("already open");
  });
});
