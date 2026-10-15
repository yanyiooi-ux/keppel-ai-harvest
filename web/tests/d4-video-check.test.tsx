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
 * the answer is not ok or the request fails. A file missing on disk still
 * shows the line at once with no request.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, cleanup, fireEvent } from "@testing-library/react";

import { VideoPlayer } from "../app/components/VideoPlayer";
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

  it("a source error and the HEAD request throws: the player stays while asking, then the plain line", async () => {
    const held = heldFetch();
    vi.stubGlobal("fetch", held.fn);
    const { container } = render(<VideoPlayer available />);
    fireEvent.error(container.querySelector("video source")!);
    await settle();
    expectHead(held.fn);
    expectPlayer(container);
    held.fail(new TypeError("Failed to fetch"));
    await settle();
    expectLine(container);
  });

  it("a fetch that throws before it returns a promise also shows the plain line", async () => {
    const fetchFn = vi.fn(() => {
      throw new TypeError("fetch is broken");
    });
    vi.stubGlobal("fetch", fetchFn);
    const { container } = render(<VideoPlayer available />);
    fireEvent.error(container.querySelector("video source")!);
    await settle();
    expectHead(fetchFn);
    expectLine(container);
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
