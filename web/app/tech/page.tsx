import { loadPill } from "@/lib/pill";
import { loadTickets, computeRepeatFlag, checkRedStop, getActiveChecklist, canNudge } from "@/lib/rule-engine";
import { TechClient } from "./TechClient";

export const dynamic = "force-dynamic";

export default async function TechPage({
  searchParams,
}: {
  searchParams: Promise<{ ticket?: string }>;
}) {
  const pill = loadPill("ts-cc", "1.0");
  const allTickets = loadTickets();

  const params = await searchParams;
  const ticketId = params.ticket ?? "2318";
  const ticket = allTickets.find((t) => t.id === ticketId) ?? allTickets.find((t) => t.id === "2318")!;

  // Use the ticket's own reported time as "now" so the repeat flag is correct for that ticket
  const demoNow = new Date(ticket.reportedAt);
  // Add 20 minutes so the ticket itself is counted as "just reported"
  demoNow.setMinutes(demoNow.getMinutes() + 20);

  const repeat = computeRepeatFlag(allTickets, ticket, demoNow);
  const redStop = checkRedStop(pill, {});
  const nudgeResult = canNudge(repeat, redStop, {
    hadSetpointChangeInLast30Days: ticket.previousChangesOnFloor,
    changeAmount: 1,
    isAiMakingChange: false,
    pillVersion: pill.version,
  });
  const active = getActiveChecklist(pill, {
    repeatFlag: repeat,
    redStop,
    canNudgeResult: nudgeResult,
  });

  return (
    <TechClient
      ticket={ticket}
      pillVersion={pill.version}
      repeat={repeat}
      redStop={redStop}
      activeSteps={active.steps}
      activeNote={active.note}
      rules={pill.rules}
      nudgeAllowed={nudgeResult.allowed}
      nudgeReason={nudgeResult.reason}
    />
  );
}
