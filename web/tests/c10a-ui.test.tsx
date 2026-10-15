// @vitest-environment jsdom

/**
 * C10a on screen, fake fetch only: the judges' page /how.
 *
 * The story is rendered from howView on the one memory (and from a temp copy of
 * tickets.json, to show nothing is typed in). The live wall is the 5 real
 * SeatChats and the Building B card, handed the real seat views; every read
 * and press is caught by the fake fetch, and the network is stubbed to throw.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent, within } from "@testing-library/react";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { HowStory } from "../app/components/how/HowStory";
import { HowLive } from "../app/components/how/HowLive";
import * as memory from "../lib/memory";
import { resetDemo, runAction } from "../lib/actions";
import { actionTurn } from "../lib/action-turn";
import { seatView } from "../lib/seat-view";
import { buildingBView } from "../lib/hq-desk";
import { loadCauses } from "../lib/causes";
import { SEAT_LABELS } from "../lib/permissions";
import { seatLabelWords, seatWord } from "../lib/plain-words";
import { howView, liveSeats, loadHowSources, ROLE_PLAYED_LINE, AI_NEW_SOLUTION_LINE } from "../lib/how";
import type { Ticket } from "../lib/rule-engine";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");

const DEMO_FIX =
  "If the zone had a fit-out in the last 12 months, check where the thermostat sits against the fit-out drawing before any nudge.";
const DEMO_WHY =
  "The fit-out 8 months ago moved the core thermostat next to the new printer bay, so it reads warm and the box keeps cooling the open area.";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("the page reached the network");
    })
  );
  resetDemo(REAL_NOW);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function label(id: string): string {
  return loadCauses().causes.find((c) => c.id === id)!.label;
}

function press(seat: string, action: string, jobId?: string, payload?: Record<string, unknown>) {
  const r = runAction({ seat, action, jobId, payload }, REAL_NOW);
  expect(r.ok, `${action}: ${r.message}`).toBe(true);
}

async function toApprove() {
  const report = runAction({ seat: "tenant", action: "report", payload: { complaint: "too cold" } }, REAL_NOW);
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
}

/** Answers /api/state with the real seat view on the memory, as the route does; anything else says ok. */
function fakeFetch() {
  const calls: { url: string; method: string }[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET" });
    if (url.startsWith("/api/state")) {
      const seat = new URL(url, "http://pill-desk.test").searchParams.get("seat")!;
      const view = seatView(memory.read(), seat, "off", REAL_NOW);
      return { json: async () => ({ ok: true, ...view }) } as Response;
    }
    return { json: async () => ({ ok: true }) } as Response;
  });
  return { fn, calls };
}

function renderLive(reload = vi.fn()) {
  const { fn, calls } = fakeFetch();
  const state = memory.read();
  const view = howView(state);
  const utils = render(
    <HowLive
      seats={liveSeats(state, "off", REAL_NOW)}
      buildingB={buildingBView(state, REAL_NOW, "off")}
      steps={view.demoSteps}
      fetcher={fn}
      pollMs={0}
      reload={reload}
    />
  );
  return { ...utils, calls, reload };
}

// ---- WHY, WHAT and HOW ----

