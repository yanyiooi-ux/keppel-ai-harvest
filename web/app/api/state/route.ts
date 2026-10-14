import { NextResponse } from "next/server";
import * as memory from "../../../lib/memory";
import { CHIPS_BY_SEAT } from "../../../lib/chat";
import { SEAT_LABELS, PIP_NEVER } from "../../../lib/permissions";
import type { SeatId } from "../../../lib/permissions";

export const dynamic = "force-dynamic";

/**
 * One seat's view of the shared memory. Every seat sees every job in this
 * demo; the seat only changes which notices and chips come back (S2).
 */
export async function GET(request: Request) {
  const seat = new URL(request.url).searchParams.get("seat") ?? "";
  if (!(seat in SEAT_LABELS)) {
    return NextResponse.json(
      { ok: false, message: `There is no seat called "${seat}".` },
      { status: 404 }
    );
  }

  const state = memory.read();

  return NextResponse.json({
    ok: true,
    seat,
    label: SEAT_LABELS[seat as SeatId],
    pipNever: PIP_NEVER[seat as SeatId],
    chips: CHIPS_BY_SEAT[seat] ?? [],
    now: memory.now(state).toISOString(),
    demoNow: state.demoNow,
    liveVersionByBuilding: state.liveVersionByBuilding,
    a1Line: state.a1Line,
    jobs: state.jobs,
    openRedStops: state.openRedStops.filter((s) => s.clearedAt === null),
    messages: state.messages.filter((m) => m.seat === seat),
    notices: state.notices.filter((n) => n.seat === seat),
  });
}
