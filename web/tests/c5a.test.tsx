// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { SeatChat } from "../app/components/chat/SeatChat";
import { ChatCard } from "../app/components/chat/ChatCard";
import { PipAvatar } from "../app/components/PipAvatar";
import { loadAndCheckPill } from "../lib/pill";
import { safetyList, safetyCardForStop } from "../lib/safety";

const pill = loadAndCheckPill("ts-cc", "1.0");

function seatState(overrides: Record<string, unknown> = {}) {
  return {
    label: "Technician (role-played)",
    chips: ["What needs me", "Show job", "Why?", "Dial?", "Safety"],
    messages: [],
    notices: [],
    ...overrides,
  };
}

/** A fetch that never touches the network and records what it was asked. */
function fakeFetch(bodyFor: (url: string) => unknown) {
  const calls: string[] = [];
  const fn = vi.fn(async (input: string) => {
    calls.push(input);
    return { json: async () => bodyFor(input) } as Response;
  });
  return { fn, calls };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => {
    throw new Error("the component reached the network");
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("T-C5a: SeatChat never calls the network", () => {
  it("uses the fetch it is given and leaves global fetch alone", async () => {
    const { fn } = fakeFetch(() => seatState());
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} />);

    await waitFor(() => expect(fn).toHaveBeenCalled());
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does not poll when the interval is 0", async () => {
    const { fn } = fakeFetch(() => seatState());
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} />);

    await waitFor(() => expect(fn).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("T-C5a: the Safety button", () => {
  it("is on the seat and opens the 10 stops", async () => {
    const stops = safetyList(pill).map((stop) => {
      const card = safetyCardForStop(stop, "1.0");
      return { id: card.id, title: card.trigger, body: card.action };
    });

    const { fn } = fakeFetch((url) =>
      url.startsWith("/api/chat")
        ? {
            storedText: "safety",
            cards: [{ kind: "safety-list", title: "Safety first", items: stops }],
          }
        : seatState()
    );

    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} />);
    const button = await screen.findByRole("button", { name: "Safety" });
    button.click();

    await waitFor(() => expect(screen.getByText("Safety first")).toBeDefined());
    for (const stop of stops) {
      expect(screen.getByText(stop.id)).toBeDefined();
    }
    expect(stops).toHaveLength(10);
  });
});

describe("T-C5a: a red stop card renders the YAML word for word", () => {
  it("shows the trigger, the action and the receipt from the pill", async () => {
    const stop = safetyList(pill).find((s) => s.id === "RS-04")!;
    const card = safetyCardForStop(stop, "1.0");

    const { fn } = fakeFetch((url) =>
      url.startsWith("/api/chat")
        ? {
            storedText: "water is dripping from the ceiling",
            cards: [
              {
                kind: "red-stop",
                stopId: card.id,
                title: card.trigger,
                body: card.action,
                receipt: card.receipt,
              },
            ],
          }
        : seatState()
    );

    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} />);
    (await screen.findByRole("button", { name: "Safety" })).click();

    await waitFor(() => expect(screen.getByText(card.trigger)).toBeDefined());
    expect(screen.getByText(card.action)).toBeDefined();
    expect(screen.getByText(card.receipt)).toBeDefined();
    expect(card.trigger).toBe(stop.trigger);
    expect(card.action).toBe(stop.action);
  });
});

describe("T-C5a: colour is never the only signal", () => {
  it("a card with a colour always prints its word", () => {
    render(<ChatCard colour="red" colourWord="Stop" title="Burning smell? Stop." />);
    expect(screen.getByText("Stop")).toBeDefined();
  });

  it("the chips and the text box are there", async () => {
    const { fn } = fakeFetch(() => seatState());
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} />);

    expect(await screen.findByRole("button", { name: "Dial?" })).toBeDefined();
    expect(screen.getByLabelText("Message Pip")).toBeDefined();
  });
});

describe("T-C5a: Pip is flat", () => {
  it("draws every fill from a --pip token and no 3D", () => {
    const { container } = render(<PipAvatar />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-label")).toMatch(/Pip/);
    const fills = Array.from(svg.querySelectorAll("[fill]")).map((n) =>
      n.getAttribute("fill")
    );
    expect(fills.length).toBeGreaterThan(10);
    for (const fill of fills) {
      expect(fill).toMatch(/^var\(--pip-/);
    }
  });
});

describe("T-C5a: the look lives in the token block", () => {
  const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf-8");

  it("has no hard-coded colour outside :root", () => {
    const afterRoot = css.slice(css.indexOf("}", css.indexOf(":root")) + 1);
    expect(afterRoot.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(afterRoot.match(/rgba?\([^)]*\)/g) ?? []).toEqual([]);
  });

  it("the stray-colour check bites", () => {
    const planted = "}\n.x { color: #ABCDEF; }";
    const afterRoot = planted.slice(planted.indexOf("}") + 1);
    expect(afterRoot.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual(["#ABCDEF"]);
  });

  it("styles the Safety button more tightly than a plain chip", () => {
    // `.chips button` (one class, one element) outranks a bare `.safety-btn`,
    // so the red button was silently drawn as an ordinary chip until the
    // selector carried two classes. The rendered pixels, not this file, found
    // it, so the selector is pinned here.
    expect(css).toMatch(/\.chips\s+\.safety-btn\s*\{/);
    expect(css).not.toMatch(/(^|\})\s*\.safety-btn\s*\{/);
  });

  it("maps the status tokens onto the look's three colours", () => {
    expect(css).toMatch(/--g:\s*var\(--green\)/);
    expect(css).toMatch(/--a:\s*var\(--amber\)/);
    expect(css).toMatch(/--r:\s*var\(--red\)/);
  });

  it("status text clears 4.5:1 on its own card", () => {
    const token = (name: string) =>
      css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))![1];

    const pairs: [string, string][] = [
      [token("green"), token("card")],
      [token("amber"), token("card")],
      [token("red"), token("red-card")],
      [token("text"), token("bg")],
      [token("muted"), token("card")],
    ];

    for (const [fg, bg] of pairs) {
      expect(contrast(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const channel = (value: number) => {
      const c = value / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const n = hex.replace("#", "");
    const [r, g, bl] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(bl);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
