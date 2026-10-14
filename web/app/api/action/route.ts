import { NextResponse } from "next/server";
import { actionTurn } from "../../../lib/action-turn";
import { currentAiMode } from "../../../lib/ai-mode-cookie";

export const dynamic = "force-dynamic";

/**
 * One button press (S2). The gate and the body live in lib/actions.ts; the
 * self-check's tenant reply is worded first in lib/action-turn.ts, outside the
 * memory update (S20), so tests run the route's real code.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    seat?: string;
    action?: string;
    job?: string;
    payload?: Record<string, unknown>;
  };

  if (!body.seat || !body.action) {
    return NextResponse.json(
      { ok: false, message: "A press needs a seat and an action." },
      { status: 400 }
    );
  }

  const result = await actionTurn(
    {
      seat: body.seat,
      action: body.action,
      jobId: body.job,
      payload: body.payload,
    },
    await currentAiMode()
  );

  return NextResponse.json(result, { status: result.ok ? 200 : 403 });
}
