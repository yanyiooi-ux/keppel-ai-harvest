// @vitest-environment jsdom

/**
 * C8b on screen, fake fetch only: the HQ desk. The desks are the real ones
 * (seatView on the one memory, after the real presses), handed to SeatChat by
 * a fake fetch, so the screen shows exactly what /api/state returns. Every
 * press is caught by the fake fetch; nothing reaches the network.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent, within } from "@testing-library/react";
import { SeatChat } from "../app/components/chat/SeatChat";
import * as memory from "../lib/memory";
import { resetDemo, runAction } from "../lib/actions";
import { actionTurn } from "../lib/action-turn";
import { seatView, type SeatView } from "../lib/seat-view";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");

const DEMO_FIX =
  "If the zone had a fit-out in the last 12 months, check where the thermostat sits against the fit-out drawing before any nudge.";
const DEMO_WHY =
  "The fit-out 8 months ago moved the core thermostat next to the new printer bay, so it reads warm and the box keeps cooling the open area.";

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

type Body = Record<string, unknown>;

function press(seat: string, action: string, jobId?: string, payload?: Record<string, unknown>) {
  const r = runAction({ seat, action, jobId, payload }, REAL_NOW);
  expect(r.ok, `${action}: ${r.message}`).toBe(true);
  return r;
}

/** The C8a steps over the real presses, to Send to HQ (AI off). */
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
  const logged = await actionTurn(
    { seat: "senior-manager", action: "log-new-solution", jobId: "2318", payload: { fixLine: DEMO_FIX, whyLine: DEMO_WHY } },
    "off",
    undefined,
    REAL_NOW
  );
  expect(logged.ok).toBe(true);
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

function hqView(): SeatView {
  const view = seatView(memory.read(), "hq", "off", REAL_NOW);
  expect(view.hq).toBeDefined();
  return view;
}

function fakeFetch(view: SeatView, action: (body: Body | null) => unknown) {
  const calls: { url: string; body: Body | null }[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? (JSON.parse(String(init.body)) as Body) : null;
    calls.push({ url, body });
    return { json: async () => (url === "/api/action" ? action(body) : view) } as Response;
  });
  return { fn, calls };
}

function presses(calls: { url: string; body: Body | null }[]) {
  return calls.filter((c) => c.url === "/api/action").map((c) => c.body);
}

function renderHq(view: SeatView, action: (body: Body | null) => unknown = () => ({ ok: true, message: "Done." })) {
  const { fn, calls } = fakeFetch(view, action);
  render(<SeatChat seat="hq" fetcher={fn} pollMs={0} jobId="2318" initial={view} />);
  return calls;
}

describe("C8b: the A1 card and the live versions", () => {
  it("the A1 card shows v1.0 signed by two senior experts (role-played), with each building's live version", async () => {
    renderHq(hqView());
    const a1 = (await screen.findByText("Version 1 of the brain")).closest("article")!;
    expect(within(a1 as HTMLElement).getByText("v1.0 signed by two senior experts (role-played)")).toBeTruthy();
    expect(within(a1 as HTMLElement).getByText("Signed")).toBeTruthy();
    expect(screen.getByText("Tower A: v1.0")).toBeTruthy();
    expect(screen.getByText("Building B: v1.0")).toBeTruthy();
    expect(screen.getByText("No new solution has been sent to HQ yet.")).toBeTruthy();
  });
});

describe("C8b: a solution sent to HQ", () => {
  it("shows the fix line, the why line, the rule text and each part of the condition with its label, the test counts, the hash and the gates", async () => {
    await sentToHq();
    const view = hqView();
    const s = view.hq!.solutions[0];
    renderHq(view);
    const card = await screen.findByTestId("hq-solution-S-1");
    const c = within(card);
    expect(c.getByText("Sent to HQ")).toBeTruthy();
    expect(c.getAllByText(DEMO_FIX).length).toBe(2);
    expect(c.getByText(DEMO_WHY)).toBeTruthy();
    expect(c.getByText("typed")).toBeTruthy();
    expect(c.getAllByText("picked by hand")).toHaveLength(3);
    expect(c.getByText("Renovated in the last 12 months")).toBeTruthy();
    expect(c.getByText("Block step 25")).toBeTruthy();
    expect(c.getByText("Put step 21 first")).toBeTruthy();
    expect(c.getByText("23 passed")).toBeTruthy();
    expect(c.getByText("0 failed")).toBeTruthy();
    expect(c.getByText("2 not applicable")).toBeTruthy();
    expect(c.getByText(`Tests on draft v1.1 · ${s.hash7}`)).toBeTruthy();
    expect(c.getAllByText("Holds")).toHaveLength(4);
  });

  it("Approve and send to all buildings presses approve-solution on the job", async () => {
    await sentToHq();
    const calls = renderHq(hqView());
    const card = await screen.findByTestId("hq-solution-S-1");
    fireEvent.click(within(card).getByRole("button", { name: "Approve and send to all buildings" }));
    await waitFor(() => expect(presses(calls)).toHaveLength(1));
    expect(presses(calls)[0]).toEqual({ seat: "hq", action: "approve-solution", job: "2318" });
  });

  it("Decline opens a reason box and sends the reason", async () => {
    await sentToHq();
    const calls = renderHq(hqView());
    const card = await screen.findByTestId("hq-solution-S-1");
    fireEvent.click(within(card).getByRole("button", { name: "Decline" }));
    fireEvent.change(within(card).getByLabelText("Reason for declining (3 words or more)"), {
      target: { value: "Check the drawing with the tenant first" },
    });
    fireEvent.click(within(card).getByRole("button", { name: "Decline with this reason" }));
    await waitFor(() => expect(presses(calls)).toHaveLength(1));
    expect(presses(calls)[0]).toEqual({
      seat: "hq",
      action: "decline-solution",
      job: "2318",
      payload: { reason: "Check the drawing with the tenant first" },
    });
  });

  it("a refused Approve shows its reason inside the solution's card, not at the end of the chat", async () => {
    await sentToHq();
    const reason = "The stored test run has 1 failed: approval needs 0 failed.";
    renderHq(hqView(), () => ({ ok: false, message: reason }));
    const card = await screen.findByTestId("hq-solution-S-1");
    fireEvent.click(within(card).getByRole("button", { name: "Approve and send to all buildings" }));
    await waitFor(() => expect(within(card).getByText(reason)).toBeTruthy());
    expect(screen.getAllByText(reason)).toHaveLength(1);
  });
});

