"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { SeatChat, MIN_PENDING_MS } from "../chat/SeatChat";
import { Plain } from "../Plain";
import { AI_MODE_WORDS, seatWord } from "../../../lib/plain-words";
import { saveAiMode, type AiMode } from "../../../lib/ai-mode";
import {
  STORY,
  STORY_AI_LINE,
  STORY_CLOSE,
  STORY_FOCUS_LINE,
  STORY_JOB,
  STORY_NOT_THROUGH,
  STORY_PRESS_PACE_MS,
  STORY_REAL_LINE,
  STORY_SHARED_LINE,
  runPress,
  runStep,
  storyFocusIn,
  storyHoldMs,
  type PressResult,
  type StoryMemo,
  type StoryPort,
  type StoryStep,
} from "../../../lib/story";
import type { SeatCard, SeatView } from "../../../lib/seat-view";

/**
 * Story mode at /demo (D2): the real app plays the demo by itself, one seat at
 * a time, with a short plain caption for each of the 8 steps.
 *
 * Every press goes through the routes every seat uses: POST /api/reset,
 * /api/action and /api/chat, then GET /api/state for the seat on screen.
 * Nothing is pre-rendered or recorded. The seat on screen is the real
 * SeatChat with the real desks, handed the view the player just read: its
 * controls are off (only the story presses), and "Pip is checking" shows
 * while each real press is on its way, for at least 400 ms. A glowing
 * outline marks what changed in the step, and the page scrolls to it.
 *
 * Controls: Back, Play or Pause, Next, Restart, "Step n of 8" with a progress
 * bar, and the keys (space, the arrows). Autoplay holds each step for its
 * time once its presses are done. Back is Reset, then a quick replay of the
 * real presses up to the step before. A press the app refuses, or one that
 * never got through, stops the story with the plain reason: nothing is ever
 * faked. Back, Next and Restart are off while a press is on its way.
 *
 * Tests pass their own fetch, waits and hold; nothing here reaches the
 * network on its own.
 */

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

type Phase = "idle" | "running" | "rewinding" | "shown" | "failed" | "done";
export type Mark = "todo" | "doing" | "done" | "failed";

/** A press's state in the list, always in words (a status colour carries its word, S21). */
const MARK_WORDS: Record<Mark, { word: string; colour: string }> = {
  todo: { word: "To do", colour: "none" },
  doing: { word: "Now", colour: "amber" },
  done: { word: "Done", colour: "green" },
  failed: { word: "Not done", colour: "red" },
};

const LAST = STORY.length - 1;

export interface StoryPlayerProps {
  /** Where the AI switch stands: Story mode runs on Saved answers (Replay). */
  aiMode: AiMode;
  /** Each seat's opening line (C5b), read on the server. */
  openings: Record<string, { text: string; never: string }>;
  /** "?step=n": replay the real presses quickly up to step n, then wait there. */
  startStep?: number;
  /** The page already tried moving the AI switch once ("?ai=switched"), so it never loops. */
  aiSwitchTried?: boolean;
  /** Tests pass their own. Nothing else is ever called. */
  fetcher?: Fetcher;
  /** Start playing on load. The live page does. */
  autoplay?: boolean;
  /** The gap after each press's result lands. */
  paceMs?: number;
  /** The shortest time "Pip is checking" shows for one press. */
  minPendingMs?: number;
  /** How long a step holds once its presses are done. */
  holdMs?: (caption: string) => number;
  /** Moves the AI switch to Saved answers. The live page sets the cookie and reloads. */
  switchAi?: () => void;
}

const browserFetch: Fetcher = (input, init) => fetch(input, init);

