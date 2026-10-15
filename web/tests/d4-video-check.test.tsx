// @vitest-environment jsdom

/**
 * D4 fix: the video player says the video is missing only when the server says so.
 *
 * YY saw "The video is not on this copy of the demo." while the server served
 * the mp4 with 206. The browser's own signals are hints, not proof:
 * networkState is NETWORK_NO_SOURCE (3) for a moment at the start of resource
 * selection, and a <source> error can fire for reasons other than a missing
 * file. On either hint the player asks the server with a HEAD request (no
 * cache), keeps the player while it waits, and shows the plain line only when
 * the answer is not ok. A file missing on disk still shows the line at once
 * with no request.
 *
 * Review of that fix: a request with no answer is not proof. Stop, Esc or a
 * page change cancels the HEAD with the same error as a network failure, and a
 * full-page navigation does not unmount React, so the line showed on / while
 * the file was served (live, port 4970, Stop during the HEAD). Now the player
 * stays and asks once more after VIDEO_RETRY_MS. A file lost after it loaded
 * reports its error on the <video>, not on <source> (live: error code 2, no
 * source error, a dead player); that error is now a hint too.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, cleanup, fireEvent } from "@testing-library/react";

import { VideoPlayer, VIDEO_RETRY_MS } from "../app/components/VideoPlayer";
import { VIDEO_MISSING, VIDEO_SRC } from "../lib/video-words";

type Answer = { ok: boolean; status: number };

/** A fetch whose answer the test hands over by hand, so "while asking" can be seen. */
function heldFetch() {
  let answer!: (a: Answer) => void;
  let fail!: (e: unknown) => void;
  const pending = new Promise<Answer>((res, rej) => {
    answer = res;
    fail = rej;
  });
  const fn = vi.fn(() => pending);
  return { fn, answer, fail };
}

function answering(a: Answer) {
  return vi.fn(() => Promise.resolve(a));
}

/** Lets every pending promise and React update settle. */
async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

/** With fake timers on: moves the clock and lets promises and React updates settle. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** A fetch that answers each call with the next item: an Answer, or an Error to reject with. */
function fetchInTurn(...turns: Array<Answer | Error>) {
  let call = 0;
  return vi.fn(() => {
    const turn = turns[Math.min(call, turns.length - 1)];
    call += 1;
    return turn instanceof Error ? Promise.reject(turn) : Promise.resolve(turn);
  });
}

function expectHead(fn: ReturnType<typeof vi.fn>) {
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith(VIDEO_SRC, { method: "HEAD", cache: "no-store" });
}

function expectPlayer(container: HTMLElement) {
  expect(container.querySelector("video")).not.toBeNull();
  expect(container.querySelector("video source")!.getAttribute("src")).toBe("/media/pill-desk-video.mp4");
  expect(screen.queryByTestId("video-missing")).toBeNull();
}

function expectLine(container: HTMLElement) {
  expect(container.querySelector("video")).toBeNull();
  expect(screen.getByTestId("video-missing").textContent).toBe(VIDEO_MISSING);
}

/** Makes every video report networkState 3 (NETWORK_NO_SOURCE), as a browser can at mount. */
function noSourceAtMount() {
  const proto = HTMLMediaElement.prototype;
  const own = Object.getOwnPropertyDescriptor(proto, "networkState");
  Object.defineProperty(proto, "networkState", { configurable: true, get: () => 3 });
  return () => {
    if (own) Object.defineProperty(proto, "networkState", own);
  };
}

let restore: (() => void) | null = null;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network blocked in tests"))));
});

