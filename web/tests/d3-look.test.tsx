// @vitest-environment jsdom

/**
 * D3: the dark glass look and Bolt Pip.
 *
 * The picked sample (dark-glass-ref.html) is the spec: its :root tokens, frosted
 * panels, tinted pills, the white main action and a soft red glow on safety
 * cards. These tests read the real stylesheet and layout, and render the real
 * Pip, so a look that drifts from the sample or loses contrast fails here.
 */

import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { render, cleanup } from "@testing-library/react";
import { PipAvatar } from "../app/components/PipAvatar";

const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf-8");
const layout = readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf-8");
const root = css.slice(css.indexOf(":root"), css.indexOf("}", css.indexOf(":root")) + 1);

afterEach(() => cleanup());

/** A token's raw value from :root, matched on its whole name. */
function token(name: string): string {
  const m = new RegExp(`(?<![\\w-])--${name}:\\s*([^;]+);`).exec(root);
  if (!m) throw new Error(`no token --${name} in :root`);
  return m[1].trim();
}

type Rgba = { r: number; g: number; b: number; a: number };

function parse(value: string): Rgba {
  const hex = /^#([0-9a-fA-F]{6})$/.exec(value);
  if (hex) {
    const n = hex[1];
    return { r: parseInt(n.slice(0, 2), 16), g: parseInt(n.slice(2, 4), 16), b: parseInt(n.slice(4, 6), 16), a: 1 };
  }
  const rgba = /^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)$/.exec(value);
  if (rgba) return { r: +rgba[1], g: +rgba[2], b: +rgba[3], a: +rgba[4] };
  throw new Error(`not a hex or rgba colour: ${value}`);
}

/** Lays a see-through colour over a solid one, as the screen shows it. */
function over(top: Rgba, under: Rgba): Rgba {
  const mix = (t: number, u: number) => Math.round(t * top.a + u * (1 - top.a));
  return { r: mix(top.r, under.r), g: mix(top.g, under.g), b: mix(top.b, under.b), a: 1 };
}

function contrast(x: Rgba, y: Rgba): number {
  const lum = (c: Rgba) => {
    const ch = (v: number) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
  };
  const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}

/** Every declaration block whose selector list names `selector` exactly. */
function blocks(selector: string): string[] {
  const out: string[] = [];
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bare))) {
    const selectors = m[1].split(",").map((s) => s.trim().replace(/\s+/g, " "));
    if (selectors.includes(selector)) out.push(m[2]);
  }
  return out;
}

describe("D3: the font is Geist, with Inter as the fallback", () => {
  it("loads Geist from next/font and no longer loads Chakra Petch", () => {
    expect(layout).toMatch(/import\s*\{[^}]*\bGeist\b[^}]*\}\s*from\s*"next\/font\/google"/);
    expect(layout).not.toMatch(/Chakra/);
    expect(css).not.toMatch(/Chakra/);
  });

  it("puts Geist first and Inter after it in the font tokens", () => {
    const font = token("font");
    expect(font.indexOf("--font-geist")).toBeGreaterThan(-1);
    expect(font.indexOf("--font-geist")).toBeLessThan(font.indexOf("Inter"));
    expect(token("font-head")).toBe("var(--font)");
    expect(token("head-weight")).toBe("500");
    expect(token("hud-case")).toBe("none");
  });
});

