import { describe, it, expect } from "vitest";
import { loadTickets, type Ticket } from "../lib/rule-engine";
import { loadPill } from "../lib/pill";
import { loadCauses, type Cause } from "../lib/causes";
import { allCases, type Case } from "../lib/cases";
import { allCalls } from "../lib/places";
import { factsFor, loadBuildings } from "../lib/facts";
import { loadPlaces } from "../lib/places";
import { rankLeads, type RankInput, type RankResult } from "../lib/rank";

const allTickets = loadTickets();
const buildings = loadBuildings();
const places = loadPlaces();
const calls = allCalls({});
const pill = loadPill("ts-cc", "1.0");
const causes = loadCauses().causes;
const everyCase = allCases(calls);
const demoClock = new Date("2026-10-06T10:00:00+08:00");

function getTicket(id: string): Ticket {
  const t = allTickets.find((t) => t.id === id);
  if (!t) throw new Error(`Ticket ${id} not found`);
  return t;
}

function makeInput(
  ticketId: string,
  seat: string,
  ticks: RankInput["ticks"] = [],
  openRedStops: { spotKey: string; id: string }[] = []
): RankInput {
  const job = getTicket(ticketId);
  const facts = factsFor(job, calls, buildings, places);
  return {
    job: { ...job, facts },
    seat,
    livePill: pill,
    causes,
    allCases: everyCase,
    ticks,
    openRedStops,
    now: demoClock,
  };
}

describe("T-C2d: 2318 technician v1.0 no ticks", () => {
  const result = rankLeads(makeInput("2318", "technician"));

  it("leads in order: precool, min-airflow, thermostat-spot", () => {
    expect(result.leads.map((l) => l.causeId)).toEqual([
      "precool",
      "min-airflow",
      "thermostat-spot",
    ]);
  });

  it("precool score 5, W=3, F=1, N=4", () => {
    const precool = result.leads.find((l) => l.causeId === "precool")!;
    expect(precool.score).toBe(5);
    expect(precool.W).toBe(3);
    expect(precool.F).toBe(1);
    expect(precool.N).toBe(4);
  });

  it("precool reason: cold mornings + core zone, matched 3 of 4, close call 15 minutes", () => {
    const precool = result.leads.find((l) => l.causeId === "precool")!;
    expect(precool.reason).toContain("cold mornings + core zone");
    expect(precool.reason).toContain("matched 3 of 4 similar cases that stayed fixed");
    expect(precool.reason).toContain("1 failed fix counts against");
    expect(precool.reason).toContain("Close call, so the quicker check goes first (15 minutes)");
  });

  it("min-airflow score 6, W=3, F=1, N=4", () => {
    const min = result.leads.find((l) => l.causeId === "min-airflow")!;
    expect(min.score).toBe(6);
    expect(min.W).toBe(3);
    expect(min.F).toBe(1);
    expect(min.N).toBe(4);
  });

  it("min-airflow reason: cold mornings + core zone + repeat, matched 3 of 4, no close call", () => {
    const min = result.leads.find((l) => l.causeId === "min-airflow")!;
    expect(min.reason).toContain("cold mornings + core zone + repeat");
    expect(min.reason).toContain("matched 3 of 4 similar cases that stayed fixed");
    expect(min.reason).toContain("1 failed fix counts against");
    expect(min.reason).not.toContain("Close call");
  });

  it("thermostat-spot is low-confidence, only 1 similar case", () => {
    const thermo = result.leads.find((l) => l.causeId === "thermostat-spot")!;
    expect(thermo.tier).toBe("low-confidence");
    expect(thermo.N).toBe(1);
    expect(thermo.reason).toContain("Low confidence, expert rule");
    expect(thermo.reason).toContain("only 1 similar case so far");
  });

  it("removed: setpoint (TS-CC-09), sun-west, capacity, rebalance", () => {
    const removedIds = result.removed.map((r) => r.causeId);
    expect(removedIds).toContain("setpoint");
    expect(removedIds).toContain("sun-west");
    expect(removedIds).toContain("capacity");
    expect(removedIds).toContain("rebalance");
  });

  it("setpoint removed by TS-CC-09", () => {
    const sp = result.removed.find((r) => r.causeId === "setpoint")!;
    expect(sp.reason).toContain("TS-CC-09");
  });

  it("sun-west removed: does not explain too cold", () => {
    const sun = result.removed.find((r) => r.causeId === "sun-west")!;
    expect(sun.reason).toContain("Does not explain too cold");
  });

  it("rebalance removed: the senior manager's check", () => {
    const reb = result.removed.find((r) => r.causeId === "rebalance")!;
    expect(reb.reason).toContain("senior manager");
  });

  it("alertSeniorManager is false (first lead is case-backed)", () => {
    expect(result.alertSeniorManager).toBe(false);
  });
});

