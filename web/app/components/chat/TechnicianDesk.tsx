"use client";

import { useState } from "react";
import { ChatCard } from "./ChatCard";
import { CodeTag, Plain } from "../Plain";
import { statusWord, tierWord } from "../../../lib/plain-words";
import type {
  TechnicianDesk as Desk,
  DeskCard,
  DeskLead,
  DeskStep,
  OpenJobDesk,
} from "../../../lib/technician-desk";

/**
 * The technician's desk inside the chat (S21, C7b), phone first: the Tower A
 * job list with Open job, then the open job's filled checklist, the ranked
 * leads with Found it, Not this and Clear, the ruled out and removed leads
 * (collapsed), the pill steps with their filled values, and a bar that stays at
 * the bottom of the screen while the job is in progress: Solved, Not solved,
 * Send with the cause and Safety.
 *
 * It owns no rules. Every word and every order comes from /api/state, and every
 * press goes to /api/action, where the server checks the seat and the status
 * and plans again; the chat reloads the view right after each press, so a tick
 * re-ranks on screen before the next 2-second poll.
 *
 * Plain words first (D1): a job's status and a lead's tier show in plain words
 * with the code kept after them as a grey tag, and a code inside a reason or a
 * fix line shows its plain words too (components/Plain.tsx).
 */

/** The open job's status line: the engine's own line, with a bare status code put into plain words (D1). */
export function StatusLine({ status, line }: { status: string; line: string }) {
  if (line === `Status: ${status.replace(/-/g, " ")}.`) {
    return (
      <p className="desk-status">
        {`Status: ${statusWord(status)}. `}
        <CodeTag code={status} />
      </p>
    );
  }
  return <p className="desk-status">{line}</p>;
}

type Press = (action: string, job?: string, payload?: Record<string, unknown>) => Promise<void>;

export interface TechnicianDeskProps {
  desk: Desk;
  press: Press;
  /** Opens the Safety list, the same as the Safety chip. */
  onSafety: () => void;
  /** Show job: puts another in-progress job on the desk. A view only, never a press. */
  onShow?: (jobId: string) => void;
  /** A refused press's reason, shown in the bar so it is on screen next to the press. */
  refused?: string | null;
  /** The last tick that worked, so the list says what changed (D1 review). */
  done?: TickDone | null;
}

/** A tick that worked: what was pressed, on which job, with what (the same shape as a refused press). */
export interface TickDone {
  action: string;
  job?: string;
  payload?: Record<string, unknown>;
}

/**
 * What the last tick did, in plain words, next to the list it changed (D1
 * review): "Ruled out: X. The list re-ranked: Y is now first." Read from the
 * view the press brought back, so it says what the screen shows.
 */
export function tickLine(done: TickDone | null | undefined, open: OpenJobDesk): string | null {
  if (!done || done.action !== "tick" || done.job !== open.jobId) return null;
  const causeId = String(done.payload?.causeId ?? "");
  const type = String(done.payload?.type ?? "");
  const all = [...open.leads, ...open.ruledOut];
  const label = all.find((l) => l.causeId === causeId)?.label;
  if (!label) return null;
  const first = open.leads[0]?.label;
  if (type === "not-this") {
    const next = first ? ` The list re-ranked: "${first}" is now first.` : " No likely cause is left on the list.";
    return `Ruled out: "${label}".${next}`;
  }
  if (type === "found") return `Found it: "${label}". It is now at the top.`;
  if (type === "clear") return `Cleared: "${label}" is back on the list.${first ? ` "${first}" is first.` : ""}`;
  return null;
}

