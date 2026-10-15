// @vitest-environment jsdom

/**
 * D1 review fixes on screen, fake fetch only.
 *
 * Show job's status in plain words; what a tick did, next to the list; the
 * tenant's Too cold and Show job show that they are working; the senior
 * manager's desk once the job has moved on; the demo words for the new fix and
 * why no AI draft shows without them; the trend warning that is not this job's;
 * an effect's step said as what the effect does to it; the AI switch in plain
 * words with its line; a saved AI answer's receipt; a red stop's short forms
 * explained under its own words; an alert's receipt left bare inside "What
 * needs me"; a refusal's codes in plain words; a typed reply that does not
 * move in twice; the chip and send button words.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within, act } from "@testing-library/react";
import { SeatChat } from "../app/components/chat/SeatChat";
import { ChatCard } from "../app/components/chat/ChatCard";
import { DeskCardView } from "../app/components/chat/TechnicianDesk";
import { AiSwitch } from "../app/components/AiSwitch";
import { DEMO_FIX_LINE, DEMO_WHY_LINE } from "../lib/demo-words";
import { AI_MODE_HINTS, SPEAK_FIRST_MEANS } from "../lib/plain-words";
import type { DeskCard, DeskLead, OpenJobDesk, TechnicianDesk } from "../lib/technician-desk";
import type { ManagerDesk, ManagerOpenJob, ManagerPartView, ManagerSolutionView } from "../lib/senior-manager-desk";

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

type Body = Record<string, unknown>;

function fakeFetch(answer: (url: string, body: Body | null) => unknown) {
  const calls: { url: string; body: Body | null }[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? (JSON.parse(String(init.body)) as Body) : null;
    calls.push({ url, body });
    return { json: async () => answer(url, body) } as Response;
  });
  return { fn, calls };
}

async function settle() {
  for (let i = 0; i < 12; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

const lock = (root: HTMLElement) => root.querySelector("fieldset.chat-lock") as HTMLFieldSetElement;

// ---- The technician ----

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
    receipt: "Lead · pill v1.0 · AI calls: 0",
    aiCalls: 0,
    ...extra,
  };
}

const PRECOOL = lead("precool", "Morning start-up runs too cold");
const MIN_AIR = lead("min-airflow", "Core box held at minimum airflow");
const THERMO = lead("thermostat-spot", "Thermostat in the wrong spot after a fit-out", { tier: "low-confidence" });

const TREND: DeskCard = {
  id: "trend-RS-08",
  from: "RS-08 · trend data",
  title: "Stop trigger words.",
  body: "Stop action words.",
  call: "FM chief engineer",
  colour: "red",
  colourWord: "Stop",
  codeLine:
    "Caught from trend data, no AI: the west zone's VAV damper sat fully open 2 to 5 pm on 9 of 14 days (made up for the demo). It locks nothing.",
  receipt: "Red stop RS-08 · pill v1.0 · AI calls: 0",
};

function openDesk(leads: DeskLead[], ruledOut: DeskLead[] = []): OpenJobDesk {
  return {
    jobId: "2318",
    title: "Job 2318 · Tower A, Level 23, core",
    status: "in-progress",
    statusLine: "In progress: check the leads in order and tick each one, then Solved, Send with the cause or Not solved.",
    inProgress: true,
    locked: null,
    checklist: [{ id: "place", from: "Place tag", title: "Tower A, Level 23, core", receipt: "Code · pill v1.0 · AI calls: 0" }, TREND],
    note: "",
    leads,
    ruledOut,
    removed: [],
    steps: [],
  };
}

function techDesk(open: OpenJobDesk, jobs?: TechnicianDesk["jobs"]): TechnicianDesk {
  return {
    title: "Jobs in Tower A",
    jobs: jobs ?? [
      { id: "2318", place: "Level 23, core", complaint: "too cold", reported: "6 Oct, 09:10", status: "in-progress", canOpen: false, isOpen: true },
    ],
    open,
  };
}

function techState(open: OpenJobDesk, extra: Record<string, unknown> = {}) {
  return {
    seat: "technician",
    label: "Technician (role-played)",
    pipNever: "approve anything, or use a fix the rules removed",
    chips: ["What needs me", "Show job", "Why?", "Dial?", "Safety"],
    messages: [],
    notices: [],
    desk: techDesk(open),
    ...extra,
  };
}

describe("D1 review: Show job's status in plain words", () => {
  it("the job status in Show job's answer shows its plain words first and the code after as a grey tag", async () => {
    const card = { kind: "answer", title: "Job 2318", body: "Tower A, Level 23, Northwind Advisory. too cold, mornings, around 9am. Status: in-progress." };
    const { fn } = fakeFetch(() =>
      techState(openDesk([PRECOOL]), {
        messages: [
          { from: "person", text: "Show job" },
          { from: "pip", text: card.body, cards: [card] },
        ],
      })
    );
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    const body = (await screen.findByText("Technician is on it")).closest("p")!;
    expect(body.textContent).toBe(
      "Tower A, Level 23, Northwind Advisory. too cold, mornings, around 9am. Status: Technician is on it in-progress."
    );
    expect(within(body).getByText("in-progress").className).toBe("code-tag");
  });
});

describe("D1 review: a tick says what it did, next to the list it changed", () => {
  it("Not this: the ruled-out cause and the new first cause, in a status line above the list", async () => {
    let ticked = false;
    const { fn } = fakeFetch((url) => {
      if (url === "/api/action") {
        ticked = true;
        return { ok: true, message: "Not this: Morning start-up runs too cold." };
      }
      return techState(ticked ? openDesk([MIN_AIR, THERMO], [{ ...PRECOOL, tick: "not-this" }]) : openDesk([PRECOOL, MIN_AIR, THERMO]));
    });
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "Not this: Morning start-up runs too cold" }));
    const line = await screen.findByText(
      'Ruled out: "Morning start-up runs too cold". The list re-ranked: "Core box held at minimum airflow" is now first.'
    );
    expect(line.getAttribute("role")).toBe("status");
    // It sits right before the first lead, where the change happened.
    const first = screen.getAllByTestId("lead-card")[0];
    expect(line.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(first.getAttribute("data-cause")).toBe("min-airflow");
  });
});

describe("D1 review: the trend warning says it is not this job's", () => {
  it("a line before the red card names the other zone and says nothing is locked; the stop's words stay as they are", () => {
    render(<DeskCardView card={TREND} jobZone="core" />);
    expect(
      screen.getByText("Also seen in the trend data: a warning for the west zone of this floor, not this job's core zone. Nothing is locked, and this job carries on.")
    ).toBeTruthy();
    expect(screen.getByText("Stop trigger words.").textContent).toBe("Stop trigger words.");
    expect(screen.getByText("Stop action words.").textContent).toBe("Stop action words.");
  });

  it("any other card gets no such line", () => {
    const { container } = render(
      <DeskCardView card={{ id: "place", from: "Place tag", title: "Tower A, Level 23, core", receipt: "Code · pill v1.0 · AI calls: 0" }} jobZone="core" />
    );
    expect(container.querySelector(".card-intro")).toBeNull();
  });
});

describe("D1 review: presses that lost their pending mark", () => {
  it("Too cold keeps its row and shows it is working until the reply lands", async () => {
    let reported = false;
    const { fn } = fakeFetch((url) => {
      if (url === "/api/action") {
        reported = true;
        return { ok: true, message: "Self-check started on job 2319." };
      }
      return { seat: "tenant", label: "Tenant (role-played)", pipNever: "promise a fix", chips: ["What needs me", "Safety"], messages: [], notices: [] };
    });
    const { container } = render(<SeatChat seat="tenant" fetcher={fn} pollMs={0} jobId="2318" />);
    fireEvent.click(await screen.findByRole("button", { name: "Report a problem" }));
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const cold = screen.getByRole("button", { name: "Too cold" });
    fireEvent.click(cold);
    // The pressed button is still on screen, marked busy, while the request is on its way.
    expect(screen.getByRole("button", { name: "Too cold" })).toBe(cold);
    expect(cold.getAttribute("aria-busy")).toBe("true");
    expect(cold.classList.contains("is-pending")).toBe(true);
    expect(lock(container).disabled).toBe(true);
    await settle();
    expect(reported).toBe(true);
    // Once the reply has landed the row goes back to Report a problem.
    expect(screen.queryByRole("button", { name: "Too cold" })).toBeNull();
    expect(screen.getByRole("button", { name: "Report a problem" })).toBeTruthy();
  });

  it("Show job on the desk shows it is working while it reads the server", async () => {
    let shown = false;
    const jobs: TechnicianDesk["jobs"] = [
      { id: "2318", place: "Level 23, core", complaint: "too cold", reported: "6 Oct, 09:10", status: "in-progress", canOpen: false, isOpen: true },
      { id: "2320", place: "Level 23, west", complaint: "too hot", reported: "6 Oct, 09:40", status: "in-progress", canOpen: false, canShow: true, isOpen: false },
    ];
    const { fn, calls } = fakeFetch((url) => {
      if (url.includes("show=2320")) shown = true;
      return { ...techState(openDesk([PRECOOL])), desk: techDesk(openDesk([PRECOOL]), jobs) };
    });
    const { container } = render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    const show = await screen.findByRole("button", { name: "Show job 2320" });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    fireEvent.click(show);
    expect(show.getAttribute("aria-busy")).toBe("true");
    expect(lock(container).disabled).toBe(true);
    expect(screen.getByText("Pip is checking")).toBeTruthy();
    await settle();
    expect(shown).toBe(true);
    expect(calls.some((c) => c.url === "/api/state?seat=technician&show=2320")).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(lock(container).disabled).toBe(false);
    expect(screen.queryByText("Pip is checking")).toBeNull();
  });
});

// ---- The senior manager ----

const SM = "Senior manager: the FM contractor's chief engineer (role-played)";
const ESCALATED =
  "Not solved: job 2318, Tower A, Level 23, core (VAV-23-C1), too cold.\nFound: no cause yet.\nSent by Technician (role-played) · AI calls: 0";
const LOW = "Low confidence on job 2318: the top cause has fewer than 3 similar cases. Please take a look.";
const SPEAK =
  "Speak first: Tower A Level 23 has called 5 times in 30 days, with opposite fixes (repeat flag, TS-CC-09). Quick fixes are off for this spot. Find the cause before they call again.";

function part(id: ManagerPartView["id"], extra: Partial<ManagerPartView> = {}): ManagerPartView {
  const titles = { "rule-text": "Rule text", fact: "Fact", "effect-1": "Effect 1", "effect-2": "Effect 2" } as const;
  return {
    id,
    title: titles[id],
    label: "pick by hand from the menu",
    suggested: null,
    value: null,
    shown: id === "effect-2" ? "none" : "",
    display: "Not picked yet",
    confirmed: false,
    word: "To confirm",
    colour: "amber",
    ...extra,
  };
}

function solution(extra: Partial<ManagerSolutionView> = {}): ManagerSolutionView {
  return {
    id: "S-1",
    status: "draft",
    statusLine: "Draft: confirm each part, run the tests, then send it to HQ (A2).",
    causeLabel: "Thermostat in the wrong spot after a fit-out",
    fixLine: "Move the thermostat back to its drawing spot first.",
    whyLine: "The renovation moved it next to a warm printer area.",
    fixFlags: [],
    whyFlags: [],
    parts: [
      part("rule-text", { label: "the fix line, word for word", suggested: "Move it back.", shown: "Move it back.", display: "Move it back." }),
      part("fact"),
      part("effect-1", { shown: "block:25", display: "Block step 25" }),
      part("effect-2", { shown: "none", display: "No second effect" }),
    ],
    saved: false,
    savedLine: "Nothing is saved until each part is confirmed.",
    version: "1.1",
    hash7: null,
    testRun: null,
    canEdit: true,
    canSend: false,
    sendLine: "Send to HQ needs every part confirmed, then a passing test run.",
    receipt: "New solution · pill v1.0 · AI calls: 0",
    ...extra,
  };
}

const MENU = {
  facts: [
    { value: "fit-out-12m", label: "renovation in the last 12 months" },
    { value: "repeat", label: "repeat" },
  ],
  effects: [
    { value: "block:25", label: "Block step 25", stepText: "First complaint, no repeat flag: make ONE setpoint nudge of at most 1 deg C." },
    { value: "put-first:21", label: "Put step 21 first", stepText: "Check each complaint-zone sensor." },
  ],
};

function smOpen(extra: Partial<ManagerOpenJob> = {}): ManagerOpenJob {
  return {
    open: { ...openDesk([THERMO]), status: "escalated", statusLine: "Escalated: with the senior manager, everything attached.", inProgress: false },
    cameUp: "Not solved by Technician (role-played), 6 Oct, 10:00.",
    facts: ["renovation in the last 12 months"],
    ticks: [],
    impact: null,
    editable: true,
    solution: null,
    outsideHelp: null,
    ...extra,
  };
}

function smDesk(extra: Partial<ManagerDesk> = {}): ManagerDesk {
  return {
    title: "Jobs with you",
    jobs: [{ id: "2318", place: "Tower A, Level 23, core", complaint: "too cold", status: "escalated", statusWord: "Escalated", isOpen: true, canShow: false }],
    open: smOpen(),
    cases: [],
    stops: [],
    menu: MENU,
    ...extra,
  };
}

function smState(d: ManagerDesk, notices: { kind: string; text: string }[] = []) {
  return { seat: "senior-manager", label: SM, pipNever: "approve their own new solution", chips: ["What needs me", "Safety"], messages: [], notices, manager: d };
}

describe("D1 review: the senior manager's desk once the job has moved on", () => {
  it("says nothing is waiting, names the job that left, and marks its old notes done; the speak-first note is explained", async () => {
    const done = smDesk({ jobs: [], open: null });
    const notices = [
      { kind: "speak-first", text: SPEAK },
      { kind: "low-confidence", text: LOW },
      { kind: "escalated", text: ESCALATED },
      { kind: "version-live", text: "v1.1 is live in every building (role-played approval by HQ)." },
    ];
    const { fn } = fakeFetch(() => smState(done, notices));
    const { container } = render(<SeatChat seat="senior-manager" fetcher={fn} pollMs={0} jobId="2318" initial={smState(done, notices) as never} />);
    expect(
      await screen.findByText("Nothing is waiting on you now. Job 2318 came up to you and has left your desk. Its notes below are marked done.")
    ).toBeTruthy();
    expect(screen.queryByText("No job has come up to you yet.")).toBeNull();
    const all = Array.from(container.querySelectorAll(".notice"));
    const kinds = all.map((n) => n.querySelector("b .code-tag")!.textContent);
    expect(kinds).toEqual(["speak-first", "low-confidence", "escalated", "version-live"]);
    const isDone = all.map((n) => n.classList.contains("is-done"));
    expect(isDone).toEqual([false, true, true, false]);
    expect(within(all[2] as HTMLElement).getByText("Done").className).toBe("badge green");
    expect(within(all[0] as HTMLElement).getByText(SPEAK_FIRST_MEANS)).toBeTruthy();
  });

  it("while the job is still with the senior manager, nothing is marked done", async () => {
    const notices = [
      { kind: "low-confidence", text: LOW },
      { kind: "escalated", text: ESCALATED },
    ];
    const { fn } = fakeFetch(() => smState(smDesk(), notices));
    const { container } = render(<SeatChat seat="senior-manager" fetcher={fn} pollMs={0} jobId="2318" />);
    await screen.findByText("Jobs with you");
    expect(container.querySelectorAll(".notice.is-done")).toHaveLength(0);
  });
});

describe("D1 review: the demo words for the new fix, and why no AI draft shows without them", () => {
  it("on Saved answers the Log form says the AI draft covers the demo's words, and one button types them", async () => {
    const { fn } = fakeFetch(() => smState(smDesk()));
    render(<SeatChat seat="senior-manager" fetcher={fn} pollMs={0} jobId="2318" aiMode="replay" />);
    fireEvent.click(await screen.findByRole("button", { name: "Log new solution" }));
    fireEvent.click(screen.getByRole("button", { name: "Use the demo words" }));
    expect((screen.getByLabelText("Fix line (3 to 30 words)") as HTMLTextAreaElement).value).toBe(DEMO_FIX_LINE);
    expect((screen.getByLabelText("Why line (3 to 30 words)") as HTMLTextAreaElement).value).toBe(DEMO_WHY_LINE);
  });

  it("with the AI off the form has no such line", async () => {
    const { fn } = fakeFetch(() => smState(smDesk()));
    render(<SeatChat seat="senior-manager" fetcher={fn} pollMs={0} jobId="2318" aiMode="off" />);
    fireEvent.click(await screen.findByRole("button", { name: "Log new solution" }));
    expect(screen.queryByRole("button", { name: "Use the demo words" })).toBeNull();
  });

  it("a draft on Saved answers with no saved AI answer says why the AI part is missing", async () => {
    const d = smDesk({ open: smOpen({ editable: false, solution: solution() }) });
    const { fn } = fakeFetch(() => smState(d));
    render(<SeatChat seat="senior-manager" fetcher={fn} pollMs={0} jobId="2318" aiMode="replay" />);
    const note = await screen.findByTestId("no-saved-answer");
    expect(note.textContent).toContain("There is no saved AI answer for these words.");
    // A draft that has the saved AI answer gets no such note.
    cleanup();
    const withAi = smDesk({
      open: smOpen({
        editable: false,
        solution: solution({ aiBanner: "replay: saved real AI answer", parts: [part("rule-text"), part("fact", { suggested: "fit-out-12m" }), part("effect-1"), part("effect-2")] }),
      }),
    });
    const second = fakeFetch(() => smState(withAi));
    render(<SeatChat seat="senior-manager" fetcher={second.fn} pollMs={0} jobId="2318" aiMode="replay" />);
    await screen.findByTestId("solution-card");
    expect(screen.queryByTestId("no-saved-answer")).toBeNull();
  });

  it("an effect's step is said as what the effect does to it, and the picker shows plain words with the code under it", async () => {
    const d = smDesk({ open: smOpen({ editable: false, solution: solution() }) });
    const { fn } = fakeFetch(() => smState(d));
    const { container } = render(<SeatChat seat="senior-manager" fetcher={fn} pollMs={0} jobId="2318" />);
    await screen.findByTestId("solution-card");
    const effect1 = container.querySelector('[data-part="effect-1"]') as HTMLElement;
    const step = effect1.querySelector(".part-step")!;
    expect(step.textContent).toBe(
      "This stops the old step that said:First complaint, no repeat flag: make ONE setpoint nudge of at most 1 deg C."
    );
    expect(within(effect1).getByText("block step 25").className).toBe("code-tag");
    const options = Array.from((screen.getByLabelText("Effect 1") as HTMLSelectElement).options).map((o) => o.textContent);
    expect(options).toEqual(["Pick an effect", "Don't just turn the dial", "Check where the thermostat sits first"]);
  });
});

// ---- Words on any seat ----

describe("D1 review: the AI switch in plain words", () => {
  it("reads Live, Saved answers, Off, with one line on what the current position does", () => {
    render(<AiSwitch mode="replay" onPicked={() => {}} />);
    expect(screen.getByRole("button", { name: "Saved answers" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: "Replay" })).toBeNull();
    expect(screen.getByText(AI_MODE_HINTS.replay)).toBeTruthy();
    expect(screen.getByRole("group", { name: "AI switch" }).getAttribute("aria-describedby")).toBe("ai-switch-hint");
  });

  it("a pick marks the picked button busy and disables the switch until the page reloads", () => {
    // jsdom cannot reload; the switch still asks for it, and the cookie shows the one pick.
    render(<AiSwitch mode="replay" />);
    const off = screen.getByRole("button", { name: "Off" });
    fireEvent.click(off);
    expect(document.cookie).toContain("pill-desk-ai=off");
    expect(off.getAttribute("aria-busy")).toBe("true");
    expect(off.classList.contains("is-pending")).toBe(true);
    for (const b of screen.getAllByRole("button")) expect((b as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Live" }));
    expect(document.cookie).toContain("pill-desk-ai=off");
    expect(document.cookie).not.toContain("pill-desk-ai=live");
    document.cookie = "pill-desk-ai=; path=/; max-age=0";
  });
});

describe("D1 review: cards", () => {
  it("a card with a saved AI answer says so in its receipt, and counts new calls only", () => {
    render(<ChatCard title="Why that one first" body="Code reason." aiWording="AI words." aiBanner="replay: saved real AI answer" receipt="Lead · pill v1.0 · AI calls: 0" />);
    expect(screen.getByText("Lead · pill v1.0 · 1 saved AI answer shown, new AI calls: 0")).toBeTruthy();
    cleanup();
    render(<ChatCard title="Why that one first" body="Code reason." receipt="Lead · pill v1.0 · AI calls: 0" />);
    expect(screen.getByText("Lead · pill v1.0 · AI calls: 0")).toBeTruthy();
  });

  it("a red stop's short forms are explained under its own words, which stay word for word", () => {
    const call = "FM control room, which arranges isolation through the LEW, and the FM chief engineer";
    render(<ChatCard colour="red" colourWord="Stop" from="RS-04" title="Water dripping." body="Keep away." call={call} receipt="Red stop RS-04 · pill v1.0 · AI calls: 0" />);
    expect(screen.getByText(`Call: ${call}`)).toBeTruthy();
    expect(screen.getByText("Short forms: LEW means licensed electrical worker; FM means facilities management.")).toBeTruthy();
  });

  it("What needs me holding a safety alert keeps the alert's receipt bare: no name is put into it", async () => {
    const alert = "Red stop on Tower A, Level 23\nWater dripping.\nCall: FM control room\nRed stop RS-04 · AI calls: 0 · raised by Tenant (role-played)";
    const body = `This is work on the tenant's fit-out (TS-CC-11). Who pays?\n\n${alert}`;
    const card = { kind: "answer", title: "What needs you", body };
    const { fn } = fakeFetch(() => techState(openDesk([PRECOOL]), { messages: [{ from: "pip", text: body, cards: [card] }] }));
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    const p = (await screen.findByText("What needs you")).closest("article")!.querySelectorAll("p")[1];
    expect(p.textContent).toContain("Red stop RS-04 · AI calls: 0 · raised by Tenant (role-played)");
    expect(p.textContent).not.toContain("Water near the electrics RS-04");
    // The rule code in the same answer still gets its plain words.
    expect(within(p as HTMLElement).getByText("TS-CC-11").className).toBe("code-tag");
  });

  it("a refusal's codes show their plain words", async () => {
    const { fn } = fakeFetch((url) => (url === "/api/action" ? { ok: false, message: "Only HQ approves a new solution (A2)." } : techState(openDesk([PRECOOL]))));
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    fireEvent.click(await screen.findByRole("button", { name: "Not this: Morning start-up runs too cold" }));
    const refusal = (await screen.findByText("Head office approves a new fix")).closest(".notice")!;
    expect(refusal.textContent).toBe("not doneOnly HQ approves a new solution (Head office approves a new fix A2).");
  });
});

describe("D1 review: a typed reply moves in once", () => {
  it("when a poll swaps the reply for its stored copy, the same card stays on screen and is not marked to move in again", async () => {
    const reply = { kind: "answer", title: "What needs you", body: "Nothing is waiting on you right now." };
    let stored = false;
    const { fn } = fakeFetch((url) => {
      if (url === "/api/chat") return { storedText: "What needs me", cards: [reply], storedCount: 2 };
      return techState(openDesk([PRECOOL]), {
        messages: stored
          ? [
              { from: "person", text: "What needs me" },
              { from: "pip", text: reply.body, cards: [reply] },
            ]
          : [],
      });
    });
    const first = techState(openDesk([PRECOOL]));
    // A short poll, so the stored copy comes back the way it does in the app.
    render(<SeatChat seat="technician" fetcher={fn} pollMs={60} jobId="2318" initial={first as never} />);
    fireEvent.click(await screen.findByRole("button", { name: "What needs me" }));
    const card = (await screen.findByText("What needs you")).closest("article")!;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(card.classList.contains("is-new")).toBe(true);
    // The poll brings the stored copy: the very same element stays, so nothing fades in twice.
    card.classList.remove("is-new");
    stored = true;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });
    const after = screen.getByText("What needs you").closest("article")!;
    expect(after.closest("[data-item]")!.getAttribute("data-item")).toBe("1");
    expect(after).toBe(card);
    expect(after.classList.contains("is-new")).toBe(false);
    expect(screen.getAllByText("What needs you")).toHaveLength(1);
  });
});

describe("D1 review: the chip and send words", () => {
  it("Dial? reads as a question you can understand and still sends the chip; Send says Send; the tenant's box names no job", async () => {
    const { fn, calls } = fakeFetch((url) =>
      url === "/api/chat" ? { storedText: "Dial?", cards: [{ kind: "answer", title: "The dial is removed here", body: "Repeat flag." }] } : techState(openDesk([PRECOOL]))
    );
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    fireEvent.click(await screen.findByRole("button", { name: "Can I turn the dial?" }));
    await screen.findByText("The dial is removed here");
    expect(calls.find((c) => c.url === "/api/chat")!.body!.text).toBe("Dial?");
    expect(screen.getByRole("button", { name: "Send" }).textContent).toBe("Send");
    cleanup();
    const tenant = fakeFetch(() => ({ seat: "tenant", label: "Tenant (role-played)", pipNever: "promise a fix", chips: ["Safety"], messages: [], notices: [] }));
    render(<SeatChat seat="tenant" fetcher={tenant.fn} pollMs={0} jobId="2318" />);
    expect((await screen.findByLabelText("Message Pip")).getAttribute("placeholder")).toBe("Message Pip");
  });
});
