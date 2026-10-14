/**
 * C9: the AOM's seat for Tower A. The impact meter (S18) worked out by
 * replaying the tickets, the speak-first flag, the safety alerts, the live
 * version (read only), and the charge decision (A4, S17, cut 9).
 *
 * Every press goes through the real runAction or actionTurn on the per-worker
 * memory file. Nothing reaches the network: the only model client is a fake
 * one, and it is there to prove no charge step calls it.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import * as memory from "../lib/memory";
import { resetDemo, runAction, callsForState } from "../lib/actions";
import { actionTurn, wordJobLeads } from "../lib/action-turn";
import { seatView } from "../lib/seat-view";
import { handleTyped } from "../lib/chat";
import { loadImpactRates, type ImpactRates } from "../lib/impact-rates";
import { impactFor, IMPACT_LABEL } from "../lib/impact";
import { tenantChargeText, CHARGE_CHOICES } from "../lib/charge-flow";
import type { AomDesk } from "../lib/aom-desk";
import type { Ticket } from "../lib/rule-engine";
import type { ModelClient, AiMessage } from "../lib/ai";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");
const AT_20 = new Date("2026-10-06T20:00:00+08:00");

const DEMO_FIX =
  "If the zone had a fit-out in the last 12 months, check where the thermostat sits against the fit-out drawing before any nudge.";
const DEMO_WHY =
  "The fit-out 8 months ago moved the core thermostat next to the new printer bay, so it reads warm and the box keeps cooling the open area.";

const LABEL = "Worked out on made-up demo data. It assumes the cause is found on the visit where the repeat is caught.";

const TENANT_CARD_350 =
  "What we will do: Our contractor will move the wall thermostat back to the spot on your approved fit-out drawing, with your OK. Cost: S$350, made-up demo amount. Approved by the AOM (role-played).";
const TENANT_CARD_NO_CHARGE =
  "What we will do: Our contractor will move the wall thermostat back to the spot on your approved fit-out drawing, with your OK. Cost: no charge to you. Approved by the AOM (role-played).";

const REASON = "Fit-out work is the tenant's own";

beforeEach(() => {
  resetDemo(REAL_NOW);
});

// ---- Helpers ----

function press(seat: string, action: string, jobId?: string, payload?: Record<string, unknown>) {
  const r = runAction({ seat, action, jobId, payload }, REAL_NOW);
  expect(r.ok, `${action}: ${r.message}`).toBe(true);
  return r;
}

function fileTickets(): Ticket[] {
  return JSON.parse(readFileSync(join(process.cwd(), "data", "tickets.json"), "utf-8")) as Ticket[];
}

function aomDesk(realNow: Date = REAL_NOW): AomDesk {
  const desk = seatView(memory.read(), "aom-tower-a", "off", realNow).aom;
  expect(desk).toBeDefined();
  return desk!;
}

function tenantPipMessages() {
  return memory.read().messages.filter((m) => m.seat === "tenant" && m.from === "pip");
}

function a4Requests() {
  return (memory.read().requests as { kind?: string; id: string; status: string; jobId: string }[]).filter(
    (r) => r && r.kind === "A4"
  );
}

/** The C8 steps over the real presses, AI off, to HQ's Approve: the A4 request opens for the AOM. */
async function approved(): Promise<string> {
  const report = press("tenant", "report", undefined, { complaint: "too cold" });
  for (const [questionId, answer] of [
    ["Q0", "No"],
    ["Q1", "Open area near the lift core"],
    ["Q2", "It keeps coming back"],
    ["Q3", "Yes"],
    ["Q4-thermostat", "Not sure"],
  ]) {
    press("tenant", "answer", report.jobId, { questionId, answer });
  }
  press("technician", "open-job", "2318");
  press("technician", "tick", "2318", { causeId: "precool", type: "not-this" });
  press("technician", "tick", "2318", { causeId: "min-airflow", type: "not-this" });
  press("technician", "not-solved", "2318", { hoursLost: 3, extraVisits: 2, contractorOrPartsNeeded: false });
  press("senior-manager", "tick", "2318", { causeId: "thermostat-spot", type: "found" });
  const logged = await actionTurn(
    { seat: "senior-manager", action: "log-new-solution", jobId: "2318", payload: { fixLine: DEMO_FIX, whyLine: DEMO_WHY } },
    "off",
    undefined,
    REAL_NOW
  );
  expect(logged.ok, logged.message).toBe(true);
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
  press("hq", "approve-solution", "2318");
  const open = a4Requests().filter((r) => r.status === "open");
  expect(open).toHaveLength(1);
  return open[0].id;
}

