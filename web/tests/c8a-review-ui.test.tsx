// @vitest-environment jsdom

/**
 * Review findings for C8a on screen, fake fetch only, each pinned before its
 * fix.
 *
 * - A refused Clear stop or Confirm cause shows its reason in the row that was
 *   pressed, so it is on screen next to the button: not at the end of the
 *   chat (where it lands when an open stop locks the job on the desk and there
 *   is no bar), and not in the job's bar further down.
 * - The Clear stop row is a red stop card (S11): the stop's action as its body
 *   and its receipt with the pill version, both from the server.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent, within } from "@testing-library/react";
import { SeatChat } from "../app/components/chat/SeatChat";
import type { OpenJobDesk } from "../lib/technician-desk";
import type { ManagerDesk, ManagerOpenJob, ManagerStopRow, ManagerCaseRow } from "../lib/senior-manager-desk";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => {
    throw new Error("the component reached the network");
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type Body = Record<string, unknown>;

const SM = "Senior manager: the FM contractor's chief engineer (role-played)";
const REFUSED_TICK =
  "This stop's who to call names the Fire Safety Manager: tick \"Safety record: Fire Safety Manager told and agreed (role-played)\" first. This is a safety record, not an approval.";
const REFUSED_CASE = "Confirm cause is only for a pending case: the spot called again within 30 days, so this fix failed.";

function openDesk(extra: Partial<OpenJobDesk> = {}): OpenJobDesk {
  return {
    jobId: "2318",
    title: "Job 2318 · Tower A, Level 23, core",
    status: "escalated",
    statusLine: "Escalated: with the senior manager, everything attached.",
    inProgress: false,
    locked: null,
    checklist: [],
    note: "",
    leads: [],
    ruledOut: [],
    removed: [],
    steps: [],
    ...extra,
  };
}

/** The job on the desk, locked by the open stop on its floor: only the red card and the lock line, no bar. */
const LOCKED = openDesk({
  locked: {
    cards: [
      {
        id: "locked-RS-01",
        from: "RS-01 · Tower A, Level 23",
        title: "Trigger of RS-01.",
        body: "Action of RS-01.",
        call: "Who to call for RS-01",
        colour: "red",
        colourWord: "Stop",
        receipt: "Red stop RS-01 · pill v1.0 · AI calls: 0",
      },
    ],
    lockLines: ["The lock line read from the pill."],
  },
});

function managerOpen(open: OpenJobDesk, extra: Partial<ManagerOpenJob> = {}): ManagerOpenJob {
  return {
    open,
    cameUp: "Not solved by Technician (role-played), 6 Oct, 10:00.",
    facts: ["cold mornings"],
    ticks: [],
    impact: null,
    editable: open.locked === null,
    solution: null,
    outsideHelp: null,
    ...extra,
  };
}

function stop(stopId: string, needs: boolean): ManagerStopRow {
  return {
    key: `${stopId}|tower-a|23|core|button|2026-10-06T10:00:00+08:00`,
    stopId,
    place: "Tower A, Level 23",
    title: `Trigger of ${stopId}.`,
    action: `Action of ${stopId}.`,
    call: `Who to call for ${stopId}`,
    receipt: `Red stop ${stopId} · pill v1.0 · AI calls: 0`,
    opened: "Raised by Senior manager (role-played), 6 Oct, 10:00. 1 job locked.",
    needsSafetyRecord: needs,
    ...(needs
      ? {
          safetyRecordLabel: "Safety record: Fire Safety Manager told and agreed (role-played)",
          note: "This is a safety record, not an approval.",
        }
      : {}),
  };
}

const CASE: ManagerCaseRow = {
  id: "R-01",
  jobId: "2319",
  line: "R-01 · job 2319 · Sun heat on the west glass",
  why: "Blinds were up.",
  canConfirm: true,
};

function managerDesk(extra: Partial<ManagerDesk> = {}): ManagerDesk {
  return {
    title: "Jobs with you",
    jobs: [
      { id: "2318", place: "Tower A, Level 23, core", complaint: "too cold", status: "escalated", statusWord: "Escalated", isOpen: true, canShow: false },
    ],
    open: managerOpen(LOCKED),
    cases: [],
    stops: [stop("RS-01", true), stop("RS-04", false)],
    menu: { facts: [], effects: [] },
    ...extra,
  };
}