afterEach(() => {
  cleanup();
  restore?.();
  restore = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("D4 fix: the plain line shows only when the server says the video is missing", () => {
  it("networkState 3 at mount and the server answers HEAD 200: the player stays", async () => {
    restore = noSourceAtMount();
    const fetchFn = answering({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchFn);
    const { container } = render(<VideoPlayer available />);
    expectPlayer(container);
    await settle();
    expectHead(fetchFn);
    expectPlayer(container);
  });

  it("a source error and the server answers HEAD 200: the player stays", async () => {
    const fetchFn = answering({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchFn);
    const { container } = render(<VideoPlayer available />);
    fireEvent.error(container.querySelector("video source")!);
    expectPlayer(container);
    await settle();
    expectHead(fetchFn);
    expectPlayer(container);
  });

  it("a source error and the server answers HEAD 404: the player stays while asking, then the plain line", async () => {
    const held = heldFetch();
    vi.stubGlobal("fetch", held.fn);
    const { container } = render(<VideoPlayer available />);
    fireEvent.error(container.querySelector("video source")!);
    await settle();
    expectHead(held.fn);
    expectPlayer(container);
    held.answer({ ok: false, status: 404 });
    await settle();
    expectLine(container);
  });

  it("networkState 3 at mount and the server answers HEAD 404: the plain line", async () => {
    restore = noSourceAtMount();
    const held = heldFetch();
    vi.stubGlobal("fetch", held.fn);
    const { container } = render(<VideoPlayer available />);
    expectPlayer(container);
    await settle();
    expectHead(held.fn);
    expectPlayer(container);
    held.answer({ ok: false, status: 404 });
    await settle();
    expectLine(container);
  });

  it("a source error and the HEAD request gets no answer: the player stays, asks once more after VIDEO_RETRY_MS, and stays on 200", async () => {
    vi.useFakeTimers();
    const held = heldFetch();
    const fetchFn = vi
      .fn<() => Promise<Answer>>()
      .mockImplementationOnce(held.fn)
      .mockImplementation(() => Promise.resolve({ ok: true, status: 200 }));
    vi.stubGlobal("fetch", fetchFn);
    const { container } = render(<VideoPlayer available />);
    fireEvent.error(container.querySelector("video source")!);
    await advance(0);
    expectHead(fetchFn);
    expectPlayer(container);
    held.fail(new TypeError("Failed to fetch"));
    await advance(0);
    expectPlayer(container);
    await advance(VIDEO_RETRY_MS - 1);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn).toHaveBeenLastCalledWith(VIDEO_SRC, { method: "HEAD", cache: "no-store" });
    expectPlayer(container);
    await advance(10 * VIDEO_RETRY_MS);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expectPlayer(container);
  });

  it("a fetch that throws before it returns a promise keeps the player: asked twice, then no more", async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn(() => {
      throw new TypeError("fetch is broken");
    });
    vi.stubGlobal("fetch", fetchFn);
    const { container } = render(<VideoPlayer available />);
    fireEvent.error(container.querySelector("video source")!);
    await advance(0);
    expectHead(fetchFn);
    expectPlayer(container);
    await advance(VIDEO_RETRY_MS);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expectPlayer(container);
    await advance(10 * VIDEO_RETRY_MS);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expectPlayer(container);
  });

  it("networkState 3 at mount and the HEAD is cancelled (Stop) while the file is served: the player stays", async () => {
    vi.useFakeTimers();
    restore = noSourceAtMount();
    const fetchFn = fetchInTurn(new TypeError("Failed to fetch"), { ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchFn);
    const { container } = render(<VideoPlayer available />);
    await advance(0);
    expectHead(fetchFn);
    expectPlayer(container);
    await advance(VIDEO_RETRY_MS);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expectPlayer(container);
  });

  it("the first HEAD gets no answer and the second answers 404: the plain line", async () => {
    vi.useFakeTimers();
    const fetchFn = fetchInTurn(new TypeError("Failed to fetch"), { ok: false, status: 404 });
    vi.stubGlobal("fetch", fetchFn);
    const { container } = render(<VideoPlayer available />);
    fireEvent.error(container.querySelector("video source")!);
    await advance(0);
    expectHead(fetchFn);
    expectPlayer(container);
    await advance(VIDEO_RETRY_MS);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expectLine(container);
  });

  it("unmounted while waiting to ask again: no second request", async () => {
    vi.useFakeTimers();
    const fetchFn = fetchInTurn(new TypeError("Failed to fetch"), { ok: false, status: 404 });
    vi.stubGlobal("fetch", fetchFn);
    const { container, unmount } = render(<VideoPlayer available />);
    fireEvent.error(container.querySelector("video source")!);
    await advance(0);
    expectHead(fetchFn);
    unmount();
    await advance(10 * VIDEO_RETRY_MS);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("after both requests get no answer, a new hint asks the server again", async () => {
    vi.useFakeTimers();
    const fetchFn = fetchInTurn(new TypeError("Failed to fetch"), new TypeError("Failed to fetch"), { ok: false, status: 404 });
    vi.stubGlobal("fetch", fetchFn);
    const { container } = render(<VideoPlayer available />);
    fireEvent.error(container.querySelector("video source")!);
    await advance(0);
    await advance(VIDEO_RETRY_MS);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expectPlayer(container);
    fireEvent.error(container.querySelector("video")!);
    await advance(0);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expectLine(container);
  });

  it("an error on the <video> itself (a file lost after it loaded) and the server answers HEAD 500: the plain line", async () => {
    const held = heldFetch();
    vi.stubGlobal("fetch", held.fn);
    const { container } = render(<VideoPlayer available />);
    fireEvent.error(container.querySelector("video")!);
    await settle();
    expectHead(held.fn);
    expectPlayer(container);
    held.answer({ ok: false, status: 500 });
    await settle();
    expectLine(container);
  });

  it("an error on the <video> itself and the server answers HEAD 200: the player stays", async () => {
    const fetchFn = answering({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchFn);
    const { container } = render(<VideoPlayer available />);
    fireEvent.error(container.querySelector("video")!);
    await settle();
    expectHead(fetchFn);
    expectPlayer(container);
  });

  it("a source error and a video error while one request is out ask the server once", async () => {
    const held = heldFetch();
    vi.stubGlobal("fetch", held.fn);
    const { container } = render(<VideoPlayer available />);
    fireEvent.error(container.querySelector("video source")!);
    fireEvent.error(container.querySelector("video")!);
    await settle();
    expectHead(held.fn);
    held.answer({ ok: true, status: 200 });
    await settle();
    expectPlayer(container);
  });

  it("two hints while one request is out ask the server once", async () => {
    restore = noSourceAtMount();
    const held = heldFetch();
    vi.stubGlobal("fetch", held.fn);
    const { container } = render(<VideoPlayer available />);
    fireEvent.error(container.querySelector("video source")!);
    await settle();
    expectHead(held.fn);
    held.answer({ ok: true, status: 200 });
    await settle();
    expectPlayer(container);
  });

  it("the file missing on disk: the plain line at once, no player and no request", async () => {
    const fetchFn = answering({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchFn);
    const { container } = render(<VideoPlayer available={false} />);
    expectLine(container);
    await settle();
    expect(fetchFn).not.toHaveBeenCalled();
    expectLine(container);
  });

  it("no hint: no request and the player stays", async () => {
    const fetchFn = answering({ ok: false, status: 404 });
    vi.stubGlobal("fetch", fetchFn);
    const { container } = render(<VideoPlayer available />);
    await settle();
    expect(fetchFn).not.toHaveBeenCalled();
    expectPlayer(container);
  });
});