function decide(payload: Record<string, unknown>, seat = "aom-tower-a", jobId: string | undefined = "2318") {
  return runAction({ seat, action: "decide-charge", jobId, payload }, REAL_NOW);
}

function fakeClient(answer: string) {
  const calls: AiMessage[][] = [];
  const client: ModelClient = {
    async complete(messages) {
      calls.push(messages);
      return { content: answer, finish: "stop" };
    },
  };
  return { client, calls };
}

// ---- 1. The impact meter (S18) ----

describe("T-C9: the impact meter shows the S18 numbers for Tower A Level 23, and the label", () => {
  it("before: 5 calls, 5 visits, no senior check, not fixed after 21 days, 4 repeat calls, S$600 and counting", () => {
    const meter = impactFor("tower-a/23", fileTickets(), loadImpactRates())!;
    expect(meter.before).toMatchObject({
      calls: 5,
      visits: 5,
      seniorChecks: 0,
      days: 21,
      daysLine: "not fixed after 21 days",
      repeatCalls: 4,
      cost: 600,
      costLine: "S$600 and counting",
    });
    expect(meter.before.callIds).toEqual(["2301", "2305", "2310", "2315", "2318"]);
  });

  it("with Pill Desk: caught at 2305 on 19 Sep, 2 calls, 2 visits, 1 senior check, 4 days, 1 repeat call, S$420", () => {
    const meter = impactFor("tower-a/23", fileTickets(), loadImpactRates())!;
    expect(meter.withPillDesk).toMatchObject({
      caughtId: "2305",
      caughtOn: "19 Sep",
      calls: 2,
      visits: 2,
      seniorChecks: 1,
      days: 4,
      daysLine: "4 days",
      repeatCalls: 1,
      cost: 420,
      costLine: "S$420",
    });
    expect(meter.withPillDesk!.callIds).toEqual(["2301", "2305"]);
  });

  it("the card always carries the label, word for word, and names its place", () => {
    const meter = impactFor("tower-a/23", fileTickets(), loadImpactRates())!;
    expect(IMPACT_LABEL).toBe(LABEL);
    expect(meter.label).toBe(LABEL);
    expect(meter.place).toBe("Tower A Level 23");
    expect(meter.spotKey).toBe("tower-a/23");
  });

  it("the cost comes from the made-up rates: a visit is 2 hours and a senior check 3 hours, at S$60 an hour", () => {
    const rates = loadImpactRates();
    expect(rates).toMatchObject({ label: "made up for the demo", visitHours: 2, seniorCheckHours: 3, hourlyRateSgd: 60 });
    const meter = impactFor("tower-a/23", fileTickets(), rates)!;
    const visit = rates.visitHours * rates.hourlyRateSgd;
    const senior = rates.seniorCheckHours * rates.hourlyRateSgd;
    expect(meter.before.cost).toBe(meter.before.visits * visit);
    expect(meter.withPillDesk!.cost).toBe(meter.withPillDesk!.visits * visit + senior);
  });

  it("the repeat is caught by computeRepeatFlag with the clock rule: 2301 alone is no repeat", () => {
    const tickets = fileTickets();
    const only2301 = tickets.filter((t) => t.id === "2301");
    const meter = impactFor("tower-a/23", only2301, loadImpactRates())!;
    expect(meter.before).toMatchObject({ calls: 1, visits: 1, days: 0, repeatCalls: 0, cost: 120, costLine: "S$120 and counting" });
    expect(meter.withPillDesk).toBeNull();
  });

  it("a spot with no calls has no meter, and Building B Level 12 (one call, no repeat) has nothing caught", () => {
    expect(impactFor("tower-a/30", fileTickets(), loadImpactRates())).toBeNull();
    const b = impactFor("building-b/12", fileTickets(), loadImpactRates())!;
    expect(b.before).toMatchObject({ calls: 1, visits: 1, repeatCalls: 0, cost: 120 });
    expect(b.place).toBe("Building B Level 12");
    expect(b.withPillDesk).toBeNull();
  });
});

