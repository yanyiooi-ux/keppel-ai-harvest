// @vitest-environment jsdom

/**
 * D4: /flow, "How a job flows". The page is the one-page flow diagram in the
 * app's own look. Its button names must be the app's real button names, so a
 * renamed button fails here: every name drawn as a button on /flow is checked
 * against the text of a real <button> in the app's components (read with the
 * TypeScript parser) or a label in the constants the buttons are drawn from.
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import ts from "typescript";
import { FlowView } from "../app/components/flow/FlowView";
import { VideoPlayer } from "../app/components/VideoPlayer";
import { FLOW_SECTIONS, flowButtons, flowView, safetyWords } from "../lib/flow";
import { FLOW_LINK_WORDS } from "../lib/flow-words";
import { CHARGE_CHOICES } from "../lib/charge-flow";
import { CHIPS_BY_SEAT } from "../lib/chat";
import { PART_TITLES } from "../lib/senior-manager-flow";
import { SELF_CHECK_QUESTIONS } from "../lib/self-check";
import { loadCauses } from "../lib/causes";
import { STORY, STORY_LINK_WORDS } from "../lib/story";
import { AOM_NAME, SEAT_WORDS, STATUS_WORDS } from "../lib/plain-words";

afterEach(() => cleanup());

const APP = join(process.cwd(), "app");

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...tsxFiles(p));
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/** The words on every real <button> in the app, and every `label: "..."` a button list is drawn from. */
function realButtonLabels(skip: string[]): Set<string> {
  const labels = new Set<string>();
  const add = (s: string) => {
    const v = s.replace(/\s+/g, " ").trim();
    if (v) labels.add(v);
  };
  for (const file of tsxFiles(APP)) {
    if (skip.some((s) => file.includes(s))) continue;
    const src = ts.createSourceFile(file, readFileSync(file, "utf-8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const strings = (node: ts.Node) => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) add(node.text);
      ts.forEachChild(node, strings);
    };
    const visit = (node: ts.Node) => {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(src) === "button") {
        let whole = "";
        for (const child of node.children) {
          if (ts.isJsxText(child)) {
            add(child.text);
            whole += child.text;
          } else if (ts.isJsxExpression(child) && child.expression) {
            strings(child.expression);
          }
        }
        add(whole);
      }
      if (ts.isPropertyAssignment(node) && node.name.getText(src) === "label" && ts.isStringLiteral(node.initializer)) {
        add(node.initializer.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(src);
  }
  for (const c of CHARGE_CHOICES) add(c.label);
  for (const q of SELF_CHECK_QUESTIONS) q.answers.forEach(add);
  // The chips each seat draws as buttons with their own name (SeatChat); "Dial?" is drawn under a longer label.
  for (const chips of Object.values(CHIPS_BY_SEAT)) chips.filter((c) => c !== "Dial?").forEach(add);
  return labels;
}

function renderFlow() {
  return render(<FlowView flow={flowView()} video={<VideoPlayer available={false} />} />);
}

describe("D4: every button name on /flow is a real button in the app", () => {
  // The flow page's own files are left out, so a name cannot vouch for itself.
  const real = realButtonLabels([join("components", "flow"), join("app", "flow")]);

  it("reads the real buttons from the components", () => {
    for (const name of ["Open job", "Not this", "Found it", "Solved", "Send with the cause", "Not solved", "Decide charge", "Reset demo"]) {
      expect(real.has(name), name).toBe(true);
    }
    // The bite: a name no button has is not in the set.
    expect(real.has("Approve all")).toBe(false);
    expect(real.has("Send to head office")).toBe(false);
  });

  it("checks every button name the page draws", () => {
    const { container } = renderFlow();
    const drawn = Array.from(container.querySelectorAll("[data-button]")).map((el) => (el.textContent ?? "").trim());
    expect(drawn.length).toBeGreaterThanOrEqual(30);
    expect(drawn).toEqual(flowButtons());
    const missing = [...new Set(drawn)].filter((name) => !real.has(name));
    expect(missing, `not a real button: ${missing.join(" | ")}`).toEqual([]);
  });

  it("a renamed button fails the check", () => {
    const view = flowView();
    view.steps[4].does = [{ button: "Send to head office" }];
    const drawn = flowButtons(view);
    expect(drawn.filter((name) => !real.has(name))).toEqual(["Send to head office"]);
  });

  it("takes the charge choices, the 5 answers and the 4 parts from the code", () => {
    renderFlow();
    for (const c of CHARGE_CHOICES) expect(screen.getAllByText(c.label).length).toBeGreaterThanOrEqual(1);
    const answers = [["Q0", 1], ["Q1", 0], ["Q2", 2], ["Q3", 0], ["Q4-thermostat", 2]] as const;
    for (const [id, i] of answers) {
      const word = SELF_CHECK_QUESTIONS.find((q) => q.id === id)!.answers[i];
      expect(screen.getAllByText(word).length, word).toBeGreaterThanOrEqual(1);
    }
    const parts = Object.values(PART_TITLES).join(", ");
    expect(document.body.textContent).toContain(`each of the 4 parts (${parts})`);
  });

  it("names the three causes as the causes file does", () => {
    renderFlow();
    const text = document.body.textContent ?? "";
    const causes = loadCauses().causes;
    for (const id of ["precool", "min-airflow", "thermostat-spot"]) {
      const label = causes.find((c) => c.id === id)!.label;
      expect(text, id).toContain(`"${label}"`);
    }
  });

  it("the safety words are the ones Story mode types", () => {
    const typed = STORY.flatMap((s) => s.presses).find((p) => p.kind === "chat")!;
    expect(typed.kind === "chat" && typed.text).toBe(safetyWords());
    renderFlow();
    expect(screen.getAllByText(safetyWords()).length).toBe(2);
  });
});

describe("D4: the page's sections and words", () => {
  it("has the 8 sections of the diagram in order, each linked from the list at the top", () => {
    renderFlow();
    const heads = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(heads).toEqual(["Watch the 6-minute video", ...FLOW_SECTIONS.map((s) => s.title)]);
    const toc = screen.getByRole("navigation", { name: "On this page" });
    expect(within(toc).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(FLOW_SECTIONS.map((s) => `#${s.id}`));
  });

  it("names the five seats as the app does, the Asset Operations Manager included", () => {
    renderFlow();
    const seats = document.querySelectorAll(".flow-seats b");
    expect(Array.from(seats).map((b) => b.textContent)).toEqual([
      SEAT_WORDS.tenant,
      SEAT_WORDS.technician,
      SEAT_WORDS["senior-manager"],
      SEAT_WORDS.hq,
      AOM_NAME,
    ]);
    expect(document.body.textContent).not.toMatch(/\bAOM\b|building manager|working name/i);
  });

  it("shows the job statuses in the app's own words", () => {
    renderFlow();
    const text = document.body.textContent ?? "";
    for (const s of ["visit-booked", "escalated", "pending-30-day"] as const) expect(text).toContain(`"${STATUS_WORDS[s]}"`);
  });

  it("marks each approval with its word and code, A2 and A4 on the demo path", () => {
    const { container } = renderFlow();
    const steps = Array.from(container.querySelectorAll(".flow-step"));
    expect(steps).toHaveLength(8);
    const marks = steps.map((s) => s.querySelector(".flow-approval")?.textContent ?? null);
    expect(marks).toEqual([null, null, null, null, null, "Approval A2", "Approval A4", null]);
    const cards = Array.from(container.querySelectorAll(".flow-card .flow-approval")).map((a) => a.textContent);
    expect(cards).toEqual(["Approval A1", "Approval A2", "Approval A3", "Approval A4"]);
  });

  it("links to Story mode and to /how", () => {
    renderFlow();
    expect(screen.getByRole("link", { name: STORY_LINK_WORDS }).getAttribute("href")).toBe("/demo");
    expect(screen.getByRole("link", { name: "How it works, for judges" }).getAttribute("href")).toBe("/how");
  });

  it("is linked from home, /how and /demo", () => {
    for (const file of [join(APP, "page.tsx"), join(APP, "components", "how", "HowStory.tsx"), join(APP, "demo", "page.tsx")]) {
      const src = readFileSync(file, "utf-8");
      expect(src, file).toMatch(/href="\/flow">\{FLOW_LINK_WORDS\}</);
    }
    expect(FLOW_LINK_WORDS).toBe("See how a job flows, on one page");
  });
});
