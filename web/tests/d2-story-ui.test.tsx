// @vitest-environment jsdom

/**
 * D2 on screen, fake fetch only: Story mode's player and the SeatChat props it
 * drives.
 *
 * The player presses through /api/reset, /api/action and /api/chat and reads
 * /api/state, the routes every seat uses; here a fake server answers them, so
 * nothing reaches the network. Waits, the pace between presses and the hold
 * are set to a few milliseconds, so the real timers run the story quickly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent, act, within } from "@testing-library/react";
import { StoryPlayer, runningLine, type Mark } from "../app/components/story/StoryPlayer";
import { SeatChat, NOT_THROUGH } from "../app/components/chat/SeatChat";
import { STORY, STORY_CLOSE, STORY_NOT_THROUGH } from "../lib/story";

beforeEach(() => {
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
});

type Body = Record<string, unknown>;
interface Call {
  url: string;
  method: string;
  body: Body | null;
}

const OPENINGS = Object.fromEntries(
  ["tenant", "technician", "senior-manager", "hq", "aom-tower-a"].map((s) => [s, { text: `Opening for ${s}.`, never: "Pip never x" }])
);

function seatState(seat: string, n: number) {
  const base = {
    seat,
    label: `${seat} (role-played)`,
    pipNever: "x",
    chips: ["Why?"],
    messages: [
      { from: "pip", text: `First ${seat}`, cards: [{ kind: "answer", title: `First card ${seat}`, receipt: "r" }] },
      { from: "pip", text: `View ${n}`, cards: [{ kind: "answer", title: `View ${n} of ${seat}`, receipt: "r" }] },
    ],
    notices: [],
  };
  if (seat !== "aom-tower-a") return base;
  return {
    ...base,
    aom: {
      meter: null,
      speakFirst: [],
      charges: [
        {
          id: "A4-1",
          jobId: "2318",
          text: "Who pays?",
          open: n < 999,
          statusWord: "Waits on you",
          colour: "amber",
          openedLine: "Opened",
          decision: null,
          tenantCard: null,
          receipt: "r",
        },
      ],
      choices: [{ id: "tenant-pays", label: "Tenant pays" }],
      amountMin: 0,
      amountMax: 5000,
      alerts: [],
      openStops: [],
      live: { version: "1.1", line: "v1.1" },
      impactRecords: [],
    },
  };
}

interface ServerOptions {
  /** Answer this press with a refusal. */
  refuse?: (body: Body) => string | null;
  /** Hold this press's answer until the returned release is called. */
  hold?: (body: Body) => boolean;
}

function fakeServer(options: ServerOptions = {}) {
  const calls: Call[] = [];
  let n = 0;
  const held: (() => void)[] = [];
  const respond = (value: unknown, status = 200) => ({ ok: status < 400, status, json: async () => value }) as Response;
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? (JSON.parse(String(init.body)) as Body) : null;
    calls.push({ url, method: init?.method ?? "GET", body });
    if (url === "/api/reset") {
      n += 1;
      return respond({ ok: true, message: "Demo reset. 1 speak-first notice." });
    }
    if (url.startsWith("/api/state")) {
      const seat = new URL(url, "http://local").searchParams.get("seat") ?? "";
      return respond({ ok: true, ...seatState(seat, n) });
    }
    if (url === "/api/action") {
      if (options.hold?.(body!)) await new Promise<void>((resolve) => held.push(resolve));
      const no = options.refuse?.(body!);
      if (no) return respond({ ok: false, message: no }, 403);
      n += 1;
      return respond({ ok: true, message: "Done.", jobId: body!.action === "report" ? "2319" : body!.job });
    }
    if (url === "/api/chat") {
      n += 1;
      return respond({
        ok: true,
        storedCount: 3,
        storedText: body!.text,
        cards: [{ kind: "red-stop", stopId: "RS-04", title: "Water", body: "Keep away", receipt: "r", raiseStopId: "RS-04", jobId: "2318" }],
      });
    }
    throw new Error(`no fake for ${url}`);
  });
  return {
    fn,
    calls,
    release: () => held.splice(0).forEach((r) => r()),
    actions: () => calls.filter((c) => c.url === "/api/action").map((c) => [c.body!.seat, c.body!.action]),
    posts: () => calls.filter((c) => c.method === "POST").map((c) => (c.url === "/api/reset" ? "reset" : `${c.body!.seat} ${c.body!.action ?? "chat"}`)),
  };
}

const FAST = { paceMs: 0, minPendingMs: 0 };

