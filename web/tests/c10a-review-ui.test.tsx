// @vitest-environment jsdom

/**
 * Review findings for C10a on screen.
 *
 * - The page's own wiring was tested only by reading page.tsx's source text.
 *   These tests run the real page: How() reads the one memory and the AI
 *   switch's cookie at request time, and what it renders is the story, the 5
 *   real seat views, the Building B card and the close line.
 * - The demo steps' button names were checked only against words typed in the
 *   test. Here every button a step names is found on the real chats at that
 *   point of the demo, so a renamed button fails.
 * - On /how a followed press or Safety in a chat column scrolled the whole
 *   page, putting the new item under the sticky demo bar and the column's Pip
 *   header off the screen. In a column only the column's own message list
 *   scrolls now; a seat's own page scrolls as before (old C7b and C8a tests).
 * - The wall's columns at 1280 px are a question for YY (QUESTIONS.md
 *   question 13), with its it.todo below.
 *
 * The fetch answers through the real code the routes call (seatView,
 * chatTurn, actionTurn), with the AI off; the network is stubbed to throw.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent, within } from "@testing-library/react";
import * as memory from "../lib/memory";
import { resetDemo, runAction } from "../lib/actions";
import { actionTurn } from "../lib/action-turn";
import { chatTurn } from "../lib/chat-turn";
import { seatView } from "../lib/seat-view";
import { buildingBView } from "../lib/hq-desk";
import { loadCauses } from "../lib/causes";
import { SEAT_LABELS } from "../lib/permissions";
import { seatLabelWords } from "../lib/plain-words";
import { AI_OFF_LABEL } from "../lib/ai-mode";
import { howView, liveSeats, LIVE_ORDER, CLOSE_LINE } from "../lib/how";
import { HowLive } from "../app/components/how/HowLive";

// The AI switch's cookie for the page's request (next/headers has no request in a test).
const jar = vi.hoisted(() => ({ mode: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "pill-desk-ai" && jar.mode ? { name, value: jar.mode } : undefined),
  }),
}));

import How from "../app/how/page";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");

const DEMO_FIX =
  "If the zone had a fit-out in the last 12 months, check where the thermostat sits against the fit-out drawing before any nudge.";
const DEMO_WHY =
  "The fit-out 8 months ago moved the core thermostat next to the new printer bay, so it reads warm and the box keeps cooling the open area.";

beforeEach(() => {
  jar.mode = undefined;
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
  return r;
}

function tenantSelfCheck() {
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
}

function toNotSolved() {
  tenantSelfCheck();
  press("technician", "open-job", "2318");
  press("technician", "tick", "2318", { causeId: "precool", type: "not-this" });
  press("technician", "tick", "2318", { causeId: "min-airflow", type: "not-this" });
  press("technician", "not-solved", "2318", { hoursLost: 3, extraVisits: 2, contractorOrPartsNeeded: false });
}

async function logDemo() {
  const logged = await actionTurn(
    { seat: "senior-manager", action: "log-new-solution", jobId: "2318", payload: { fixLine: DEMO_FIX, whyLine: DEMO_WHY } },
    "off",
    undefined,
    REAL_NOW
  );
  expect(logged.ok, logged.message).toBe(true);
}

function confirmDemoParts() {
  for (const [part, value] of [
    ["rule-text", DEMO_FIX],
    ["fact", "fit-out-12m"],
    ["effect-1", "block:25"],
    ["effect-2", "put-first:21"],
  ]) {
    press("senior-manager", "confirm-part", "2318", { part, value });
  }
}

async function toApprove() {
  toNotSolved();
  press("senior-manager", "tick", "2318", { causeId: "thermostat-spot", type: "found" });
  await logDemo();
  confirmDemoParts();
  press("senior-manager", "run-tests", "2318");
  press("senior-manager", "send-to-hq", "2318");
  press("hq", "approve-solution", "2318");
}

function json(body: unknown): Response {
  return { json: async () => body } as Response;
}

/** The routes' real code, AI off: /api/state, /api/chat and /api/action. */
function routeFetch() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    if (url.startsWith("/api/state")) {
      const seat = new URL(url, "http://pill-desk.test").searchParams.get("seat")!;
      return json({ ok: true, ...seatView(memory.read(), seat, "off", REAL_NOW) });
    }
    if (url === "/api/chat") {
      const out = await chatTurn(body as { seat?: string; text?: unknown; job?: string }, "off", undefined, REAL_NOW);
      return json(out.body);
    }
    if (url === "/api/action") {
      const r = await actionTurn(
        {
          seat: String(body.seat),
          action: String(body.action),
          jobId: body.job as string | undefined,
          payload: body.payload as Record<string, unknown> | undefined,
        },
        "off",
        undefined,
        REAL_NOW
      );
      return json(r);
    }
    return json({ ok: true });
  });
}

