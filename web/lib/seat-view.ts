/**
 * One seat's view of the shared memory.
 *
 * The seat page renders this on the server for the first paint and /api/state
 * returns the same shape for the 2-second poll, so what a judge sees before
 * hydration and after it can never disagree. The card shape is defined here,
 * once, and the chat parts read it from here.
 */

import { CHIPS_BY_SEAT } from "./chat";
import { SEAT_LABELS, PIP_NEVER } from "./permissions";
import type { SeatId } from "./permissions";
import type { MemoryState } from "./memory";

export type CardColour = "green" | "amber" | "red" | "none";

export interface SeatCard {
  kind: string;
  title?: string;
  body?: string;
  receipt?: string;
  stopId?: string;
  raiseStopId?: string;
  pointer?: string;
  colourWord?: string;
  colour?: CardColour;
  meaning?: string;
  items?: { id: string; title: string; body: string }[];
}

export interface SeatMessage {
  from: "person" | "pip";
  text: string;
  cards?: SeatCard[];
}

export interface SeatView {
  seat: string;
  label: string;
  pipNever: string;
  chips: string[];
  messages: SeatMessage[];
  notices: { kind: string; text: string }[];
}

export function seatView(state: MemoryState, seat: string): SeatView {
  return {
    seat,
    label: SEAT_LABELS[seat as SeatId],
    pipNever: PIP_NEVER[seat as SeatId],
    chips: CHIPS_BY_SEAT[seat] ?? [],
    messages: state.messages
      .filter((m) => m.seat === seat)
      .map((m) => ({
        from: m.from,
        text: m.text,
        cards: (m.cards ?? []) as SeatCard[],
      })),
    notices: state.notices
      .filter((n) => n.seat === seat)
      .map((n) => ({ kind: n.kind, text: n.text })),
  };
}
