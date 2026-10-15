"use client";

import { useState } from "react";
import { ChatCard } from "./ChatCard";
import { CodeTag, Plain } from "../Plain";
import { noticeWord } from "../../../lib/plain-words";
import type { RefusedPress } from "./SeniorManagerDesk";
import type { AomDesk as AomDeskView, AomChargeView } from "../../../lib/aom-desk";
import type { ImpactMeter, ImpactSide } from "../../../lib/impact";

/**
 * The AOM's desk inside the chat (S21's AOM row, C9): the impact meter (S18)
 * with its two tabs and the speak-first flag, the charge requests (A4) with
 * Decide charge, the safety alerts for Tower A, the live version in Tower A
 * (read only) and the Not solved impact records.
 *
 * It owns no rules and writes no words of its own about the job. Every
 * number, line and label comes from /api/state, and the one press, Decide
 * charge, goes to /api/action, where the server checks the seat, the request,
 * the amount and the reason again. A refused press shows its reason in the
 * request's card, next to the button on a phone. The tabs are only a view.
 *
 * Plain words first (D1): approvals, rules, stops and notices show in plain
 * words with the code kept after them as a grey tag (components/Plain.tsx).
 */

type Press = (action: string, job?: string, payload?: Record<string, unknown>) => Promise<void>;

export interface AomDeskProps {
  desk: AomDeskView;
  press: Press;
  /** A refused Decide charge, shown in the card that was pressed (see aomHolds). */
  refused?: RefusedPress | null;
}

/** The notice kinds this desk shows itself, so the seat's plain notice list leaves them out. */
export const AOM_DESK_NOTICE_KINDS = ["alert", "charge-request"];

/** True when the refused press was Decide charge: the desk shows it where it was pressed. */
export function aomHolds(desk: AomDeskView | undefined, refused: RefusedPress | null): boolean {
  return Boolean(desk && refused && refused.action === "decide-charge");
}

function Refusal({ message }: { message: string }) {
  return (
    <div className="notice refused" role="status">
      <b>not done</b>
      {message}
    </div>
  );
}

export function AomDesk({ desk, press, refused = null }: AomDeskProps) {
  const mine = refused && refused.action === "decide-charge" ? refused : null;
  const asked = mine ? String(mine.payload?.requestId ?? "") : "";
  // A refusal goes to the open card that was pressed, never to two; else to the top.
  const pressedCard =
    mine && desk.charges.find((c) => c.open && (c.id === asked || (!asked && c.jobId === mine.job)))?.id;

  return (
    <section className="desk" aria-label="AOM desk">
      {mine && !pressedCard ? <Refusal message={mine.message} /> : null}

      <h4 className="desk-sub">Impact meter</h4>
      {desk.meter ? (
        <MeterCard meter={desk.meter} flags={desk.speakFirst} />
      ) : (
        <p className="desk-status">No calls at Tower A Level 23 yet.</p>
      )}

      <h4 className="desk-sub">
        Who pays? Your decisions <CodeTag code="A4" />
      </h4>
      {desk.charges.length === 0 ? <p className="desk-status">No charge request is waiting on you.</p> : null}
      {desk.charges.map((c) => (
        <ChargeCard key={c.id} charge={c} desk={desk} press={press} refused={c.id === pressedCard ? mine!.message : null} />
      ))}

      <h4 className="desk-sub">Safety alerts, Tower A</h4>
      <div className="desk" data-testid="aom-alerts">
        <p className="desk-status">
          {desk.openStops.length > 0 ? (
            <Plain text={`Open now in Tower A: ${desk.openStops.join(", ")}`} />
          ) : (
            "No red stop open in Tower A."
          )}
        </p>
        {desk.alerts.length === 0 ? <p className="desk-status">No safety alert has come to you.</p> : null}
        {desk.alerts.map((alert, i) => (
          <div className="notice" key={`a-${i}`}>
            <b>
              {noticeWord("alert")} <CodeTag code="alert" />
            </b>
            {/* A safety alert carries the stop's own words (S11): word for word, never through the plain layer. */}
            {alert.text}
          </div>
        ))}
      </div>

      <h4 className="desk-sub">Live in Tower A</h4>
      <div data-testid="aom-live">
        <ChatCard from="Live version, read only" receipt="Versions · AI calls: 0">
          <p className="version-line">{desk.live.line}</p>
        </ChatCard>
      </div>

      {desk.impactRecords.length > 0 ? (
        <>
          <h4 className="desk-sub">Impact records from Not solved</h4>
          <div data-testid="aom-impact-records">
            <ChatCard from="Typed by the technician, costed by code" receipt="Made-up rates · AI calls: 0">
              <ul className="card-lines">
                {desk.impactRecords.map((r) => (
                  <li key={r.jobId}>
                    <b>{`Job ${r.jobId}`}</b>
                    <span className="job-status">{r.line}</span>
                  </li>
                ))}
              </ul>
            </ChatCard>
          </div>
        </>
      ) : null}
    </section>
  );
}

// ---- The impact meter (S18) ----

type Tab = "before" | "with";

