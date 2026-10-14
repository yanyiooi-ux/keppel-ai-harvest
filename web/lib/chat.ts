/**
 * Typed text and chips (S19).
 *
 * The order is the same in every seat: safety words, then the never-list,
 * then the chip words, then "I did not catch that" with the seat's chips.
 *
 * Typing only adds the message, shows cards and sends alerts. It never opens a
 * red stop, never locks a job, and never changes a status, tick, solution,
 * request, decision, version, case or charge. A typed red card carries a
 * Raise this stop button, and only that press opens the locking stop.
 */

import { loadAndCheckPill } from "./pill";
import { typedSafetyWords, alertsForStop, alertNoticeText } from "./safety";
import { scanNeverList, neverListRefusalCard, hideAmounts } from "./never-list";
import { leadsForJob, dialStanding } from "./leads";
import { safetyList, safetyCardForStop } from "./safety";
import { alertSeatFor } from "./permissions";
import { versionList } from "./versions";
import { spotKey } from "./places";
import { callsForState } from "./calls";
import { impactFor, impactLines } from "./impact";
import { loadImpactRates, impactLine, costLine } from "./impact-rates";
import { AOM_SPOT } from "./aom-desk";
import * as memory from "./memory";
import type { MemoryState, Job, Notice } from "./memory";

export const CHIPS_BY_SEAT: Record<string, string[]> = {
  tenant: ["What needs me", "Show job", "Why?", "Safety"],
  technician: ["What needs me", "Show job", "Why?", "Dial?", "Safety"],
  "senior-manager": ["What needs me", "Show job", "Why?", "Dial?", "Safety"],
  hq: ["What needs me", "Show job", "Why?", "Safety", "Versions"],
  "aom-tower-a": ["What needs me", "Show job", "Why?", "Safety", "Impact"],
};

const CHIP_WORDS: { chip: string; words: string[]; seats?: string[] }[] = [
  { chip: "What needs me", words: ["what needs me", "case study", "today"] },
  { chip: "Show job", words: ["job", "ticket", "open"] },
  { chip: "Why?", words: ["why"] },
  { chip: "Dial?", words: ["dial", "nudge", "bump", "setpoint"] },
  { chip: "Safety", words: ["safety"] },
  { chip: "Impact", words: ["impact"], seats: ["aom-tower-a"] },
  { chip: "Versions", words: ["version", "versions"], seats: ["hq"] },
];

export interface ChatCard {
  kind: "red-stop" | "refusal" | "answer" | "safety-list";
  title?: string;
  body?: string;
  receipt?: string;
  stopId?: string;
  raiseStopId?: string;
  /** A red stop's who_to_call, word for word, shown after "Call:" (S11). */
  call?: string;
  /** The job a typed red card's Raise this stop press goes to: the job the message was typed about. */
  jobId?: string;
  pointer?: string;
  items?: { id: string; title: string; body: string }[];
  /** The lead whose code reason is the body, so the AI may word it (S15 rank-wording). Code text only. */
  rankLead?: { label: string; checkText: string };
  /** Set once the card went through the AI layer (ai-wording.ts). */
  aiJob?: "rank-wording";
  /** The extra "AI wording" line under the code reason. The body always stays. */
  aiWording?: string;
  /** "replay: saved real AI answer" when the wording came from a replay. */
  aiBanner?: string;
  /** "<status> AI unavailable, using replay" when the live call failed. */
  aiNotice?: string;
  /** "AI off" when the switch is Off. */
  aiOff?: string;
  /** Model calls made for this card's wording; its receipt says the same. */
  aiCalls?: number;
}

export interface ChatReply {
  /** The typed text as it is stored and shown: amounts are hidden. */
  storedText: string;
  cards: ChatCard[];
  chips: string[];
  /** Alerts to post for a typed red card. The stop itself stays closed. */
  alerts: { seat: string; text: string; stopId?: string }[];
  matched: "safety" | "never-list" | "chip" | "none";
}

function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function chipFor(seat: string, text: string): string | null {
  const words = wordsOf(text);
  const joined = words.join(" ");
  for (const entry of CHIP_WORDS) {
    if (entry.seats && !entry.seats.includes(seat)) continue;
    if (!(CHIPS_BY_SEAT[seat] ?? []).includes(entry.chip)) continue;
    for (const word of entry.words) {
      if (word.includes(" ") ? joined.includes(word) : words.includes(word)) {
        return entry.chip;
      }
    }
  }
  return null;
}

/**
 * Record a typed message and its answer in the memory: the text as stored (amounts
 * hidden), Pip's cards, and the typed alerts. Call it inside memory.update. It
 * opens no stop and changes no status, tick, version, case or charge (S19).
 * `at` is the demo clock's time now (S20); chat-turn.ts passes it.
 */