/** The live wall as the page builds it, on the memory as it is now. */
function renderWall() {
  cleanup();
  const state = memory.read();
  render(
    <HowLive
      seats={liveSeats(state, "off", REAL_NOW)}
      buildingB={buildingBView(state, REAL_NOW, "off")}
      steps={howView(state).demoSteps}
      fetcher={routeFetch()}
      pollMs={0}
      reload={vi.fn()}
    />
  );
}

function tile(seat: string): HTMLElement {
  const el = document.querySelector(`[data-testid='live-tile'][data-seat='${seat}']`);
  expect(el, `tile ${seat}`).toBeTruthy();
  return el as HTMLElement;
}

// ---- The page itself ----

describe("C10a review: the real /how page, read at request time", () => {
  /** A fetch that never answers: only what the page read on the server shows. */
  function serverOnly() {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {}))
    );
  }

  it("renders the story, the 5 real seat views in order, the Building B card, the demo steps and the close line", async () => {
    serverOnly();
    jar.mode = "off";
    const { container } = render(await How());
    expect(within(screen.getByTestId("why-calls")).getAllByRole("listitem")).toHaveLength(5);
    const tiles = Array.from(container.querySelectorAll("[data-testid='live-tile']"));
    expect(tiles.map((t) => t.getAttribute("data-seat"))).toEqual([...LIVE_ORDER]);
    for (const t of tiles) {
      const seat = t.getAttribute("data-seat") as keyof typeof SEAT_LABELS;
      expect(t.querySelector(".chat.column")).toBeTruthy();
      expect(t.querySelector(".seat-tag")!.textContent).toBe(seat);
      expect(t.querySelector(".chat-sub")!.textContent).toBe(seatLabelWords(SEAT_LABELS[seat]));
    }
    const b = within(screen.getByTestId("how-building-b"));
    expect(b.getAllByTestId("lead-card").map((l) => l.getAttribute("data-cause"))).toEqual([
      "precool",
      "min-airflow",
      "thermostat-spot",
    ]);
    expect(within(screen.getByTestId("demo-steps")).getAllByRole("listitem")).toHaveLength(6);
    expect(container.querySelector("footer .close-line")!.textContent).toBe(CLOSE_LINE);
  });

  it("each request reads the memory again: after HQ approves, the brain, Building B and the seats show it", async () => {
    serverOnly();
    const first = render(await How());
    expect(within(screen.getByTestId("brain-ring")).getByText("Pill TS-CC v1.0")).toBeTruthy();
    expect(within(screen.getByTestId("how-building-b")).getAllByTestId("lead-card")[0].getAttribute("data-cause")).toBe(
      "precool"
    );
    const seedTenant = first.container.querySelector("[data-seat='tenant']") as HTMLElement;
    expect(within(seedTenant).queryByText("Report a problem: too cold")).toBeNull();
    first.unmount();

    await toApprove();
    const second = render(await How());
    expect(within(screen.getByTestId("brain-ring")).getByText("Pill TS-CC v1.1")).toBeTruthy();
    expect(within(screen.getByTestId("how-building-b")).getAllByTestId("lead-card")[0].getAttribute("data-cause")).toBe(
      "thermostat-spot"
    );
    // The tenant's own words are in the tenant's column, from the memory.
    const tenant = second.container.querySelector("[data-seat='tenant']") as HTMLElement;
    expect(within(tenant).getByText("Report a problem: too cold")).toBeTruthy();
  });

  it("the AI switch's cookie reaches the live wall: Off shows the AI off label, Replay does not", async () => {
    serverOnly();
    jar.mode = "off";
    const off = render(await How());
    expect(within(screen.getByTestId("how-building-b")).getAllByText(AI_OFF_LABEL).length).toBeGreaterThan(0);
    off.unmount();

    jar.mode = "replay";
    render(await How());
    expect(within(screen.getByTestId("how-building-b")).queryByText(AI_OFF_LABEL)).toBeNull();
  });
});

