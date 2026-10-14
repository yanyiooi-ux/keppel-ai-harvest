/**
 * One typed message, start to end: the whole of POST /api/chat except reading
 * the request and the AI switch's cookie, so a test runs the route's real code.
 *
 * Code answers first (S19); then the AI may word a card's code reason (S15),
 * outside memory.update, never inside it (S20). Red cards never reach the AI.
 * The message, Pip's cards and the cards' AI calls are written in one update.
 */

import { handleTyped, applyTypedReply, type ChatReply } from "./chat";
import { wordChatCards } from "./ai-wording";
import { SEAT_LABELS } from "./permissions";
import type { AiDeps, AiMode } from "./ai";
import * as memory from "./memory";

export interface ChatTurnInput {
  seat?: string;
  text?: unknown;
  job?: string;
}

export type ChatTurnResult =
  | { status: 200; body: { ok: true; storedCount: number } & ChatReply }
  | { status: 400 | 404; body: { ok: false; message: string } };

export async function chatTurn(input: ChatTurnInput, mode: AiMode, deps?: AiDeps): Promise<ChatTurnResult> {
  const { seat, text, job } = input;
  if (!seat || typeof text !== "string") {
    return { status: 400, body: { ok: false, message: "A message needs a seat and some text." } };
  }
  // The same seats /api/state knows (S2). An unknown seat is never answered or stored.
  if (!(seat in SEAT_LABELS)) {
    return { status: 404, body: { ok: false, message: `There is no seat called "${seat}".` } };
  }

  const state = memory.read();
  const reply = handleTyped(state, seat, text, job);
  const cards = await wordChatCards(reply.cards, { state, seat, jobId: job, mode }, deps);
  const worded = { ...reply, cards };
  const aiCalls = cards.reduce((sum, card) => sum + (card.aiCalls ?? 0), 0);

  const after = memory.update((s) => {
    applyTypedReply(s, seat, job, worded);
    s.aiCalls = (s.aiCalls ?? 0) + aiCalls;
  });

  // How many messages this seat has stored, this one included. The chat shows
  // its local copy only until a poll holds that many, so a typed message and
  // its reply are never on screen twice.
  const storedCount = after.messages.filter((m) => m.seat === seat).length;

  return { status: 200, body: { ok: true, storedCount, ...worded } };
}
