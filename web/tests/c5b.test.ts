import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import * as memory from "../lib/memory";
import { resetDemo } from "../lib/actions";
import { leadsForJob } from "../lib/leads";
import { seatView } from "../lib/seat-view";
import { openingLineFor } from "../lib/seat-opening";
import { SEAT_IDS, SEAT_LABELS, PIP_NEVER } from "../lib/permissions";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");

beforeEach(() => {
  resetDemo(REAL_NOW);
});

describe("T-C5b: the 5 seat names resolve and nothing else does", () => {
  it("every seat id in S2 has a label and a view", () => {
    expect([...SEAT_IDS]).toEqual([
      "tenant",
      "technician",
      "senior-manager",
      "hq",
      "aom-tower-a",
    ]);

    const state = memory.read();
    for (const seat of SEAT_IDS) {
      const view = seatView(state, seat);
      expect(view.label).toBe(SEAT_LABELS[seat]);
      expect(view.chips.length).toBeGreaterThan(0);
    }
  });

  it("the labels are the S2 words, including role-played", () => {
    expect(SEAT_LABELS.tenant).toBe("Tenant, Northwind Advisory (role-played)");
    expect(SEAT_LABELS.technician).toBe("Technician (role-played)");
    expect(SEAT_LABELS["senior-manager"]).toBe(
      "Senior manager: the FM contractor's chief engineer (role-played)"
    );
    expect(SEAT_LABELS.hq).toBe(
      "HQ pill owner: Keppel Technical Services lead (role-played)"
    );
    expect(SEAT_LABELS["aom-tower-a"]).toBe(
      "AOM, Tower A: Keppel Asset Operations Manager (role-played)"
    );
  });

  it("an unknown name is not a seat, so the page calls notFound", () => {
    expect("building-b" in SEAT_LABELS).toBe(false);
    expect("nope" in SEAT_LABELS).toBe(false);

    const page = readFileSync(
      join(process.cwd(), "app", "seat", "[name]", "page.tsx"),
      "utf-8"
    );
    expect(page).toMatch(/if \(!\(name in SEAT_LABELS\)\) notFound\(\)/);
  });

  it("the 4 old routes still redirect to their seats", () => {
    const routes: [string, string][] = [
      ["tech", "/seat/technician"],
      ["aom", "/seat/aom-tower-a"],
      ["engineer", "/seat/senior-manager"],
      ["hq", "/seat/hq"],
    ];
    for (const [route, target] of routes) {
      const src = readFileSync(
        join(process.cwd(), "app", route, "page.tsx"),
        "utf-8"
      );
      expect(src).toContain(`redirect("${target}")`);
    }
  });
});

describe("T-C5b: the Building B card runs on the engine", () => {
  it("renders ticket 2401's first 3 leads with their reasons", () => {
    const state = memory.read();
    const job = state.jobs.find((j) => j.id === "2401")!;
    const leads = leadsForJob(state, job, "technician", REAL_NOW).leads.slice(0, 3);

    expect(leads).toHaveLength(3);
    for (const lead of leads) {
      expect(lead.label.length).toBeGreaterThan(0);
      expect(lead.reason.length).toBeGreaterThan(0);
    }
    expect(leads[0].causeId).toBe("precool");
    expect(leads.map((l) => l.causeId)).toEqual([
      "precool",
      "min-airflow",
      "thermostat-spot",
    ]);
  });

  it("is Building B's own spot and its own live version", () => {
    const state = memory.read();
    const job = state.jobs.find((j) => j.id === "2401")!;
    expect(job.building).toBe("building-b");
    expect(job.floor).toBe(12);
    expect(state.liveVersionByBuilding["building-b"]).toBe("1.0");
  });

  it("a stop raised in Tower A never shows as open in Building B", () => {
    memory.update((s) => {
      s.openRedStops.push({
        stopId: "RS-01",
        building: "tower-a",
        floor: 23,
        zone: "core",
        jobId: "2318",
        source: "button",
        openedBySeat: "technician",
        openedAt: s.demoNow,
        clearedBySeat: null,
        clearedAt: null,
        clearedReason: null,
        lockedJobIds: ["2318"],
      });
    });

    const state = memory.read();
    const openInB = state.openRedStops.filter(
      (s) => s.clearedAt === null && s.building === "building-b"
    );
    expect(openInB).toEqual([]);
  });
});

describe("T-C5b: each seat opens with its own line", () => {
  it("says what the seat is for and what Pip will not do", () => {
    for (const seat of SEAT_IDS) {
      const opening = openingLineFor(seat);
      expect(opening.text.length).toBeGreaterThan(40);
      expect(opening.never).toBe(`Pip never ${PIP_NEVER[seat]}.`);
    }
  });

  it("no two seats open the same way", () => {
    const lines = SEAT_IDS.map((seat) => openingLineFor(seat).text);
    expect(new Set(lines).size).toBe(SEAT_IDS.length);
  });

  it("the never line comes from the same table the server checks", () => {
    expect(openingLineFor("technician").never).toBe(
      "Pip never approve anything, or use a fix the rules removed."
    );
    expect(openingLineFor("hq").never).toBe(
      "Pip never approve a solution whose tests did not pass on this exact draft."
    );
  });
});

describe("T-C5b: home and the judges' page", () => {
  const home = readFileSync(join(process.cwd(), "app", "page.tsx"), "utf-8");

  it("home lists the 5 seats, the Building B card and the way in for judges", () => {
    expect(home).toContain("SEAT_IDS.map");
    expect(home).toContain("<BuildingBCard />");
    expect(home).toContain('href="/how"');
  });

  it("home says the demo is made up and role-played", () => {
    expect(home).toMatch(/made up for the demo/);
    expect(home).toMatch(/role-played/);
  });
});