function smState(d: ManagerDesk) {
  return {
    seat: "senior-manager",
    label: SM,
    pipNever: "approve their own new solution",
    chips: ["What needs me", "Safety"],
    // A long chat below the desk: a refusal at its end would be far off screen.
    messages: Array.from({ length: 6 }, (_, i) => ({
      seat: "senior-manager",
      from: "pip" as const,
      text: `Card ${i}`,
      at: "2026-10-06T10:00:00+08:00",
      cards: [{ kind: "answer", title: `Card ${i}`, body: `Body ${i}`, receipt: "Code · AI calls: 0" }],
    })),
    notices: [{ seat: "senior-manager", kind: "alert", text: "Red stop on Tower A, Level 23", at: "2026-10-06T10:00:00+08:00" }],
    manager: d,
  };
}

function renderDesk(d: ManagerDesk, action: (body: Body | null) => unknown) {
  const calls: { url: string; body: Body | null }[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? (JSON.parse(String(init.body)) as Body) : null;
    calls.push({ url, body });
    return { json: async () => (url === "/api/action" ? action(body) : smState(d)) } as Response;
  });
  render(<SeatChat seat="senior-manager" fetcher={fn} pollMs={0} jobId="2318" initial={smState(d) as never} />);
  return calls;
}

function presses(calls: { url: string; body: Body | null }[]) {
  return calls.filter((c) => c.url === "/api/action").map((c) => c.body);
}

/** Every refusal on screen, and where it sits. */
function refusals() {
  return Array.from(document.querySelectorAll(".notice.refused"));
}

describe("C8a review: a refused Clear stop shows in the stop's own row", () => {
  it("with the job on the desk locked (no bar), the reason shows in the pressed row and nowhere else", async () => {
    const calls = renderDesk(managerDesk(), (body) =>
      body?.action === "clear-stop" ? { ok: false, message: REFUSED_TICK } : { ok: true, message: "Done." }
    );
    const row = within(await screen.findByTestId("stop-RS-01"));
    expect(screen.queryByRole("group", { name: /presses/ })).toBeNull();
    fireEvent.change(row.getByLabelText("Reason (3 words or more)"), { target: { value: "alarm test finished now" } });
    fireEvent.click(row.getByRole("button", { name: "Clear stop RS-01" }));
    await waitFor(() => expect(presses(calls)).toHaveLength(1));
    expect(await row.findByText(REFUSED_TICK)).toBeTruthy();
    expect(refusals()).toHaveLength(1);
    expect(refusals()[0].closest('[data-testid="stop-RS-01"]')).not.toBeNull();
    expect(within(screen.getByTestId("stop-RS-04")).queryByText(REFUSED_TICK)).toBeNull();
  });

  it("with the bar on screen, the reason still shows in the pressed row, not in the bar", async () => {
    const unlocked = managerDesk({ open: managerOpen(openDesk()) });
    const calls = renderDesk(unlocked, () => ({ ok: false, message: "Clear stop needs a reason of 3 words or more." }));
    const bar = within(await screen.findByRole("group", { name: "Job 2318 presses" }));
    const row = within(screen.getByTestId("stop-RS-04"));
    fireEvent.change(row.getByLabelText("Reason (3 words or more)"), { target: { value: "All dry" } });
    fireEvent.click(row.getByRole("button", { name: "Clear stop RS-04" }));
    await waitFor(() => expect(presses(calls)).toHaveLength(1));
    expect(await row.findByText("Clear stop needs a reason of 3 words or more.")).toBeTruthy();
    expect(bar.queryByText("Clear stop needs a reason of 3 words or more.")).toBeNull();
    expect(refusals()).toHaveLength(1);
  });

  it("a press that works afterwards clears the reason from the row", async () => {
    let n = 0;
    renderDesk(managerDesk(), () => (++n === 1 ? { ok: false, message: REFUSED_TICK } : { ok: true, message: "Red stop RS-01 cleared." }));
    const row = within(await screen.findByTestId("stop-RS-01"));
    fireEvent.change(row.getByLabelText("Reason (3 words or more)"), { target: { value: "alarm test finished now" } });
    fireEvent.click(row.getByRole("button", { name: "Clear stop RS-01" }));
    expect(await row.findByText(REFUSED_TICK)).toBeTruthy();
    fireEvent.click(row.getByLabelText("Safety record: Fire Safety Manager told and agreed (role-played)"));
    fireEvent.click(row.getByRole("button", { name: "Clear stop RS-01" }));
    await waitFor(() => expect(refusals()).toHaveLength(0));
  });
});