describe("C8b: after Approve", () => {
  async function approved() {
    await sentToHq();
    press("hq", "approve-solution", "2318");
    return hqView();
  }

  it("the solution shows Approved and distributed, with no Approve or Decline", async () => {
    renderHq(await approved());
    const card = await screen.findByTestId("hq-solution-S-1");
    expect(within(card).getByText("Approved and distributed")).toBeTruthy();
    expect(within(card).queryByRole("button", { name: "Approve and send to all buildings" })).toBeNull();
    expect(within(card).queryByRole("button", { name: "Decline" })).toBeNull();
    expect(screen.getByText("Tower A: v1.1")).toBeTruthy();
    expect(screen.getByText("Building B: v1.1")).toBeTruthy();
  });

  it("the versions list is newest first, like commits, and Roll back sends the live version", async () => {
    const view = await approved();
    const calls = renderHq(view);
    const list = await screen.findByTestId("hq-versions");
    const rows = within(list).getAllByRole("listitem").map((li) => li.textContent ?? "");
    expect(rows[0]).toContain(`v1.1 · ${view.hq!.versions[0].hash7} · approved by HQ pill owner (role-played) · parent v1.0`);
    expect(rows[0]).toContain("Live");
    expect(rows[1]).toContain("v1.0 · ");
    expect(rows[1]).toContain("signed by two senior experts (role-played)");
    fireEvent.click(within(list).getByRole("button", { name: "Roll back v1.1" }));
    await waitFor(() => expect(presses(calls)).toHaveLength(1));
    expect(presses(calls)[0]).toEqual({ seat: "hq", action: "rollback", payload: { version: "1.1" } });
  });

  it("the Building B card shows v1.1 and the thermostat check first, with no tick buttons", async () => {
    renderHq(await approved());
    const card = await screen.findByTestId("hq-building-b");
    expect(within(card).getByText("Building B, Level 12 (made up)")).toBeTruthy();
    expect(within(card).getByText(/^Live version v1\.1\./)).toBeTruthy();
    const leads = within(card).getAllByTestId("lead-card");
    expect(leads).toHaveLength(3);
    expect(leads[0].getAttribute("data-cause")).toBe("thermostat-spot");
    expect(within(card).queryByRole("button", { name: /Found it|Not this/ })).toBeNull();
    expect(within(card).getByText(/v1\.1 is live in every building \(role-played approval by HQ\)\./)).toBeTruthy();
  });

  it("before Approve the Building B card ranks precool first on v1.0", async () => {
    await sentToHq();
    renderHq(hqView());
    const card = await screen.findByTestId("hq-building-b");
    expect(within(card).getByText(/^Live version v1\.0\./)).toBeTruthy();
    expect(within(card).getAllByTestId("lead-card")[0].getAttribute("data-cause")).toBe("precool");
  });
});

describe("C8b: outside help (A3)", () => {
  async function asked() {
    await sentToHq();
    // A second job is not needed: decline 2318's draft so it is escalated, then ask HQ for outside help on it.
    press("hq", "decline-solution", "2318", { reason: "Check the drawing with the tenant first" });
    press("senior-manager", "ask-outside-help", "2318", {
      need: "contractor",
      reason: "The air needs a specialist balance",
      needsMoney: true,
    });
    return hqView();
  }

  for (const [decision, label] of [
    ["approve", "Approve"],
    ["decline", "Decline"],
  ] as const) {
    it(`${label} sends the decision with the reason`, async () => {
      const calls = renderHq(await asked());
      const row = await screen.findByTestId("hq-request-A3-1");
      expect(within(row).getByText("Waiting on you")).toBeTruthy();
      expect(within(row).getByText("Reason: The air needs a specialist balance")).toBeTruthy();
      fireEvent.change(within(row).getByLabelText("Reason (3 words or more)"), {
        target: { value: "Book the balancing contractor now" },
      });
      fireEvent.click(within(row).getByRole("button", { name: `${label} outside help for job 2318` }));
      await waitFor(() => expect(presses(calls)).toHaveLength(1));
      expect(presses(calls)[0]).toEqual({
        seat: "hq",
        action: "decide-outside-help",
        job: "2318",
        payload: { decision, reason: "Book the balancing contractor now" },
      });
    });
  }

  it("a decided request shows its result and no buttons", async () => {
    await asked();
    press("hq", "decide-outside-help", "2318", { decision: "decline", reason: "Try the fit-out contractor first" });
    renderHq(hqView());
    const row = await screen.findByTestId("hq-request-A3-1");
    expect(within(row).getByText("declined: Try the fit-out contractor first")).toBeTruthy();
    expect(within(row).queryByRole("button", { name: /outside help for job/ })).toBeNull();
  });
});
