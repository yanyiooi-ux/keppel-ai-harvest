// @vitest-environment jsdom

/**
 * D4: YY's two labels and the video player.
 *
 * YY, 16 Oct: "drop the working name and use asset operations manager". The top
 * bar says "Pill Desk" with no tag, and the AOM seat reads "Asset Operations
 * Manager" wherever a person reads it. The seat id aom-tower-a and the
 * engine's own lines stay; the change is in the plain-words layer.
 *
 * The video: a plain browser player with a poster frame on home, /how and
 * /flow, or one plain line when the file is not on this copy of the demo.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import { TopBar } from "../app/components/TopBar";
import { HowStory } from "../app/components/how/HowStory";
import { VideoPlayer } from "../app/components/VideoPlayer";
import { howView } from "../lib/how";
import { resetDemo } from "../lib/actions";
import * as memory from "../lib/memory";
import { SEAT_LABELS } from "../lib/permissions";
import { STORY } from "../lib/story";
import { videoOnDisk } from "../lib/video";
import { VIDEO_MISSING, VIDEO_POSTER, VIDEO_SRC, VIDEO_TITLE } from "../lib/video-words";
import {
  AOM_NAME,
  APPROVAL_WORDS,
  GLOSSARY,
  SEAT_WORDS,
  aomWords,
  raisedWords,
  seatLabelWords,
} from "../lib/plain-words";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network blocked in tests"))));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}

describe("D4: YY's labels", () => {
  it("the top bar says Pill Desk with no working-name tag, and names the seat Asset Operations Manager", () => {
    const { container } = render(<TopBar aiMode="replay" />);
    expect(container.querySelector(".brand")!.textContent).toBe("Pill Desk");
    expect(container.textContent).not.toMatch(/working name/i);
    const nav = screen.getByRole("navigation", { name: "Seat switcher" });
    const aom = within(nav).getByRole("link", { name: AOM_NAME });
    expect(aom.getAttribute("href")).toBe("/seat/aom-tower-a");
    expect(nav.textContent).not.toMatch(/\bAOM\b|Building manager/);
  });

  it("the seat's plain name, chat-head label, A4 line, glossary and raised-stop line all say Asset Operations Manager", () => {
    expect(AOM_NAME).toBe("Asset Operations Manager");
    expect(SEAT_WORDS["aom-tower-a"]).toBe("Asset Operations Manager");
    expect(seatLabelWords(SEAT_LABELS["aom-tower-a"])).toBe("Asset Operations Manager, Tower A: Keppel (role-played)");
    expect(APPROVAL_WORDS.A4).toBe("Asset Operations Manager decides who pays");
    expect(GLOSSARY.AOM).toBe("Asset Operations Manager");
    expect(raisedWords("RS-04")).toContain("the senior manager and the Asset Operations Manager.");
  });

  it("the engine's own words stay: the seat id and its label are unchanged", () => {
    expect(SEAT_LABELS["aom-tower-a"]).toBe("AOM, Tower A: Keppel Asset Operations Manager (role-played)");
  });

  it("aomWords reads the short name as the full name and leaves everything else alone", () => {
    expect(aomWords("AOM Tower A: Decide charge")).toBe("Asset Operations Manager, Tower A: Decide charge");
    expect(aomWords("AOM, Tower A")).toBe("Asset Operations Manager, Tower A");
    expect(aomWords("AOM decides")).toBe("Asset Operations Manager decides");
    expect(aomWords("The AOM watches the impact meter (A4).")).toBe("The Asset Operations Manager watches the impact meter (A4).");
    expect(aomWords("/seat/aom-tower-a")).toBe("/seat/aom-tower-a");
    expect(aomWords("Tenant pays")).toBe("Tenant pays");
  });

  it("no source file in web/app or web/lib carries the old words", () => {
    const hits: string[] = [];
    for (const dir of ["app", "lib"]) {
      for (const file of sourceFiles(join(process.cwd(), dir))) {
        const text = readFileSync(file, "utf-8");
        if (/working name/i.test(text)) hits.push(`${file}: working name`);
        if (/building manager/i.test(text)) hits.push(`${file}: building manager`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("Story mode's captions name the Asset Operations Manager", () => {
    const captions = STORY.map((s) => s.caption).join(" ");
    expect(captions).toContain("The Asset Operations Manager sees what the repeat calls have cost");
    expect(captions).toContain("Pip alerts the senior manager and the Asset Operations Manager.");
    expect(captions).not.toMatch(/building manager/i);
  });

  it("/how names the seat in full in the approvals, the passes and the brief's answers", () => {
    resetDemo();
    render(<HowStory view={howView(memory.read())} />);
    const approvals = screen.getByTestId("how-approvals");
    expect(approvals.textContent).toContain("Asset Operations Manager, Tower A: Decide charge");
    expect(approvals.textContent).not.toMatch(/\bAOM\b/);
    expect(screen.getByTestId("how-passes").textContent).not.toMatch(/\bAOM\b/);
    expect(document.body.textContent).toContain("The Asset Operations Manager watches the impact meter");
    expect(document.body.textContent).not.toMatch(/building manager|working name/i);
  });
});

describe("D4: the video player", () => {
  it("with the file there: a player with controls, only the length loaded, a poster frame and the mp4", () => {
    const { container } = render(<VideoPlayer available />);
    expect(screen.getByRole("heading", { name: VIDEO_TITLE }).textContent).toBe("Watch the 6-minute video");
    const video = container.querySelector("video")!;
    expect(video).not.toBeNull();
    expect(video.hasAttribute("controls")).toBe(true);
    expect(video.getAttribute("preload")).toBe("metadata");
    expect(video.getAttribute("poster")).toBe("/media/pill-desk-poster.jpg");
    expect(video.querySelector("source")!.getAttribute("src")).toBe("/media/pill-desk-video.mp4");
    expect(video.querySelector("source")!.getAttribute("type")).toBe("video/mp4");
    expect(screen.queryByTestId("video-missing")).toBeNull();
  });

  it("with the file missing: one plain line and no player", () => {
    const { container } = render(<VideoPlayer available={false} />);
    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByTestId("video-missing").textContent).toBe("The video is not on this copy of the demo.");
    expect(VIDEO_MISSING).toBe("The video is not on this copy of the demo.");
  });

  it("checks the disk on each call: missing, then there", () => {
    const root = mkdtempSync(join(tmpdir(), "pill-desk-video-"));
    try {
      expect(videoOnDisk(root)).toBe(false);
      mkdirSync(join(root, "public", "media"), { recursive: true });
      writeFileSync(join(root, "public", "media", "pill-desk-video.mp4"), "not a real video");
      expect(videoOnDisk(root)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("the poster frame is a small JPEG in public/media; the video is kept out of git", () => {
    const poster = readFileSync(join(process.cwd(), "public", VIDEO_POSTER));
    expect(poster[0]).toBe(0xff);
    expect(poster[1]).toBe(0xd8);
    expect(poster.length).toBeLessThan(200 * 1024);
    expect(VIDEO_SRC).toBe("/media/pill-desk-video.mp4");
    const ignore = readFileSync(join(process.cwd(), "..", ".gitignore"), "utf-8").split(/\r?\n/);
    expect(ignore).toContain("web/public/media/*.mp4");
    const readme = readFileSync(join(process.cwd(), "public", "media", "README.md"), "utf-8");
    expect(readme).toContain("pill-desk-video.mp4");
    expect(readme).toContain(VIDEO_MISSING);
  });

  it("home, /how and /flow each show the player, read from the disk", () => {
    for (const file of [join("app", "page.tsx"), join("app", "how", "page.tsx"), join("app", "flow", "page.tsx")]) {
      const src = readFileSync(join(process.cwd(), file), "utf-8");
      expect(src, file).toMatch(/<VideoPlayer available=\{videoOnDisk\(\)\} \/>/);
    }
  });
});
