// @vitest-environment jsdom

/**
 * D4 review fixes, on the real screens with the real views (fake fetch only).
 *
 * 1. The seat reads "Asset Operations Manager" in every line a person reads,
 *    engine lines included, through the render-time plain layer; the engine's
 *    own lines and a red stop's own words stay as they are.
 * 2. /flow tells the truth about the demo path: the button that fills in the
 *    demo's words, no promised test count, the effects Story mode picks, and
 *    how a job that needed outside help really closes.
 * 3. The Asset Operations Manager's safety box never says "no stop" over an
 *    alert without saying the floor is not stopped.
 * 4. The senior manager's outside-help card and note say what head office decided.
 * 5. The video player turns into the plain line when the file cannot load.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { readFileSync } from "fs";
import { join } from "path";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import { SeatChat } from "../app/components/chat/SeatChat";
import { NO_STOP_RAISED } from "../app/components/chat/AomDesk";
import { ChatCard } from "../app/components/chat/ChatCard";
import { Plain } from "../app/components/Plain";
import { HowStory } from "../app/components/how/HowStory";
import { FlowView } from "../app/components/flow/FlowView";
import { VideoPlayer } from "../app/components/VideoPlayer";
import * as memory from "../lib/memory";
import { resetDemo, runAction } from "../lib/actions";
import { actionTurn } from "../lib/action-turn";
import { chatTurn } from "../lib/chat-turn";
import { seatView, type SeatView } from "../lib/seat-view";
import { howView } from "../lib/how";
import { flowButtons, flowView, storyPartWord } from "../lib/flow";
import { STORY } from "../lib/story";
import { DEMO_FIX_LINE, DEMO_WHY_LINE } from "../lib/demo-words";
import { SEAT_LABELS } from "../lib/permissions";
import { AOM_NAME, aomWords, effectWord, noticeHead, outsideHelpStatus } from "../lib/plain-words";
import { VIDEO_MISSING } from "../lib/video-words";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");
const SEATS = ["tenant", "technician", "senior-manager", "hq", "aom-tower-a"] as const;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network blocked in tests"))));
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

function view(seat: string): SeatView {
  return seatView(memory.read(), seat, "off", REAL_NOW);
}

function renderSeat(seat: string) {
  const state = view(seat);
  const fn = vi.fn(async () => ({ json: async () => state }) as Response);
  return render(<SeatChat seat={seat} fetcher={fn} pollMs={0} initial={state} />);
}

/** The text a person reads, with each red stop's own words and its short-forms line taken out. */
function plainText(container: HTMLElement): string {
  const copy = container.cloneNode(true) as HTMLElement;
  copy.querySelectorAll(".card.is-red, .gloss").forEach((el) => el.remove());
  return copy.textContent ?? "";
}

/** The demo path to the charge decision and the typed safety words, AI off (the same presses as Story mode). */
async function demoPath(): Promise<void> {
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
    { seat: "senior-manager", action: "log-new-solution", jobId: "2318", payload: { fixLine: DEMO_FIX_LINE, whyLine: DEMO_WHY_LINE } },
    "off",
    undefined,
    REAL_NOW
  );
  expect(logged.ok).toBe(true);
  for (const [part, value] of [
    ["rule-text", DEMO_FIX_LINE],
    ["fact", "fit-out-12m"],
    ["effect-1", "block:25"],
    ["effect-2", "put-first:21"],
  ]) {
    press("senior-manager", "confirm-part", "2318", { part, value });
  }
  press("senior-manager", "run-tests", "2318");
  press("senior-manager", "send-to-hq", "2318");
  press("hq", "approve-solution", "2318");
  const a4 = (memory.read().requests as { kind?: string; id: string }[]).find((r) => r.kind === "A4")!;
  press("aom-tower-a", "decide-charge", "2318", { requestId: a4.id, choice: "tenant-pays", amount: 350, reason: "Fit-out work is the tenant's own" });
  const typed = await chatTurn({ seat: "tenant", text: "water dripping near the lights", job: "2318" }, "off", undefined, REAL_NOW);
  expect(typed.status).toBe(200);
}

