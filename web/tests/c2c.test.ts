import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { loadTickets, type Ticket } from "../lib/rule-engine";
import { loadCauses } from "../lib/causes";
import { loadPill } from "../lib/pill";
import {
  loadCases,
  casesFromTickets,
  isSimilar,
  similarWeight,
  allCases,
  type Case,
} from "../lib/cases";
import { outcomeOf, pointsFor, outcomeWithPoints } from "../lib/outcome";
import { allCalls } from "../lib/places";
import { factsFor, loadBuildings } from "../lib/facts";
import { loadPlaces } from "../lib/places";

const allTickets = loadTickets();
const buildings = loadBuildings();
const places = loadPlaces();
const calls = allCalls({});
const historyCases = loadCases().cases;
const ticketCases = casesFromTickets(calls);
const everyCase = allCases(calls);

function getTicket(id: string): Ticket {
  const t = allTickets.find((t) => t.id === id);
  if (!t) throw new Error(`Ticket ${id} not found`);
  return t;
}

// Demo clock: 2026-10-06T10:00:00+08:00
const demoClock = new Date("2026-10-06T10:00:00+08:00");

describe("T-C2c: cases.json structure", () => {
  it("has 12 history cases H-01 to H-12", () => {
    expect(historyCases).toHaveLength(12);
    for (let i = 0; i < 12; i++) {
      expect(historyCases[i].id).toBe(`H-${String(i + 1).padStart(2, "0")}`);
    }
  });

  it("is labelled as made up", () => {
    const raw = readFileSync(join(process.cwd(), "data", "cases.json"), "utf-8");
    expect(raw).toContain("made up for the demo");
  });

  it("has no tenant names", () => {
    const raw = readFileSync(join(process.cwd(), "data", "cases.json"), "utf-8");
    expect(raw).not.toContain("Northwind");
  });

  it("all timestamps are +08:00", () => {
    for (const c of historyCases) {
      expect(c.closedAt).toMatch(/\+08:00$/);
      if (c.nextCallAt) {
        expect(c.nextCallAt).toMatch(/\+08:00$/);
      }
    }
  });
});

describe("T-C2c: casesFromTickets", () => {
  it("2301, 2305, 2310, 2315 become setpoint cases", () => {
    const ids = ticketCases.map((c) => c.id);
    expect(ids).toContain("2301");
    expect(ids).toContain("2305");
    expect(ids).toContain("2310");
    expect(ids).toContain("2315");
    for (const c of ticketCases) {
      expect(c.cause).toBe("setpoint");
    }
  });

  it("2318 has no fix, so no case from it", () => {
    expect(ticketCases.find((c) => c.id === "2318")).toBeUndefined();
  });
});

describe("T-C2c: similar case and weight", () => {
  it("isSimilar: same symptom and 2 shared facts is similar", () => {
    const jobFacts = ["cold-mornings", "core-zone", "vav"];
    const caseFacts = ["cold-mornings", "core-zone", "vav"];
    expect(isSimilar(jobFacts, caseFacts)).toBe(true);
  });

  it("isSimilar: same symptom but only 1 shared fact is not similar", () => {
    const jobFacts = ["cold-mornings", "core-zone", "vav"];
    const caseFacts = ["cold-mornings", "east-zone", "fcu"];
    expect(isSimilar(jobFacts, caseFacts)).toBe(false);
  });

  it("isSimilar: different symptom is not similar", () => {
    const jobFacts = ["hot-afternoons", "core-zone", "vav"];
    const caseFacts = ["cold-mornings", "core-zone", "vav"];
    expect(isSimilar(jobFacts, caseFacts)).toBe(false);
  });

  it("similarWeight counts shared facts", () => {
    expect(similarWeight(["cold-mornings", "core-zone", "vav"], ["cold-mornings", "core-zone", "vav"])).toBe(3);
    expect(similarWeight(["cold-mornings", "core-zone", "vav"], ["cold-mornings", "core-zone", "repeat", "vav"])).toBe(3);
  });
});

describe("T-C2c: outcomeOf at demo clock", () => {
  it("2301 ticket case is failed (repeat 2305 at same spot)", () => {
    const c = ticketCases.find((c) => c.id === "2301")!;
    const result = outcomeOf(c, demoClock);
    expect(result.outcome).toBe("failed");
  });

  it("2305 ticket case is failed (repeat 2310 at same spot)", () => {
    const c = ticketCases.find((c) => c.id === "2305")!;
    const result = outcomeOf(c, demoClock);
    expect(result.outcome).toBe("failed");
  });

  it("2310 ticket case is failed (repeat 2315 at same spot)", () => {
    const c = ticketCases.find((c) => c.id === "2310")!;
    const result = outcomeOf(c, demoClock);
    expect(result.outcome).toBe("failed");
  });

  it("2315 ticket case is failed (repeat 2318 at same spot)", () => {
    const c = ticketCases.find((c) => c.id === "2315")!;
    const result = outcomeOf(c, demoClock);
    expect(result.outcome).toBe("failed");
  });

  it("H-06 is failed (nextCallAt within 30 days)", () => {
    const c = historyCases.find((c) => c.id === "H-06")!;
    const result = outcomeOf(c, demoClock);
    expect(result.outcome).toBe("failed");
  });

  it("H-10 is failed (nextCallAt within 30 days)", () => {
    const c = historyCases.find((c) => c.id === "H-10")!;
    const result = outcomeOf(c, demoClock);
    expect(result.outcome).toBe("failed");
  });

  it("H-01 through H-05, H-07, H-08, H-09, H-11, H-12 are won", () => {
    const wonIds = ["H-01", "H-02", "H-03", "H-04", "H-05", "H-07", "H-08", "H-09", "H-11", "H-12"];
    for (const id of wonIds) {
      const c = historyCases.find((c) => c.id === id)!;
      const result = outcomeOf(c, demoClock);
      expect(result.outcome).toBe("won");
    }
  });
});

