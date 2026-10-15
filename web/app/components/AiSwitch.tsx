"use client";

import { useState } from "react";
import { AI_MODES, AI_MODE_LABELS, saveAiMode, type AiMode } from "../../lib/ai-mode";

/**
 * The AI switch (S15): Live, Replay, Off, saved as a cookie. REPLAY_MODE only
 * sets where it starts; once someone picks, the cookie wins. The server reads
 * the cookie, so a pick reloads the page and every card shows from the new
 * position. The switch always shows on screen where it stands.
 *
 * While the page reloads after a pick, the picked button shows it is working
 * and the switch cannot fire again (D1).
 */
export function AiSwitch({ mode, onPicked }: { mode: AiMode; onPicked?: () => void }) {
  const [reloading, setReloading] = useState<AiMode | null>(null);

  const pick = (next: AiMode) => {
    if (reloading) return;
    saveAiMode(next);
    if (onPicked) onPicked();
    else {
      setReloading(next);
      window.location.reload();
    }
  };

  return (
    <div className="ai-switch" role="group" aria-label="AI switch">
      <span className="ai-switch-name hud">AI</span>
      {AI_MODES.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === mode}
          aria-busy={reloading === option || undefined}
          disabled={reloading !== null}
          className={[option === mode ? "on" : "", reloading === option ? "is-pending" : ""].filter(Boolean).join(" ")}
          onClick={() => pick(option)}
        >
          {AI_MODE_LABELS[option]}
        </button>
      ))}
    </div>
  );
}