describe("D4 review: the seat's full name in every line a person reads", () => {
  it("the plain layer reads AOM as the full name, and names the seat once inside its own label", () => {
    const { container } = render(<Plain text="Its cost goes to the senior manager and the AOM." />);
    expect(container.textContent).toBe(`Its cost goes to the senior manager and the ${AOM_NAME}.`);
    expect(aomWords("Decided by AOM, Tower A: Keppel Asset Operations Manager (role-played), 6 Oct, 10:00")).toBe(
      "Decided by Asset Operations Manager, Tower A: Keppel (role-played), 6 Oct, 10:00"
    );
    expect(aomWords(SEAT_LABELS["aom-tower-a"])).toBe("Asset Operations Manager, Tower A: Keppel (role-played)");
  });

  it("a red stop's own words keep the short form, with its meaning under them", () => {
    const { container } = render(<ChatCard colour="red" colourWord="Stop" title="Who to call" body="FM chief engineer for settings, AOM for cost or fault" />);
    expect(container.textContent).toContain("FM chief engineer for settings, AOM for cost or fault");
    expect(container.querySelector(".gloss")!.textContent).toContain("AOM means Asset Operations Manager");
  });

  it("after the whole demo, no seat shows the bare short form outside a red stop's own words", async () => {
    await demoPath();
    // The engine's own lines still say AOM: the change is on screen only.
    const engine = JSON.stringify([view("technician"), view("hq"), view("tenant"), view("aom-tower-a")]);
    expect(engine).toMatch(/goes through the AOM/);
    expect(engine).toMatch(/Approved by the AOM \(role-played\)/);
    for (const seat of SEATS) {
      const { container, unmount } = renderSeat(seat);
      await screen.findAllByText(/Pip/);
      expect(plainText(container), seat).not.toMatch(/\bAOM\b/);
      unmount();
    }
  });

  it("the charge card's decided-by line and the tenant's card read the same as the tenant's own chat", async () => {
    await demoPath();
    const card = view("aom-tower-a").aom!.charges[0].tenantCard;
    expect(card).toContain("Approved by the AOM (role-played).");
    const shown = aomWords(card!);
    const aom = renderSeat("aom-tower-a");
    const decision = await within(aom.container).findByTestId("charge-decision");
    expect(decision.textContent).toContain("Decided by Asset Operations Manager, Tower A: Keppel (role-played)");
    expect(within(decision).getByText(shown)).toBeTruthy();
    aom.unmount();
    renderSeat("tenant");
    expect((await screen.findAllByText(shown)).length).toBeGreaterThan(0);
  });

  it("/how names the seat in full on the ring and in the ranking steps, and nowhere says AOM", () => {
    render(<HowStory view={howView(memory.read())} />);
    const ring = within(screen.getByTestId("brain-ring"));
    expect(ring.getByText("Asset Operations Manager, Tower A: Keppel (role-played)")).toBeTruthy();
    expect(screen.getByTestId("how-rank-steps").textContent).toContain(`but goes through the ${AOM_NAME}.`);
    expect(document.body.textContent).not.toMatch(/\bAOM\b/);
  });
});

describe("D4 review: /flow says what the app really does", () => {
  it("step 4 names Use the demo words, the effects Story mode picks, and promises no test count", () => {
    const step = flowView().steps[4];
    const words = step.does.map((b) => ("text" in b ? b.text : "button" in b ? `[${b.button}]` : b.typed)).join("");
    expect(words).toContain("[Log new solution], then [Use the demo words] and [Log it]");
    expect(words).toContain("you pick each part by hand");
    // The effects Story mode confirms, read from its own presses.
    const confirms = STORY.flatMap((s) => s.presses).filter((p) => p.kind === "action" && p.action === "confirm-part");
    const value = (id: string) => confirms.find((p) => p.kind === "action" && p.payload?.part === id)!;
    const e1 = value("effect-1");
    const e2 = value("effect-2");
    expect(e1.kind === "action" && effectWord(String(e1.payload!.value))).toBe(storyPartWord("effect-1"));
    expect(e2.kind === "action" && effectWord(String(e2.payload!.value))).toBe(storyPartWord("effect-2"));
    expect(words).toContain(`Effect 1 to "${storyPartWord("effect-1")}" and Effect 2 to "${storyPartWord("effect-2")}"`);
    expect(words).not.toMatch(/\b2[34]\b/);
  });

  it("the senior manager's note no longer says Solved closes a job that needed outside help", () => {
    render(<FlowView flow={flowView()} video={<VideoPlayer available={false} />} />);
    const tree = screen.getByLabelText("The senior manager's three ways out");
    const note = tree.querySelector(".flow-tree-note")!.textContent ?? "";
    expect(note).not.toMatch(/contractor fixes it, the senior manager presses Solved/);
    expect(note).toContain("works only for a cause the senior manager may fix on their own");
    expect(note).toContain("is closed with Log new solution: head office approves it once, and the 30-day watch starts.");
  });

  it("names Mark solved, the A3 reason with Approve and Decline, and What needs me as buttons", () => {
    const drawn = flowButtons();
    for (const name of ["Mark solved", "Approve", "Decline", "What needs me", "Use the demo words"]) {
      expect(drawn, name).toContain(name);
    }
    render(<FlowView flow={flowView()} video={<VideoPlayer available={false} />} />);
    const text = document.body.textContent ?? "";
    expect(text).toContain("Types a reason of 3 words or more, then Approve or Decline.");
    expect(text).toContain("Every button name here is checked against the app's own buttons.");
    expect(text).toContain("Notes the app sends by itself.");
    expect(text).not.toContain("Notes sent by code.");
    expect(text).toContain("The 30-day watch starts when a job is marked solved, or when head office approves a new fix for the job.");
  });

  it("an approval mark is a dashed tag, not a pill like a button", () => {
    const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf-8");
    const rule = /\n\.flow-approval \{([^}]*)\}/.exec(css)![1];
    expect(rule).toContain("dashed");
    expect(rule).not.toContain("--r-pill");
  });
});

