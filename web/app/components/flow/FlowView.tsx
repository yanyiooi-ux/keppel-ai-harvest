import Link from "next/link";
import type { ReactNode } from "react";
import { PipAvatar } from "../PipAvatar";
import { FLOW_SECTIONS, type FlowBit, type FlowNode, type FlowTree, type FlowView as FlowData } from "../../../lib/flow";
import { STORY_LINK_WORDS } from "../../../lib/story";

/**
 * /flow, "How a job flows" (D4): the one-page flow diagram in the app's own
 * look. It owns no names: every button, cause, part, status, seat and
 * approval comes from lib/flow.ts, which reads the app's constants. A button
 * name is drawn as a quiet button and carries data-button, so the drift test
 * can check it against the real button.
 */

function Bits({ bits }: { bits: FlowBit[] }) {
  return (
    <>
      {bits.map((bit, i) => {
        if ("button" in bit) {
          return (
            <span key={i} className="flow-press" data-button="">
              {bit.button}
            </span>
          );
        }
        if ("typed" in bit) {
          return (
            <q key={i} className="flow-typed">
              {bit.typed}
            </q>
          );
        }
        return <span key={i}>{bit.text}</span>;
      })}
    </>
  );
}

function Approval({ id }: { id: string }) {
  return <span className="flow-approval">{`Approval ${id}`}</span>;
}

function Node({ node }: { node: FlowNode }) {
  return (
    <div className={`flow-node is-${node.tone}`}>
      <b>
        <Bits bits={[node.title]} />
      </b>
      {node.approval ? <Approval id={node.approval} /> : null}
      <span>{node.line}</span>
    </div>
  );
}

function Tree({ tree, label }: { tree: FlowTree; label: string }) {
  return (
    <div className="flow-tree" aria-label={label}>
      <div className="flow-root">
        <Node node={tree.root} />
      </div>
      <div className="flow-down" aria-hidden="true">
        &darr;
      </div>
      <div className="flow-branches">
        {tree.branches.map((br) => (
          <div className="flow-branch" key={br.when}>
            <p className="flow-when">{br.when}</p>
            <Node node={br.first} />
            <div className="flow-down" aria-hidden="true">
              &darr;
            </div>
            <Node node={br.then} />
          </div>
        ))}
      </div>
      <p className="flow-tree-note">{tree.note}</p>
    </div>
  );
}

function Section({ id, lead, children }: { id: (typeof FLOW_SECTIONS)[number]["id"]; lead?: string; children: ReactNode }) {
  const title = FLOW_SECTIONS.find((s) => s.id === id)!.title;
  return (
    <section id={id} className="flow-section" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{title}</h2>
      {lead ? <p className="flow-lead">{lead}</p> : null}
      {children}
    </section>
  );
}

export function FlowView({ flow, video }: { flow: FlowData; video: ReactNode }) {
  return (
    <main className="flow">
      <header className="flow-hero">
        <div className="flow-hero-top">
          <PipAvatar size={56} />
          <p className="flow-kicker">Pill Desk · how a job flows</p>
        </div>
        <h1>How a job flows</h1>
        <p className="lede">
          Five people, one shared job, and only four moments that need a yes. This page shows who presses what, in what
          order, and who gets told next.
        </p>
        <p className="flow-note">Every button name here is read from the app&apos;s own code. Everything in the demo is made up.</p>
        <p className="flow-links">
          <Link href="/demo">{STORY_LINK_WORDS}</Link>
          <Link href="/how">How it works, for judges</Link>
        </p>
        <nav className="flow-toc" aria-label="On this page">
          {FLOW_SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {s.title}
            </a>
          ))}
        </nav>
      </header>

      {video}

      <Section
        id="seats"
        lead="Each person has their own chat with Pip. All five read and write the same job, so a press in one seat shows in the others within about 2 seconds."
      >
        <ul className="flow-seats">
          {flow.seats.map((s) => (
            <li key={s.id}>
              <b>{s.name}</b>
              <span>{s.does}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="demo" lead="Press the buttons in this order. The arrow line says who gets told next.">
        <ol className="flow-steps">
          {flow.steps.map((s) => (
            <li key={s.who} className={`flow-step is-${s.kind}`}>
              <p className="flow-who">
                {s.who}
                <small>{s.sub}</small>
              </p>
              <div className="flow-do">
                <p>
                  <Bits bits={s.does} />
                  {s.approval ? <Approval id={s.approval} /> : null}
                </p>
                {s.next ? <p className="flow-next">{s.next}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="tech" lead="After opening the job, the technician has three ways out. Only one of them stays with the technician.">
        <Tree tree={flow.technician} label="The technician's three ways out" />
      </Section>

      <Section id="senior" lead="The senior manager also has three ways out. Two of them need a yes from head office.">
        <Tree tree={flow.senior} label="The senior manager's three ways out" />
      </Section>

      <Section id="approvals" lead="These are the only moments anyone has to say yes. Everything else just moves along.">
        <ul className="flow-cards">
          {flow.approvals.map((a) => (
            <li key={a.id} className="flow-card">
              <Approval id={a.id} />
              <h3>{a.title}</h3>
              <p>{a.line}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="know" lead="Nobody has to chase anyone. The app tells each person in four ways.">
        <ul className="flow-know">
          {flow.know.map((k) => (
            <li key={k.head}>
              <b>{k.head}</b> {k.line}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="safety">
        <div className="flow-stop">
          <span className="badge red">Stop</span>
          {flow.safety.map((line, i) => (
            <p key={i}>
              <Bits bits={line} />
            </p>
          ))}
        </div>
      </Section>

      <Section id="rule30" lead="A job marked Solved is not a win yet.">
        <div className="flow-rule30">
          {flow.thirtyDay.map((n) => (
            <Node key={n.line} node={n} />
          ))}
        </div>
      </Section>

      <footer className="flow-foot">
        Pill Desk · Tencent Cloud AI CAN DO IT Hackathon 2026, Keppel track. Buildings, people, tickets and amounts are
        made up for the demo.
      </footer>
    </main>
  );
}
