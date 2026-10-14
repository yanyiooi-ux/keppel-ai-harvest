---
name: C6a
overview: "The AI words things now. Part 1 of 2 of C6: three AI jobs, their prompts, replay, the AI switch."
---

# C6a: AI wording jobs, prompts, replay and the AI switch [C6a]

Built by Claude Code (not CodeBuddy), after CodeBuddy's credit ran out. Code decides, the AI only words. The AI never
ranks and never sees a red card. No call to Hunyuan in this part: tests use a fake client, the network stays blocked.

## Read first
- RUN-ALL "How to run this file" rules 1 to 16. Rule 4: build rank-wording, tenant-reply and new-solution; skip only
  the chip job and chip.md (cut 1); skip item 7, the replay quality test (cut 3). Rule 6: ai.ts reads the replay
  folder from one setting; a NEW setup file points it at an empty temp folder for every test. Rule 3e: render check
  on Replay and Off only, never Live.
- Spec S0 rules 4 and 12, S13, S14, S15, T-C6a. Also S10 (tips), S16 (the menu, the demo lines), S21 (cards).

## Items, each failing test first

1. **The AI layer in `web/lib/ai-core.ts`** (no `server-only`; `ai.ts` stays `server-only` plus a re-export).
   - One setting for the replay folder: `PILL_DESK_REPLAY_DIR`, default `web/data/replay/`.
   - `AiMode` live, replay, off, and the cookie and labels in `web/lib/ai-mode.ts` (no server code, so the switch
     can import it). `aiModeFrom(cookie, REPLAY_MODE)`: a valid cookie wins; else `1` starts on Replay, anything
     else on Live. An empty key turns Live into Replay by itself.
   - `openAiModelClient`: streams, reads only `content`, never `reasoning_content`; finish `length` with no content
     is no answer; every call uses `AI_MAX_TOKENS` and times out after 8 s.
   - `runAiJob(spec, mode, deps)`: Off gives the fallback, "AI off", 0 calls. Otherwise Hunyuan (Live with a key),
     then a replay that passed, with the banner "replay: saved real AI answer", then the fallback. Every answer is
     checked again before it shows. An error logs and shows only the HTTP status and "AI unavailable, using replay",
     then tries the replay. A live answer that fails its checks shows only the code text (S14), and a live reply with
     no content is no answer, so the fallback shows (S15); neither turns into a replay.
   - Replay keys (S15): AI job, seat, job, pill version and a hash of the code text it words (rank wording, tenant
     reply); the new solution's free text is keyed by a hash of the exact fix line and why line. A file holds only
     `{ text, pass }`. Any mismatch: no replay, the fallback shows.
2. **The 3 jobs, exactly as the S15 table.**
   - `rank-wording`: input one lead's code reason, label and check text; at most 2 sentences; S13 and S14; fallback
     the code reason only. The code reason always stays; the AI line is extra, labelled "AI wording".
   - `tenant-reply`: input only the chosen tips word for word and the code line (never the job, its cause line or a
     tenant name); at most 3 sentences; S13 with item 10 and S14 (the C3b `tenantReplyOrTips`); fallback the tips
     word for word.
   - `new-solution`: input the fix line, the why line and the menu; JSON `{ ruleText, fact, effects }` or
     `{ kind: "note", text }`; S13 on the text; the menu check in code (`screenSuggestion`, so a forced rule the menu
     refuses comes back as a note); fallback rule text = the fix line word for word, fact and effects picked by hand.
3. **Prompts** in `web/prompts/`: `rank-wording.md`, `tenant-reply.md` (TS-CC-02's limits word for word, checked
   against the pill), `new-solution.md` (the C3c menu, checked against `conditions.ts`). Read at call time with fs.
4. **Never on red.** `wordChatCards` never sends a red stop card, an RS-08 card, a safety list or a TS-CC-06 (RS-10)
   refusal to the AI, even with a fake client on. Each worded card's receipt shows its AI calls.
5. **Where wording shows now.** The "Why?" chip card (rank wording of the first lead) through `/api/chat`, worded
   before `memory.update`, never inside it. The Building B card's 3 leads. Tenant reply and new solution are ready
   for C7a and C8a, which own those screens.
6. **The AI switch** in the top bar: Live, Replay, Off, saved as a cookie; `REPLAY_MODE` only sets the start. Off:
   the same cards, a small "AI off" label, no AI line. `seatView(state, seat, mode)` drops stored AI lines on Off.
   The REPLAY_MODE comment in `.env.example` and `web/.env.example` says this (checked by reading the file myself;
   no test reads a `web/.env*` file, run rule 9).
7. **`web/scripts/ai-record.ts`** (`npm run ai:record`): imports `ai-core.ts`, loads the env file with
   `loadEnvConfig` and a no-op logger, ignores `REPLAY_MODE`, records the demo targets in `web/lib/ai-demo-targets.ts`
   that are missing or failed, saves only `{ text, pass }`, prints only fixed phrases, statuses, the model id and
   counts. Not run in this part.
8. **Test setup.** New `web/tests/setup-replay.ts` in `vitest.config.ts` setupFiles points `PILL_DESK_REPLAY_DIR` at
   an empty temp folder for every test. `web/tests/setup.ts` stays byte for byte.

## Not built (cuts)
- The chip job and `web/prompts/chip.md` (cut 1). The replay quality test (cut 3).

## When done
npm test, npm run build, `git diff --stat -- web/tests` (no old test changed), render check on a production build:
`/seat/technician` with a "Why?" card at 1280 px and 390 px on Replay and on Off, the key grep, the history scans,
then commit "feat: AI wording jobs, prompts, replay and the AI switch [C6a]". Then the proof row alone.
