// @vitest-environment jsdom

/**
 * C7a on screen, fake fetch only: a typed message shows once after a poll that
 * returns its stored copy (the C5a duplicate fix), the tenant's Report a problem
 * buttons, the self-check answer buttons, Raise on the Safety list, the Call
 * line on a red card, and a refused press.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { SeatChat } from "../app/components/chat/SeatChat";
import { ChatCard } from "../app/components/chat/ChatCard";

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

describe("C7a: a typed message and its reply show exactly once", () => {
  it("after a poll that returns the stored copy, the message and its card are on screen once", async () => {
    const card = { kind: "answer", body: "I did not catch that. Try one of these.", receipt: "pill v1.0 · AI calls: 0" };
    let stored: unknown[] = [];
    const { fn, calls } = fakeFetch((url) => {
      if (url.startsWith("/api/chat")) {
        stored = [
          { from: "person", text: "hello pip" },
          { from: "pip", text: card.body, cards: [card] },
        ];
        return { ok: true, storedText: "hello pip", cards: [card], storedCount: 2 };
      }
      return seatState(stored);
    });

    render(<SeatChat seat="tenant" fetcher={fn} pollMs={25} />);
    const input = await screen.findByLabelText("Message Pip");
    fireEvent.change(input, { target: { value: "hello pip" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(calls.some((c) => c.url.startsWith("/api/chat"))).toBe(true));
    const chatAt = calls.findIndex((c) => c.url.startsWith("/api/chat"));
    // Wait past at least two polls after the message was stored.
    await waitFor(() => expect(calls.slice(chatAt + 1).filter((c) => c.url.startsWith("/api/state")).length).toBeGreaterThanOrEqual(2));

    expect(screen.getAllByText("hello pip")).toHaveLength(1);
    expect(screen.getAllByText(card.body)).toHaveLength(1);
  });

  it("before any poll has the stored copy, the reply shows once from the chat answer", async () => {
    const card = { kind: "answer", body: "Nothing is waiting on you right now.", receipt: "pill v1.0 · AI calls: 0" };
    const { fn } = fakeFetch((url) =>
      url.startsWith("/api/chat")
        ? { ok: true, storedText: "what needs me", cards: [card], storedCount: 2 }
        : seatState([])
    );
    render(<SeatChat seat="tenant" fetcher={fn} pollMs={0} />);
    const input = await screen.findByLabelText("Message Pip");
    fireEvent.change(input, { target: { value: "what needs me" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getAllByText("what needs me")).toHaveLength(1));
    expect(screen.getAllByText(card.body)).toHaveLength(1);
  });
});

describe("C7a: the tenant's Report a problem", () => {
  it("shows Too cold and Too hot; Too cold presses report with that payload, then reloads the chat", async () => {
    const { fn, calls } = fakeFetch((url) => (url.startsWith("/api/action") ? { ok: true, message: "ok" } : seatState()));
    render(<SeatChat seat="tenant" fetcher={fn} pollMs={0} />);

    fireEvent.click(await screen.findByRole("button", { name: "Report a problem" }));
    expect(screen.getByRole("button", { name: "Too hot" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Too cold" }));

    await waitFor(() => expect(calls.some((c) => c.url === "/api/action")).toBe(true));
    const pressed = calls.find((c) => c.url === "/api/action")!;
    expect(pressed.body).toEqual({ seat: "tenant", action: "report", payload: { complaint: "too cold" } });
    await waitFor(() => {
      const at = calls.findIndex((c) => c.url === "/api/action");
      expect(calls.slice(at + 1).some((c) => c.url.startsWith("/api/state"))).toBe(true);
    });
  });

  it("is only on the tenant seat", async () => {
    const { fn } = fakeFetch(() => seatState([], "technician"));
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} />);
    await screen.findByLabelText("Message Pip");
    expect(screen.queryByRole("button", { name: "Report a problem" })).toBeNull();
  });
});

describe("C7a: a self-check question card", () => {
  it("shows one button per answer, and a press sends the answer for that job and question", async () => {
    const question = {
      kind: "question",
      questionId: "Q2",
      jobId: "2319",
      title: "Since when?",
      answers: ["Today", "This week", "It keeps coming back"],
      receipt: "Self-check · pill v1.0 · AI calls: 0",
    };
    const { fn, calls } = fakeFetch((url) =>
      url.startsWith("/api/action") ? { ok: true, message: "ok" } : seatState([{ from: "pip", text: "Since when?", cards: [question] }])
    );
    render(<SeatChat seat="tenant" fetcher={fn} pollMs={0} />);

    expect(await screen.findByText("Since when?")).toBeDefined();
    for (const a of question.answers) expect(screen.getByRole("button", { name: a })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "It keeps coming back" }));

    await waitFor(() => expect(calls.some((c) => c.url === "/api/action")).toBe(true));
    expect(calls.find((c) => c.url === "/api/action")!.body).toEqual({
      seat: "tenant",
      action: "answer",
      job: "2319",
      payload: { questionId: "Q2", answer: "It keeps coming back" },
    });
  });

  it("an answered card shows no answer buttons", async () => {
    const question = {
      kind: "question",
      questionId: "Q3",
      jobId: "2319",
      title: "Has it happened before?",
      answers: ["Yes", "No"],
      answered: "No",
    };
    const { fn } = fakeFetch(() => seatState([{ from: "pip", text: "Has it happened before?", cards: [question] }]));
    render(<SeatChat seat="tenant" fetcher={fn} pollMs={0} />);
    expect(await screen.findByText("Has it happened before?")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Yes" })).toBeNull();
    expect(screen.queryByRole("button", { name: "No" })).toBeNull();
  });

  it("a refused press shows its reason", async () => {
    const question = { kind: "question", questionId: "Q0", jobId: "2319", title: "Q0 text", answers: ["Yes", "No"] };
    const { fn } = fakeFetch((url) =>
      url.startsWith("/api/action")
        ? { ok: false, message: "That question is already answered." }
        : seatState([{ from: "pip", text: "Q0 text", cards: [question] }])
    );
    render(<SeatChat seat="tenant" fetcher={fn} pollMs={0} />);
    fireEvent.click(await screen.findByRole("button", { name: "No" }));
    expect(await screen.findByText("That question is already answered.")).toBeDefined();
  });
});

describe("C7a: the Safety list can be picked from", () => {
  const items = [
    { id: "RS-01", title: "Fire", body: "Leave." },
    { id: "RS-04", title: "Water", body: "Stop." },
  ];

  it("each stop has a Raise button; a press raises it on the card's job", async () => {
    const list = { kind: "safety-list", title: "Safety first", items, jobId: "2319", receipt: "Safety list · pill v1.0 · AI calls: 0" };
    const { fn, calls } = fakeFetch((url) =>
      url.startsWith("/api/action") ? { ok: true, message: "ok" } : seatState([{ from: "pip", text: "Safety first", cards: [list] }])
    );
    render(<SeatChat seat="tenant" fetcher={fn} pollMs={0} jobId="2318" />);
    fireEvent.click(await screen.findByRole("button", { name: "Raise RS-04" }));
    await waitFor(() => expect(calls.some((c) => c.url === "/api/action")).toBe(true));
    expect(calls.find((c) => c.url === "/api/action")!.body).toEqual({
      seat: "tenant",
      action: "safety-pick",
      job: "2319",
      payload: { stopId: "RS-04" },
    });
  });

  it("a list with no job of its own raises on the seat's job", async () => {
    const list = { kind: "safety-list", title: "Safety first", items, receipt: "Safety list · pill v1.0 · AI calls: 0" };
    const { fn, calls } = fakeFetch((url) =>
      url.startsWith("/api/action") ? { ok: true, message: "ok" } : seatState([{ from: "pip", text: "Safety first", cards: [list] }], "technician")
    );
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    fireEvent.click(await screen.findByRole("button", { name: "Raise RS-01" }));
    await waitFor(() => expect(calls.some((c) => c.url === "/api/action")).toBe(true));
    expect(calls.find((c) => c.url === "/api/action")!.body).toMatchObject({ seat: "technician", job: "2318", payload: { stopId: "RS-01" } });
  });
});

describe("C7a: a red stop card says who to call", () => {
  it("ChatCard shows the Call line", () => {
    render(<ChatCard colour="red" colourWord="Stop" title="Trigger." body="Action." call="Building manager" />);
    expect(screen.getByText("Call: Building manager")).toBeDefined();
  });

  it("SeatChat passes a stored red card's who-to-call through", async () => {
    const red = { kind: "red-stop", stopId: "RS-04", title: "Trigger.", body: "Action.", call: "FM technician", receipt: "Red stop RS-04 · pill v1.0 · AI calls: 0" };
    const { fn } = fakeFetch(() => seatState([{ from: "pip", text: "Action.", cards: [red] }]));
    render(<SeatChat seat="tenant" fetcher={fn} pollMs={0} />);
    expect(await screen.findByText("Call: FM technician")).toBeDefined();
  });
});
