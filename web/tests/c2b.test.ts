import { describe, it, expect } from "vitest";
import { loadTickets, type Ticket } from "../lib/rule-engine";
import { placeTag, spotKey, allCalls } from "../lib/places";
import { factsFor, loadBuildings } from "../lib/facts";
import {
  speakFirstFor,
  speakFirstNoticeText,
  shouldPostSpeakFirst,
  speakFirstNotices,
} from "../lib/speak-first";
import { loadPlaces } from "../lib/places";

const allTickets = loadTickets();
const buildings = loadBuildings();
const places = loadPlaces();

function getTicket(id: string): Ticket {
  const t = allTickets.find((t) => t.id === id);
  if (!t) throw new Error(`Ticket ${id} not found`);
  return t;
}

describe("T-C2b: placeTag", () => {
  it("placeTag(2318) is { building: tower-a, floor: 23, zone: core, equipment: VAV-23-C1 }", () => {
    const tag = placeTag(getTicket("2318"));
    expect(tag).toEqual({
      building: "tower-a",
      floor: 23,
      zone: "core",
      equipment: "VAV-23-C1",
    });
  });
});

describe("T-C2b: spotKey", () => {
  it("spotKey(2318) is tower-a/23", () => {
    expect(spotKey(getTicket("2318"))).toBe("tower-a/23");
  });

  it("spotKey(2401) is building-b/12", () => {
    expect(spotKey(getTicket("2401"))).toBe("building-b/12");
  });
});

describe("T-C2b: factsFor", () => {
  it("2318 gives cold-mornings, core-zone, repeat, opposite-fixes, fit-out-12m, vav", () => {
    const facts = factsFor(getTicket("2318"), allTickets, buildings, places);
    expect(facts).toEqual([
      "cold-mornings",
      "core-zone",
      "repeat",
      "opposite-fixes",
      "fit-out-12m",
      "vav",
    ]);
  });

  it("2401 gives cold-mornings, core-zone, fit-out-12m, vav", () => {
    const facts = factsFor(getTicket("2401"), allTickets, buildings, places);
    expect(facts).toEqual([
      "cold-mornings",
      "core-zone",
      "fit-out-12m",
      "vav",
    ]);
  });

  it("2305 gives hot-afternoons, west-zone, repeat, opposite-fixes, fit-out-12m, vav", () => {
    const facts = factsFor(getTicket("2305"), allTickets, buildings, places);
    expect(facts).toEqual([
      "hot-afternoons",
      "west-zone",
      "repeat",
      "opposite-fixes",
      "fit-out-12m",
      "vav",
    ]);
  });

  it("2301 gives cold-mornings, core-zone, fit-out-12m, vav", () => {
    const facts = factsFor(getTicket("2301"), allTickets, buildings, places);
    expect(facts).toEqual([
      "cold-mornings",
      "core-zone",
      "fit-out-12m",
      "vav",
    ]);
  });
});

describe("T-C2b: speakFirstFor", () => {
  it("2301 alone has no repeat flag: count 1, fire false", () => {
    const result = speakFirstFor(getTicket("2301"), allTickets);
    expect(result.fire).toBe(false);
    expect(result.count).toBe(1);
  });

  it("2305 trips the repeat and speak first: count 2, opposite true, fire true", () => {
    const result = speakFirstFor(getTicket("2305"), allTickets);
    expect(result.fire).toBe(true);
    expect(result.count).toBe(2);
    expect(result.opposite).toBe(true);
  });

  it("2318: count 5, fire true", () => {
    const result = speakFirstFor(getTicket("2318"), allTickets);
    expect(result.fire).toBe(true);
    expect(result.count).toBe(5);
  });

  it("2401: fire false", () => {
    const result = speakFirstFor(getTicket("2401"), allTickets);
    expect(result.fire).toBe(false);
  });
});

describe("T-C2b: speak first notice text", () => {
  it("2318 notice has 5 times in 30 days, with opposite fixes", () => {
    const text = speakFirstNoticeText(getTicket("2318"), allTickets);
    expect(text).toContain("Tower A Level 23 has called 5 times in 30 days, with opposite fixes");
    expect(text).toContain("(repeat flag, TS-CC-09)");
    expect(text).toContain("Quick fixes are off for this spot");
    expect(text).toContain("Find the cause before they call again");
  });

  it("2305 notice has 2 times, with opposite fixes", () => {
    const text = speakFirstNoticeText(getTicket("2305"), allTickets);
    expect(text).toContain("Tower A Level 23 has called 2 times in 30 days, with opposite fixes");
  });
});

describe("T-C2b: never twice for same spot inside 30 days", () => {
  it("shouldPostSpeakFirst fires when no existing notice", () => {
    const job = getTicket("2318");
    expect(shouldPostSpeakFirst(job, allTickets, [])).toBe(true);
  });

  it("shouldPostSpeakFirst does not fire when a notice exists for same spot in 30 days", () => {
    const job = getTicket("2318");
    const asOf = new Date("2026-10-06T09:30:00+08:00");
    const notices = [{ spotKey: "tower-a/23", postedAt: "2026-10-06T09:30:00+08:00" }];
    expect(shouldPostSpeakFirst(job, allTickets, notices, asOf)).toBe(false);
  });

  it("speakFirstNotices posts one notice per spot, not two", () => {
    const openJobs = [getTicket("2318")]; // 2318 is the open one
    const notices = speakFirstNotices(openJobs, allTickets, []);
    expect(notices).toHaveLength(1);
    expect(notices[0].spotKey).toBe("tower-a/23");
  });

  it("a second run with the existing notice adds none", () => {
    const openJobs = [getTicket("2318")];
    const asOf = new Date("2026-10-06T09:30:00+08:00");
    const existing = [{ spotKey: "tower-a/23", postedAt: "2026-10-06T09:30:00+08:00" }];
    const notices = speakFirstNotices(openJobs, allTickets, existing, asOf);
    expect(notices).toHaveLength(0);
  });
});

describe("T-C2b: allCalls", () => {
  it("allCalls includes all tickets from tickets.json plus runtime jobs", () => {
    const runtimeJob: Ticket = {
      id: "2319",
      label: "made up for the demo",
      building: "tower-a",
      buildingName: "Tower A",
      floor: 23,
      tenant: "Northwind Advisory",
      zone: "core",
      complaint: "too cold",
      timeOfDay: "morning",
      complaintHour: "09:00",
      reportedAt: "2026-10-06T10:00:00+08:00",
      intake: { where: "core", when: "morning", sinceWhen: "just now" },
      fix: null,
      status: "open",
      previousChangesOnFloor: true,
    };
    const calls = allCalls({ tickets: [runtimeJob] });
    expect(calls.length).toBe(allTickets.length + 1);
    expect(calls.some((c) => c.id === "2319")).toBe(true);
    expect(calls.find((c) => c.id === "2319")!.fix).toBeNull();
  });
});
