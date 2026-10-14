"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PipAvatar } from "../PipAvatar";
import { ChatCard } from "./ChatCard";
import { QuestRail } from "./QuestRail";
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
  const [refused, setRefused] = useState<string | null>(null);
  const call = useRef(fetcher ?? ((input: string, init?: RequestInit) => fetch(input, init)));

  const load = useCallback(async () => {
    const response = await call.current(`/api/state?seat=${seat}`);
    const data = (await response.json()) as SeatState;
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
    async (text: string) => {
      if (!text.trim()) return;
      const response = await call.current("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seat, text, job: jobId }),
      });
      const data = (await response.json()) as { storedText: string; cards: ServerCard[]; storedCount?: number };
      setReplies((old) => [...old, { text: data.storedText, cards: data.cards ?? [], storedCount: data.storedCount }]);
      setTyped("");
    },
    [seat, jobId]
  );

  const press = useCallback<Press>(
    async (action, job, payload) => {
      const body: Record<string, unknown> = { seat, action };
      if (job) body.job = job;
      if (payload) body.payload = payload;
      const response = await call.current("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string };
      setRefused(data.ok === false ? data.message ?? "That press was refused." : null);
      await load();
    },
    [seat, load]
  );

  const storedMessages = state?.messages.length ?? 0;
  const shownReplies = replies.filter((reply) => waiting(reply, storedMessages));

  return (
    <div className={variant === "column" ? "chat column" : "chat"}>
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

        {state?.notices.map((notice, i) => (
          <div className="notice" key={`notice-${i}`}>
            <b>{notice.kind.replace(/-/g, " ")}</b>
            {notice.text}
          </div>
        ))}

        {state?.messages.map((message, i) =>
          message.from === "person" ? (
            <div className="sent" key={`m-${i}`}>
              {message.text}
            </div>
          ) : (
            <Cards key={`m-${i}`} cards={message.cards ?? []} press={press} jobId={jobId} />
          )
        )}

        {shownReplies.map((reply, i) => (
          <div key={`r-${i}`} style={{ display: "contents" }}>
            <div className="sent">{reply.text}</div>
            <Cards cards={reply.cards} press={press} jobId={jobId} />
          </div>
        ))}

        {refused ? (
          <div className="notice refused" role="status">
            <b>not done</b>
            {refused}
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
        <button className="safety-btn" onClick={() => void say(SAFETY_WORD)}>
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
          placeholder={`Message Pip${jobId ? ` about ${jobId}` : ""}`}
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
          />
        );
      })}
    </>
  );
}
