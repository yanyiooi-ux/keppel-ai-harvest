// @vitest-environment jsdom

/**
 * D2 review: Story mode on the real desks.
 *
 * The first block plays the whole story with the real player against the
 * real route code (resetDemo, actionTurn, chatTurn, seatView), handed in as
 * the player's fetch, so every seat on the stage is the real SeatChat with
 * the real desks and the engine's real views. After each step it checks that
 * every outline names an element that is really there, that the page scrolls
 * to what the step is about, and that what the judge reads there agrees with
 * the caption. On Saved answers, network blocked: the one saved answer the run
 * needs is written into the test's own temp folder, as in demo-flow, and the
 * model client must never be called.
 *
 * The rest: the raised stop's words against the engine's lock and alert rules,
 * and the player's edge cases with a fake server.
 */

import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent, within } from "@testing-library/react";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import * as memory from "../lib/memory";
import { resetDemo } from "../lib/actions";
import { actionTurn } from "../lib/action-turn";
import { chatTurn } from "../lib/chat-turn";
import { seatView } from "../lib/seat-view";
import { loadPill, loadAndCheckPill } from "../lib/pill";
import { alertsForStop, locksForStop } from "../lib/safety";
import { newSolutionSpec, saveReplay, REPLAY_BANNER, type AiDeps, type ModelClient } from "../lib/ai";
import {
  STORY,
  STORY_LOOK_LINE,
  STORY_NOT_THROUGH,
  STORY_READ_FAILED,
  STORY_SHARED_LINE,
  STORY_SOMEONE_ELSE,
  storyAiPickUrl,
  storyFocusIn,
  storyScrollTarget,
} from "../lib/story";
import { BUILDING_B_INTRO, RAISED_BELOW, buildingBLine, raisedWords, ruleBookWords } from "../lib/plain-words";
import { StoryPlayer } from "../app/components/story/StoryPlayer";
import { SeatChat } from "../app/components/chat/SeatChat";
import { rerankRows } from "../app/components/chat/TechnicianDesk";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");
const v10 = loadPill("ts-cc", "1.0");
const DEMO_FIX =
  "If the zone had a fit-out in the last 12 months, check where the thermostat sits against the fit-out drawing before any nudge.";
const DEMO_WHY =
  "The fit-out 8 months ago moved the core thermostat next to the new printer bay, so it reads warm and the box keeps cooling the open area.";
const SUGGESTION = JSON.stringify({ ruleText: DEMO_FIX, fact: "fit-out-12m", effects: [{ effect: "put-first", step: 21 }] });

const OPENINGS = Object.fromEntries(
  ["tenant", "technician", "senior-manager", "hq", "aom-tower-a"].map((s) => [s, { text: `Opening for ${s}.`, never: "Pip never x" }])
);

const ownDirs: string[] = [];
afterAll(() => {
  for (const dir of ownDirs) rmSync(dir, { recursive: true, force: true });
});

let scrolled: Element[] = [];
const realScroll = Element.prototype.scrollIntoView;

beforeEach(() => {
  scrolled = [];
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this);
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("the component reached the network");
    })
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Element.prototype.scrollIntoView = realScroll;
});

type Body = Record<string, unknown>;

const respond = (value: unknown, status = 200) => ({ ok: status < 400, status, json: async () => value }) as Response;

