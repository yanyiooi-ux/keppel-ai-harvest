"use client";

import { useState } from "react";
import type { ChecklistStep, Rule } from "@/lib/pill";
import type { Ticket, RepeatFlagResult, RedStopResult } from "@/lib/rule-engine";

interface TechClientProps {
  ticket: Ticket;
  pillVersion: string;
  repeat: RepeatFlagResult;
  redStop: RedStopResult;
  activeSteps: ChecklistStep[];
  activeNote: string;
  rules: Rule[];
  nudgeAllowed: boolean;
  nudgeReason: string;
}

export function TechClient({
  ticket,
  pillVersion,
  repeat,
  redStop,
  activeSteps,
  activeNote,
  rules,
  nudgeAllowed,
  nudgeReason,
}: TechClientProps) {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [openRuleId, setOpenRuleId] = useState<string | null>(null);

  const toggleStep = (step: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(step)) {
        next.delete(step);
      } else {
        next.add(step);
      }
      return next;
    });
  };

  const findRule = (id: string) => rules.find((r) => r.id === id);

  return (
    <main className="page">
      {/* Ticket header */}
      <div className="card" style={{ marginBottom: "12px" }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 300px", minWidth: 0 }}>
            <div className="eyebrow">
              Ticket {ticket.id} - {ticket.buildingName}, Floor {ticket.floor}
            </div>
            <h1>{ticket.tenant}</h1>
            <div style={{ marginTop: "4px", color: "var(--muted)", fontSize: "14px" }}>
              {ticket.complaint} in the {ticket.zone} zone, {ticket.timeOfDay} around {ticket.complaintHour}.
              Reported {new Date(ticket.reportedAt).toLocaleString("en-SG", { dateStyle: "medium", timeStyle: "short" })}.
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end" }}>
            <span className="chip b">Pill v{pillVersion}</span>
            {repeat.isRepeat ? (
              <span className="chip a">REPEAT FLAG ON</span>
            ) : (
              <span className="chip g">First complaint</span>
            )}
            <span className="made-up">{ticket.label}</span>
          </div>
        </div>
      </div>

      {/* Repeat flag banner */}
      {repeat.isRepeat && (
        <div
          className="card"
          style={{
            marginBottom: "12px",
            background: "var(--a-bg)",
            color: "var(--a-ink)",
            borderColor: "var(--a)",
          }}
        >
          <strong>Repeat flag is ON.</strong> {repeat.reason}. The pill switches from quick fix to
          find the cause. No setpoint nudge is allowed. Call the FM chief engineer.{" "}
          <span className="mono" style={{ fontSize: "12px", opacity: 0.8 }}>
            (TS-CC-09)
          </span>
        </div>
      )}

      {/* First-complaint nudge banner */}
      {nudgeAllowed && !repeat.isRepeat && (
        <div
          className="card"
          style={{
            marginBottom: "12px",
            background: "var(--g-bg)",
            color: "var(--g-ink)",
            borderColor: "var(--g)",
          }}
        >
          <strong>Green nudge available.</strong> {nudgeReason}{" "}
          <span className="mono" style={{ fontSize: "12px", opacity: 0.8 }}>
            (TS-CC-21)
          </span>
        </div>
      )}

      {/* Ticket selector */}
      <div className="card" style={{ marginBottom: "12px" }}>
        <div className="eyebrow">Open a ticket</div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "6px" }}>
          <a className="btn" href="/tech?ticket=2301" style={{ fontSize: "12px", textDecoration: "none" }}>
            2301 (first complaint)
          </a>
          <a className="btn" href="/tech?ticket=2318" style={{ fontSize: "12px", textDecoration: "none" }}>
            2318 (repeat, default)
          </a>
          <a className="btn" href="/tech?ticket=2401" style={{ fontSize: "12px", textDecoration: "none" }}>
            2401 (Building B)
          </a>
        </div>
      </div>

      {/* Red stop banner */}
      {redStop.isRed && (
        <div
          className="card"
          style={{
            marginBottom: "12px",
            background: "var(--r-bg)",
            color: "var(--r-ink)",
            borderColor: "var(--r)",
          }}
        >
          <strong>RED STOP.</strong> {redStop.trigger} {redStop.action} Call: {redStop.whoToCall}.
        </div>
      )}

      {/* Intake answers */}
      <div className="card" style={{ marginBottom: "12px" }}>
        <div className="eyebrow">Intake answers (3 questions)</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "6px" }}>
          <div>
            <strong>1. Where exactly?</strong> {ticket.intake.where}
          </div>
          <div>
            <strong>2. When?</strong> {ticket.intake.when}
          </div>
          <div>
            <strong>3. Since when?</strong> {ticket.intake.sinceWhen}
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div className="card">
        <div className="eyebrow">Checklist ({activeSteps.length} steps)</div>
        <div style={{ fontSize: "13px", color: "var(--muted)", marginTop: "2px" }}>{activeNote}</div>

        <ol style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "flex", flexDirection: "column", gap: "8px" }}>
          {activeSteps.map((step) => {
            const isDone = completedSteps.has(step.step);
            return (
              <li
                key={step.step}
                style={{
                  border: "var(--rule-val)",
                  padding: "12px",
                  display: "flex",
                  gap: "10px",
                  alignItems: "flex-start",
                  background: isDone ? "rgba(46, 125, 50, 0.06)" : "var(--panel)",
                }}
              >
                {/* Colour chip */}
                <span className={`chip ${step.colour === "green" ? "g" : step.colour === "amber" ? "a" : "r"}`}>
                  {step.colour}
                </span>

                {/* Step content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "baseline" }}>
                    <span className="mono" style={{ fontSize: "12px", color: "var(--muted)" }}>
                      {step.step}.
                    </span>
                    <span className="mono" style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {step.section}
                    </span>
                  </div>
                  <div style={{ marginTop: "4px", fontSize: "14px" }}>{step.text}</div>
                  <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--muted)" }}>
                    Who: {step.who}
                  </div>

                  {/* "Because" cards for the rules on this step */}
                  <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                    {step.rules.map((rid) => {
                      const rule = findRule(rid);
                      if (!rule) return null;
                      const isOpen = openRuleId === rid;
                      return (
                        <button
                          key={rid}
                          onClick={() => setOpenRuleId(isOpen ? null : rid)}
                          style={{
                            textAlign: "left",
                            background: "transparent",
                            border: "1px dashed var(--line)",
                            padding: "6px 10px",
                            fontFamily: "var(--mono)",
                            fontSize: "12px",
                            color: "var(--muted)",
                            width: "100%",
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{rid}</span>
                          {isOpen ? " (hide because)" : " (show because)"}
                          {isOpen && (
                            <div
                              style={{
                                marginTop: "6px",
                                fontFamily: "var(--font)",
                                fontSize: "13px",
                                color: "var(--ink)",
                                lineHeight: 1.5,
                              }}
                            >
                              <strong>why (from the pill):</strong> {rule.because}
                              <div style={{ marginTop: "4px", fontSize: "11px", color: "var(--muted)" }}>
                                Label: {rule.label}. Approver: {rule.approver}
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Done checkbox */}
                <button
                  onClick={() => toggleStep(step.step)}
                  className="btn"
                  style={{
                    minWidth: "44px",
                    minHeight: "44px",
                    padding: "8px",
                    fontSize: "16px",
                    background: isDone ? "var(--g)" : "var(--panel)",
                    color: isDone ? "var(--g-ink)" : "var(--ink)",
                    borderColor: isDone ? "var(--g)" : "var(--ink)",
                  }}
                  aria-label={isDone ? `Mark step ${step.step} as not done` : `Mark step ${step.step} as done`}
                >
                  {isDone ? "done" : "todo"}
                </button>
              </li>
            );
          })}
        </ol>

        {/* Progress bar */}
        <div style={{ marginTop: "12px", borderTop: "var(--rule-val)", paddingTop: "10px" }}>
          <div className="eyebrow">
            Progress: {completedSteps.size} of {activeSteps.length} steps done
          </div>
          <div
            style={{
              height: "6px",
              background: "var(--line)",
              marginTop: "4px",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${(completedSteps.size / activeSteps.length) * 100}%`,
                background: "var(--g)",
                transition: "width 0.2s",
              }}
            />
          </div>
        </div>
      </div>

      <p className="made-up" style={{ marginTop: "12px", textAlign: "center" }}>
        All tickets, tenants and readings are made up for the demo. Rule text is from the pill.
        A named person signs every change.
      </p>
    </main>
  );
}
