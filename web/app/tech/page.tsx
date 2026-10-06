import { loadPill } from "@/lib/pill";
import { loadTickets, computeRepeatFlag, checkRedStop, getActiveChecklist } from "@/lib/rule-engine";
import { TechClient } from "./TechClient";

export const dynamic = "force-dynamic";

export default function TechPage() {
  const pill = loadPill("ts-cc", "1.0");
  const allTickets = loadTickets();
  const ticket2318 = allTickets.find((t) => t.id === "2318")!;

  const demoNow = new Date("2026-10-06T09:30:00+08:00");
  const repeat = computeRepeatFlag(allTickets, ticket2318, demoNow);
  const redStop = checkRedStop(pill, {});
  const nudgeCheck = {
    allowed: !repeat.isRepeat && !redStop.isRed,
    reason: repeat.isRepeat
      ? "Repeat flag is on. No nudge."
      : redStop.isRed
      ? "Red stop. No setpoint advice."
      : "First complaint. Nudge allowed.",
    ruleIds: repeat.isRepeat ? ["TS-CC-09"] : ["TS-CC-21"],
  };
  const active = getActiveChecklist(pill, {
    repeatFlag: repeat,
    redStop,
    canNudgeResult: nudgeCheck,
  });

  return (
    <TechClient
      ticket={ticket2318}
      pillVersion={pill.version}
      repeat={repeat}
      redStop={redStop}
      activeSteps={active.steps}
      activeNote={active.note}
      rules={pill.rules}
    />
  );
}
