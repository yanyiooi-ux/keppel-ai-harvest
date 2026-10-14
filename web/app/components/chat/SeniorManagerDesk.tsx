"use client";

import { useEffect, useRef, useState } from "react";
import { ChatCard } from "./ChatCard";
import { DeskCardView, LeadCard, StepList } from "./TechnicianDesk";
import type {
  ManagerDesk,
  ManagerOpenJob,
  ManagerSolutionView,
  ManagerPartView,
  ManagerStopRow,
  ManagerCaseRow,
  ManagerMenu,
} from "../../../lib/senior-manager-desk";

/**
 * The senior manager's desk inside the chat (S21, C8a): the jobs that came up,
 * the open red stops with Clear stop, the pending cases with Confirm cause, and
 * the job on the desk with everything attached, its own ranked list, the new
 * solution part by part (one Confirm each), and a bar at the bottom of the
 * screen: Solved, Log new solution and Ask HQ for outside help while
 * escalated; Run tests and Send to HQ while drafted; Safety always.
 *
 * It owns no rules. Every word, label and order comes from /api/state, and
 * every press goes to /api/action, where the server checks the seat, the
 * status and the menu and plans again; the chat reloads right after each
 * press. A picker only offers what the code menu allows, and the server
 * refuses anything else anyway.
 */

type Press = (action: string, job?: string, payload?: Record<string, unknown>) => Promise<void>;

export interface SeniorManagerDeskProps {
  desk: ManagerDesk;
  press: Press;
  /** Opens the Safety list, the same as the Safety chip. */
  onSafety: () => void;
  /** Show job: puts another job on the desk. A view only, never a press. */
  onShow?: (jobId: string) => void;
  /** A refused press's reason, shown in the bar so it is on screen next to the press. */
  refused?: string | null;
}