describe("C8a review: a refused Confirm cause shows in the case's own row", () => {
  it("with the job on the desk locked, the reason shows next to the Confirm cause button", async () => {
    const calls = renderDesk(managerDesk({ cases: [CASE] }), () => ({ ok: false, message: REFUSED_CASE }));
    const button = await screen.findByRole("button", { name: "Confirm cause R-01" });
    fireEvent.click(button);
    await waitFor(() => expect(presses(calls)).toHaveLength(1));
    const caseRow = screen.getByTestId("case-R-01");
    expect(await within(caseRow).findByText(REFUSED_CASE)).toBeTruthy();
    expect(refusals()).toHaveLength(1);
    expect(refusals()[0].closest('[data-testid="case-R-01"]')).not.toBeNull();
  });
});

describe("C8a review: a refused row press whose row is gone after the reload", () => {
  /** The desk before the press, then the desk the reload brings. */
  function renderTwoDesks(before: ManagerDesk, after: ManagerDesk, message: string) {
    let pressed = false;
    const calls: { url: string; body: Body | null }[] = [];
    const fn = vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? (JSON.parse(String(init.body)) as Body) : null;
      calls.push({ url, body });
      if (url === "/api/action") pressed = true;
      return {
        json: async () => (url === "/api/action" ? { ok: false, message } : smState(pressed ? after : before)),
      } as Response;
    });
    render(<SeatChat seat="senior-manager" fetcher={fn} pollMs={0} jobId="2318" initial={smState(before) as never} />);
    return calls;
  }

  it("a case the spot called back on leaves the list; the reason shows where the list was, not at the end of the chat", async () => {
    const calls = renderTwoDesks(managerDesk({ cases: [CASE] }), managerDesk({ cases: [] }), REFUSED_CASE);
    fireEvent.click(await screen.findByRole("button", { name: "Confirm cause R-01" }));
    await waitFor(() => expect(presses(calls)).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Confirm cause R-01" })).toBeNull());
    expect(await screen.findByText(REFUSED_CASE)).toBeTruthy();
    expect(refusals()).toHaveLength(1);
    const notice = refusals()[0];
    expect(notice.closest('[aria-label="Senior manager desk"]')).not.toBeNull();
    // Above the job on the desk, where the list was.
    const job = screen.getByText("Job 2318 · Tower A, Level 23, core");
    expect(notice.compareDocumentPosition(job) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("a stop someone else cleared leaves the list; the reason shows where the stops were", async () => {
    const calls = renderTwoDesks(managerDesk(), managerDesk({ stops: [stop("RS-04", false)] }), "There is no open red stop like that.");
    const row = within(await screen.findByTestId("stop-RS-01"));
    fireEvent.change(row.getByLabelText("Reason (3 words or more)"), { target: { value: "alarm test finished now" } });
    fireEvent.click(row.getByRole("button", { name: "Clear stop RS-01" }));
    await waitFor(() => expect(presses(calls)).toHaveLength(1));
    await waitFor(() => expect(screen.queryByTestId("stop-RS-01")).toBeNull());
    expect(await screen.findByText("There is no open red stop like that.")).toBeTruthy();
    expect(refusals()).toHaveLength(1);
    const notice = refusals()[0];
    expect(notice.closest('[aria-label="Senior manager desk"]')).not.toBeNull();
    const job = screen.getByText("Job 2318 · Tower A, Level 23, core");
    expect(notice.compareDocumentPosition(job) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("C8a review: the Clear stop row is a red stop card", () => {
  it("shows the stop's action as its body and the receipt with the pill version", async () => {
    renderDesk(managerDesk(), () => ({ ok: true, message: "Done." }));
    const row = within(await screen.findByTestId("stop-RS-04"));
    expect(row.getByText("Trigger of RS-04.")).toBeTruthy();
    expect(row.getByText("Action of RS-04.")).toBeTruthy();
    expect(row.getByText("Call: Who to call for RS-04")).toBeTruthy();
    expect(row.getByText("Red stop RS-04 · pill v1.0 · AI calls: 0")).toBeTruthy();
    expect(row.getByText("Stop")).toBeTruthy();
  });
});