describe("T-C9: changing a date in a temp copy of tickets.json changes the numbers (nothing is hard-coded)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "pill-desk-c9-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function tempCopy(change: (tickets: Ticket[]) => void): Ticket[] {
    const path = join(dir, "tickets.json");
    writeFileSync(path, readFileSync(join(process.cwd(), "data", "tickets.json"), "utf-8"), "utf-8");
    const tickets = JSON.parse(readFileSync(path, "utf-8")) as Ticket[];
    change(tickets);
    writeFileSync(path, JSON.stringify(tickets, null, 2), "utf-8");
    return JSON.parse(readFileSync(path, "utf-8")) as Ticket[];
  }

  it("2301 three days earlier: not fixed after 24 days, and 7 days with Pill Desk", () => {
    const tickets = tempCopy((t) => {
      t.find((x) => x.id === "2301")!.reportedAt = "2026-09-12T09:05:00+08:00";
    });
    const meter = impactFor("tower-a/23", tickets, loadImpactRates())!;
    expect(meter.before.daysLine).toBe("not fixed after 24 days");
    expect(meter.withPillDesk!.days).toBe(7);
    expect(meter.withPillDesk!.caughtId).toBe("2305");
    // The repo's own file is untouched.
    expect(impactFor("tower-a/23", fileTickets(), loadImpactRates())!.before.days).toBe(21);
  });

  it("2305 moved to 1 Aug: it falls out of the run, 4 calls before (S$480 and counting), caught at 2310 on 24 Sep after 9 days", () => {
    const tickets = tempCopy((t) => {
      t.find((x) => x.id === "2305")!.reportedAt = "2026-08-01T15:10:00+08:00";
    });
    const meter = impactFor("tower-a/23", tickets, loadImpactRates())!;
    expect(meter.before).toMatchObject({ calls: 4, visits: 4, repeatCalls: 3, days: 21, cost: 480, costLine: "S$480 and counting" });
    expect(meter.before.callIds).toEqual(["2301", "2310", "2315", "2318"]);
    expect(meter.withPillDesk).toMatchObject({ caughtId: "2310", caughtOn: "24 Sep", calls: 2, days: 9, repeatCalls: 1, cost: 420 });
  });

  it("a changed rate in a temp copy of impact-rates.json changes the cost", () => {
    const path = join(dir, "impact-rates.json");
    const rates = JSON.parse(readFileSync(join(process.cwd(), "data", "impact-rates.json"), "utf-8")) as ImpactRates;
    writeFileSync(path, JSON.stringify({ ...rates, hourlyRateSgd: 70 }), "utf-8");
    const changed = JSON.parse(readFileSync(path, "utf-8")) as ImpactRates;
    const meter = impactFor("tower-a/23", fileTickets(), changed)!;
    expect(meter.before.costLine).toBe("S$700 and counting");
    expect(meter.withPillDesk!.costLine).toBe("S$490");
  });
});

// ---- 2. The AOM's desk (S21's AOM row) ----