describe("T-C2c: pending and won transitions", () => {
  it("a case closed 2026-10-06 is pending at 2026-10-20", () => {
    const c: Case = {
      id: "TEST-P",
      building: "Tower A",
      floor: 23,
      zone: "core",
      facts: ["cold-mornings", "core-zone", "vav"],
      cause: "setpoint",
      fix: "test",
      why: "test",
      fixedBy: "technician",
      confirmedBy: "senior-manager",
      closedAt: "2026-10-06T14:00:00+08:00",
      nextCallAt: null,
    };
    const result = outcomeOf(c, new Date("2026-10-20T10:00:00+08:00"));
    expect(result.outcome).toBe("pending");
  });

  it("same case is won at 2026-11-06", () => {
    const c: Case = {
      id: "TEST-P",
      building: "Tower A",
      floor: 23,
      zone: "core",
      facts: ["cold-mornings", "core-zone", "vav"],
      cause: "setpoint",
      fix: "test",
      why: "test",
      fixedBy: "technician",
      confirmedBy: "senior-manager",
      closedAt: "2026-10-06T14:00:00+08:00",
      nextCallAt: null,
    };
    const result = outcomeOf(c, new Date("2026-11-06T14:00:00+08:00"));
    expect(result.outcome).toBe("won");
  });

  it("same case with 2026-10-15 call is failed at 2026-10-20", () => {
    const c: Case = {
      id: "TEST-P",
      building: "Tower A",
      floor: 23,
      zone: "core",
      facts: ["cold-mornings", "core-zone", "vav"],
      cause: "setpoint",
      fix: "test",
      why: "test",
      fixedBy: "technician",
      confirmedBy: "senior-manager",
      closedAt: "2026-10-06T14:00:00+08:00",
      nextCallAt: "2026-10-15T09:00:00+08:00",
    };
    const result = outcomeOf(c, new Date("2026-10-20T10:00:00+08:00"));
    expect(result.outcome).toBe("failed");
  });
});

describe("T-C2c: unconfirmed (fixer confirmed alone)", () => {
  it("fixedBy == confirmedBy is unconfirmed, 0 points", () => {
    const c: Case = {
      id: "TEST-U",
      building: "Tower A",
      floor: 23,
      zone: "core",
      facts: ["cold-mornings", "core-zone", "vav"],
      cause: "setpoint",
      fix: "test",
      why: "test",
      fixedBy: "technician",
      confirmedBy: "technician",
      closedAt: "2026-01-01T10:00:00+08:00",
      nextCallAt: null,
    };
    const result = outcomeOf(c, demoClock);
    expect(result.outcome).toBe("unconfirmed");
    expect(result.points).toBe(0);
  });
});

describe("T-C2c: points", () => {
  it("won = +weight", () => {
    expect(pointsFor("won", 3)).toBe(3);
  });

  it("failed = -weight", () => {
    expect(pointsFor("failed", 3)).toBe(-3);
  });

  it("pending = 0", () => {
    expect(pointsFor("pending", 3)).toBe(0);
  });

  it("unconfirmed = 0", () => {
    expect(pointsFor("unconfirmed", 3)).toBe(0);
  });

  it("outcomeWithPoints: won case with weight 3 gives +3", () => {
    const c: Case = {
      id: "TEST-W",
      building: "Tower A",
      floor: 23,
      zone: "core",
      facts: ["cold-mornings", "core-zone", "vav"],
      cause: "setpoint",
      fix: "test",
      why: "test",
      fixedBy: "technician",
      confirmedBy: "senior-manager",
      closedAt: "2026-01-01T10:00:00+08:00",
      nextCallAt: null,
    };
    const result = outcomeWithPoints(c, demoClock, 3);
    expect(result.outcome).toBe("won");
    expect(result.points).toBe(3);
  });
});

describe("T-C2c: call at building-b/12 never fails tower-a/23 case", () => {
  it("a building-b/12 call does not become nextCallAt for a tower-a/23 case", () => {
    const towerCase = everyCase.find(
      (c) => c.building === "tower-a" && c.floor === 23 && c.id === "2301"
    );
    expect(towerCase).toBeDefined();
    if (towerCase) {
      expect(towerCase.nextCallAt).not.toContain("building-b");
    }
  });
});

describe("T-C2c: causes.json structure", () => {
  it("has 7 causes", () => {
    expect(loadCauses().causes).toHaveLength(7);
  });

  it("rebalance fixSeat is 'none'", () => {
    const rebalance = loadCauses().causes.find((c) => c.id === "rebalance")!;
    expect(rebalance.fixSeat).toBe("none");
  });

  it("thermostat-spot tenantSolution starts with 'Our contractor will move'", () => {
    const thermo = loadCauses().causes.find((c) => c.id === "thermostat-spot")!;
    expect(thermo.tenantSolution.startsWith("Our contractor will move")).toBe(true);
  });
});

describe("T-C2c: trends.json core block replaced", () => {
  it("core block has sensorTemp fields", () => {
    const raw = readFileSync(join(process.cwd(), "data", "trends.json"), "utf-8");
    expect(raw).toContain("sensorTemp");
  });

  it("label and west blocks unchanged", () => {
    const raw = readFileSync(join(process.cwd(), "data", "trends.json"), "utf-8");
    expect(raw).toContain("West glass boardroom");
    expect(raw).toContain("capacity limit");
  });
});
