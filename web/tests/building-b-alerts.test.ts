import { describe, it, expect, beforeEach } from "vitest";
import * as memory from "../lib/memory";
import { resetDemo, runAction } from "../lib/actions";
import { buildingBAlerts } from "../app/components/BuildingBCard";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");

beforeEach(() => {
  resetDemo(REAL_NOW);
});

describe("S11: Building B's alerts go on its card", () => {
  it("a stop raised on 2401 shows on the Building B card", () => {
    expect(buildingBAlerts(memory.read())).toEqual([]);

    const press = runAction(
      { seat: "technician", action: "safety-pick", jobId: "2401", payload: { stopId: "RS-04" } },
      REAL_NOW
    );
    expect(press.ok).toBe(true);

    const alerts = buildingBAlerts(memory.read());
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.every((a) => a.kind === "alert")).toBe(true);
    expect(alerts[0].text).toMatch(/RS-04/);
  });

  it("a stop raised in Tower A never lands on the Building B card", () => {
    runAction(
      { seat: "technician", action: "safety-pick", jobId: "2318", payload: { stopId: "RS-04" } },
      REAL_NOW
    );
    expect(buildingBAlerts(memory.read())).toEqual([]);
  });
});
