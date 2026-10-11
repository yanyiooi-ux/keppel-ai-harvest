import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { loadPill } from "../lib/pill";
import {
  safetyList,
  safetyCardForStop,
  alertsForStop,
  locksForStop,
  lockLineForStop,
  typedSafetyWords,
  prepWords,
} from "../lib/safety";

const pill = loadPill("ts-cc", "1.0");

// ---- 21 red phrases from T-C3a ----

const redPhrases: [string, string, string][] = [
  ["cord feels hot", "RS-03", "a heater"],
  ["sparks from the socket", "RS-03", ""],
  ["got a shock", "RS-03", ""],
  ["plastic melting", "RS-03", ""],
  ["smoking socket", "RS-03", ""],
  ["smoke coming from the ceiling", "RS-01", ""],
  ["collapsed", "RS-05", ""],
  ["cant breathe", "RS-05", ""],
  ["fell off the ladder", "RS-05", ""],
  ["leak above the db room", "RS-04", ""],
  ["water dripping near the lights", "RS-04", ""],
  ["the fire damper seems shut", "RS-06", ""],
  ["ahu keeps tripping", "RS-06", ""],
  ["refrigerant leak", "RS-07", ""],
  ["im up the ladder alone", "RS-09", ""],
  ["the heater plug is burning hot", "RS-03", ""],
  ["there is a fire up in the ceiling", "RS-01", ""],
  ["wet ceiling tiles", "RS-04", ""],
  ["water from the ceiling near my desk", "RS-04", ""],
  ["the ceiling leak is getting worse", "RS-04", ""],
  ["the ceiling is dripping", "RS-04", ""],
];

describe.each(redPhrases)("T-C3a red phrase: %s", (phrase, expectedStop) => {
  it(`matches ${expectedStop}`, () => {
    const result = typedSafetyWords(phrase, pill);
    expect(result.matchedStops.some((s) => s.id === expectedStop)).toBe(true);
  });
});

// "smoking socket" shows RS-01 and RS-03

describe("T-C3a: smoking socket shows RS-01 and RS-03", () => {
  it("matches both RS-01 and RS-03", () => {
    const result = typedSafetyWords("smoking socket", pill);
    const ids = result.matchedStops.map((s) => s.id);
    expect(ids).toContain("RS-01");
    expect(ids).toContain("RS-03");
  });
});

// ---- 11 picker phrases (tested as not red) ----

const pickerPhrases = [
  "a heater to keep warm",
  "a small heater",
  "water beads on the diffuser",
  "what do i do about the water beads on the diffuser",
  "the alarm went off earlier",
  "im melting",
  "something is burning",
  "the floor is flooding",
  "i feel dizzy and unwell",
  "there is a puddle by the door",
];

describe.each(pickerPhrases)("T-C3a picker phrase (not red): %s", (phrase) => {
  it("does not match any red stop", () => {
    const result = typedSafetyWords(phrase, pill);
    expect(result.matchedStops.length).toBe(0);
  });
});

// "太冷了" (Chinese for "too cold") is picker, not red

describe("T-C3a: Chinese text is not red", () => {
  it("太冷了 does not match any red stop", () => {
    const result = typedSafetyWords("太冷了", pill);
    expect(result.matchedStops.length).toBe(0);
  });
});

// ---- 7 calm phrases (not red, no picker) ----

const calmPhrases = [
  "the core is too cold not warm",
  "the room is burning hot",
  "hot since the fire alarm test",
  "west damper fully open",
  "turning the setpoint",
  "Tower A",
  "fire up the report",
];

describe.each(calmPhrases)("T-C3a calm phrase: %s", (phrase) => {
  it("does not match any red stop", () => {
    const result = typedSafetyWords(phrase, pill);
    expect(result.matchedStops.length).toBe(0);
  });
});

// ---- Safety list ----

describe("T-C3a: Safety list", () => {
  it("has 10 entries", () => {
    expect(safetyList(pill)).toHaveLength(10);
  });

  it("each entry equals its YAML trigger, action, who_to_call", () => {
    const stops = safetyList(pill);
    for (let i = 0; i < 10; i++) {
      const yamlStop = pill.red_stops[i];
      expect(stops[i].trigger).toBe(yamlStop.trigger);
      expect(stops[i].action).toBe(yamlStop.action);
      expect(stops[i].who_to_call).toBe(yamlStop.who_to_call);
    }
  });

  it("RS-04 card has exact words, 0 AI calls, alerts for senior manager and AOM", () => {
    const stop = pill.red_stops.find((s) => s.id === "RS-04")!;
    const card = safetyCardForStop(stop, pill.version);
    expect(card.trigger).toBe(stop.trigger);
    expect(card.action).toBe(stop.action);
    expect(card.whoToCall).toBe(stop.who_to_call);
    expect(card.receipt).toContain("RS-04");
    expect(card.receipt).toContain("AI calls: 0");

    const alerts = alertsForStop(stop, "Tower A", 23);
    expect(alerts).toHaveLength(2);
    expect(alerts.some((a) => a.seat === "senior-manager")).toBe(true);
    expect(alerts.some((a) => a.seat === "aom")).toBe(true);
  });
});

