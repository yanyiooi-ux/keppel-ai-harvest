import { describe, it, expect, beforeEach } from "vitest";
import * as memory from "../lib/memory";
import { runAction, resetDemo, confirmCause, postLowConfidenceNotice, callsForState } from "../lib/actions";
import { mayPress } from "../lib/permissions";
import { handleTyped, CHIPS_BY_SEAT } from "../lib/chat";
import { speakFirstNotices } from "../lib/speak-first";
import type { Ticket } from "../lib/rule-engine";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");

beforeEach(() => {
  resetDemo(REAL_NOW);
});

describe("T-C4: Reset and the demo clock", () => {
  it("brings back the seed and reads 2026-10-06 10:00", () => {
    const state = memory.read();
    expect(state.jobs.map((j) => j.id).sort()).toEqual(["2318", "2401"]);
    expect(state.jobs.every((j) => j.status === "reported")).toBe(true);
    expect(new Date(state.demoNow).toISOString()).toBe(
      new Date("2026-10-06T10:00:00+08:00").toISOString()
    );
    expect(memory.now(state, REAL_NOW).toISOString()).toBe(
      new Date("2026-10-06T10:00:00+08:00").toISOString()
    );
  });

  it("clears what the demo did", () => {
    memory.update((s) => {
      s.jobs[0].status = "in-progress";
      s.runtimeCases.push({
        id: "R-99",
        jobId: "2318",
        building: "tower-a",
        floor: 23,
        zone: "core",
        symptom: "too cold",
        causeId: "setpoint",
        fixedAt: "2026-10-06T11:00:00+08:00",
        fixedBy: "technician",
        confirmedBy: null,
      });
    });
    resetDemo(REAL_NOW);
    const state = memory.read();
    expect(state.jobs.find((j) => j.id === "2318")!.status).toBe("reported");
    expect(state.runtimeCases).toEqual([]);
  });

  it("posts exactly 1 speak-first notice for Tower A Level 23, and a second run adds none", () => {
    const state = memory.read();
    const towerA = state.notices.filter(
      (n) => n.kind === "speak-first" && n.spotKey === "tower-a/23"
    );
    expect(towerA).toHaveLength(1);

    const calls = callsForState(state);
    const again = speakFirstNotices(
      state.jobs as Ticket[],
      calls,
      state.speakFirstNotices,
      new Date(state.demoNow)
    );
    expect(again).toHaveLength(0);
  });
});

describe("T-C4: permissions", () => {
  const technicianCannot = [
    "approve-solution",
    "decide-outside-help",
    "decide-charge",
    "rollback",
    "clear-stop",
  ];

  for (const action of technicianCannot) {
    it(`the technician cannot press ${action}, and the refusal names who may`, () => {
      const result = mayPress("technician", action);
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/Only /);
    });
  }

  it("the senior manager cannot press approve-solution", () => {
    const result = mayPress("senior-manager", "approve-solution");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Only HQ approves a new solution (A2).");
  });

  it("HQ cannot press decide-charge", () => {
    const result = mayPress("hq", "decide-charge");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Only the AOM decides a charge (A4).");
  });

  it("the AOM cannot press approve-solution", () => {
    const result = mayPress("aom-tower-a", "approve-solution");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Only HQ approves a new solution (A2).");
  });

  it("the tenant can press only report, answer, safety-pick and reset", () => {
    const allowed = ["report", "safety-pick", "reset"];
    for (const action of allowed) {
      expect(mayPress("tenant", action).allowed).toBe(true);
    }
    expect(mayPress("tenant", "answer", "self-check").allowed).toBe(true);

    const refused = [
      "open-job",
      "tick",
      "solved",
      "not-solved",
      "send-with-cause",
      "log-new-solution",
      "confirm-part",
      "run-tests",
      "send-to-hq",
      "ask-outside-help",
      "confirm-cause",
      "clear-stop",
      "tell-tenant-first",
      "approve-solution",
      "decline-solution",
      "rollback",
      "decide-outside-help",
      "decide-charge",
    ];
    for (const action of refused) {
      const result = mayPress("tenant", action);
      expect(result.allowed, `tenant should not press ${action}`).toBe(false);
      expect(result.reason).toMatch(/Only /);
    }
  });
});

