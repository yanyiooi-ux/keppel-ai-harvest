"use client";

import { useState } from "react";
import { ChatCard } from "./ChatCard";
import { LeadCard } from "./TechnicianDesk";
import type { RefusedPress } from "./SeniorManagerDesk";
import type { HqDesk as HqDeskView, HqSolutionView, HqRequestRow, HqBuildingB } from "../../../lib/hq-desk";
import type { VersionRow } from "../../../lib/versions";

/**
 * HQ's desk inside the chat (S21's HQ row, C8b): the A1 card, the live
 * version in each building, each new solution sent to HQ with Approve and
 * send to all buildings or Decline, the versions list like commits with Roll
 * back, the outside help requests (A3) with Approve or Decline, and the
 * Building B card.
 *
 * It owns no rules. Every word, label, gate and order comes from /api/state,
 * and every press goes to /api/action, where the server checks the seat and
 * every gate again. A refused press shows its reason in the card that was
 * pressed, so it is on screen next to the button on a phone.
 */

type Press = (action: string, job?: string, payload?: Record<string, unknown>) => Promise<void>;

export interface HqDeskProps {
  desk: HqDeskView;
  press: Press;
  /** A refused HQ press, shown in the card that was pressed (see hqHolds). */
  refused?: RefusedPress | null;
}

/** HQ's presses: each shows its refusal in its own card. */
const HQ_PRESSES = ["approve-solution", "decline-solution", "rollback", "decide-outside-help"];

/** True when the refused press was one of HQ's: the desk shows it where it was pressed. */
export function hqHolds(desk: HqDeskView | undefined, refused: RefusedPress | null): boolean {
  return Boolean(desk && refused && HQ_PRESSES.includes(refused.action));
}

function Refusal({ message }: { message: string }) {
  return (
    <div className="notice refused" role="status">
      <b>not done</b>
      {message}
    </div>
  );
}

export function HqDesk({ desk, press, refused = null }: HqDeskProps) {
  const mine = refused && HQ_PRESSES.includes(refused.action) ? refused : null;
  const onSolution = (s: HqSolutionView) =>
    mine && (mine.action === "approve-solution" || mine.action === "decline-solution") && mine.job === s.jobId ? mine.message : null;
  const onRequest = (r: HqRequestRow) => (mine && mine.action === "decide-outside-help" && mine.job === r.jobId ? mine.message : null);
  const rollbackRefused = mine && mine.action === "rollback" ? mine.message : null;
  // A refusal whose card is no longer on the desk shows at the top of it.
  const placed =
    !mine ||
    rollbackRefused !== null ||
    desk.solutions.some((s) => onSolution(s) !== null) ||
    desk.requests.some((r) => r.canDecide && onRequest(r) !== null);

  // A refusal goes to the first card it fits, never to two.
  const solutionWithRefusal = desk.solutions.find((s) => onSolution(s) !== null)?.id;
  const requestWithRefusal = desk.requests.find((r) => r.canDecide && onRequest(r) !== null)?.id;

  return (
    <section className="desk" aria-label="HQ desk">
      {!placed && mine ? <Refusal message={mine.message} /> : null}

      <ChatCard
        from="A1 · signed before the demo"
        colour="green"
        colourWord="Signed"
        title={desk.a1.title}
        body={desk.a1.line}
        receipt={desk.a1.receipt}
      />

      <ChatCard from="Live in each building">
        <ul className="card-lines">
          {desk.live.map((l) => (
            <li key={l.building}>{`${l.name}: v${l.version}`}</li>
          ))}
        </ul>
      </ChatCard>

      <h4 className="desk-sub">Solutions sent to HQ (A2)</h4>
      {desk.solutions.length === 0 ? <p className="desk-status">No new solution has been sent to HQ yet.</p> : null}
      {desk.solutions.map((s) => (
        <SolutionCard key={s.id} solution={s} press={press} refused={s.id === solutionWithRefusal ? onSolution(s) : null} />
      ))}

      <h4 className="desk-sub">Versions, newest first</h4>
      <VersionsCard versions={desk.versions} rollback={desk.rollback} press={press} refused={rollbackRefused} />

      <h4 className="desk-sub">Outside help (A3)</h4>
      {desk.requests.length === 0 ? <p className="desk-status">No outside help request yet.</p> : null}
      {desk.requests.map((r) => (
        <RequestCard key={r.id} request={r} press={press} refused={r.id === requestWithRefusal ? onRequest(r) : null} />
      ))}

      {desk.buildingB ? <BuildingBView card={desk.buildingB} press={press} /> : null}
    </section>
  );
}

