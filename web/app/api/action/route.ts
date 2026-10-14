import { NextResponse } from "next/server";
import { runAction } from "../../../lib/actions";

export const dynamic = "force-dynamic";

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

  const result = runAction({
    seat: body.seat,
    action: body.action,
    jobId: body.job,
    payload: body.payload,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 403 });
}
