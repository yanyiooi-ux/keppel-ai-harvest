// @vitest-environment jsdom

/**
 * C6a on screen: the AI switch in the top bar, and the "AI wording" line, the
 * replay banner and the "AI off" label on a card. Fake fetch only.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { AiSwitch } from "../app/components/AiSwitch";
import { ChatCard } from "../app/components/chat/ChatCard";
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

describe("C6a: the AI switch in the top bar", () => {
  it("shows Live, Replay and Off, with the current one pressed", () => {
    render(<AiSwitch mode="replay" onPicked={() => {}} />);
    const group = screen.getByRole("group", { name: "AI switch" });
    expect(group).toBeDefined();
    expect(screen.getByRole("button", { name: "Live" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Replay" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Off" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("a pick is saved as a cookie, then the page reloads", () => {
    const picked = vi.fn();
    render(<AiSwitch mode="replay" onPicked={picked} />);
    fireEvent.click(screen.getByRole("button", { name: "Off" }));
    expect(document.cookie).toContain("pill-desk-ai=off");
    expect(picked).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Live" }));
    expect(document.cookie).toContain("pill-desk-ai=live");
    expect(document.cookie).not.toContain("pill-desk-ai=off");
  });
});

describe("C6a: a card shows the AI line under the code reason, which always stays", () => {
  it("the AI wording is an extra, labelled line after the body", () => {
    const { container } = render(
      <ChatCard title="Why that one first" body="The code reason." aiWording="An easier way to say it." receipt="AI calls: 1" />
    );
    expect(screen.getByText("The code reason.")).toBeDefined();
    expect(screen.getByText("AI wording")).toBeDefined();
    expect(screen.getByText("An easier way to say it.")).toBeDefined();
    const text = container.textContent ?? "";
    expect(text.indexOf("The code reason.")).toBeLessThan(text.indexOf("AI wording"));
    expect(text.indexOf("AI wording")).toBeLessThan(text.indexOf("AI calls: 1"));
  });

  it("a replayed line carries the banner; a failed call shows only the fixed phrase", () => {
    render(
      <ChatCard
        body="The code reason."
        aiWording="Saved wording."
        aiBanner="replay: saved real AI answer"
        aiNotice="401 AI unavailable, using replay"
      />
    );
    expect(screen.getByText("replay: saved real AI answer")).toBeDefined();
    expect(screen.getByText("401 AI unavailable, using replay")).toBeDefined();
  });

  it("Off shows the small AI off label and no AI line", () => {
    const { container } = render(<ChatCard body="The code reason." aiOff="AI off" />);
    expect(screen.getByText("AI off")).toBeDefined();
    expect(container.textContent).not.toContain("AI wording");
  });

  it("a card with no AI part shows none of it", () => {
    const { container } = render(<ChatCard body="Plain." receipt="AI calls: 0" />);
    expect(container.textContent).not.toContain("AI wording");
    expect(container.textContent).not.toContain("AI off");
    expect(container.textContent).not.toContain("replay:");
  });

  it("SeatChat passes a stored card's AI parts through", async () => {
    const state = {
      label: "Technician (role-played)",
      chips: ["Why?", "Safety"],
      notices: [],
      messages: [
        { from: "person", text: "why" },
        {
          from: "pip",
          text: "The code reason.",
          cards: [
            {
              kind: "answer",
              title: "Why that one first",
              body: "The code reason.",
              aiJob: "rank-wording",
              aiWording: "Said more simply.",
              aiBanner: "replay: saved real AI answer",
              receipt: "AI calls: 0",
            },
          ],
        },
      ],
    };
    const fn = vi.fn(async () => ({ json: async () => state }) as Response);
    render(<SeatChat seat="technician" fetcher={fn} pollMs={0} />);
    await waitFor(() => expect(screen.getByText("Said more simply.")).toBeDefined());
    expect(screen.getByText("AI wording")).toBeDefined();
    expect(screen.getByText("replay: saved real AI answer")).toBeDefined();
    expect(screen.getByText("The code reason.")).toBeDefined();
  });
});
