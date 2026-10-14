// @vitest-environment jsdom

/**
 * C8a on screen, fake fetch only: the senior manager's desk. The escalated job
 * with everything attached and no question buttons, Found it on its own ranked
 * list, the bar's Solved, Log new solution and Ask HQ for outside help, the new
 * solution part by part with its labels and one Confirm each (the effects
 * changed to block 25 and put-first 21), Run tests and Send to HQ, Clear stop
 * with the safety record tick only where it is needed, and Confirm cause.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent, within } from "@testing-library/react";
import { SeatChat } from "../app/components/chat/SeatChat";
import type { DeskLead, OpenJobDesk } from "../lib/technician-desk";
import type {
  ManagerDesk,
  ManagerOpenJob,
  ManagerSolutionView,
  ManagerPartView,
  ManagerStopRow,
} from "../lib/senior-manager-desk";

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

const DEMO_FIX =
  "If the zone had a fit-out in the last 12 months, check where the thermostat sits against the fit-out drawing before any nudge.";
const DEMO_WHY =
  "The fit-out 8 months ago moved the core thermostat next to the new printer bay, so it reads warm and the box keeps cooling the open area.";
const SM = "Senior manager: the FM contractor's chief engineer (role-played)";

function lead(causeId: string, label: string, extra: Partial<DeskLead> = {}): DeskLead {
  return {
    causeId,
    label,
    tier: "low-confidence",
    tierWord: "low confidence",
    reason: `Code reason for ${label}.`,
    checkStep: 21,
    checkText: `Check text for ${label}.`,
    checkTime: "20 minutes",
    fixLine: `Fix line for ${label}.`,
    fixAllowedHere: false,
    tick: null,
    receipt: "Lead · pill v1.0 · AI calls: 0",
    aiCalls: 0,
    ...extra,
  };
}

const THERMO = lead("thermostat-spot", "Thermostat in the wrong spot after a fit-out");
const REBALANCE = lead("rebalance", "Zoning or air balance after a fit-out", { checkStep: 29, checkTime: "2 days" });

function openDesk(extra: Partial<OpenJobDesk> = {}): OpenJobDesk {
  return {
    jobId: "2318",
    title: "Job 2318 · Tower A, Level 23, core",
    status: "escalated",
    statusLine: "Escalated: with the senior manager, everything attached.",
    inProgress: false,
    locked: null,
    checklist: [
      {
        id: "self-check",
        from: "Tenant's self-check",
        title: "Self-check answers",
        lines: [{ text: "Where is it? Open area near the lift core" }, { text: "Has this happened before? Yes" }],
        receipt: "Code · pill v1.0 · AI calls: 0",
      },
    ],
    note: "Repeat flag is on.",
    leads: [THERMO, REBALANCE],
    ruledOut: [],
    removed: [],
    steps: [],
    ...extra,
  };
}

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

/** The saved AI suggestion as it was recorded: the fix line, fit-out-12m, put-first 21 only. */
function aiSolution(extra: Partial<ManagerSolutionView> = {}): ManagerSolutionView {
  return {
    id: "S-1",
    status: "draft",
    statusLine: "Draft: confirm each part, run the tests, then send it to HQ (A2).",
    causeLabel: "Thermostat in the wrong spot after a fit-out",
    fixLine: DEMO_FIX,
    whyLine: DEMO_WHY,
    fixFlags: [],
    whyFlags: [],
    aiBanner: "replay: saved real AI answer",
    parts: [
      part("rule-text", { label: "AI drafted", suggested: DEMO_FIX, shown: DEMO_FIX, display: DEMO_FIX }),
      part("fact", { label: "AI suggested from the code menu", suggested: "fit-out-12m", shown: "fit-out-12m", display: "renovation in the last 12 months" }),
      part("effect-1", { label: "AI suggested from the code menu", suggested: "put-first:21", shown: "put-first:21", display: "Put step 21 first", stepText: "Check each complaint-zone sensor." }),
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

function managerOpen(extra: Partial<ManagerOpenJob> = {}): ManagerOpenJob {
  return {
    open: openDesk(),
    cameUp: "Not solved by Technician (role-played), 6 Oct, 10:00.",
    facts: ["cold mornings", "core zone", "repeat", "opposite fixes", "renovation in the last 12 months", "VAV box"],
    ticks: [
      "Morning start-up runs too cold: Not this (Technician (role-played))",
      "Core box held at minimum airflow: Not this (Technician (role-played))",
    ],
    impact: "3 hours lost, 2 extra visits, contractor or parts needed: no. Cost: S$420 (made-up rates: S$60 an hour, a visit is 2 hours).",
    editable: true,
    solution: null,
    outsideHelp: null,
    ...extra,
  };
}

const MENU = {
  facts: [
    { value: "fit-out-12m", label: "renovation in the last 12 months" },
    { value: "repeat", label: "repeat" },
    { value: "opposite-fixes", label: "opposite fixes" },
  ],
  effects: [
    { value: "block:25", label: "Block step 25", stepText: "First complaint, no repeat flag: make one small change." },
    { value: "put-first:17", label: "Put step 17 first", stepText: "For cold mornings, check the pre-cool." },
    { value: "put-first:21", label: "Put step 21 first", stepText: "Check each complaint-zone sensor." },
  ],
};

function managerDesk(extra: Partial<ManagerDesk> = {}): ManagerDesk {
  return {
    title: "Jobs with you",
    jobs: [
      {
        id: "2318",
        place: "Tower A, Level 23, core",
        complaint: "too cold",
        status: "escalated",
        statusWord: "Escalated",
        isOpen: true,
        canShow: false,
      },
    ],
    open: managerOpen(),
    cases: [],
    stops: [],
    menu: MENU,
    ...extra,
  };
}

function smState(d: ManagerDesk) {
  return {
    seat: "senior-manager",
    label: SM,
    pipNever: "approve their own new solution",
    chips: ["What needs me", "Show job", "Why?", "Dial?", "Safety"],
    messages: [],
    notices: [],
    manager: d,
  };
}

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

function presses(calls: { url: string; body: Body | null }[]) {
  return calls.filter((c) => c.url === "/api/action").map((c) => c.body);
}

function renderDesk(d: ManagerDesk, action: (body: Body | null) => unknown = () => ({ ok: true, message: "Done." })) {
  const { fn, calls } = fakeFetch((url, body) => (url === "/api/action" ? action(body) : smState(d)));
  render(<SeatChat seat="senior-manager" fetcher={fn} pollMs={0} jobId="2318" initial={smState(d)} />);
  return calls;
}

describe("C8a: the escalated job with everything attached", () => {
  it("shows how it came up, the facts, both ticks with who made them, the impact record and the self-check answers", async () => {
    renderDesk(managerDesk());
    expect(await screen.findByText("Not solved by Technician (role-played), 6 Oct, 10:00.")).toBeTruthy();
    expect(screen.getByText("renovation in the last 12 months")).toBeTruthy();
    expect(screen.getByText("Morning start-up runs too cold: Not this (Technician (role-played))")).toBeTruthy();
    expect(screen.getByText("Core box held at minimum airflow: Not this (Technician (role-played))")).toBeTruthy();
    expect(screen.getByText(/3 hours lost, 2 extra visits/)).toBeTruthy();
    expect(screen.getByText("Where is it? Open area near the lift core")).toBeTruthy();
  });

  it("asks nothing again: no self-check question buttons on the seat", async () => {
    renderDesk(managerDesk());
    await screen.findByText("Jobs with you");
    for (const answer of ["Yes", "No", "Not sure", "It keeps coming back"]) {
      expect(screen.queryByRole("button", { name: answer })).toBeNull();
    }
    expect(document.querySelector(".answers")).toBeNull();
  });

  it("Found it on its own ranked list sends a found tick on the job", async () => {
    const calls = renderDesk(managerDesk());
    fireEvent.click(await screen.findByRole("button", { name: `Found it: ${THERMO.label}` }));
    await waitFor(() => expect(presses(calls)).toHaveLength(1));
    expect(presses(calls)[0]).toEqual({
      seat: "senior-manager",
      action: "tick",
      job: "2318",
      payload: { causeId: "thermostat-spot", type: "found" },
    });
  });

  it("a job not escalated to this seat leaves the desk with no job and no bar", async () => {
    renderDesk(managerDesk({ jobs: [], open: null }));
    expect(await screen.findByText("No job has come up to you yet.")).toBeTruthy();
    expect(screen.queryByRole("group", { name: /presses/ })).toBeNull();
  });
});

describe("C8a: the bar while escalated", () => {
  it("offers Solved, Log new solution, Ask HQ for outside help and Safety", async () => {
    renderDesk(managerDesk());
    const bar = within(await screen.findByRole("group", { name: "Job 2318 presses" }));
    for (const name of ["Solved", "Log new solution", "Ask HQ for outside help", "Safety"]) {
      expect(bar.getByRole("button", { name })).toBeTruthy();
    }
    expect(bar.queryByRole("button", { name: "Run tests" })).toBeNull();
  });

  it("Log new solution sends the fix line and the why line", async () => {
    const calls = renderDesk(managerDesk());
    fireEvent.click(await screen.findByRole("button", { name: "Log new solution" }));
    fireEvent.change(screen.getByLabelText("Fix line (3 to 30 words)"), { target: { value: DEMO_FIX } });
    fireEvent.change(screen.getByLabelText("Why line (3 to 30 words)"), { target: { value: DEMO_WHY } });
    fireEvent.click(screen.getByRole("button", { name: "Log it" }));
    await waitFor(() => expect(presses(calls)).toHaveLength(1));
    expect(presses(calls)[0]).toEqual({
      seat: "senior-manager",
      action: "log-new-solution",
      job: "2318",
      payload: { fixLine: DEMO_FIX, whyLine: DEMO_WHY },
    });
  });

  it("Ask HQ for outside help sends what is needed, the reason and needs money, and no amount field exists", async () => {
    const calls = renderDesk(managerDesk());
    fireEvent.click(await screen.findByRole("button", { name: "Ask HQ for outside help" }));
    expect(screen.queryByLabelText(/amount/i)).toBeNull();
    fireEvent.click(screen.getByLabelText("A contractor"));
    fireEvent.change(screen.getByLabelText("Reason (3 words or more)"), { target: { value: "The air needs a specialist balance" } });
    fireEvent.click(screen.getByLabelText("Yes, it needs money"));
    fireEvent.click(screen.getByRole("button", { name: "Send to HQ (A3)" }));
    await waitFor(() => expect(presses(calls)).toHaveLength(1));
    expect(presses(calls)[0]).toEqual({
      seat: "senior-manager",
      action: "ask-outside-help",
      job: "2318",
      payload: { need: "contractor", reason: "The air needs a specialist balance", needsMoney: true },
    });
  });

  it("Solved sends one line of why; a refusal shows in the bar", async () => {
    const calls = renderDesk(managerDesk(), () => ({
      ok: false,
      message: "Solved is refused: this fix needs outside help: Ask HQ, A3.",
    }));
    fireEvent.click(await screen.findByRole("button", { name: "Solved" }));
    fireEvent.change(screen.getByLabelText("One line of why (3 to 30 words)"), { target: { value: "A specialist must balance it." } });
    fireEvent.click(screen.getByRole("button", { name: "Mark solved" }));
    await waitFor(() => expect(presses(calls)).toHaveLength(1));
    expect(presses(calls)[0]).toMatchObject({ action: "solved", job: "2318", payload: { whyLine: "A specialist must balance it." } });
    const bar = within(screen.getByRole("group", { name: "Job 2318 presses" }));
    expect(await bar.findByText("Solved is refused: this fix needs outside help: Ask HQ, A3.")).toBeTruthy();
  });
});

describe("C8a: the new solution, part by part", () => {
  const drafted = (solution: ManagerSolutionView) =>
    managerDesk({
      jobs: [{ id: "2318", place: "Tower A, Level 23, core", complaint: "too cold", status: "new-solution-drafted", statusWord: "New solution drafted", isOpen: true, canShow: false }],
      open: managerOpen({ open: openDesk({ status: "new-solution-drafted" }), editable: false, solution }),
    });

  it("shows each part with its label and its own Confirm, the replay banner, and that nothing is saved yet", async () => {
    renderDesk(drafted(aiSolution()));
    const card = within(await screen.findByTestId("solution-card"));
    expect(card.getByText("AI drafted")).toBeTruthy();
    expect(card.getAllByText("AI suggested from the code menu")).toHaveLength(2);
    expect(card.getByText("pick by hand from the menu")).toBeTruthy();
    expect(card.getAllByRole("button", { name: /^Confirm / })).toHaveLength(4);
    expect(card.getByText("replay: saved real AI answer")).toBeTruthy();
    expect(card.getByText("Nothing is saved until each part is confirmed.")).toBeTruthy();
    expect(card.getAllByText("To confirm")).toHaveLength(4);
  });

  it("Confirm on the rule text sends the text in the box", async () => {
    const calls = renderDesk(drafted(aiSolution()));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm Rule text" }));
    await waitFor(() => expect(presses(calls)).toHaveLength(1));
    expect(presses(calls)[0]).toEqual({
      seat: "senior-manager",
      action: "confirm-part",
      job: "2318",
      payload: { part: "rule-text", value: DEMO_FIX },
    });
  });

  it("the effects change to the fixture's rule: effect 1 block 25, effect 2 put-first 21, each with its own Confirm", async () => {
    const calls = renderDesk(drafted(aiSolution()));
    const effect1 = (await screen.findByLabelText("Effect 1")) as HTMLSelectElement;
    expect(effect1.value).toBe("put-first:21");
    fireEvent.change(effect1, { target: { value: "block:25" } });
    expect(screen.getByText("First complaint, no repeat flag: make one small change.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirm Effect 1" }));
    await waitFor(() => expect(presses(calls)).toHaveLength(1));
    expect(presses(calls)[0]).toMatchObject({ action: "confirm-part", payload: { part: "effect-1", value: "block:25" } });

    const effect2 = screen.getByLabelText("Effect 2") as HTMLSelectElement;
    expect(effect2.value).toBe("none");
    fireEvent.change(effect2, { target: { value: "put-first:21" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Effect 2" }));
    await waitFor(() => expect(presses(calls)).toHaveLength(2));
    expect(presses(calls)[1]).toMatchObject({ action: "confirm-part", payload: { part: "effect-2", value: "put-first:21" } });
  });

  it("the fact picker offers only the code menu's facts", async () => {
    renderDesk(drafted(aiSolution()));
    const fact = (await screen.findByLabelText("Fact")) as HTMLSelectElement;
    const values = Array.from(fact.options).map((o) => o.value).filter(Boolean);
    expect(values).toEqual(["fit-out-12m", "repeat", "opposite-fixes"]);
  });

  it("the bar while drafted: Run tests and Send to HQ, each a press on the job", async () => {
    const calls = renderDesk(drafted(aiSolution()));
    const bar = within(await screen.findByRole("group", { name: "Job 2318 presses" }));
    expect(bar.queryByRole("button", { name: "Log new solution" })).toBeNull();
    fireEvent.click(bar.getByRole("button", { name: "Run tests" }));
    await waitFor(() => expect(presses(calls)).toHaveLength(1));
    fireEvent.click(bar.getByRole("button", { name: "Send to HQ" }));
    await waitFor(() => expect(presses(calls)).toHaveLength(2));
    expect(presses(calls).map((b) => b!.action)).toEqual(["run-tests", "send-to-hq"]);
    expect(presses(calls).every((b) => b!.job === "2318")).toBe(true);
  });

  it("a test run shows passed, failed and not applicable, and the draft's hash", async () => {
    const confirmed = aiSolution({
      parts: aiSolution().parts.map((p) => ({ ...p, confirmed: true, word: "Confirmed" as const, colour: "green" as const })),
      saved: true,
      savedLine: "Every part is confirmed: draft v1.1 saved in the runtime folder · 3f2a9c1",
      hash7: "3f2a9c1",
      testRun: {
        passed: 23,
        failed: 0,
        notApplicable: 2,
        counts: "23 passed, 0 failed, 2 not applicable",
        hash7: "3f2a9c1",
        current: true,
        lines: [{ id: "GT-01", title: "GT-01", label: "not applicable to v1.1", status: "not-applicable" }],
      },
      canSend: true,
      sendLine: "Send to HQ is open: the tests passed on this exact draft.",
    });
    renderDesk(drafted(confirmed));
    const card = within(await screen.findByTestId("solution-card"));
    expect(card.getByText("23 passed")).toBeTruthy();
    expect(card.getByText("0 failed")).toBeTruthy();
    expect(card.getByText("2 not applicable")).toBeTruthy();
    expect(card.getByText(/3f2a9c1/, { selector: ".saved-line" })).toBeTruthy();
    expect(card.getByText("Send to HQ is open: the tests passed on this exact draft.")).toBeTruthy();
    expect(card.getAllByText("Confirmed")).toHaveLength(4);
  });

  it("once sent to HQ, no part has a Confirm and the bar has no Run tests or Send to HQ", async () => {
    renderDesk(drafted(aiSolution({ status: "sent-to-hq", canEdit: false, statusLine: "Sent to HQ: it waits for HQ's decision (A2)." })));
    const card = within(await screen.findByTestId("solution-card"));
    expect(card.queryAllByRole("button", { name: /^Confirm / })).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Run tests" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Send to HQ" })).toBeNull();
  });

  it("a red word in the fix line shows a small flag", async () => {
    renderDesk(drafted(aiSolution({ fixFlags: ["RS-04"] })));
    const card = within(await screen.findByTestId("solution-card"));
    expect(card.getByText("red word: RS-04")).toBeTruthy();
  });

  it("a note the menu has no rule for shows as advisory, not enforced", async () => {
    renderDesk(drafted(aiSolution({ note: { text: "Block the safety step.", label: "advisory, not enforced", refusals: [] } })));
    const card = within(await screen.findByTestId("solution-card"));
    expect(card.getByText("advisory, not enforced")).toBeTruthy();
    expect(card.getByText("Block the safety step.")).toBeTruthy();
  });
});

describe("C8a: a press whose result lands away from the finger is brought into view", () => {
  let scrolled: Element[] = [];
  const hadScroll = Object.prototype.hasOwnProperty.call(Element.prototype, "scrollIntoView");
  const oldScroll = Element.prototype.scrollIntoView;

  beforeEach(() => {
    scrolled = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this);
    };
  });

  afterEach(() => {
    if (hadScroll) Element.prototype.scrollIntoView = oldScroll;
    else delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it("after Log it, the new solution card scrolls into view once", async () => {
    let logged = false;
    const escalatedDesk = managerDesk();
    const draftedDesk = managerDesk({
      open: managerOpen({ open: openDesk({ status: "new-solution-drafted" }), editable: false, solution: aiSolution() }),
    });
    const { fn } = fakeFetch((url) => {
      if (url === "/api/action") {
        logged = true;
        return { ok: true, message: "New solution drafted for job 2318: confirm each part." };
      }
      return smState(logged ? draftedDesk : escalatedDesk);
    });
    render(<SeatChat seat="senior-manager" fetcher={fn} pollMs={0} jobId="2318" initial={smState(escalatedDesk)} />);
    fireEvent.click(await screen.findByRole("button", { name: "Log new solution" }));
    fireEvent.change(screen.getByLabelText("Fix line (3 to 30 words)"), { target: { value: DEMO_FIX } });
    fireEvent.change(screen.getByLabelText("Why line (3 to 30 words)"), { target: { value: DEMO_WHY } });
    fireEvent.click(screen.getByRole("button", { name: "Log it" }));
    const card = await screen.findByTestId("solution-card");
    await waitFor(() => expect(scrolled).toContain(card));
    expect(scrolled.filter((el) => el === card)).toHaveLength(1);
  });

  it("an existing solution on the first paint does not move the page", async () => {
    renderDesk(managerDesk({ open: managerOpen({ editable: false, solution: aiSolution() }) }));
    await screen.findByTestId("solution-card");
    expect(scrolled).toEqual([]);
  });

  /** A drafted desk whose solution is `before` until a press works, then `after`; Pip's card lands at the end of the chat. */
  function pressAndReload(before: ManagerSolutionView, after: ManagerSolutionView) {
    let pressed = false;
    const deskWith = (solution: ManagerSolutionView) =>
      managerDesk({
        open: managerOpen({ open: openDesk({ status: "new-solution-drafted" }), editable: false, solution }),
      });
    const pip = { from: "pip" as const, text: "Done.", cards: [{ kind: "answer", title: "Done", body: "Done." }] };
    const { fn } = fakeFetch((url) => {
      if (url === "/api/action") {
        pressed = true;
        return { ok: true, message: "Done." };
      }
      return { ...smState(deskWith(pressed ? after : before)), messages: pressed ? [pip] : [] };
    });
    render(<SeatChat seat="senior-manager" fetcher={fn} pollMs={0} jobId="2318" initial={smState(deskWith(before))} />);
  }

  const confirmedParts = aiSolution().parts.map((p) => ({ ...p, confirmed: true, word: "Confirmed" as const, colour: "green" as const }));
  const savedDraft = aiSolution({ parts: confirmedParts, saved: true, hash7: "a19bfa5", savedLine: "Every part is confirmed: draft v1.1 saved in the runtime folder · a19bfa5" });
  const RUN = {
    passed: 23,
    failed: 0,
    notApplicable: 2,
    counts: "23 passed, 0 failed, 2 not applicable",
    hash7: "a19bfa5",
    current: true,
    lines: [],
  };

  it("Run tests that works brings the test run into view, where the bar still is, not the end of the chat", async () => {
    pressAndReload(savedDraft, { ...savedDraft, testRun: RUN, canSend: true });
    fireEvent.click(await screen.findByRole("button", { name: "Run tests" }));
    await waitFor(() => expect(scrolled.some((el) => el.classList.contains("test-run"))).toBe(true));
    expect(scrolled.some((el) => el.hasAttribute("data-item"))).toBe(false);
    expect(screen.getByRole("button", { name: "Send to HQ" })).toBeTruthy();
  });

  it("Send to HQ that works brings the sent line into view", async () => {
    const ready = { ...savedDraft, testRun: RUN, canSend: true };
    pressAndReload(ready, {
      ...ready,
      status: "sent-to-hq",
      canEdit: false,
      canSend: false,
      sendLine: "Sent to HQ by Senior manager (role-played), 6 Oct, 10:00.",
    });
    fireEvent.click(await screen.findByRole("button", { name: "Send to HQ" }));
    await waitFor(() => expect(scrolled.some((el) => el.classList.contains("send-line"))).toBe(true));
    expect(scrolled.some((el) => el.hasAttribute("data-item"))).toBe(false);
  });

  it("a poll that brings the same run moves nothing", async () => {
    renderDesk(managerDesk({ open: managerOpen({ editable: false, solution: { ...savedDraft, testRun: RUN } }) }));
    await screen.findByTestId("solution-card");
    expect(scrolled).toEqual([]);
  });
});

describe("C8a: Clear stop and Confirm cause", () => {
  function stop(stopId: string, needs: boolean): ManagerStopRow {
    return {
      key: `${stopId}|tower-a|23|core|button|2026-10-06T10:00:00+08:00`,
      stopId,
      place: "Tower A, Level 23",
      title: `Trigger of ${stopId}.`,
      call: `Who to call for ${stopId}`,
      opened: "Raised by Technician (role-played), 6 Oct, 10:00. 1 job locked.",
      needsSafetyRecord: needs,
      ...(needs
        ? {
            safetyRecordLabel: "Safety record: Fire Safety Manager told and agreed (role-played)",
            note: "This is a safety record, not an approval.",
          }
        : {}),
    };
  }

  it("RS-01 carries the safety record tick, labelled a safety record, not an approval; Clear stop sends it", async () => {
    const calls = renderDesk(managerDesk({ stops: [stop("RS-01", true)] }));
    const row = within(await screen.findByTestId("stop-RS-01"));
    expect(row.getByText("This is a safety record, not an approval.")).toBeTruthy();
    fireEvent.change(row.getByLabelText("Reason (3 words or more)"), { target: { value: "All clear from the wardens" } });
    fireEvent.click(row.getByLabelText("Safety record: Fire Safety Manager told and agreed (role-played)"));
    fireEvent.click(row.getByRole("button", { name: "Clear stop RS-01" }));
    await waitFor(() => expect(presses(calls)).toHaveLength(1));
    expect(presses(calls)[0]).toEqual({
      seat: "senior-manager",
      action: "clear-stop",
      payload: { stop: stop("RS-01", true).key, reason: "All clear from the wardens", safetyRecord: true },
    });
  });

  it("RS-04 has no tick", async () => {
    const calls = renderDesk(managerDesk({ stops: [stop("RS-04", false)] }));
    const row = within(await screen.findByTestId("stop-RS-04"));
    expect(row.queryByRole("checkbox")).toBeNull();
    expect(row.getByText("Call: Who to call for RS-04")).toBeTruthy();
    fireEvent.change(row.getByLabelText("Reason (3 words or more)"), { target: { value: "Ceiling is dry again" } });
    fireEvent.click(row.getByRole("button", { name: "Clear stop RS-04" }));
    await waitFor(() => expect(presses(calls)).toHaveLength(1));
    expect(presses(calls)[0]).toEqual({
      seat: "senior-manager",
      action: "clear-stop",
      payload: { stop: stop("RS-04", false).key, reason: "Ceiling is dry again", safetyRecord: false },
    });
  });

  it("Confirm cause on a case someone else fixed; none on the senior manager's own", async () => {
    const calls = renderDesk(
      managerDesk({
        cases: [
          { id: "R-01", jobId: "2319", line: "R-01 · job 2319 · Sun heat on the west glass", why: "Blinds were up.", canConfirm: true },
          { id: "R-02", jobId: "2318", line: "R-02 · job 2318 · Morning start-up", why: "Pre-cool ran early.", canConfirm: false, note: "You fixed this one: a second person confirms the cause." },
        ],
      })
    );
    expect(await screen.findByText("You fixed this one: a second person confirms the cause.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Confirm cause R-02" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Confirm cause R-01" }));
    await waitFor(() => expect(presses(calls)).toHaveLength(1));
    expect(presses(calls)[0]).toEqual({ seat: "senior-manager", action: "confirm-cause", payload: { caseId: "R-01" } });
  });
});