/** The routes' own code as the player's fetch: what POST /api/reset, /api/action, /api/chat and GET /api/state run. */
function engineFetch() {
  let modelCalls = 0;
  const client: ModelClient = {
    async complete() {
      modelCalls += 1;
      return { content: SUGGESTION, finish: "stop" };
    },
  };
  const replayDir = mkdtempSync(join(tmpdir(), "pill-desk-story-review-"));
  ownDirs.push(replayDir);
  const deps: AiDeps = { client, replayDir };
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? (JSON.parse(String(init.body)) as Body) : null;
    if (url === "/api/reset") return respond(resetDemo(REAL_NOW));
    if (url.startsWith("/api/state")) {
      const seat = new URL(url, "http://local").searchParams.get("seat") ?? "";
      return respond({ ok: true, ...seatView(memory.read(), seat, "replay", REAL_NOW) });
    }
    if (url === "/api/action") {
      const job = body!.job as string | undefined;
      if (body!.action === "log-new-solution" && job) {
        const key = newSolutionSpec(v10, DEMO_FIX, DEMO_WHY, {
          seat: "senior-manager",
          version: "1.0",
          job: memory.jobById(memory.read(), job)!,
        }).key;
        saveReplay(key, { text: SUGGESTION, pass: true }, replayDir);
      }
      const r = await actionTurn(
        { seat: body!.seat as string, action: body!.action as string, jobId: job, payload: body!.payload as Body | undefined },
        "replay",
        deps,
        REAL_NOW
      );
      return respond(r, r.ok ? 200 : 403);
    }
    if (url === "/api/chat") {
      const out = await chatTurn(body as never, "replay", deps, REAL_NOW);
      return respond(out.body, out.status);
    }
    throw new Error(`no route for ${url}`);
  });
  return { fn, modelCalls: () => modelCalls };
}

const button = (name: string) => screen.getByRole("button", { name });
const stepLine = () => screen.getByTestId("story-count").textContent;
const stage = () => screen.getByTestId("story-stage");

/** What an element reads, each piece of text spaced from the next, as the eye reads a badge and its words. */
function text(el: Element | undefined | null): string {
  if (!el) return "";
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? "");
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