function player(server: ReturnType<typeof fakeServer>, props: Partial<Parameters<typeof StoryPlayer>[0]> = {}) {
  return render(
    <StoryPlayer
      aiMode="replay"
      openings={OPENINGS}
      fetcher={server.fn as unknown as (input: string, init?: RequestInit) => Promise<Response>}
      {...FAST}
      holdMs={() => 15}
      {...props}
    />
  );
}

const button = (name: string) => screen.getByRole("button", { name });
const stepLine = () => screen.getByTestId("story-count").textContent;

/** Every press the story makes, in order, as [seat, action] (a typed message is "chat"). */
const STORY_PRESSES = STORY.flatMap((s) =>
  s.presses.map((p) => (p.kind === "reset" ? "reset" : `${p.seat} ${p.kind === "chat" ? "chat" : p.action}`))
);

describe("D2: Story mode plays the real app by itself", () => {
  it("autoplay makes every press of all 8 steps in order, holds each step, and ends on the close line", async () => {
    const server = fakeServer();
    player(server);
    await waitFor(() => expect(screen.getByText(STORY_CLOSE)).toBeTruthy(), { timeout: 8000 });
    expect(server.posts()).toEqual(STORY_PRESSES);
    // The self-check's answers go to the job the report made, the charge to the open request, the raise to the stop.
    const answers = server.calls.filter((c) => c.body?.action === "answer");
    expect(answers.every((c) => c.body!.job === "2319")).toBe(true);
    expect(server.calls.find((c) => c.body?.action === "decide-charge")!.body!.payload).toMatchObject({ requestId: "A4-1" });
    expect(server.calls.find((c) => c.body?.action === "safety-pick")!.body).toMatchObject({ job: "2318", payload: { stopId: "RS-04" } });
    expect(button("Play")).toBeTruthy();
    expect(screen.getByRole("link", { name: /how it works/i }).getAttribute("href")).toBe("/how");
  }, 15000);

  it("shows one seat at a time: the seat whose step it is, with the step's caption and n of 8", async () => {
    const server = fakeServer();
    player(server, { autoplay: false });
    expect(stepLine()).toBe("Step 1 of 8");
    expect(screen.getByText(STORY[0].caption)).toBeTruthy();
    fireEvent.click(button("Next"));
    await waitFor(() => expect(screen.getByTestId("story-stage").getAttribute("data-phase")).toBe("shown"));
    expect(screen.getByTestId("story-stage").getAttribute("data-seat")).toBe("tenant");
    fireEvent.click(button("Next"));
    await waitFor(() => expect(stepLine()).toBe("Step 2 of 8"));
    await waitFor(() => expect(screen.getByTestId("story-stage").getAttribute("data-seat")).toBe("technician"));
    expect(screen.getByText(STORY[1].caption)).toBeTruthy();
    const bar = screen.getByRole("progressbar", { name: "Story progress" });
    expect(bar.getAttribute("aria-valuenow")).toBe("2");
    expect(bar.getAttribute("aria-valuemax")).toBe("8");
  });

  it("Next runs the next step's real presses; Back resets, replays quickly to the step before and shows it", async () => {
    const server = fakeServer();
    player(server, { autoplay: false });
    fireEvent.click(button("Next"));
    await waitFor(() => expect(screen.getByTestId("story-stage").getAttribute("data-phase")).toBe("shown"));
    fireEvent.click(button("Next"));
    await waitFor(() => expect(server.actions()).toContainEqual(["technician", "open-job"]));
    await waitFor(() => expect(screen.getByTestId("story-stage").getAttribute("data-phase")).toBe("shown"));
    expect(stepLine()).toBe("Step 2 of 8");

    const before = server.posts().length;
    fireEvent.click(button("Back"));
    await waitFor(() => expect(screen.getByTestId("story-stage").getAttribute("data-phase")).toBe("shown"));
    expect(stepLine()).toBe("Step 1 of 8");
    // Reset, then step 1's presses again, and nothing of step 2.
    expect(server.posts().slice(before)).toEqual(STORY_PRESSES.slice(0, STORY[0].presses.length));
    // The app's own reply to the step's last press shows, word for word.
    expect(screen.getByTestId("story-said").textContent).toBe("The app saidDone.");
    // Back does not start the story playing.
    expect(button("Play")).toBeTruthy();
  });

  it("Restart resets and plays from step 1; Pause stops it moving on after the step", async () => {
    const server = fakeServer();
    // A hold long enough that Pause always lands while step 2 is on screen, even on a busy machine.
    player(server, { autoplay: false, holdMs: () => 400 });
    fireEvent.click(button("Next"));
    await waitFor(() => expect(screen.getByTestId("story-stage").getAttribute("data-phase")).toBe("shown"));
    fireEvent.click(button("Restart"));
    await waitFor(() => expect(button("Pause")).toBeTruthy());
    await waitFor(() => expect(stepLine()).toBe("Step 2 of 8"), { timeout: 4000 });
    fireEvent.click(button("Pause"));
    await waitFor(() => expect(screen.getByTestId("story-stage").getAttribute("data-phase")).toBe("shown"));
    const count = server.posts().length;
    await new Promise((r) => setTimeout(r, 200));
    expect(server.posts().length).toBe(count);
    expect(stepLine()).toBe("Step 2 of 8");
    expect(server.posts().filter((p) => p === "reset")).toHaveLength(2);
  });

  it("while a press is on its way: Back, Next and Restart are off, and Pip is checking", async () => {
    let holding = true;
    const server = fakeServer({ hold: (b) => holding && b.action === "open-job" });
    player(server, { autoplay: false });
    fireEvent.click(button("Next"));
    await waitFor(() => expect(screen.getByTestId("story-stage").getAttribute("data-phase")).toBe("shown"));
    fireEvent.click(button("Next"));
    await waitFor(() => expect(server.actions()).toContainEqual(["technician", "open-job"]));
    expect((button("Back") as HTMLButtonElement).disabled).toBe(true);
    expect((button("Next") as HTMLButtonElement).disabled).toBe(true);
    expect((button("Restart") as HTMLButtonElement).disabled).toBe(true);
    const stage = screen.getByTestId("story-stage");
    await waitFor(() => expect(within(stage).getByText("Pip is checking")).toBeTruthy());
    expect(screen.getByTestId("story-now").textContent).toMatch(/Open job 2318/);
    // A second Next while it waits sends nothing.
    fireEvent.click(button("Next"));
    expect(server.actions().filter(([, a]) => a === "open-job")).toHaveLength(1);
    holding = false;
    await act(async () => server.release());
    await waitFor(() => expect((button("Next") as HTMLButtonElement).disabled).toBe(false));
    expect(within(stage).queryByText("Pip is checking")).toBeNull();
  });

  it("says what is happening while a step runs: the press on its way, the one that just landed, or the chat opening", () => {
    const step = STORY[0];
    const marks = (...m: Mark[]) => [...m, ...Array(step.presses.length - m.length).fill("todo")] as Mark[];
    expect(runningLine(step, marks())).toBe("Opening the chat: Tenant");
    expect(runningLine(step, marks("done", "doing"))).toBe(`Pressing: ${step.presses[1].label}`);
    // Between two presses: never "opening the chat" again.
    expect(runningLine(step, marks("done", "done", "done"))).toBe(`Done: ${step.presses[2].label}`);
  });

  it("a refused press stops autoplay and shows the app's reason; nothing after it is pressed", async () => {
    const server = fakeServer({ refuse: (b) => (b.action === "tick" ? "That job is not in progress, so it cannot be ticked." : null) });
    player(server);
    await waitFor(() => expect(screen.getByTestId("story-stage").getAttribute("data-phase")).toBe("failed"), { timeout: 5000 });
    expect(stepLine()).toBe("Step 3 of 8");
    expect(screen.getByText("That job is not in progress, so it cannot be ticked.")).toBeTruthy();
    expect(screen.getAllByText("Not done").length).toBeGreaterThan(0);
    const count = server.posts().length;
    await new Promise((r) => setTimeout(r, 150));
    expect(server.posts().length).toBe(count);
    expect(server.actions()).not.toContainEqual(["technician", "not-solved"]);
    expect((button("Next") as HTMLButtonElement).disabled).toBe(true);
    expect((button("Restart") as HTMLButtonElement).disabled).toBe(false);
    expect(button("Play")).toBeTruthy();
  });

  it("a press that never got through says so, in the same words a seat uses", async () => {
    expect(STORY_NOT_THROUGH).toBe(NOT_THROUGH);
    const server = fakeServer();
    const flaky = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/action") throw new Error("socket hang up");
      return server.fn(url, init);
    });
    render(
      <StoryPlayer aiMode="replay" openings={OPENINGS} fetcher={flaky as never} {...FAST} holdMs={() => 15} autoplay={false} />
    );
    fireEvent.click(button("Next"));
    await waitFor(() => expect(screen.getByTestId("story-stage").getAttribute("data-phase")).toBe("failed"));
    expect(screen.getAllByText(NOT_THROUGH).length).toBeGreaterThan(0);
  });

  it("?step=3 resets, replays the real presses up to step 3 and waits there", async () => {
    const server = fakeServer();
    player(server, { startStep: 3 });
    await waitFor(() => expect(screen.getByTestId("story-stage").getAttribute("data-phase")).toBe("shown"));
    expect(stepLine()).toBe("Step 3 of 8");
    const upTo3 = STORY.slice(0, 3).reduce((sum, s) => sum + s.presses.length, 0);
    expect(server.posts()).toEqual(STORY_PRESSES.slice(0, upTo3));
    await new Promise((r) => setTimeout(r, 100));
    expect(server.posts()).toHaveLength(upTo3);
    expect(button("Play")).toBeTruthy();
    expect(screen.getByTestId("story-stage").getAttribute("data-seat")).toBe("technician");
  });

  it("space plays and pauses, the arrow keys go next and back", async () => {
    const server = fakeServer();
    player(server, { autoplay: false });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    await waitFor(() => expect(screen.getByTestId("story-stage").getAttribute("data-phase")).toBe("shown"));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    await waitFor(() => expect(stepLine()).toBe("Step 2 of 8"));
    await waitFor(() => expect(screen.getByTestId("story-stage").getAttribute("data-phase")).toBe("shown"));
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    await waitFor(() => expect(stepLine()).toBe("Step 1 of 8"));
    await waitFor(() => expect(screen.getByTestId("story-stage").getAttribute("data-phase")).toBe("shown"));
    fireEvent.keyDown(window, { key: " " });
    expect(button("Pause")).toBeTruthy();
    fireEvent.keyDown(window, { key: " " });
    expect(button("Play")).toBeTruthy();
  });

  it("marks what changed in the step with an outline", async () => {
    const server = fakeServer();
    player(server, { autoplay: false });
    fireEvent.click(button("Next"));
    await waitFor(() => expect(screen.getByTestId("story-stage").getAttribute("data-phase")).toBe("shown"));
    const marked = screen.getByTestId("story-stage").querySelectorAll(".story-focus");
    expect(marked).toHaveLength(1);
    // Step 1: Pip's last message, the one the self-check ended on.
    const msgs = screen.getByTestId("story-stage").querySelectorAll(".msg");
    expect(marked[0]).toBe(msgs[msgs.length - 1]);
  });

  it("says it is the real app, on Saved answers, with one shared memory", () => {
    const server = fakeServer();
    player(server, { autoplay: false });
    expect(screen.getByText(/real app playing itself, not a video/)).toBeTruthy();
    expect(screen.getByText(/real Hunyuan answers saved earlier/)).toBeTruthy();
  });

  it("moves the AI switch to Saved answers once if it is elsewhere, and never loops", () => {
    const server = fakeServer();
    const switchAi = vi.fn();
    player(server, { aiMode: "live", switchAi });
    expect(switchAi).toHaveBeenCalledTimes(1);
    expect(server.posts()).toEqual([]);
    cleanup();
    const again = vi.fn();
    player(fakeServer(), { aiMode: "off", aiSwitchTried: true, switchAi: again, autoplay: false });
    expect(again).not.toHaveBeenCalled();
    expect(screen.getByText(/could not move the AI switch/i)).toBeTruthy();
  });
});