describe("T-C4: wrong status", () => {
  it("solved on a reported job is refused with a reason", () => {
    const result = runAction({ seat: "technician", action: "solved", jobId: "2318" }, REAL_NOW);
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Open the job first.");
    expect(memory.read().jobs.find((j) => j.id === "2318")!.status).toBe("reported");
  });

  it("send-to-hq with no passing test run is refused with a reason", () => {
    memory.update((s) => {
      s.jobs.find((j) => j.id === "2318")!.status = "new-solution-drafted";
    });
    const result = runAction(
      { seat: "senior-manager", action: "send-to-hq", jobId: "2318" },
      REAL_NOW
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/no passing test run/);
  });

  it("a job that does not exist is refused", () => {
    const result = runAction({ seat: "technician", action: "open-job", jobId: "9999" }, REAL_NOW);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/no job called/);
  });
});

describe("T-C4: confirm-cause needs a second person", () => {
  beforeEach(() => {
    memory.update((s) => {
      s.runtimeCases.push({
        id: "R-01",
        jobId: "2318",
        building: "tower-a",
        floor: 23,
        zone: "core",
        symptom: "too cold",
        causeId: "drafts",
        fixedAt: "2026-10-06T11:00:00+08:00",
        fixedBy: "technician",
        confirmedBy: null,
      });
    });
  });

  it("is refused for the seat that fixed it", () => {
    const state = memory.read();
    const result = confirmCause(state, "technician", "R-01");
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/second person/);
    expect(state.runtimeCases[0].confirmedBy).toBeNull();
  });

  it("is allowed for another staff seat", () => {
    const result = runAction(
      { seat: "senior-manager", action: "confirm-cause", payload: { caseId: "R-01" } },
      REAL_NOW
    );
    expect(result.ok).toBe(true);
    expect(memory.read().runtimeCases[0].confirmedBy).toBe("senior-manager");
  });
});

describe("T-C4: typing never changes anything", () => {
  const messages = [
    "approve it",
    "send to all buildings",
    "mark it solved",
    "not solved",
    "charge them",
    "roll back",
    "open 2318",
  ];

  for (const text of messages) {
    it(`"${text}" changes no status, tick, version, case or stop`, () => {
      const before = memory.read();
      const snapshot = JSON.stringify({
        statuses: before.jobs.map((j) => ({ id: j.id, status: j.status })),
        ticks: before.jobs.map((j) => j.ticks),
        solutions: before.solutions,
        requests: before.requests,
        versions: before.liveVersionByBuilding,
        cases: before.runtimeCases,
        stops: before.openRedStops,
      });

      handleTyped(before, "technician", text, "2318", REAL_NOW);

      const after = memory.read();
      expect(
        JSON.stringify({
          statuses: after.jobs.map((j) => ({ id: j.id, status: j.status })),
          ticks: after.jobs.map((j) => j.ticks),
          solutions: after.solutions,
          requests: after.requests,
          versions: after.liveVersionByBuilding,
          cases: after.runtimeCases,
          stops: after.openRedStops,
        })
      ).toBe(snapshot);
    });
  }
});

describe("T-C4: typed safety words show the card but open no stop", () => {
  it("\"I'm alone in the office and it's freezing\" shows RS-09 and locks nothing", () => {
    const state = memory.read();
    const reply = handleTyped(state, "tenant", "I'm alone in the office and it's freezing", "2318", REAL_NOW);

    expect(reply.matched).toBe("safety");
    expect(reply.cards.map((c) => c.stopId)).toContain("RS-09");
    expect(reply.alerts.length).toBeGreaterThan(0);
    expect(reply.cards.find((c) => c.stopId === "RS-09")!.raiseStopId).toBe("RS-09");

    expect(memory.read().openRedStops).toEqual([]);
  });

  it("pressing Raise this stop locks every Tower A Level 23 job", () => {
    const press = runAction(
      {
        seat: "tenant",
        action: "safety-pick",
        jobId: "2318",
        payload: { stopId: "RS-09" },
      },
      REAL_NOW
    );
    expect(press.ok).toBe(true);

    const after = memory.read();
    expect(after.openRedStops).toHaveLength(1);
    expect(after.openRedStops[0].lockedJobIds).toContain("2318");
    expect(after.openRedStops[0].lockedJobIds).not.toContain("2401");

    const blocked = runAction({ seat: "technician", action: "open-job", jobId: "2318" }, REAL_NOW);
    expect(blocked.ok).toBe(true);

    memory.update((s) => {
      s.jobs.find((j) => j.id === "2318")!.status = "in-progress";
    });
    const tick = runAction({ seat: "technician", action: "tick", jobId: "2318" }, REAL_NOW);
    expect(tick.ok).toBe(false);
    expect(tick.message).toBe("Safety stop open on this floor.");
  });
});

