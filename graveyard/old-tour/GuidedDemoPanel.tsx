"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { DEMO_STEPS, getStoredStep, setStoredStep, clearDemoProgress } from "./SkillTreeMap";
import { useRouter, usePathname } from "next/navigation";

const spring = { duration: 0.4, bounce: 0 };

interface GuideContent {
  whatYouSee: string;
  whoThisIs: string;
  whatToClick: string;
}

const GUIDE: GuideContent[] = [
  {
    whatYouSee: "The home map. Six steps of the demo, Pip on step 1. A story strip below shows each step in plain words.",
    whoThisIs: "You are the demo guide. No login yet.",
    whatToClick: "Press Start demo to walk through all six steps.",
  },
  {
    whatYouSee: "The technician's phone checklist. Ticket 2318 is a repeat complaint from Level 23. The repeat flag is ON, so no setpoint nudge is allowed.",
    whoThisIs: "You are the FM technician, on site with a phone.",
    whatToClick: "Read the repeat flag banner, then scroll the checklist. Tap a 'show why' button to see why.",
  },
  {
    whatYouSee: "Green steps the technician just does. Amber steps need a named person's yes. Red means stop and call someone. The never-list is at the bottom.",
    whoThisIs: "You are the technician, checking safety lines.",
    whatToClick: "Look at the colour chips on each step. Open a red stop to see who to call.",
  },
  {
    whatYouSee: "The AOM's 'Needs your decision' screen. Five cards: repeat complaint, colder floor, west zone at capacity, leasing heads-up, and pill updates.",
    whoThisIs: "You are the AOM (Asset Operations Manager) for Tower A.",
    whatToClick: "Press Approve, Send back, or Escalate on a card. Press Undo to go back.",
  },
  {
    whatYouSee: "The chief engineer corrects a rule. v1.1 is drafted, golden tests run, the HQ pill owner signs, then one click rolls back to v1.0.",
    whoThisIs: "You are the chief engineer, then the HQ pill owner.",
    whatToClick: "This screen is a placeholder for now. The learning loop comes in a later step.",
  },
  {
    whatYouSee: "Building B is offered v1.1. Its AOM accepts or says 'not here' with a reason. HQ sees which building runs which version.",
    whoThisIs: "You are the HQ pill owner, then Building B's AOM.",
    whatToClick: "This screen is a placeholder for now. The reuse flow comes in a later step.",
  },
];

const OPEN_EVENT = "pill-desk-open-guide";

