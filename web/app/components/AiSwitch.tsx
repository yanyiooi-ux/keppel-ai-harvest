"use client";

import { AI_MODES, AI_MODE_LABELS, saveAiMode, type AiMode } from "../../lib/ai-mode";

/**
 * The AI switch (S15): Live, Replay, Off, saved as a cookie. REPLAY_MODE only
 * sets where it starts; once someone picks, the cookie wins. The server reads
 * the cookie, so a pick reloads the page and every card shows from the new
 * position. The switch always shows on screen where it stands.
 */
export function AiSwitch({ mode, onPicked }: { mode: AiMode; onPicked?: () => void }) {
  const pick = (next: AiMode) => {
    saveAiMode(next);
    if (onPicked) onPicked();
    else window.location.reload();
  };

  return (
    <div className="ai-switch" role="group" aria-label="AI switch">
      <span className="ai-switch-name hud">AI</span>
      {AI_MODES.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === mode}
          className={option === mode ? "on" : ""}
          onClick={() => pick(option)}
        >
          {AI_MODE_LABELS[option]}
        </button>
      ))}
    </div>
  );
}