describe("C9: the AOM desk on /seat/aom-tower-a", () => {
  it("shows the meter for Tower A Level 23, worked out from the calls in the memory and the rates file", () => {
    const state = memory.read();
    const desk = aomDesk();
    expect(desk.meter).toEqual(impactFor("tower-a/23", callsForState(state), loadImpactRates()));
    expect(desk.meter!.before.costLine).toBe("S$600 and counting");
    expect(desk.meter!.withPillDesk!.costLine).toBe("S$420");
  });

  it("T-C9: the speak-first flag shows for Tower A Level 23, in the notice's own words, and only for Tower A", () => {
    const desk = aomDesk();
    expect(desk.speakFirst).toHaveLength(1);
    expect(desk.speakFirst[0].spotKey).toBe("tower-a/23");
    expect(desk.speakFirst[0].place).toBe("Tower A Level 23");
    expect(desk.speakFirst[0].text).toBe(
      "Speak first: Tower A Level 23 has called 5 times in 30 days, with opposite fixes (repeat flag, TS-CC-09). Quick fixes are off for this spot. Find the cause before they call again."
    );
    expect(desk.speakFirst.every((f) => f.spotKey.startsWith("tower-a/"))).toBe(true);
  });

  it("the speak-first flag goes once its notice is more than 30 days old on the demo clock", () => {
    const later = new Date(REAL_NOW.getTime() + 31 * 24 * 60 * 60 * 1000);
    expect(aomDesk(later).speakFirst).toEqual([]);
  });

  it("safety alerts for Tower A: a red stop raised on Tower A Level 23 shows as an alert and as open now", () => {
    expect(aomDesk().alerts).toEqual([]);
    expect(aomDesk().openStops).toEqual([]);
    press("aom-tower-a", "safety-pick", undefined, { stopId: "RS-04" });
    const desk = aomDesk();
    expect(desk.alerts.length).toBeGreaterThan(0);
    expect(desk.alerts[0].text.startsWith("Red stop on Tower A, Level 23")).toBe(true);
    expect(desk.alerts[0].stopId).toBe("RS-04");
    expect(desk.openStops).toEqual(["RS-04 on Level 23"]);
  });

  it("the live version in Tower A, read only: v1.0 with A1's line, then v1.1 after HQ approves", async () => {
    expect(aomDesk().live.version).toBe("1.0");
    expect(aomDesk().live.line).toMatch(/^v1\.0 · [0-9a-f]{7} · signed by two senior experts \(role-played\)$/);
    await approved();
    const live = aomDesk().live;
    expect(live.version).toBe("1.1");
    expect(live.line).toMatch(/^v1\.1 · [0-9a-f]{7} · approved by HQ pill owner \(role-played\) · parent v1\.0$/);
  });

  it("reading the desk writes nothing to the memory", () => {
    const path = process.env.PILL_DESK_STATE_FILE!;
    const before = readFileSync(path, "utf-8");
    aomDesk();
    seatView(memory.read(), "aom-tower-a", "live", REAL_NOW);
    expect(readFileSync(path, "utf-8")).toBe(before);
  });

  it("the Not solved impact record reaches the AOM with its cost (S3), in the desk and not as a chat message", () => {
    expect(aomDesk().impactRecords).toEqual([]);
    press("technician", "open-job", "2318");
    press("technician", "tick", "2318", { causeId: "precool", type: "not-this" });
    press("technician", "tick", "2318", { causeId: "min-airflow", type: "not-this" });
    press("technician", "not-solved", "2318", { hoursLost: 3, extraVisits: 2, contractorOrPartsNeeded: false });
    expect(aomDesk().impactRecords).toEqual([
      {
        jobId: "2318",
        line: "Impact record: 3 hours lost, 2 extra visits, contractor or parts needed: no. Cost: S$420 (made-up rates: S$60 an hour, a visit is 2 hours).",
      },
    ]);
    expect(memory.read().messages.filter((m) => m.seat === "aom-tower-a")).toEqual([]);
  });

  it("the AOM seat shows no desk on any other seat", () => {
    for (const seat of ["tenant", "technician", "senior-manager", "hq"]) {
      expect(seatView(memory.read(), seat, "off", REAL_NOW).aom).toBeUndefined();
    }
  });
});

// ---- 3. Charge requests and Decide charge (A4, S17, cut 9) ----