export function applyTypedReply(
  state: MemoryState,
  seat: string,
  jobId: string | undefined,
  reply: ChatReply,
  at: string = state.demoNow
): void {
  state.messages.push({
    seat,
    from: "person",
    text: reply.storedText,
    at,
  });
  state.messages.push({
    seat,
    from: "pip",
    text: reply.cards.map((c) => c.body ?? c.title ?? "").join(" "),
    at,
    cards: reply.cards,
  });
  for (const alert of reply.alerts) {
    state.notices.push({
      seat: alert.seat,
      kind: "alert",
      text: alert.text,
      at,
      jobId,
      typed: true,
      stopId: alert.stopId,
    });
  }
}

/**
 * Answer a typed message. Reads the memory, never writes it.
 */
export function handleTyped(
  state: MemoryState,
  seat: string,
  text: string,
  jobId?: string,
  realNow: Date = new Date()
): ChatReply {
  const job = jobId ? memory.jobById(state, jobId) : undefined;
  const building = job?.building ?? "tower-a";
  const version = state.liveVersionByBuilding[building] ?? "1.0";
  const pill = loadAndCheckPill("ts-cc", version);
  const chips = CHIPS_BY_SEAT[seat] ?? [];
  const storedText = hideAmounts(text);

  const safety = typedSafetyWords(text, pill);
  if (safety.matchedStops.length > 0) {
    const cards: ChatCard[] = [];
    const alerts: { seat: string; text: string; stopId: string }[] = [];
    for (const card of safety.matchedStops) {
      // The same words as a pick from the Safety list, its who_to_call included
      // (S11), plus the Raise this stop button's stop and job (S19).
      cards.push({
        kind: "red-stop",
        stopId: card.id,
        title: card.trigger,
        body: card.action,
        call: card.whoToCall,
        receipt: card.receipt,
        raiseStopId: card.id,
        ...(jobId ? { jobId } : {}),
      });
      const stop = safetyList(pill).find((s) => s.id === card.id);
      if (stop) {
        for (const alert of alertsForStop(stop, job?.buildingName ?? "Tower A", job?.floor ?? 23)) {
          alerts.push({
            seat: alertSeatFor(alert.seat, building),
            text: alertNoticeText(alert),
            stopId: alert.stopId,
          });
        }
      }
    }
    return { storedText, cards, chips, alerts, matched: "safety" };
  }

  const scanContext = {
    tenant: job?.tenant,
    building: job?.building,
    floor: job?.floor,
    seat,
  };
  const scan = scanNeverList(pill, text, scanContext);
  if (scan.violated.length > 0) {
    const refusal = neverListRefusalCard(pill, text, scanContext);
    return {
      storedText,
      cards: refusal
        ? [
            {
              kind: "refusal",
              stopId: refusal.id,
              title: refusal.trigger,
              body: refusal.action,
              receipt: refusal.receipt,
              pointer: refusal.pointer,
            },
          ]
        : [],
      chips,
      alerts: [],
      matched: "never-list",
    };
  }

  const chip = chipFor(seat, text);
  if (chip) {
    return {
      storedText,
      cards: [chipAnswer(state, seat, chip, job, realNow, pill)],
      chips,
      alerts: [],
      matched: "chip",
    };
  }

  return {
    storedText,
    cards: [
      {
        kind: "answer",
        body: "I did not catch that. Try one of these.",
        receipt: codeReceipt(pill),
      },
    ],
    chips,
    alerts: [],
    matched: "none",
  };
}

/**
 * The receipt of a card code made with no AI (S1, S15): the pill version and
 * AI calls 0. Red stop and refusal cards carry their own, with their stop id;
 * the AI layer sets the receipt of a card it words.
 */
function codeReceipt(pill: ReturnType<typeof loadAndCheckPill>, what?: string): string {
  return `${what ? `${what} · ` : ""}pill v${pill.version} · AI calls: 0`;
}

/**
 * The Safety list (S11): all 10 stops from the live pill, in YAML order, with
 * its receipt. The Safety chip and the self-check's Q0 Yes (S10) both show it.
 */
export function safetyListCard(pill: ReturnType<typeof loadAndCheckPill>): ChatCard {
  return {
    kind: "safety-list",
    title: "Safety first",
    items: safetyList(pill).map((stop) => {
      const card = safetyCardForStop(stop, pill.version);
      return { id: card.id, title: card.trigger, body: card.action };
    }),
    receipt: codeReceipt(pill, "Safety list"),
  };
}

/** A chip's answer card, always with its receipt (S15 "Each card's receipt shows its AI calls"). */
function chipAnswer(
  state: MemoryState,
  seat: string,
  chip: string,
  job: Job | undefined,
  realNow: Date,
  pill: ReturnType<typeof loadAndCheckPill>
): ChatCard {
  const card = chipAnswerCard(state, seat, chip, job, realNow, pill);
  return { ...card, receipt: card.receipt ?? codeReceipt(pill, card.kind === "safety-list" ? "Safety list" : undefined) };
}

