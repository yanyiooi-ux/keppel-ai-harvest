// @vitest-environment jsdom

/**
 * C7 selfcheck (run rule 3f), on screen with a fake fetch: T-C7b's "each tick
 * re-ranks within one poll (2 seconds)" for a tick the screen did not make
 * itself (another tab or seat). The live chat polls every 2 seconds, so the new
 * order is on screen by the next poll.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { SeatChat } from "../app/components/chat/SeatChat";
import type { TechnicianDesk, DeskLead } from "../lib/technician-desk";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => {
    throw new Error("the component reached the network");
  }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function lead(causeId: string, label: string): DeskLead {
  return {
    causeId,
    label,
    tier: "case-backed",
    tierWord: "case backed",
    reason: `Code reason for ${label}.`,
    checkStep: 17,
    checkText: `Check text for ${label}.`,
    checkTime: "15 minutes",
    fixLine: `Fix line for ${label}.`,
    fixAllowedHere: false,
    tick: null,
    receipt: "pill v1.0 · AI calls: 0",
    aiCalls: 0,
  };
}

const PRECOOL = lead("precool", "Morning start-up runs too cold");
const MIN_AIR = lead("min-airflow", "Core box held at minimum airflow");
const THERMO = lead("thermostat-spot", "Thermostat in the wrong spot after a fit-out");

function techState(leads: DeskLead[], ruledOut: DeskLead[]) {
  const desk: TechnicianDesk = {
    title: "Jobs in Tower A",
    jobs: [
      { id: "2318", place: "Level 23, core", complaint: "too cold", reported: "6 Oct, 09:10", status: "in-progress", canOpen: false, isOpen: true },
    ],
    open: {
      jobId: "2318",
      title: "Job 2318 · Tower A, Level 23, core",
      status: "in-progress",
      statusLine: "In progress.",
      inProgress: true,
      locked: null,
      checklist: [],
      note: "",
      leads,
      ruledOut,
      removed: [],
      steps: [],
    },
  };
  return {
    seat: "technician",
    label: "Technician (role-played)",
    chips: ["Safety"],
    messages: [],
    notices: [],
    desk,
  };
}

function liveOrder(): string[] {
  return screen
    .queryAllByTestId("lead-card")
    .filter((el) => el.closest("details") === null)
    .map((el) => el.getAttribute("data-cause") ?? "");
}

describe("T-C7b: a tick made elsewhere re-ranks on screen within one poll (2 seconds)", () => {
  it("the live chat (no pollMs given) reads the view again 2 seconds after the last read, and shows the new order", async () => {
    vi.useFakeTimers();
    let reads = 0;
    const fn = vi.fn(async (url: string) => {
      if (url.startsWith("/api/state")) reads += 1;
      // Between the first and second read, another screen ticked Not this on precool.
      const body = reads <= 1 ? techState([PRECOOL, MIN_AIR, THERMO], []) : techState([MIN_AIR, THERMO], [{ ...PRECOOL, tick: "not-this" }]);
      return { json: async () => body } as Response;
    });

    render(<SeatChat seat="technician" fetcher={fn} jobId="2318" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(reads).toBe(1);
    expect(liveOrder()).toEqual(["precool", "min-airflow", "thermostat-spot"]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1999);
    });
    expect(reads).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(reads).toBe(2);
    expect(liveOrder()).toEqual(["min-airflow", "thermostat-spot"]);
  });
});
