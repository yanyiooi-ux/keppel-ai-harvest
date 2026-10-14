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
import { typedSafetyWords, alertsForStop } from "./safety";
import { scanNeverList, neverListRefusalCard, hideAmounts } from "./never-list";
import { leadsForJob, dialStanding } from "./leads";
import { safetyList, safetyCardForStop } from "./safety";
import { alertSeatFor } from "./permissions";
import * as memory from "./memory";
import type { MemoryState, Job } from "./memory";

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
  pointer?: string;
  items?: { id: string; title: string; body: string }[];
}

export interface ChatReply {
  /** The typed text as it is stored and shown: amounts are hidden. */
  storedText: string;
  cards: ChatCard[];
  chips: string[];
  /** Alerts to post for a typed red card. The stop itself stays closed. */
  alerts: { seat: string; text: string }[];
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
 */
export function applyTypedReply(state: MemoryState, seat: string, jobId: string | undefined, reply: ChatReply): void {
  state.messages.push({
    seat,
    from: "person",
    text: reply.storedText,
    at: state.demoNow,
  });
  state.messages.push({
    seat,
    from: "pip",
    text: reply.cards.map((c) => c.body ?? c.title ?? "").join(" "),
    at: state.demoNow,
    cards: reply.cards,
  });
  for (const alert of reply.alerts) {
    state.notices.push({
      seat: alert.seat,
      kind: "alert",
      text: alert.text,
      at: state.demoNow,
      jobId,
      typed: true,
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
    const alerts: { seat: string; text: string }[] = [];
    for (const card of safety.matchedStops) {
      cards.push({
        kind: "red-stop",
        stopId: card.id,
        title: card.trigger,
        body: card.action,
        receipt: card.receipt,
        raiseStopId: card.id,
      });
      const stop = safetyList(pill).find((s) => s.id === card.id);
      if (stop) {
        for (const alert of alertsForStop(stop, job?.buildingName ?? "Tower A", job?.floor ?? 23)) {
          alerts.push({
            seat: alertSeatFor(alert.seat, building),
            text: `${alert.title}: ${alert.action}`,
          });
        }
      }
    }
    return { storedText, cards, chips, alerts, matched: "safety" };
  }

  const scan = scanNeverList(pill, text, {
    tenant: job?.tenant,
    building: job?.building,
    floor: job?.floor,
  });
  if (scan.violated.length > 0) {
    const refusal = neverListRefusalCard(pill, text);
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
      },
    ],
    chips,
    alerts: [],
    matched: "none",
  };
}

function chipAnswer(
  state: MemoryState,
  seat: string,
  chip: string,
  job: Job | undefined,
  realNow: Date,
  pill: ReturnType<typeof loadAndCheckPill>
): ChatCard {
  if (chip === "Safety") {
    return {
      kind: "safety-list",
      title: "Safety first",
      items: safetyList(pill).map((stop) => {
        const card = safetyCardForStop(stop, pill.version);
        return { id: card.id, title: card.trigger, body: card.action };
      }),
    };
  }

  if (chip === "What needs me") {
    const mine = state.notices.filter((n) => n.seat === seat);
    return {
      kind: "answer",
      title: "What needs you",
      body:
        mine.length === 0
          ? "Nothing is waiting on you right now."
          : mine.map((n) => n.text).join("\n\n"),
    };
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
    return {
      kind: "answer",
      title: "Why that one first",
      body: first ? first.reason : "There is no lead on this job yet.",
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

  if (chip === "Impact") {
    return {
      kind: "answer",
      title: "Impact",
      body: job.impact
        ? `${job.impact.hoursLost} hours lost, ${job.impact.extraVisits} extra visits.`
        : "No impact record on this job yet.",
    };
  }

  if (chip === "Versions") {
    const lines = Object.entries(state.liveVersionByBuilding)
      .map(([b, v]) => `${b}: v${v}`)
      .join("\n");
    return { kind: "answer", title: "Live versions", body: `${lines}\n\n${state.a1Line}` };
  }

  return { kind: "answer", body: "I did not catch that. Try one of these." };
}
