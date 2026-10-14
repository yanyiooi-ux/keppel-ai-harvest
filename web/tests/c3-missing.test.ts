/**
 * Missing checks for step C3 (run rule 3f). Each test proves one T-C3a or
 * T-C3b bullet that had no test, or only a test on a different string.
 * .codebuddy/plans/C3-selfcheck.md maps every bullet to its test.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { loadPill } from "../lib/pill";
import { typedSafetyWords } from "../lib/safety";
import { scanNeverList, checkTenantText, tenantReplyOrTips } from "../lib/never-list";
import { checkWording } from "../lib/wording-check";
import { handleTyped, applyTypedReply } from "../lib/chat";
import { runAction, resetDemo } from "../lib/actions";
import { SEAT_LABELS } from "../lib/permissions";
import * as memory from "../lib/memory";

const pill = loadPill("ts-cc", "1.0");
const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");

// ---- T-C3a: the phrases exactly as a person types them ----
// c3a.test.ts types four red phrases, three picker phrases and one calm phrase
// already lower-cased, with the apostrophe or comma taken out. These are the
// T-C3a strings word for word.

const exactRed: [string, string][] = [
  ["can't breathe", "RS-05"],
  ["leak above the DB room", "RS-04"],
  ["AHU keeps tripping", "RS-06"],
  ["I'm up the ladder alone", "RS-09"],
];

describe.each(exactRed)("T-C3a red phrase as typed: %s", (phrase, stopId) => {
  it(`matches ${stopId}`, () => {
    const result = typedSafetyWords(phrase, pill);
    expect(result.matchedStops.map((s) => s.id)).toContain(stopId);
  });
});

const exactNotRed = [
  "what do I do about the water beads on the diffuser",
  "I'm melting",
  "I feel dizzy and unwell",
  "the core is too cold, not warm",
];

describe.each(exactNotRed)("T-C3a not red as typed: %s", (phrase) => {
  it("matches no red stop", () => {
    expect(typedSafetyWords(phrase, pill).matchedStops).toEqual([]);
  });
});

// ---- T-C3a: where a stop attaches, and no second alert ----

describe("T-C3a: stops raised by a button", () => {
  beforeEach(() => {
    resetDemo(REAL_NOW);
  });

  it("a stop raised from AOM Tower A with no job open attaches to Tower A Level 23", () => {
    const press = runAction({ seat: "aom-tower-a", action: "safety-pick", payload: { stopId: "RS-04" } }, REAL_NOW);
    expect(press.ok).toBe(true);
    const stop = memory.read().openRedStops[0];
    expect(stop.building).toBe("tower-a");
    expect(stop.floor).toBe(23);
    expect(stop.lockedJobIds).toContain("2318");
    expect(stop.lockedJobIds).not.toContain("2401");
  });

  it("typed words send the alerts; pressing Raise this stop locks, sends no second alert and adds raised by", () => {
    const reply = handleTyped(memory.read(), "tenant", "the ceiling is dripping", "2318", REAL_NOW);
    expect(reply.cards.map((c) => c.raiseStopId)).toContain("RS-04");
    memory.update((s) => applyTypedReply(s, "tenant", "2318", reply));

    const typedAlerts = memory.read().notices.filter((n) => n.kind === "alert");
    expect(typedAlerts).toHaveLength(2);
    expect(memory.read().openRedStops).toEqual([]);

    const press = runAction(
      { seat: "tenant", action: "safety-pick", jobId: "2318", payload: { stopId: "RS-04" } },
      REAL_NOW
    );
    expect(press.ok).toBe(true);

    const after = memory.read();
    expect(after.openRedStops).toHaveLength(1);
    expect(after.openRedStops[0].lockedJobIds).toContain("2318");
    const alerts = after.notices.filter((n) => n.kind === "alert");
    expect(alerts).toHaveLength(2);
    for (const a of alerts) expect(a.text).toContain(`raised by ${SEAT_LABELS.tenant}`);
  });

  it("a pick from the Safety list with no typed alert before it still sends its alerts", () => {
    runAction({ seat: "technician", action: "safety-pick", jobId: "2318", payload: { stopId: "RS-04" } }, REAL_NOW);
    const alerts = memory.read().notices.filter((n) => n.kind === "alert");
    expect(alerts.map((a) => a.seat).sort()).toEqual(["aom-tower-a", "senior-manager"]);
  });
});

// ---- T-C3b: the scanner blocks every phrase in S13 items 1 to 5 ----

const neverPhrases: [string, string][] = [
  // 1. prices
  ["$200", "never-quote-price"],
  ["S$200", "never-quote-price"],
  ["S$ 200", "never-quote-price"],
  ["SGD 200", "never-quote-price"],
  ["200 SGD", "never-quote-price"],
  ["200 bucks", "never-quote-price"],
  ["two hundred dollars", "never-quote-price"],
  ["50 cents", "never-quote-price"],
  // 2. free offers
  ["waive", "never-quote-price"],
  ["waived", "never-quote-price"],
  ["waiving", "never-quote-price"],
  ["on the house", "never-quote-price"],
  ["complimentary", "never-quote-price"],
  ["goodwill credit", "never-quote-price"],
  ["refund", "never-quote-price"],
  ["rebate", "never-quote-price"],
  ["discount", "never-quote-price"],
  ["rent-free", "never-quote-price"],
  ["free of charge", "never-quote-price"],
  ["compensation", "never-quote-price"],
  ["compensate", "never-quote-price"],
  ["reimburse", "never-quote-price"],
  // 3. fault
  ["our fault", "never-admit-fault"],
  ["our mistake", "never-admit-fault"],
  ["our error", "never-admit-fault"],
  ["sorry for our error", "never-admit-fault"],
  ["we will cover it", "never-admit-fault"],
  ["that one is on us", "never-admit-fault"],
  ["we are responsible", "never-admit-fault"],
  ["liable", "never-admit-fault"],
  ["liability", "never-admit-fault"],
  // 5. building system
  ["write to the BMS", "never-write-bms"],
  ["push it to the BMS", "never-write-bms"],
  ["push to the system", "never-write-bms"],
  ["push the new setpoint to the BMS", "never-write-bms"],
  ["setpoint to the BMS", "never-write-bms"],
  ["push the setpoint to the BMS", "never-write-bms"],
  ["BMS override", "never-write-bms"],
  ["override the", "never-write-bms"],
  ["change the schedule", "never-write-bms"],
];

describe.each(neverPhrases)("T-C3b scanner blocks: %s", (phrase, id) => {
  it(`returns ${id}`, () => {
    expect(scanNeverList(pill, phrase).violated).toContain(id);
  });
});

describe("T-C3b: other tenants (S13 item 4)", () => {
  it("Meridian Partners in a Northwind reply is blocked", () => {
    const scan = scanNeverList(pill, "Meridian Partners had the same problem last week.", {
      tenant: "Northwind Advisory",
      building: "tower-a",
      floor: 23,
    });
    expect(scan.violated).toContain("never-cross-tenant");
  });

  it("Northwind in its own reply is not", () => {
    const scan = scanNeverList(pill, "Thanks, Northwind Advisory, we have your report.", {
      tenant: "Northwind Advisory",
      building: "tower-a",
      floor: 23,
    });
    expect(scan.violated).not.toContain("never-cross-tenant");
  });
});

// ---- T-C3b: tenant text fails, and falls back to the tips word for word ----

describe("T-C3b: AI tenant text that fails falls back to the tips word for word", () => {
  const ctx = { tenant: "Northwind Advisory", building: "tower-a", floor: 23 };
  const tips = pill.tenant_tips.filter((t) => t.rules.includes("TS-CC-09"));
  const failing = [
    "The cause is the thermostat your fit-out contractor moved next to your printer bay.",
    "We will have it fixed by Friday.",
  ];

  for (const text of failing) {
    it(`fails: ${text}`, () => {
      expect(checkTenantText(text, ctx).passes).toBe(false);
      const shown = tenantReplyOrTips(pill, text, tips, ctx);
      expect(shown.source).toBe("tips");
      expect(shown.lines).toEqual(tips.map((t) => t.text));
      expect(shown.lines.join(" ")).not.toContain("printer");
    });
  }

  it("a reply that passes S13 and S14 is shown as the AI wrote it", () => {
    const text = "Thank you for telling us. Please keep noting the time and the spot each time it happens.";
    const shown = tenantReplyOrTips(pill, text, tips, ctx);
    expect(shown.violations).toEqual([]);
    expect(shown.source).toBe("ai");
    expect(shown.lines).toEqual([text]);
  });

  it("with the AI off, the tips show word for word", () => {
    const shown = tenantReplyOrTips(pill, null, tips, ctx);
    expect(shown.source).toBe("tips");
    expect(shown.lines).toEqual(tips.map((t) => t.text));
  });

  it("a reply that passes the tenant-text blocks but fails S14 falls back to the tips", () => {
    // "move" is blocked unless the tips say it; "2" is a number the tips never said
    for (const text of ["Please move your desk away from the vent.", "Please report it at least 2 times a day."]) {
      expect(checkTenantText(text, ctx).passes, text).toBe(true);
      const shown = tenantReplyOrTips(pill, text, tips, ctx);
      expect(shown.source, text).toBe("tips");
      expect(shown.lines).toEqual(tips.map((t) => t.text));
    }
  });

  it("a reply that names another tenant falls back to the tips", () => {
    const shown = tenantReplyOrTips(pill, "Meridian Partners reported the same thing.", tips, ctx);
    expect(shown.source).toBe("tips");
  });
});

// ---- T-C3b: wording fails (S14) ----

describe("T-C3b: wording check on AI text (S14)", () => {
  // The 2318 precool reason, as rank.ts writes it
  const code =
    "cold mornings + core zone: matched 3 of 4 similar cases that stayed fixed; 1 failed fix counts against. Close call, so the quicker check goes first (15 minutes).";

  const fails = [
    "unplug the heater",
    "reset the breaker",
    "turn it back on to test",
    "it is safe to touch",
    "restart the AHU",
    "matched 5 of 5 cases",
    "Cold mornings matched. Core zone too. Quick check first.",
  ];

  for (const ai of fails) {
    it(`fails: ${ai}`, () => {
      const result = checkWording(ai, code, "rank");
      expect(result.passes).toBe(false);
      expect(result.shown).toEqual({ code, aiWording: null });
    });
  }

  it("word numbers count: matched five of five fails", () => {
    expect(checkWording("matched five of five similar cases", code, "rank").passes).toBe(false);
  });

  it("a faithful rewording passes and is shown under the code reason", () => {
    const ai = "Cold mornings in the core zone matched 3 of 4 similar cases that stayed fixed.";
    const result = checkWording(ai, code, "rank");
    expect(result.errors).toEqual([]);
    expect(result.passes).toBe(true);
    expect(result.shown).toEqual({ code, aiWording: ai });
  });

  it("a word the code text uses is allowed: turn, when the code says turn", () => {
    expect(checkWording("Turn the dial once.", "Technician turns the dial once, at most 1 degree, logged.", "rank").passes).toBe(
      true
    );
  });

  it("blocked always, even when the code text has the words: definitely, no danger", () => {
    expect(checkWording("It is definitely fine.", "It is definitely fine.", "rank").passes).toBe(false);
    expect(checkWording("There is no danger.", "There is no danger.", "rank").passes).toBe(false);
  });

  it("tenant replies may have 3 sentences, not 4", () => {
    const tip = "Each time it feels too hot or too cold, note the time and the exact spot and tell the helpdesk.";
    expect(checkWording("Thanks. Please note the time. Tell the helpdesk.", tip, "tenant").passes).toBe(true);
    expect(checkWording("Thanks. Note the time. Note the spot. Tell the helpdesk.", tip, "tenant").passes).toBe(false);
  });
});

// ---- T-C3b: an amount in a typed red message ----

describe("T-C3b: \"smoke near the heater, refund them S$200\"", () => {
  beforeEach(() => {
    resetDemo(REAL_NOW);
  });

  it("is stored and shown with the amount hidden, while its red stop still shows", () => {
    const text = "smoke near the heater, refund them S$200";
    const reply = handleTyped(memory.read(), "technician", text, "2318", REAL_NOW);
    expect(reply.matched).toBe("safety");
    expect(reply.storedText).toBe("smoke near the heater, refund them [amount hidden]");
    expect(reply.cards.some((c) => c.kind === "red-stop")).toBe(true);

    memory.update((s) => applyTypedReply(s, "technician", "2318", reply));
    const said = memory.read().messages.filter((m) => m.seat === "technician" && m.from === "person");
    expect(said[said.length - 1].text).toBe("smoke near the heater, refund them [amount hidden]");
    expect(JSON.stringify(memory.read().messages)).not.toContain("S$200");
  });
});