describe("D2 review: every step on the real desks", () => {
  it("outlines what each step changed, scrolls to it, and the screen agrees with the caption", async () => {
    expect(process.env.LLM_API_KEY).toBe("");
    const { fn, modelCalls } = engineFetch();
    render(
      <StoryPlayer
        aiMode="replay"
        openings={OPENINGS}
        fetcher={fn as unknown as (input: string, init?: RequestInit) => Promise<Response>}
        paceMs={0}
        minPendingMs={0}
        lookMs={0}
        holdMs={() => 10}
        autoplay={false}
      />
    );

    for (const step of STORY) {
      fireEvent.click(button("Next"));
      await waitFor(() => expect(stepLine()).toBe(`Step ${step.n} of 8`));
      await waitFor(() => expect(stage().getAttribute("data-phase")).toBe("shown"), { timeout: 15000 });
      expect(stage().getAttribute("data-seat")).toBe(step.seat);
      const root = stage();

      // Every outline the step names is on the real screen: the step's, each press's and its first look.
      for (const f of [...step.focus, ...(step.look ?? []), ...step.presses.flatMap((p) => p.show ?? [])]) {
        expect(storyFocusIn(root, [f]), `step ${step.n}: ${f.selector}`).toHaveLength(1);
      }
      const marked = Array.from(root.querySelectorAll(".story-focus"));
      expect(new Set(marked)).toEqual(new Set(storyFocusIn(root, step.focus)));
      // The page's last scroll is to what the step is about.
      const target = storyScrollTarget(root, step.focus)!;
      expect(scrolled.at(-1), `step ${step.n}`).toBe(target);

      // One name for the rule book: no "brain" and no "pill owner" anywhere on the stage.
      expect(text(root)).not.toMatch(/\bbrain\b|pill owner/i);

      switch (step.n) {
        case 2: {
          // The caption's "5 times in 30 days" is the outlined card's own count.
          expect(step.caption).toContain("5 times in 30 days");
          expect(text(marked[0])).toContain("5 calls at this spot in 30 days");
          expect(text(root)).not.toContain("buildings.json");
          expect(text(root)).toContain("(from the building records)");
          break;
        }
        case 3: {
          // All 3 causes, the two ruled out crossed out, and the thermostat "Now 1st, was 3rd" (the caption's 3rd to 1st).
          const rows = Array.from(target.querySelectorAll("li")).map((li) => text(li));
          expect(rows).toEqual([
            "Ruled out Morning start-up runs too cold",
            "Ruled out Core box held at minimum airflow",
            "Now 1st, was 3rd Thermostat in the wrong spot after a fit-out",
          ]);
          expect(target.querySelectorAll("li.is-out")).toHaveLength(2);
          expect(step.caption).toContain("from 3rd to 1st");
          break;
        }
        case 5: {
          // It ends on the test result: 23 pass, none fail, 2 do not apply.
          expect(target.classList.contains("test-run")).toBe(true);
          expect(text(target)).toContain("23 passed");
          expect(text(target)).toContain("0 failed");
          expect(text(target)).toContain("2 not applicable");
          // Who wrote the rule says the same everywhere: the AI, from a saved real answer.
          expect(step.caption).toContain("the AI drafts the rule");
          expect(step.presses.map((p) => p.label).join(" ")).toContain("The AI drafts the rule");
          const card = root.querySelector('[data-testid="solution-card"]')!;
          expect(text(card)).toContain(REPLAY_BANNER);
          expect(text(card)).toContain("AI drafted, confirmed by the senior manager");
          expect(text(card)).toContain("saved as draft version 1.1");
          expect(text(card)).not.toContain("runtime folder");
          break;
        }
        case 6: {
          // It holds on Building B, whose line says what changed there.
          expect(text(target)).toBe(buildingBLine("1.1", "Thermostat in the wrong spot after a fit-out"));
          expect(text(target)).toContain("Nobody in Building B had to do anything");
          expect(text(marked[1])).toContain("Thermostat in the wrong spot after a fit-out");
          expect(text(root)).toContain("Version 1 of the rule book");
          expect(text(root)).toContain("Another building, same rule book");
          expect(step.caption).toContain("rule book");
          break;
        }
        case 7: {
          // The cost before and with Pill Desk side by side, and the decision on screen for the hold.
          const compare = root.querySelector('[data-testid="aom-meter-compare"]')!;
          expect(text(compare)).toContain("Before Pill Desk 5 calls, 5 visits, S$600 and counting");
          expect(text(compare)).toContain("With Pill Desk 2 calls, 2 visits, S$420");
          expect(target.getAttribute("data-testid")).toBe("charge-decision");
          expect(text(target)).toContain("Tenant pays · S$350, made-up demo amount");
          expect(text(target)).toContain("Reason: Fit-out work is the tenant's own");
          break;
        }
        case 8: {
          // The card the press made says it is raised; the typed card above no longer offers the press.
          const red = Array.from(root.querySelectorAll(".card.is-red"));
          expect(target).toBe(red.at(-1));
          expect(text(target.querySelector(".raised-line"))).toBe(`Raised ${raisedWords("RS-04")}`);
          expect(text(red[0])).toContain(RAISED_BELOW);
          expect(within(root).queryByRole("button", { name: /Raise this stop/ })).toBeNull();
          break;
        }
      }
    }
    expect(modelCalls()).toBe(0);
  }, 60000);
});

