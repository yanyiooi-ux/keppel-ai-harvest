// @vitest-environment jsdom

/**
 * C9 on screen, fake fetch only: the AOM desk and the tenant's charge card.
 * The views are the real ones (seatView on the one memory, after the real
 * presses), handed to SeatChat by a fake fetch, so the screen shows exactly
 * what /api/state returns. Every press is caught by the fake fetch; nothing
 * reaches the network.
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

const LABEL = "Worked out on made-up demo data. It assumes the cause is found on the visit where the repeat is caught.";
const TENANT_CARD_350 =
  "What we will do: Our contractor will move the wall thermostat back to the spot on your approved fit-out drawing, with your OK. Cost: S$350, made-up demo amount. Approved by the Asset Operations Manager (role-played).";
const REASON = "Fit-out work is the tenant's own";

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

/** The C8 steps over the real presses, AI off, to HQ's Approve. Returns the A4 request's id. */
async function approved(): Promise<string> {
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
  press("hq", "approve-solution", "2318");
  const a4 = (memory.read().requests as { kind?: string; id: string }[]).filter((r) => r.kind === "A4");
  expect(a4).toHaveLength(1);
  return a4[0].id;
}

function view(seat: string): SeatView {
  return seatView(memory.read(), seat, "off", REAL_NOW);
}

function fakeFetch(state: SeatView, action: (body: Body | null) => unknown) {
  const calls: { url: string; body: Body | null }[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? (JSON.parse(String(init.body)) as Body) : null;
    calls.push({ url, body });
    return { json: async () => (url === "/api/action" ? action(body) : state) } as Response;
  });
  return { fn, calls };
}

function presses(calls: { url: string; body: Body | null }[]) {
  return calls.filter((c) => c.url === "/api/action").map((c) => c.body);
}

function renderAom(state: SeatView, action: (body: Body | null) => unknown = () => ({ ok: true, message: "Done." })) {
  const { fn, calls } = fakeFetch(state, action);
  render(<SeatChat seat="aom-tower-a" fetcher={fn} pollMs={0} initial={state} />);
  return calls;
}

describe("C9: the impact meter on the AOM seat", () => {
  it("opens on Before: 5 calls, 5 visits, 0 senior manager checks, not fixed after 21 days, 4 repeat calls, S$600 and counting", async () => {
    renderAom(view("aom-tower-a"));
    const meter = await screen.findByTestId("aom-meter");
    const m = within(meter);
    expect(m.getByRole("tab", { name: "Before" }).getAttribute("aria-selected")).toBe("true");
    expect(m.getByRole("tab", { name: "With Pill Desk" }).getAttribute("aria-selected")).toBe("false");
    const panel = m.getByRole("tabpanel");
    const p = within(panel);
    expect(p.getByText("As it happened")).toBeTruthy();
    expect(p.getByText("Calls").nextElementSibling!.textContent).toBe("5");
    expect(p.getByText("Visits").nextElementSibling!.textContent).toBe("5");
    expect(p.getByText("Senior manager checks").nextElementSibling!.textContent).toBe("0");
    expect(p.getByText("Days to a real fix").nextElementSibling!.textContent).toBe("not fixed after 21 days");
    expect(p.getByText("Repeat calls").nextElementSibling!.textContent).toBe("4");
    expect(p.getByText("Cost").nextElementSibling!.textContent).toBe("S$600 and counting");
    expect(m.getByText(LABEL)).toBeTruthy();
  });

  it("With Pill Desk: caught at 2305 on 19 Sep, 2 calls, 2 visits, 1 senior check, 4 days, 1 repeat call, S$420; the label stays", async () => {
    const calls = renderAom(view("aom-tower-a"));
    const meter = await screen.findByTestId("aom-meter");
    fireEvent.click(within(meter).getByRole("tab", { name: "With Pill Desk" }));
    const m = within(meter);
    expect(m.getByRole("tab", { name: "With Pill Desk" }).getAttribute("aria-selected")).toBe("true");
    const p = within(m.getByRole("tabpanel"));
    expect(p.getByText("Replayed by code")).toBeTruthy();
    expect(p.getByText("Caught at 2305 on 19 Sep")).toBeTruthy();
    expect(p.getByText("Calls").nextElementSibling!.textContent).toBe("2");
    expect(p.getByText("Visits").nextElementSibling!.textContent).toBe("2");
    expect(p.getByText("Senior manager checks").nextElementSibling!.textContent).toBe("1");
    expect(p.getByText("Days to a real fix").nextElementSibling!.textContent).toBe("4 days");
    expect(p.getByText("Repeat calls").nextElementSibling!.textContent).toBe("1");
    expect(p.getByText("Cost").nextElementSibling!.textContent).toBe("S$420");
    expect(m.getByText(LABEL)).toBeTruthy();
    // The tabs are only a view: switching sends nothing.
    expect(presses(calls)).toHaveLength(0);
  });

  it("shows the speak-first flag for Tower A Level 23 with its word", async () => {
    renderAom(view("aom-tower-a"));
    const meter = await screen.findByTestId("aom-meter");
    expect(within(meter).getByText("This spot keeps calling")).toBeTruthy();
    expect(
      within(meter).getByText(/^Speak first: /).textContent
    ).toBe(
      "Speak first: Tower A Level 23 has called 5 times in 30 days, with opposite fixes (repeat flag, “The repeat rule: no more quick fixes” TS-CC-09). Quick fixes are off for this spot. Find the cause before they call again."
    );
  });

  it("shows the live version in Tower A with no button, and no charge request yet", async () => {
    renderAom(view("aom-tower-a"));
    const live = await screen.findByTestId("aom-live");
    expect(within(live).getByText(/^v1\.0 · [0-9a-f]{7} · signed by two senior experts \(role-played\)$/)).toBeTruthy();
    expect(within(live).queryByRole("button")).toBeNull();
    expect(screen.getByText("No charge request is waiting on you.")).toBeTruthy();
  });
});

