import { describe, it, expect } from "vitest";
import { loadPill } from "../lib/pill";
import {
  scanNeverList,
  hideAmounts,
  neverListRefusalCard,
  checkTenantText,
} from "../lib/never-list";
import {
  checkRankWording,
  checkTenantReplyWording,
  checkChipWording,
} from "../lib/wording-check";

const pill = loadPill("ts-cc", "1.0");

// ---- 7 must-pass phrases (S13 item 7) ----

const mustPassPhrases = [
  "1 deg C",
  "Level 23",
  "v1.1",
  "TS-CC-09",
  "ticket 2301",
  "check the BMS trend",
  "bump it 2 degrees",
];

describe.each(mustPassPhrases)("T-C3b: must-pass phrase: %s", (phrase) => {
  it("does not trigger the never-list", () => {
    const result = scanNeverList(pill, phrase);
    expect(result.violated).toEqual([]);
  });
});

// ---- Scanner triggers ----

describe("T-C3b: scanner triggers", () => {
  it('"push the setpoint to the BMS" triggers never-write-bms', () => {
    const result = scanNeverList(pill, "push the setpoint to the BMS");
    expect(result.violated).toContain("never-write-bms");
  });

  it('"we will waive the S$200, it was our fault" triggers never-quote-price and never-admit-fault', () => {
    const result = scanNeverList(pill, "we will waive the S$200, it was our fault");
    expect(result.violated).toContain("never-quote-price");
    expect(result.violated).toContain("never-admit-fault");
  });

  it('"waive the charge" triggers never-quote-price (free offer)', () => {
    const result = scanNeverList(pill, "we will waive the charge");
    expect(result.violated).toContain("never-quote-price");
  });

  it('"it was our fault" triggers never-admit-fault', () => {
    const result = scanNeverList(pill, "it was our fault");
    expect(result.violated).toContain("never-admit-fault");
  });
});

// ---- Refusal card (RS-10) ----

describe("T-C3b: refusal card for typed hit", () => {
  it('"push to the BMS" returns RS-10 card with 0 AI calls and pointer', () => {
    const card = neverListRefusalCard(pill, "push to the BMS");
    expect(card).not.toBeNull();
    expect(card!.id).toBe("RS-10");
    expect(card!.receipt).toContain("AI calls: 0");
    expect(card!.pointer).toContain("senior manager");
  });

  it('"S$200" returns RS-10 card with pointer about AOM', () => {
    const card = neverListRefusalCard(pill, "we will refund the S$200");
    expect(card).not.toBeNull();
    expect(card!.id).toBe("RS-10");
    expect(card!.pointer).toContain("AOM");
  });

  it("a safe phrase returns no card", () => {
    const card = neverListRefusalCard(pill, "the room is too cold");
    expect(card).toBeNull();
  });
});

// ---- hideAmounts ----

describe("T-C3b: hideAmounts", () => {
  it('"S$200" becomes "[amount hidden]"', () => {
    expect(hideAmounts("We will refund S$200")).toContain("[amount hidden]");
  });

  it('"$50" becomes "[amount hidden]"', () => {
    expect(hideAmounts("The cost is $50")).toContain("[amount hidden]");
  });

  it('"200 dollars" becomes "[amount hidden]"', () => {
    expect(hideAmounts("200 dollars")).toContain("[amount hidden]");
  });

  it("non-money text stays the same", () => {
    expect(hideAmounts("1 deg C")).toBe("1 deg C");
  });
});

// ---- Tenant text blocks ----

describe("T-C3b: tenant text blocks", () => {
  it("a safe 2-sentence reply passes", () => {
    const result = checkTenantText(
      "We adjusted the setting for your area. Please let us know if it is still cold.",
      { tenant: "Northwind Advisory", building: "tower-a", floor: 23 }
    );
    expect(result.passes).toBe(true);
  });

  it("a reply with 'cause' fails", () => {
    const result = checkTenantText(
      "The cause was a stuck valve.",
      { tenant: "Northwind Advisory", building: "tower-a", floor: 23 }
    );
    expect(result.passes).toBe(false);
  });

  it("a reply with 4 sentences fails", () => {
    const result = checkTenantText(
      "We adjusted it. It should be fine. Please call if not. We will check tomorrow.",
      { tenant: "Northwind Advisory", building: "tower-a", floor: 23 }
    );
    expect(result.passes).toBe(false);
  });
});

// ---- Wording checks ----

describe("T-C3b: wording checks", () => {
  it("rank wording at most 2 sentences passes", () => {
    const result = checkRankWording("Cold mornings: matched 3 of 4 similar cases.");
    expect(result.passes).toBe(true);
  });

  it("rank wording with 3 sentences fails", () => {
    const result = checkRankWording("One. Two. Three.");
    expect(result.passes).toBe(false);
  });

  it("tenant reply at most 3 sentences passes", () => {
    const result = checkTenantReplyWording("We adjusted it. Please call if cold. Thank you.");
    expect(result.passes).toBe(true);
  });

  it("tenant reply with 4 sentences fails", () => {
    const result = checkTenantReplyWording("One. Two. Three. Four.");
    expect(result.passes).toBe(false);
  });

  it("chip at most 5 words passes", () => {
    const result = checkChipWording("cold mornings core zone");
    expect(result.passes).toBe(true);
  });

  it("chip with 6 words fails", () => {
    const result = checkChipWording("one two three four five six");
    expect(result.passes).toBe(false);
  });

  it("chip with $ fails", () => {
    const result = checkChipWording("$200 refund");
    expect(result.passes).toBe(false);
  });
});