describe("C10a review: questions for YY", () => {
  it.todo(
    'QUESTION C10a review: S22 says "the 5 real chats side by side", and the prototype shows 5 columns from 1280 px. Built in C10a: at 1280 px the wall is 3 columns by 2 rows, 5 in a row from about 1790 px. Tried: 5 in a row at 1280 px leaves each chat about 238 px wide and the Building B card alone on a second row. Should the wall show the 5 chats in one row from 1280 px?'
  );
});

// ---- The demo steps name real buttons ----

describe("C10a review: every button a demo step names is on the real chats at that point", () => {
  it("Reset, the tenant's, the technician's, the senior manager's, HQ's and the AOM's buttons", async () => {
    const steps = howView(memory.read()).demoSteps;
    const stepText = (seat: string) => steps.find((s) => s.seat === seat)!.text;
    const buttons = (scope: HTMLElement) => within(scope).getAllByRole("button").map((b) => b.textContent!.trim());
    /** The step names the button, and the seat's chat shows a button with exactly those words. */
    const shows = async (seat: string, name: string) => {
      expect(stepText(seat), `${seat} step`).toContain(name);
      const scope = seat === "bar" ? screen.getByTestId("live-bar") : tile(seat);
      await waitFor(() => expect(buttons(scope)).toContain(name));
    };
    const click = (seat: string, name: string) =>
      fireEvent.click(within(tile(seat)).getAllByRole("button").find((b) => b.textContent!.trim() === name)!);

    // Reset, and the tenant's Report a problem, then Too cold.
    renderWall();
    await shows("bar", "Reset demo");
    await shows("tenant", "Report a problem");
    click("tenant", "Report a problem");
    await shows("tenant", "Too cold");

    // The technician: Open job on 2318, Not this on the two leads, Not solved, Send to the senior manager.
    tenantSelfCheck();
    renderWall();
    await shows("technician", "Open job");
    expect(within(tile("technician")).getByRole("button", { name: "Open job 2318" })).toBeTruthy();
    press("technician", "open-job", "2318");
    renderWall();
    await shows("technician", "Not this");
    for (const id of ["precool", "min-airflow"]) {
      expect(within(tile("technician")).getByRole("button", { name: `Not this: ${label(id)}` })).toBeTruthy();
    }
    await shows("technician", "Not solved");
    click("technician", "Not solved");
    await shows("technician", "Send to the senior manager");

    // The senior manager: Found it, Log new solution, Log it, Confirm, Run tests, Send to HQ.
    press("technician", "tick", "2318", { causeId: "precool", type: "not-this" });
    press("technician", "tick", "2318", { causeId: "min-airflow", type: "not-this" });
    press("technician", "not-solved", "2318", { hoursLost: 3, extraVisits: 2, contractorOrPartsNeeded: false });
    renderWall();
    await shows("senior-manager", "Found it");
    expect(
      within(tile("senior-manager")).getByRole("button", { name: `Found it: ${label("thermostat-spot")}` })
    ).toBeTruthy();
    press("senior-manager", "tick", "2318", { causeId: "thermostat-spot", type: "found" });
    renderWall();
    await shows("senior-manager", "Log new solution");
    click("senior-manager", "Log new solution");
    await shows("senior-manager", "Log it");
    await logDemo();
    renderWall();
    await shows("senior-manager", "Confirm");
    for (const part of ["Rule text", "Fact", "Effect 1", "Effect 2"]) {
      expect(within(tile("senior-manager")).getByRole("button", { name: `Confirm ${part}` })).toBeTruthy();
    }
    confirmDemoParts();
    renderWall();
    await shows("senior-manager", "Run tests");
    press("senior-manager", "run-tests", "2318");
    renderWall();
    await shows("senior-manager", "Send to HQ");
    press("senior-manager", "send-to-hq", "2318");

    // HQ, then the AOM.
    renderWall();
    await shows("hq", "Approve and send to all buildings");
    press("hq", "approve-solution", "2318");
    renderWall();
    await shows("aom-tower-a", "Decide charge");
    // The whole demo on 5 real chats, rendered 13 times: give it room on a busy run.
  }, 30000);
});

