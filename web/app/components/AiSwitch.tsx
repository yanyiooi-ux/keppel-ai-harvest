"use client";

import { useState } from "react";
import { AI_MODES, saveAiMode, type AiMode } from "../../lib/ai-mode";
import { AI_MODE_HINTS, AI_MODE_WORDS } from "../../lib/plain-words";

/**
 * The AI switch (S15): Live, Replay, Off, saved as a cookie. REPLAY_MODE only
 * sets where it starts; once someone picks, the cookie wins. The server reads
 * the cookie, so a pick reloads the page and every card shows from the new
 * position. The switch always shows on screen where it stands.
 *
 * Plain words (D1 review): Replay reads "Saved answers", so a judge never takes
 * it for a recording, and one short line says what the position does now.
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
    <div className="ai-switch-wrap">
      <div className="ai-switch" role="group" aria-label="AI switch" aria-describedby="ai-switch-hint">
        <span className="ai-switch-name hud">AI</span>
        {AI_MODES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === mode}
            aria-busy={reloading === option || undefined}
            disabled={reloading !== null}
            title={AI_MODE_HINTS[option]}
            className={[option === mode ? "on" : "", reloading === option ? "is-pending" : ""].filter(Boolean).join(" ")}
            onClick={() => pick(option)}
          >
            {AI_MODE_WORDS[option]}
          </button>
        ))}
      </div>
      <p className="ai-switch-hint" id="ai-switch-hint">
        {AI_MODE_HINTS[mode]}
      </p>
    </div>
  );
}
