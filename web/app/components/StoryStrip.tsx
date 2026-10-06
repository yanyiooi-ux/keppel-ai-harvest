"use client";

import { motion } from "framer-motion";

// --- Story strip: 6 comic panels, one per step ---
// Each panel: Pip doing the step, one everyday picture, one sentence of 12 words max.
// The pictures are described as emoji + CSS art (no image files).

interface StoryPanel {
  num: number;
  step: string;
  pipAction: string;
  everydayPicture: string;
  pictureLabel: string;
  sentence: string;
}

const STORY: StoryPanel[] = [
  {
    num: 1,
    step: "Capture",
    pipAction: "writes notes in a book",
    everydayPicture: "restaurant",
    pictureLabel: "a waiter tells the cook",
    sentence: "A veteran tells the app what they know, like a recipe book.",
  },
  {
    num: 2,
    step: "Daily use",
    pipAction: "wears a hard hat, checks a phone",
    everydayPicture: "checklist",
    pictureLabel: "a pilot's pre-flight list",
    sentence: "The tech follows a set checklist on their phone, step by step.",
  },
  {
    num: 3,
    step: "Safety lines",
    pipAction: "points at a traffic light",
    everydayPicture: "traffic lights",
    pictureLabel: "green go, amber wait, red stop",
    sentence: "Green steps just happen, amber needs a yes, red means stop.",
  },
  {
    num: 4,
    step: "Decide",
    pipAction: "holds a big stamp",
    everydayPicture: "stamp",
    pictureLabel: "approve or send back",
    sentence: "The manager sees each card and stamps approve, send back, or escalate.",
  },
  {
    num: 5,
    step: "Learn with undo",
    pipAction: "levels up, badge flips to v1.1",
    everydayPicture: "recipe book",
    pictureLabel: "a new edition, old one kept",
    sentence: "A correction makes v1.1, tests run, then one click undoes it.",
  },
  {
    num: 6,
    step: "Reuse",
    pipAction: "splits into two, one walks away",
    everydayPicture: "bubble tea",
    pictureLabel: "one recipe, many shops",
    sentence: "Building B gets the same pill and its manager says yes or not here.",
  },
];

// --- Simple emoji art for the everyday pictures ---
function EverydayPicture({ kind }: { kind: string }) {
  const pictures: Record<string, string> = {
    restaurant: "🍽️",
    checklist: "📋",
    "traffic lights": "🚦",
    stamp: "🔖",
    "recipe book": "📖",
    "bubble tea": "🧋",
  };
  return (
    <div style={{
      fontSize: "1.5rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "40px",
      height: "40px",
      background: "var(--b-bg)",
      borderRadius: "var(--radius-sm)",
      flexShrink: 0,
    }}>
      {pictures[kind] || "📍"}
    </div>
  );
}

// --- Pip mini SVG for the story strip ---
function PipMini() {
  return (
    <div style={{
      width: "32px",
      height: "32px",
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--b-bg)",
      borderRadius: "50%",
    }}>
      <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="5" width="12" height="14" rx="6" fill="#8B7CFF" />
        <circle cx="9" cy="11" r="1.5" fill="#FFFFFF" />
        <circle cx="15" cy="11" r="1.5" fill="#FFFFFF" />
        <circle cx="9" cy="11" r="0.7" fill="#07080C" />
        <circle cx="15" cy="11" r="0.7" fill="#07080C" />
      </svg>
    </div>
  );
}

export function StoryStrip() {
  return (
    <div style={{
      display: "flex",
      gap: "12px",
      overflowX: "auto",
      paddingBottom: "8px",
      flexWrap: "wrap",
    }}>
      {STORY.map((panel, i) => (
        <motion.div
          key={panel.num}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.06 }}
          style={{
            flex: "1 1 160px",
            minWidth: "150px",
            maxWidth: "200px",
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            position: "relative",
          }}
        >
          {/* Step number */}
          <div style={{
            position: "absolute",
            top: "10px",
            right: "12px",
            fontFamily: "var(--mono)",
            fontSize: "0.6875rem",
            color: "var(--muted)",
          }}>
            {panel.num}/6
          </div>

          {/* Pip + everyday picture row */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginTop: "12px",
          }}>
            <PipMini />
            <div style={{ fontSize: "1rem", color: "var(--ink-dim)" }}>→</div>
            <EverydayPicture kind={panel.everydayPicture} />
          </div>

          {/* Title */}
          <div style={{
            fontFamily: "var(--font-head)",
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "var(--violet)",
            letterSpacing: "-0.01em",
          }}>
            {panel.step}
          </div>

          {/* Sentence */}
          <div style={{
            fontSize: "0.8125rem",
            color: "var(--ink-dim)",
            lineHeight: "1.5",
          }}>
            {panel.sentence}
          </div>

          {/* Picture label */}
          <div style={{
            fontSize: "0.6875rem",
            color: "var(--muted)",
            fontFamily: "var(--mono)",
          }}>
            {panel.pictureLabel}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
