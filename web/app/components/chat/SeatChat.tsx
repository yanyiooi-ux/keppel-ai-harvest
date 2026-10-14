"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PipAvatar } from "../PipAvatar";
import { ChatCard } from "./ChatCard";
import { QuestRail } from "./QuestRail";
import { TechnicianDesk, barIsShown } from "./TechnicianDesk";
import { SeniorManagerDesk, managerBarIsShown, managerRowHolds, type RefusedPress } from "./SeniorManagerDesk";
import { HqDesk, hqHolds } from "./HqDesk";
import type { RailNode } from "./QuestRail";

/**
 * One seat's chat (S21): Pip and the seat label, the messages, the notices in a
 * quieter style, the chips, the text box, and the red Safety button that every
 * seat carries at every width.
 *
 * The component owns no rules. It shows what /api/state and /api/chat hand it,
 * so a card can never say something the engine did not say. Buttons go to
 * /api/action, which checks the seat and the status on the server (S2); the
 * chat then reloads what the press stored. Tests pass their own fetch and a
 * poll interval of 0, and nothing here touches the network on its own.
 */

import type { SeatCard, SeatView } from "../../../lib/seat-view";

export type ServerCard = SeatCard;
export type SeatState = SeatView;

export interface SeatChatProps {
  seat: string;
  jobId?: string;
  /** Rendered on the server, so the first paint already has the real words. */
  initial?: SeatState;
  /** Tests pass their own. Nothing else is ever called. */
  fetcher?: (input: string, init?: RequestInit) => Promise<Response>;
  /** 0 means never poll. The live app uses 2000 (S20). */
  pollMs?: number;
  variant?: "page" | "column";
  rail?: { title: string; nodes: RailNode[] };
  /** Pip's first words on this seat (C5b). Plain code, 0 AI. */
  opening?: { text: string; never: string };
}

const SAFETY_WORD = "safety";

/** The two buttons behind Report a problem, and the complaint each one sends (run rule 16). */
const COMPLAINT_BUTTONS = [
  { label: "Too cold", complaint: "too cold" },
  { label: "Too hot", complaint: "too hot" },
];

/**
 * A typed message, shown from the chat's own answer until a poll brings the
 * stored copy. `storedCount` is how many messages the seat had stored once this
 * one was written; a view holding that many already shows it.
 */
interface LocalReply {
  text: string;
  cards: ServerCard[];
  storedCount?: number;
}

function waiting(reply: LocalReply, storedMessages: number): boolean {
  return reply.storedCount === undefined || storedMessages < reply.storedCount;
}

type Press = (action: string, job?: string, payload?: Record<string, unknown>) => Promise<void>;

/**
 * Presses whose result lands at the end of the chat: when one works, the chat
 * scrolls Pip's new card into view, so on a phone the press is never silent
 * (C7b). A tick or Open job changes the desk in place and scrolls nothing.
 */
const FOLLOWED_PRESSES = [
  "solved",
  "not-solved",
  "send-with-cause",
  "safety-pick",
  // The senior manager's presses whose Pip card is the only word on what
  // happened (C8a). Run tests and Send to HQ show their result in the new
  // solution card, which brings it into view itself, next to the bar.
  "ask-outside-help",
  "clear-stop",
];

/** The job on this seat's desk: the technician's open job (C7b) or the senior manager's (C8a). */
function deskJob(state: SeatState | null): string | undefined {
  return state?.desk?.open?.jobId ?? state?.manager?.open?.open.jobId;
}

