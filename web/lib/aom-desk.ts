/**
 * The AOM's desk (S21's AOM row, C9): what the AOM, Tower A seat shows
 * besides the chat. Read only: it never writes the memory and never calls the
 * AI.
 *
 * The impact meter (S18) for Tower A Level 23, worked out by replaying the
 * calls in the memory with the made-up rates; the speak-first flag (S6) for
 * each Tower A spot, in the notice's own words; the charge requests (A4, S17)
 * with what the AOM decides, open ones first; the safety alerts sent to this
 * seat and the red stops open in Tower A now; the live version in Tower A,
 * read only; and the Not solved impact records of Tower A jobs with their
 * cost (S3).
 *
 * Every word and number comes from the data, the engine, the rates file or a
 * stored press. Amounts show only in code-made cards (S13 item 9).
 */

import { callsForState } from "./calls";
import { impactFor, type ImpactMeter } from "./impact";
import { loadImpactRates, impactLine, costLine } from "./impact-rates";
import { loadBuildings } from "./facts";
import { versionList } from "./versions";
import { seatLabel, dayMonth } from "./technician-flow";
import { chargeRequests, choiceLabel, costWords, CHARGE_CHOICES, AMOUNT_MIN, AMOUNT_MAX, type ChargeChoice } from "./charge-flow";
import * as memory from "./memory";
import type { MemoryState } from "./memory";
import type { CardColour } from "./seat-view";

/** The AOM seat's building and home spot (S2): Tower A Level 23. */
export const AOM_BUILDING = "tower-a";
export const AOM_SPOT = "tower-a/23";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AomSpeakFirst {
  spotKey: string;
  /** "Tower A Level 23". */
  place: string;
  /** The speak-first notice, word for word (S6). */
  text: string;
}

export interface AomAlert {
  text: string;
  stopId: string | null;
  at: string;
}

export interface AomChargeDecision {
  choiceLabel: string;
  /** "S$350, made-up demo amount" or "no charge to you". */
  costLine: string;
  reason: string;
  /** "Decided by AOM, Tower A: ... (role-played), 6 Oct, 10:05". */
  byLine: string;
}

export interface AomChargeView {
  id: string;
  jobId: string;
  /** The request's text, word for word: never an amount. */
  text: string;
  open: boolean;
  /** A status always carries its word (S21). */
  statusWord: "Waits on you" | "Decided";
  colour: CardColour;
  /** "Opened 6 Oct, 10:00 · job 2318". */
  openedLine: string;
  decision: AomChargeDecision | null;
  /** The card code posted to the tenant, word for word, once decided. */
  tenantCard: string | null;
  receipt: string;
}

export interface AomDesk {
  meter: ImpactMeter | null;
  speakFirst: AomSpeakFirst[];
  charges: AomChargeView[];
  choices: { id: ChargeChoice; label: string }[];
  amountMin: number;
  amountMax: number;
  alerts: AomAlert[];
  /** "RS-04 on Level 23". */
  openStops: string[];
  /** Read only: no button changes it here. */
  live: { version: string; line: string };
  impactRecords: { jobId: string; line: string }[];
}

function whenOf(at: string): string {
  return `${dayMonth(at)}, ${at.slice(11, 16)}`;
}

function placeOf(spotKey: string): string {
  const [building, floor] = spotKey.split("/");
  const name = loadBuildings().find((b) => b.id === building)?.name ?? building;
  return `${name} Level ${floor}`;
}

/** Each Tower A spot whose speak-first notice is within 30 days of the demo clock (S6). */
function speakFirstFlags(state: MemoryState, now: Date): AomSpeakFirst[] {
  const from = now.getTime() - 30 * DAY_MS;
  const flags = new Map<string, AomSpeakFirst>();
  for (const posted of state.speakFirstNotices) {
    if (!posted.spotKey.startsWith(`${AOM_BUILDING}/`)) continue;
    const at = new Date(posted.postedAt).getTime();
    if (at < from || at > now.getTime()) continue;
    const notice = [...state.notices]
      .reverse()
      .find((n) => n.kind === "speak-first" && n.spotKey === posted.spotKey);
    if (!notice) continue;
    flags.set(posted.spotKey, { spotKey: posted.spotKey, place: placeOf(posted.spotKey), text: notice.text });
  }
  return [...flags.values()];
}

function chargeViews(state: MemoryState, seat: string): AomChargeView[] {
  const mine = chargeRequests(state).filter((r) => r.seat === seat);
  const order = (open: boolean) => (open ? 0 : 1);
  return mine
    .map((r): AomChargeView => {
      const open = r.status === "open";
      const d = r.decision;
      return {
        id: r.id,
        jobId: r.jobId,
        text: r.text,
        open,
        statusWord: open ? "Waits on you" : "Decided",
        colour: open ? "amber" : "green",
        openedLine: `Opened ${whenOf(r.openedAt)} · job ${r.jobId}`,
        decision: d
          ? {
              choiceLabel: choiceLabel(d.choice),
              costLine: costWords(d.choice, d.amount),
              reason: d.reason,
              byLine: `Decided by ${seatLabel(d.decidedBy)}, ${whenOf(d.decidedAt)}`,
            }
          : null,
        tenantCard: d ? d.tenantCard : null,
        receipt: `Charge request ${r.id} (A4) · AI calls: 0`,
      };
    })
    .sort((a, b) => order(a.open) - order(b.open));
}

function alertsFor(state: MemoryState, seat: string): AomAlert[] {
  return state.notices
    .filter((n) => n.seat === seat && n.kind === "alert")
    .map((n) => ({ text: n.text, stopId: n.stopId ?? null, at: n.at }))
    .reverse();
}

function openStopsIn(state: MemoryState): string[] {
  const lines = state.openRedStops
    .filter((s) => s.building === AOM_BUILDING && s.clearedAt === null)
    .map((s) => `${s.stopId} on Level ${s.floor}`);
  return [...new Set(lines)];
}

function liveIn(state: MemoryState): { version: string; line: string } {
  const version = state.liveVersionByBuilding[AOM_BUILDING] ?? "1.0";
  const row = versionList(state).find((v) => v.version === version);
  return { version, line: row ? row.line : `v${version}` };
}

function impactRecordsIn(state: MemoryState): { jobId: string; line: string }[] {
  const rates = loadImpactRates();
  return state.jobs
    .filter((j) => j.building === AOM_BUILDING && j.impact)
    .map((j) => {
      const cost = typeof j.impact!.cost === "number" ? ` Cost: ${costLine(j.impact!.cost, rates)}.` : "";
      return { jobId: j.id, line: `Impact record: ${impactLine(j.impact!)}.${cost}` };
    });
}

export function aomDesk(state: MemoryState, realNow: Date = new Date(), seat = "aom-tower-a"): AomDesk {
  return {
    meter: impactFor(AOM_SPOT, callsForState(state), loadImpactRates()),
    speakFirst: speakFirstFlags(state, memory.now(state, realNow)),
    charges: chargeViews(state, seat),
    choices: CHARGE_CHOICES,
    amountMin: AMOUNT_MIN,
    amountMax: AMOUNT_MAX,
    alerts: alertsFor(state, seat),
    openStops: openStopsIn(state),
    live: liveIn(state),
    impactRecords: impactRecordsIn(state),
  };
}
