// @vitest-environment jsdom

/**
 * C7b on screen, fake fetch only: the technician's job list and Open job, the
 * lead cards with Found it, Not this and Clear, a press that reloads the view at
 * once (so a tick re-ranks before the next poll), the Solved and Not solved
 * forms, Send with the cause, the bar that shows only while the job is in
 * progress, and the collapsed Ruled out and Removed lists.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent, within } from "@testing-library/react";
import { SeatChat } from "../app/components/chat/SeatChat";
import type { TechnicianDesk, DeskLead, OpenJobDesk } from "../lib/technician-desk";
import type { JobStatus } from "../lib/memory";

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

function lead(causeId: string, label: string, extra: Partial<DeskLead> = {}): DeskLead {
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
    ...extra,
  };
}

const PRECOOL = lead("precool", "Morning start-up runs too cold");
const MIN_AIR = lead("min-airflow", "Core box held at minimum airflow");
const THERMO = lead("thermostat-spot", "Thermostat in the wrong spot after a fit-out", { tier: "low-confidence", tierWord: "low confidence" });

function openDesk(extra: Partial<OpenJobDesk> = {}): OpenJobDesk {
  return {
    jobId: "2318",
    title: "Job 2318 · Tower A, Level 23, core",
    status: "in-progress",
    statusLine: "In progress: check the leads in order, then Solved, Send with the cause or Not solved.",
    inProgress: true,
    locked: null,
    checklist: [
      { id: "place", from: "Place tag", title: "Tower A, Level 23, core", body: "Equipment VAV-23-C1", receipt: "Code · AI calls: 0" },
    ],
    note: "Repeat flag is on. No nudge. Find the cause and call the FM chief engineer.",
    leads: [PRECOOL, MIN_AIR, THERMO],
    ruledOut: [],
    removed: [{ causeId: "setpoint", label: "The setpoint is just off (turn the dial)", reason: "Removed by TS-CC-09: no nudge." }],
    steps: [{ step: 1, section: "helpdesk intake", text: "Step one text.", who: "Helpdesk", colour: "green", colourWord: "Do it", filled: "No safety signs reported by the tenant" }],
    ...extra,
  };
}

function desk(open: OpenJobDesk | null, jobStatus: JobStatus = "in-progress"): TechnicianDesk {
  return {
    title: "Jobs in Tower A",
    jobs: [
      {
        id: "2318",
        place: "Level 23, core",
        complaint: "too cold",
        reported: "6 Oct, 09:10",
        status: jobStatus,
        canOpen: jobStatus === "reported" || jobStatus === "visit-booked",
        isOpen: open !== null,
      },
    ],
    open,
  };
}

function techState(d: TechnicianDesk) {
  return {
    seat: "technician",
    label: "Technician (role-played)",
    pipNever: "approve anything, or use a fix the rules removed",
    chips: ["What needs me", "Show job", "Why?", "Dial?", "Safety"],
    messages: [],
    notices: [],
    desk: d,
  };
}

/** A fake fetch: each URL's answer comes from `answer`, and every call is kept with its parsed body. */
function fakeFetch(answer: (url: string, body: Body | null, n: number) => unknown) {
  const calls: { url: string; body: Body | null }[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? (JSON.parse(String(init.body)) as Body) : null;
    calls.push({ url, body });
    const n = calls.filter((c) => c.url === url).length;
    return { json: async () => answer(url, body, n) } as Response;
  });
  return { fn, calls };
}

/** The live leads in screen order: lead cards outside the collapsed Ruled out list. */
function leadOrder(): string[] {
  return screen
    .getAllByTestId("lead-card")
    .filter((el) => el.closest("details") === null)
    .map((el) => el.getAttribute("data-cause") ?? "");
}