describe("C9: the charge request on the AOM desk", () => {
  it("no request before HQ approves; after Approve it shows open, word for word, with no amount", async () => {
    expect(aomDesk().charges).toEqual([]);
    const id = await approved();
    const charges = aomDesk().charges;
    expect(charges).toHaveLength(1);
    expect(charges[0]).toMatchObject({ id, jobId: "2318", open: true, statusWord: "Waits on you", colour: "amber" });
    expect(charges[0].text).toBe(
      'Tenant will hear: "Our contractor will move the wall thermostat back to the spot on your approved fit-out drawing, with your OK." This is work on the tenant\'s fit-out (TS-CC-11). Who pays?'
    );
    expect(charges[0].receipt).toContain("AI calls: 0");
    expect(JSON.stringify(charges[0])).not.toMatch(/S\$|\bSGD\b|dollar/i);
  });

  it("the three choices are S17's, in order", () => {
    expect(CHARGE_CHOICES.map((c) => c.label)).toEqual(["Tenant pays", "Landlord pays", "Goodwill, no charge"]);
    expect(CHARGE_CHOICES.map((c) => c.id)).toEqual(["tenant-pays", "landlord-pays", "goodwill"]);
  });
});

describe("T-C9: Decide charge is the AOM's only", () => {
  it("every other seat is refused, and nothing changes", async () => {
    const id = await approved();
    const before = JSON.stringify(memory.read());
    for (const seat of ["tenant", "technician", "senior-manager", "hq"]) {
      const r = decide({ requestId: id, choice: "tenant-pays", amount: 350, reason: REASON }, seat);
      expect(r.ok).toBe(false);
      expect(r.message).toBe("Only the AOM decides a charge (A4).");
    }
    expect(JSON.stringify(memory.read())).toBe(before);
  });

  it("with no open request it is refused with a plain reason", () => {
    const r = decide({ choice: "landlord-pays", reason: REASON });
    expect(r.ok).toBe(false);
    expect(r.message).toBe("There is no open charge request on job 2318 (A4).");
    const unknown = decide({ requestId: "A4-9", choice: "landlord-pays", reason: REASON }, "aom-tower-a", undefined);
    expect(unknown.ok).toBe(false);
    expect(unknown.message).toBe('There is no open charge request called "A4-9" (A4).');
  });
});

describe("T-C9: Tenant pays needs a whole number from 1 to 100000 and a reason of 3 words or more", () => {
  const refusedAmounts: unknown[] = [0, -5, 100001, 350.5, "350", null, undefined, Number.NaN];

  it.each(refusedAmounts.map((a) => [a]))("amount %j is refused, and nothing changes", async (amount) => {
    const id = await approved();
    const before = JSON.stringify(memory.read());
    const r = decide({ requestId: id, choice: "tenant-pays", amount, reason: REASON });
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Tenant pays needs a whole-number amount from 1 to 100000, typed in the number field.");
    expect(JSON.stringify(memory.read())).toBe(before);
  });

  it("1 and 100000 are taken", async () => {
    const id = await approved();
    expect(decide({ requestId: id, choice: "tenant-pays", amount: 100000, reason: REASON }).ok).toBe(true);
    resetDemo(REAL_NOW);
    const again = await approved();
    expect(decide({ requestId: again, choice: "tenant-pays", amount: 1, reason: REASON }).ok).toBe(true);
  });

  it("a reason under 3 words is refused, and nothing changes", async () => {
    const id = await approved();
    const before = JSON.stringify(memory.read());
    for (const reason of [undefined, "", "tenant fit-out", "   two   words  "]) {
      const r = decide({ requestId: id, choice: "tenant-pays", amount: 350, reason });
      expect(r.ok).toBe(false);
      expect(r.message).toBe("Decide charge needs a reason of 3 words or more.");
    }
    expect(JSON.stringify(memory.read())).toBe(before);
  });

  it("an amount typed in the reason is refused: the amount goes only in the number field", async () => {
    const id = await approved();
    const r = decide({ requestId: id, choice: "tenant-pays", amount: 350, reason: "Agreed S$350 with the tenant" });
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Leave the amount out of the reason: it goes only in the number field.");
  });

  it("a choice that is not one of the three is refused", async () => {
    const id = await approved();
    for (const choice of [undefined, "split", "Tenant pays"]) {
      const r = decide({ requestId: id, choice, amount: 350, reason: REASON });
      expect(r.ok).toBe(false);
      expect(r.message).toBe("Pick who pays: Tenant pays, Landlord pays, or Goodwill, no charge.");
    }
  });
});

