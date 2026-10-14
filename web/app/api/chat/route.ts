import { NextResponse } from "next/server";
import { handleTyped } from "../../../lib/chat";
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

  memory.update((state) => {
    state.messages.push({
      seat: body.seat!,
      from: "person",
      text: reply.storedText,
      at: state.demoNow,
    });
    state.messages.push({
      seat: body.seat!,
      from: "pip",
      text: reply.cards.map((c) => c.body ?? c.title ?? "").join(" "),
      at: state.demoNow,
      cards: reply.cards,
    });
    for (const alert of reply.alerts) {
      state.notices.push({
        seat: alert.seat,
        kind: "alert",
        text: alert.text,
        at: state.demoNow,
        jobId: body.job,
      });
    }
  });

  return NextResponse.json({ ok: true, ...reply });
}