describe("D2 review: plain words for what a press did", () => {
  it("a raised stop says what the engine really does: what it locks and who it alerts", () => {
    const pill = loadAndCheckPill("ts-cc", "1.0");
    const spot = { building: "tower-a", floor: 23, zone: "core" };
    const jobs = [
      { id: "same-zone", ...spot },
      { id: "same-floor", building: "tower-a", floor: 23, zone: "west" },
      { id: "other-floor", building: "tower-a", floor: 12, zone: "core" },
    ];
    expect(pill.red_stops).toHaveLength(10);
    for (const stop of pill.red_stops) {
      const words = raisedWords(stop.id);
      const locked = locksForStop(stop.id, spot, jobs, "button");
      const alerted = alertsForStop(stop, "Tower A", 23).map((a) => a.seat);
      if (locked.length === 0) {
        expect(words, stop.id).toBe("This stop locks no work and sends no alert.");
        expect(alerted, stop.id).toEqual([]);
        continue;
      }
      // A zone lock says "in this zone"; a floor lock says "on this floor".
      expect(locked, stop.id).toEqual(words.includes("Open jobs in this zone") ? ["same-zone"] : ["same-zone", "same-floor"]);
      expect(words, stop.id).toContain(locked.length === 1 ? "Open jobs in this zone" : "Open jobs on this floor");
      expect(alerted, stop.id).toEqual(["senior-manager", "aom"]);
      expect(words, stop.id).toContain("Pip alerted the senior manager and the Asset Operations Manager.");
    }
  });

  it("a typed card offers Raise this stop until a later card shows the stop raised", () => {
    const typed = {
      kind: "red-stop",
      stopId: "RS-04",
      raiseStopId: "RS-04",
      jobId: "2318",
      title: "Water dripping.",
      body: "Keep away.",
      receipt: "Red stop RS-04 · pill v1.0 · AI calls: 0",
    };
    const picked = { kind: "red-stop", stopId: "RS-04", title: "Water dripping.", body: "Keep away.", receipt: "Red stop RS-04 · pill v1.0 · AI calls: 0" };
    const view = (cards: Body[][]) => ({
      seat: "tenant",
      label: "Tenant (role-played)",
      pipNever: "x",
      chips: [],
      messages: cards.map((c) => ({ from: "pip", text: "x", cards: c })),
      notices: [],
    });
    const fetcher = vi.fn(async () => {
      throw new Error("no read");
    });
    const { rerender } = render(<SeatChat seat="tenant" view={view([[typed]]) as never} fetcher={fetcher} pollMs={0} />);
    expect(screen.getByRole("button", { name: "Raise this stop: RS-04" })).toBeTruthy();
    expect(screen.queryByText(RAISED_BELOW)).toBeNull();
    rerender(<SeatChat seat="tenant" view={view([[typed], [picked]]) as never} fetcher={fetcher} pollMs={0} />);
    expect(screen.queryByRole("button", { name: "Raise this stop: RS-04" })).toBeNull();
    expect(screen.getByText(RAISED_BELOW)).toBeTruthy();
    expect(screen.getByText(raisedWords("RS-04"))).toBeTruthy();
    // The stop's own words and its receipt stay word for word (S11).
    expect(screen.getAllByText("Water dripping.")).toHaveLength(2);
    expect(screen.getAllByText("Red stop RS-04 · pill v1.0 · AI calls: 0")).toHaveLength(2);
  });

  it("Building B's line says why it is there, then what the new version changed there", () => {
    expect(buildingBLine("1.0", "Morning start-up runs too cold")).toBe(BUILDING_B_INTRO);
    expect(buildingBLine("1.1", null)).toBe(BUILDING_B_INTRO);
    expect(buildingBLine("1.1", "Thermostat in the wrong spot after a fit-out")).toBe(
      'Building B now runs version 1.1 of the rule book. Its list starts with "Thermostat in the wrong spot after a fit-out". Nobody in Building B had to do anything.'
    );
  });

  it("the pill's other names read as the rule book, and nothing else changes", () => {
    expect(ruleBookWords("v1.1 · a19bfa5 · approved by HQ pill owner (role-played) · parent v1.0")).toBe(
      "v1.1 · a19bfa5 · approved by head office, owner of the rule book (role-played) · parent v1.0"
    );
    expect(ruleBookWords("A1: version 1 of the brain")).toBe("A1: version 1 of the rule book");
    expect(ruleBookWords("Another building, same brain")).toBe("Another building, same rule book");
    expect(ruleBookWords("Lead · pill v1.0 · AI calls: 0")).toBe("Lead · pill v1.0 · AI calls: 0");
  });

  it("the re-rank list keeps the old order, crosses out what was ruled out and says where the rest moved", () => {
    const before = [
      { causeId: "a", label: "A" },
      { causeId: "b", label: "B" },
      { causeId: "c", label: "C" },
    ];
    const lead = (causeId: string) => ({ causeId, label: causeId.toUpperCase() }) as never;
    const open = (leads: string[], out: string[]) => ({ leads: leads.map(lead), ruledOut: out.map(lead) }) as never;
    expect(rerankRows(before, open(["b", "c"], ["a"]))!.map((r) => r.word)).toEqual(["Ruled out", "Now 1st, was 2nd", "Now 2nd, was 3rd"]);
    expect(rerankRows(before, open(["a", "b", "c"], []))).toBeNull();
  });

  it("a pick on the AI switch in Story mode reloads marked as picked; elsewhere it just reloads", () => {
    expect(storyAiPickUrl("/demo")).toBe("/demo?ai=picked");
    expect(storyAiPickUrl("/seat/tenant")).toBeNull();
    expect(storyAiPickUrl(null)).toBeNull();
  });

  it("says plainly that opening the page also starts the shared demo over", () => {
    expect(STORY_SHARED_LINE).toMatch(/Opening this page, Restart and Back/);
    expect(STORY_SHARED_LINE).not.toMatch(/\bseat\b|memory/);
  });
});