describe("C9: the charge request and Decide charge", () => {
  it("shows the request word for word, with the three choices, a number field and a reason", async () => {
    const id = await approved();
    renderAom(view("aom-tower-a"));
    const card = await screen.findByTestId(`aom-charge-${id}`);
    const c = within(card);
    expect(c.getByText("Waits on you")).toBeTruthy();
    expect(
      c.getByText(/^Tenant will hear: /).textContent
    ).toBe(
      'Tenant will hear: "Our contractor will move the wall thermostat back to the spot on your approved fit-out drawing, with your OK." This is work on the tenant\'s fit-out (“Renovation items: check who owns them first” TS-CC-11). Who pays?'
    );
    expect(c.getByRole("radio", { name: "Tenant pays" })).toBeTruthy();
    expect(c.getByRole("radio", { name: "Landlord pays" })).toBeTruthy();
    expect(c.getByRole("radio", { name: "Goodwill, no charge" })).toBeTruthy();
    // The amount field shows only for Tenant pays.
    expect(c.queryByRole("spinbutton")).toBeNull();
    fireEvent.click(c.getByRole("radio", { name: "Tenant pays" }));
    const amount = c.getByRole("spinbutton") as HTMLInputElement;
    expect(amount.type).toBe("number");
    expect(amount.min).toBe("1");
    expect(amount.max).toBe("100000");
    expect(amount.step).toBe("1");
    expect(c.getByLabelText("Reason (3 words or more)")).toBeTruthy();
  });

  it("Tenant pays sends decide-charge with the amount as a whole number and the reason", async () => {
    const id = await approved();
    const calls = renderAom(view("aom-tower-a"));
    const card = await screen.findByTestId(`aom-charge-${id}`);
    const c = within(card);
    fireEvent.click(c.getByRole("radio", { name: "Tenant pays" }));
    fireEvent.change(c.getByRole("spinbutton"), { target: { value: "350" } });
    fireEvent.change(c.getByLabelText("Reason (3 words or more)"), { target: { value: REASON } });
    fireEvent.click(c.getByRole("button", { name: "Decide charge" }));
    await waitFor(() => expect(presses(calls)).toHaveLength(1));
    expect(presses(calls)[0]).toEqual({
      seat: "aom-tower-a",
      action: "decide-charge",
      job: "2318",
      payload: { requestId: id, choice: "tenant-pays", amount: 350, reason: REASON },
    });
  });

  it("Goodwill sends no amount", async () => {
    const id = await approved();
    const calls = renderAom(view("aom-tower-a"));
    const card = await screen.findByTestId(`aom-charge-${id}`);
    const c = within(card);
    fireEvent.click(c.getByRole("radio", { name: "Goodwill, no charge" }));
    fireEvent.change(c.getByLabelText("Reason (3 words or more)"), { target: { value: REASON } });
    fireEvent.click(c.getByRole("button", { name: "Decide charge" }));
    await waitFor(() => expect(presses(calls)).toHaveLength(1));
    expect(presses(calls)[0]).toEqual({
      seat: "aom-tower-a",
      action: "decide-charge",
      job: "2318",
      payload: { requestId: id, choice: "goodwill", reason: REASON },
    });
  });

  it("a refused Decide charge shows its reason inside the request's card, once", async () => {
    const id = await approved();
    const reason = "Tenant pays needs a whole-number amount from 1 to 100000, typed in the number field.";
    renderAom(view("aom-tower-a"), () => ({ ok: false, message: reason }));
    const card = await screen.findByTestId(`aom-charge-${id}`);
    const c = within(card);
    fireEvent.click(c.getByRole("radio", { name: "Tenant pays" }));
    fireEvent.change(c.getByLabelText("Reason (3 words or more)"), { target: { value: REASON } });
    fireEvent.click(c.getByRole("button", { name: "Decide charge" }));
    await waitFor(() => expect(c.getByText(reason)).toBeTruthy());
    expect(screen.getAllByText(reason)).toHaveLength(1);
  });

  it("once decided, the card shows the decision and the tenant's card, with no form", async () => {
    const id = await approved();
    press("aom-tower-a", "decide-charge", "2318", { requestId: id, choice: "tenant-pays", amount: 350, reason: REASON });
    renderAom(view("aom-tower-a"));
    const card = await screen.findByTestId(`aom-charge-${id}`);
    const c = within(card);
    expect(c.getByText("Decided")).toBeTruthy();
    expect(c.getByText("Tenant pays · S$350, made-up demo amount")).toBeTruthy();
    expect(c.getByText(`Reason: ${REASON}`)).toBeTruthy();
    expect(c.getByText(TENANT_CARD_350)).toBeTruthy();
    expect(c.queryByRole("button", { name: "Decide charge" })).toBeNull();
    expect(c.queryByRole("radio")).toBeNull();
  });

  it("the AOM's notice list does not repeat the charge request the desk shows", async () => {
    await approved();
    renderAom(view("aom-tower-a"));
    await screen.findByTestId("aom-meter");
    expect(screen.getAllByText(/^Tenant will hear:/)).toHaveLength(1);
  });

  it("the tenant seat shows the code card after the decision, and none before", async () => {
    const id = await approved();
    const { fn } = fakeFetch(view("tenant"), () => ({ ok: true }));
    const first = render(<SeatChat seat="tenant" fetcher={fn} pollMs={0} initial={view("tenant")} />);
    await screen.findByText("Report a problem");
    expect(screen.queryByText(/What we will do/)).toBeNull();
    first.unmount();

    press("aom-tower-a", "decide-charge", "2318", { requestId: id, choice: "tenant-pays", amount: 350, reason: REASON });
    const after = view("tenant");
    const { fn: fn2 } = fakeFetch(after, () => ({ ok: true }));
    render(<SeatChat seat="tenant" fetcher={fn2} pollMs={0} initial={after} />);
    expect((await screen.findAllByText(TENANT_CARD_350)).length).toBeGreaterThan(0);
  });
});

