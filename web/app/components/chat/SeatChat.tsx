"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PipAvatar } from "../PipAvatar";
import { ChatCard } from "./ChatCard";
import { QuestRail } from "./QuestRail";
import { TechnicianDesk, barIsShown } from "./TechnicianDesk";
import { SeniorManagerDesk, managerBarIsShown, managerRowHolds, type RefusedPress } from "./SeniorManagerDesk";
import { HqDesk, hqHolds } from "./HqDesk";
import { AomDesk, aomHolds, AOM_DESK_NOTICE_KINDS } from "./AomDesk";
import { bringIntoView } from "./bring-into-view";
import { CodeTag, Plain } from "../Plain";
import { SPEAK_FIRST_MEANS, noticeWord, pipNeverLine, plainOpening, seatLabelWords, seatWord } from "../../../lib/plain-words";
import type { RailNode } from "./QuestRail";
import type { AiMode } from "../../../lib/ai-mode";

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
 *
 * Loading you can see (D1): while a press or a typed message is on its way,
 * the control that was used is marked busy, every control in the chat is
 * locked (one disabled fieldset, so nothing double-fires), and "Pip is
 * checking" shows with typing dots. The reply lands as soon as the server
 * answers. The mark, "Pip is checking" and the lock stay on screen for at
 * least MIN_PENDING_MS from the press, so even a fast answer never looks like
 * nothing happened and a second tap in that time cannot fire (D1 review). A
 * refused press or one that failed on the network frees the chat at once, so
 * the person can fix it and try again straight away.
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
  /** Where the AI switch stands, so a screen can say why no AI line shows (D1 review). */
  aiMode?: AiMode;
}

const SAFETY_WORD = "safety";

/** The shortest time the waiting shows, so a fast reply never looks like nothing happened (D1). */
export const MIN_PENDING_MS = 400;

/** What moves in when it is new on screen (D1): cards, notices and the seat's own messages. */
const ENTERING = ".card, .notice, .sent";

/** What a press or a message that failed on the network says (D1). */
export const NOT_THROUGH = "That did not go through. Check the connection, then try again.";

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

/** A chip's words on its button, where the chip itself is too short to read (D1 review). Pressing it still sends the chip. */
const CHIP_LABELS: Record<string, string> = {
  "Dial?": "Can I turn the dial?",
};

/** The job number a notice is about ("job 2318"), or null. */
function noticeJob(text: string): string | null {
  return /\bjob (\d{4})\b/i.exec(text)?.[1] ?? null;
}

/**
 * The senior manager's jobs that came up (an escalated notice) and are no
 * longer with the senior manager: solved, or a new fix approved (D1 review).
 * Read from the view only; every other seat has none.
 */
function jobsMovedOn(state: SeatState | null): string[] {
  const desk = state?.manager;
  if (!desk) return [];
  const withYou = new Set(desk.jobs.map((j) => j.id));
  const cameUp = state.notices.filter((n) => n.kind === "escalated").map((n) => noticeJob(n.text));
  return [...new Set(cameUp.filter((id): id is string => id !== null && !withYou.has(id)))];
}

