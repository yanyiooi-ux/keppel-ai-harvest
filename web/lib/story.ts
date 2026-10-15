/**
 * Story mode at /demo (D2): the demo as 8 steps, each with a short plain
 * caption, and the code that presses one step's buttons.
 *
 * Story mode drives the real app. A step's presses are the ones
 * web/tests/demo-flow.test.ts makes, in its order and with its payloads, and
 * they go through the same routes every seat uses (POST /api/reset,
 * /api/action and /api/chat, then GET /api/state). Nothing is pre-rendered or
 * recorded. Every number and claim in a caption is checked against the
 * engine's state right after that step (tests/d2-story.test.ts): if they ever
 * differ, the caption is wrong, never the engine.
 *
 * Pure and safe in the browser: it imports only types, the demo's own words
 * and the plain-words layer. The player (components/story/StoryPlayer.tsx)
 * hands in a port that calls the routes; the test hands in one that calls the
 * route code directly.
 */

import { DEMO_FIX_LINE, DEMO_WHY_LINE } from "./demo-words";
import { AI_MODE_HINTS, effectWord, factWord } from "./plain-words";
import type { SeatId } from "./permissions";
import type { SeatCard, SeatView } from "./seat-view";

/** The job the story follows: Tower A, Level 23, core. */
export const STORY_JOB = "2318";

/** One press, as a seat would make it. */
export type StoryPress =
  | { kind: "reset"; label: string }
  | {
      kind: "action";
      seat: SeatId;
      action: string;
      /** The job, or "report": the job the tenant's report made (the self-check's answers go there). */
      job?: string;
      payload?: Record<string, unknown>;
      /**
       * Filled in from what the app said, never made up: "open-charge" is the
       * building manager's open charge request on the job; "red-stop" is the
       * stop the typed words brought up.
       */
      needs?: "open-charge" | "red-stop";
      label: string;
    }
  | { kind: "chat"; seat: SeatId; text: string; job: string; label: string };

/** What to outline on the seat's screen once the step has run: the first match, or the last. */
export interface StoryFocus {
  selector: string;
  /** Only an element whose text has these words. */
  text?: string;
  last?: boolean;
}

export interface StoryStep {
  n: number;
  /** The seat that acts, and whose screen shows. */
  seat: SeatId;
  title: string;
  caption: string;
  presses: StoryPress[];
  /** What changed in this step: outlined on screen, and the page scrolls to the first. */
  focus: StoryFocus[];
}

const ANSWERS: [string, string][] = [
  ["Q0", "No"],
  ["Q1", "Open area near the lift core"],
  ["Q2", "It keeps coming back"],
  ["Q3", "Yes"],
  ["Q4-thermostat", "Not sure"],
];

/** The cause labels the screen shows (web/data/causes.json); a test checks they still match. */
const PRECOOL = "Morning start-up runs too cold";
const MIN_AIRFLOW = "Core box held at minimum airflow";
const THERMOSTAT = "Thermostat in the wrong spot after a fit-out";

/** The building manager's reason, word for word as demo-flow types it. */
const CHARGE_REASON = "Fit-out work is the tenant's own";

