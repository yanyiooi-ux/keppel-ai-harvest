// @vitest-environment jsdom

/**
 * Review findings for C7a on screen, fake fetch only: a typed red card shows its
 * "Call:" line and a Raise this stop button (S11, S19), and a double tap on a
 * button sends one press.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { SeatChat } from "../app/components/chat/SeatChat";

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

function seatState(messages: unknown[] = [], seat = "tenant") {
  return {
    seat,
    label: "Tenant, Northwind Advisory (role-played)",
    chips: ["What needs me", "Show job", "Why?", "Safety"],
    messages,
    notices: [],
  };
}

function fakeFetch(answer: (url: string, body: Body | null) => unknown | Promise<unknown>) {
  const calls: { url: string; body: Body | null }[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? (JSON.parse(String(init.body)) as Body) : null;
    calls.push({ url, body });
    const data = await answer(url, body);
    return { json: async () => data } as Response;
  });
  return { fn, calls };
}

const typedRed = (stopId: string, call: string, jobId?: string) => ({
  kind: "red-stop",
  stopId,
  title: `${stopId} trigger.`,
  body: `${stopId} action.`,
  call,
  receipt: `Red stop ${stopId} · pill v1.0 · AI calls: 0`,
  raiseStopId: stopId,
  ...(jobId ? { jobId } : {}),
});

describe("C7a review: a typed red card on screen", () => {
  it("shows its Call line and a Raise this stop button that presses safety-pick on the card's job", async () => {
    const card = typedRed("RS-04", "FM control room", "2318");
    const { fn, calls } = fakeFetch((url) =>
      url.startsWith("/api/action")
        ? { ok: true, message: "Red stop RS-04 raised." }
        : seatState([
            { from: "person", text: "water dripping from the ceiling" },
            { from: "pip", text: card.body, cards: [card] },
          ])
    );
    render(<SeatChat seat="tenant" fetcher={fn} pollMs={0} jobId="2319" />);

    expect(await screen.findByText("Call: FM control room")).toBeDefined();
    const raise = screen.getByRole("button", { name: /^Raise this stop/ });
    expect(raise.textContent).toBe("Raise this stop");
    fireEvent.click(raise);

    await waitFor(() => expect(calls.some((c) => c.url === "/api/action")).toBe(true));
    expect(calls.find((c) => c.url === "/api/action")!.body).toEqual({
      seat: "tenant",
      action: "safety-pick",
      job: "2318",
      payload: { stopId: "RS-04" },
    });
  });

  it("a typed card with no job of its own raises on the seat's job", async () => {
    const card = typedRed("RS-09", "Senior manager");
    const { fn, calls } = fakeFetch((url) =>
      url.startsWith("/api/action") ? { ok: true, message: "ok" } : seatState([{ from: "pip", text: card.body, cards: [card] }])
    );
    render(<SeatChat seat="tenant" fetcher={fn} pollMs={0} jobId="2318" />);
    fireEvent.click(await screen.findByRole("button", { name: /^Raise this stop/ }));
    await waitFor(() => expect(calls.some((c) => c.url === "/api/action")).toBe(true));
    expect(calls.find((c) => c.url === "/api/action")!.body).toMatchObject({ job: "2318", payload: { stopId: "RS-09" } });
  });

  it("several stops matched: each card has its own button, for its own stop", async () => {
    const cards = [typedRed("RS-01", "Fire Safety Manager", "2318"), typedRed("RS-03", "FM technician", "2318")];
    const { fn, calls } = fakeFetch((url) =>
      url.startsWith("/api/action") ? { ok: true, message: "ok" } : seatState([{ from: "pip", text: "x", cards }])
    );
    render(<SeatChat seat="tenant" fetcher={fn} pollMs={0} />);
    expect(await screen.findByText("Call: Fire Safety Manager")).toBeDefined();
    expect(screen.getByText("Call: FM technician")).toBeDefined();
    const buttons = screen.getAllByRole("button", { name: /^Raise this stop/ });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]);
    await waitFor(() => expect(calls.some((c) => c.url === "/api/action")).toBe(true));
    expect(calls.find((c) => c.url === "/api/action")!.body).toMatchObject({ payload: { stopId: "RS-03" } });
  });

  it("the typed reply shown before any poll carries the button too", async () => {
    const card = typedRed("RS-04", "FM control room", "2318");
    const { fn } = fakeFetch((url) =>
      url.startsWith("/api/chat")
        ? { ok: true, storedText: "the ceiling is dripping", cards: [card], storedCount: 2 }
        : seatState([])
    );
    render(<SeatChat seat="tenant" fetcher={fn} pollMs={0} jobId="2318" />);
    fireEvent.change(await screen.findByLabelText("Message Pip"), { target: { value: "the ceiling is dripping" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Call: FM control room")).toBeDefined();
    expect(screen.getAllByRole("button", { name: /^Raise this stop/ })).toHaveLength(1);
  });

  it("a card picked from the Safety list (already raised) shows no Raise this stop button", async () => {
    const { raiseStopId: _r, ...picked } = typedRed("RS-04", "FM control room", "2318");
    void _r;
    const { fn } = fakeFetch(() => seatState([{ from: "pip", text: picked.body, cards: [picked] }]));
    render(<SeatChat seat="tenant" fetcher={fn} pollMs={0} />);
    expect(await screen.findByText("Call: FM control room")).toBeDefined();
    expect(screen.queryByRole("button", { name: /^Raise this stop/ })).toBeNull();
  });
});

describe("C7a review: a double tap sends one press", () => {
  it("a second tap on an answer while the first press is on its way sends nothing", async () => {
    const question = { kind: "question", questionId: "Q0", jobId: "2319", title: "Q0 text", answers: ["Yes", "No"] };
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { fn, calls } = fakeFetch(async (url) => {
      if (url.startsWith("/api/action")) {
        await held;
        return { ok: true, message: "Answer saved." };
      }
      return seatState([{ from: "pip", text: "Q0 text", cards: [question] }]);
    });
    render(<SeatChat seat="tenant" fetcher={fn} pollMs={0} />);

    const no = await screen.findByRole("button", { name: "No" });
    fireEvent.click(no);
    fireEvent.click(no);
    await waitFor(() => expect(calls.filter((c) => c.url === "/api/action")).toHaveLength(1));

    release();
    await waitFor(() => {
      const at = calls.findIndex((c) => c.url === "/api/action");
      expect(calls.slice(at + 1).some((c) => c.url.startsWith("/api/state"))).toBe(true);
    });
    expect(calls.filter((c) => c.url === "/api/action")).toHaveLength(1);
    expect(screen.queryByText("That question is already answered.")).toBeNull();

    // Once the press is back, the next press goes through.
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    await waitFor(() => expect(calls.filter((c) => c.url === "/api/action")).toHaveLength(2));
  });
});
