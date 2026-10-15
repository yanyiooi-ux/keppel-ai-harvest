"use client";

import { useEffect, useRef, useState } from "react";
import { ChatCard } from "./ChatCard";
import { DeskCardView, LeadCard, StepList, StatusLine, tickLine, zoneOf, type TickDone } from "./TechnicianDesk";
import { bringIntoView } from "./bring-into-view";
import { CodeTag, Coded, Plain } from "../Plain";
import { effectStepLead, effectWord, factIdFromLabel, factWord, statusWord } from "../../../lib/plain-words";
import { DEMO_FIX_LINE, DEMO_WHY_LINE } from "../../../lib/demo-words";
import type { AiMode } from "../../../lib/ai-mode";
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
 *
 * Plain words first (D1): statuses, facts, effects and approvals show in plain
 * words with the code kept after them as a grey tag (components/Plain.tsx).
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
  /** A refused Clear stop or Confirm cause, shown where it was pressed (see managerRowHolds). */
  rowRefused?: RefusedPress | null;
  /** The last tick that worked, so the list says what changed (D1 review). */
  done?: TickDone | null;
  /** Jobs that came up to the senior manager and have since left the desk (D1 review). */
  movedOn?: string[];
  /** Where the AI switch stands, so the new fix can say why no AI draft shows (D1 review). */
  aiMode?: AiMode;
}

/** A refused press: what was pressed, with what, and the server's reason. */
export interface RefusedPress {
  action: string;
  /** The job it was pressed on (C8b: HQ's cards are found by their job). */
  job?: string;
  payload?: Record<string, unknown>;
  message: string;
}

/** The presses made from a row near the top of the desk, not from the job's bar. */
const ROW_PRESSES = ["clear-stop", "confirm-cause"];

/**
 * True when the refused press was a Clear stop or a Confirm cause on this
 * desk: its reason shows where it was pressed, in that row, or where the list
 * was when the reload no longer shows the row (a stop someone else cleared, a
 * case the spot called back on). Never far below in the bar or at the end of
 * the chat, so it is on screen next to the button on a phone (C8a review).
 */
export function managerRowHolds(desk: ManagerDesk | undefined, refused: RefusedPress | null): boolean {
  return Boolean(desk && refused && ROW_PRESSES.includes(refused.action));
}

function RowRefusal({ message }: { message: string }) {
  return (
    <div className="notice refused" role="status">
      <b>not done</b>
      <Plain text={message} />
    </div>
  );
}

/** The empty job list: nothing ever came up, or the jobs that came up have left the desk (D1 review). */
function emptyJobsLine(movedOn: string[]): string {
  if (movedOn.length === 0) return "No job has come up to you yet.";
  const jobs = movedOn.length === 1 ? `Job ${movedOn[0]}` : `Jobs ${movedOn.join(", ")}`;
  return `Nothing is waiting on you now. ${jobs} came up to you and has left your desk. Its notes below are marked done.`;
}

