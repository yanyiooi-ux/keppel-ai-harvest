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
import { AI_OFF_LABEL, type AiMode } from "./ai-mode";
import { technicianDesk, type TechnicianDesk } from "./technician-desk";
import { managerDesk, type ManagerDesk } from "./senior-manager-desk";
import { hqDesk, type HqDesk } from "./hq-desk";
import { aomDesk, type AomDesk } from "./aom-desk";

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
  /** The lead whose code reason is the body (rank wording, S15). */
  rankLead?: { label: string; checkText: string };
  /** Set once the card went through the AI layer. */
  aiJob?: string;
  /** The extra "AI wording" line under the code reason, which always stays (S14). */
  aiWording?: string;
  /** "replay: saved real AI answer". */
  aiBanner?: string;
  /** "<status> AI unavailable, using replay". */
  aiNotice?: string;
  /** "AI off" when the switch is Off. */
  aiOff?: string;
  /** Model calls made for this card's wording. */
  aiCalls?: number;
  /** A red stop's who_to_call, shown after "Call:" (S11). */
  call?: string;
  /** The job a self-check card or a Safety list is about (S10). */
  jobId?: string;
  /** A self-check question (S10): its id, its answer buttons, and the answer once given. */
  questionId?: string;
  answers?: string[];
  answered?: string;
  /** A tenant reply's tips, word for word from the pill. */
  tips?: string[];
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
  /** The technician seat only (C7b): the job list and the open job's filled checklist and leads. */
  desk?: TechnicianDesk;
  /** The senior manager seat only (C8a): the jobs that came up, the new solution, cases to confirm, stops to clear. */
  manager?: ManagerDesk;
  /** The HQ seat only (C8b): the A1 card, solutions sent to HQ, versions, outside help and the Building B card. */
  hq?: HqDesk;
  /** The AOM seat only (C9): the impact meter, speak-first flag, charge requests, alerts, live version, impact records. */
  aom?: AomDesk;
}

/**
 * Where the AI switch stands decides how a worded card shows (S15). On Off there
 * is no AI at all: the same card, its code text, the small "AI off" label and no
 * AI line, even if the line was made earlier on Live or Replay. Cards the AI never
 * touched (red cards among them) are left exactly as they are.
 */
function forMode(card: SeatCard, mode: AiMode | undefined): SeatCard {
  if (!mode || !card.aiJob) return card;
  if (mode === "off") {
    const { aiWording: _w, aiBanner: _b, aiNotice: _n, ...rest } = card;
    void _w;
    void _b;
    void _n;
    return { ...rest, aiOff: AI_OFF_LABEL };
  }
  const { aiOff: _o, ...rest } = card;
  void _o;
  return rest;
}

/**
 * `show` is Show job: another job to put on the desk (the technician's, C7b,
 * or the senior manager's, C8a). A view only; each desk ignores a job it may
 * not show.
 */
export function seatView(
  state: MemoryState,
  seat: string,
  mode?: AiMode,
  realNow: Date = new Date(),
  show?: string
): SeatView {
  const view: SeatView = {
    seat,
    label: SEAT_LABELS[seat as SeatId],
    pipNever: PIP_NEVER[seat as SeatId],
    chips: CHIPS_BY_SEAT[seat] ?? [],
    messages: state.messages
      .filter((m) => m.seat === seat)
      .map((m) => ({
        from: m.from,
        text: m.text,
        cards: ((m.cards ?? []) as SeatCard[]).map((card) => forMode(card, mode)),
      })),
    notices: state.notices
      .filter((n) => n.seat === seat)
      .map((n) => ({ kind: n.kind, text: n.text })),
  };
  if (seat === "technician") view.desk = technicianDesk(state, realNow, mode, show);
  if (seat === "senior-manager") view.manager = managerDesk(state, realNow, mode, show);
  if (seat === "hq") view.hq = hqDesk(state, realNow, mode);
  if (seat === "aom-tower-a") view.aom = aomDesk(state, realNow, seat);
  return view;
}
