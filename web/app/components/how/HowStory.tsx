import { Fragment } from "react";
import { PipAvatar } from "../PipAvatar";
import { CodeTag, Plain } from "../Plain";
import { APPROVAL_WHAT, PILL_MEANS, approvalWord, pipNeverLine, rankStepWords, type ApprovalId } from "../../../lib/plain-words";
import type { HowView, WhyStory, WhyCall } from "../../../lib/how";
import type { ImpactMeter } from "../../../lib/impact";
import { STORY_LINK_WORDS } from "../../../lib/story";

/**
 * The judges' page above the live wall (S22, C10a): WHY, WHAT and HOW in one
 * scroll. It owns no words about the job: every date, number, rule id, label
 * and line comes from howView, which reads the data, the pill, the engine and
 * the one memory. No hooks, so it renders on the server with the first paint.
 *
 * Plain words first (D1): approvals and stops show in plain words with the
 * code kept after them as a grey tag (components/Plain.tsx).
 */

/** A role's line with "A1 to A4" read as the 4 approval points, the codes kept as a grey tag. */
function RoleText({ text }: { text: string }) {
  const codes = "A1 to A4";
  const at = text.indexOf(codes);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      {"the 4 approval points "}
      <CodeTag code={codes} />
      {text.slice(at + codes.length)}
    </>
  );
}

/** "Approves new fixes A2 and outside help or money A3", each code as a grey tag. */
function Approves({ ids }: { ids: string[] }) {
  if (ids.length === 0) return <>Approves nothing</>;
  return (
    <>
      {"Approves "}
      {ids.map((id, i) => (
        <Fragment key={id}>
          {i > 0 ? " and " : null}
          {APPROVAL_WHAT[id as ApprovalId] ?? id} <CodeTag code={id} />
        </Fragment>
      ))}
    </>
  );
}

function upperFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function HowStory({ view }: { view: HowView }) {
  return (
    <>
      <header className="how-hero">
        <p className="how-kicker">Pill Desk · for judges</p>
        <h1>Fix it faster, so the same spot stops calling</h1>
        <p className="how-story-link">
          <a href="/demo">{STORY_LINK_WORDS}</a>. The real app plays the whole demo by itself, one seat at a time.
        </p>
        <p className="lede">
          {`Pill Desk gives ${view.seats.length} people their own chat with Pip, all on one brain: the signed rules, a list of likely causes and past cases. Code ranks and routes, the AI only puts things into plain words, and people approve only ${view.approvals.length} kinds of decision.`}
        </p>
        <p className="lede how-pill">{PILL_MEANS}</p>
        <nav className="how-nav" aria-label="On this page">
          <a href="#why">1 · Why</a>
          <a href="#what">2 · What</a>
          <a href="#how">3 · How</a>
          <a href="#live">4 · The live chats</a>
        </nav>
        <p className="how-roleplayed">{view.rolePlayed}</p>
      </header>

      <WhySection story={view.why} meter={view.meter} />
      <WhatSection view={view} />
      <HowSection view={view} />
    </>
  );
}

// ---- 1. WHY ----

function statusClass(call: WhyCall): string {
  if (call.status === "came-back") return "badge amber";
  if (call.status === "stayed-fixed") return "badge green";
  return "badge open";
}

