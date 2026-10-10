import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parse as parseYaml } from "yaml";
import { loadPill, checkPill, assertPillOk, loadAndCheckPill } from "../lib/pill";
import { buildPillYaml } from "../scripts/pill-source";
import {
  checkRedStop,
  getRedStop,
  checkRedStops,
} from "../lib/rule-engine";

const pill = loadPill("ts-cc", "1.0");

const redStopIds = [
  "RS-01", "RS-02", "RS-03", "RS-04", "RS-05",
  "RS-06", "RS-07", "RS-08", "RS-09", "RS-10",
];

describe("T-C2a: getRedStop returns each of the 10 stops' own words", () => {
  // Read the YAML file from disk and parse it, so the tests compare
  // getRedStop against the file, not the pill compared with itself.
  const yamlPath = join(process.cwd(), "pills", "ts-cc", "v1.0.yaml");
  const yamlText = readFileSync(yamlPath, "utf-8");
  const filePill = parseYaml(yamlText) as { red_stops: { id: string; trigger: string; action: string; who_to_call: string; rules: string[] }[] };

  for (const id of redStopIds) {
    it(`${id} returns its own trigger, action and who_to_call (compared with YAML on disk)`, () => {
      const rs = getRedStop(pill, id);
      expect(rs).not.toBeNull();
      expect(rs!.id).toBe(id);
      const yamlRs = filePill.red_stops.find((r) => r.id === id);
      expect(yamlRs).toBeDefined();
      expect(rs!.trigger).toBe(yamlRs!.trigger);
      expect(rs!.action).toBe(yamlRs!.action);
      expect(rs!.who_to_call).toBe(yamlRs!.who_to_call);
    });
  }
});

describe("T-C2a: hasWaterDripping returns RS-04, not RS-01 or RS-02", () => {
  it("water dripping gives RS-04's action", () => {
    const red = checkRedStop(pill, { hasWaterDripping: true });
    expect(red.isRed).toBe(true);
    expect(red.id).toBe("RS-04");
    expect(red.action).toBe(getRedStop(pill, "RS-04")!.action);
  });

  it("water dripping does not give RS-01's or RS-02's action", () => {
    const red = checkRedStop(pill, { hasWaterDripping: true });
    expect(red.action).not.toBe(getRedStop(pill, "RS-01")!.action);
    expect(red.action).not.toBe(getRedStop(pill, "RS-02")!.action);
  });
});

describe("T-C2a: hasScorchedPlug returns RS-03's action word for word", () => {
  it("scorched plug gives RS-03", () => {
    const red = checkRedStop(pill, { hasScorchedPlug: true });
    expect(red.isRed).toBe(true);
    expect(red.id).toBe("RS-03");
    expect(red.action).toBe(getRedStop(pill, "RS-03")!.action);
  });
});

describe("T-C2a: checkRedStops returns in YAML order", () => {
  it('checkRedStops(["RS-04","RS-01"]) returns RS-01 then RS-04', () => {
    const stops = checkRedStops(pill, ["RS-04", "RS-01"]);
    expect(stops).toHaveLength(2);
    expect(stops[0].id).toBe("RS-01");
    expect(stops[1].id).toBe("RS-04");
  });

  it("each result has id, trigger, action, who_to_call and rules", () => {
    const stops = checkRedStops(pill, ["RS-04", "RS-01"]);
    for (const rs of stops) {
      expect(rs.id).toBeTruthy();
      expect(rs.trigger).toBeTruthy();
      expect(rs.action).toBeTruthy();
      expect(rs.who_to_call).toBeTruthy();
      expect(rs.rules.length).toBeGreaterThan(0);
    }
  });
});

describe("T-C2a: buildPillYaml equals v1.0.yaml, nothing written", () => {
  it("buildPillYaml() output equals the file on disk", () => {
    const yamlPath = join(process.cwd(), "pills", "ts-cc", "v1.0.yaml");
    const fileContent = readFileSync(yamlPath, "utf-8");
    expect(buildPillYaml()).toBe(fileContent);
  });
});

describe("T-C2a: checkPill refuses missing or repeated red stop ids", () => {
  it("refuses a missing red stop id", () => {
    const brokenPill = {
      ...pill,
      red_stops: pill.red_stops.map((rs, i) =>
        i === 0 ? { ...rs, id: "" } : rs
      ),
    };
    const errors = checkPill(brokenPill);
    expect(errors.some((e) => e.includes("no id"))).toBe(true);
  });

  it("refuses a repeated red stop id", () => {
    const brokenPill = {
      ...pill,
      red_stops: pill.red_stops.map((rs, i) =>
        i === 1 ? { ...rs, id: "RS-01" } : rs
      ),
    };
    const errors = checkPill(brokenPill);
    expect(errors.some((e) => e.includes("duplicate red stop id"))).toBe(true);
  });
});

describe("T-C2a: assertPillOk throws on a broken pill", () => {
  it("throws when a rule has no sources, message has 'has no sources'", () => {
    const brokenPill = {
      ...pill,
      rules: pill.rules.map((r, i) =>
        i === 0 ? { ...r, sources: [] } : r
      ),
    };
    expect(() => assertPillOk(brokenPill)).toThrow("has no sources");
  });

  it("loadAndCheckPill('ts-cc', '1.0') does not throw", () => {
    expect(() => loadAndCheckPill("ts-cc", "1.0")).not.toThrow();
  });
});

describe("T-C2a: v1.0 still refuses TS-CC-27", () => {
  it("checkPill on a pill with TS-CC-27 added gives an error", () => {
    const brokenPill = {
      ...pill,
      rules: [
        ...pill.rules,
        {
          id: "TS-CC-27",
          colour: "amber" as const,
          approver: "test",
          section: "test",
          label: "test",
          rule: "test",
          because: "test",
          applies_when: "test",
          not_when: "test",
          sources: [{ ref: "test", label: "test" }],
        },
      ],
    };
    const errors = checkPill(brokenPill);
    expect(errors.some((e) => e.includes("TS-CC-27"))).toBe(true);
  });
});

describe("T-C2a: non-1.0 red_stops must equal v1.0 exactly", () => {
  it("v1.1 with RS-04 action changed gets a red stop error", () => {
    const v11Pill = {
      ...pill,
      version: "1.1",
      red_stops: pill.red_stops.map((rs, i) =>
        i === 3 ? { ...rs, action: "CHANGED ACTION" } : rs
      ),
    };
    const errors = checkPill(v11Pill);
    expect(errors.some((e) => e.includes("red stop") && e.includes("RS-04"))).toBe(true);
  });

  it("v1.1 with same red stops gets no red stop error", () => {
    const v11Pill = {
      ...pill,
      version: "1.1",
    };
    const errors = checkPill(v11Pill);
    expect(errors.filter((e) => e.includes("red stop") || e.includes("RS-"))).toEqual([]);
  });
});
