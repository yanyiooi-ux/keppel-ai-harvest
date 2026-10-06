"use client";

import { useState } from "react";
import type { Rule } from "@/lib/pill";

interface DecisionCard {
  id: string;
  title: string;
  detail: string;
  ruleIds: string[];
  colour: "green" | "amber" | "red";
  who: string;
}

interface AomClientProps {
  cards: DecisionCard[];
  rules: Rule[];
  pillVersion: string;
}

type Decision = "approve" | "send-back" | "escalate" | null;

export function AomClient({ cards, rules, pillVersion }: AomClientProps) {
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [openRuleId, setOpenRuleId] = useState<string | null>(null);

  const decide = (cardId: string, decision: Decision) => {
    setDecisions((prev) => ({ ...prev, [cardId]: decision }));
  };

  const findRule = (id: string) => rules.find((r) => r.id === id);

  const pendingCount = cards.filter((c) => !decisions[c.id]).length;
  const decidedCount = cards.length - pendingCount;

  return (
    <main className="page">
      <div className="card" style={{ marginBottom: "12px" }}>
        <div className="eyebrow">Asset Operations Manager</div>
        <h1>Needs your decision</h1>
        <div style={{ marginTop: "4px", color: "var(--muted)", fontSize: "14px" }}>
          Pill v{pillVersion} - TS-CC. {pendingCount} pending, {decidedCount} decided.
          All buildings, tenants and cards are made up for the demo.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {cards.map((card) => {
          const decision = decisions[card.id];
          return (
            <div key={card.id} className="card">
              {/* Header */}
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <span className={`chip ${card.colour === "green" ? "g" : card.colour === "amber" ? "a" : "r"}`}>
                  {card.colour}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "16px" }}>{card.title}</div>
                </div>
                {decision && (
                  <span
                    className="chip"
                    style={{
                      background: decision === "approve" ? "var(--g-bg)" : decision === "send-back" ? "var(--a-bg)" : "var(--r-bg)",
                      color: decision === "approve" ? "var(--g-ink)" : decision === "send-back" ? "var(--a-ink)" : "var(--r-ink)",
                    }}
                  >
                    {decision === "approve" ? "APPROVED" : decision === "send-back" ? "SENT BACK" : "ESCALATED"}
                  </span>
                )}
              </div>

              {/* Detail */}
              <div style={{ fontSize: "14px", color: "var(--ink)", lineHeight: 1.5 }}>{card.detail}</div>

              {/* Who decides */}
              <div style={{ fontSize: "12px", color: "var(--muted)", fontFamily: "var(--mono)" }}>
                Who: {card.who}
              </div>

              {/* Rule because cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" }}>
                {card.ruleIds.map((rid) => {
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
                          <strong>AI wording:</strong> {rule.because}
                          <div style={{ marginTop: "4px", fontSize: "11px", color: "var(--muted)" }}>
                            Label: {rule.label}. Approver: {rule.approver}
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Decision buttons */}
              {!decision && (
                <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                  <button className="btn pri" onClick={() => decide(card.id, "approve")}>
                    Approve
                  </button>
                  <button className="btn" onClick={() => decide(card.id, "send-back")}>
                    Send back
                  </button>
                  <button
                    className="btn"
                    onClick={() => decide(card.id, "escalate")}
                    style={{ borderColor: "var(--r)", color: "var(--r)" }}
                  >
                    Escalate
                  </button>
                </div>
              )}

              {/* Undo */}
              {decision && (
                <button
                  className="btn"
                  onClick={() => decide(card.id, null)}
                  style={{ marginTop: "8px", fontSize: "11px" }}
                >
                  Undo decision
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="made-up" style={{ marginTop: "12px", textAlign: "center" }}>
        All decisions are role-played for the demo. A named person signs every change. AI wording is labelled AI wording.
      </p>
    </main>
  );
}