export const STORY: StoryStep[] = [
  {
    n: 1,
    seat: "tenant",
    title: "The tenant reports it",
    caption:
      "A tenant on Level 23 says it is too cold. Before anyone visits, Pip asks 5 quick questions, safety first. Then a visit is booked.",
    presses: [
      { kind: "reset", label: "Reset the demo to its made-up start" },
      { kind: "action", seat: "tenant", action: "report", payload: { complaint: "too cold" }, label: "Report a problem: Too cold" },
      ...ANSWERS.map(
        ([questionId, answer]): StoryPress => ({
          kind: "action",
          seat: "tenant",
          action: "answer",
          job: "report",
          payload: { questionId, answer },
          label: questionId === "Q0" ? `Is anything unsafe? Answer "${answer}"` : `Answer "${answer}"`,
        })
      ),
    ],
    focus: [{ selector: ".msg", last: true }],
  },
  {
    n: 2,
    seat: "technician",
    title: "The technician opens the job",
    caption:
      "The technician opens the job. Pip has already filled in the history: this spot called 5 times in 21 days. The 4 earlier fixes were all a turn of the dial, and every one came back.",
    presses: [{ kind: "action", seat: "technician", action: "open-job", job: STORY_JOB, label: `Open job ${STORY_JOB}` }],
    focus: [
      { selector: ".card", text: "Calls at this spot" },
      { selector: ".card", text: "Past fixes at this spot" },
    ],
  },
  {
    n: 3,
    seat: "technician",
    title: "Two causes ruled out",
    caption:
      "Pip lists the likely causes, best bet first. The technician rules out two, and the list re-ranks at once. The thermostat spot is now on top, but few past cases back it, so Pip tells the senior manager.",
    presses: [
      {
        kind: "action",
        seat: "technician",
        action: "tick",
        job: STORY_JOB,
        payload: { causeId: "precool", type: "not-this" },
        label: `Not this: "${PRECOOL}"`,
      },
      {
        kind: "action",
        seat: "technician",
        action: "tick",
        job: STORY_JOB,
        payload: { causeId: "min-airflow", type: "not-this" },
        label: `Not this: "${MIN_AIRFLOW}"`,
      },
    ],
    focus: [{ selector: '[data-testid="lead-card"]' }, { selector: 'details[data-list="ruled-out"]' }],
  },
  {
    n: 4,
    seat: "technician",
    title: "Not solved, so it goes up",
    caption:
      "Still not fixed. The technician notes the time lost: 3 hours and 2 extra visits. Pip sends the job up to the senior manager with everything attached, so nobody has to ask again.",
    presses: [
      {
        kind: "action",
        seat: "technician",
        action: "not-solved",
        job: STORY_JOB,
        payload: { hoursLost: 3, extraVisits: 2, contractorOrPartsNeeded: false },
        label: "Not solved: 3 hours lost, 2 extra visits, no contractor",
      },
    ],
    focus: [{ selector: ".msg", last: true }],
  },
  {
    n: 5,
    seat: "senior-manager",
    title: "The real cause, and a new rule",
    caption:
      "The senior manager finds the real cause: since the renovation, the thermostat sits in the wrong spot. The AI drafts the new rule from a saved real answer. The senior manager checks each part. All 23 tests pass, so it goes to head office.",
    presses: [
      {
        kind: "action",
        seat: "senior-manager",
        action: "tick",
        job: STORY_JOB,
        payload: { causeId: "thermostat-spot", type: "found" },
        label: `Found it: "${THERMOSTAT}"`,
      },
      {
        kind: "action",
        seat: "senior-manager",
        action: "log-new-solution",
        job: STORY_JOB,
        payload: { fixLine: DEMO_FIX_LINE, whyLine: DEMO_WHY_LINE },
        label: "Write the new fix in the demo's own words",
      },
      {
        kind: "action",
        seat: "senior-manager",
        action: "confirm-part",
        job: STORY_JOB,
        payload: { part: "rule-text", value: DEMO_FIX_LINE },
        label: "Confirm the rule's words",
      },
      {
        kind: "action",
        seat: "senior-manager",
        action: "confirm-part",
        job: STORY_JOB,
        payload: { part: "fact", value: "fit-out-12m" },
        label: `Confirm when it applies: ${factWord("fit-out-12m")}`,
      },
      {
        kind: "action",
        seat: "senior-manager",
        action: "confirm-part",
        job: STORY_JOB,
        payload: { part: "effect-1", value: "block:25" },
        label: `Confirm what it changes: ${effectWord("block:25")}`,
      },
      {
        kind: "action",
        seat: "senior-manager",
        action: "confirm-part",
        job: STORY_JOB,
        payload: { part: "effect-2", value: "put-first:21" },
        label: `Confirm what it changes: ${effectWord("put-first:21")}`,
      },
      { kind: "action", seat: "senior-manager", action: "run-tests", job: STORY_JOB, label: "Run the tests" },
      { kind: "action", seat: "senior-manager", action: "send-to-hq", job: STORY_JOB, label: "Send it to head office" },
    ],
    focus: [{ selector: '[data-testid="solution-card"]' }],
  },
  {
    n: 6,
    seat: "hq",
    title: "Head office approves it once",
    caption:
      "Head office approves it once. Every building now runs version 1.1 at the same time. Building B now checks the thermostat first.",
    presses: [
      { kind: "action", seat: "hq", action: "approve-solution", job: STORY_JOB, label: "Approve and send to all buildings" },
    ],
    focus: [{ selector: '[data-testid="hq-payoff"]' }, { selector: '[data-testid="hq-building-b"]' }],
  },
  {
    n: 7,
    seat: "aom-tower-a",
    title: "Who pays?",
    caption:
      "The building manager sees what the repeat calls have cost: S$600 so far. Moving the thermostat is work on the tenant's renovation, so the manager decides the tenant pays a made-up S$350.",
    presses: [
      {
        kind: "action",
        seat: "aom-tower-a",
        action: "decide-charge",
        job: STORY_JOB,
        payload: { choice: "tenant-pays", amount: 350, reason: CHARGE_REASON },
        needs: "open-charge",
        label: "Decide who pays: the tenant, a made-up S$350",
      },
    ],
    focus: [{ selector: '[data-testid="aom-meter"]' }, { selector: '[data-testid^="aom-charge-"]' }],
  },
  {
    n: 8,
    seat: "tenant",
    title: "Safety comes first",
    caption:
      'Safety always comes first. Typing "water dripping near the lights" brings up the stop in the building\'s own approved words. No AI is used. One press raises the stop and locks work on that floor.',
    presses: [
      {
        kind: "chat",
        seat: "tenant",
        text: "water dripping near the lights",
        job: STORY_JOB,
        label: 'Type "water dripping near the lights"',
      },
      { kind: "action", seat: "tenant", action: "safety-pick", needs: "red-stop", label: "Raise this stop" },
    ],
    focus: [
      { selector: ".sent", last: true },
      { selector: ".card.is-red", last: true },
    ],
  },
];

