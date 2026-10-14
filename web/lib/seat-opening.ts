/**
 * Each seat's opening line (C5b).
 *
 * Plain code, 0 AI. It says what this seat is for and what Pip will not do
 * here, so the limit is on screen before anyone asks. The "never" half is read
 * from permissions.ts, which is the same table the server checks, so the line
 * can never promise something the gate would refuse.
 */

import { PIP_NEVER } from "./permissions";
import type { SeatId } from "./permissions";

const WHAT_THIS_SEAT_IS_FOR: Record<SeatId, string> = {
  tenant:
    "Tell me what is wrong with your space. I will ask a few short questions first, so a technician arrives knowing what you already checked.",
  technician:
    "Here are the jobs for Tower A. Open one and I will hand you the filled checklist, what this spot has called about before, and the leads worth checking first.",
  "senior-manager":
    "Here is what has come up to you: the escalated jobs with everything already attached, the speak-first and low-confidence notices, and any new solution waiting to be written up.",
  hq: "Here are the solutions sent up for approval, the live version in each building, and any request for outside help or money.",
  "aom-tower-a":
    "Here is Tower A: what the repeat calls are costing, the safety alerts, and any charge waiting on your decision.",
};

export function openingLineFor(seat: SeatId): { text: string; never: string } {
  return {
    text: WHAT_THIS_SEAT_IS_FOR[seat],
    never: `Pip never ${PIP_NEVER[seat]}.`,
  };
}