function MeterCard({ meter, flags }: { meter: ImpactMeter; flags: AomDeskView["speakFirst"] }) {
  const [tab, setTab] = useState<Tab>("before");
  const side: ImpactSide | null = tab === "before" ? meter.before : meter.withPillDesk;
  return (
    <div data-testid="aom-meter">
      <ChatCard from={`Impact meter · ${meter.place}`} receipt="Impact meter · made-up rates · AI calls: 0">
        {flags.map((f) => (
          <div className="flag-line" key={f.spotKey}>
            <span className="flag-head">
              <span className="badge amber">{noticeWord("speak-first")}</span> <CodeTag code="speak-first" />
            </span>
            <span>
              <Plain text={f.text} />
            </span>
          </div>
        ))}

        <div className="meter-tabs" role="tablist" aria-label="Impact meter view">
          <button
            type="button"
            role="tab"
            id="meter-tab-before"
            aria-controls="meter-panel"
            aria-selected={tab === "before"}
            className="meter-tab"
            onClick={() => setTab("before")}
          >
            Before
          </button>
          <button
            type="button"
            role="tab"
            id="meter-tab-with"
            aria-controls="meter-panel"
            aria-selected={tab === "with"}
            className="meter-tab"
            onClick={() => setTab("with")}
          >
            With Pill Desk
          </button>
        </div>

        <div role="tabpanel" id="meter-panel" aria-labelledby={tab === "before" ? "meter-tab-before" : "meter-tab-with"} className="meter-panel">
          {tab === "before" ? (
            <p className="meter-kind">
              <span className="badge amber">As it happened</span>
            </p>
          ) : (
            <p className="meter-kind">
              <span className="badge green">Replayed by code</span>
              {meter.withPillDesk ? <span className="meter-caught">{`Caught at ${meter.withPillDesk.caughtId} on ${meter.withPillDesk.caughtOn}`}</span> : null}
            </p>
          )}
          {side ? (
            <dl className="meter-rows">
              <dt>Calls</dt>
              <dd>{side.calls}</dd>
              <dt>Visits</dt>
              <dd>{side.visits}</dd>
              <dt>Senior manager checks</dt>
              <dd>{side.seniorChecks}</dd>
              <dt>Days to a real fix</dt>
              <dd>{side.daysLine}</dd>
              <dt>Repeat calls</dt>
              <dd>{side.repeatCalls}</dd>
              <dt>Cost</dt>
              <dd className="meter-cost">{side.costLine}</dd>
            </dl>
          ) : (
            <p className="desk-status">No repeat caught at this spot yet.</p>
          )}
        </div>

        <p className="meter-label">{meter.label}</p>
      </ChatCard>
    </div>
  );
}

// ---- A charge request (A4, S17) ----

function ChargeCard({
  charge: c,
  desk,
  press,
  refused,
}: {
  charge: AomChargeView;
  desk: AomDeskView;
  press: Press;
  refused: string | null;
}) {
  const [choice, setChoice] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  return (
    <div data-testid={`aom-charge-${c.id}`}>
      <ChatCard
        from={`Who pays? · job ${c.jobId}`}
        fromCode={c.id}
        colour={c.colour}
        colourWord={c.statusWord}
        body={c.text}
        receipt={c.receipt}
      >
        <p className="desk-status">{c.openedLine}</p>

        {c.open ? (
          <form
            className="job-form"
            onSubmit={(event) => {
              event.preventDefault();
              const payload: Record<string, unknown> = { requestId: c.id, reason };
              if (choice) payload.choice = choice;
              // The amount goes as a number, from the number field, for Tenant pays only.
              if (choice === "tenant-pays") payload.amount = amount.trim() === "" ? null : Number(amount);
              void press("decide-charge", c.jobId, payload);
            }}
          >
            <fieldset>
              <legend>Who pays?</legend>
              {desk.choices.map((ch) => (
                <label className="radio" key={ch.id}>
                  <input
                    type="radio"
                    name={`who-pays-${c.id}`}
                    value={ch.id}
                    checked={choice === ch.id}
                    onChange={() => setChoice(ch.id)}
                  />
                  {ch.label}
                </label>
              ))}
            </fieldset>
            {choice === "tenant-pays" ? (
              <label>
                {`Amount in S$, a made-up demo amount (whole number, ${desk.amountMin} to ${desk.amountMax})`}
                <input
                  type="number"
                  inputMode="numeric"
                  min={desk.amountMin}
                  max={desk.amountMax}
                  step={1}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </label>
            ) : null}
            <label>
              Reason (3 words or more)
              <input type="text" value={reason} onChange={(event) => setReason(event.target.value)} />
            </label>
            <button type="submit" className="submit">
              Decide charge
            </button>
          </form>
        ) : null}

        {c.decision ? (
          <>
            <ul className="card-lines">
              <li>
                <b>{`${c.decision.choiceLabel} · ${c.decision.costLine}`}</b>
              </li>
              <li>{`Reason: ${c.decision.reason}`}</li>
              <li className="job-status">{c.decision.byLine}</li>
            </ul>
            {c.tenantCard ? (
              <>
                <span className="lead-k sent-k">Sent to the tenant, word for word</span>
                <p className="send-line">{c.tenantCard}</p>
              </>
            ) : null}
          </>
        ) : null}

        {refused ? <Refusal message={refused} /> : null}
      </ChatCard>
    </div>
  );
}
