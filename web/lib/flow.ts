/**
 * D4: "How a job flows", the one-page flow diagram (checked against the app's
 * code on 16 Oct) as data for /flow. Every button, cause, part, status, seat
 * and approval name is read from the constants the app itself uses, so the
 * page cannot drift: CHARGE_CHOICES, PART_TITLES, the causes file, the
 * self-check's answers, SEAT_WORDS, STATUS_WORDS, APPROVAL_WORDS and the
 * story's typed safety words. Button names that live only on a button in a
 * component are checked by tests/d4-flow.test.tsx against that button.
 */

import { loadCauses } from "./causes";
import { CHARGE_CHOICES } from "./charge-flow";
import { PART_IDS, PART_TITLES } from "./senior-manager-flow";
import { SELF_CHECK_QUESTIONS } from "./self-check";
import { AOM_NAME, APPROVAL_WORDS, SEAT_WORDS, STATUS_WORDS, type ApprovalId } from "./plain-words";
import { STORY } from "./story";
import type { SeatId } from "./permissions";

/** A run of plain words, a button's name (drawn as a quiet button), or words the person types. */
export type FlowBit = { text: string } | { button: string } | { typed: string };

export interface FlowSeat {
  id: SeatId;
  name: string;
  does: string;
}

export interface FlowStep {
  /** "bar" is the top bar; "stop" is the safety step. */
  kind: "bar" | "seat" | "stop";
  who: string;
  sub: string;
  does: FlowBit[];
  approval?: ApprovalId;
  /** Who gets told next, or null. */
  next: string | null;
}

export interface FlowNode {
  title: FlowBit;
  line: string;
  tone: "seat" | "ok" | "approval" | "plain";
  approval?: ApprovalId;
}

export interface FlowBranch {
  when: string;
  first: FlowNode;
  then: FlowNode;
}

export interface FlowTree {
  root: FlowNode;
  branches: FlowBranch[];
  note: string;
}

export interface FlowView {
  seats: FlowSeat[];
  steps: FlowStep[];
  technician: FlowTree;
  senior: FlowTree;
  approvals: { id: ApprovalId; title: string; line: string }[];
  know: { head: string; line: string }[];
  safety: FlowBit[][];
  thirtyDay: FlowNode[];
}

/** The page's sections, in order, with their anchors. */
export const FLOW_SECTIONS = [
  { id: "seats", title: "The five seats" },
  { id: "demo", title: "The demo path, step by step" },
  { id: "tech", title: "If the technician solves it" },
  { id: "senior", title: "If the senior manager can't solve it" },
  { id: "approvals", title: "The four approvals" },
  { id: "know", title: "How everyone knows what is next" },
  { id: "safety", title: "Safety comes first" },
  { id: "rule30", title: "The 30-day rule" },
] as const;

/** The demo's job, the one every seat works on. */
export const FLOW_JOB = "2318";

const t = (text: string): FlowBit => ({ text });
const b = (button: string): FlowBit => ({ button });

function causeLabel(id: string): string {
  return loadCauses().causes.find((c) => c.id === id)?.label ?? id;
}

function answer(questionId: string, index: number): string {
  return SELF_CHECK_QUESTIONS.find((q) => q.id === questionId)?.answers[index] ?? "";
}

/** What the tenant types in Story mode's safety step, word for word. */
export function safetyWords(): string {
  for (const step of STORY) {
    for (const press of step.presses) {
      if (press.kind === "chat" && press.seat === "tenant") return press.text;
    }
  }
  return "";
}

const SENIOR = SEAT_WORDS["senior-manager"];
const HQ = SEAT_WORDS.hq;