/** The trend card's zone, from its own line ("the west zone's VAV damper ..."), or null. */
function trendZone(card: DeskCard): string | null {
  return card.id.startsWith("trend-") ? (/the (\w+) zone's/.exec(card.codeLine ?? "")?.[1] ?? null) : null;
}

export function TechnicianDesk({ desk, press, onSafety, onShow, refused = null, done = null }: TechnicianDeskProps) {
  return (
    <section className="desk" aria-label="Technician desk">
      <article className="card">
        <div className="card-from">{desk.title}</div>
        <ul className="job-rows">
          {desk.jobs.map((job) => (
            <li key={job.id} className={job.isOpen ? "job-row is-open" : "job-row"}>
              <span>
                <b>{job.id}</b>
                {job.place} · {job.complaint} · {job.reported}
                <span className="job-status">
                  {job.isOpen ? `On your desk · ${statusWord(job.status)} ` : `${statusWord(job.status)} `}
                  <CodeTag code={job.status} />
                </span>
              </span>
              {job.canOpen ? (
                <button className="open-btn" aria-label={`Open job ${job.id}`} onClick={() => void press("open-job", job.id)}>
                  Open job
                </button>
              ) : job.canShow && onShow ? (
                <button className="open-btn" aria-label={`Show job ${job.id}`} onClick={() => onShow(job.id)}>
                  Show job
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </article>

      {desk.open ? (
        <OpenJob key={desk.open.jobId} open={desk.open} press={press} onSafety={onSafety} refused={refused} done={done} />
      ) : null}
    </section>
  );
}

/**
 * One checklist card. The senior manager's desk shows the same cards (C8a).
 * `jobZone` is the open job's zone: a trend warning about another zone says
 * so before the stop's own words, so it never reads as this job's emergency
 * (D1 review). The stop's words stay word for word.
 */
export function DeskCardView({ card, jobZone }: { card: DeskCard; jobZone?: string }) {
  const zone = trendZone(card);
  const intro = zone
    ? `Also seen in the trend data: a warning for the ${zone} zone of this floor${
        jobZone && jobZone !== zone ? `, not this job's ${jobZone} zone` : ""
      }. Nothing is locked, and this job carries on.`
    : null;
  return (
    <>
      {intro ? <p className="card-intro">{intro}</p> : null}
      <DeskCardBody card={card} />
    </>
  );
}

function DeskCardBody({ card }: { card: DeskCard }) {
  return (
    <ChatCard
      from={card.from}
      colour={card.colour ?? "none"}
      colourWord={card.colourWord}
      title={card.title}
      body={card.body}
      call={card.call}
      receipt={card.receipt}
    >
      {card.codeLine ? (
        <p className="code-line">
          <Plain text={card.codeLine} />
        </p>
      ) : null}
      {card.lines && card.lines.length > 0 ? (
        <ul className="card-lines">
          {card.lines.map((line, i) => (
            <li key={i}>
              {line.word ? <span className={`badge ${line.colour ?? "none"}`}>{line.word}</span> : null}
              <span>
                <Plain text={line.text} />
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </ChatCard>
  );
}

/** One lead with Found it, Not this or Clear. The senior manager's desk uses it for its own ranked list (C8a). */
export function LeadCard({
  lead,
  jobId,
  press,
  editable,
}: {
  lead: DeskLead;
  jobId: string;
  press: Press;
  editable: boolean;
}) {
  const tick = (type: "found" | "not-this" | "clear") => void press("tick", jobId, { causeId: lead.causeId, type });
  return (
    <div data-testid="lead-card" data-cause={lead.causeId}>
      <ChatCard
        colour={lead.tier === "found" ? "green" : "none"}
        colourWord={tierWord(lead.tier)}
        colourCode={lead.tier}
        title={lead.label}
        body={lead.reason}
        aiWording={lead.aiWording}
        aiBanner={lead.aiBanner}
        aiNotice={lead.aiNotice}
        aiOff={lead.aiOff}
        receipt={lead.receipt}
      >
        <p className="lead-check">
          <span className="lead-k">{`How to check · step ${lead.checkStep} · ${lead.checkTime}`}</span>
          <span>{lead.checkText}</span>
        </p>
        <p className="lead-fix">
          <span className="lead-k">{lead.fixAllowedHere ? "The fix · you can make it" : "The fix · someone else makes it"}</span>
          <span>
            <Plain text={lead.fixLine} />
          </span>
        </p>
        {editable ? (
          <div className="tick-row">
            {lead.tick === null ? (
              <>
                <button className="found-btn" aria-label={`Found it: ${lead.label}`} onClick={() => tick("found")}>
                  Found it
                </button>
                <button className="not-btn" aria-label={`Not this: ${lead.label}`} onClick={() => tick("not-this")}>
                  Not this
                </button>
              </>
            ) : (
              <button className="clear-btn" aria-label={`Clear: ${lead.label}`} onClick={() => tick("clear")}>
                Clear
              </button>
            )}
          </div>
        ) : null}
      </ChatCard>
    </div>
  );
}

export function StepList({ steps }: { steps: DeskStep[] }) {
  return (
    <ol className="step-list">
      {steps.map((step) => (
        <li key={step.step}>
          <span className={`badge ${step.colour}`}>{step.colourWord}</span>
          <b className="step-no">{`Step ${step.step}`}</b>
          <span className="step-who">{step.who}</span>
          <p>{step.text}</p>
          {step.filled ? (
            <p className="step-filled">
              <Plain text={`Filled: ${step.filled}`} />
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/** The open job's zone, from its place card ("Tower A, Level 23, core"), for the trend card's intro. */
export function zoneOf(open: OpenJobDesk): string | undefined {
  const place = open.checklist.find((c) => c.id === "place")?.title;
  return place ? place.split(", ").at(-1) : undefined;
}

function OpenJob({
  open,
  press,
  onSafety,
  refused,
  done,
}: {
  open: OpenJobDesk;
  press: Press;
  onSafety: () => void;
  refused: string | null;
  done: TickDone | null;
}) {
  const ticked = tickLine(done, open);
  const jobZone = zoneOf(open);
  if (open.locked) {
    return (
      <div className="open-job">
        <h3 className="desk-head">{open.title}</h3>
        {open.locked.cards.map((card) => (
          <DeskCardView key={card.id} card={card} />
        ))}
        {open.locked.lockLines.map((line) => (
          <p key={line} className="lock-line">
            {line}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="open-job">
      <h3 className="desk-head">{open.title}</h3>
      <StatusLine status={open.status} line={open.statusLine} />

      <h4 className="desk-sub">Filled checklist: what we already know</h4>
      {open.checklist.map((card) => (
        <DeskCardView key={card.id} card={card} jobZone={jobZone} />
      ))}

      <h4 className="desk-sub">Likely causes, best bet first</h4>
      {ticked ? (
        <p className="tick-done" role="status">
          {ticked}
        </p>
      ) : null}
      {open.leads.length === 0 ? <p className="desk-status">No live lead is left on this job.</p> : null}
      {open.leads.map((lead) => (
        <LeadCard key={lead.causeId} lead={lead} jobId={open.jobId} press={press} editable={open.inProgress} />
      ))}

      <details className="desk-details" data-list="ruled-out">
        <summary>{`Ruled out (${open.ruledOut.length})`}</summary>
        {open.ruledOut.map((lead) => (
          <LeadCard key={lead.causeId} lead={lead} jobId={open.jobId} press={press} editable={open.inProgress} />
        ))}
      </details>

      <details className="desk-details" data-list="removed">
        <summary>{`Removed (${open.removed.length})`}</summary>
        <ul className="card-lines">
          {open.removed.map((r) => (
            <li key={r.causeId}>
              <b>{r.label}</b>
              <span>
                {" "}
                <Plain text={r.reason} />
              </span>
            </li>
          ))}
        </ul>
      </details>

      {/* Closed at first (D1 review): the full list is for engineers, and the leads above say what to check. */}
      <details className="desk-details" data-list="steps">
        <summary>{`All ${open.steps.length} checklist steps from the rule book (for engineers)`}</summary>
        <StepList steps={open.steps} />
      </details>

      {open.inProgress ? <JobBar jobId={open.jobId} press={press} onSafety={onSafety} refused={refused} /> : null}
    </div>
  );
}

/** True when the open job's bar is on screen, so a refusal shows there instead of at the end of the chat. */
export function barIsShown(desk: Desk | undefined): boolean {
  return Boolean(desk?.open?.inProgress && !desk.open.locked);
}

type Form = "none" | "solved" | "not-solved";

function JobBar({
  jobId,
  press,
  onSafety,
  refused,
}: {
  jobId: string;
  press: Press;
  onSafety: () => void;
  refused: string | null;
}) {
  const [form, setForm] = useState<Form>("none");
  const [why, setWhy] = useState("");
  const [hours, setHours] = useState("");
  const [visits, setVisits] = useState("");
  const [contractor, setContractor] = useState<boolean | null>(null);

  const toggle = (next: Form) => setForm((now) => (now === next ? "none" : next));

  return (
    <div className="job-bar" role="group" aria-label={`Job ${jobId} presses`}>
      {refused ? (
        <div className="notice refused" role="status">
          <b>not done</b>
          <Plain text={refused} />
        </div>
      ) : null}

      {form === "solved" ? (
        <form
          className="job-form"
          onSubmit={(event) => {
            event.preventDefault();
            void press("solved", jobId, { whyLine: why });
          }}
        >
          <label>
            One line of why (3 to 30 words)
            <input type="text" value={why} onChange={(event) => setWhy(event.target.value)} />
          </label>
          <button type="submit" className="submit">
            Mark solved
          </button>
        </form>
      ) : null}

      {form === "not-solved" ? (
        <form
          className="job-form"
          onSubmit={(event) => {
            event.preventDefault();
            // An empty field is left out, never sent as 0, so the server asks for it.
            const payload: Record<string, unknown> = {};
            if (hours.trim() !== "") payload.hoursLost = Number(hours);
            if (visits.trim() !== "") payload.extraVisits = Number(visits);
            if (contractor !== null) payload.contractorOrPartsNeeded = contractor;
            void press("not-solved", jobId, payload);
          }}
        >
          <label>
            Hours lost (0 to 100)
            <input type="number" min={0} max={100} value={hours} onChange={(event) => setHours(event.target.value)} />
          </label>
          <label>
            Extra visits needed (0 to 10)
            <input type="number" min={0} max={10} step={1} value={visits} onChange={(event) => setVisits(event.target.value)} />
          </label>
          <fieldset>
            <legend>Contractor or parts needed</legend>
            <label className="radio">
              <input
                type="radio"
                name={`contractor-${jobId}`}
                value="yes"
                checked={contractor === true}
                onChange={() => setContractor(true)}
              />
              Yes
            </label>
            <label className="radio">
              <input
                type="radio"
                name={`contractor-${jobId}`}
                value="no"
                checked={contractor === false}
                onChange={() => setContractor(false)}
              />
              No
            </label>
          </fieldset>
          <button type="submit" className="submit">
            Send to the senior manager
          </button>
        </form>
      ) : null}

      <div className="job-bar-buttons">
        <button className="solved-btn" aria-expanded={form === "solved"} onClick={() => toggle("solved")}>
          Solved
        </button>
        <button className="not-solved-btn" aria-expanded={form === "not-solved"} onClick={() => toggle("not-solved")}>
          Not solved
        </button>
        <button className="cause-btn" onClick={() => void press("send-with-cause", jobId)}>
          Send with the cause
        </button>
        <button className="safety-btn" onClick={onSafety}>
          Safety
        </button>
      </div>
    </div>
  );
}