describe("T-C9: after a test decision of 350 on 2318, the tenant gets exactly this code card, and nothing before", () => {
  it("nothing reaches the tenant before the decision: no solution, no amount", async () => {
    const id = await approved();
    expect(id).toBeTruthy();
    const tenant = JSON.stringify(seatView(memory.read(), "tenant", "off", REAL_NOW));
    expect(tenant).not.toContain("What we will do");
    expect(tenant).not.toContain("Our contractor will move the wall thermostat");
    expect(tenant).not.toMatch(/S\$|\bSGD\b|dollar|cents/i);
  });

  it("Tenant pays 350: one new card in the tenant chat, word for word, from code", async () => {
    const id = await approved();
    const before = tenantPipMessages().length;
    const r = decide({ requestId: id, choice: "tenant-pays", amount: 350, reason: REASON });
    expect(r.ok, r.message).toBe(true);

    const after = tenantPipMessages();
    expect(after).toHaveLength(before + 1);
    const message = after[after.length - 1];
    expect(message.text).toBe(TENANT_CARD_350);
    const cards = message.cards as { kind: string; body: string; receipt: string; aiJob?: string }[];
    expect(cards).toHaveLength(1);
    expect(cards[0].body).toBe(TENANT_CARD_350);
    expect(cards[0].kind).toBe("charge-decision");
    expect(cards[0].receipt).toContain("AI calls: 0");
    expect(cards[0].aiJob).toBeUndefined();

    const shown = seatView(memory.read(), "tenant", "live", REAL_NOW).messages;
    expect(shown[shown.length - 1].cards![0].body).toBe(TENANT_CARD_350);
    expect(
      tenantChargeText(
        "Our contractor will move the wall thermostat back to the spot on your approved fit-out drawing, with your OK.",
        "tenant-pays",
        350
      )
    ).toBe(TENANT_CARD_350);
  });

  it("the request is decided, with the choice, the amount, the reason, who and when; the AOM desk shows it", async () => {
    const id = await approved();
    decide({ requestId: id, choice: "tenant-pays", amount: 350, reason: REASON });
    const request = a4Requests().find((r) => r.id === id) as unknown as Record<string, unknown>;
    expect(request).toMatchObject({
      status: "decided",
      decision: { choice: "tenant-pays", amount: 350, reason: REASON, decidedBy: "aom-tower-a", decidedAt: "2026-10-06T10:00:00+08:00" },
    });
    const card = aomDesk().charges[0];
    expect(card).toMatchObject({ open: false, statusWord: "Decided", colour: "green" });
    expect(card.decision).toMatchObject({ choiceLabel: "Tenant pays", costLine: "S$350, made-up demo amount", reason: REASON });
    expect(card.decision!.byLine).toBe("Decided by AOM, Tower A: Keppel Asset Operations Manager (role-played), 6 Oct, 10:00");
    expect(card.tenantCard).toBe(TENANT_CARD_350);
  });

  it('Landlord pays and Goodwill each say "no charge to you", and keep no amount', async () => {
    for (const choice of ["landlord-pays", "goodwill"]) {
      resetDemo(REAL_NOW);
      const id = await approved();
      const r = decide({ requestId: id, choice, amount: 350, reason: REASON });
      expect(r.ok, r.message).toBe(true);
      const last = tenantPipMessages().at(-1)!;
      expect(last.text).toBe(TENANT_CARD_NO_CHARGE);
      const request = a4Requests().find((x) => x.id === id) as unknown as { decision: Record<string, unknown> };
      expect(request.decision.amount).toBeUndefined();
      expect(request.decision.choice).toBe(choice);
    }
  });

  it("Goodwill needs a reason", async () => {
    const id = await approved();
    const r = decide({ requestId: id, choice: "goodwill" });
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Decide charge needs a reason of 3 words or more.");
    expect(a4Requests()[0].status).toBe("open");
  });

  it("a decided request cannot be decided again, and the tenant gets no second card", async () => {
    const id = await approved();
    expect(decide({ requestId: id, choice: "tenant-pays", amount: 350, reason: REASON }).ok).toBe(true);
    const count = tenantPipMessages().length;
    const again = decide({ requestId: id, choice: "goodwill", reason: REASON });
    expect(again.ok).toBe(false);
    expect(again.message).toBe(`Charge request ${id} is already decided (A4).`);
    expect(tenantPipMessages()).toHaveLength(count);
  });

  it("the job finds its open request without a request id", async () => {
    await approved();
    const r = decide({ choice: "landlord-pays", reason: REASON });
    expect(r.ok, r.message).toBe(true);
    expect(tenantPipMessages().at(-1)!.text).toBe(TENANT_CARD_NO_CHARGE);
  });
});

