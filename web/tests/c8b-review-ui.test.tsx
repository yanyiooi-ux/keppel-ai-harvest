// @vitest-environment jsdom

/**
 * C8b review fixes on screen, fake fetch only: the HQ desk. The desks are the
 * real ones (seatView on the one memory, after the real presses), handed to
 * SeatChat by a fake fetch. Nothing reaches the network.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { SeatChat } from "../app/components/chat/SeatChat";
import * as memory from "../lib/memory";
import { resetDemo, runAction } from "../lib/actions";
import { actionTurn } from "../lib/action-turn";
import { leadsForJob } from "../lib/leads";
import { seatView, type SeatView } from "../lib/seat-view";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");

const DEMO_FIX =
  "If the zone had a fit-out in the last 12 months, check where the thermostat sits against the fit-out drawing before any nudge.";
const DEMO_WHY =
  "The fit-out 8 months ago moved the core thermostat next to the new printer bay, so it reads warm and the box keeps cooling the open area.";
const B_FIX = "Check the box minimum airflow setting against the design sheet before any other step.";
const B_WHY = "The box minimum airflow was left too high after the last balance, so the open area keeps getting cold air.";

const STALE_ROLLED_BACK =
  "This draft was built on v1.1, which was rolled back: every building is on v1.0 now, so approving it would bring back what v1.1 added. Decline it, and the senior manager logs the solution again on v1.0.";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => {
    throw new Error("the component reached the network");
  }));
  resetDemo(REAL_NOW);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function press(seat: string, action: string, jobId?: string, payload?: Record<string, unknown>) {
  const r = runAction({ seat, action, jobId, payload }, REAL_NOW);
  expect(r.ok, `${action}: ${r.message}`).toBe(true);
  return r;
}

async function log(jobId: string, fixLine: string, whyLine: string) {
  const r = await actionTurn(
    { seat: "senior-manager", action: "log-new-solution", jobId, payload: { fixLine, whyLine } },
    "off",
    undefined,
    REAL_NOW
  );
  expect(r.ok, r.message).toBe(true);
}

/** The C8b steps over the real presses: 2318's solution sent to HQ (AI off). */
async function sentToHq() {
  const report = press("tenant", "report", undefined, { complaint: "too cold" });
  for (const [questionId, answer] of [
    ["Q0", "No"],
    ["Q1", "Open area near the lift core"],
    ["Q2", "It keeps coming back"],
    ["Q3", "Yes"],
    ["Q4-thermostat", "Not sure"],
  ]) {
    press("tenant", "answer", report.jobId, { questionId, answer });
  }
  press("technician", "open-job", "2318");
  press("technician", "tick", "2318", { causeId: "precool", type: "not-this" });
  press("technician", "tick", "2318", { causeId: "min-airflow", type: "not-this" });
  press("technician", "not-solved", "2318", { hoursLost: 3, extraVisits: 2, contractorOrPartsNeeded: false });
  press("senior-manager", "tick", "2318", { causeId: "thermostat-spot", type: "found" });
  await log("2318", DEMO_FIX, DEMO_WHY);
  for (const [part, value] of [
    ["rule-text", DEMO_FIX],
    ["fact", "fit-out-12m"],
    ["effect-1", "block:25"],
    ["effect-2", "put-first:21"],
  ]) {
    press("senior-manager", "confirm-part", "2318", { part, value });
  }
  press("senior-manager", "run-tests", "2318");
  press("senior-manager", "send-to-hq", "2318");
}

/** v1.1 approved, a second solution drafted on 2401 on v1.1, v1.1 rolled back, then 2401's draft sent to HQ. */
async function staleDraftWithHq() {
  await sentToHq();
  press("hq", "approve-solution", "2318");
  press("technician", "open-job", "2401");
  const state = memory.read();
  const firstTwo = leadsForJob(state, memory.jobById(state, "2401")!, "technician", REAL_NOW).leads.slice(0, 2);
  for (const lead of firstTwo) press("technician", "tick", "2401", { causeId: lead.causeId, type: "not-this" });
  press("technician", "not-solved", "2401", { hoursLost: 3, extraVisits: 2, contractorOrPartsNeeded: false });
  press("senior-manager", "tick", "2401", { causeId: "min-airflow", type: "found" });
  await log("2401", B_FIX, B_WHY);
  for (const [part, value] of [
    ["rule-text", B_FIX],
    ["fact", "repeat"],
    ["effect-1", "put-first:17"],
    ["effect-2", "none"],
  ]) {
    press("senior-manager", "confirm-part", "2401", { part, value });
  }
  press("hq", "rollback", undefined, { version: "1.1" });
  press("senior-manager", "run-tests", "2401");
  press("senior-manager", "send-to-hq", "2401");
}

function hqView(): SeatView {
  const view = seatView(memory.read(), "hq", "off", REAL_NOW);
  expect(view.hq).toBeDefined();
  return view;
}

function renderHq(view: SeatView) {
  const fn = vi.fn(async (url: string) => ({ json: async () => (url === "/api/action" ? { ok: true, message: "Done." } : view) }) as Response);
  render(<SeatChat seat="hq" fetcher={fn} pollMs={0} jobId="2318" initial={view} />);
}

describe("C8b review: the HQ desk shows a draft built on a version that is no longer live", () => {
  it("the solution card lists the four gates holding and the base check failing, with its reason, next to Approve", async () => {
    await staleDraftWithHq();
    const view = hqView();
    const s = view.hq!.solutions.find((x) => x.jobId === "2401")!;
    renderHq(view);
    const card = await screen.findByTestId(`hq-solution-${s.id}`);
    const c = within(card);
    expect(c.getAllByText("Holds")).toHaveLength(4);
    expect(c.getByText("Fails")).toBeTruthy();
    expect(c.getByText("Built on the version live now")).toBeTruthy();
    expect(c.getByText(STALE_ROLLED_BACK)).toBeTruthy();
    expect(c.getByRole("button", { name: "Decline" })).toBeTruthy();
  });

  it("a draft built on the live version shows no base check: four gates, all holding", async () => {
    await sentToHq();
    renderHq(hqView());
    const card = await screen.findByTestId("hq-solution-S-1");
    expect(within(card).getAllByText("Holds")).toHaveLength(4);
    expect(within(card).queryByText("Fails")).toBeNull();
    expect(within(card).queryByText("Built on the version live now")).toBeNull();
  });
});

describe("C8b review: the HQ seat's Building B card after Roll back", () => {
  it("shows v1.0 with the rolled-back notice, and no longer says v1.1 is live", async () => {
    await sentToHq();
    press("hq", "approve-solution", "2318");
    press("hq", "rollback", undefined, { version: "1.1" });
    renderHq(hqView());
    const card = await screen.findByTestId("hq-building-b");
    expect(within(card).getByText(/^Live version v1\.0\./)).toBeTruthy();
    expect(within(card).getByText(/v1\.1 was rolled back: every building is on v1\.0 again/)).toBeTruthy();
    expect(within(card).queryByText(/v1\.1 is live in every building/)).toBeNull();
  });
});
