"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";

// --- The 6 steps of the demo, matching the approved plan ---

export interface DemoStep {
  num: number;
  id: string;
  title: string;
  oneLine: string;
  who: string;
  roleColour: "green" | "amber" | "red" | "violet" | "cyan";
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
    roleColour: "cyan",
    route: "/hq",
  },
];

// --- LocalStorage helpers ---

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

// --- Spring config ---
const spring = { duration: 0.4, bounce: 0 };
const hopSpring = { duration: 0.5, bounce: 0.2 }; // bounce only on hop (flick)

// --- Dynamic import Pip (no SSR) ---
const PipCharacter = dynamic(
  () => import("./PipCharacter").then((m) => m.PipCharacter),
  {
    ssr: false,
    loading: () => (
      <div style={{ width: 80, height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--b-bg)" }} />
      </div>
    ),
  }
);

// --- Skill tree node ---

interface SkillTreeNodeProps {
  step: DemoStep;
  status: "done" | "current" | "locked";
  onClick?: () => void;
}

function SkillTreeNode({ step, status, onClick }: SkillTreeNodeProps) {
  const isDone = status === "done";
  const isCurrent = status === "current";
  const isLocked = status === "locked";

  const ringColour = isDone
    ? "var(--g)"
    : isCurrent
    ? "var(--violet)"
    : "var(--locked)";

  const ringBg = isLocked
    ? "var(--panel-solid)"
    : isDone
    ? "rgba(34, 197, 94, 0.12)"
    : "rgba(139, 124, 255, 0.12)";

  const ringOpacity = isLocked ? 0.5 : 1;

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
      zIndex: isCurrent ? 3 : 1,
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
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: isLocked ? "1px solid var(--line)" : `2px solid ${ringColour}`,
          background: ringBg,
          color: ringColour,
          fontSize: "1.125rem",
          fontWeight: 700,
          fontFamily: "var(--font-head)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: isLocked ? "default" : "pointer",
          opacity: ringOpacity,
          position: "relative",
        }}
        aria-label={`Step ${step.num}: ${step.title}`}
      >
        {isDone ? "✓" : step.num}
        {isCurrent && (
          <motion.span
            animate={{ opacity: [0.4, 0.9, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              position: "absolute",
              inset: -5,
              borderRadius: "50%",
              border: "2px solid var(--violet)",
              pointerEvents: "none",
            }}
          />
        )}
      </motion.button>
      <div style={{ textAlign: "center", maxWidth: "110px" }}>
        <div style={{
          fontFamily: "var(--font-head)",
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "var(--ink)",
          letterSpacing: "-0.01em",
        }}>
          {step.title}
        </div>
        <span className={`chip ${chipClass}`} style={{
          fontSize: "0.625rem",
          padding: "2px 6px",
          marginTop: "4px",
        }}>
          {step.who}
        </span>
      </div>
    </div>
  );
}

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
      alignSelf: "flex-start",
      marginTop: "22px",
    }} />
  );
}

function VerticalConnector({ active }: { active: boolean }) {
  return (
    <div style={{
      width: "3px",
      height: "32px",
      background: active
        ? "linear-gradient(180deg, var(--violet), var(--cyan))"
        : "var(--line)",
      borderRadius: "2px",
      boxShadow: active ? "0 0 8px var(--accent-glow)" : "none",
    }} />
  );
}

function BuildingBIcon() {
  return (
    <div style={{
      width: 40,
      height: 40,
      borderRadius: "var(--radius-sm)",
      background: "rgba(56, 189, 248, 0.12)",
      border: "1px solid var(--border)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "1.2rem",
    }}>
      B
    </div>
  );
}

// --- Skill tree map with Pip ON the current node ---

interface SkillTreeMapProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function SkillTreeMap({ currentStep, onStepClick }: SkillTreeMapProps) {
  const steps = DEMO_STEPS;
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [pipPos, setPipPos] = useState({ x: 0, y: 0 });
  const [pipHeight, setPipHeight] = useState(120);
  const [pipWidth, setPipWidth] = useState(80);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const updatePipPos = () => {
      const container = containerRef.current;
      const node = nodeRefs.current[currentStep - 1];
      if (!container || !node) return;
      const containerRect = container.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      const x = nodeRect.left - containerRect.left + nodeRect.width / 2;
      const y = nodeRect.top - containerRect.top - 75;
      setPipPos({ x, y });
      setPipHeight(isMobile ? 100 : 120);
      setPipWidth(isMobile ? 70 : 80);
    };
    const timer = setTimeout(updatePipPos, 50);
    window.addEventListener("resize", updatePipPos);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updatePipPos);
    };
  }, [currentStep, isMobile]);

  const setNodeRef = (index: number) => (el: HTMLDivElement | null) => {
    nodeRefs.current[index] = el;
  };

  const pipVariant = currentStep as 1 | 2 | 3 | 4 | 5 | 6;

  if (isMobile) {
    return (
      <div ref={containerRef} style={{ position: "relative", padding: "70px 0 20px" }}>
        <motion.div
          animate={{ x: pipPos.x - pipWidth / 2, y: pipPos.y }}
          transition={hopSpring}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: pipWidth,
            zIndex: 5,
            pointerEvents: "none",
          }}
        >
          <PipCharacter variant={pipVariant} height={pipHeight} />
        </motion.div>

        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0,
        }}>
          {steps.map((step, i) => (
            <div key={step.num}>
              <div ref={setNodeRef(i)}>
                <SkillTreeNode
                  step={step}
                  status={
                    step.num < currentStep ? "done" :
                    step.num === currentStep ? "current" : "locked"
                  }
                  onClick={onStepClick ? () => onStepClick(step.num) : undefined}
                />
              </div>
              {i < steps.length - 1 && (
                <VerticalConnector active={step.num < currentStep} />
              )}
              {i === steps.length - 1 && currentStep === 6 && (
                <>
                  <VerticalConnector active={true} />
                  <BuildingBIcon />
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: "relative", padding: "70px 16px 20px" }}>
      <motion.div
        animate={{ x: pipPos.x - pipWidth / 2, y: pipPos.y }}
        transition={hopSpring}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: pipWidth,
          zIndex: 5,
          pointerEvents: "none",
        }}
      >
        <PipCharacter variant={pipVariant} height={pipHeight} />
      </motion.div>

      <div style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 0,
        overflowX: "auto",
      }}>
        {steps.map((step, i) => (
          <div key={step.num} style={{
            display: "flex",
            alignItems: "flex-start",
            flex: i < steps.length - 1 ? "1 1 auto" : "0 0 auto",
          }}>
            <div ref={setNodeRef(i)}>
              <SkillTreeNode
                step={step}
                status={
                  step.num < currentStep ? "done" :
                  step.num === currentStep ? "current" : "locked"
                }
                onClick={onStepClick ? () => onStepClick(step.num) : undefined}
              />
            </div>
            {i < steps.length - 1 && (
              <PathConnector active={step.num < currentStep} />
            )}
            {i === steps.length - 1 && currentStep === 6 && (
              <>
                <PathConnector active={true} />
                <div style={{ alignSelf: "flex-start", marginTop: "12px" }}>
                  <BuildingBIcon />
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export { getStoredStep, setStoredStep };