function wait(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

/** The routes, over HTTP: the same calls a seat's buttons make. */
export function httpStoryPort(call: Fetcher): StoryPort {
  const post = async (url: string, body?: unknown): Promise<Record<string, unknown>> => {
    const init: RequestInit =
      body === undefined
        ? { method: "POST" }
        : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
    const response = await call(url, init);
    return (await response.json()) as Record<string, unknown>;
  };
  const said = (data: Record<string, unknown>): PressResult => ({
    ok: data.ok !== false,
    message: typeof data.message === "string" ? data.message : "",
    jobId: typeof data.jobId === "string" ? data.jobId : undefined,
  });
  return {
    async reset() {
      return said(await post("/api/reset"));
    },
    async action({ seat, action, job, payload }) {
      const body: Record<string, unknown> = { seat, action };
      if (job) body.job = job;
      if (payload) body.payload = payload;
      return said(await post("/api/action", body));
    },
    async chat({ seat, text, job }) {
      const data = await post("/api/chat", { seat, text, job });
      if (data.ok === false) return said(data);
      return { ok: true, message: "", cards: (data.cards ?? []) as SeatCard[] };
    },
    async view(seat) {
      const response = await call(`/api/state?seat=${encodeURIComponent(seat)}`);
      const data = (await response.json()) as SeatView & { ok?: boolean; message?: string };
      if (data.ok === false) throw new Error(data.message ?? "no view");
      return data;
    },
  };
}

/** Sets the AI switch's cookie to Saved answers and reloads once, marked so it never loops. */
function moveAiSwitch(): void {
  saveAiMode("replay");
  const url = new URL(window.location.href);
  url.searchParams.set("ai", "switched");
  window.location.replace(url.toString());
}

/** Scrolls what changed into view: smoothly while the story plays, at once after a jump (Back, "?step="). */
function bringToFocus(el: Element, jump: boolean): void {
  const still = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView?.({ block: "start", behavior: still || jump ? "auto" : "smooth" });
}

/**
 * What the panel says while a step runs: the press on its way; between two
 * presses, the one that just landed; before the first, that the seat's chat
 * is opening.
 */
export function runningLine(step: StoryStep, marks: Mark[]): string {
  const doing = marks.indexOf("doing");
  if (doing >= 0) return `Pressing: ${step.presses[doing].label}`;
  const done = marks.lastIndexOf("done");
  if (done >= 0) return `Done: ${step.presses[done].label}`;
  return `Opening the chat: ${seatWord(step.seat)}`;
}

function Dots() {
  return (
    <span className="typing-dots" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

export function StoryPlayer({
  aiMode,
  openings,
  startStep,
  aiSwitchTried = false,
  fetcher,
  autoplay = true,
  paceMs = STORY_PRESS_PACE_MS,
  minPendingMs = MIN_PENDING_MS,
  holdMs = storyHoldMs,
  switchAi,
}: StoryPlayerProps) {
  const first = startStep ? startStep - 1 : 0;
  const call = fetcher ?? browserFetch;
  const port = useMemo(() => httpStoryPort(call), [call]);
  // The switch is elsewhere and the page has not tried moving it yet: it moves it, then reloads.
  const moving = aiMode !== "replay" && !aiSwitchTried;
  const [index, setIndex] = useState(first);
  const [phase, setPhase] = useState<Phase>("idle");
  // Autoplay starts on load, unless the page jumps to a step or must move the AI switch first.
  const [playing, setPlaying] = useState(() => autoplay && !moving && !startStep);
  const [view, setView] = useState<{ seat: string; data: SeatView } | null>(null);
  const [pending, setPending] = useState(false);
  const [marks, setMarks] = useState<Mark[]>(() => STORY[first].presses.map(() => "todo"));
  const [failure, setFailure] = useState<string | null>(null);
  // The app's own reply to the step's last press, word for word: proof the step really ran.
  const [said, setSaid] = useState<string | null>(null);
  const [sheet, setSheet] = useState(0);
  // What the running story needs between renders: one run at a time, the seat
  // on screen, what earlier presses said, and when the step finished.
  const live = useRef({ busy: false, seat: null as string | null, memo: {} as StoryMemo, shownAt: 0, jumped: false });
  const hold = useRef(holdMs);
  useEffect(() => {
    hold.current = holdMs;
  }, [holdMs]);
  const stage = useRef<HTMLElement>(null);
  const panel = useRef<HTMLElement>(null);
  const started = useRef(false);

  const fail = useCallback((at: number, message: string) => {
    setIndex(at);
    setFailure(message);
    setPending(false);
    setPlaying(false);
    setPhase("failed");
  }, []);

  const read = useCallback(
    async (seat: string) => {
      const data = await port.view(seat);
      live.current.seat = seat;
      setView({ seat, data });
    },
    [port]
  );

  /** One step at normal speed: each real press, "Pip is checking" while it runs, then the new view. */
  const playStep = useCallback(
    async (i: number) => {
      if (live.current.busy) return;
      live.current.busy = true;
      const step = STORY[i];
      setIndex(i);
      setFailure(null);
      setSaid(null);
      setPhase("running");
      setMarks(step.presses.map(() => "todo"));
      if (i === 0) live.current.memo = {};
      try {
        if (live.current.seat !== step.seat) {
          try {
            await read(step.seat);
          } catch {
            fail(i, STORY_NOT_THROUGH);
            return;
          }
        }
        for (let j = 0; j < step.presses.length; j++) {
          setMarks((old) => old.map((m, k) => (k === j ? "doing" : m)));
          setPending(true);
          const pressedAt = Date.now();
          const result = await runPress(step.presses[j], port, live.current.memo);
          let data: SeatView | null = null;
          if (result.ok) {
            try {
              data = await port.view(step.seat);
            } catch {
              data = null;
            }
          }
          if (!result.ok || !data) {
            // A refusal or a failure frees everything at once, with its reason (D1).
            setMarks((old) => old.map((m, k) => (k === j ? "failed" : m)));
            fail(i, result.ok ? STORY_NOT_THROUGH : result.message);
            return;
          }
          await wait(minPendingMs - (Date.now() - pressedAt));
          live.current.seat = step.seat;
          setView({ seat: step.seat, data });
          setPending(false);
          setMarks((old) => old.map((m, k) => (k === j ? "done" : m)));
          if (result.message) setSaid(result.message);
          await wait(paceMs);
        }
        live.current.shownAt = Date.now();
        setPhase("shown");
      } finally {
        live.current.busy = false;
      }
    },
    [fail, read, port, minPendingMs, paceMs]
  );

  /** Back and "?step=": Reset, then every real press up to step t quickly, then show step t. */
  const rewindTo = useCallback(
    async (t: number) => {
      if (live.current.busy) return;
      live.current.busy = true;
      setIndex(t);
      setFailure(null);
      setSaid(null);
      setPhase("rewinding");
      setPending(true);
      setMarks(STORY[t].presses.map(() => "todo"));
      const memo: StoryMemo = {};
      live.current.memo = memo;
      try {
        let lastSaid = "";
        for (let i = 0; i <= t; i++) {
          const run = await runStep(STORY[i], port, memo);
          if (!run.ok) {
            const at = run.failedAt ?? 0;
            setMarks(STORY[i].presses.map((_, k) => (k < at ? "done" : k === at ? "failed" : "todo")));
            fail(i, run.message);
            return;
          }
          lastSaid = run.message;
        }
        if (lastSaid) setSaid(lastSaid);
        try {
          await read(STORY[t].seat);
        } catch {
          fail(t, STORY_NOT_THROUGH);
          return;
        }
        setMarks(STORY[t].presses.map(() => "done"));
        setPending(false);
        live.current.shownAt = Date.now();
        // A jump lands at once on what changed, rather than scrolling past every step on the way.
        live.current.jumped = true;
        setPhase("shown");
      } finally {
        live.current.busy = false;
      }
    },
    [fail, read, port]
  );

  const busy = phase === "running" || phase === "rewinding";

  const start = useCallback(() => {
    if (live.current.busy) return;
    setPlaying(true);
    void playStep(0);
  }, [playStep]);

  const next = useCallback(() => {
    if (live.current.busy) return;
    if (phase === "idle") void playStep(0);
    else if (phase === "shown" && index < LAST) void playStep(index + 1);
  }, [phase, index, playStep]);

  const back = useCallback(() => {
    if (live.current.busy || phase === "idle" || index <= 0) return;
    void rewindTo(index - 1);
  }, [phase, index, rewindTo]);

  const togglePlay = useCallback(() => {
    if (phase === "idle" || phase === "done" || phase === "failed") start();
    else setPlaying((on) => !on);
  }, [phase, start]);

  // Autoplay: once a step is done and on screen, hold it, then the next step (or the end).
  useEffect(() => {
    if (phase !== "shown" || !playing) return;
    const left = Math.max(0, hold.current(STORY[index].caption) - (Date.now() - live.current.shownAt));
    const timer = setTimeout(() => {
      if (index < LAST) void playStep(index + 1);
      else {
        setPlaying(false);
        setPhase("done");
      }
    }, left);
    return () => clearTimeout(timer);
  }, [phase, playing, index, playStep]);

  // On load: move the AI switch if it must, else jump to "?step=", else play (or show step 1's seat).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (moving) {
      (switchAi ?? moveAiSwitch)();
      return;
    }
    if (startStep) {
      void rewindTo(startStep - 1);
      return;
    }
    // Autoplay: `playing` already starts on (see its useState).
    if (autoplay) {
      void playStep(0);
      return;
    }
    // The view is set once the read comes back, never during this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void read(STORY[0].seat).catch(() => {});
    // Runs once, on load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The keys: space plays or pauses, the arrows go back and next. Typing in a box is left alone.
  const keys = useRef({ togglePlay, next, back });
  useEffect(() => {
    keys.current = { togglePlay, next, back };
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      if (event.key === " " || event.key === "Spacebar") {
        // A focused button or link acts on space by itself.
        if (tag === "BUTTON" || tag === "A" || tag === "SUMMARY") return;
        event.preventDefault();
        keys.current.togglePlay();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        keys.current.next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        keys.current.back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // What changed in this step: outlined, and brought into view.
  useEffect(() => {
    const root = stage.current;
    if (!root) return;
    root.querySelectorAll(".story-focus").forEach((el) => el.classList.remove("story-focus"));
    if (!view || (phase !== "running" && phase !== "shown" && phase !== "done")) return;
    const step = STORY[index];
    if (view.seat !== step.seat) return;
    const marked = storyFocusIn(root, step.focus);
    for (const el of marked) el.classList.add("story-focus");
    if (marked[0]) bringToFocus(marked[0], live.current.jumped);
    live.current.jumped = false;
  }, [view, phase, index]);

  // On a phone the panel is fixed at the bottom: the page leaves room for it.
  useEffect(() => {
    const el = panel.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setSheet(Math.ceil(el.getBoundingClientRect().height)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const step = STORY[index];
  const shownSeat = view?.seat ?? step.seat;
  const n = phase === "done" ? STORY.length : index + 1;

  let now: React.ReactNode;
  if (phase === "running") {
    now = (
      <>
        <Dots />
        <span>{runningLine(step, marks)}</span>
      </>
    );
  } else if (phase === "rewinding") {
    now = (
      <>
        <Dots />
        <span>{`Going back: Reset, then the real presses again, quickly, up to step ${index + 1}.`}</span>
      </>
    );
  } else if (phase === "failed") {
    now = (
      <span className="story-failed">
        <span className="badge red">Not done</span>{" "}
        <span className="story-reason">
          <Plain text={failure} />
        </span>
        <span className="story-failed-what">The story stopped here, and nothing was faked. Press Restart to try again.</span>
      </span>
    );
  } else if (phase === "done") {
    now = <span>The story is over. Press Restart to watch it again.</span>;
  } else if (phase === "shown") {
    now = playing ? (
      <span>Done. The next step starts in a moment.</span>
    ) : (
      <span>{index < LAST ? "Paused. Press Play, or Next for the next step." : "Paused. Press Play to finish."}</span>
    );
  } else {
    now = <span>{moving ? "Moving the AI switch to Saved answers first." : "Press Play to start. It runs by itself."}</span>;
  }

  const aiLine =
    aiMode === "replay"
      ? STORY_AI_LINE
      : aiSwitchTried
        ? `Story mode could not move the AI switch to Saved answers, so the AI lines follow the switch: ${AI_MODE_WORDS[aiMode]}.`
        : "Story mode moves the AI switch to Saved answers, so the saved real AI answers show.";

  return (
    <div className="story-player" style={{ ["--story-sheet" as string]: `${sheet}px` }}>
      <div className="story-notes">
        <p className="story-real">{STORY_REAL_LINE}</p>
        <p>{aiLine}</p>
        <p>{STORY_SHARED_LINE}</p>
      </div>

      <div className="story-grid">
        <aside className="story-panel" ref={panel} aria-label="Story">
          <div className="story-top">
            <p className="story-count" data-testid="story-count">{`Step ${n} of ${STORY.length}`}</p>
            <span className="story-seat">{seatWord(step.seat)}</span>
          </div>
          <div
            className="story-progress"
            role="progressbar"
            aria-label="Story progress"
            aria-valuemin={1}
            aria-valuemax={STORY.length}
            aria-valuenow={n}
          >
            <span style={{ width: `${(n / STORY.length) * 100}%` }} />
          </div>

          {phase === "done" ? (
            <div className="story-end">
              <h2 className="story-title">The end</h2>
              <p className="story-close">{STORY_CLOSE}</p>
              <p className="story-links">
                <Link href="/">Try a seat yourself</Link>
                <Link href="/how">How it works, for judges</Link>
              </p>
            </div>
          ) : (
            <div className="story-words" aria-live="polite">
              <h2 className="story-title">{step.title}</h2>
              <p className="story-caption">{step.caption}</p>
            </div>
          )}

          <p className="story-now" data-testid="story-now" role="status">
            {now}
          </p>

          {said && (phase === "shown" || phase === "running") ? (
            <p className="story-said" data-testid="story-said">
              <span className="story-said-k">The app said</span>
              <span>
                <Plain text={said} />
              </span>
            </p>
          ) : null}

          {phase !== "done" ? (
            <ol className="story-presses" aria-label="What this step presses">
              {step.presses.map((press, j) => {
                const mark = MARK_WORDS[marks[j] ?? "todo"];
                return (
                  <li key={j} className={`is-${marks[j] ?? "todo"}`}>
                    <span className={`badge ${mark.colour}`}>{mark.word}</span>
                    <span>{press.label}</span>
                  </li>
                );
              })}
            </ol>
          ) : null}

          <div className="story-controls" role="group" aria-label="Story controls">
            <button type="button" onClick={back} disabled={busy || phase === "idle" || index <= 0}>
              Back
            </button>
            <button type="button" className="story-play" onClick={togglePlay} disabled={moving}>
              {playing ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              onClick={next}
              disabled={busy || moving || !(phase === "idle" || (phase === "shown" && index < LAST))}
            >
              Next
            </button>
            <button type="button" onClick={start} disabled={busy || moving}>
              Restart
            </button>
          </div>
          <p className="story-keys">{`Keys: space plays or pauses, the arrows go back and next. ${STORY_FOCUS_LINE}`}</p>
        </aside>

        <section
          className="story-stage"
          ref={stage}
          data-testid="story-stage"
          data-seat={view?.seat}
          data-phase={phase}
          aria-label={`On screen: ${seatWord(shownSeat)}`}
        >
          <div className="story-stage-head">
            <span className="story-stage-who">
              On screen: <b>{seatWord(shownSeat)}</b>, the real chat
            </span>
            <a href={`/seat/${shownSeat}`}>Open this seat yourself</a>
          </div>
          {view ? (
            <SeatChat
              key={view.seat}
              seat={view.seat}
              view={view.data}
              initial={view.data}
              opening={openings[view.seat]}
              jobId={view.seat === "aom-tower-a" ? undefined : STORY_JOB}
              fetcher={call}
              pollMs={0}
              locked
              pending={pending}
              aiMode={aiMode}
            />
          ) : (
            <p className="desk-status story-wait">Getting the chat ready.</p>
          )}
        </section>
      </div>
    </div>
  );
}
