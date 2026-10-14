import { NextResponse } from "next/server";
import * as memory from "../../../lib/memory";
import { seatView } from "../../../lib/seat-view";
import { SEAT_LABELS } from "../../../lib/permissions";
import { currentAiMode } from "../../../lib/ai-mode-cookie";

export const dynamic = "force-dynamic";

/**
 * One seat's view of the shared memory. Every seat sees every job in this
 * demo; the seat only changes which notices and chips come back (S2).
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const seat = params.get("seat") ?? "";
  // The technician's Show job (C7b): which of its open jobs is on the desk. A view only.
  const show = params.get("show") ?? undefined;
  if (!(seat in SEAT_LABELS)) {
    return NextResponse.json(
      { ok: false, message: `There is no seat called "${seat}".` },
      { status: 404 }
    );
  }

  const state = memory.read();
  const aiMode = await currentAiMode();

  return NextResponse.json({
    ok: true,
    ...seatView(state, seat, aiMode, new Date(), show),
    aiMode,
    now: memory.now(state).toISOString(),
    demoNow: state.demoNow,
    liveVersionByBuilding: state.liveVersionByBuilding,
    a1Line: state.a1Line,
    jobs: state.jobs,
    openRedStops: state.openRedStops.filter((s) => s.clearedAt === null),
  });
}
