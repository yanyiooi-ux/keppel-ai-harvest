// @vitest-environment jsdom

/**
 * Review findings for C7b on screen, fake fetch only.
 *
 * - The bar's Safety (and the chip row's) opens the 10 stops at the end of the
 *   chat, thousands of px below on a phone: the chat now scrolls the new list
 *   into view (S11 "One tap opens all 10").
 * - Solved, Not solved and Send with the cause hide the bar when they work: the
 *   chat scrolls Pip's new card into view, so the press is never silent. A
 *   refused press shows in the bar and scrolls nothing.
 * - Show job puts another in-progress job back on the desk: a view only, no press.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent, within } from "@testing-library/react";
import { SeatChat } from "../app/components/chat/SeatChat";
import type { TechnicianDesk, DeskLead, DeskJobRow, OpenJobDesk } from "../lib/technician-desk";
import type { SeatCard } from "../lib/seat-view";

type Body = Record<string, unknown>;

let scrolled: Element[] = [];
const hadScroll = Object.prototype.hasOwnProperty.call(Element.prototype, "scrollIntoView");
const oldScroll = Element.prototype.scrollIntoView;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => {
    throw new Error("the component reached the network");
  }));
  scrolled = [];
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this);
  };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (hadScroll) Element.prototype.scrollIntoView = oldScroll;
  else delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});

function lead(causeId: string, label: string): DeskLead {
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
    receipt: "pill v1.0 · AI calls: 0",
    aiCalls: 0,
  };
}

function openDesk(jobId: string, extra: Partial<OpenJobDesk> = {}): OpenJobDesk {
  return {
    jobId,
    title: `Job ${jobId} · Tower A, Level 23`,
    status: "in-progress",
    statusLine: "In progress.",
    inProgress: true,
    locked: null,
    checklist: [],
    note: "",
    leads: [lead("precool", `Lead on ${jobId}`)],
    ruledOut: [],
    removed: [],
    steps: [],
    ...extra,
  };
}

function row(id: string, extra: Partial<DeskJobRow> = {}): DeskJobRow {
  return {
    id,
    place: "Level 23, core",
    complaint: "too cold",
    reported: "6 Oct, 09:10",
    status: "in-progress",
    canOpen: false,
    isOpen: false,
    ...extra,
  };
}

function techState(desk: TechnicianDesk, messages: { from: "person" | "pip"; text: string; cards?: SeatCard[] }[] = []) {
  return {
    seat: "technician",
    label: "Technician (role-played)",
    pipNever: "approve anything, or use a fix the rules removed",
    chips: ["What needs me", "Show job", "Why?", "Dial?", "Safety"],
    messages,
    notices: [],
    desk,
  };
}

function oneJobDesk(open: OpenJobDesk): TechnicianDesk {
  return { title: "Jobs in Tower A", jobs: [row(open.jobId, { status: open.status, isOpen: true })], open };
}

function fakeFetch(answer: (url: string, body: Body | null) => unknown) {
  const calls: { url: string; body: Body | null }[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? (JSON.parse(String(init.body)) as Body) : null;
    calls.push({ url, body });
    return { json: async () => answer(url, body) } as Response;
  });
  return { fn, calls };
}

const SAFETY_LIST: SeatCard = {
  kind: "safety-list",
  title: "Safety first",
  items: [
    { id: "RS-01", title: "A fire alarm goes off", body: "" },
    { id: "RS-04", title: "Water dripping near electrics", body: "" },
  ],
  receipt: "pill v1.0 · AI calls: 0",
};

describe("C7b review: Safety scrolls the 10 stops into view", () => {
  for (const where of ["the bar", "the chip row"]) {
    it(`Safety in ${where}: the chat scrolls to the new Safety list`, async () => {
      const { fn, calls } = fakeFetch((url) => {
        if (url.startsWith("/api/chat")) return { ok: true, storedText: "safety", cards: [SAFETY_LIST], storedCount: 2 };
        return techState(oneJobDesk(openDesk("2318")));
      });
      render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
      const bar = await screen.findByRole("group", { name: "Job 2318 presses" });
      const safety =
        where === "the bar"
          ? within(bar).getByRole("button", { name: "Safety" })
          : screen.getAllByRole("button", { name: "Safety" }).find((b) => !bar.contains(b))!;
      fireEvent.click(safety);
      await screen.findByRole("button", { name: "Raise RS-04" });
      await waitFor(() => expect(scrolled).toHaveLength(1));
      expect(calls.find((c) => c.url === "/api/chat")!.body).toMatchObject({ text: "safety", job: "2318" });
      // The first new thing in the chat is the "safety" the seat sent; the list sits right under it.
      expect(scrolled[0].textContent).toBe("safety");
      const list = screen.getByRole("button", { name: "Raise RS-04" });
      expect(scrolled[0].compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  }

  it("a typed message that is not Safety scrolls nothing", async () => {
    const { fn } = fakeFetch((url) => {
      if (url.startsWith("/api/chat")) return { ok: true, storedText: "why", cards: [], storedCount: 2 };
      return techState(oneJobDesk(openDesk("2318")));
    });
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    fireEvent.change(await screen.findByPlaceholderText("Message Pip about 2318"), { target: { value: "why" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("why");
    expect(scrolled).toHaveLength(0);
  });
});

describe("C7b review: a bar press that works scrolls Pip's new card into view", () => {
  const ESCALATED: SeatCard = {
    kind: "answer",
    title: "Job 2318 escalated",
    body: "Not solved, sent to the senior manager with everything attached.",
    receipt: "pill v1.0 · AI calls: 0",
  };

  it("Not solved: the bar goes, and the chat scrolls to the escalated card", async () => {
    let sent = false;
    const { fn } = fakeFetch((url) => {
      if (url === "/api/action") {
        sent = true;
        return { ok: true, message: "Job 2318 went to the senior manager with its impact record." };
      }
      return sent
        ? techState(oneJobDesk(openDesk("2318", { status: "escalated", inProgress: false, statusLine: "Escalated." })), [
            { from: "pip", text: "Job 2318 escalated: ...", cards: [ESCALATED] },
          ])
        : techState(oneJobDesk(openDesk("2318")));
    });
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    fireEvent.click(await screen.findByRole("button", { name: "Not solved" }));
    fireEvent.change(screen.getByLabelText("Hours lost (0 to 100)"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Extra visits needed (0 to 10)"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("radio", { name: "No" }));
    fireEvent.click(screen.getByRole("button", { name: "Send to the senior manager" }));
    await screen.findByText("Job 2318 escalated");
    await waitFor(() => expect(scrolled).toHaveLength(1));
    expect(scrolled[0].textContent).toContain("Job 2318 escalated");
    expect(screen.queryByRole("group", { name: "Job 2318 presses" })).toBeNull();
  });

  it("Send with the cause that works scrolls to Pip's card too", async () => {
    let sent = false;
    const { fn } = fakeFetch((url) => {
      if (url === "/api/action") {
        sent = true;
        return { ok: true, message: "Sent." };
      }
      return sent
        ? techState(oneJobDesk(openDesk("2318", { status: "escalated", inProgress: false })), [
            { from: "pip", text: "Job 2318 escalated: ...", cards: [{ ...ESCALATED, body: "Sent to the senior manager with the cause." }] },
          ])
        : techState(oneJobDesk(openDesk("2318")));
    });
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    fireEvent.click(await screen.findByRole("button", { name: "Send with the cause" }));
    await waitFor(() => expect(scrolled).toHaveLength(1));
    expect(scrolled[0].textContent).toContain("Sent to the senior manager with the cause.");
  });

  it("a refused press shows in the bar and scrolls nothing", async () => {
    const { fn } = fakeFetch((url) =>
      url === "/api/action"
        ? { ok: false, message: "Send with the cause needs a found lead: tick Found it on the cause first." }
        : techState(oneJobDesk(openDesk("2318")))
    );
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    fireEvent.click(await screen.findByRole("button", { name: "Send with the cause" }));
    const bar = screen.getByRole("group", { name: "Job 2318 presses" });
    expect(await within(bar).findByText(/needs a found lead/)).toBeTruthy();
    expect(scrolled).toHaveLength(0);
  });

  it("a tick re-ranks in place and scrolls nothing", async () => {
    const { fn, calls } = fakeFetch((url) =>
      url === "/api/action" ? { ok: true, message: "Not this." } : techState(oneJobDesk(openDesk("2318")))
    );
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    fireEvent.click(await screen.findByRole("button", { name: "Not this: Lead on 2318" }));
    await waitFor(() => expect(calls.filter((c) => c.url.startsWith("/api/state"))).toHaveLength(2));
    expect(scrolled).toHaveLength(0);
  });
});

describe("C7b review: Raise from the Safety list scrolls to the stop's card", () => {
  const RS04: SeatCard = {
    kind: "red-stop",
    stopId: "RS-04",
    title: "RS-04 trigger",
    body: "RS-04 action",
    call: "RS-04 who to call",
    receipt: "Red stop RS-04 · pill v1.0 · AI calls: 0",
  };

  function safetyThenRaise(answer: { ok: boolean; message: string; alreadyShown?: boolean }, stores: boolean) {
    let raised = false;
    return fakeFetch((url) => {
      if (url.startsWith("/api/chat")) return { ok: true, storedText: "safety", cards: [SAFETY_LIST], storedCount: 2 };
      if (url === "/api/action") {
        raised = true;
        return answer;
      }
      // Once pressed, the stored log holds the typed "safety" and its list (2
      // messages, as chat.ts stores a typed turn), then the picked card if any.
      const messages: { from: "person" | "pip"; text: string; cards?: SeatCard[] }[] = raised
        ? [
            { from: "person", text: "safety" },
            { from: "pip", text: "Safety first", cards: [SAFETY_LIST] },
            ...(stores ? [{ from: "pip" as const, text: "RS-04 action", cards: [RS04] }] : []),
          ]
        : [];
      return techState(oneJobDesk(openDesk("2318")), messages);
    });
  }

  it("a pick that stores the card scrolls to it", async () => {
    const { fn } = safetyThenRaise({ ok: true, message: "Red stop RS-04 is already open here. No second alert.", alreadyShown: false }, true);
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    fireEvent.click(within(await screen.findByRole("group", { name: "Job 2318 presses" })).getByRole("button", { name: "Safety" }));
    fireEvent.click(await screen.findByRole("button", { name: "Raise RS-04" }));
    await screen.findByText("Call: RS-04 who to call");
    await waitFor(() => expect(scrolled).toHaveLength(2));
    expect(scrolled[1].textContent).toContain("RS-04 trigger");
  });

  it("a pick this chat already shows adds nothing and scrolls nothing more", async () => {
    const { fn, calls } = safetyThenRaise({ ok: true, message: "Red stop RS-04 is already open here. No second alert.", alreadyShown: true }, false);
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    fireEvent.click(within(await screen.findByRole("group", { name: "Job 2318 presses" })).getByRole("button", { name: "Safety" }));
    fireEvent.click(await screen.findByRole("button", { name: "Raise RS-04" }));
    await waitFor(() => expect(calls.filter((c) => c.url.startsWith("/api/state"))).toHaveLength(2));
    expect(scrolled).toHaveLength(1);
  });
});

describe("C7b review: Show job puts another in-progress job back on the desk", () => {
  function twoJobs(url: string): TechnicianDesk {
    const showing = url.includes("show=2318") ? "2318" : "2319";
    return {
      title: "Jobs in Tower A",
      jobs: [
        row("2318", { isOpen: showing === "2318", canShow: showing !== "2318" }),
        row("2319", { isOpen: showing === "2319", canShow: showing !== "2319" }),
        row("2320", { status: "reported", canOpen: true }),
      ],
      open: openDesk(showing),
    };
  }

  it("Show job 2318 reads the view for 2318 and presses nothing; its presses then go to 2318", async () => {
    const { fn, calls } = fakeFetch((url) => (url === "/api/action" ? { ok: true, message: "Ticked." } : techState(twoJobs(url))));
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    expect(await screen.findByText("Job 2319 · Tower A, Level 23")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show job 2319" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Show job 2318" }));
    expect(await screen.findByText("Job 2318 · Tower A, Level 23")).toBeTruthy();
    expect(calls.some((c) => c.url === "/api/state?seat=technician&show=2318")).toBe(true);
    expect(calls.some((c) => c.url === "/api/action")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Not this: Lead on 2318" }));
    await waitFor(() => expect(calls.some((c) => c.url === "/api/action")).toBe(true));
    expect(calls.find((c) => c.url === "/api/action")!.body).toMatchObject({ action: "tick", job: "2318" });
    expect(calls.at(-1)!.url).toBe("/api/state?seat=technician&show=2318");
  });

  it("Open job on another job puts the newly opened job on the desk", async () => {
    const { fn, calls } = fakeFetch((url) => (url === "/api/action" ? { ok: true, message: "Job 2320 is open." } : techState(twoJobs(url))));
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    fireEvent.click(await screen.findByRole("button", { name: "Show job 2318" }));
    await screen.findByText("Job 2318 · Tower A, Level 23");
    fireEvent.click(screen.getByRole("button", { name: "Open job 2320" }));
    await waitFor(() => expect(calls.some((c) => c.url === "/api/action")).toBe(true));
    await waitFor(() => expect(calls.at(-1)!.url).toBe("/api/state?seat=technician"));
  });
});
