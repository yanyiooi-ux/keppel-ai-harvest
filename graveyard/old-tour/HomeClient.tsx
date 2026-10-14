"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { SkillTreeMap, getStoredStep, setStoredStep } from "./components/SkillTreeMap";
import { StoryStrip } from "./components/StoryStrip";
import { GuidedDemoPanel } from "./components/GuidedDemoPanel";
import { useRouter } from "next/navigation";

const spring = { duration: 0.4, bounce: 0 };

// --- Who is who key ---
// Each role gets its own colour
const WHO_IS_WHO = [
  { role: "FM technician", does: "works the checklist on a phone", colour: "g" as const },
  { role: "Chief engineer", does: "checks every change, never signs", colour: "b" as const },
  { role: "AOM", does: "supervises, decides on money and the tenant", colour: "a" as const },
  { role: "HQ pill owner", does: "signs numbered pill versions", colour: "r" as const },
  { role: "Helpdesk", does: "asks the 3 questions, creates the ticket", colour: "b" as const },
  { role: "Tenant", does: "reports the complaint, never works the checklist", colour: "g" as const },
];

export default function HomeClient() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCurrentStep(getStoredStep());
  }, []);

  const handleStepClick = (step: number) => {
    setCurrentStep(step);
    setStoredStep(step);
  };

  const handleStartDemo = () => {
    setStoredStep(1);
    setCurrentStep(1);
    // Open the guide panel via custom event
    window.dispatchEvent(new Event("pill-desk-open-guide"));
    // Navigate to /tech to start the walk-through
    router.push("/tech");
  };

  return (
    <main className="page" style={{ paddingBottom: "120px" }}>
      {/* Hero section */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        style={{ textAlign: "center", marginBottom: "24px", marginTop: "16px" }}
      >
        <h1 style={{
          fontSize: "2.5rem",
          lineHeight: "1.05",
          letterSpacing: "-0.02em",
          marginBottom: "8px",
          background: "linear-gradient(90deg, var(--violet), var(--cyan))",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          Pill Desk
        </h1>
        <p style={{
          fontSize: "1rem",
          color: "var(--ink-dim)",
          maxWidth: "560px",
          margin: "0 auto",
          lineHeight: "1.5",
        }}>
          Turning expert know-how into reusable, governed Intelligence Pills.
          A live demo for the Keppel AI Harvest challenge.
        </p>
        <p className="made-up" style={{ marginTop: "6px" }}>
          All buildings, tenants and readings are made up for the demo.
        </p>
      </motion.div>

      {/* Skill tree map with Pip ON the current node */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.1 }}
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          marginBottom: "24px",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          overflow: "hidden",
        }}
      >
        <SkillTreeMap
          currentStep={mounted ? currentStep : 1}
          onStepClick={handleStepClick}
        />
      </motion.div>

      {/* Start demo button */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.2 }}
        style={{ display: "flex", justifyContent: "center", marginBottom: "32px" }}
      >
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleStartDemo}
          style={{
            minHeight: "52px",
            padding: "0 32px",
            borderRadius: "var(--chip-radius)",
            background: "linear-gradient(90deg, var(--violet), var(--cyan))",
            color: "#FFFFFF",
            border: "none",
            fontWeight: 700,
            fontSize: "1rem",
            fontFamily: "var(--font-head)",
            letterSpacing: "-0.01em",
            boxShadow: "0 4px 20px var(--accent-glow)",
            cursor: "pointer",
          }}
        >
          Start demo
        </motion.button>
      </motion.div>

      {/* Story strip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ ...spring, delay: 0.25 }}
        style={{ marginBottom: "32px" }}
      >
        <div className="eyebrow" style={{ marginBottom: "12px" }}>
          The story in six panels
        </div>
        <StoryStrip />
      </motion.div>

      {/* Who is who */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.3 }}
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "20px",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
        }}
      >
        <div className="eyebrow" style={{ marginBottom: "12px" }}>
          Who is who
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          {WHO_IS_WHO.map((person) => (
            <div
              key={person.role}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flex: "1 1 200px",
              }}
            >
              <span className={`chip ${person.colour}`} style={{ flexShrink: 0 }}>
                {person.role}
              </span>
              <span style={{ fontSize: "0.8125rem", color: "var(--ink-dim)" }}>
                {person.does}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Guided demo panel (fixed, opens on Start demo) */}
      {mounted && <GuidedDemoPanel />}
    </main>
  );
}