describe("T-C9: no AI call is made for any charge step", () => {
  it("Decide charge on Live with a fake client: 0 calls, the AI count unchanged", async () => {
    const id = await approved();
    const { client, calls } = fakeClient("Any words at all.");
    const aiBefore = memory.read().aiCalls ?? 0;
    const r = await actionTurn(
      { seat: "aom-tower-a", action: "decide-charge", jobId: "2318", payload: { requestId: id, choice: "tenant-pays", amount: 350, reason: REASON } },
      "live",
      { client, keyPresent: true },
      REAL_NOW
    );
    expect(r.ok, r.message).toBe(true);
    expect(calls).toHaveLength(0);
    expect(memory.read().aiCalls ?? 0).toBe(aiBefore);
    expect(tenantPipMessages().at(-1)!.text).toBe(TENANT_CARD_350);
  });

  it("a refused Decide charge on Live calls nothing either", async () => {
    const id = await approved();
    const { client, calls } = fakeClient("Any words at all.");
    const r = await actionTurn(
      { seat: "aom-tower-a", action: "decide-charge", jobId: "2318", payload: { requestId: id, choice: "tenant-pays", amount: 0, reason: REASON } },
      "live",
      { client, keyPresent: true },
      REAL_NOW
    );
    expect(r.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("the AI never sees the amount: no prompt made after the decision holds it", async () => {
    const id = await approved();
    decide({ requestId: id, choice: "tenant-pays", amount: 4321, reason: REASON });
    const { client, calls } = fakeClient("Check this lead before the others.");
    await wordJobLeads("2401", "technician", "live", { client, keyPresent: true }, REAL_NOW);
    await wordJobLeads("2318", "senior-manager", "live", { client, keyPresent: true }, REAL_NOW);
    // A tenant self-check that ends with a tip makes a tenant-reply call.
    const report = await actionTurn({ seat: "tenant", action: "report", payload: { complaint: "too hot" } }, "live", { client, keyPresent: true }, REAL_NOW);
    expect(report.ok, report.message).toBe(true);
    for (const [questionId, answer] of [
      ["Q0", "No"],
      ["Q1", "West glass boardroom"],
      ["Q2", "Today"],
      ["Q3", "No"],
      ["Q4-blinds", "No, they are up"],
    ]) {
      const r = await actionTurn(
        { seat: "tenant", action: "answer", jobId: report.jobId, payload: { questionId, answer } },
        "live",
        { client, keyPresent: true },
        REAL_NOW
      );
      expect(r.ok, `${questionId}: ${r.message}`).toBe(true);
    }
    expect(calls.length).toBeGreaterThan(0);
    const prompts = JSON.stringify(calls);
    expect(prompts).not.toContain("4321");
    expect(prompts).not.toMatch(/S\$|made-up demo amount/);
  });
});

// ---- 4. The after-hours request (S10, S17) ----

describe("C9: the after-hours charge request (S10)", () => {
  function afterHours(): { id: string; jobId: string } {
    const report = runAction({ seat: "tenant", action: "report", payload: { complaint: "too cold" } }, AT_20);
    expect(report.ok, report.message).toBe(true);
    for (const [questionId, answer] of [
      ["Q0", "No"],
      ["Q1", "Somewhere else"],
      ["Q2", "Today"],
      ["Q3", "No"],
      ["Q4-after-hours", "Yes"],
    ]) {
      const r = runAction({ seat: "tenant", action: "answer", jobId: report.jobId, payload: { questionId, answer } }, AT_20);
      expect(r.ok, r.message).toBe(true);
    }
    const open = a4Requests().filter((r) => r.status === "open");
    expect(open).toHaveLength(1);
    return { id: open[0].id, jobId: open[0].jobId };
  }

  it("shows on the AOM desk and can be decided; the tenant gets one code card with the cost and the AOM's approval", () => {
    const { id, jobId } = afterHours();
    expect(aomDesk(AT_20).charges[0]).toMatchObject({ id, jobId, open: true, text: "After-hours air-con for Northwind Advisory, Level 23" });
    const before = tenantPipMessages().length;
    const r = runAction(
      { seat: "aom-tower-a", action: "decide-charge", jobId, payload: { requestId: id, choice: "landlord-pays", reason: REASON } },
      AT_20
    );
    expect(r.ok, r.message).toBe(true);
    const after = tenantPipMessages();
    expect(after).toHaveLength(before + 1);
    const text = after[after.length - 1].text;
    expect(text.startsWith("What we will do: ")).toBe(true);
    expect(text.endsWith(" Cost: no charge to you. Approved by the AOM (role-played).")).toBe(true);
  });

  it.todo(
    'QUESTION C9: S17 says the tenant\'s card is "What we will do: {tenantSolution} Cost: ...", and S10 opens an A4 request for after-hours air-con, but no tenantSolution exists for it. Built for now: "What we will do: After-hours air-con for Northwind Advisory, Level 23." (the request\'s own words). What should the tenant hear?'
  );
});

// ---- 5. What needs me and the Impact chip (S19) ----

describe("C9: What needs me and the Impact chip on the AOM seat", () => {
  it("What needs me lists an open charge request and drops it once decided", async () => {
    const id = await approved();
    const open = handleTyped(memory.read(), "aom-tower-a", "what needs me", undefined, REAL_NOW).cards[0];
    expect(open.body).toContain("Tenant will hear:");
    decide({ requestId: id, choice: "goodwill", reason: REASON });
    const done = handleTyped(memory.read(), "aom-tower-a", "what needs me", undefined, REAL_NOW).cards[0];
    expect(done.body).not.toContain("Tenant will hear:");
    expect(done.body).toContain("v1.1 is live in every building (role-played approval by HQ).");
  });

  it("Impact with no job answers with the meter for Tower A Level 23, code only", () => {
    const reply = handleTyped(memory.read(), "aom-tower-a", "impact", undefined, REAL_NOW);
    expect(reply.matched).toBe("chip");
    const card = reply.cards[0];
    expect(card.title).toBe("Impact: Tower A Level 23");
    expect(card.body).toBe(
      [
        "Before: 5 calls, 5 visits, 0 senior manager checks, not fixed after 21 days, 4 repeat calls, S$600 and counting.",
        "With Pill Desk: caught at 2305 on 19 Sep. 2 calls, 2 visits, 1 senior manager check, 4 days, 1 repeat call, S$420.",
        LABEL,
      ].join("\n")
    );
    expect(card.receipt).toContain("AI calls: 0");
  });

  it("Impact on a job with an impact record adds the record and its cost", () => {
    press("technician", "open-job", "2318");
    press("technician", "tick", "2318", { causeId: "precool", type: "not-this" });
    press("technician", "tick", "2318", { causeId: "min-airflow", type: "not-this" });
    press("technician", "not-solved", "2318", { hoursLost: 3, extraVisits: 2, contractorOrPartsNeeded: false });
    const card = handleTyped(memory.read(), "aom-tower-a", "impact", "2318", REAL_NOW).cards[0];
    expect(card.body!.split("\n").at(-1)).toBe(
      "Job 2318's impact record: 3 hours lost, 2 extra visits, contractor or parts needed: no. Cost: S$420 (made-up rates: S$60 an hour, a visit is 2 hours)."
    );
  });
});