describe("T-C2d: 2318 ticks", () => {
  it("after Not this on precool: min-airflow first", () => {
    const result = rankLeads(makeInput("2318", "technician", [
      { causeId: "precool", type: "not-this" },
    ]));
    expect(result.leads[0].causeId).toBe("min-airflow");
  });

  it("after Not this on precool and min-airflow: thermostat-spot first, alertSeniorManager true", () => {
    const result = rankLeads(makeInput("2318", "technician", [
      { causeId: "precool", type: "not-this" },
      { causeId: "min-airflow", type: "not-this" },
    ]));
    expect(result.leads[0].causeId).toBe("thermostat-spot");
    expect(result.leads[0].tier).toBe("low-confidence");
    expect(result.alertSeniorManager).toBe(true);
  });

  it("clear on min-airflow (after Not this on both) brings min-airflow back first", () => {
    const result = rankLeads(makeInput("2318", "technician", [
      { causeId: "precool", type: "not-this" },
      // min-airflow not ticked (clear = undo)
    ]));
    expect(result.leads[0].causeId).toBe("min-airflow");
  });
});

describe("T-C2d: 2401 technician v1.0", () => {
  const result = rankLeads(makeInput("2401", "technician"));

  it("leads: precool, min-airflow, thermostat-spot, setpoint", () => {
    expect(result.leads.map((l) => l.causeId)).toEqual([
      "precool",
      "min-airflow",
      "thermostat-spot",
      "setpoint",
    ]);
  });

  it("setpoint is net-failed: score -3, 2 failed fixes", () => {
    const sp = result.leads.find((l) => l.causeId === "setpoint")!;
    expect(sp.tier).toBe("net-failed");
    expect(sp.score).toBe(-3);
    expect(sp.F).toBe(2);
    expect(sp.reason).toContain("only 2 of 4 similar cases stayed fixed");
    expect(sp.reason).toContain("2 failed fixes count against");
  });
});

describe("T-C2d: senior manager 2318 with two ticks", () => {
  const result = rankLeads(makeInput("2318", "senior-manager", [
    { causeId: "precool", type: "not-this" },
    { causeId: "min-airflow", type: "not-this" },
  ]));

  it("leads: thermostat-spot then rebalance", () => {
    expect(result.leads.map((l) => l.causeId)).toEqual([
      "thermostat-spot",
      "rebalance",
    ]);
  });

  it("rebalance fixAllowedHere is false", () => {
    const reb = result.leads.find((l) => l.causeId === "rebalance")!;
    expect(reb.fixAllowedHere).toBe(false);
  });

  it("rebalance check time shows 2 days", () => {
    const reb = result.leads.find((l) => l.causeId === "rebalance")!;
    expect(reb.checkMinutes).toBe(2880);
  });
});

describe("T-C2d: 2315 capacity removed with Red: out of scope", () => {
  it("capacity is removed with Red: out of scope", () => {
    const result = rankLeads(makeInput("2315", "technician"));
    const cap = result.removed.find((r) => r.causeId === "capacity");
    expect(cap).toBeDefined();
    expect(cap!.reason).toContain("Red: out of scope");
  });
});

