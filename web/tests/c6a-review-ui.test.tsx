// @vitest-environment jsdom

/**
 * C6a review findings on screen: the Safety list card's receipt, and the AI
 * switch's own reload path. Fake fetch only.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { AiSwitch } from "../app/components/AiSwitch";
import { SeatChat } from "../app/components/chat/SeatChat";

function clearCookies() {
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0].trim();
    if (name) document.cookie = `${name}=; path=/; max-age=0`;
  }
}

beforeEach(() => {
  clearCookies();
  vi.stubGlobal("fetch", vi.fn(() => {
    throw new Error("the component reached the network");
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  clearCookies();
});

describe("C6a review: the Safety list card shows its receipt (S15 'Each card's receipt shows its AI calls')", () => {
  it("SeatChat renders the receipt under the list of stops", async () => {
    const receipt = "Safety list · pill v1.0 · AI calls: 0";
    const state = {
      label: "Technician (role-played)",
      chips: ["Why?", "Safety"],
      notices: [],
      messages: [
        { from: "person", text: "safety" },
        {
          from: "pip",
          text: "Safety first",
          cards: [
            {
              kind: "safety-list",
              title: "Safety first",
              items: [{ id: "RS-01", title: "Smell of burning", body: "Stop." }],
              receipt,
            },
          ],
        },
      ],
    };
    const fn = vi.fn(async () => ({ json: async () => state }) as Response);
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} />);
    await waitFor(() => expect(screen.getByText("Safety first")).toBeDefined());
    expect(screen.getByText("RS-01")).toBeDefined();
    expect(screen.getByText(receipt)).toBeDefined();
  });
});

describe("C6a review: the AI switch with no onPicked saves the cookie, then reloads the page", () => {
  it("the real reload path runs", () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    render(<AiSwitch mode="replay" />);
    fireEvent.click(screen.getByRole("button", { name: "Off" }));
    expect(document.cookie).toContain("pill-desk-ai=off");
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