export function SeatChat({
  seat,
  jobId,
  fetcher,
  pollMs = 2000,
  variant = "page",
  rail,
  initial,
  opening,
}: SeatChatProps) {
  const [state, setState] = useState<SeatState | null>(initial ?? null);
  const [replies, setReplies] = useState<LocalReply[]>([]);
  const [typed, setTyped] = useState("");
  const [reporting, setReporting] = useState(false);
  // A refused press: its reason, and what was pressed with what, so the
  // reason can show in the row that was pressed (C8a review).
  const [refused, setRefused] = useState<RefusedPress | null>(null);
  const call = useRef(fetcher ?? ((input: string, init?: RequestInit) => fetch(input, init)));
  // The job on the desk (the technician's open job, C7b, or the senior
  // manager's, C8a) wins over the page's default job, so the chips, typed words
  // and Safety picks are about the job on the desk.
  const activeJob = deskJob(state) ?? jobId;
  // Show job: another job to put on the desk. A view only: it rides on the
  // state read and is never a press.
  const showJob = useRef<string | undefined>(undefined);
  const root = useRef<HTMLDivElement>(null);
  // How many chat items there were when a followed press or Safety started.
  const followFrom = useRef<number | null>(null);
  const itemCount = useRef(0);

  const load = useCallback(async () => {
    const show = showJob.current;
    const response = await call.current(`/api/state?seat=${seat}${show ? `&show=${encodeURIComponent(show)}` : ""}`);
    const data = (await response.json()) as SeatState;
    // The server shows only a job this seat may work on; once the asked job
    // has moved on, the desk is back on its own job.
    if (show && showJob.current === show && deskJob(data) !== show) showJob.current = undefined;
    setState(data);
    // A reply the stored messages now hold is dropped for good, so a later
    // Reset (which empties the log) can never bring it back on its own.
    const stored = data.messages?.length ?? 0;
    setReplies((old) => (old.some((r) => !waiting(r, stored)) ? old.filter((r) => waiting(r, stored)) : old));
  }, [seat]);

  useEffect(() => {
    void load();
    if (pollMs <= 0) return;
    const timer = setInterval(() => void load(), pollMs);
    return () => clearInterval(timer);
  }, [load, pollMs]);

  const say = useCallback(
    async (text: string, follow = false) => {
      if (!text.trim()) return;
      // Safety's list lands at the end of the chat, far below the bar on a
      // phone: the chat scrolls it into view (S11 "One tap opens all 10").
      followFrom.current = follow ? itemCount.current : null;
      const response = await call.current("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seat, text, job: activeJob }),
      });
      const data = (await response.json()) as { storedText: string; cards: ServerCard[]; storedCount?: number };
      setReplies((old) => [...old, { text: data.storedText, cards: data.cards ?? [], storedCount: data.storedCount }]);
      setTyped("");
    },
    [seat, activeJob]
  );

  // One press at a time: a double tap while a press is on its way sends
  // nothing, so it can never come back as a confusing refusal.
  const pressing = useRef(false);

  const press = useCallback<Press>(
    async (action, job, payload) => {
      if (pressing.current) return;
      pressing.current = true;
      followFrom.current = FOLLOWED_PRESSES.includes(action) ? itemCount.current : null;
      // A job just opened goes on the desk.
      if (action === "open-job") showJob.current = undefined;
      try {
        const body: Record<string, unknown> = { seat, action };
        if (job) body.job = job;
        if (payload) body.payload = payload;
        const response = await call.current("/api/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await response.json()) as { ok?: boolean; message?: string; alreadyShown?: boolean };
        setRefused(
          data.ok === false ? { action, job, payload, message: data.message ?? "That press was refused." } : null
        );
        // A refusal shows where it was pressed, and a pick this chat already
        // shows adds nothing: nothing to scroll to.
        if (data.ok === false || data.alreadyShown) followFrom.current = null;
        await load();
      } finally {
        pressing.current = false;
      }
    },
    [seat, load]
  );

  const showOnDesk = useCallback(
    (id: string) => {
      showJob.current = id;
      void load();
    },
    [load]
  );

  const storedMessages = state?.messages.length ?? 0;
  const shownReplies = replies.filter((reply) => waiting(reply, storedMessages));
  // A refused Clear stop or Confirm cause shows in the row that was pressed,
  // wherever that row sits (C8a review). Otherwise, on the job on the desk the
  // refusal shows in the bar, next to the press that made it, so it is on
  // screen on a phone (C7b, C8a); with no bar, at the end of the chat.
  // HQ's presses show their refusal in the card that was pressed (C8b).
  const refusedInRow = managerRowHolds(state?.manager, refused) || hqHolds(state?.hq, refused);
  const refusedInBar = !refusedInRow && (barIsShown(state?.desk) || managerBarIsShown(state?.manager));
  const refusedText = refused?.message ?? null;
  // Every stored message is one chat item, numbered in screen order. A local
  // reply counts as the 2 it is stored as (the seat's words and Pip's cards),
  // so the numbers stay the same once a poll brings the stored copy.
  const items = storedMessages + 2 * shownReplies.length;

  // Once the followed press's or Safety's first new item is on screen, scroll
  // it to the top of the view, once.
  useEffect(() => {
    itemCount.current = items;
    const from = followFrom.current;
    if (from === null || items <= from) return;
    followFrom.current = null;
    root.current?.querySelector(`[data-item="${from}"]`)?.scrollIntoView?.({ block: "start" });
  }, [items]);

  return (
    <div ref={root} className={variant === "column" ? "chat column" : "chat"}>
      <header className="chat-head">
        <div className="avatar">
          <PipAvatar />
        </div>
        <div>
          <div className="chat-name">
            Pip <span className="seat-tag">{seat}</span>
          </div>
          <div className="chat-sub">{state ? state.label : "role-played"}</div>
        </div>
      </header>

      {rail ? <QuestRail title={rail.title} nodes={rail.nodes} /> : null}

      <div className="chat-body">
        {opening ? (
          <div className="opening">
            <p>{opening.text}</p>
            <p className="never">{opening.never}</p>
          </div>
        ) : null}

        {state?.desk ? (
          <TechnicianDesk
            desk={state.desk}
            press={press}
            onSafety={() => void say(SAFETY_WORD, true)}
            onShow={showOnDesk}
            refused={refusedInBar ? refusedText : null}
          />
        ) : null}

        {state?.manager ? (
          <SeniorManagerDesk
            desk={state.manager}
            press={press}
            onSafety={() => void say(SAFETY_WORD, true)}
            onShow={showOnDesk}
            refused={refusedInBar ? refusedText : null}
            rowRefused={refusedInRow ? refused : null}
          />
        ) : null}

        {state?.hq ? <HqDesk desk={state.hq} press={press} refused={refusedInRow ? refused : null} /> : null}

        {state?.notices.map((notice, i) => (
          <div className="notice" key={`notice-${i}`}>
            <b>{notice.kind.replace(/-/g, " ")}</b>
            {notice.text}
          </div>
        ))}

        {state?.messages.map((message, i) =>
          message.from === "person" ? (
            <div className="sent" key={`m-${i}`} data-item={i}>
              {message.text}
            </div>
          ) : (
            <div className="msg" key={`m-${i}`} data-item={i}>
              <Cards cards={message.cards ?? []} press={press} jobId={activeJob} />
            </div>
          )
        )}

        {shownReplies.map((reply, i) => (
          <div key={`r-${i}`} style={{ display: "contents" }}>
            <div className="sent" data-item={storedMessages + 2 * i}>
              {reply.text}
            </div>
            <Cards cards={reply.cards} press={press} jobId={activeJob} />
          </div>
        ))}

        {refusedText && !refusedInBar && !refusedInRow ? (
          <div className="notice refused" role="status">
            <b>not done</b>
            {refusedText}
          </div>
        ) : null}
      </div>

      {seat === "tenant" ? (
        <div className="chips report-row">
          {reporting ? (
            COMPLAINT_BUTTONS.map((b) => (
              <button
                key={b.complaint}
                onClick={() => {
                  setReporting(false);
                  void press("report", undefined, { complaint: b.complaint });
                }}
              >
                {b.label}
              </button>
            ))
          ) : (
            <button className="report-btn" onClick={() => setReporting(true)}>
              Report a problem
            </button>
          )}
        </div>
      ) : null}

      <div className="chips">
        {state?.chips
          .filter((chip) => chip.toLowerCase() !== SAFETY_WORD)
          .map((chip) => (
            <button key={chip} onClick={() => void say(chip)}>
              {chip}
            </button>
          ))}
        <button className="safety-btn" onClick={() => void say(SAFETY_WORD, true)}>
          Safety
        </button>
      </div>

      <form
        className="compose"
        onSubmit={(event) => {
          event.preventDefault();
          void say(typed);
        }}
      >
        <input
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={`Message Pip${activeJob ? ` about ${activeJob}` : ""}`}
          aria-label="Message Pip"
        />
        <button className="send" type="submit" aria-label="Send">
          ↑
        </button>
      </form>
    </div>
  );
}