// ---- The player's edge cases, with a fake server ----

function seatState(seat: string) {
  return {
    seat,
    label: `${seat} (role-played)`,
    pipNever: "x",
    chips: [],
    messages: [{ from: "pip", text: `View of ${seat}`, cards: [{ kind: "answer", title: `Card of ${seat}`, receipt: "r" }] }],
    notices: [],
  };
}

interface FakeOptions {
  /** Throw on this press (counted from 1, every /api/action). */
  throwOnAction?: number;
  /** Refuse this press with this reason. */
  refuse?: (body: Body) => string | null;
  /** Fail every GET /api/state once this many presses went through. */
  readsFailAfter?: number;
  /** What each press says. */
  said?: string;
}

function fakeServer(options: FakeOptions = {}) {
  const calls: { url: string; body: Body | null }[] = [];
  let actions = 0;
  let through = 0;
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? (JSON.parse(String(init.body)) as Body) : null;
    calls.push({ url, body });
    if (url === "/api/reset") return respond({ ok: true, message: "Demo reset. 1 speak-first notice." });
    if (url.startsWith("/api/state")) {
      if (options.readsFailAfter !== undefined && through >= options.readsFailAfter) throw new Error("socket hang up");
      return respond({ ok: true, ...seatState(new URL(url, "http://local").searchParams.get("seat") ?? "") });
    }
    if (url === "/api/action") {
      actions += 1;
      if (options.throwOnAction === actions) throw new Error("socket hang up");
      const no = options.refuse?.(body!);
      if (no) return respond({ ok: false, message: no }, 403);
      through += 1;
      return respond({ ok: true, message: options.said ?? "Done.", jobId: body!.action === "report" ? "2319" : body!.job });
    }
    if (url === "/api/chat") {
      through += 1;
      return respond({
        ok: true,
        cards: [{ kind: "red-stop", stopId: "RS-04", title: "Water", body: "Keep away", receipt: "r", raiseStopId: "RS-04", jobId: "2318" }],
      });
    }
    throw new Error(`no fake for ${url}`);
  });
  return { fn, calls, actions: () => calls.filter((c) => c.url === "/api/action").map((c) => c.body!.action) };
}

function player(server: ReturnType<typeof fakeServer>, props: Partial<Parameters<typeof StoryPlayer>[0]> = {}) {
  return render(
    <StoryPlayer
      aiMode="replay"
      openings={OPENINGS}
      fetcher={server.fn as unknown as (input: string, init?: RequestInit) => Promise<Response>}
      paceMs={0}
      minPendingMs={0}
      lookMs={0}
      holdMs={() => 10}
      autoplay={false}
      {...props}
    />
  );
}

