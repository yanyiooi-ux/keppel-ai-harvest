// @vitest-environment jsdom

/**
 * D1 on screen, fake fetch only.
 *
 * Loading you can see: a press or a typed message marks the control that was
 * used (aria-busy), locks every control in the chat (one disabled fieldset),
 * and shows "Pip is checking" with typing dots. The reply lands as soon as the
 * server answers; the mark, "Pip is checking" and the lock stay on screen at
 * least 400 ms from the press (D1 review: so a second tap in that gap cannot
 * fire), and as long as the server is slow. A refused press frees the lock at
 * once. A second press while one is on its way sends nothing. A press that
 * fails on the network says so in plain words and frees the chat. The 400 ms
 * is checked on a held clock, never on the wall clock.
 *
 * Plain words first: a lead's tier, a rule id in a reason, a notice's kind and
 * the seat show their plain words with the code kept after them as a grey tag.
 * A red stop's own words are left exactly as the pill has them.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { render, screen, waitFor, cleanup, fireEvent, within, act } from "@testing-library/react";
import { SeatChat } from "../app/components/chat/SeatChat";
import { ChatCard } from "../app/components/chat/ChatCard";
import { HowLive } from "../app/components/how/HowLive";
import type { TechnicianDesk, DeskLead, OpenJobDesk } from "../lib/technician-desk";

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

function lead(causeId: string, label: string, extra: Partial<DeskLead> = {}): DeskLead {
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
    receipt: "Lead · pill v1.0 · AI calls: 0",
    aiCalls: 0,
    ...extra,
  };
}

const PRECOOL = lead("precool", "Morning start-up runs too cold");
const MIN_AIR = lead("min-airflow", "Core box held at minimum airflow");
const THERMO = lead("thermostat-spot", "Thermostat in the wrong spot after a fit-out", {
  tier: "low-confidence",
  tierWord: "low confidence",
  reason: "Low confidence, expert rule TS-CC-18: only 1 similar case so far.",
});

function openDesk(leads: DeskLead[], ruledOut: DeskLead[] = []): OpenJobDesk {
  return {
    jobId: "2318",
    title: "Job 2318 · Tower A, Level 23, core",
    status: "in-progress",
    statusLine: "In progress: check the leads in order and tick each one, then Solved, Send with the cause or Not solved.",
    inProgress: true,
    locked: null,
    checklist: [],
    note: "",
    leads,
    ruledOut,
    removed: [],
    steps: [],
  };
}

function desk(open: OpenJobDesk): TechnicianDesk {
  return {
    title: "Jobs in Tower A",
    jobs: [
      { id: "2318", place: "Level 23, core", complaint: "too cold", reported: "6 Oct, 09:10", status: "in-progress", canOpen: false, isOpen: true },
    ],
    open,
  };
}

function techState(open: OpenJobDesk, notices: { kind: string; text: string }[] = []) {
  return {
    seat: "technician",
    label: "Technician (role-played)",
    pipNever: "approve anything, or use a fix the rules removed",
    chips: ["What needs me", "Why?", "Safety"],
    messages: [],
    notices,
    desk: desk(open),
  };
}

function fakeFetch(answer: (url: string, body: Body | null) => unknown) {
  const calls: { url: string; body: Body | null; at: number }[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? (JSON.parse(String(init.body)) as Body) : null;
    calls.push({ url, body, at: Date.now() });
    const value = answer(url, body);
    if (value instanceof Error) throw value;
    return { json: async () => value } as Response;
  });
  return { fn, calls };
}

const lock = (root: HTMLElement) => root.querySelector("fieldset.chat-lock") as HTMLFieldSetElement;
const actions = (calls: { url: string }[]) => calls.filter((c) => c.url === "/api/action").length;

/** Lets the fake server's answers land: every pending promise and render, no timer moved. */
async function settle() {
  for (let i = 0; i < 12; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

/** The clock and setTimeout under the test's hand, so the 400 ms is checked exactly, never by the wall clock. */
function holdTheClock() {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
}

describe("D1: a press shows that Pip is working", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks the pressed button, locks the chat, shows Pip is checking; the reply lands at once and the lock holds to 400 ms", async () => {
    let ticked = false;
    const { fn, calls } = fakeFetch((url) => {
      if (url === "/api/action") {
        ticked = true;
        return { ok: true, message: "Not this: Morning start-up runs too cold." };
      }
      return techState(ticked ? openDesk([MIN_AIR, THERMO], [{ ...PRECOOL, tick: "not-this" }]) : openDesk([PRECOOL, MIN_AIR, THERMO]));
    });
    const { container } = render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    const button = await screen.findByRole("button", { name: "Not this: Morning start-up runs too cold" });
    expect(lock(container).disabled).toBe(false);
    expect(screen.queryByText("Pip is checking")).toBeNull();

    holdTheClock();
    fireEvent.click(button);

    // Pending: the pressed button says so, every control is locked, and Pip says it is checking.
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.classList.contains("is-pending")).toBe(true);
    expect(lock(container).disabled).toBe(true);
    expect(screen.getByText("Pip is checking")).toBeTruthy();
    expect(container.querySelector(".pip-checking .typing-dots")).not.toBeNull();

    // A second press while the first is on its way sends nothing.
    fireEvent.click(screen.getByRole("button", { name: "Not this: Core box held at minimum airflow" }));

    // The reply lands as soon as the server answers, with no time gone by.
    await settle();
    expect(screen.getByText("Ruled out (1)")).toBeTruthy();
    expect(actions(calls)).toBe(1);

    // The mark, "Pip is checking" and the lock stay with the reply until 400 ms
    // from the press, so a second tap in that gap cannot fire (D1 review): every
    // control in the chat is disabled, the next lead's Not this too.
    expect(lock(container).disabled).toBe(true);
    expect(screen.getByText("Pip is checking")).toBeTruthy();
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("button", { name: "Not this: Core box held at minimum airflow" }).matches(":disabled")).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(399);
    });
    expect(lock(container).disabled).toBe(true);
    expect(screen.getByText("Pip is checking")).toBeTruthy();

    // At 400 ms they all go together, and the chat is free again.
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText("Pip is checking")).toBeNull();
    expect(lock(container).disabled).toBe(false);
    expect(button.getAttribute("aria-busy")).toBeNull();
    expect(button.classList.contains("is-pending")).toBe(false);
    expect(screen.getByRole("button", { name: "Not this: Core box held at minimum airflow" }).matches(":disabled")).toBe(false);
    expect(actions(calls)).toBe(1);
  });

  it("a refused press frees the chat at once, so a fix and a retry are never held up (D1 review)", async () => {
    let n = 0;
    const { fn, calls } = fakeFetch((url) => {
      if (url === "/api/action") return ++n === 1 ? { ok: false, message: "Refused for a reason." } : { ok: true, message: "Done." };
      return techState(openDesk([PRECOOL, MIN_AIR, THERMO]));
    });
    const { container } = render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    const button = await screen.findByRole("button", { name: "Not this: Morning start-up runs too cold" });
    holdTheClock();
    fireEvent.click(button);
    await settle();
    expect(screen.getByText("Refused for a reason.")).toBeTruthy();
    // No time has gone by: the mark and "Pip is checking" still show, but the lock is already off.
    expect(screen.getByText("Pip is checking")).toBeTruthy();
    expect(lock(container).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Not this: Morning start-up runs too cold" }));
    await settle();
    expect(actions(calls)).toBe(2);
  });

  it("while the server is slow, the chat stays locked and Pip keeps checking until the reply lands", async () => {
    let answer: (value: unknown) => void = () => {};
    const slow = new Promise((resolve) => {
      answer = resolve;
    });
    let ticked = false;
    const calls: string[] = [];
    const fn = vi.fn(async (url: string) => {
      calls.push(url);
      if (url === "/api/action") {
        await slow;
        ticked = true;
        return { json: async () => ({ ok: true, message: "Ticked." }) } as Response;
      }
      const state = techState(ticked ? openDesk([MIN_AIR, THERMO], [{ ...PRECOOL, tick: "not-this" }]) : openDesk([PRECOOL, MIN_AIR, THERMO]));
      return { json: async () => state } as Response;
    });
    const { container } = render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    fireEvent.click(await screen.findByRole("button", { name: "Not this: Morning start-up runs too cold" }));
    // Well past 400 ms with no answer: still locked, still checking.
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(lock(container).disabled).toBe(true);
    expect(screen.getByText("Pip is checking")).toBeTruthy();
    expect(screen.getByText("Ruled out (0)")).toBeTruthy();
    answer(null);
    await screen.findByText("Ruled out (1)");
    await waitFor(() => expect(screen.queryByText("Pip is checking")).toBeNull());
    expect(lock(container).disabled).toBe(false);
    expect(calls.filter((u) => u === "/api/action")).toHaveLength(1);
  });

  it("a typed message marks the send button and shows Pip is checking until the reply lands, and at least 400 ms", async () => {
    const { fn, calls } = fakeFetch((url) => {
      if (url === "/api/chat") return { storedText: "why", cards: [{ kind: "rank", title: "Why this order", body: "Code reason." }] };
      return techState(openDesk([PRECOOL, MIN_AIR, THERMO]));
    });
    const { container } = render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    const input = await screen.findByLabelText("Message Pip");
    fireEvent.change(input, { target: { value: "why" } });
    const send = screen.getByRole("button", { name: "Send" });
    holdTheClock();
    fireEvent.click(send);

    expect(send.getAttribute("aria-busy")).toBe("true");
    expect(lock(container).disabled).toBe(true);
    expect(screen.getByText("Pip is checking")).toBeTruthy();

    await settle();
    expect(screen.getByText("Why this order")).toBeTruthy();
    expect(screen.getByText("Pip is checking")).toBeTruthy();
    expect(lock(container).disabled).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.queryByText("Pip is checking")).toBeNull();
    expect(send.getAttribute("aria-busy")).toBeNull();
    expect(lock(container).disabled).toBe(false);
    expect(calls.filter((c) => c.url === "/api/chat")).toHaveLength(1);
  });

  it("a press that fails on the network says so in plain words and frees the chat", async () => {
    const { fn } = fakeFetch((url) => {
      if (url === "/api/action") return new Error("network down");
      return techState(openDesk([PRECOOL, MIN_AIR, THERMO]));
    });
    const { container } = render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    fireEvent.click(await screen.findByRole("button", { name: "Not this: Morning start-up runs too cold" }));
    await screen.findByText("That did not go through. Check the connection, then try again.", undefined, { timeout: 3000 });
    await waitFor(() => expect(screen.queryByText("Pip is checking")).toBeNull(), { timeout: 3000 });
    expect(lock(container).disabled).toBe(false);
    // The view stays as it was: nothing was ticked.
    expect(screen.getByText("Ruled out (0)")).toBeTruthy();
  });
});