function WhySection({ story, meter }: { story: WhyStory | null; meter: ImpactMeter | null }) {
  return (
    <section id="why" className="how-section" aria-labelledby="why-title">
      <p className="how-kicker">1 · Why</p>
      <h2 id="why-title">Tickets close, causes stay</h2>
      {story ? (
        <>
          <h3 className="why-headline">{story.headline}</h3>
          {/* The notices count calls in a 30-day window; say once that these all fall inside it (D1 review). */}
          {story.days <= 30 ? (
            <p className="card-mean why-window">All of these calls fall inside the 30-day window that the repeat rule counts.</p>
          ) : null}
          <ul className="why-patterns">
            {story.patterns.map((p) => (
              <li key={`${p.complaint}-${p.where}`}>
                <b>{upperFirst(p.complaint)}</b>
                {` at the ${p.where}, ${p.when}: ${plural(p.ids.length, "call")} (${p.ids.join(", ")}).`}
              </li>
            ))}
          </ul>

          <div className="why-stats">
            <div className="why-stat">
              <b>{story.calls.length}</b>
              <span>{`calls from ${story.tenant}, one floor`}</span>
            </div>
            <div className="why-stat">
              <b>{story.days}</b>
              <span>days from the first call to the last</span>
            </div>
            <div className="why-stat">
              <b>{story.dialTurns}</b>
              <span>closed with a turn of the dial</span>
            </div>
            <div className="why-stat">
              <b>{story.openIds.length}</b>
              <span>still open</span>
            </div>
          </div>

          <ol className="why-calls" data-testid="why-calls" aria-label={`The calls at ${story.place}`}>
            {story.calls.map((call) => (
              <li key={call.id} className="why-call">
                <span className="why-date">{call.date}</span>
                <span className="why-id">{call.id}</span>
                <span className="why-what">{`${upperFirst(call.complaint)}, ${call.where}, ${call.when}`}</span>
                <span className="why-fix">{call.fixNote ?? "Still open"}</span>
                <span className="why-status">
                  <span className={statusClass(call)}>{call.statusWord}</span>
                  {call.next ? <span className="why-next">{`${call.next.id} on ${call.next.date}`}</span> : null}
                </span>
              </li>
            ))}
          </ol>
          <p className="why-summary">{story.summary}</p>

          {story.causeLine ? (
            <article className="card why-cause">
              <div className="card-from">What the trend data shows, made up</div>
              <p>{story.causeLine}</p>
              {story.fitOutMonths !== null ? (
                <p className="card-mean">
                  {`Fit-out finished ${plural(story.fitOutMonths, "month")} ago${
                    story.leaseEndsInMonths !== null ? `; the lease ends in ${plural(story.leaseEndsInMonths, "month")}` : ""
                  } (buildings data).`}
                </p>
              ) : null}
            </article>
          ) : null}
        </>
      ) : (
        <p>No calls at this spot yet.</p>
      )}

      {meter ? <MeterTable meter={meter} /> : null}
    </section>
  );
}

function MeterTable({ meter }: { meter: ImpactMeter }) {
  const b = meter.before;
  const w = meter.withPillDesk;
  const rows: [string, string | number, string | number][] = [
    ["Calls", b.calls, w ? w.calls : "-"],
    ["Visits", b.visits, w ? w.visits : "-"],
    ["Senior manager checks", b.seniorChecks, w ? w.seniorChecks : "-"],
    ["Days to a real fix", b.daysLine, w ? w.daysLine : "-"],
    ["Repeat calls", b.repeatCalls, w ? w.repeatCalls : "-"],
    ["Cost", b.costLine, w ? w.costLine : "-"],
  ];
  return (
    <article className="card how-meter" data-testid="how-meter">
      <div className="card-from">{`Impact meter · ${meter.place}`}</div>
      <p className="meter-caught">
        {w
          ? `Caught at ${w.caughtId} on ${w.caughtOn}: with Pill Desk the repeat flag comes on at that call, so the senior manager checks on that visit instead of another turn of the dial.`
          : "No repeat caught at this spot yet."}
      </p>
      <table className="meter-table">
        <thead>
          <tr>
            <th scope="col">Measure</th>
            <th scope="col">Before</th>
            <th scope="col">With Pill Desk</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, before, withPd]) => (
            <tr key={name} className={name === "Cost" ? "meter-cost-row" : undefined}>
              <th scope="row">{name}</th>
              <td>{before}</td>
              <td>{withPd}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="meter-label">{meter.label}</p>
      <p className="receipt">Impact meter · replayed by code from the tickets · made-up rates · AI calls: 0</p>
    </article>
  );
}

// ---- 2. WHAT ----