export function flowView(): FlowView {
  const precool = causeLabel("precool");
  const minAirflow = causeLabel("min-airflow");
  const thermostat = causeLabel("thermostat-spot");
  const [tenantPays, landlordPays, goodwill] = CHARGE_CHOICES.map((c) => c.label);
  const answers = [answer("Q0", 1), answer("Q1", 0), answer("Q2", 2), answer("Q3", 0), answer("Q4-thermostat", 2)];
  const parts = PART_IDS.map((id) => PART_TITLES[id]).join(", ");
  const typed = safetyWords();

  const watch: FlowNode = { title: t("30-day watch"), line: "No repeat call in 30 days means a win", tone: "ok" };

  return {
    seats: [
      { id: "tenant", name: SEAT_WORDS.tenant, does: "Reports the problem" },
      { id: "technician", name: SEAT_WORDS.technician, does: "Checks the causes on site" },
      { id: "senior-manager", name: SENIOR, does: "Finds the real cause" },
      { id: "hq", name: HQ, does: "Owns the rule book" },
      { id: "aom-tower-a", name: AOM_NAME, does: "Decides who pays" },
    ],

    steps: [
      {
        kind: "bar",
        who: "Top bar",
        sub: "start fresh",
        does: [t("Press "), b("Reset demo"), t(" to start the story from the beginning.")],
        next: null,
      },
      {
        kind: "seat",
        who: `1 · ${SEAT_WORDS.tenant}`,
        sub: "reports the problem",
        does: [b("Report a problem"), t(" then "), b("Too cold"), t(". Answer the 5 safe questions: "), ...answers.map(b), t(".")],
        next: `The ${SEAT_WORDS.technician.toLowerCase()} sees job ${FLOW_JOB} marked "${STATUS_WORDS["visit-booked"]}", with the answers attached.`,
      },
      {
        kind: "seat",
        who: `2 · ${SEAT_WORDS.technician}`,
        sub: "checks the causes",
        does: [
          b("Open job"),
          t(` on ${FLOW_JOB}: the checklist is already filled in. Press `),
          b("Not this"),
          t(` on "${precool}", then on "${minAirflow}". The list of likely causes re-ranks.`),
        ],
        next: `The ${SENIOR.toLowerCase()} gets a note: Pip is not sure about the new top cause.`,
      },
      {
        kind: "seat",
        who: `3 · ${SEAT_WORDS.technician}`,
        sub: "sends it up",
        does: [
          b("Not solved"),
          t(": fill in the hours lost, the extra visits, and if a contractor or parts are needed. Then "),
          b("Send to the senior manager"),
          t("."),
        ],
        next: `The ${SENIOR.toLowerCase()} sees it under "Jobs with you", with everything attached. Its status: "${STATUS_WORDS.escalated}".`,
      },
      {
        kind: "seat",
        who: `4 · ${SENIOR}`,
        sub: "writes the new rule",
        does: [
          b("Found it"),
          t(` on "${thermostat}". `),
          b("Log new solution"),
          t(": type the fix line and the why line, then "),
          b("Log it"),
          t(". The AI drafts the rule. "),
          b("Confirm"),
          t(` each of the 4 parts (${parts}). `),
          b("Run tests"),
          t(" (all 23 that apply pass), then "),
          b("Send to HQ"),
          t("."),
        ],
        next: `${HQ} sees it under "New fixes for you to approve".`,
      },
      {
        kind: "seat",
        who: `5 · ${HQ}`,
        sub: "approves once",
        does: [b("Approve and send to all buildings")],
        approval: "A2",
        next: `Every building moves to version 1.1 of the rule book. Building B now checks where the thermostat sits first. The ${AOM_NAME} gets the question of who pays, marked "Waits on you".`,
      },
      {
        kind: "seat",
        who: `6 · ${AOM_NAME}`,
        sub: "decides who pays",
        does: [
          t("Pick "),
          b(tenantPays),
          t(" (type an amount), "),
          b(landlordPays),
          t(" or "),
          b(goodwill),
          t(". Write a reason of 3 words or more, then "),
          b("Decide charge"),
          t("."),
        ],
        approval: "A4",
        next: `The ${SEAT_WORDS.tenant.toLowerCase()}'s chat gets one card: "What we will do".`,
      },
      {
        kind: "stop",
        who: `Any time · ${SEAT_WORDS.tenant}`,
        sub: "safety",
        does: [
          t("Type "),
          { typed },
          t(". The stop shows in the building's own approved words. No AI is used. Then "),
          b("Raise this stop"),
          t("."),
        ],
        next: `The ${SENIOR.toLowerCase()} and the ${AOM_NAME} get a safety alert. Raise this stop locks the jobs on that floor.`,
      },
    ],

    technician: {
      root: { title: t(`${SEAT_WORDS.technician} opens the job`), line: "Checks the likely causes", tone: "seat" },
      branches: [
        {
          when: "Fixed it, and the fix is theirs to do",
          first: { title: b("Solved"), line: "Writes one line of why", tone: "ok" },
          then: watch,
        },
        {
          when: "Found it, but someone else must fix it",
          first: { title: b("Send with the cause"), line: "Passes the cause up", tone: "plain" },
          then: { title: t(SENIOR), line: "Gets the cause", tone: "seat" },
        },
        {
          when: "Can't find it",
          first: { title: b("Not solved"), line: "Adds the hours, visits and cost", tone: "plain" },
          then: { title: t(SENIOR), line: "Gets everything attached", tone: "seat" },
        },
      ],
      note: "Solved needs no approval. The app only allows it when the found cause is a fix the technician may do. If not, the button to use is Send with the cause.",
    },

    senior: {
      root: { title: t(SENIOR), line: "The job came up to them", tone: "seat" },
      branches: [
        {
          when: "Fixed it",
          first: { title: b("Solved"), line: "Writes one line of why", tone: "ok" },
          then: watch,
        },
        {
          when: "Found the real cause",
          first: { title: b("Log new solution"), line: "A new rule, tested", tone: "plain" },
          then: {
            title: t(`${HQ}: approve or decline`),
            line: "Approve: every building updates. Decline: back to the senior manager.",
            tone: "approval",
            approval: "A2",
          },
        },
        {
          when: "Needs a contractor or money",
          first: { title: b("Ask HQ for outside help"), line: "Says what, why, and if it needs money", tone: "plain" },
          then: {
            title: t(`${HQ}: approve or decline`),
            line: "Either way, the job comes back to the senior manager.",
            tone: "approval",
            approval: "A3",
          },
        },
      ],
      note: 'Once a job is with the senior manager, it stays with them until it closes. No button sends it back to the technician. When it comes back from head office, the note says "The job is back with you". After the contractor fixes it, the senior manager presses Solved, and the 30-day watch starts. No dollar amount ever goes into the text: head office decides money.',
    },

    approvals: [
      { id: "A1", title: APPROVAL_WORDS.A1, line: "Two senior experts signed version 1 of the rule book. This is done before the demo starts." },
      {
        id: "A2",
        title: APPROVAL_WORDS.A2,
        line: "Head office approves a new rule once, after its tests pass. Every building gets it at the same moment, and one press rolls it back.",
      },
      { id: "A3", title: APPROVAL_WORDS.A3, line: "Head office says yes or no to what the senior manager asked for." },
      { id: "A4", title: APPROVAL_WORDS.A4, line: `The ${AOM_NAME} decides, with a reason. The tenant gets one card.` },
    ],

    know: [
      {
        head: "A status word on every job.",
        line: `"${STATUS_WORDS["visit-booked"]}", "${STATUS_WORDS.escalated}", "Waits on you", "${STATUS_WORDS["pending-30-day"]}". Every seat sees the same job and its status.`,
      },
      { head: '"Jobs with you".', line: 'Anything waiting for a person lands in their own list. The "What needs me" button shows it too.' },
      {
        head: "Notes sent by code.",
        line: "A spot that keeps calling, a cause Pip is not sure about, and every safety alert go straight to the right person.",
      },
      {
        head: "The live version.",
        line: "Head office's card shows which rule book each building runs: version 1.0 before the approval, 1.1 after.",
      },
    ],

    safety: [
      [
        t("If the tenant types words like "),
        { typed },
        t(", Pip shows the stop in the building's own approved words, with who to call. No AI is used, so the words never drift."),
      ],
      [
        t(`Typing only warns: the ${SENIOR.toLowerCase()} and the ${AOM_NAME} get an alert. Pressing `),
        b("Raise this stop"),
        t(" locks the jobs on that floor. Jobs anywhere else carry on."),
      ],
      [t("Only the senior manager can clear the stop.")],
    ],

    thirtyDay: [
      { title: t("No repeat call in 30 days"), line: "The fix counts as a win for that cause", tone: "ok" },
      { title: t("The same spot calls again"), line: "That fix counts against the cause", tone: "plain" },
      { title: t("The fixer can't confirm their own cause"), line: "Only another person can confirm it", tone: "plain" },
    ],
  };
}

/** Every button name the page shows, in page order (the drift test reads it too). */
export function flowButtons(view: FlowView = flowView()): string[] {
  const out: string[] = [];
  const take = (bits: FlowBit[]) => bits.forEach((bit) => ("button" in bit ? out.push(bit.button) : null));
  view.steps.forEach((s) => take(s.does));
  for (const tree of [view.technician, view.senior]) {
    take([tree.root.title]);
    tree.branches.forEach((br) => take([br.first.title, br.then.title]));
  }
  view.safety.forEach(take);
  return out;
}
