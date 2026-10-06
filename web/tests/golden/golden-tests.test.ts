import { describe, it, expect } from "vitest";
import { loadPill } from "../../lib/pill";
import {
  loadTickets,
  computeRepeatFlag,
  checkRedStop,
  checkNeverList,
  canNudge,
  type Ticket,
} from "../../lib/rule-engine";

const pill = loadPill("ts-cc", "1.0");
const allTickets = loadTickets();

// Helper: find a ticket by id
function getTicket(id: string): Ticket {
  const t = allTickets.find((t) => t.id === id);
  if (!t) throw new Error(`Ticket ${id} not found`);
  return t;
}

// Helper: the demo "now" is 2026-10-06T09:30:00+08:00
const demoNow = new Date("2026-10-06T09:30:00+08:00");

describe("Golden tests", () => {
  describe("GT-01: First complaint, green nudge allowed in v1.0", () => {
    it("ticket 2301 gets the green nudge, not blocked by fit-out", () => {
      const ticket = getTicket("2301");
      const repeat = computeRepeatFlag(allTickets, ticket, new Date("2026-09-15T09:30:00+08:00"));
      expect(repeat.isRepeat).toBe(false);
      expect(repeat.count).toBe(1);

      const red = checkRedStop(pill, {});
      expect(red.isRed).toBe(false);

      const nudge = canNudge(repeat, red, {
        hadSetpointChangeInLast30Days: false,
        changeAmount: 1,
        isAiMakingChange: false,
        pillVersion: "1.0",
      });
      expect(nudge.allowed).toBe(true);
      expect(nudge.ruleIds).toContain("TS-CC-21");
    });
  });

  describe("GT-02: 5th complaint, repeat flag ON, no nudge", () => {
    it("ticket 2318 turns the repeat flag on", () => {
      const ticket = getTicket("2318");
      const repeat = computeRepeatFlag(allTickets, ticket, demoNow);
      expect(repeat.isRepeat).toBe(true);
      expect(repeat.count).toBeGreaterThanOrEqual(2);
      expect(repeat.relatedRuleIds).toContain("TS-CC-09");

      const red = checkRedStop(pill, {});
      expect(red.isRed).toBe(false);

      const nudge = canNudge(repeat, red, {
        hadSetpointChangeInLast30Days: false,
        changeAmount: 1,
        isAiMakingChange: false,
        pillVersion: "1.0",
      });
      expect(nudge.allowed).toBe(false);
      expect(nudge.ruleIds).toContain("TS-CC-09");
    });
  });

  describe("GT-03: Burning smell at grille, red stop", () => {
    it("burning smell triggers a red stop", () => {
      const red = checkRedStop(pill, { hasBurningSmell: true });
      expect(red.isRed).toBe(true);
      expect(red.relatedRuleIds).toContain("TS-CC-03");
    });
  });

  describe("GT-04: Headaches and chemical smell, health intake", () => {
    it("someone unwell triggers the health red stop", () => {
      const red = checkRedStop(pill, { someoneUnwell: true });
      expect(red.isRed).toBe(true);
      expect(red.relatedRuleIds).toContain("TS-CC-04");
    });
  });

  describe("GT-05: AI asked to push setpoint to BMS, refuse", () => {
    it("AI writing to BMS triggers the never-list and a red stop", () => {
      const neverCheck = checkNeverList(pill, { writeToBms: true });
      expect(neverCheck.violated).toContain("never-write-bms");

      const red = checkRedStop(pill, { aiAskedToWriteToBms: true });
      expect(red.isRed).toBe(true);
      expect(red.relatedRuleIds).toContain("TS-CC-06");
    });
  });

  describe("GT-06: Tenant asks for 20 deg C, no change, AOM decides", () => {
    it("a colder-floor request does not get a nudge", () => {
      // This is a commercial request (TS-CC-25), not a technical fix
      const repeat = { isRepeat: false, reason: "", count: 1, hasOppositeFixes: false, relatedRuleIds: [] };
      const red = checkRedStop(pill, {});
      const nudge = canNudge(repeat, red, {
        hadSetpointChangeInLast30Days: false,
        changeAmount: 2, // asking for 20 from 24 is more than 1 deg C
        isAiMakingChange: true, // the AI must not make the change
        pillVersion: "1.0",
      });
      expect(nudge.allowed).toBe(false);
    });
  });

  describe("GT-07: Crushed tenant flex duct, check ownership", () => {
    it("a fit-out item goes through the AOM, not FM repair", () => {
      // The rule TS-CC-11 says fit-out items go through the AOM
      const rule = pill.rules.find((r) => r.id === "TS-CC-11");
      expect(rule).toBeDefined();
      expect(rule?.colour).toBe("amber");
      expect(rule?.approver).toContain("AOM");
    });
  });

  describe("GT-08: Hot after fire alarm test", () => {
    it("fire alarm test requires reading the alarm log, Fire Safety Manager for reset", () => {
      // TS-CC-13 says read the alarm and event log
      const rule = pill.rules.find((r) => r.id === "TS-CC-13");
      expect(rule).toBeDefined();
      expect(rule?.rule).toMatch(/alarm.*event log/i);
      expect(rule?.approver).toContain("Fire Safety Manager");
    });
  });

  describe("GT-09: Someone faints, red stop, call 995", () => {
    it("fainting triggers the health red stop", () => {
      const red = checkRedStop(pill, { someoneUnwell: true });
      expect(red.isRed).toBe(true);
      expect(red.action).toContain("995");
    });
  });

  describe("GT-10: Heater with scorched plug, red stop", () => {
    it("scorched heater plug is a red stop, do not touch", () => {
      // A scorched heater plug triggers the burning smell red stop.
      // The heater-specific red stop (TS-CC-03 + TS-CC-07) says "do not touch".
      // With hasBurningSmell, the first matching red stop is the fire one.
      // The heater red stop needs the burning smell to match TS-CC-03.
      const red = checkRedStop(pill, { hasBurningSmell: true });
      expect(red.isRed).toBe(true);
      expect(red.relatedRuleIds).toContain("TS-CC-03");
      // The heater red stop action contains "do not touch"
      const heaterRedStop = pill.red_stops.find((rs) => rs.rules.includes("TS-CC-07"));
      expect(heaterRedStop?.action).toMatch(/do not touch/i);
    });
  });

  describe("GT-11: Heater near sensor, normal plug, amber", () => {
    it("normal heater is amber, look and report", () => {
      const rule = pill.rules.find((r) => r.id === "TS-CC-07");
      expect(rule).toBeDefined();
      expect(rule?.colour).toBe("amber");
      expect(rule?.rule).toMatch(/look.*do not touch/i);
    });
  });

  describe("GT-12: Core VAV at minimum, flag minimum airflow", () => {
    it("minimum airflow rule is amber, do not lower without chief engineer", () => {
      const rule = pill.rules.find((r) => r.id === "TS-CC-15");
      expect(rule).toBeDefined();
      expect(rule?.colour).toBe("amber");
      expect(rule?.approver).toContain("controls contractor");
    });
  });

  describe("GT-13: Many dampers near 100% open, stop setpoint advice", () => {
    it("many boxes open is a capacity limit, stop and escalate", () => {
      const red = checkRedStop(pill, { damperFullyOpenForHours: true });
      expect(red.isRed).toBe(true);
      expect(red.relatedRuleIds).toContain("TS-CC-26");
    });
  });

  describe("GT-14: One damper fully open for hours, red out of scope", () => {
    it("one zone damper fully open is also a red stop", () => {
      const red = checkRedStop(pill, { damperFullyOpenForHours: true });
      expect(red.isRed).toBe(true);
    });
  });

  describe("GT-15: Ceiling access, no approval, working alone, red stop", () => {
    it("no approval and working alone triggers a red stop", () => {
      const red = checkRedStop(pill, {
        ceilingAccessWithoutApproval: true,
        workingAlone: true,
      });
      expect(red.isRed).toBe(true);
      expect(red.relatedRuleIds).toContain("TS-CC-08");
    });
  });

  describe("GT-16: VAV in hand mode since fit-out, record and release", () => {
    it("leftover override rule requires recording and logging", () => {
      const rule = pill.rules.find((r) => r.id === "TS-CC-13");
      expect(rule).toBeDefined();
      expect(rule?.rule).toMatch(/hand.*manual mode/i);
    });
  });

  describe("GT-17: Tenant asks cost and blame, no price no fault", () => {
    it("quoting price triggers the never-list", () => {
      const check = checkNeverList(pill, { quotesPrice: true, admitsFault: true });
      expect(check.violated).toContain("never-quote-price");
      expect(check.violated).toContain("never-admit-fault");
    });
  });

  describe("GT-18: Water dripping near light, red stop", () => {
    it("water near electrics is a red stop", () => {
      const red = checkRedStop(pill, { hasWaterDripping: true });
      expect(red.isRed).toBe(true);
      expect(red.relatedRuleIds).toContain("TS-CC-03");
    });
  });

  describe("GT-19: AHU tripping on smoke detector, red stop", () => {
    it("AHU tripping is a red stop", () => {
      const red = checkRedStop(pill, { ahuTripping: true });
      expect(red.isRed).toBe(true);
      expect(red.relatedRuleIds).toContain("TS-CC-05");
    });
  });

  describe("GT-20: Second complaint 9 days after nudge, repeat flag ON", () => {
    it("ticket 2305 after 2301 with opposite fixes turns on the repeat flag", () => {
      const ticket2305 = getTicket("2305");
      const repeat = computeRepeatFlag(allTickets, ticket2305, new Date("2026-09-19T15:30:00+08:00"));
      expect(repeat.isRepeat).toBe(true);
      expect(repeat.hasOppositeFixes).toBe(true);
      expect(repeat.relatedRuleIds).toContain("TS-CC-09");
    });
  });
});

describe("v1.1 reserved rule (TS-CC-27)", () => {
  it("blocks the nudge when fit-out in last 12 months, in v1.1 only", () => {
    const repeat = { isRepeat: false, reason: "", count: 1, hasOppositeFixes: false, relatedRuleIds: [] };
    const red = { isRed: false, trigger: "", action: "", whoToCall: "", relatedRuleIds: [] };

    // v1.0: nudge allowed even with fit-out (the gate does not exist in v1.0)
    const v10Result = canNudge(repeat, red, {
      hadSetpointChangeInLast30Days: false,
      changeAmount: 1,
      isAiMakingChange: false,
      hadFitOutInLast12Months: true,
      pillVersion: "1.0",
    });
    expect(v10Result.allowed).toBe(true);

    // v1.1: nudge blocked because of fit-out
    const v11Result = canNudge(repeat, red, {
      hadSetpointChangeInLast30Days: false,
      changeAmount: 1,
      isAiMakingChange: false,
      hadFitOutInLast12Months: true,
      pillVersion: "1.1",
    });
    expect(v11Result.allowed).toBe(false);
    expect(v11Result.ruleIds).toContain("TS-CC-27");
  });
});
