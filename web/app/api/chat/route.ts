import { NextResponse } from "next/server";
import { chatTurn, type ChatTurnInput } from "../../../lib/chat-turn";
import { currentAiMode } from "../../../lib/ai-mode-cookie";

export const dynamic = "force-dynamic";

/**
 * A typed message (S19). Code answers it first; then the AI may word a card's
 * code reason (S15), outside memory.update, never inside it (S20). Red cards
 * never reach the AI. The steps live in lib/chat-turn.ts so tests run them.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as ChatTurnInput;
  const out = await chatTurn(body, await currentAiMode());
  return NextResponse.json(out.body, { status: out.status });
}