describe("C7b: the job list and Open job", () => {
  it("Open job presses open-job on that job, then reloads the view", async () => {
    let opened = false;
    const { fn, calls } = fakeFetch((url) => {
      if (url.startsWith("/api/action")) {
        opened = true;
        return { ok: true, message: "Job 2318 is open." };
      }
      return techState(opened ? desk(openDesk()) : desk(null, "reported"));
    });
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    fireEvent.click(await screen.findByRole("button", { name: "Open job 2318" }));
    await waitFor(() => expect(calls.some((c) => c.url === "/api/action")).toBe(true));
    const press = calls.find((c) => c.url === "/api/action")!;
    expect(press.body).toEqual({ seat: "technician", action: "open-job", job: "2318" });
    await screen.findAllByTestId("lead-card");
    expect(leadOrder()).toEqual(["precool", "min-airflow", "thermostat-spot"]);
  });
});

describe("C7b: a tick re-ranks at once, before the next poll", () => {
  it("Not this on precool sends the tick and the reloaded order shows with no poll running", async () => {
    let ticked = false;
    const { fn, calls } = fakeFetch((url) => {
      if (url.startsWith("/api/action")) {
        ticked = true;
        return { ok: true, message: "Ticked." };
      }
      return techState(
        desk(
          ticked
            ? openDesk({ leads: [MIN_AIR, THERMO], ruledOut: [{ ...PRECOOL, tick: "not-this", reason: "Checked: not this (Technician (role-played))." }] })
            : openDesk()
        )
      );
    });
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    await screen.findAllByTestId("lead-card");
    expect(leadOrder()).toEqual(["precool", "min-airflow", "thermostat-spot"]);

    fireEvent.click(screen.getByRole("button", { name: "Not this: Morning start-up runs too cold" }));
    await waitFor(() => expect(leadOrder()).toEqual(["min-airflow", "thermostat-spot"]));
    const press = calls.find((c) => c.url === "/api/action")!;
    expect(press.body).toEqual({
      seat: "technician",
      action: "tick",
      job: "2318",
      payload: { causeId: "precool", type: "not-this" },
    });
    // The reload came straight after the press: 2 reads in all (first paint, then the press).
    expect(calls.filter((c) => c.url.startsWith("/api/state"))).toHaveLength(2);
  });

  it("Found it sends a found tick; a found lead offers Clear, which sends clear", async () => {
    const found = { ...THERMO, tier: "found" as const, tierWord: "found", tick: "found" as const };
    const { fn, calls } = fakeFetch((url) => {
      if (url.startsWith("/api/action")) return { ok: true, message: "Ticked." };
      return techState(desk(openDesk({ leads: [found, PRECOOL, MIN_AIR] })));
    });
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    fireEvent.click(await screen.findByRole("button", { name: "Found it: Morning start-up runs too cold" }));
    await waitFor(() => expect(calls.filter((c) => c.url === "/api/action")).toHaveLength(1));
    expect(calls.find((c) => c.url === "/api/action")!.body).toMatchObject({ payload: { causeId: "precool", type: "found" } });

    expect(screen.queryByRole("button", { name: `Found it: ${THERMO.label}` })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: `Clear: ${THERMO.label}` }));
    await waitFor(() => expect(calls.filter((c) => c.url === "/api/action")).toHaveLength(2));
    expect(calls.filter((c) => c.url === "/api/action")[1].body).toMatchObject({ payload: { causeId: "thermostat-spot", type: "clear" } });
  });

  it("each lead shows its reason, check text, check time and fix line; the AI line sits under the reason with its banner", async () => {
    const worded = { ...PRECOOL, aiWording: "Start with the morning start-up.", aiBanner: "replay: saved real AI answer" };
    const { fn } = fakeFetch(() => techState(desk(openDesk({ leads: [worded, MIN_AIR, THERMO] }))));
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    const first = (await screen.findAllByTestId("lead-card"))[0];
    const card = within(first);
    expect(card.getByText(PRECOOL.reason)).toBeTruthy();
    expect(card.getByText(PRECOOL.checkText)).toBeTruthy();
    expect(card.getByText(/15 minutes/)).toBeTruthy();
    expect(card.getByText(PRECOOL.fixLine)).toBeTruthy();
    expect(card.getByText("Start with the morning start-up.")).toBeTruthy();
    expect(card.getByText("replay: saved real AI answer")).toBeTruthy();
    expect(card.getByText("case backed")).toBeTruthy();
  });
});

