/**
 * The AI switch (S15): Live, Replay, Off, saved as a cookie.
 *
 * Plain values only, no fs, no network, no client, so the switch in the top bar
 * (a client component) can import this file. App code reaches the AI itself only
 * through ai.ts.
 *
 * REPLAY_MODE only sets where the switch starts: 1 starts on Replay, anything
 * else on Live. Once someone picks a position, its cookie wins.
 */

export const AI_MODES = ["live", "replay", "off"] as const;
export type AiMode = (typeof AI_MODES)[number];

export const AI_MODE_COOKIE = "pill-desk-ai";

export const AI_MODE_LABELS: Record<AiMode, string> = {
  live: "Live",
  replay: "Replay",
  off: "Off",
};

/** Shown with every answer that came from web/data/replay/ (S15). */
export const REPLAY_BANNER = "replay: saved real AI answer";

/** The small label on a card when the switch is Off (S15). */
export const AI_OFF_LABEL = "AI off";

/** The only words an AI error ever shows or logs, after its HTTP status (S0 rule 12, S15). */
export const AI_UNAVAILABLE = "AI unavailable, using replay";

/** The label on the extra line the AI adds under a code reason (S14). */
export const AI_WORDING_LABEL = "AI wording";

export function isAiMode(value: unknown): value is AiMode {
  return typeof value === "string" && (AI_MODES as readonly string[]).includes(value);
}

/** Where the switch stands: a picked position wins; otherwise REPLAY_MODE sets the start. */
export function aiModeFrom(cookie: string | null | undefined, replayMode: string | undefined): AiMode {
  if (isAiMode(cookie)) return cookie;
  return replayMode === "1" ? "replay" : "live";
}

/** The cookie the switch writes, for the whole site, kept for a year. */
export function aiModeCookie(mode: AiMode): string {
  return `${AI_MODE_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`;
}

/** Save a picked position in the browser. Called only from the switch's click. */
export function saveAiMode(mode: AiMode): void {
  document.cookie = aiModeCookie(mode);
}