function WhatSection({ view }: { view: HowView }) {
  const { brain } = view;
  return (
    <section id="what" className="how-section" aria-labelledby="what-title">
      <p className="how-kicker">2 · What</p>
      <h2 id="what-title">{`${view.seats.length} seats around one brain`}</h2>
      <p>
        Each person gets their own chat with Pip. Under every chat sits one brain: the live pill version, the cause list
        and the case library. Building B is a card, not a seat. Tap a seat to open its chat alone.
      </p>

      <div className="brain-ring" data-testid="brain-ring">
        <div className="brain-core">
          <PipAvatar size={64} />
          <b>One brain</b>
          <span>The rule book for too-cold and too-hot calls</span>
          <span>{`Pill ${brain.pill} v${brain.version}`}</span>
          <span>{`${brain.causes} causes · ${brain.cases} past cases`}</span>
        </div>
        {view.seats.map((seat) => (
          <a key={seat.id} className={`ring-seat ring-${seat.id}`} href={seat.href}>
            <span className="seat-name">{seat.label}</span>
            <span className="seat-line">{seat.does}</span>
            <span className={seat.approves.length > 0 ? "ring-approves has" : "ring-approves"}>
              <Approves ids={seat.approves} />
            </span>
            <span className="never">{pipNeverLine(seat.never)}</span>
          </a>
        ))}
        <div className="ring-b">
          <span className="card-from">Another building, same brain</span>
          <span className="seat-name">{view.buildingB.title}</span>
          <span className="seat-line">{`Live version v${view.buildingB.version}. ${view.buildingB.line}`}</span>
        </div>
      </div>

      <h3 className="how-sub">Who approves what</h3>
      <ul className="approval-list" data-testid="how-approvals">
        {view.approvals.map((a) => (
          <li key={a.id}>
            <span className="approval-what">
              <b>{approvalWord(a.id)}</b> <CodeTag code={a.id} />
              <span className="approval-sub">{a.what}</span>
            </span>
            <span className="approval-who">{a.who}</span>
            <span className="approval-where">{a.where}</span>
            {a.line ? <span className="approval-line">{a.line}</span> : null}
          </li>
        ))}
      </ul>
      <p>
        No approval: the tenant&apos;s self-check, the technician&apos;s checklist and ticks, a fix already in the brain,
        and saving a solved job as a case. Safety is a stop, not an approval.
      </p>

      <h3 className="how-sub">Who passes what to whom</h3>
      <ol className="passes" data-testid="how-passes">
        {view.passes.map((p) => (
          <li key={`${p.from}-${p.to}`}>
            <b>{`${p.from} to ${p.to}`}</b>
            <span>{p.what}</span>
          </li>
        ))}
      </ol>
      <p>
        Code also routes the notices: warnings about a spot that keeps calling (&quot;speak first&quot;) and notes when
        Pip is not sure (&quot;low confidence&quot;) go to the senior manager. Every red stop alert goes to the senior
        manager and the building manager (AOM).
      </p>
    </section>
  );
}

// ---- 3. HOW ----

function HowSection({ view }: { view: HowView }) {
  return (
    <section id="how" className="how-section" aria-labelledby="how-title">
      <p className="how-kicker">3 · How</p>
      <h2 id="how-title">Code decides, the AI words, people approve</h2>

      <div className="how-roles">
        {view.roles.map((r) => (
          <article className="card" key={r.who}>
            <p className="card-title">{r.who}</p>
            <p>
              <RoleText text={r.text} />
            </p>
          </article>
        ))}
      </div>

      <div className="how-grid">
        <article className="card">
          <div className="card-from">The 30-day rule</div>
          <ul className="how-lines">
            {view.thirtyDay.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </article>

        <article className="card">
          <div className="card-from">Ranking, 4 code steps</div>
          <ol className="how-steps" data-testid="how-rank-steps">
            {view.rankSteps.map((s) => (
              <li key={s.name}>
                <b>{s.name}</b>
                <span>{rankStepWords(s.text)}</span>
              </li>
            ))}
          </ol>
        </article>

        <article className="card how-safety">
          <div className="card-from">Safety stops</div>
          <div className="card-statusrow">
            <span className="badge red">Stop</span>
            <span className="card-mean">A stop, not an approval</span>
          </div>
          <p>{view.safety.line}</p>
          <ul className="stop-list" data-testid="how-stops">
            {view.safety.stops.map((s) => (
              <li key={s.id}>
                {s.trigger} <CodeTag code={s.id} />
              </li>
            ))}
          </ul>
        </article>

        <article className="card">
          <div className="card-from">The AI in a new solution</div>
          <p>{view.aiNewSolution}</p>
          <p className="card-mean">
            Code refuses anything off the menu, the solution&apos;s tests must pass on that exact draft, and only head
            office approves it. <CodeTag code="A2" />
          </p>
        </article>
      </div>

      <h3 className="how-sub">The brief&apos;s 8 questions</h3>
      <ol className="how-questions" data-testid="how-questions">
        {view.questions.map((q) => (
          <li key={q.n}>
            <span className="q-text">{q.question}</span>
            <span className="q-answer">
              <Plain text={q.answer} />
            </span>
          </li>
        ))}
      </ol>

      <p className="how-roleplayed">{view.rolePlayed}</p>
    </section>
  );
}