/** The record a notice to HQ asks about: by its ref, else the job's newest one (a notice stored before refs). */
function askedAbout(records: unknown[], notice: Notice, kindOk: (r: { kind?: string }) => boolean) {
  const mine = (records as { id?: string; kind?: string; jobId?: string; status?: string }[]).filter(
    (r) => r && kindOk(r) && r.jobId === notice.jobId
  );
  return notice.ref ? mine.find((r) => r.id === notice.ref) : mine[mine.length - 1];
}

/**
 * True while a notice still needs its seat (C8b review). HQ's notices about a
 * new solution (A2) or an outside help request (A3) stop needing HQ once HQ has
 * decided them; every other notice is listed as before. Reads only.
 */
function stillWaitsOnSeat(state: MemoryState, notice: Notice): boolean {
  // The AOM's charge request (A4) stops needing the AOM once decided (C9).
  if (notice.kind === "charge-request") {
    const r = askedAbout(state.requests, notice, (x) => x.kind === "A4");
    return !r || r.status === "open";
  }
  if (notice.seat !== "hq") return true;
  if (notice.kind === "solution-sent") {
    const s = askedAbout(state.solutions, notice, () => true);
    return !s || s.status === "sent-to-hq";
  }
  if (notice.kind === "outside-help") {
    const r = askedAbout(state.requests, notice, (x) => x.kind === "A3");
    return !r || r.status === "open";
  }
  return true;
}

function chipAnswerCard(
  state: MemoryState,
  seat: string,
  chip: string,
  job: Job | undefined,
  realNow: Date,
  pill: ReturnType<typeof loadAndCheckPill>
): ChatCard {
  if (chip === "Safety") {
    return safetyListCard(pill);
  }

  if (chip === "What needs me") {
    const mine = state.notices.filter((n) => n.seat === seat && stillWaitsOnSeat(state, n));
    return {
      kind: "answer",
      title: "What needs you",
      body:
        mine.length === 0
          ? "Nothing is waiting on you right now."
          : mine.map((n) => n.text).join("\n\n"),
    };
  }

  // Impact (AOM only, S19): the meter (S18) for the job's spot, else the AOM's
  // home spot, Tower A Level 23, since the AOM seat has no job of its own; and
  // the job's Not solved impact record with its cost (S3). Code only: amounts
  // show only in code-made cards (S13 item 9), and this card is never worded.
  if (chip === "Impact") {
    const spot = job ? spotKey(job) : AOM_SPOT;
    const meter = impactFor(spot, callsForState(state), loadImpactRates());
    const lines = meter ? impactLines(meter) : ["No calls at this spot yet."];
    if (job?.impact) {
      const cost = typeof job.impact.cost === "number" ? ` Cost: ${costLine(job.impact.cost, loadImpactRates())}.` : "";
      lines.push(`Job ${job.id}'s impact record: ${impactLine(job.impact)}.${cost}`);
    }
    return { kind: "answer", title: `Impact: ${meter ? meter.place : spot}`, body: lines.join("\n") };
  }

  if (!job) {
    return {
      kind: "answer",
      body: "Open a job first, then ask me again.",
    };
  }

  if (chip === "Show job") {
    return {
      kind: "answer",
      title: `Job ${job.id}`,
      body: `${job.buildingName}, Level ${job.floor}, ${job.tenant}. ${job.complaint}, ${job.intake.when}. Status: ${job.status}.`,
    };
  }

  if (chip === "Why?") {
    const first = leadsForJob(state, job, seat, realNow).leads[0];
    if (!first) {
      return { kind: "answer", title: "Why that one first", body: "There is no lead on this job yet." };
    }
    return {
      kind: "answer",
      title: "Why that one first",
      body: first.reason,
      rankLead: { label: first.label, checkText: first.checkText },
    };
  }

  if (chip === "Dial?") {
    const dial = dialStanding(state, job, seat, realNow);
    return {
      kind: "answer",
      title: dial.allowed ? "The dial is allowed here" : "The dial is removed here",
      body: dial.reason,
    };
  }

  if (chip === "Versions") {
    const lines = Object.entries(state.liveVersionByBuilding)
      .map(([b, v]) => `${b}: v${v}`)
      .join("\n");
    // The versions list like commits, newest first (S16 item 10, C8b), after A1's line.
    const versions = versionList(state)
      .map((v) => `${v.line} (${v.statusWord.toLowerCase()})`)
      .join("\n");
    return { kind: "answer", title: "Live versions", body: `${lines}\n\n${state.a1Line}\n\n${versions}` };
  }

  return { kind: "answer", body: "I did not catch that. Try one of these." };
}