describe("C7b: Solved, Not solved and Send with the cause", () => {
  function actionBodies(calls: { url: string; body: Body | null }[]) {
    return calls.filter((c) => c.url === "/api/action").map((c) => c.body);
  }

  it("Solved asks for one line of why and sends it", async () => {
    const { fn, calls } = fakeFetch((url) => (url === "/api/action" ? { ok: true, message: "Solved." } : techState(desk(openDesk()))));
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    fireEvent.click(await screen.findByRole("button", { name: "Solved" }));
    fireEvent.change(screen.getByLabelText("One line of why (3 to 30 words)"), {
      target: { value: "The pre-cool start was two hours early." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Mark solved" }));
    await waitFor(() => expect(actionBodies(calls)).toHaveLength(1));
    expect(actionBodies(calls)[0]).toEqual({
      seat: "technician",
      action: "solved",
      job: "2318",
      payload: { whyLine: "The pre-cool start was two hours early." },
    });
  });

  it("Not solved asks for the impact record and sends numbers and a yes or no", async () => {
    const { fn, calls } = fakeFetch((url) => (url === "/api/action" ? { ok: true, message: "Sent." } : techState(desk(openDesk()))));
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    fireEvent.click(await screen.findByRole("button", { name: "Not solved" }));
    fireEvent.change(screen.getByLabelText("Hours lost (0 to 100)"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Extra visits needed (0 to 10)"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("radio", { name: "No" }));
    fireEvent.click(screen.getByRole("button", { name: "Send to the senior manager" }));
    await waitFor(() => expect(actionBodies(calls)).toHaveLength(1));
    expect(actionBodies(calls)[0]).toEqual({
      seat: "technician",
      action: "not-solved",
      job: "2318",
      payload: { hoursLost: 3, extraVisits: 2, contractorOrPartsNeeded: false },
    });
  });

  it("Send with the cause presses send-with-cause on the open job", async () => {
    const { fn, calls } = fakeFetch((url) => (url === "/api/action" ? { ok: true, message: "Sent." } : techState(desk(openDesk()))));
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    fireEvent.click(await screen.findByRole("button", { name: "Send with the cause" }));
    await waitFor(() => expect(actionBodies(calls)).toHaveLength(1));
    expect(actionBodies(calls)[0]).toEqual({ seat: "technician", action: "send-with-cause", job: "2318" });
  });

  it("a refused press shows its reason", async () => {
    const { fn } = fakeFetch((url) =>
      url === "/api/action"
        ? { ok: false, message: "Solved is refused: this fix belongs to the senior manager. Press Send with the cause." }
        : techState(desk(openDesk()))
    );
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    fireEvent.click(await screen.findByRole("button", { name: "Solved" }));
    fireEvent.change(screen.getByLabelText("One line of why (3 to 30 words)"), { target: { value: "It was the thermostat spot." } });
    fireEvent.click(screen.getByRole("button", { name: "Mark solved" }));
    expect(await screen.findByText(/this fix belongs to the senior manager/)).toBeTruthy();
    // On a phone the chat's end is far below; the reason shows in the bar, next to the press, once.
    const bar = screen.getByRole("group", { name: "Job 2318 presses" });
    expect(within(bar).getByText(/this fix belongs to the senior manager/)).toBeTruthy();
    expect(screen.getAllByText(/this fix belongs to the senior manager/)).toHaveLength(1);
  });

  it("an empty impact field is left out, never sent as 0, so the server asks for it", async () => {
    const { fn, calls } = fakeFetch((url) => (url === "/api/action" ? { ok: false, message: "Not solved needs the impact record." } : techState(desk(openDesk()))));
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    fireEvent.click(await screen.findByRole("button", { name: "Not solved" }));
    fireEvent.click(screen.getByRole("radio", { name: "No" }));
    fireEvent.click(screen.getByRole("button", { name: "Send to the senior manager" }));
    await waitFor(() => expect(actionBodies(calls)).toHaveLength(1));
    expect(actionBodies(calls)[0]).toEqual({
      seat: "technician",
      action: "not-solved",
      job: "2318",
      payload: { contractorOrPartsNeeded: false },
    });
  });

  it("the bar with Solved, Not solved, Send with the cause and Safety shows only while the job is in progress", async () => {
    const { fn } = fakeFetch(() =>
      techState(desk(openDesk({ status: "escalated", inProgress: false, statusLine: "Escalated: with the senior manager." }), "escalated"))
    );
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    await screen.findByText("Escalated: with the senior manager.");
    expect(screen.queryByRole("button", { name: "Solved" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Not solved" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Found it/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Safety" }).length).toBeGreaterThan(0);
  });

  it("while in progress the bar carries Safety too", async () => {
    const { fn } = fakeFetch(() => techState(desk(openDesk())));
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    const bar = await screen.findByRole("group", { name: "Job 2318 presses" });
    expect(within(bar).getByRole("button", { name: "Safety" })).toBeTruthy();
    expect(within(bar).getByRole("button", { name: "Solved" })).toBeTruthy();
    expect(within(bar).getByRole("button", { name: "Not solved" })).toBeTruthy();
  });
});

describe("C7b: ruled out and removed are collapsed; a locked job shows only its stop", () => {
  it("Ruled out and Removed sit in closed details blocks", async () => {
    const ruled = { ...MIN_AIR, tick: "not-this" as const, reason: "Checked: not this (Technician (role-played))." };
    const { fn } = fakeFetch(() => techState(desk(openDesk({ leads: [PRECOOL, THERMO], ruledOut: [ruled] }))));
    const { container } = render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    await screen.findAllByTestId("lead-card");
    const ruledOut = container.querySelector("details[data-list='ruled-out']") as HTMLDetailsElement;
    const removed = container.querySelector("details[data-list='removed']") as HTMLDetailsElement;
    expect(ruledOut).not.toBeNull();
    expect(removed).not.toBeNull();
    expect(ruledOut.open).toBe(false);
    expect(removed.open).toBe(false);
    expect(within(ruledOut).getByText("Ruled out (1)")).toBeTruthy();
    expect(within(removed).getByText("Removed (1)")).toBeTruthy();
    expect(within(ruledOut).getByRole("button", { name: `Clear: ${MIN_AIR.label}` })).toBeTruthy();
  });

  it("a locked job shows the red card with its Call line and the lock line, and no leads or presses", async () => {
    const locked = openDesk({
      locked: {
        cards: [{ id: "lock-RS-04", from: "RS-04", title: "Stop trigger text", body: "Stop action text", call: "Who to call", colour: "red", colourWord: "Stop", receipt: "Red stop RS-04 · pill v1.0 · AI calls: 0" }],
        lockLines: ["The lock line from the pill."],
      },
      checklist: [],
      leads: [],
      removed: [],
      steps: [],
    });
    const { fn } = fakeFetch(() => techState(desk(locked)));
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    expect(await screen.findByText("Stop trigger text")).toBeTruthy();
    expect(screen.getByText("Call: Who to call")).toBeTruthy();
    expect(screen.getByText("The lock line from the pill.")).toBeTruthy();
    expect(screen.queryAllByTestId("lead-card")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Solved" })).toBeNull();
  });
});

describe("C7b: the chat follows the open job", () => {
  it("a typed message goes about the technician's open job, not the page's default", async () => {
    const { fn, calls } = fakeFetch((url) => {
      if (url.startsWith("/api/chat")) return { ok: true, storedText: "why", cards: [], storedCount: 2 };
      return techState(desk(openDesk({ jobId: "2319", title: "Job 2319 · Tower A, Level 23, west" })));
    });
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    const input = await screen.findByPlaceholderText("Message Pip about 2319");
    fireEvent.change(input, { target: { value: "why" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(calls.some((c) => c.url === "/api/chat")).toBe(true));
    expect(calls.find((c) => c.url === "/api/chat")!.body).toEqual({ seat: "technician", text: "why", job: "2319" });
  });
});