describe("T-C2d: rank.ts imports nothing from AI", () => {
  it("rank.ts does not import from ai.ts or ai-core.ts", () => {
    const fs = require("fs");
    const path = require("path");
    const source = fs.readFileSync(
      path.join(process.cwd(), "lib", "rank.ts"),
      "utf-8"
    );
    expect(source).not.toMatch(/from\s+["'].*ai-core["']/);
    expect(source).not.toMatch(/from\s+["']\.\.\/ai["']/);
    expect(source).not.toMatch(/from\s+["']\.\.\/ai-core["']/);
  });
});

describe("T-C2d: same input gives deep-equal output", () => {
  it("two calls with the same input are deep-equal", () => {
    const input = makeInput("2318", "technician");
    const result1 = rankLeads(input);
    const result2 = rankLeads(input);
    expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
  });
});

describe("T-C2d: low confidence with fewer than 3 cases", () => {
  it("a test job with 2 similar decided cases gives low confidence, not percentage", () => {
    // Create a test job with cold-mornings, core-zone, vav (no repeat)
    // and test cases with only 2 decided
    const testJob: Ticket & { facts: string[] } = {
      id: "TEST-LC",
      label: "made up for the demo",
      building: "tower-a",
      buildingName: "Tower A",
      floor: 23,
      tenant: "Test",
      zone: "core",
      complaint: "too cold",
      timeOfDay: "morning",
      complaintHour: "09:00",
      reportedAt: "2026-10-06T09:00:00+08:00",
      intake: { where: "core", when: "morning", sinceWhen: "today" },
      fix: null,
      status: "open",
      previousChangesOnFloor: false,
      facts: ["cold-mornings", "core-zone", "vav"],
    };

    const testCases: Case[] = [
      {
        id: "TC-01",
        building: "Tower X",
        floor: 1,
        zone: "core",
        facts: ["cold-mornings", "core-zone", "vav"],
        cause: "setpoint",
        fix: "test",
        why: "test",
        fixedBy: "technician",
        confirmedBy: "senior-manager",
        closedAt: "2026-01-01T10:00:00+08:00",
        nextCallAt: null,
      },
      {
        id: "TC-02",
        building: "Tower Y",
        floor: 2,
        zone: "core",
        facts: ["cold-mornings", "core-zone", "vav"],
        cause: "setpoint",
        fix: "test",
        why: "test",
        fixedBy: "technician",
        confirmedBy: "senior-manager",
        closedAt: "2026-02-01T10:00:00+08:00",
        nextCallAt: null,
      },
    ];

    const result = rankLeads({
      job: testJob,
      seat: "technician",
      livePill: pill,
      causes,
      allCases: testCases,
      ticks: [],
      openRedStops: [],
      now: demoClock,
    });

    // setpoint should be a lead (no repeat flag, no setpoint changes)
    const sp = result.leads.find((l) => l.causeId === "setpoint");
    expect(sp).toBeDefined();
    if (sp) {
      expect(sp.tier).toBe("low-confidence");
      expect(sp.N).toBe(2);
      expect(sp.reason).toContain("Low confidence");
      expect(sp.reason).not.toContain("%");
    }
  });
});

describe("T-C2d: close groups", () => {
  it("with scores 9 (60 min) and 8 (10 min), the 10-minute check is first", () => {
    // Create two leads with scores 9 and 8, checkMinutes 60 and 10
    // Score 8 is within 2 of score 9, so they form a close group
    // The 10-minute check should go first
    const testJob: Ticket & { facts: string[] } = {
      id: "TEST-CG",
      label: "made up for the demo",
      building: "tower-a",
      buildingName: "Tower A",
      floor: 23,
      tenant: "Test",
      zone: "core",
      complaint: "too cold",
      timeOfDay: "morning",
      complaintHour: "09:00",
      reportedAt: "2026-10-06T09:00:00+08:00",
      intake: { where: "core", when: "morning", sinceWhen: "today" },
      fix: null,
      status: "open",
      previousChangesOnFloor: false,
      facts: ["cold-mornings", "core-zone", "vav"],
    };

    // Create cases to give cause A score 9 and cause B score 8
    // cause A: 3 won cases, weight 3 each = 9
    // cause B: 4 won, 0 failed, weight 2 each = 8
    const testCases: Case[] = [];
    for (let i = 0; i < 3; i++) {
      testCases.push({
        id: `CG-A-${i}`,
        building: "Tower A",
        floor: 1,
        zone: "core",
        facts: ["cold-mornings", "core-zone", "vav"],
        cause: "precool",
        fix: "test",
        why: "test",
        fixedBy: "technician",
        confirmedBy: "senior-manager",
        closedAt: "2026-01-01T10:00:00+08:00",
        nextCallAt: null,
      });
    }
    for (let i = 0; i < 4; i++) {
      testCases.push({
        id: `CG-B-${i}`,
        building: "Tower A",
        floor: 2,
        zone: "core",
        facts: ["cold-mornings", "core-zone"],
        cause: "min-airflow",
        fix: "test",
        why: "test",
        fixedBy: "technician",
        confirmedBy: "senior-manager",
        closedAt: "2026-01-01T10:00:00+08:00",
        nextCallAt: null,
      });
    }

    const result = rankLeads({
      job: testJob,
      seat: "technician",
      livePill: pill,
      causes,
      allCases: testCases,
      ticks: [],
      openRedStops: [],
      now: demoClock,
    });

    const precool = result.leads.find((l) => l.causeId === "precool");
    const minAir = result.leads.find((l) => l.causeId === "min-airflow");
    expect(precool).toBeDefined();
    expect(minAir).toBeDefined();
    if (precool && minAir) {
      expect(precool.score).toBe(9);
      expect(minAir.score).toBe(8);
      // Both are case-backed (N >= 3, score > 0)
      expect(precool.tier).toBe("case-backed");
      expect(minAir.tier).toBe("case-backed");
      // min-airflow has checkMinutes 20, precool has 15
      // precool is quicker, so should be first (both within 2 of score 9)
      expect(result.leads[0].causeId).toBe("precool");
    }
  });

  it("with scores 9 and 6, score order holds (9 first)", () => {
    const testJob: Ticket & { facts: string[] } = {
      id: "TEST-CG2",
      label: "made up for the demo",
      building: "tower-a",
      buildingName: "Tower A",
      floor: 23,
      tenant: "Test",
      zone: "core",
      complaint: "too cold",
      timeOfDay: "morning",
      complaintHour: "09:00",
      reportedAt: "2026-10-06T09:00:00+08:00",
      intake: { where: "core", when: "morning", sinceWhen: "today" },
      fix: null,
      status: "open",
      previousChangesOnFloor: false,
      facts: ["cold-mornings", "core-zone", "vav"],
    };

    // cause A: 3 won, weight 3 = 9
    // cause B: 3 won, weight 2 = 6 (not within 2 of 9, so separate groups)
    const testCases: Case[] = [];
    for (let i = 0; i < 3; i++) {
      testCases.push({
        id: `CG2-A-${i}`,
        building: "Tower A",
        floor: 1,
        zone: "core",
        facts: ["cold-mornings", "core-zone", "vav"],
        cause: "precool",
        fix: "test",
        why: "test",
        fixedBy: "technician",
        confirmedBy: "senior-manager",
        closedAt: "2026-01-01T10:00:00+08:00",
        nextCallAt: null,
      });
    }
    // cause B with weight 2: facts that share only cold-mornings and core-zone (no vav)
    for (let i = 0; i < 3; i++) {
      testCases.push({
        id: `CG2-B-${i}`,
        building: "Tower A",
        floor: 2,
        zone: "core",
        facts: ["cold-mornings", "core-zone"],
        cause: "min-airflow",
        fix: "test",
        why: "test",
        fixedBy: "technician",
        confirmedBy: "senior-manager",
        closedAt: "2026-01-01T10:00:00+08:00",
        nextCallAt: null,
      });
    }

    const result = rankLeads({
      job: testJob,
      seat: "technician",
      livePill: pill,
      causes,
      allCases: testCases,
      ticks: [],
      openRedStops: [],
      now: demoClock,
    });

    expect(result.leads[0].causeId).toBe("precool");
    expect(result.leads[0].score).toBe(9);
  });
});