// ---- A followed press in a column scrolls only that column ----

describe("C10a review: on /how a followed press scrolls only its own column, never the page", () => {
  let scrolled: Element[] = [];
  let sets: number[] = [];
  const hadScroll = Object.prototype.hasOwnProperty.call(Element.prototype, "scrollIntoView");
  const oldScroll = Element.prototype.scrollIntoView;
  const oldRect = Element.prototype.getBoundingClientRect;

  /** jsdom lays nothing out: the column's list sits at 300 px, a new item at 1300 px, the new solution card at 900 px. */
  function rect(top: number): DOMRect {
    return { top, bottom: top + 40, left: 0, right: 300, height: 40, width: 300, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
  }

  beforeEach(() => {
    scrolled = [];
    sets = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this);
    };
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this.classList.contains("chat-body")) return rect(300);
      if (this.getAttribute("data-testid") === "solution-card") return rect(900);
      if (this.hasAttribute("data-item")) return rect(1300);
      return rect(0);
    };
  });

  afterEach(() => {
    if (hadScroll) Element.prototype.scrollIntoView = oldScroll;
    else delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    Element.prototype.getBoundingClientRect = oldRect;
  });

  /** The column's own message list, with a scroll position the test can read. */
  function listOf(seat: string, startAt: number): HTMLElement {
    const list = tile(seat).querySelector(".chat-body") as HTMLElement;
    let top = startAt;
    Object.defineProperty(list, "scrollTop", {
      configurable: true,
      get: () => top,
      set: (v: number) => {
        top = v;
        sets.push(v);
      },
    });
    return list;
  }

  it("Safety in the tenant column: the column's list scrolls to the new item and the page does not move", async () => {
    const pageScroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    renderWall();
    const list = listOf("tenant", 120);
    fireEvent.click(within(tile("tenant")).getByRole("button", { name: "Safety" }));
    await within(tile("tenant")).findByRole("button", { name: "Raise RS-04" });
    // The item sits 1000 px below the list's top, so the list scrolls by 1000.
    await waitFor(() => expect(list.scrollTop).toBe(1120));
    expect(scrolled).toEqual([]);
    expect(pageScroll).not.toHaveBeenCalled();
  });

  it("Log it in the senior manager's column: the column's list scrolls to the new solution card, the page does not move", async () => {
    const pageScroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    toNotSolved();
    press("senior-manager", "tick", "2318", { causeId: "thermostat-spot", type: "found" });
    renderWall();
    listOf("senior-manager", 50);
    const sm = within(tile("senior-manager"));
    fireEvent.click(sm.getByRole("button", { name: "Log new solution" }));
    fireEvent.change(sm.getByLabelText("Fix line (3 to 30 words)"), { target: { value: DEMO_FIX } });
    fireEvent.change(sm.getByLabelText("Why line (3 to 30 words)"), { target: { value: DEMO_WHY } });
    fireEvent.click(sm.getByRole("button", { name: "Log it" }));
    await sm.findByTestId("solution-card");
    // The card sits 600 px below the list's top.
    await waitFor(() => expect(sets).toContain(650));
    expect(scrolled).toEqual([]);
    expect(pageScroll).not.toHaveBeenCalled();
  });
});