describe("D2: SeatChat driven from outside", () => {
  const state = (text: string) => ({
    seat: "tenant",
    label: "Tenant (role-played)",
    pipNever: "x",
    chips: ["Why?"],
    messages: [{ from: "pip", text, cards: [{ kind: "answer", title: text, receipt: "r" }] }],
    notices: [],
  });

  it("shows the view it is handed, reads nothing itself, locks every control and shows Pip is checking", () => {
    const fetcher = vi.fn(async () => {
      throw new Error("SeatChat fetched by itself");
    });
    const { rerender, container } = render(
      <SeatChat seat="tenant" view={state("First view") as never} locked pending fetcher={fetcher} pollMs={0} />
    );
    expect(screen.getByText("First view")).toBeTruthy();
    expect(screen.getByText("Pip is checking")).toBeTruthy();
    expect((container.querySelector("fieldset.chat-lock") as HTMLFieldSetElement).disabled).toBe(true);
    rerender(<SeatChat seat="tenant" view={state("Second view") as never} locked pending={false} fetcher={fetcher} pollMs={0} />);
    expect(screen.getByText("Second view")).toBeTruthy();
    expect(screen.queryByText("Pip is checking")).toBeNull();
    expect((container.querySelector("fieldset.chat-lock") as HTMLFieldSetElement).disabled).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