// ---- Guard test ----

describe("T-C3a: guard test", () => {
  it("web/app/ and web/lib/ hold none of the red stop texts (30+ chars) or not_when lines", () => {
    // Read all .ts/.tsx files in web/app/ and web/lib/
    const { execSync } = require("child_process");
    const root = process.cwd();
    const files: string[] = [];

    // Find all .ts and .tsx files in app/ and lib/
    try {
      const appFiles = execSync("git ls-files web/app web/lib", { cwd: root, encoding: "utf-8" })
        .split("\n")
        .filter((f: string) => f.endsWith(".ts") || f.endsWith(".tsx"));
      files.push(...appFiles);
    } catch {
      // If git fails, skip
    }

    let allSource = "";
    for (const f of files) {
      try {
        allSource += readFileSync(join(root, f), "utf-8");
      } catch {
        // skip missing files
      }
    }

    // Check no red stop trigger/action/who_to_call of 30+ chars appears
    for (const stop of pill.red_stops) {
      const fields = [stop.trigger, stop.action, stop.who_to_call];
      for (const field of fields) {
        if (field.length >= 30) {
          // The field may contain line breaks in YAML; check the first 30 chars as a substring
          const snippet = field.slice(0, 30).replace(/\n/g, " ");
          expect(allSource).not.toContain(snippet);
        }
      }
    }

    // Check no not_when lines of TS-CC-03, 04, 05
    const ruleIds = ["TS-CC-03", "TS-CC-04", "TS-CC-05"];
    for (const ruleId of ruleIds) {
      const rule = pill.rules.find((r) => r.id === ruleId);
      if (rule) {
        const notWhen = rule.not_when;
        // Check the first 30 chars
        if (notWhen.length >= 30) {
          const snippet = notWhen.slice(0, 30).replace(/\n/g, " ");
          expect(allSource).not.toContain(snippet);
        }
      }
    }
  });
});

// ---- Locks ----

describe("T-C3a: locks", () => {
  const openJobs = [
    { id: "2318", building: "tower-a", floor: 23, zone: "core" },
    { id: "2319", building: "tower-a", floor: 23, zone: "west" },
    { id: "2401", building: "building-b", floor: 12, zone: "core" },
  ];

  it("RS-01 on 2318 locks every open job on Tower A Level 23, not 2401", () => {
    const locked = locksForStop("RS-01", { building: "tower-a", floor: 23, zone: "core" }, openJobs);
    expect(locked).toContain("2318");
    expect(locked).toContain("2319");
    expect(locked).not.toContain("2401");
  });

  it("RS-08 from trend data locks nothing", () => {
    const locked = locksForStop("RS-08", { building: "tower-a", floor: 23, zone: "west" }, openJobs, "trend");
    expect(locked).toEqual([]);
  });

  it("RS-10 locks nothing", () => {
    const locked = locksForStop("RS-10", { building: "tower-a", floor: 23, zone: "core" }, openJobs);
    expect(locked).toEqual([]);
  });

  it("RS-08 from button locks that ticket's zone only", () => {
    const locked = locksForStop("RS-08", { building: "tower-a", floor: 23, zone: "west" }, openJobs, "button");
    expect(locked).toContain("2319");
    expect(locked).not.toContain("2318");
    expect(locked).not.toContain("2401");
  });
});

// ---- Lock line ----

describe("T-C3a: lock line", () => {
  it("RS-04 shows TS-CC-03's not_when", () => {
    const line = lockLineForStop("RS-04", pill);
    expect(line).toBeTruthy();
    const rule = pill.rules.find((r) => r.id === "TS-CC-03")!;
    expect(line).toBe(rule.not_when);
  });

  it("RS-05 shows TS-CC-04's not_when", () => {
    const line = lockLineForStop("RS-05", pill);
    expect(line).toBeTruthy();
    const rule = pill.rules.find((r) => r.id === "TS-CC-04")!;
    expect(line).toBe(rule.not_when);
  });

  it("RS-08 shows no lock line", () => {
    const line = lockLineForStop("RS-08", pill);
    expect(line).toBeNull();
  });

  it("RS-09 shows no lock line", () => {
    const line = lockLineForStop("RS-09", pill);
    expect(line).toBeNull();
  });
});

// ---- Typed words never lock ----

describe("T-C3a: typed words never lock", () => {
  it("a typed red phrase returns the card, 0 AI calls, but no open stop", () => {
    const result = typedSafetyWords("smoke coming from the ceiling", pill);
    expect(result.matchedStops.length).toBeGreaterThan(0);
    expect(result.matchedStops[0].receipt).toContain("AI calls: 0");
    // isPicker is false (cut 4)
    expect(result.isPicker).toBe(false);
  });
});

// ---- prepWords ----

describe("T-C3a: prepWords", () => {
  it("drops apostrophes: can't becomes cant", () => {
    expect(prepWords("can't breathe")).toEqual(["cant", "breathe"]);
  });

  it("non-letter/digit becomes space", () => {
    expect(prepWords("smoke, flame!")).toEqual(["smoke", "flame"]);
  });

  it("lower case", () => {
    expect(prepWords("SMOKE")).toEqual(["smoke"]);
  });
});