function Cards({ cards, press, jobId }: { cards: ServerCard[]; press: Press; jobId?: string }) {
  return (
    <>
      {cards.map((card, i) => {
        if (card.kind === "safety-list") {
          // A pick raises that stop on the list's own job (a self-check's Q0 Yes),
          // else on the seat's job (S11).
          const on = card.jobId ?? jobId;
          return (
            <ChatCard key={i} from="Safety" title={card.title} receipt={card.receipt}>
              <ul className="pick-list">
                {card.items?.map((item) => (
                  <li key={item.id}>
                    <span>
                      <b>{item.id}</b> {item.title}
                    </span>
                    <button
                      className="pick-btn"
                      aria-label={`Raise ${item.id}`}
                      onClick={() => void press("safety-pick", on, { stopId: item.id })}
                    >
                      Raise
                    </button>
                  </li>
                ))}
              </ul>
            </ChatCard>
          );
        }

        if (card.kind === "question") {
          return (
            <ChatCard key={i} from="Self-check" title={card.title} receipt={card.receipt}>
              {card.answered === undefined && card.answers ? (
                <div className="answers">
                  {card.answers.map((answer) => (
                    <button
                      key={answer}
                      onClick={() =>
                        void press("answer", card.jobId, { questionId: card.questionId, answer })
                      }
                    >
                      {answer}
                    </button>
                  ))}
                </div>
              ) : null}
            </ChatCard>
          );
        }

        const isRed = card.kind === "red-stop" || card.kind === "refusal";
        // A typed red card opens no stop on its own; its Raise this stop
        // button (safety-pick) does, on the job the words were typed about,
        // else the seat's job (S11, S19).
        const raise =
          card.kind === "red-stop" && card.raiseStopId ? (
            <button
              className="raise-btn"
              aria-label={`Raise this stop: ${card.raiseStopId}`}
              onClick={() => void press("safety-pick", card.jobId ?? jobId, { stopId: card.raiseStopId })}
            >
              Raise this stop
            </button>
          ) : null;
        return (
          <ChatCard
            key={i}
            colour={isRed ? "red" : card.colour ?? "none"}
            colourWord={isRed ? "Stop" : card.colourWord}
            meaning={card.meaning}
            from={card.stopId}
            title={card.title}
            body={card.body}
            call={card.call}
            receipt={card.receipt}
            aiWording={card.aiWording}
            aiBanner={card.aiBanner}
            aiNotice={card.aiNotice}
            aiOff={card.aiOff}
          >
            {raise}
          </ChatCard>
        );
      })}
    </>
  );
}