/** The last words, the same as /how's footer (S22). */
export const STORY_CLOSE =
  "The checklist finds it faster, people approve only what matters, and every fix makes the next one faster.";

/** The gap after a press's result lands, so a viewer sees each change before the next press. */
export const STORY_PRESS_PACE_MS = 700;

/** About how long the whole story plays, checked against the holds and the presses by a test. */
export const STORY_LINK_MINUTES = 2;

/** The link on home and /how. */
export const STORY_LINK_WORDS = `Watch the ${STORY_LINK_MINUTES}-minute story`;

// ---- Lines the page says ----

export const STORY_REAL_LINE =
  "This is the real app playing itself, not a video. Each step presses the same buttons you can press.";

export const STORY_AI_LINE = `The AI switch is on ${AI_MODE_HINTS.replay}`;

export const STORY_SHARED_LINE =
  "Good to know: every seat shares one demo memory. Restart and Back reset it for anyone else watching, too.";

export const STORY_FOCUS_LINE = "A glowing outline marks what changed in each step.";

/** What a press or a read that failed on the network says: the same words as a seat (SeatChat's NOT_THROUGH). */
export const STORY_NOT_THROUGH = "That did not go through. Check the connection, then try again.";

// ---- Timing ----

const WORD_MS = 250;
const HOLD_MIN_MS = 6000;
const HOLD_MAX_MS = 9000;

/** How long a step stays on screen once its presses are done: 6 to 9 seconds, longer for a longer caption. */
export function storyHoldMs(caption: string): number {
  const words = caption.split(/\s+/).filter(Boolean).length;
  return Math.min(HOLD_MAX_MS, Math.max(HOLD_MIN_MS, words * WORD_MS));
}

/** The step a "?step=" asks for, 1 to 8, or undefined. */
export function storyStepFromQuery(value: string | string[] | undefined): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || !/^[1-9]\d*$/.test(raw)) return undefined;
  const n = Number(raw);
  return n >= 1 && n <= STORY.length ? n : undefined;
}

