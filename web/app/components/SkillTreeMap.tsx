"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";

// --- The 6 steps of the demo, matching the approved plan ---

export interface DemoStep {
  num: number;
  id: string;
  title: string;
  oneLine: string;
  who: string;
  roleColour: "green" | "amber" | "red" | "violet";
  route: string;
}

export const DEMO_STEPS: DemoStep[] = [
  {
    num: 1,
    id: "capture",
    title: "Capture",
    oneLine: "An interview goes in, the AI drafts rules, Keppel signs v1.0.",
    who: "Chief engineer",
    roleColour: "violet",
    route: "/engineer",
  },
  {
    num: 2,
    id: "daily-use",
    title: "Daily use",
    oneLine: "The helpdesk asks 3 questions, the tech works the checklist.",
    who: "FM technician",
    roleColour: "green",
    route: "/tech",
  },
  {
    num: 3,
    id: "safety",
    title: "Safety lines",
    oneLine: "Green steps the tech just does, amber needs a yes, red means stop.",
    who: "Technician and chief engineer",
    roleColour: "red",
    route: "/tech",
  },
  {
    num: 4,
    id: "decide",
    title: "Decide",
    oneLine: "The AOM sees 'Needs your decision' cards, each with approve or escalate.",
    who: "AOM",
    roleColour: "amber",
    route: "/aom",
  },
  {
    num: 5,
    id: "learn",
    title: "Learn with undo",
    oneLine: "A correction becomes v1.1, tests run, the ticket reruns, then rollback.",
    who: "Chief engineer, HQ pill owner",
    roleColour: "violet",
    route: "/engineer",
  },
  {
    num: 6,
    id: "reuse",
    title: "Reuse",
    oneLine: "Building B is offered v1.1, its AOM accepts or says 'not here'.",
    who: "HQ pill owner, Building B AOM",
    roleColour: "green",
    route: "/hq",
  },
];

// --- LocalStorage helpers for demo progress ---

const STORAGE_KEY = "pill-desk-demo-step";

function getStoredStep(): number {
  if (typeof window === "undefined") return 1;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? Math.max(1, Math.min(6, parseInt(stored, 10))) : 1;
}

function setStoredStep(step: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, String(step));
}

export function clearDemoProgress() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

// --- Spring config (Apple rules) ---
const spring = { duration: 0.4, bounce: 0 };
const springAfterDrag = { duration: 0.4, bounce: 0.2 };

// --- Skill tree node component ---

interface SkillTreeNodeProps {
  step: DemoStep;
  status: "done" | "current" | "locked";
  onClick?: () => void;
  isLast: boolean;
}

