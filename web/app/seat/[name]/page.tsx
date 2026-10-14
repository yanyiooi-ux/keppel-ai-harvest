import { notFound } from "next/navigation";
import { SeatChat } from "../../components/chat/SeatChat";
import { SEAT_LABELS } from "../../../lib/permissions";
import { seatView } from "../../../lib/seat-view";
import * as memory from "../../../lib/memory";

export const dynamic = "force-dynamic";

/**
 * The seat shell. C5b gives it the job list, the Building B card and the real
 * opening lines; for now it is the chat on the one shared memory, so the old
 * routes have somewhere real to redirect to.
 *
 * The first state is rendered here on the server, so the notices and chips are
 * on screen before any JavaScript runs.
 */
export default async function SeatPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  if (!(name in SEAT_LABELS)) notFound();

  const initial = seatView(memory.read(), name);

  return (
    <SeatChat
      seat={name}
      initial={initial}
      jobId={name === "aom-tower-a" ? undefined : "2318"}
    />
  );
}