describe("C9: safety alerts and the impact record on the AOM seat", () => {
  it("a red stop on Tower A Level 23 shows in the alerts with what is open now", async () => {
    press("aom-tower-a", "safety-pick", undefined, { stopId: "RS-04" });
    renderAom(view("aom-tower-a"));
    const alerts = await screen.findByTestId("aom-alerts");
    expect(within(alerts).getByText(/^Open now in Tower A: /).textContent).toBe("Open now in Tower A: Water near the electrics RS-04 on Level 23");
    expect(within(alerts).getByText(/Red stop on Tower A, Level 23/)).toBeTruthy();
  });

  it("the Not solved impact record shows with its cost", async () => {
    press("technician", "open-job", "2318");
    press("technician", "tick", "2318", { causeId: "precool", type: "not-this" });
    press("technician", "tick", "2318", { causeId: "min-airflow", type: "not-this" });
    press("technician", "not-solved", "2318", { hoursLost: 3, extraVisits: 2, contractorOrPartsNeeded: false });
    renderAom(view("aom-tower-a"));
    const records = await screen.findByTestId("aom-impact-records");
    expect(
      within(records).getByText(
        "Impact record: 3 hours lost, 2 extra visits, contractor or parts needed: no. Cost: S$420 (made-up rates: S$60 an hour, a visit is 2 hours)."
      )
    ).toBeTruthy();
  });
});
