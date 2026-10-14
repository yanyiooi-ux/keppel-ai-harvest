import { NextResponse } from "next/server";
import { handleTyped, applyTypedReply } from "../../../lib/chat";
import * as memory from "../../../lib/memory";

export const dynamic = "force-dynamic";

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

  const reply = handleTyped(memory.read(), body.seat, body.text, body.job);

  memory.update((state) => applyTypedReply(state, body.seat!, body.job, reply));

  return NextResponse.json({ ok: true, ...reply });
}
