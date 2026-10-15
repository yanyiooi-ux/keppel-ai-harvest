"use client";

import { useEffect, useRef, useState } from "react";
import { SeatChat } from "../chat/SeatChat";
import { BuildingBView } from "../chat/HqDesk";
import type { LiveSeat, DemoStep } from "../../../lib/how";
import type { HqBuildingB } from "../../../lib/hq-desk";

/**
 * The live wall on /how (S22, C10a): the 5 real chats side by side, AOM Tower
 * A first, each the real SeatChat on the one shared memory (never a
 * recording), plus the Building B card. Each chat reads /api/state every 2
 * seconds and presses through /api/action, exactly as on its own seat page,
 * so a press in one chat shows in the others within one poll.
 *
 * The bar holds the real Reset (POST /api/reset, then the page reloads, as
 * the top bar's Reset demo does) and the demo steps as text. Nothing plays by
 * itself: no beat player, no auto-play. Tests pass their own fetch, a poll
 * interval of 0 and their own reload, and nothing here touches the network.
 */

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export interface HowLiveProps {
  seats: LiveSeat[];
  /** Building B's card, the same view the HQ seat shows; null if 2401 is gone. */
  buildingB: HqBuildingB | null;
  steps: DemoStep[];
  fetcher?: Fetcher;
  /** 0 means never poll. The live app uses 2000 (S20). */
  pollMs?: number;
  reload?: () => void;
}

const noPress = async () => {};

export function HowLive({ seats, buildingB, steps, fetcher, pollMs = 2000, reload }: HowLiveProps) {
  const call = useRef<Fetcher>(fetcher ?? ((input, init) => fetch(input, init)));
  const resetting = useRef(false);
  // Reset demo shows it is working until the page reloads (D1).
  const [busy, setBusy] = useState(false);

  const reset = async () => {
    if (resetting.current) return;
    resetting.current = true;
    setBusy(true);
    try {
      await call.current("/api/reset", { method: "POST" });
    } finally {
      (reload ?? (() => window.location.reload()))();
    }
  };

  return (
    <section id="live" className="how-live" aria-labelledby="live-title">
      <div className="how-live-head">
        <p className="how-kicker">4 · The live chats</p>
        <h2 id="live-title">{`The ${seats.length} real chats, side by side`}</h2>
        <p>
          Each column is the real seat on the one shared memory, never a recording. Nothing plays by itself: follow the
          steps and press the buttons. A press in one chat shows in the others within one poll, about 2 seconds.
        </p>
      </div>

      <div className="live-bar" data-testid="live-bar" role="region" aria-label="Demo bar">
        <button
          type="button"
          className={busy ? "reset-btn live-reset is-pending" : "reset-btn live-reset"}
          aria-busy={busy || undefined}
          disabled={busy}
          onClick={() => void reset()}
        >
          Reset demo
        </button>
        <details className="live-steps">
          <summary>
            {`Demo steps (${steps.length})`}
            <span className="steps-hint">: which seat, which button</span>
          </summary>
          <ol data-testid="demo-steps">
            {steps.map((step, i) => (
              <li key={i}>
                <b>{step.who}</b>
                <span>{step.text}</span>
              </li>
            ))}
          </ol>
        </details>
      </div>

      <div className="live-wall">
        {seats.map((s) => (
          <div className="live-tile" data-testid="live-tile" data-seat={s.seat} key={s.seat}>
            <SeatChat
              seat={s.seat}
              jobId={s.jobId}
              initial={s.initial}
              opening={s.opening}
              variant="column"
              fetcher={fetcher}
              pollMs={pollMs}
            />
            <a className="live-open" href={s.href}>
              Open this seat alone
            </a>
          </div>
        ))}
        <BuildingBLive initial={buildingB} fetcher={call.current} pollMs={pollMs} />
      </div>
    </section>
  );
}

/**
 * Building B's card, kept fresh from the same /api/state the HQ seat reads, so
 * after HQ approves it puts the new first lead on screen within one poll.
 * Not a seat: no buttons except its own Safety list (S21).
 */
function BuildingBLive({ initial, fetcher, pollMs }: { initial: HqBuildingB | null; fetcher: Fetcher; pollMs: number }) {
  const [card, setCard] = useState<HqBuildingB | null>(initial);

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const response = await fetcher("/api/state?seat=hq");
        const data = (await response.json()) as { hq?: { buildingB: HqBuildingB | null } };
        if (live && data.hq) setCard(data.hq.buildingB);
      } catch {
        // Keep the card already on screen; the next poll tries again.
      }
    };
    void load();
    if (pollMs <= 0) {
      return () => {
        live = false;
      };
    }
    const timer = setInterval(() => void load(), pollMs);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [fetcher, pollMs]);

  return (
    <div className="live-tile live-b" data-testid="how-building-b">
      {card ? <BuildingBView card={card} press={noPress} /> : <p className="desk-status">Building B has no open ticket.</p>}
    </div>
  );
}
