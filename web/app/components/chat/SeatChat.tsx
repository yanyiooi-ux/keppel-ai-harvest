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
 * so a card can never say something the engine did not say. Tests pass their
 * own fetch and a poll interval of 0, and nothing here touches the network on
 * its own.
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
}

const SAFETY_WORD = "safety";

export function SeatChat({
  seat,
  jobId,
  fetcher,
  pollMs = 2000,
  variant = "page",
  rail,
  initial,
}: SeatChatProps) {
  const [state, setState] = useState<SeatState | null>(initial ?? null);
  const [replies, setReplies] = useState<{ text: string; cards: ServerCard[] }[]>([]);
  const [typed, setTyped] = useState("");
  const call = useRef(fetcher ?? ((input: string, init?: RequestInit) => fetch(input, init)));

  const load = useCallback(async () => {
    const response = await call.current(`/api/state?seat=${seat}`);
    const data = (await response.json()) as SeatState;
    setState(data);
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
      const data = (await response.json()) as { storedText: string; cards: ServerCard[] };
      setReplies((old) => [...old, { text: data.storedText, cards: data.cards ?? [] }]);
      setTyped("");
    },
    [seat, jobId]
  );

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
            <Cards key={`m-${i}`} cards={message.cards ?? []} />
          )
        )}

        {replies.map((reply, i) => (
          <div key={`r-${i}`} style={{ display: "contents" }}>
            <div className="sent">{reply.text}</div>
            <Cards cards={reply.cards} />
          </div>
        ))}
      </div>

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

function Cards({ cards }: { cards: ServerCard[] }) {
  return (
    <>
      {cards.map((card, i) => {
        if (card.kind === "safety-list") {
          return (
            <ChatCard key={i} from="Safety" title={card.title}>
              <ul style={{ margin: 0, paddingLeft: "18px" }}>
                {card.items?.map((item) => (
                  <li key={item.id}>
                    <b>{item.id}</b> {item.title}
                  </li>
                ))}
              </ul>
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
            receipt={card.receipt}
          />
        );
      })}
    </>
  );
}
