import { notFound } from "next/navigation";
import { SeatChat } from "../../components/chat/SeatChat";
import { SEAT_LABELS } from "../../../lib/permissions";
import type { SeatId } from "../../../lib/permissions";
import { seatView } from "../../../lib/seat-view";
import { openingLineFor } from "../../../lib/seat-opening";
import * as memory from "../../../lib/memory";
import { currentAiMode } from "../../../lib/ai-mode-cookie";

export const dynamic = "force-dynamic";

/**
 * One seat on the one shared memory (S21). Each seat opens with its own line
 * and chips; C7a to C9 fill in the work each one does.
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

  const seat = name as SeatId;
  const aiMode = await currentAiMode();

  return (
    <SeatChat
      seat={seat}
      initial={seatView(memory.read(), seat, aiMode)}
      opening={openingLineFor(seat)}
      jobId={seat === "aom-tower-a" ? undefined : "2318"}
    />
  );
}