export function SeniorManagerDesk({
  desk,
  press,
  onSafety,
  onShow,
  refused = null,
  rowRefused = null,
  done = null,
  movedOn = [],
  aiMode,
}: SeniorManagerDeskProps) {
  // A refused row press shows in its row; with the row gone, under its list or where the list was.
  const stopRefused = rowRefused?.action === "clear-stop" ? rowRefused : null;
  const stopInRow = Boolean(stopRefused && desk.stops.some((s) => s.key === stopRefused.payload?.stop));
  const caseRefused = rowRefused?.action === "confirm-cause" ? rowRefused : null;
  const caseInRow = Boolean(caseRefused && desk.cases.some((c) => c.id === caseRefused.payload?.caseId));
  return (
    <section className="desk" aria-label="Senior manager desk">
      <article className="card">
        <div className="card-from">{desk.title}</div>
        {desk.jobs.length === 0 ? <p className="desk-status">{emptyJobsLine(movedOn)}</p> : null}
        <ul className="job-rows">
          {desk.jobs.map((job) => (
            <li key={job.id} className={job.isOpen ? "job-row is-open" : "job-row"}>
              <span>
                <b>{job.id}</b>
                {job.place} · {job.complaint}
                <span className="job-status">
                  {job.isOpen ? `On your desk · ${statusWord(job.status)} ` : `${statusWord(job.status)} `}
                  <CodeTag code={job.status} />
                </span>
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
          <h4 className="desk-sub">Open safety stops</h4>
          {desk.stops.map((stop) => (
            <StopRow
              key={stop.key}
              stop={stop}
              press={press}
              refused={stopInRow && stopRefused?.payload?.stop === stop.key ? stopRefused.message : null}
            />
          ))}
        </>
      ) : null}
      {stopRefused && !stopInRow ? <RowRefusal message={stopRefused.message} /> : null}

      {desk.cases.length > 0 ? (
        <CaseList cases={desk.cases} press={press} refused={caseInRow ? caseRefused : null} />
      ) : null}
      {caseRefused && !caseInRow ? <RowRefusal message={caseRefused.message} /> : null}

      {desk.open ? (
        <ManagerJob
          key={desk.open.open.jobId}
          job={desk.open}
          menu={desk.menu}
          press={press}
          onSafety={onSafety}
          refused={refused}
          done={done}
          aiMode={aiMode}
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

function StopRow({ stop, press, refused }: { stop: ManagerStopRow; press: Press; refused: string | null }) {
  const [reason, setReason] = useState("");
  const [record, setRecord] = useState(false);
  return (
    <div data-testid={`stop-${stop.stopId}`}>
      <ChatCard
        colour="red"
        colourWord="Stop"
        from={`${stop.stopId} · ${stop.place}`}
        title={stop.title}
        body={stop.action}
        call={stop.call}
        receipt={stop.receipt ?? `Red stop ${stop.stopId} · AI calls: 0`}
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
          {refused ? <RowRefusal message={refused} /> : null}
        </form>
      </ChatCard>
    </div>
  );
}

// ---- Confirm cause (S8, cut 7) ----

function CaseList({ cases, press, refused }: { cases: ManagerCaseRow[]; press: Press; refused: RefusedPress | null }) {
  return (
    <ChatCard from="Fixes to double-check" title="A cause needs a second person before it counts as won.">
      <ul className="job-rows">
        {cases.map((c) => (
          <li key={c.id} className="job-row" data-testid={`case-${c.id}`}>
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
            {refused?.payload?.caseId === c.id ? <RowRefusal message={refused.message} /> : null}
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
  done,
  aiMode,
}: {
  job: ManagerOpenJob;
  menu: ManagerMenu;
  press: Press;
  onSafety: () => void;
  refused: string | null;
  done: TickDone | null;
  aiMode?: AiMode;
}) {
  const open = job.open;
  const ticked = tickLine(done, open);
  const jobZone = zoneOf(open);
  // A new solution lands at the top of the job, far from the bar on a phone:
  // bring it into view once, when it first appears. One already there on the
  // first paint moves nothing.
  const solutionBox = useRef<HTMLDivElement>(null);
  const seenSolution = useRef<string | null>(job.solution?.id ?? null);
  const solutionId = job.solution?.id ?? null;
  useEffect(() => {
    if (solutionId === seenSolution.current) return;
    seenSolution.current = solutionId;
    if (solutionId) bringIntoView(solutionBox.current, "start");
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
      <StatusLine status={open.status} line={open.statusLine} />

      <div ref={solutionBox} className="solution-box" data-testid={job.solution ? "solution-card" : undefined}>
        {job.solution ? (
          <SolutionCard jobId={open.jobId} solution={job.solution} menu={menu} press={press} aiMode={aiMode} />
        ) : null}
      </div>

      {job.outsideHelp ? (
        <ChatCard
          from="Outside help: head office decides"
          fromCode="A3"
          colour="amber"
          colourWord="Waiting on HQ"
          receipt="Outside help · AI calls: 0"
        >
          <ul className="card-lines">
            {job.outsideHelp.map((line) => (
              <li key={line}>
                <Plain text={line} />
              </li>
            ))}
          </ul>
        </ChatCard>
      ) : null}

      <h4 className="desk-sub">Everything attached</h4>
      {job.cameUp ? <ChatCard from="How it came up" title={job.cameUp} /> : null}
      <ChatCard from="What code knows about this job">
        <ul className="fact-list">
          {job.facts.map((fact) => {
            const id = factIdFromLabel(fact);
            return <li key={fact}>{id ? <Coded word={factWord(id)} code={id} /> : fact}</li>;
          })}
        </ul>
      </ChatCard>
      <ChatCard from="Ticks, and who made them">
        {job.ticks.length === 0 ? <p>No tick yet.</p> : null}
        <ul className="card-lines">
          {job.ticks.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </ChatCard>
      {job.impact ? <ChatCard from="Time and money lost so far" body={job.impact} /> : null}

      <h4 className="desk-sub">Filled checklist: what we already know</h4>
      {open.checklist.map((card) => (
        <DeskCardView key={card.id} card={card} jobZone={jobZone} />
      ))}

      <h4 className="desk-sub">Likely causes, best bet first (your list)</h4>
      {ticked ? (
        <p className="tick-done" role="status">
          {ticked}
        </p>
      ) : null}
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
              <span>
                {" "}
                <Plain text={r.reason} />
              </span>
            </li>
          ))}
        </ul>
      </details>

      <details className="desk-details" data-list="steps">
        <summary>{`All ${open.steps.length} checklist steps from the rule book (for engineers)`}</summary>
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
          aiMode={aiMode}
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
  aiMode,
}: {
  jobId: string;
  solution: ManagerSolutionView;
  menu: ManagerMenu;
  press: Press;
  aiMode?: AiMode;
}) {
  const sent = solution.status === "sent-to-hq";
  const run = solution.testRun;
  // On Saved answers with no saved answer for these words, the AI part would
  // just be missing: say why (D1 review).
  const noSavedAnswer =
    aiMode === "replay" &&
    !solution.aiBanner &&
    !solution.aiNotice &&
    !solution.aiOff &&
    solution.parts.filter((p) => p.id !== "rule-text").every((p) => p.suggested === null);

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
    if (runKey) bringIntoView(runBox.current, "center");
  }, [runKey]);
  useEffect(() => {
    if (sent === seenSent.current) return;
    seenSent.current = sent;
    if (sent) bringIntoView(sendLine.current, "center");
  }, [sent]);

  // HQ's decision shows on the card too (C8b): a status colour always carries its word.
  const declined = solution.status === "declined";
  const approved = solution.status === "approved-and-distributed";
  return (
    <ChatCard
        from="New fix (new solution)"
        fromCode={solution.id}
        colour={declined ? "red" : sent || approved ? "green" : "amber"}
        colourWord={declined ? "Declined by HQ" : approved ? "Approved by HQ" : sent ? "Sent to HQ" : "Draft"}
        title={`Cause: ${solution.causeLabel}`}
        aiBanner={solution.aiBanner}
        aiNotice={solution.aiNotice}
        aiOff={solution.aiOff}
        receipt={solution.receipt}
      >
        <p className="desk-status">
          <Plain text={solution.statusLine} />
        </p>
        <TypedLine name="Fix line" text={solution.fixLine} flags={solution.fixFlags} />
        <TypedLine name="Why line" text={solution.whyLine} flags={solution.whyFlags} />

        {solution.note ? (
          <p className="note-line">
            <span className="badge amber">{solution.note.label}</span>
            <span>{solution.note.text}</span>
          </p>
        ) : null}

        {noSavedAnswer ? (
          <p className="note-line" data-testid="no-saved-answer">
            <span className="badge amber">No AI draft</span>
            <span>
              There is no saved AI answer for these words. Saved answers cover only the demo&apos;s own words, so pick
              each part by hand from the menu.
            </span>
          </p>
        ) : null}

        <p className="parts-head">The rule&apos;s parts: when it applies (the fact), and what it changes (the effects).</p>
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

        <p className="saved-line">
          <Plain text={solution.savedLine} />
        </p>

        {run ? (
          <div ref={runBox} className="test-run">
            <p className="test-counts">
              <span className="badge green">{`${run.passed} passed`}</span>
              <span className={`badge ${run.failed > 0 ? "red" : "green"}`}>{`${run.failed} failed`}</span>
              <span className="badge none">{`${run.notApplicable} not applicable`}</span>
            </p>
            <p className="code-line">
              {run.current ? "Tested on this exact draft, as it is now. " : "Tested on an earlier draft, not this one. "}
              <CodeTag code={run.hash7} />
            </p>
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
          <Plain text={solution.sendLine} />
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
        <span key={id} className="flag">
          {"red word: "}
          <Plain text={id} />
        </span>
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
    // The whole rule text shows before it is confirmed, at 390 px too: the box
    // grows with its text (CSS field-sizing), and rows is the fallback.
    control = (
      <textarea
        id={controlId}
        value={value}
        rows={Math.max(3, Math.ceil(value.length / 36) + 1)}
        disabled={!editable}
        onChange={(event) => setValue(event.target.value)}
      />
    );
  } else if (part.id === "fact") {
    // Plain words in the box, so they fit a phone; the code shows under it as a grey tag (D1 review).
    control = (
      <select id={controlId} value={value} disabled={!editable} onChange={(event) => setValue(event.target.value)}>
        <option value="">Pick a fact</option>
        {menu.facts.map((f) => (
          <option key={f.value} value={f.value}>
            {factWord(f.value)}
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
            {effectWord(e.value)}
          </option>
        ))}
      </select>
    );
  }
  // The picked value's code, kept on screen under the box.
  const pickedCode =
    part.id === "fact" && value
      ? value
      : (part.id === "effect-1" || part.id === "effect-2") && value && value !== "none"
        ? menu.effects.find((e) => e.value === value)?.label.toLowerCase()
        : undefined;
  const stepLead = stepText ? effectStepLead(value) : null;

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
      {pickedCode ? (
        <p className="part-code">
          <CodeTag code={pickedCode} />
        </p>
      ) : null}
      {stepText ? (
        <p className="part-step">
          {stepLead ? <span className="part-step-lead">{stepLead}</span> : null}
          {stepText}
        </p>
      ) : null}
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
  aiMode,
}: {
  jobId: string;
  escalated: boolean;
  drafted: boolean;
  foundLabel: string | null;
  press: Press;
  onSafety: () => void;
  refused: string | null;
  aiMode?: AiMode;
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
          <Plain text={refused} />
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
          {aiMode === "replay" ? (
            <p className="demo-words">
              <span>
                With Saved answers on, Pip&apos;s AI draft shows only for the demo&apos;s own words. Other words work
                too, but you pick each part by hand.
              </span>
              <button
                type="button"
                className="demo-words-btn"
                onClick={() => {
                  setFixLine(DEMO_FIX_LINE);
                  setWhyLine(DEMO_WHY_LINE);
                }}
              >
                Use the demo words
              </button>
            </p>
          ) : null}
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
            <legend>
              Needs money? No amount here: head office decides. <CodeTag code="A3" />
            </legend>
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
            Send to HQ <CodeTag code="A3" />
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