describe("D3: the sample's tokens are the look", () => {
  it("carries the dark glass values from the picked sample", () => {
    expect(token("bg")).toBe("#08090c");
    expect(token("panel")).toBe("rgba(22, 23, 29, 0.62)");
    expect(token("panel-2")).toBe("rgba(255, 255, 255, 0.035)");
    expect(token("line")).toBe("rgba(255, 255, 255, 0.08)");
    expect(token("line-2")).toBe("rgba(255, 255, 255, 0.14)");
    expect(token("text")).toBe("#ececef");
    expect(token("muted")).toBe("#8e909b");
    expect(token("body")).toBe("#c9cad1");
    expect(token("violet")).toBe("#8b8cf6");
    expect(token("green")).toBe("#4ade80");
    expect(token("amber")).toBe("#fbbf24");
    expect(token("red")).toBe("#f87171");
    expect(token("r-card")).toBe("22px");
  });

  it("lights the background with a soft violet light in the top-left corner", () => {
    expect(token("light-violet")).toBe("rgba(110, 112, 210, 0.38)");
    expect(token("bg-light")).toMatch(/^radial-gradient\(.*at 12% .*var\(--light-violet\)/);
    const body = blocks("body").join("\n");
    expect(body).toMatch(/background-image:\s*var\(--bg-light\)/);
    expect(body).not.toMatch(/--grid/);
  });

  it("draws a card as a frosted panel with a hairline border and a 22 px radius", () => {
    const card = blocks(".card").join("\n");
    expect(card).toMatch(/background:\s*var\(--panel\)/);
    expect(card).toMatch(/border:\s*1px solid var\(--line\)/);
    expect(card).toMatch(/border-radius:\s*var\(--r-card\)/);
  });
});

describe("D3: pills, buttons and safety", () => {
  it("tints each status pill in its own colour", () => {
    expect(token("g-bg")).toBe("var(--green-bg)");
    expect(token("a-bg")).toBe("var(--amber-bg)");
    expect(blocks(".badge.green").join("\n")).toMatch(/background:\s*var\(--g-bg\)/);
    expect(blocks(".badge.amber").join("\n")).toMatch(/background:\s*var\(--a-bg\)/);
    expect(blocks(".badge.red").join("\n")).toMatch(/background:\s*var\(--red-bg\)/);
    expect(blocks(".badge").join("\n")).toMatch(/border-radius:\s*var\(--r-pill\)/);
  });

  it("makes the main action a white button with near-black text", () => {
    expect(token("main")).toBe("#f4f4f6");
    expect(token("main-ink")).toBe("#0a0a0c");
    for (const sel of [".main-action", ".send", ".job-form .submit"]) {
      const rule = blocks(sel).join("\n");
      expect(rule, sel).toMatch(/background:\s*var\(--main\)/);
      expect(rule, sel).toMatch(/color:\s*var\(--main-ink\)/);
    }
    expect(contrast(parse(token("main-ink")), parse(token("main")))).toBeGreaterThanOrEqual(4.5);
  });

  it("as in the sample, Found it, Solved, Approve, Confirm and Send to HQ are white and the other choice is quiet glass", () => {
    const white = [".tick-row .found-btn", ".job-bar-buttons .solved-btn", ".job-bar-buttons .send-hq-btn", ".approve-btn", ".confirm-btn"];
    for (const sel of white) {
      const rule = blocks(sel).join("\n");
      expect(rule, sel).toMatch(/background:\s*var\(--main\)/);
      expect(rule, sel).toMatch(/color:\s*var\(--main-ink\)/);
    }
    const glass = [".tick-row .not-btn", ".job-bar-buttons .not-solved-btn", ".job-bar-buttons .help-btn", ".job-bar-buttons .log-btn"];
    for (const sel of glass) {
      const rule = blocks(sel).join("\n");
      expect(rule, sel).toMatch(/background:\s*var\(--btn-bg\)/);
      expect(rule, sel).toMatch(/color:\s*var\(--text\)/);
    }
    // A tint on a button is only for Safety: no other press is green, amber or violet.
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    let checked = 0;
    while ((m = re.exec(bare))) {
      const sel = m[1].trim();
      if (!/btn\b/.test(sel) || /safety-btn/.test(sel)) continue;
      checked += 1;
      expect(m[2], sel).not.toMatch(/var\(--(green|amber|violet)-(bg|line|soft)\)/);
    }
    expect(checked).toBeGreaterThanOrEqual(12);
    // An open form's press shows as on, so the form's white submit is the only white button.
    expect(blocks('.job-bar-buttons button[aria-expanded="true"]').join("\n")).toMatch(/background:\s*var\(--btn-on\)/);
  });

  it("the picked impact meter tab is the only filled one", () => {
    expect(blocks(".meter-tab").join("\n")).toMatch(/background:\s*transparent/);
    expect(blocks('.meter-tab[aria-selected="true"]').join("\n")).toMatch(/background:\s*var\(--btn-on\)/);
  });

  it("a code tag is set in Geist, like every other word", () => {
    expect(token("font-code")).toBe("var(--font)");
    expect(blocks(".code-tag").join("\n")).toMatch(/font-family:\s*var\(--font-code\)/);
  });

  it("gives a safety card a soft red glow", () => {
    expect(token("glow-red")).toMatch(/^radial-gradient\(.*var\(--red-glow\)/);
    expect(token("red-glow")).toMatch(/^rgba\(239, 68, 68, /);
    expect(blocks(".card.is-red").join("\n")).toMatch(/background:\s*var\(--glow-red\),\s*var\(--r-bg\)/);
  });
});

describe("D3: readability first", () => {
  const card = parse(token("card"));
  const bg = parse(token("bg"));
  // The panel where it is brightest: over the violet light at full strength.
  const litPanel = over(parse(token("panel")), over(parse(token("light-violet")), bg));

  it("the opaque card token is the glass panel as it looks over the near-black", () => {
    const glass = over(parse(token("panel")), bg);
    for (const k of ["r", "g", "b"] as const) {
      expect(Math.abs(glass[k] - card[k]), k).toBeLessThanOrEqual(2);
    }
  });

  it("body text and muted labels clear 4.5:1 on a panel, even under the violet light", () => {
    for (const under of [card, litPanel]) {
      expect(contrast(parse(token("body")), under)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(parse(token("muted")), under)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(parse(token("text")), under)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(parse(token("lit")), under)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(parse(token("violet")), under)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("every status word clears 4.5:1 on its own tinted pill", () => {
    const pairs: [string, string][] = [
      ["green", "green-bg"],
      ["amber", "amber-bg"],
      ["red", "red-bg"],
    ];
    for (const [fg, tint] of pairs) {
      for (const under of [card, litPanel]) {
        const pill = over(parse(token(tint)), under);
        expect(contrast(parse(token(fg)), pill), `${fg} on ${tint}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("a safety card's red words clear 4.5:1 inside its red glow", () => {
    const glowed = over(parse(token("red-glow")), parse(token("red-card")));
    for (const fg of ["red", "red-text", "red-muted"]) {
      expect(contrast(parse(token(fg)), glowed), fg).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("the red Stop pill on a safety card clears 4.5:1 even where the glow is strongest", () => {
    // Over the glow at full strength the see-through tint would give about 4.2:1,
    // so this check bites if the pill goes back to a bare tint.
    const glowed = over(parse(token("red-glow")), parse(token("red-card")));
    expect(contrast(parse(token("red")), over(parse(token("red-bg")), glowed))).toBeLessThan(4.5);
    // The pill lays its tint on the solid red card, which hides the glow behind it.
    const rule = blocks(".card.is-red .badge.red").join("\n");
    expect(rule).toMatch(/background:\s*linear-gradient\(var\(--red-bg\),\s*var\(--red-bg\)\),\s*var\(--red-card\)/);
    const pill = over(parse(token("red-bg")), parse(token("red-card")));
    expect(contrast(parse(token("red")), pill)).toBeGreaterThanOrEqual(4.5);
  });

  it("whole sentences use the body grey, never the muted label grey", () => {
    for (const sel of [".card-mean", ".card .meter-label", ".job-status", ".demo-words-line", ".ai-notice", ".ai-switch-hint"]) {
      const rule = blocks(sel).join("\n");
      expect(rule, sel).toMatch(/color:\s*var\(--body\)/);
      expect(rule, sel).not.toMatch(/color:\s*var\(--muted\)/);
    }
    expect(token("body")).toBe("#c9cad1");
  });

  it("a done note is not faded, so its grey code tag keeps 4.5:1", () => {
    const done = blocks(".notice.is-done").join("\n");
    expect(done.length).toBeGreaterThan(0);
    expect(done).not.toMatch(/opacity/);
    expect(contrast(parse(token("muted")), parse(token("card-2")))).toBeGreaterThanOrEqual(4.5);
  });

  it("every seat switcher link is a 44 px touch target, phone included", () => {
    const rules = blocks(".topbar nav a");
    expect(rules.length).toBeGreaterThanOrEqual(1);
    // Every rule for the links, the phone's included, names its own min-height,
    // so a dropped one fails here instead of passing silently.
    for (const rule of rules) {
      const h = /min-height:\s*(\d+)px/.exec(rule);
      expect(h, rule).not.toBeNull();
      expect(Number(h![1])).toBeGreaterThanOrEqual(44);
      expect(rule).not.toMatch(/(^|[^-])height:\s*([0-3]?\d|4[0-3])px/);
    }
  });

  it("the Message Pip box is a 44 px tap target", () => {
    const h = /min-height:\s*(\d+)px/.exec(blocks(".compose input").join("\n"));
    expect(h).not.toBeNull();
    expect(Number(h![1])).toBeGreaterThanOrEqual(44);
  });
});

describe("D3: Pip is Bolt Pip", () => {
  it("draws a glass robot head with a visor, two glowing eyes, a hard hat and side bolts", () => {
    const { container } = render(<PipAvatar />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 100 100");
    expect(svg.getAttribute("aria-label")).toMatch(/Pip/);
    const count = (fill: string, tag = "*") => svg.querySelectorAll(`${tag}[fill="var(--pip-${fill})"]`).length;
    expect(count("head")).toBe(1);
    expect(count("visor")).toBe(1);
    expect(count("eye", "rect")).toBe(2);
    expect(count("eye", "path")).toBe(1);
    // The eyes and the smile glow together: one group with a soft blur in a Pip token.
    const eyes = svg.querySelector("g.pip-eyes")!;
    expect(eyes).not.toBeNull();
    expect(eyes.querySelectorAll('rect[fill="var(--pip-eye)"]')).toHaveLength(2);
    expect(eyes.querySelectorAll('path[fill="var(--pip-eye)"]')).toHaveLength(1);
    expect(blocks(".pip-eyes").join("\n")).toMatch(/filter:\s*drop-shadow\([^;]*var\(--pip-glow\)\)/);
    expect(() => parse(token("pip-glow"))).not.toThrow();
    expect(count("bolt", "circle")).toBe(2);
    expect(count("hat", "path")).toBe(1);
    expect(count("brim")).toBe(1);
  });

  it("every Pip colour is a token in :root holding a hex or an rgba", () => {
    const { container } = render(<PipAvatar size={64} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("64");
    const used = new Set<string>();
    for (const node of Array.from(svg.querySelectorAll("*"))) {
      for (const attr of ["fill", "stroke"]) {
        const v = node.getAttribute(attr);
        if (v === null) continue;
        const m = /^var\(--(pip-[\w-]+)\)$/.exec(v);
        expect(m, `${attr}="${v}"`).not.toBeNull();
        used.add(m![1]);
      }
    }
    expect(used.size).toBeGreaterThanOrEqual(10);
    for (const name of used) {
      expect(() => parse(token(name)), name).not.toThrow();
    }
  });
});