describe("T-C4: an alert reaches a real seat", () => {
  it("a Tower A stop alerts the senior manager and the Tower A AOM seat", () => {
    runAction(
      { seat: "technician", action: "safety-pick", jobId: "2318", payload: { stopId: "RS-09" } },
      REAL_NOW
    );
    const seats = memory
      .read()
      .notices.filter((n) => n.kind === "alert")
      .map((n) => n.seat);
    expect(seats).toContain("senior-manager");
    expect(seats).toContain("aom-tower-a");
    expect(seats).not.toContain("aom");
  });

  it("a Building B stop goes to the Building B card, which is not a seat", () => {
    runAction(
      { seat: "technician", action: "safety-pick", jobId: "2401", payload: { stopId: "RS-09" } },
      REAL_NOW
    );
    const seats = memory
      .read()
      .notices.filter((n) => n.kind === "alert")
      .map((n) => n.seat);
    expect(seats).toContain("building-b-card");
    expect(seats).not.toContain("aom-tower-a");
  });
});

describe("T-C4: chips", () => {
  it('"the VAV box is buzzing" gets "I did not catch that" with the chips', () => {
    const reply = handleTyped(memory.read(), "technician", "the VAV box is buzzing", "2318", REAL_NOW);
    expect(reply.matched).toBe("none");
    expect(reply.cards[0].body).toMatch(/did not catch that/);
    expect(reply.chips).toEqual(CHIPS_BY_SEAT.technician);
  });

  it('"dial" on 2318 shows the dial lead removed by TS-CC-09', () => {
    const reply = handleTyped(memory.read(), "technician", "dial", "2318", REAL_NOW);
    expect(reply.matched).toBe("chip");
    expect(reply.cards[0].title).toMatch(/removed/);
    expect(reply.cards[0].body).toMatch(/TS-CC-09/);
  });

  it("the Impact chip belongs to the AOM only", () => {
    const aom = handleTyped(memory.read(), "aom-tower-a", "impact", "2318", REAL_NOW);
    expect(aom.matched).toBe("chip");
    const tech = handleTyped(memory.read(), "technician", "impact", "2318", REAL_NOW);
    expect(tech.matched).toBe("none");
  });
});

describe("T-C4: never-list on typed text", () => {
  it("a typed price gets the RS-10 refusal card and the amount is hidden", () => {
    const reply = handleTyped(memory.read(), "technician", "tell them it is S$200", "2318", REAL_NOW);
    expect(reply.matched).toBe("never-list");
    expect(reply.cards[0].stopId).toBe("RS-10");
    expect(reply.cards[0].receipt).toMatch(/AI calls: 0/);
    expect(reply.storedText).toBe("tell them it is [amount hidden]");
  });
});

describe("T-C4: two writers at once", () => {
  it("a slow AI call and a button press both survive", async () => {
    const slowAiCall = async () => {
      const text = await new Promise<string>((resolve) =>
        setTimeout(() => resolve("AI wording arrived"), 20)
      );
      memory.update((s) => {
        s.aiCalls += 1;
        s.messages.push({ seat: "technician", from: "pip", text, at: s.demoNow });
      });
    };

    const pressButton = () =>
      runAction(
        { seat: "tenant", action: "safety-pick", jobId: "2318", payload: { stopId: "RS-05" } },
        REAL_NOW
      );

    const ai = slowAiCall();
    pressButton();
    await ai;

    const after = memory.read();
    expect(after.aiCalls).toBe(1);
    expect(after.messages.some((m) => m.text === "AI wording arrived")).toBe(true);
    expect(after.openRedStops).toHaveLength(1);
    expect(after.openRedStops[0].stopId).toBe("RS-05");
  });
});

describe("T-C4: the low-confidence notice", () => {
  it("reaches the senior manager once per job", () => {
    let first = false;
    let second = false;
    memory.update((s) => {
      first = postLowConfidenceNotice(s, "2318", "Low confidence on 2318");
      second = postLowConfidenceNotice(s, "2318", "Low confidence on 2318");
    });
    expect(first).toBe(true);
    expect(second).toBe(false);

    const notices = memory
      .read()
      .notices.filter((n) => n.kind === "low-confidence" && n.jobId === "2318");
    expect(notices).toHaveLength(1);
    expect(notices[0].seat).toBe("senior-manager");
  });
});