describe("D4 review: the safety box, the outside-help card and the video", () => {
  it("typed words alone: the box says no floor is stopped; after Raise this stop it names the open stop", async () => {
    await demoPath();
    const before = renderSeat("aom-tower-a");
    const alerts = await within(before.container).findByTestId("aom-alerts");
    expect(alerts.textContent).toContain(NO_STOP_RAISED);
    expect(alerts.textContent).not.toContain("No red stop open in Tower A.");
    expect(alerts.textContent).toContain("Red stop on Tower A, Level 23");
    before.unmount();

    press("tenant", "safety-pick", "2318", { stopId: "RS-04" });
    const after = renderSeat("aom-tower-a");
    const raised = await within(after.container).findByTestId("aom-alerts");
    expect(raised.textContent).toContain("Open now in Tower A: Water near the electrics RS-04 on Level 23");
    expect(raised.textContent).not.toContain(NO_STOP_RAISED);
  });

  it("no alert at all: the box still says No red stop open in Tower A.", async () => {
    const { container } = renderSeat("aom-tower-a");
    const alerts = await within(container).findByTestId("aom-alerts");
    expect(alerts.textContent).toContain("No red stop open in Tower A.");
  });

  it("after head office approves outside help, the card says so and the note is not headed Outside help asked", async () => {
    press("technician", "open-job", "2318");
    press("technician", "not-solved", "2318", { hoursLost: 1, extraVisits: 1, contractorOrPartsNeeded: true });
    press("senior-manager", "tick", "2318", { causeId: "rebalance", type: "found" });
    press("senior-manager", "ask-outside-help", "2318", { need: "contractor", reason: "Needs an air balancing contractor", needsMoney: true });

    const asked = view("senior-manager");
    expect(outsideHelpStatus(asked.manager!.open!.outsideHelp!).word).toBe("Waiting on HQ");

    press("hq", "decide-outside-help", "2318", { decision: "approve", reason: "Contractor is approved for this" });
    const v = view("senior-manager");
    const lines = v.manager!.open!.outsideHelp!;
    expect(outsideHelpStatus(lines)).toEqual({ colour: "green", word: "Head office said yes" });
    const note = v.notices.find((n) => n.kind === "outside-help")!;
    expect(noticeHead(note.kind, note.text)).toBe("Head office decided on outside help");

    const { container } = renderSeat("senior-manager");
    await screen.findAllByText(/Pip/);
    expect(container.textContent).toContain("Head office said yes");
    expect(container.textContent).not.toContain("Waiting on HQ");
    expect(container.textContent).toContain("Head office decided on outside help");
    expect(container.textContent).not.toContain("Outside help asked");
  });

  it("a declined request says Head office said no", () => {
    expect(outsideHelpStatus(["Asked HQ for a contractor (A3), 10:00.", "declined: Not in this year's budget"])).toEqual({
      colour: "amber",
      word: "Head office said no",
    });
  });

  it("when the file cannot load and the server answers HEAD 404, the player turns into the plain line", async () => {
    const head = vi.fn(() => Promise.resolve({ ok: false, status: 404 }));
    vi.stubGlobal("fetch", head);
    const { container } = render(<VideoPlayer available />);
    const source = container.querySelector("video source")!;
    fireEvent.error(source);
    expect(await screen.findByTestId("video-missing")).toBeTruthy();
    expect(head).toHaveBeenCalledWith("/media/pill-desk-video.mp4", { method: "HEAD", cache: "no-store" });
    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByTestId("video-missing").textContent).toBe(VIDEO_MISSING);
  });
});