// ---- Pressing ----

export interface PressResult {
  ok: boolean;
  message: string;
  /** The job a press made or landed on (the tenant's report). */
  jobId?: string;
  /** The cards a typed message brought back. */
  cards?: SeatCard[];
}

/** The routes a story press goes through. The player calls them over HTTP; the test calls the route code. */
export interface StoryPort {
  reset(): Promise<PressResult>;
  action(input: { seat: string; action: string; job?: string; payload?: Record<string, unknown> }): Promise<PressResult>;
  chat(input: { seat: string; text: string; job?: string }): Promise<PressResult>;
  view(seat: string): Promise<SeatView>;
}

/** What earlier presses in this run said, for the presses that need it. */
export interface StoryMemo {
  /** The job the tenant's report made. */
  reportJob?: string;
  /** The stop the typed words brought up, and the job they were about. */
  raise?: { stopId: string; jobId?: string };
}

const NO_CHARGE = "There is no charge request waiting for the building manager, so this step cannot go on.";
const NO_STOP = "Pip showed no safety stop to raise, so this step cannot go on.";
const NO_REPORT = "The tenant's report did not make a job, so the answers have nowhere to go.";

/**
 * Makes one press through the port. The self-check's job, the open charge
 * request and the stop to raise are filled in from what the app said in this
 * run, never made up; if the app gave nothing, the press is not made and the
 * reason comes back. A press the app refuses comes back with the app's own
 * reason, and one that never got through says so.
 */
export async function runPress(press: StoryPress, port: StoryPort, memo: StoryMemo): Promise<PressResult> {
  try {
    if (press.kind === "reset") {
      const r = await port.reset();
      memo.reportJob = undefined;
      memo.raise = undefined;
      return r;
    }

    if (press.kind === "chat") {
      const r = await port.chat({ seat: press.seat, text: press.text, job: press.job });
      if (r.ok) {
        const red = (r.cards ?? []).find((c) => c.kind === "red-stop" && c.raiseStopId);
        memo.raise = red ? { stopId: red.raiseStopId!, jobId: red.jobId } : undefined;
      }
      return r;
    }

    let job = press.job;
    let payload = press.payload ? { ...press.payload } : undefined;
    if (job === "report") {
      if (!memo.reportJob) return { ok: false, message: NO_REPORT };
      job = memo.reportJob;
    }
    if (press.needs === "open-charge") {
      const view = await port.view(press.seat);
      const open = view.aom?.charges.find((c) => c.open && c.jobId === job);
      if (!open) return { ok: false, message: NO_CHARGE };
      payload = { requestId: open.id, ...payload };
    }
    if (press.needs === "red-stop") {
      if (!memo.raise) return { ok: false, message: NO_STOP };
      job = memo.raise.jobId ?? STORY_JOB;
      payload = { stopId: memo.raise.stopId };
    }

    const r = await port.action({ seat: press.seat, action: press.action, job, payload });
    if (r.ok && press.action === "report") memo.reportJob = r.jobId;
    return r;
  } catch {
    return { ok: false, message: STORY_NOT_THROUGH };
  }
}

/** Runs every press of one step in order, and stops at the first that does not go through. */
export async function runStep(
  step: StoryStep,
  port: StoryPort,
  memo: StoryMemo
): Promise<{ ok: boolean; message: string; failedAt?: number }> {
  let message = "";
  for (let i = 0; i < step.presses.length; i++) {
    const r = await runPress(step.presses[i], port, memo);
    if (!r.ok) return { ok: false, message: r.message, failedAt: i };
    message = r.message;
  }
  return { ok: true, message };
}

/** The elements a step outlines on the seat's screen. */
export function storyFocusIn(root: ParentNode, focus: StoryFocus[]): Element[] {
  const out: Element[] = [];
  for (const f of focus) {
    const all = Array.from(root.querySelectorAll(f.selector)).filter((el) => !f.text || (el.textContent ?? "").includes(f.text));
    const pick = f.last ? all.at(-1) : all[0];
    if (pick && !out.includes(pick)) out.push(pick);
  }
  return out;
}