describe("D2 review: the player never reports a press wrongly", () => {
  it("a press that went through stays Done when only the screen after it fails to load", async () => {
    const server = fakeServer({ readsFailAfter: 1 });
    player(server);
    fireEvent.click(button("Next"));
    await waitFor(() => expect(stage().getAttribute("data-phase")).toBe("failed"));
    // Reset went through (it is no press the read counts), then the report went through, then its read failed.
    expect(screen.getByText(STORY_READ_FAILED)).toBeTruthy();
    const items = Array.from(screen.getByRole("list", { name: "What this step presses" }).querySelectorAll("li"));
    expect(text(items[1])).toBe("Done Report a problem: Too cold");
    expect(items[1].className).toBe("is-done");
    expect(items.filter((li) => li.classList.contains("is-failed"))).toHaveLength(0);
    expect(screen.queryByText(STORY_NOT_THROUGH)).toBeNull();
    expect(screen.queryByText(STORY_SOMEONE_ELSE)).toBeNull();
  });

  it("when Back's quick replay fails, the stage never keeps a screen the reset wiped", async () => {
    // ?step=3: the technician's screen. Then Back, whose replay breaks on its 3rd press, in step 1 (the tenant).
    const server = fakeServer({ throwOnAction: STORY.slice(0, 3).reduce((n, s) => n + s.presses.filter((p) => p.kind !== "reset").length, 0) + 3 });
    player(server, { startStep: 3 });
    await waitFor(() => expect(stage().getAttribute("data-phase")).toBe("shown"));
    expect(stage().getAttribute("data-seat")).toBe("technician");
    fireEvent.click(button("Back"));
    await waitFor(() => expect(stage().getAttribute("data-phase")).toBe("failed"));
    expect(stepLine()).toBe("Step 1 of 8");
    expect(stage().getAttribute("data-seat")).toBe("tenant");
    expect(within(stage()).queryByText("View of technician")).toBeNull();
  });

  it("a refusal says that someone else opening Story mode may have started it over", async () => {
    const server = fakeServer({ refuse: (b) => (b.action === "open-job" ? "Open the job first." : null) });
    player(server);
    fireEvent.click(button("Next"));
    await waitFor(() => expect(stage().getAttribute("data-phase")).toBe("shown"));
    fireEvent.click(button("Next"));
    await waitFor(() => expect(stage().getAttribute("data-phase")).toBe("failed"));
    expect(screen.getByText("Open the job first.")).toBeTruthy();
    expect(screen.getByText(STORY_SOMEONE_ELSE)).toBeTruthy();
  });

  it("the app's reply shows each press's own words, never Reset's housekeeping line", async () => {
    const server = fakeServer({ said: "" });
    player(server);
    fireEvent.click(button("Next"));
    await waitFor(() => expect(stage().getAttribute("data-phase")).toBe("shown"));
    expect(screen.queryByTestId("story-said")).toBeNull();
    expect(screen.queryByText(/speak-first notice/)).toBeNull();
  });

  it("a step with something to look at shows it first, before its press", async () => {
    const server = fakeServer();
    player(server, { startStep: 5, lookMs: 400 });
    await waitFor(() => expect(stage().getAttribute("data-phase")).toBe("shown"));
    expect(stepLine()).toBe("Step 5 of 8");
    fireEvent.click(button("Next"));
    await waitFor(() => expect(screen.getByTestId("story-now").textContent).toBe(STORY_LOOK_LINE));
    expect(server.actions()).not.toContain("approve-solution");
    await waitFor(() => expect(server.actions()).toContain("approve-solution"));
    await waitFor(() => expect(stage().getAttribute("data-phase")).toBe("shown"));
  });

  it("keeps the viewer's pick on the AI switch, and says so truly", () => {
    const switchAi = vi.fn();
    player(fakeServer(), { aiMode: "live", aiPicked: true, switchAi });
    expect(switchAi).not.toHaveBeenCalled();
    expect(screen.getByText("The AI switch is on Live, as it was picked here, so the AI lines follow it.")).toBeTruthy();
    expect(screen.queryByText(/could not move the AI switch/)).toBeNull();
  });
});