describe("D1: the judges' page Reset demo shows it is working", () => {
  it("is marked busy and disabled until the page reloads, and resets once", async () => {
    let answer: (value: unknown) => void = () => {};
    const slow = new Promise((resolve) => {
      answer = resolve;
    });
    const resets: string[] = [];
    const fn = vi.fn(async (url: string) => {
      if (url === "/api/reset") {
        resets.push(url);
        await slow;
      }
      return { json: async () => ({}) } as Response;
    });
    const reload = vi.fn();
    render(<HowLive seats={[]} buildingB={null} steps={[]} fetcher={fn} pollMs={0} reload={reload} />);
    const reset = screen.getByRole("button", { name: "Reset demo" });
    fireEvent.click(reset);
    expect(reset.getAttribute("aria-busy")).toBe("true");
    expect((reset as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(reset);
    answer(null);
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(resets).toHaveLength(1);
  });
});

describe("D1: plain words first, the code after as a grey tag", () => {
  it("a lead shows its tier and its rule in plain words, each code kept as a tag", async () => {
    const { fn } = fakeFetch(() => techState(openDesk([THERMO])));
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" />);
    const card = within((await screen.findAllByTestId("lead-card"))[0]);
    expect(card.getByText("Not sure yet: under 3 past cases")).toBeTruthy();
    expect(card.getByText("low-confidence").className).toBe("code-tag");
    expect(card.getByText("“Check the thermostat sensor is in the right spot”")).toBeTruthy();
    expect(card.getByText("TS-CC-18").className).toBe("code-tag");
    const reason = card.getByText("TS-CC-18").closest("p")!;
    expect(reason.textContent).toBe(
      "Low confidence, expert rule “Check the thermostat sensor is in the right spot” TS-CC-18: only 1 similar case so far."
    );
  });

  it("a notice shows its kind in plain words, and the seat its plain name, each with the code as a tag", async () => {
    const { fn } = fakeFetch(() =>
      techState(openDesk([PRECOOL]), [
        { kind: "speak-first", text: "Speak first: Tower A Level 23 has called 5 times in 30 days, with opposite fixes (repeat flag, TS-CC-09)." },
      ])
    );
    const { container } = render(<SeatChat seat="hq" fetcher={fn} pollMs={0} />);
    await screen.findByText("This spot keeps calling");
    const notice = container.querySelector(".notice")!;
    expect(within(notice as HTMLElement).getByText("speak-first").className).toBe("code-tag");
    expect(within(notice as HTMLElement).getByText("TS-CC-09").className).toBe("code-tag");
    const head = container.querySelector(".chat-name")!;
    expect(head.textContent).toBe("Pip Head office (HQ) hq");
    expect(head.querySelector(".seat-word")!.textContent).toBe("Head office (HQ)");
    expect(within(head as HTMLElement).getByText("hq").classList.contains("code-tag")).toBe(true);
  });

  it("a safety alert notice keeps the stop's own words exactly, codes and all", async () => {
    const alert = "Red stop on Tower A, Level 23\nWater dripping near lights.\nRed stop RS-04 · AI calls: 0";
    const { fn } = fakeFetch(() => techState(openDesk([PRECOOL]), [{ kind: "alert", text: alert }]));
    const { container } = render(<SeatChat seat="hq" fetcher={fn} pollMs={0} />);
    await screen.findByText("Safety alert");
    const notice = container.querySelector(".notice")! as HTMLElement;
    expect(notice.querySelector(".plain-code")).toBeNull();
    expect(notice.textContent).toBe(`Safety alert alert${alert}`);
  });

  it("a red stop's own words stay exactly as the pill has them; only its label gets a plain name", () => {
    const trigger = "Water dripping from the ceiling or pooling near lights, floor power boxes, or electrical or comms rooms.";
    const action = "Keep away from the electrics, clear the area, and do not climb under the wet ceiling.";
    render(
      <ChatCard colour="red" colourWord="Stop" from="RS-04" title={trigger} body={action} call="FM control room" receipt="Red stop RS-04 · pill v1.1 · AI calls: 0" />
    );
    expect(screen.getByText(trigger).textContent).toBe(trigger);
    expect(screen.getByText(action).textContent).toBe(action);
    expect(screen.getByText("Call: FM control room")).toBeTruthy();
    expect(screen.getByText("Red stop RS-04 · pill v1.1 · AI calls: 0")).toBeTruthy();
    expect(screen.getByText("Water near the electrics")).toBeTruthy();
    expect(screen.getByText("RS-04").className).toBe("code-tag");
  });
});

describe("D1: new cards move in briefly, and not at all for reduced motion", () => {
  const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf-8");

  it("the stylesheet animates new cards and turns it off under prefers-reduced-motion", () => {
    expect(css).toMatch(/@keyframes card-in/);
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(css.indexOf("@media (prefers-reduced-motion: reduce)")).toBeGreaterThan(-1);
    expect(reduced).toMatch(/animation:\s*none/);
    // D1 review: the very rule in that block names what moves in, and turns it off.
    const block = /@media \(prefers-reduced-motion: reduce\)\s*\{\s*([^{}]*)\{\s*animation:\s*none;\s*\}/.exec(css);
    expect(block).not.toBeNull();
    const selectors = block![1].split(",").map((s) => s.trim());
    for (const moving of [".is-new", ".pip-checking", ".typing-dots i", ".is-pending::after"]) {
      expect(selectors, moving).toContain(moving);
    }
  });

  it("only what lands after the first paint is marked to move in", async () => {
    const first = techState(openDesk([PRECOOL, MIN_AIR, THERMO]));
    const { fn } = fakeFetch((url) => {
      if (url === "/api/chat") return { storedText: "why", cards: [{ kind: "rank", title: "Why this order", body: "Code reason." }] };
      return first;
    });
    const { container } = render(<SeatChat seat="technician" fetcher={fn} pollMs={0} jobId="2318" initial={first} />);
    const opened = (await screen.findAllByTestId("lead-card"))[0].querySelector(".card")!;
    fireEvent.change(screen.getByLabelText("Message Pip"), { target: { value: "why" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    const reply = (await screen.findByText("Why this order")).closest(".card")!;
    await waitFor(() => expect(reply.classList.contains("is-new")).toBe(true));
    expect(container.querySelector(".sent")!.classList.contains("is-new")).toBe(true);
    expect(opened.classList.contains("is-new")).toBe(false);
  });

  it("the grey code tag is a token pair that still clears 4.5:1", () => {
    expect(css).toMatch(/--code-ink:\s*var\(--muted\)/);
    expect(css).toMatch(/--code-bg:\s*var\(--card-2\)/);
    const token = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))![1];
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const ch = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
      return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
    };
    const [hi, lo] = [lum(token("muted")), lum(token("card-2"))].sort((x, y) => y - x);
    expect((hi + 0.05) / (lo + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
});