function SkillTreeNode({ step, status, onClick, isLast }: SkillTreeNodeProps) {
  const isDone = status === "done";
  const isCurrent = status === "current";
  const isLocked = status === "locked";

  const glowColour = isDone
    ? "var(--g-glow)"
    : isCurrent
    ? "var(--accent-glow)"
    : "transparent";

  const nodeColour = isDone
    ? "var(--g)"
    : isCurrent
    ? "var(--violet)"
    : "var(--locked)";

  const nodeSize = isCurrent ? 56 : 48;

  // Role chip colour
  const chipClass =
    step.roleColour === "green" ? "g" :
    step.roleColour === "amber" ? "a" :
    step.roleColour === "red" ? "r" : "b";

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "8px",
      position: "relative",
      zIndex: isCurrent ? 2 : 1,
    }}>
      <motion.button
        onClick={onClick}
        initial={false}
        animate={{
          scale: isCurrent ? 1.05 : 1,
          boxShadow: isCurrent
            ? "0 0 24px var(--accent-glow)"
            : isDone
            ? "0 0 16px var(--g-glow)"
            : "none",
        }}
        transition={spring}
        whileTap={{ scale: 0.97 }}
        style={{
          width: nodeSize,
          height: nodeSize,
          borderRadius: "50%",
          border: isLocked ? "1px solid var(--line)" : `2px solid ${nodeColour}`,
          background: isLocked
            ? "var(--panel-solid)"
            : isDone
            ? "rgba(34, 197, 94, 0.1)"
            : "rgba(139, 124, 255, 0.1)",
          color: nodeColour,
          fontSize: "1.25rem",
          fontWeight: 700,
          fontFamily: "var(--font-head)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: isLocked ? "default" : "pointer",
          opacity: isLocked ? 0.4 : 1,
          position: "relative",
        }}
        aria-label={`Step ${step.num}: ${step.title}`}
      >
        {isDone ? "✓" : step.num}
        {isCurrent && (
          <motion.span
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              position: "absolute",
              inset: -4,
              borderRadius: "50%",
              border: "2px solid var(--violet)",
              opacity: 0.4,
              pointerEvents: "none",
            }}
          />
        )}
      </motion.button>
      <div style={{
        textAlign: "center",
        maxWidth: "100px",
      }}>
        <div style={{
          fontFamily: "var(--font-head)",
          fontSize: "0.75rem",
          fontWeight: 600,
          color: isLocked ? "var(--muted)" : "var(--ink)",
          letterSpacing: "-0.01em",
        }}>
          {step.title}
        </div>
        <span className={`chip ${chipClass}`} style={{
          fontSize: "0.625rem",
          padding: "2px 6px",
          marginTop: "4px",
          opacity: isLocked ? 0.5 : 1,
        }}>
          {step.who}
        </span>
      </div>
    </div>
  );
}

// --- Path connector between nodes ---

function PathConnector({ active }: { active: boolean }) {
  return (
    <div style={{
      flex: 1,
      height: "3px",
      minWidth: "20px",
      background: active
        ? "linear-gradient(90deg, var(--violet), var(--cyan))"
        : "var(--line)",
      borderRadius: "2px",
      boxShadow: active ? "0 0 8px var(--accent-glow)" : "none",
      alignSelf: "center",
      marginTop: "-20px",
    }} />
  );
}

// --- Skill tree map (the main path of 6 nodes) ---

interface SkillTreeMapProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function SkillTreeMap({ currentStep, onStepClick }: SkillTreeMapProps) {
  const steps = DEMO_STEPS;
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (isMobile) {
    // Vertical path on mobile
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0",
        padding: "16px 0",
      }}>
        {steps.map((step, i) => (
          <div key={step.num} style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0",
          }}>
            <SkillTreeNode
              step={step}
              status={
                step.num < currentStep ? "done" :
                step.num === currentStep ? "current" : "locked"
              }
              onClick={onStepClick ? () => onStepClick(step.num) : undefined}
              isLast={i === steps.length - 1}
            />
            {i < steps.length - 1 && (
              <div style={{
                width: "3px",
                height: "32px",
                background: step.num < currentStep
                  ? "linear-gradient(180deg, var(--violet), var(--cyan))"
                  : "var(--line)",
                borderRadius: "2px",
                boxShadow: step.num < currentStep ? "0 0 8px var(--accent-glow)" : "none",
              }} />
            )}
          </div>
        ))}
      </div>
    );
  }

  // Horizontal path on desktop
  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      gap: "0",
      padding: "24px 16px",
      overflowX: "auto",
    }}>
      {steps.map((step, i) => (
        <div key={step.num} style={{
          display: "flex",
          alignItems: "flex-start",
          flex: i < steps.length - 1 ? "1 1 auto" : "0 0 auto",
        }}>
          <SkillTreeNode
            step={step}
            status={
              step.num < currentStep ? "done" :
              step.num === currentStep ? "current" : "locked"
            }
            onClick={onStepClick ? () => onStepClick(step.num) : undefined}
            isLast={i === steps.length - 1}
          />
          {i < steps.length - 1 && (
            <PathConnector active={step.num < currentStep} />
          )}
        </div>
      ))}
    </div>
  );
}

// --- Export helpers ---

export { getStoredStep, setStoredStep };
