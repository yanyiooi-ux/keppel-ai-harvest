import { NextResponse } from "next/server";
import { handleTyped, applyTypedReply } from "../../../lib/chat";
import { wordChatCards } from "../../../lib/ai-wording";
import { currentAiMode } from "../../../lib/ai-mode-cookie";
import * as memory from "../../../lib/memory";

export const dynamic = "force-dynamic";

/**
 * A typed message (S19). Code answers it first; then the AI may word a card's
 * code reason (S15), outside memory.update, never inside it (S20). Red cards
 * never reach the AI.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    seat?: string;
    text?: string;
    job?: string;
  };

  if (!body.seat || typeof body.text !== "string") {
    return NextResponse.json(
      { ok: false, message: "A message needs a seat and some text." },
      { status: 400 }
    );
  }

  const state = memory.read();
  const reply = handleTyped(state, body.seat, body.text, body.job);
  const cards = await wordChatCards(reply.cards, {
    state,
    seat: body.seat,
    jobId: body.job,
    mode: await currentAiMode(),
  });
  const worded = { ...reply, cards };
  const aiCalls = cards.reduce((sum, card) => sum + (card.aiCalls ?? 0), 0);

  memory.update((s) => {
    applyTypedReply(s, body.seat!, body.job, worded);
    s.aiCalls = (s.aiCalls ?? 0) + aiCalls;
  });

  return NextResponse.json({ ok: true, ...worded });
}