describe("T-C10a: the story on screen comes from the data", () => {
  it("shows the 5 calls with their dates and ids from tickets.json", () => {
    render(<HowStory view={howView(memory.read())} />);
    const calls = screen.getByTestId("why-calls");
    const rows = within(calls).getAllByRole("listitem");
    expect(rows).toHaveLength(5);
    const tickets = JSON.parse(readFileSync(join(process.cwd(), "data", "tickets.json"), "utf-8")) as Ticket[];
    const level23 = tickets.filter((t) => t.building === "tower-a" && t.floor === 23);
    expect(level23.map((t) => t.id)).toEqual(["2301", "2305", "2310", "2315", "2318"]);
    const dates = ["15 Sep", "19 Sep", "24 Sep", "29 Sep", "6 Oct"];
    level23.forEach((t, i) => {
      expect(rows[i].textContent).toContain(t.id);
      expect(rows[i].textContent).toContain(dates[i]);
      expect(rows[i].textContent).toContain(t.fix ? t.fix.note : "Still open");
    });
    expect(screen.getByRole("heading", { level: 3, name: /called 5 times in 21 days, and the cause was never fixed/ })).toBeTruthy();
  });

  it("shows the impact meter, Before next to With Pill Desk, with its label", () => {
    render(<HowStory view={howView(memory.read())} />);
    const meter = within(screen.getByTestId("how-meter"));
    const row = (name: string) => meter.getByRole("rowheader", { name }).parentElement!.textContent;
    expect(meter.getByRole("columnheader", { name: "Before" })).toBeTruthy();
    expect(meter.getByRole("columnheader", { name: "With Pill Desk" })).toBeTruthy();
    expect(row("Calls")).toBe("Calls52");
    expect(row("Visits")).toBe("Visits52");
    expect(row("Senior manager checks")).toBe("Senior manager checks01");
    expect(row("Days to a real fix")).toBe("Days to a real fixnot fixed after 21 days4 days");
    expect(row("Repeat calls")).toBe("Repeat calls41");
    expect(row("Cost")).toBe("CostS$600 and countingS$420");
    expect(meter.getByText("Worked out on made-up demo data. It assumes the cause is found on the visit where the repeat is caught.")).toBeTruthy();
    expect(meter.getByText(/Caught at 2305 on 19 Sep/)).toBeTruthy();
  });

  it("says the seats are role-played with no login and the data is made up", () => {
    render(<HowStory view={howView(memory.read())} />);
    expect(screen.getAllByText(ROLE_PLAYED_LINE).length).toBeGreaterThan(0);
  });

  it("shows WHAT: Pip in the middle of one brain, the 5 seats, Building B as a card, A1 to A4 and who passes what", () => {
    render(<HowStory view={howView(memory.read())} />);
    const ring = within(screen.getByTestId("brain-ring"));
    expect(ring.getByRole("img", { name: /Pip/ })).toBeTruthy();
    for (const seat of Object.values(SEAT_LABELS)) expect(ring.getByText(seat)).toBeTruthy();
    expect(ring.getByText("Building B, Level 12 (made up)")).toBeTruthy();
    const approvals = within(screen.getByTestId("how-approvals"));
    for (const id of ["A1", "A2", "A3", "A4"]) expect(approvals.getByText(id)).toBeTruthy();
    expect(within(screen.getByTestId("how-passes")).getAllByRole("listitem")).toHaveLength(5);
  });

  it("shows HOW: the AI's part in a new solution, the 10 stops and the 8 questions", () => {
    render(<HowStory view={howView(memory.read())} />);
    expect(screen.getByText(AI_NEW_SOLUTION_LINE)).toBeTruthy();
    expect(within(screen.getByTestId("how-stops")).getAllByRole("listitem")).toHaveLength(10);
    expect(within(screen.getByTestId("how-questions")).getAllByRole("listitem")).toHaveLength(8);
    expect(within(screen.getByTestId("how-rank-steps")).getAllByRole("listitem")).toHaveLength(4);
  });
});

describe("T-C10a: change a date in a temp copy of tickets.json and the page changes", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "pill-desk-c10a-ui-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("2301 on 12 Sep: the page shows 12 Sep and 24 days, and no 15 Sep", () => {
    const path = join(dir, "tickets.json");
    writeFileSync(path, readFileSync(join(process.cwd(), "data", "tickets.json"), "utf-8"), "utf-8");
    const tickets = JSON.parse(readFileSync(path, "utf-8")) as Ticket[];
    tickets.find((t) => t.id === "2301")!.reportedAt = "2026-09-12T09:05:00+08:00";
    writeFileSync(path, JSON.stringify(tickets, null, 2), "utf-8");

    const view = howView(memory.read(), { ...loadHowSources(), tickets: JSON.parse(readFileSync(path, "utf-8")) });
    const { container } = render(<HowStory view={view} />);
    const calls = within(screen.getByTestId("why-calls"));
    expect(calls.getByText("12 Sep")).toBeTruthy();
    expect(container.textContent).not.toContain("15 Sep");
    expect(container.textContent).toContain("called 5 times in 24 days");
  });
});

