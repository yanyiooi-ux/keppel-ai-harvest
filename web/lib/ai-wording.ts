/**
 * Where the AI's words meet the cards (S14, S15).
 *
 * Code makes every card first. This file only adds the extra "AI wording" line
 * under a code reason, and the receipt with its AI calls. It never changes a
 * card's title, body, order, tier or number, and it never sends a red card to
 * the AI: no red stop card, no RS-08 card, no Safety list and no TS-CC-06
 * (RS-10) refusal, whatever they carry.
 *
 * AI calls run before memory.update, never inside it (S20).
 */

import { rankWording, AI_OFF_LABEL, type AiDeps, type AiMode, type AiOutcome, type RankWording } from "./ai";
import { loadAndCheckPill } from "./pill";
import { leadsForJob } from "./leads";
import type { Lead } from "./rank";
import type { ChatCard } from "./chat";
import * as memory from "./memory";
import type { MemoryState, Job } from "./memory";

/** True for any card that must never reach the AI (S11, S15). */
export function isRedCard(card: Pick<ChatCard, "kind" | "stopId"> & { colour?: string; colourWord?: string }): boolean {
  if (card.kind === "red-stop" || card.kind === "refusal" || card.kind === "safety-list") return true;
  if (typeof card.stopId === "string" && /^RS-/i.test(card.stopId)) return true;
  if (card.colour === "red" || card.colourWord === "Stop") return true;
  return false;
}

export interface ChatWordingContext {
  state: MemoryState;
  seat: string;
  jobId?: string;
  mode: AiMode;
}

/**
 * Word the cards a typed message produced. Only a card that carries its lead
 * (the "Why?" answer) is worded, with rank-wording. Every other card comes back
 * exactly as it went in.
 */
export async function wordChatCards(cards: ChatCard[], ctx: ChatWordingContext, deps?: AiDeps): Promise<ChatCard[]> {
  const job = ctx.jobId ? memory.jobById(ctx.state, ctx.jobId) : undefined;
  const out: ChatCard[] = [];
  for (const card of cards) {
    if (isRedCard(card) || !card.rankLead || !job || typeof card.body !== "string") {
      out.push(card);
      continue;
    }
    const version = ctx.state.liveVersionByBuilding[job.building] ?? "1.0";
    const pill = loadAndCheckPill("ts-cc", version);
    const result = await rankWording(
      pill,
      { label: card.rankLead.label, reason: card.body, checkText: card.rankLead.checkText },
      { seat: ctx.seat, version, job },
      ctx.mode,
      deps
    );
    out.push(withWording(card, result));
  }
  return out;
}

function withWording(card: ChatCard, result: AiOutcome<RankWording>): ChatCard {
  const worded: ChatCard = {
    ...card,
    aiJob: "rank-wording",
    aiCalls: result.aiCalls,
    receipt: `AI calls: ${result.aiCalls}`,
  };
  if (result.value.aiWording) worded.aiWording = result.value.aiWording;
  if (result.banner) worded.aiBanner = result.banner;
  if (result.notice) worded.aiNotice = result.notice;
  if (result.aiOff) worded.aiOff = result.aiOff;
  return worded;
}

export interface WordedLeads {
  items: { lead: Lead; wording: AiOutcome<RankWording> }[];
  aiCalls: number;
  aiOff: string | null;
}

/**
 * A job's first live leads, ranked by code, each with its rank wording. The
 * leads themselves are exactly what leadsForJob returns, on every switch
 * position; only the extra line can differ.
 */
export async function wordLeads(
  state: MemoryState,
  job: Job,
  seat: string,
  mode: AiMode,
  deps?: AiDeps,
  realNow: Date = new Date(),
  limit = 3
): Promise<WordedLeads> {
  const version = state.liveVersionByBuilding[job.building] ?? "1.0";
  const pill = loadAndCheckPill("ts-cc", version);
  const leads = leadsForJob(state, job, seat, realNow).leads.slice(0, limit);
  const wording = await Promise.all(leads.map((lead) => rankWording(pill, lead, { seat, version, job }, mode, deps)));
  return {
    items: leads.map((lead, i) => ({ lead, wording: wording[i] })),
    aiCalls: wording.reduce((sum, w) => sum + w.aiCalls, 0),
    aiOff: mode === "off" ? AI_OFF_LABEL : null,
  };
}

/**
 * wordLeads, then the model calls it made are added to the memory's AI call
 * count (S20), after the calls and never inside them. With no calls (Replay,
 * Off, no key) nothing is written. The Building B card uses this.
 */
export async function wordLeadsAndCount(
  state: MemoryState,
  job: Job,
  seat: string,
  mode: AiMode,
  deps?: AiDeps,
  realNow: Date = new Date(),
  limit = 3
): Promise<WordedLeads> {
  const worded = await wordLeads(state, job, seat, mode, deps, realNow, limit);
  if (worded.aiCalls > 0) {
    memory.update((s) => {
      s.aiCalls = (s.aiCalls ?? 0) + worded.aiCalls;
    });
  }
  return worded;
}