export function SeniorManagerDesk({ desk, press, onSafety, onShow, refused = null }: SeniorManagerDeskProps) {
  return (
    <section className="desk" aria-label="Senior manager desk">
      <article className="card">
        <div className="card-from">{desk.title}</div>
        {desk.jobs.length === 0 ? <p className="desk-status">No job has come up to you yet.</p> : null}
        <ul className="job-rows">
          {desk.jobs.map((job) => (
            <li key={job.id} className={job.isOpen ? "job-row is-open" : "job-row"}>
              <span>
                <b>{job.id}</b>
                {job.place} · {job.complaint}
                <span className="job-status">{job.isOpen ? `on the desk · ${job.statusWord}` : job.statusWord}</span>
              </span>
              {job.canShow && onShow ? (
                <button className="open-btn" aria-label={`Show job ${job.id}`} onClick={() => onShow(job.id)}>
                  Show job
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </article>

      {desk.stops.length > 0 ? (
        <>
          <h4 className="desk-sub">Open red stops</h4>
          {desk.stops.map((stop) => (
            <StopRow key={stop.key} stop={stop} press={press} />
          ))}
        </>
      ) : null}

      {desk.cases.length > 0 ? <CaseList cases={desk.cases} press={press} /> : null}

      {desk.open ? (
        <ManagerJob
          key={desk.open.open.jobId}
          job={desk.open}
          menu={desk.menu}
          press={press}
          onSafety={onSafety}
          refused={refused}
        />
      ) : null}
    </section>
  );
}

/** True when the job's bar is on screen, so a refusal shows there instead of at the end of the chat. */
export function managerBarIsShown(desk: ManagerDesk | undefined): boolean {
  const job = desk?.open;
  if (!job || job.open.locked) return false;
  return job.editable || Boolean(job.solution?.canEdit);
}

// ---- Clear stop (S11, cut 6) ----

function StopRow({ stop, press }: { stop: ManagerStopRow; press: Press }) {
  const [reason, setReason] = useState("");
  const [record, setRecord] = useState(false);
  return (
    <div data-testid={`stop-${stop.stopId}`}>
      <ChatCard
        colour="red"
        colourWord="Stop"
        from={`${stop.stopId} · ${stop.place}`}
        title={stop.title}
        call={stop.call}
        receipt={`Red stop ${stop.stopId} · AI calls: 0`}
      >
        <p className="code-line">{stop.opened}</p>
        <form
          className="job-form"
          onSubmit={(event) => {
            event.preventDefault();
            void press("clear-stop", undefined, { stop: stop.key, reason, safetyRecord: stop.needsSafetyRecord ? record : false });
          }}
        >
          <label>
            Reason (3 words or more)
            <input type="text" value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          {stop.needsSafetyRecord && stop.safetyRecordLabel ? (
            <>
              <label className="check">
                <input type="checkbox" checked={record} onChange={(event) => setRecord(event.target.checked)} />
                {stop.safetyRecordLabel}
              </label>
              {stop.note ? <p className="safety-note">{stop.note}</p> : null}
            </>
          ) : null}
          <button type="submit" className="submit" aria-label={`Clear stop ${stop.stopId}`}>
            Clear stop
          </button>
        </form>
      </ChatCard>
    </div>
  );
}

// ---- Confirm cause (S8, cut 7) ----

function CaseList({ cases, press }: { cases: ManagerCaseRow[]; press: Press }) {
  return (
    <ChatCard from="Cases to confirm (S8)" title="A cause needs a second person before it counts as won.">
      <ul className="job-rows">
        {cases.map((c) => (
          <li key={c.id} className="job-row">
            <span>
              {c.line}
              {c.why ? <span className="job-status">{`Why: ${c.why}`}</span> : null}
              {c.note ? <span className="job-status">{c.note}</span> : null}
            </span>
            {c.canConfirm ? (
              <button
                className="open-btn"
                aria-label={`Confirm cause ${c.id}`}
                onClick={() => void press("confirm-cause", undefined, { caseId: c.id })}
              >
                Confirm cause
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </ChatCard>
  );
}

// ---- The job on the desk ----

function ManagerJob({
  job,
  menu,
  press,
  onSafety,
  refused,
}: {
  job: ManagerOpenJob;
  menu: ManagerMenu;
  press: Press;
  onSafety: () => void;
  refused: string | null;
}) {
  const open = job.open;
  // A new solution lands at the top of the job, far from the bar on a phone:
  // bring it into view once, when it first appears. One already there on the
  // first paint moves nothing.
  const solutionBox = useRef<HTMLDivElement>(null);
  const seenSolution = useRef<string | null>(job.solution?.id ?? null);
  const solutionId = job.solution?.id ?? null;
  useEffect(() => {
    if (solutionId === seenSolution.current) return;
    seenSolution.current = solutionId;
    if (solutionId) solutionBox.current?.scrollIntoView?.({ block: "start" });
  }, [solutionId]);

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

  const found = open.leads.find((l) => l.tier === "found");

  return (
    <div className="open-job">
      <h3 className="desk-head">{open.title}</h3>
      <p className="desk-status">{open.statusLine}</p>

      <div ref={solutionBox} className="solution-box" data-testid={job.solution ? "solution-card" : undefined}>
        {job.solution ? (
          <SolutionCard jobId={open.jobId} solution={job.solution} menu={menu} press={press} />
        ) : null}
      </div>

      {job.outsideHelp ? (
        <ChatCard from="Outside help (A3)" colour="amber" colourWord="Waiting on HQ" receipt="Outside help · AI calls: 0">
          <ul className="card-lines">
            {job.outsideHelp.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </ChatCard>
      ) : null}

      <h4 className="desk-sub">Everything attached</h4>
      {job.cameUp ? <ChatCard from="How it came up" title={job.cameUp} /> : null}
      <ChatCard from="Facts (code)">
        <ul className="fact-list">
          {job.facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      </ChatCard>
      <ChatCard from="Ticks, with who made them">
        {job.ticks.length === 0 ? <p>No tick yet.</p> : null}
        <ul className="card-lines">
          {job.ticks.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </ChatCard>
      {job.impact ? <ChatCard from="Impact record (S3)" body={job.impact} /> : null}

      <h4 className="desk-sub">Filled checklist</h4>
      {open.checklist.map((card) => (
        <DeskCardView key={card.id} card={card} />
      ))}

      <h4 className="desk-sub">Leads, ranked by code for the senior manager</h4>
      {open.leads.length === 0 ? <p className="desk-status">No live lead is left on this job.</p> : null}
      {open.leads.map((lead) => (
        <LeadCard key={lead.causeId} lead={lead} jobId={open.jobId} press={press} editable={job.editable} />
      ))}

      <details className="desk-details" data-list="ruled-out">
        <summary>{`Ruled out (${open.ruledOut.length})`}</summary>
        {open.ruledOut.map((lead) => (
          <LeadCard key={lead.causeId} lead={lead} jobId={open.jobId} press={press} editable={job.editable} />
        ))}
      </details>

      <details className="desk-details" data-list="removed">
        <summary>{`Removed (${open.removed.length})`}</summary>
        <ul className="card-lines">
          {open.removed.map((r) => (
            <li key={r.causeId}>
              <b>{r.label}</b>
              <span>{` ${r.reason}`}</span>
            </li>
          ))}
        </ul>
      </details>

      <details className="desk-details" data-list="steps">
        <summary>{`Pill steps (${open.steps.length})`}</summary>
        <StepList steps={open.steps} />
      </details>

      {job.editable || job.solution?.canEdit ? (
        <ManagerBar
          jobId={open.jobId}
          escalated={job.editable}
          drafted={Boolean(job.solution?.canEdit)}
          foundLabel={found?.label ?? null}
          press={press}
          onSafety={onSafety}
          refused={refused}
        />
      ) : null}
    </div>
  );
}

// ---- The new solution, part by part (S16 item 2) ----

function SolutionCard({
  jobId,
  solution,
  menu,
  press,
}: {
  jobId: string;
  solution: ManagerSolutionView;
  menu: ManagerMenu;
  press: Press;
}) {
  const sent = solution.status === "sent-to-hq";
  const run = solution.testRun;

  // A new test run, or the send to HQ, shows here: bring it into view once, so
  // the result is on screen with the bar still under it. What was already
  // there on the first paint, or a poll that brings the same, moves nothing.
  const runBox = useRef<HTMLDivElement>(null);
  const sendLine = useRef<HTMLParagraphElement>(null);
  const runKey = run ? `${run.hash7}|${run.counts}` : null;
  const seenRun = useRef<string | null>(runKey);
  const seenSent = useRef(sent);
  useEffect(() => {
    if (runKey === seenRun.current) return;
    seenRun.current = runKey;
    if (runKey) runBox.current?.scrollIntoView?.({ block: "center" });
  }, [runKey]);
  useEffect(() => {
    if (sent === seenSent.current) return;
    seenSent.current = sent;
    if (sent) sendLine.current?.scrollIntoView?.({ block: "center" });
  }, [sent]);

  return (
    <ChatCard
        from={`New solution · ${solution.id}`}
        colour={sent ? "green" : "amber"}
        colourWord={sent ? "Sent to HQ" : "Draft"}
        title={`Cause: ${solution.causeLabel}`}
        aiBanner={solution.aiBanner}
        aiNotice={solution.aiNotice}
        aiOff={solution.aiOff}
        receipt={solution.receipt}
      >
        <p className="desk-status">{solution.statusLine}</p>
        <TypedLine name="Fix line" text={solution.fixLine} flags={solution.fixFlags} />
        <TypedLine name="Why line" text={solution.whyLine} flags={solution.whyFlags} />

        {solution.note ? (
          <p className="note-line">
            <span className="badge amber">{solution.note.label}</span>
            <span>{solution.note.text}</span>
          </p>
        ) : null}

        <div className="parts">
          {solution.parts.map((part) => (
            <PartRow
              key={`${part.id}:${part.shown}`}
              jobId={jobId}
              part={part}
              menu={menu}
              press={press}
              editable={solution.canEdit}
            />
          ))}
        </div>

        <p className="saved-line">{solution.savedLine}</p>

        {run ? (
          <div ref={runBox} className="test-run">
            <p className="test-counts">
              <span className="badge green">{`${run.passed} passed`}</span>
              <span className={`badge ${run.failed > 0 ? "red" : "green"}`}>{`${run.failed} failed`}</span>
              <span className="badge none">{`${run.notApplicable} not applicable`}</span>
            </p>
            <p className="code-line">{`Run on draft ${run.hash7}${run.current ? ", the draft as it is now" : ", an earlier draft"}.`}</p>
            <details className="desk-details" data-list="test-lines">
              <summary>{`Each test (${run.lines.length})`}</summary>
              <ul className="card-lines">
                {run.lines.map((line) => (
                  <li key={line.id}>
                    <b>{line.id}</b>
                    <span>{` ${line.label}`}</span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        ) : null}

        <p ref={sendLine} className="send-line">
          {solution.sendLine}
        </p>
      </ChatCard>
  );
}

function TypedLine({ name, text, flags }: { name: string; text: string; flags: string[] }) {
  return (
    <p className="typed-line">
      <span className="lead-k">{name}</span>
      <span>{text}</span>
      {flags.map((id) => (
        <span key={id} className="flag">{`red word: ${id}`}</span>
      ))}
    </p>
  );
}

function PartRow({
  jobId,
  part,
  menu,
  press,
  editable,
}: {
  jobId: string;
  part: ManagerPartView;
  menu: ManagerMenu;
  press: Press;
  editable: boolean;
}) {
  const [value, setValue] = useState(part.shown);
  const controlId = `part-${part.id}`;
  const stepText =
    part.id === "effect-1" || part.id === "effect-2" ? menu.effects.find((e) => e.value === value)?.stepText : undefined;

  let control: React.ReactNode;
  if (part.id === "rule-text") {
    control = (
      <textarea id={controlId} value={value} rows={3} disabled={!editable} onChange={(event) => setValue(event.target.value)} />
    );
  } else if (part.id === "fact") {
    control = (
      <select id={controlId} value={value} disabled={!editable} onChange={(event) => setValue(event.target.value)}>
        <option value="">Pick a fact</option>
        {menu.facts.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
    );
  } else {
    control = (
      <select id={controlId} value={value} disabled={!editable} onChange={(event) => setValue(event.target.value)}>
        {part.id === "effect-1" ? <option value="">Pick an effect</option> : <option value="none">No second effect</option>}
        {menu.effects.map((e) => (
          <option key={e.value} value={e.value}>
            {e.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="part-row" data-part={part.id}>
      <div className="part-head">
        <label htmlFor={controlId} className="part-title">
          {part.title}
        </label>
        <span className={`badge ${part.colour}`}>{part.word}</span>
        <span className="part-label">{part.label}</span>
      </div>
      {control}
      {stepText ? <p className="part-step">{stepText}</p> : null}
      {editable ? (
        <button
          className="confirm-btn"
          aria-label={`Confirm ${part.title}`}
          onClick={() => void press("confirm-part", jobId, { part: part.id, value })}
        >
          Confirm
        </button>
      ) : null}
    </div>
  );
}

// ---- The bar ----

type Form = "none" | "solved" | "log" | "help";

function ManagerBar({
  jobId,
  escalated,
  drafted,
  foundLabel,
  press,
  onSafety,
  refused,
}: {
  jobId: string;
  escalated: boolean;
  drafted: boolean;
  foundLabel: string | null;
  press: Press;
  onSafety: () => void;
  refused: string | null;
}) {
  const [form, setForm] = useState<Form>("none");
  const [why, setWhy] = useState("");
  const [fixLine, setFixLine] = useState("");
  const [whyLine, setWhyLine] = useState("");
  const [need, setNeed] = useState<"contractor" | "budget" | null>(null);
  const [reason, setReason] = useState("");
  const [money, setMoney] = useState<boolean | null>(null);
  const toggle = (next: Form) => setForm((now) => (now === next ? "none" : next));

  return (
    <div className="job-bar" role="group" aria-label={`Job ${jobId} presses`}>
      {refused ? (
        <div className="notice refused" role="status">
          <b>not done</b>
          {refused}
        </div>
      ) : null}

      {escalated && form === "solved" ? (
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

      {escalated && form === "log" ? (
        <form
          className="job-form"
          onSubmit={(event) => {
            event.preventDefault();
            void press("log-new-solution", jobId, { fixLine, whyLine });
          }}
        >
          <p className="desk-status">
            {foundLabel ? `Cause: ${foundLabel} (found).` : "Tick Found it on the cause first."}
          </p>
          <label>
            Fix line (3 to 30 words)
            <textarea rows={3} value={fixLine} onChange={(event) => setFixLine(event.target.value)} />
          </label>
          <label>
            Why line (3 to 30 words)
            <textarea rows={3} value={whyLine} onChange={(event) => setWhyLine(event.target.value)} />
          </label>
          <button type="submit" className="submit">
            Log it
          </button>
        </form>
      ) : null}

      {escalated && form === "help" ? (
        <form
          className="job-form"
          onSubmit={(event) => {
            event.preventDefault();
            // An empty choice is left out, so the server asks for it.
            const payload: Record<string, unknown> = {};
            if (need) payload.need = need;
            payload.reason = reason;
            if (money !== null) payload.needsMoney = money;
            void press("ask-outside-help", jobId, payload);
          }}
        >
          <fieldset>
            <legend>What is needed</legend>
            <label className="radio">
              <input type="radio" name={`need-${jobId}`} checked={need === "contractor"} onChange={() => setNeed("contractor")} />
              A contractor
            </label>
            <label className="radio">
              <input type="radio" name={`need-${jobId}`} checked={need === "budget"} onChange={() => setNeed("budget")} />
              Budget
            </label>
          </fieldset>
          <label>
            Reason (3 words or more)
            <input type="text" value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <fieldset>
            <legend>Needs money (no amount here: HQ decides, A3)</legend>
            <label className="radio">
              <input type="radio" name={`money-${jobId}`} checked={money === true} onChange={() => setMoney(true)} />
              Yes, it needs money
            </label>
            <label className="radio">
              <input type="radio" name={`money-${jobId}`} checked={money === false} onChange={() => setMoney(false)} />
              No money needed
            </label>
          </fieldset>
          <button type="submit" className="submit">
            Send to HQ (A3)
          </button>
        </form>
      ) : null}

      <div className="job-bar-buttons">
        {escalated ? (
          <>
            <button className="solved-btn" aria-expanded={form === "solved"} onClick={() => toggle("solved")}>
              Solved
            </button>
            <button className="log-btn" aria-expanded={form === "log"} onClick={() => toggle("log")}>
              Log new solution
            </button>
            <button className="help-btn" aria-expanded={form === "help"} onClick={() => toggle("help")}>
              Ask HQ for outside help
            </button>
          </>
        ) : null}
        {drafted ? (
          <>
            <button className="run-btn" onClick={() => void press("run-tests", jobId)}>
              Run tests
            </button>
            <button className="send-hq-btn" onClick={() => void press("send-to-hq", jobId)}>
              Send to HQ
            </button>
          </>
        ) : null}
        <button className="safety-btn" onClick={onSafety}>
          Safety
        </button>
      </div>
    </div>
  );
}