/** An escalated or low-confidence notice about a job that has left the senior manager's desk. */
function noticeIsDone(notice: { kind: string; text: string }, movedOn: string[]): boolean {
  if (notice.kind !== "escalated" && notice.kind !== "low-confidence") return false;
  const id = noticeJob(notice.text);
  return id !== null && movedOn.includes(id);
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
  aiMode,
}: SeatChatProps) {
  const [state, setState] = useState<SeatState | null>(initial ?? null);
  const [replies, setReplies] = useState<LocalReply[]>([]);
  const [typed, setTyped] = useState("");
  const [reporting, setReporting] = useState(false);
  // A press or a typed message on its way (D1): every control is locked until the reply lands.
  const [busy, setBusy] = useState(false);
  // "Pip is checking" and the mark on the pressed control: on from the press,
  // for at least MIN_PENDING_MS and until the reply lands (D1).
  const [checking, setChecking] = useState(false);
  // A typed message that failed on the network (D1), shown at the end of the chat.
  const [sayFailed, setSayFailed] = useState(false);
  // A refused press: its reason, and what was pressed with what, so the
  // reason can show in the row that was pressed (C8a review).
  const [refused, setRefused] = useState<RefusedPress | null>(null);
  // The last tick that worked (Found it, Not this, Clear), so the desk can say
  // what it did next to the list it changed (D1 review). Same shape as a refusal.
  const [done, setDone] = useState<RefusedPress | null>(null);
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
  // The control last used in this chat (a click or a form's submit button), so
  // a press can mark it busy (D1). The mark is an attribute React does not own.
  const lastControl = useRef<HTMLElement | null>(null);
  // How many presses or messages still show "Pip is checking" (D1).
  const holds = useRef(0);

  /**
   * Starts the busy state for one press or message: marks the control that
   * started it, locks the chat and shows "Pip is checking". Returns the
   * release, called once the reply has landed. When the reply went through,
   * the mark, "Pip is checking" and the lock all stay until at least
   * MIN_PENDING_MS after the start, so even a fast answer never looks like
   * nothing happened and a second tap in that time cannot fire (D1 review).
   * A refusal or a network failure (`ok` false) frees the lock at once, so a
   * fix and a retry are never held up.
   */
  const startBusy = useCallback((): ((ok: boolean) => void) => {
    const started = Date.now();
    const el = lastControl.current;
    lastControl.current = null;
    if (el) {
      el.classList.add("is-pending");
      el.setAttribute("aria-busy", "true");
    }
    holds.current += 1;
    setBusy(true);
    setChecking(true);
    const end = () => {
      if (el) {
        el.classList.remove("is-pending");
        el.removeAttribute("aria-busy");
      }
      holds.current -= 1;
      if (holds.current === 0) {
        setChecking(false);
        setBusy(false);
      }
    };
    return (ok: boolean) => {
      if (!ok) setBusy(false);
      const left = MIN_PENDING_MS - (Date.now() - started);
      if (left > 0) setTimeout(end, left);
      else end();
    };
  }, []);

  const fetchView = useCallback(async (): Promise<{ show: string | undefined; data: SeatState }> => {
    const show = showJob.current;
    const response = await call.current(`/api/state?seat=${seat}${show ? `&show=${encodeURIComponent(show)}` : ""}`);
    return { show, data: (await response.json()) as SeatState };
  }, [seat]);

  const apply = useCallback(({ show, data }: { show: string | undefined; data: SeatState }) => {
    // The server shows only a job this seat may work on; once the asked job
    // has moved on, the desk is back on its own job.
    if (show && showJob.current === show && deskJob(data) !== show) showJob.current = undefined;
    setState(data);
    // A reply the stored messages now hold is dropped for good, so a later
    // Reset (which empties the log) can never bring it back on its own.
    const stored = data.messages?.length ?? 0;
    setReplies((old) => (old.some((r) => !waiting(r, stored)) ? old.filter((r) => waiting(r, stored)) : old));
  }, []);

  const load = useCallback(async () => {
    apply(await fetchView());
  }, [apply, fetchView]);

  useEffect(() => {
    void load();
    if (pollMs <= 0) return;
    const timer = setInterval(() => void load(), pollMs);
    return () => clearInterval(timer);
  }, [load, pollMs]);

  // New cards move in briefly (D1). Only what is added after the first paint
  // is marked: what the page opened with stays still, and a poll that keeps
  // the same nodes marks nothing. The mark is a class React does not own.
  useEffect(() => {
    const el = root.current;
    if (!el || typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of Array.from(record.addedNodes)) {
          if (!(node instanceof Element)) continue;
          const hits = node.matches(ENTERING) ? [node] : [];
          hits.push(...Array.from(node.querySelectorAll(ENTERING)));
          for (const hit of hits) hit.classList.add("is-new");
        }
      }
    });
    observer.observe(el, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  // One press or message at a time: a double tap while one is on its way
  // sends nothing, so it can never come back as a confusing refusal.
  const pressing = useRef(false);

  const say = useCallback(
    async (text: string, follow = false) => {
      if (!text.trim() || pressing.current) return;
      pressing.current = true;
      const release = startBusy();
      setSayFailed(false);
      // Safety's list lands at the end of the chat, far below the bar on a
      // phone: the chat scrolls it into view (S11 "One tap opens all 10").
      followFrom.current = follow ? itemCount.current : null;
      setDone(null);
      let ok = false;
      try {
        const response = await call.current("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seat, text, job: activeJob }),
        });
        const data = (await response.json()) as { storedText: string; cards: ServerCard[]; storedCount?: number };
        setReplies((old) => [...old, { text: data.storedText, cards: data.cards ?? [], storedCount: data.storedCount }]);
        setTyped("");
        ok = true;
      } catch {
        // The message never reached Pip, or the answer never came back: say so, keep the typed words.
        followFrom.current = null;
        setSayFailed(true);
      } finally {
        pressing.current = false;
        release(ok);
      }
    },
    [seat, activeJob, startBusy]
  );

  const press = useCallback<Press>(
    async (action, job, payload) => {
      if (pressing.current) return;
      pressing.current = true;
      const release = startBusy();
      setSayFailed(false);
      followFrom.current = FOLLOWED_PRESSES.includes(action) ? itemCount.current : null;
      // A job just opened goes on the desk.
      if (action === "open-job") showJob.current = undefined;
      setDone(null);
      let ok = false;
      try {
        const body: Record<string, unknown> = { seat, action };
        if (job) body.job = job;
        if (payload) body.payload = payload;
        let data: { ok?: boolean; message?: string; alreadyShown?: boolean };
        try {
          const response = await call.current("/api/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          data = (await response.json()) as typeof data;
        } catch {
          // The press never reached the server, or its answer never came back:
          // say so where a refusal shows, and change nothing on screen.
          data = { ok: false, message: NOT_THROUGH };
        }
        setRefused(
          data.ok === false ? { action, job, payload, message: data.message ?? "That press was refused." } : null
        );
        ok = data.ok !== false;
        // A tick that worked says what it did, next to the list it changed (D1 review).
        if (ok && action === "tick") setDone({ action, job, payload, message: data.message ?? "" });
        // A refusal shows where it was pressed, and a pick this chat already
        // shows adds nothing: nothing to scroll to.
        if (data.ok === false || data.alreadyShown) followFrom.current = null;
        try {
          await load();
        } catch {
          // The view stays as it was; the next poll reads it again.
        }
      } finally {
        pressing.current = false;
        release(ok);
      }
    },
    [seat, load, startBusy]
  );

  // Show job: a view only, never a press, but it reads the server, so it shows
  // that it is working the same way a press does (D1 review).
  const showOnDesk = useCallback(
    async (id: string) => {
      if (pressing.current) return;
      pressing.current = true;
      const release = startBusy();
      showJob.current = id;
      setDone(null);
      let ok = false;
      try {
        await load();
        ok = true;
      } catch {
        // The view stays as it was; the next poll reads it again.
      } finally {
        pressing.current = false;
        release(ok);
      }
    },
    [load, startBusy]
  );

  const storedMessages = state?.messages.length ?? 0;
  const shownReplies = replies.filter((reply) => waiting(reply, storedMessages));
  // A refused Clear stop or Confirm cause shows in the row that was pressed,
  // wherever that row sits (C8a review). Otherwise, on the job on the desk the
  // refusal shows in the bar, next to the press that made it, so it is on
  // screen on a phone (C7b, C8a); with no bar, at the end of the chat.
  // HQ's presses show their refusal in the card that was pressed (C8b), and so
  // does the AOM's Decide charge (C9).
  const refusedInRow =
    managerRowHolds(state?.manager, refused) || hqHolds(state?.hq, refused) || aomHolds(state?.aom, refused);
  const refusedInBar = !refusedInRow && (barIsShown(state?.desk) || managerBarIsShown(state?.manager));
  const refusedText = refused?.message ?? null;
  // Every stored message is one chat item, numbered in screen order. A local
  // reply counts as the 2 it is stored as (the seat's words and Pip's cards),
  // so the numbers stay the same once a poll brings the stored copy.
  const items = storedMessages + 2 * shownReplies.length;
  // The senior manager's jobs that came up and have since left the desk
  // (solved, or a fix approved): their old notices show as done, and the empty
  // job list says the work moved on instead of "nothing came up" (D1 review).
  const movedOn = jobsMovedOn(state);

  // Once the followed press's or Safety's first new item is on screen, scroll
  // it to the top of the view, once.
  useEffect(() => {
    itemCount.current = items;
    const from = followFrom.current;
    if (from === null || items <= from) return;
    followFrom.current = null;
    bringIntoView(root.current?.querySelector(`[data-item="${from}"]`), "start");
  }, [items]);

  // The control used last, so a press can mark it busy (D1).
  const noteControl = (target: EventTarget | null) => {
    const el = target instanceof Element ? target.closest("button") : null;
    if (el instanceof HTMLElement) lastControl.current = el;
  };

  return (
    <div
      ref={root}
      className={variant === "column" ? "chat column" : "chat"}
      aria-busy={busy || undefined}
      onClickCapture={(event) => noteControl(event.target)}
      onSubmitCapture={(event) => {
        const submitter = (event.nativeEvent as SubmitEvent).submitter ?? event.currentTarget.ownerDocument.activeElement;
        if (submitter instanceof HTMLButtonElement) lastControl.current = submitter;
        else noteControl((event.target as HTMLElement).querySelector?.("button[type=submit]") ?? null);
      }}
    >
      <header className="chat-head">
        <div className="avatar">
          <PipAvatar />
        </div>
        <div>
          <div className="chat-name">
            Pip <span className="seat-word">{seatWord(seat)}</span> <span className="seat-tag code-tag">{seat}</span>
          </div>
          <div className="chat-sub">{state ? seatLabelWords(state.label) : "role-played"}</div>
        </div>
      </header>

      {rail ? <QuestRail title={rail.title} nodes={rail.nodes} /> : null}

      <fieldset className="chat-lock" disabled={busy}>
        <div className="chat-body">
          {opening ? (
            <div className="opening">
              <p>{plainOpening(opening.text)}</p>
              <p className="never">{pipNeverLine(opening.never)}</p>
            </div>
          ) : null}

          {state?.desk ? (
            <TechnicianDesk
              desk={state.desk}
              press={press}
              onSafety={() => void say(SAFETY_WORD, true)}
              onShow={showOnDesk}
              refused={refusedInBar ? refusedText : null}
              done={done}
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
              done={done}
              movedOn={movedOn}
              aiMode={aiMode}
            />
          ) : null}

          {state?.hq ? <HqDesk desk={state.hq} press={press} refused={refusedInRow ? refused : null} /> : null}

          {state?.aom ? <AomDesk desk={state.aom} press={press} refused={refusedInRow ? refused : null} /> : null}

          {/* The AOM desk shows its alerts and charge requests itself (C9), so they are not listed twice. */}
          {state?.notices
            .filter((notice) => !state.aom || !AOM_DESK_NOTICE_KINDS.includes(notice.kind))
            .map((notice, i) => {
              const finished = noticeIsDone(notice, movedOn);
              return (
                <div className={finished ? "notice is-done" : "notice"} key={`notice-${i}`}>
                  <b>
                    {noticeWord(notice.kind)} <CodeTag code={notice.kind} />
                  </b>
                  {finished ? (
                    <span className="notice-done">
                      <span className="badge green">Done</span> This job has left your desk. The note below is from when it came up.
                    </span>
                  ) : null}
                  {/* A safety alert carries the stop's own words (S11): word for word, never through the plain layer. */}
                  {notice.kind === "alert" ? notice.text : <Plain text={notice.text} />}
                  {notice.kind === "speak-first" ? <span className="notice-gloss">{SPEAK_FIRST_MEANS}</span> : null}
                </div>
              );
            })}

          {/* One list, so a typed reply and its stored copy share keys: when a poll swaps one for the other, nothing moves in twice (D1 review). */}
          {[
            ...(state?.messages ?? []).map((message, i) =>
              message.from === "person" ? (
                <div className="sent" key={`m-${i}`} data-item={i}>
                  {message.text}
                </div>
              ) : (
                <div className="msg" key={`m-${i}`} data-item={i}>
                  <Cards cards={message.cards ?? []} press={press} jobId={activeJob} />
                </div>
              )
            ),
            ...shownReplies.flatMap((reply, i) => [
              <div className="sent" key={`m-${storedMessages + 2 * i}`} data-item={storedMessages + 2 * i}>
                {reply.text}
              </div>,
              <div className="msg" key={`m-${storedMessages + 2 * i + 1}`} data-item={storedMessages + 2 * i + 1}>
                <Cards cards={reply.cards} press={press} jobId={activeJob} />
              </div>,
            ]),
          ]}

          {refusedText && !refusedInBar && !refusedInRow ? (
            <div className="notice refused" role="status">
              <b>not done</b>
              <Plain text={refusedText} />
            </div>
          ) : null}

          {sayFailed ? (
            <div className="notice refused" role="status">
              <b>not done</b>
              {NOT_THROUGH}
            </div>
          ) : null}

          <div className="pip-checking-slot" aria-live="polite">
            {checking ? (
              <p className="pip-checking">
                <span className="typing-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span>Pip is checking</span>
              </p>
            ) : null}
          </div>
        </div>

        {seat === "tenant" ? (
          <div className="chips report-row">
            {reporting ? (
              COMPLAINT_BUTTONS.map((b) => (
                <button
                  key={b.complaint}
                  onClick={() => {
                    // The pressed button stays until the reply lands, so it can show
                    // that it is working; then the row goes back (D1 review).
                    void press("report", undefined, { complaint: b.complaint }).then(() => setReporting(false));
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
                {CHIP_LABELS[chip] ?? chip}
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
            placeholder={seat !== "tenant" && activeJob ? `Message Pip about ${activeJob}` : "Message Pip"}
            aria-label="Message Pip"
          />
          <button className="send" type="submit" aria-label="Send">
            Send
          </button>
        </form>
      </fieldset>
    </div>
  );
}

function Cards({ cards, press, jobId }: { cards: ServerCard[]; press: Press; jobId?: string }) {
  return (
    <>
      {cards.map((card, i) => {
        if (card.kind === "safety-list") {
          // A pick raises that stop on the list's own job (a self-check's Q0 Yes),
          // else on the seat's job (S11). Each stop shows in the pill's own
          // words, its code after them as a grey tag (D1).
          const on = card.jobId ?? jobId;
          return (
            <ChatCard key={i} from="Safety" title={card.title} receipt={card.receipt}>
              <ul className="pick-list">
                {card.items?.map((item) => (
                  <li key={item.id}>
                    <span>
                      {item.title} <CodeTag code={item.id} />
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