// ---- A solution sent to HQ (A2) ----

function SolutionCard({ solution: s, press, refused }: { solution: HqSolutionView; press: Press; refused: string | null }) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <div data-testid={`hq-solution-${s.id}`}>
      <ChatCard
        from={`New solution · ${s.id} · job ${s.jobId}`}
        colour={s.colour}
        colourWord={s.statusWord}
        title={`Cause: ${s.causeLabel}`}
        receipt={s.receipt}
      >
        <p className="desk-status">{s.place}</p>
        <p className="desk-status">{s.statusLine}</p>

        <p className="typed-line">
          <span className="lead-k">Fix line</span>
          <span>{s.fixLine}</span>
        </p>
        <p className="typed-line">
          <span className="lead-k">Why line</span>
          <span>{s.whyLine}</span>
        </p>
        <p className="typed-line">
          <span className="lead-k">Rule text</span>
          <span>{s.ruleText}</span>
          <span className="part-label">{s.ruleTextLabel}</span>
        </p>

        <span className="lead-k">Condition</span>
        <ul className="card-lines">
          {s.condition.map((c) => (
            <li key={c.id}>
              <b>{c.title}</b> <span>{c.display}</span> <span className="part-label">{c.label}</span>
              {c.stepText ? <span className="job-status">{c.stepText}</span> : null}
            </li>
          ))}
        </ul>

        {s.counts ? (
          <div className="test-run">
            <p className="test-counts">
              <span className="badge green">{`${s.passed} passed`}</span>
              <span className={`badge ${s.failed ? "red" : "green"}`}>{`${s.failed} failed`}</span>
              <span className="badge none">{`${s.notApplicable} not applicable`}</span>
            </p>
            <p className="code-line">{`Tests on draft v${s.version} · ${s.hash7}`}</p>
          </div>
        ) : null}

        {s.gates.length > 0 ? (
          <>
            <span className="lead-k">Before it can go live (S16)</span>
            <ul className="card-lines">
              {[...s.gates, ...(s.baseCheck ? [s.baseCheck] : [])].map((g) => (
                <li key={g.id}>
                  <span className={`badge ${g.colour}`}>{g.word}</span>
                  {g.label}
                  {g.reason ? <span className="job-status">{g.reason}</span> : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <p className="code-line">{s.sentLine}</p>

        {refused ? <Refusal message={refused} /> : null}

        {s.canDecide ? (
          <div className="decide">
            <div className="decide-row">
              <button className="approve-btn" onClick={() => void press("approve-solution", s.jobId)}>
                Approve and send to all buildings
              </button>
              <button className="decline-btn" aria-expanded={declining} onClick={() => setDeclining((d) => !d)}>
                Decline
              </button>
            </div>
            {declining ? (
              <form
                className="job-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void press("decline-solution", s.jobId, { reason });
                }}
              >
                <label>
                  Reason for declining (3 words or more)
                  <input type="text" value={reason} onChange={(event) => setReason(event.target.value)} />
                </label>
                <button type="submit" className="submit">
                  Decline with this reason
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </ChatCard>
    </div>
  );
}

// ---- Versions like commits (S16 items 10 and 11) ----

function VersionsCard({
  versions,
  rollback,
  press,
  refused,
}: {
  versions: VersionRow[];
  rollback: HqDeskView["rollback"];
  press: Press;
  refused: string | null;
}) {
  return (
    <div data-testid="hq-versions">
      <ChatCard from="Versions, like commits" receipt="Versions · AI calls: 0">
        <ol className="card-lines version-list">
          {versions.map((v) => (
            <li key={v.version}>
              <span className={`badge ${v.colour}`}>{v.statusWord}</span>
              <span className="version-line">{v.line}</span>
              <span className="job-status">
                {v.when ? `Approved ${v.when}` : "A1: signed before the demo"}
                {v.ruleId ? ` · adds ${v.ruleId}` : ""}
              </span>
              {v.why ? <span className="job-status">{`Why: ${v.why}`}</span> : null}
            </li>
          ))}
        </ol>
        {rollback ? (
          <div className="decide">
            <p className="code-line">{rollback.line}</p>
            <button
              className="rollback-btn"
              aria-label={`Roll back v${rollback.version}`}
              onClick={() => void press("rollback", undefined, { version: rollback.version })}
            >
              Roll back
            </button>
          </div>
        ) : null}
        {refused ? <Refusal message={refused} /> : null}
      </ChatCard>
    </div>
  );
}

// ---- Outside help (A3) ----

function RequestCard({ request: r, press, refused }: { request: HqRequestRow; press: Press; refused: string | null }) {
  const [reason, setReason] = useState("");
  return (
    <div data-testid={`hq-request-${r.id}`}>
      <ChatCard from={`Outside help · ${r.id}`} colour={r.colour} colourWord={r.statusWord} receipt="Outside help · AI calls: 0">
        <ul className="card-lines">
          {r.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {r.result ? <p className="send-line">{r.result}</p> : null}
        {r.canDecide ? (
          <form className="job-form" onSubmit={(event) => event.preventDefault()}>
            <label>
              Reason (3 words or more)
              <input type="text" value={reason} onChange={(event) => setReason(event.target.value)} />
            </label>
            <div className="decide-row">
              <button
                type="button"
                className="approve-btn"
                aria-label={`Approve outside help for job ${r.jobId}`}
                onClick={() => void press("decide-outside-help", r.jobId, { decision: "approve", reason })}
              >
                Approve
              </button>
              <button
                type="button"
                className="decline-btn"
                aria-label={`Decline outside help for job ${r.jobId}`}
                onClick={() => void press("decide-outside-help", r.jobId, { decision: "decline", reason })}
              >
                Decline
              </button>
            </div>
          </form>
        ) : null}
        {refused ? <Refusal message={refused} /> : null}
      </ChatCard>
    </div>
  );
}

// ---- The Building B card (S21) ----

function BuildingBView({ card, press }: { card: HqBuildingB; press: Press }) {
  return (
    <div className="desk" data-testid="hq-building-b">
      <h4 className="desk-sub">Building B card</h4>
      <ChatCard from={card.from} title={card.title} body={`Live version v${card.version}. ${card.ticket}`} aiOff={card.aiOff} receipt={card.receipt}>
        {card.alerts.map((alert, i) => (
          <div className="notice" key={`b-${i}`}>
            <b>{alert.kind.replace(/-/g, " ")}</b>
            {alert.text}
          </div>
        ))}
        {/* Not a seat: no buttons except Safety for its own stops (S21), a plain list as on home. */}
        <details className="safety-details">
          <summary className="safety-btn">Safety</summary>
          {card.openHere.length > 0 ? (
            <p className="open-stop">{`Open here now: ${card.openHere.join(", ")}`}</p>
          ) : (
            <p className="card-mean">No red stop open in Building B.</p>
          )}
          <ul className="stop-list">
            {card.stops.map((stop) => (
              <li key={stop.id}>
                <b>{stop.id}</b> {stop.trigger}
              </li>
            ))}
          </ul>
        </details>
      </ChatCard>
      {card.leads.map((lead) => (
        <LeadCard key={lead.causeId} lead={lead} jobId={card.jobId} press={press} editable={false} />
      ))}
    </div>
  );
}