export function GuidedDemoPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const [step, setStep] = useState(1);
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const saved = getStoredStep();
    if (saved > 1) {
      setStep(saved);
      setIsOpen(true);
    }

    const openHandler = () => {
      setStep(1);
      setIsOpen(true);
    };
    window.addEventListener(OPEN_EVENT, openHandler);

    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener(OPEN_EVENT, openHandler);
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  const goToStep = (newStep: number) => {
    const clamped = Math.max(1, Math.min(6, newStep));
    setStep(clamped);
    setStoredStep(clamped);
    if (clamped > 1) {
      const route = DEMO_STEPS[clamped - 1].route;
      router.push(route);
    } else {
      router.push("/");
    }
  };

  const handleReset = () => {
    clearDemoProgress();
    setStep(1);
    setIsOpen(false);
    router.push("/");
  };

  const guide = GUIDE[step - 1];
  const currentStepData = DEMO_STEPS[step - 1];

  const panelStyle: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 90,
        borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
        padding: "20px",
        maxHeight: "55vh",
        overflowY: "auto",
      }
    : {
        position: "fixed",
        top: "72px",
        right: "24px",
        width: "320px",
        maxHeight: "calc(100vh - 96px)",
        overflowY: "auto",
        zIndex: 50,
        padding: "20px",
      };

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={spring}
            whileTap={{ scale: 0.97 }}
            onClick={() => setIsOpen(true)}
            style={{
              position: "fixed",
              bottom: "24px",
              right: "24px",
              zIndex: 50,
              minHeight: "44px",
              minWidth: "44px",
              padding: "0 16px",
              borderRadius: "var(--chip-radius)",
              background: "linear-gradient(90deg, var(--violet), var(--cyan))",
              color: "#FFFFFF",
              fontWeight: 600,
              fontSize: "0.8125rem",
              fontFamily: "var(--font)",
              border: "none",
              boxShadow: "0 4px 20px var(--accent-glow)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            Demo guide
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={isMobile ? { y: 300 } : { x: 360, opacity: 0 }}
            animate={isMobile ? { y: 0 } : { x: 0, opacity: 1 }}
            exit={isMobile ? { y: 300 } : { x: 360, opacity: 0 }}
            transition={spring}
            style={{
              ...panelStyle,
              background: "var(--panel)",
              border: "1px solid var(--border)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              boxShadow: "var(--shadow), 0 0 24px var(--accent-glow)",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontFamily: "var(--mono)", fontSize: "0.6875rem", color: "var(--violet)" }}>
                  Step {step} of 6
                </div>
                <div style={{
                  fontFamily: "var(--font-head)",
                  fontSize: "1.0625rem",
                  fontWeight: 700,
                  color: "var(--ink)",
                  letterSpacing: "-0.02em",
                  marginTop: "2px",
                }}>
                  {currentStepData.title}
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  minHeight: "44px",
                  minWidth: "44px",
                  borderRadius: "var(--radius-sm)",
                  background: "transparent",
                  color: "var(--ink-dim)",
                  fontSize: "1.2rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid var(--border)",
                }}
                aria-label="Collapse demo guide"
              >
                x
              </button>
            </div>

            <div style={{ display: "flex", gap: "6px" }}>
              {DEMO_STEPS.map((s) => (
                <div
                  key={s.num}
                  style={{
                    height: "4px",
                    flex: 1,
                    borderRadius: "2px",
                    background: s.num <= step
                      ? "linear-gradient(90deg, var(--violet), var(--cyan))"
                      : "var(--line)",
                  }}
                />
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <div style={{ fontSize: "0.6875rem", color: "var(--muted)", fontFamily: "var(--mono)", marginBottom: "4px" }}>
                  What you are seeing
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--ink)", lineHeight: "1.5" }}>
                  {guide.whatYouSee}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.6875rem", color: "var(--muted)", fontFamily: "var(--mono)", marginBottom: "4px" }}>
                  Who this is
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--ink-dim)" }}>
                  {guide.whoThisIs}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.6875rem", color: "var(--muted)", fontFamily: "var(--mono)", marginBottom: "4px" }}>
                  What to click
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--ink-dim)" }}>
                  {guide.whatToClick}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
              <button
                onClick={() => goToStep(step - 1)}
                disabled={step === 1}
                style={{
                  flex: "0 0 auto",
                  minHeight: "44px",
                  padding: "0 16px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--panel-solid)",
                  color: step === 1 ? "var(--muted)" : "var(--ink)",
                  border: "1px solid var(--border)",
                  fontWeight: 500,
                  fontSize: "0.8125rem",
                  fontFamily: "var(--font)",
                  opacity: step === 1 ? 0.4 : 1,
                  cursor: step === 1 ? "default" : "pointer",
                }}
              >
                Back
              </button>
              {step < 6 ? (
                <button
                  onClick={() => goToStep(step + 1)}
                  style={{
                    flex: 1,
                    minHeight: "44px",
                    padding: "0 16px",
                    borderRadius: "var(--radius-sm)",
                    background: "linear-gradient(90deg, var(--violet), var(--cyan))",
                    color: "#FFFFFF",
                    border: "none",
                    fontWeight: 600,
                    fontSize: "0.8125rem",
                    fontFamily: "var(--font)",
                  }}
                >
                  Next: {DEMO_STEPS[step].title}
                </button>
              ) : (
                <button
                  onClick={handleReset}
                  style={{
                    flex: 1,
                    minHeight: "44px",
                    padding: "0 16px",
                    borderRadius: "var(--radius-sm)",
                    background: "linear-gradient(90deg, var(--violet), var(--cyan))",
                    color: "#FFFFFF",
                    border: "none",
                    fontWeight: 600,
                    fontSize: "0.8125rem",
                    fontFamily: "var(--font)",
                  }}
                >
                  Reset demo
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