// ---- The live wall ----

describe("T-C10a: the 5 real chats side by side, AOM Tower A first, plus the Building B card", () => {
  it("renders 5 SeatChats in order, each with its seat label from the memory", async () => {
    const { container } = renderLive();
    const tiles = Array.from(container.querySelectorAll("[data-testid='live-tile']"));
    expect(tiles.map((t) => t.getAttribute("data-seat"))).toEqual([
      "aom-tower-a",
      "tenant",
      "technician",
      "senior-manager",
      "hq",
    ]);
    for (const tile of tiles) {
      const seat = tile.getAttribute("data-seat") as keyof typeof SEAT_LABELS;
      expect(tile.querySelector(".chat.column")).toBeTruthy();
      expect(tile.querySelector(".seat-tag")!.textContent).toBe(seat);
      expect(tile.querySelector(".chat-sub")!.textContent).toBe(seatLabelWords(SEAT_LABELS[seat]));
      expect(tile.querySelector(`a[href='/seat/${seat}']`)).toBeTruthy();
    }
    // Each chat is the real one: the AOM's desk with its meter, the tenant's Report a problem.
    expect(within(tiles[0] as HTMLElement).getByTestId("aom-meter")).toBeTruthy();
    expect(within(tiles[1] as HTMLElement).getByRole("button", { name: "Report a problem" })).toBeTruthy();
    await waitFor(() => expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0));
  });

  it("shows the Building B card with ticket 2401's first lead from the engine", () => {
    renderLive();
    const card = within(screen.getByTestId("how-building-b"));
    expect(card.getByText("Building B, Level 12 (made up)")).toBeTruthy();
    const leads = card.getAllByTestId("lead-card").map((l) => l.getAttribute("data-cause"));
    expect(leads).toEqual(["precool", "min-airflow", "thermostat-spot"]);
  });

  it("a poll after HQ approves puts the thermostat check first on the Building B card", async () => {
    const before = buildingBView(memory.read(), REAL_NOW, "off");
    await toApprove();
    const { fn } = fakeFetch();
    const state = memory.read();
    render(
      <HowLive
        seats={liveSeats(state, "off", REAL_NOW)}
        buildingB={before}
        steps={howView(state).demoSteps}
        fetcher={fn}
        pollMs={0}
        reload={vi.fn()}
      />
    );
    await waitFor(() => {
      const first = within(screen.getByTestId("how-building-b")).getAllByTestId("lead-card")[0];
      expect(first.getAttribute("data-cause")).toBe("thermostat-spot");
    });
    expect(within(screen.getByTestId("how-building-b")).getByText(label("thermostat-spot"))).toBeTruthy();
    expect(fn.mock.calls.some(([url]) => url === "/api/state?seat=hq")).toBe(true);
  });

  it("the bar's Reset is the real Reset, then the page reloads", async () => {
    const reload = vi.fn();
    const { calls } = renderLive(reload);
    const bar = within(screen.getByTestId("live-bar"));
    fireEvent.click(bar.getByRole("button", { name: "Reset demo" }));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(calls.filter((c) => c.url === "/api/reset")).toEqual([{ url: "/api/reset", method: "POST" }]);
  });

  it("the bar lists the demo steps as text: which seat, which button", () => {
    renderLive();
    const steps = within(screen.getByTestId("demo-steps"));
    const items = steps.getAllByRole("listitem");
    expect(items).toHaveLength(6);
    const view = howView(memory.read());
    view.demoSteps.forEach((step, i) => {
      expect(items[i].textContent).toContain(step.seat === "bar" ? step.who : seatWord(step.seat));
      expect(items[i].textContent).toContain(step.text);
    });
  });
});
