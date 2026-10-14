/**
 * C9 review fixes (two reviewers, checked on disk before any change).
 *
 * - Decide charge decides only a request routed to the seat that presses it,
 *   the same requests the AOM desk lists. A4 is "AOM Tower A only" (S17), and
 *   a request HQ's Approve opens on a Building B job goes to the Building B
 *   card (permissions.ts alertSeatFor), so the Tower A AOM never decides it.
 * - Two places where the spec reads two ways are questions for YY
 *   (QUESTIONS.md questions 11 and 12), each with its it.todo below.
 *
 * Every press goes through the real gate and body on the per-worker memory
 * file. No model client: nothing here calls the AI.
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as memory from "../lib/memory";
import { resetDemo, runAction } from "../lib/actions";
import { aomDesk } from "../lib/aom-desk";
import { alertSeatFor } from "../lib/permissions";
import type { ChargeRequest } from "../lib/self-check-flow";

const REAL_NOW = new Date("2026-10-06T10:00:00+08:00");
const REASON = "Fit-out work is the tenant's own";

beforeEach(() => {
  resetDemo(REAL_NOW);
});

/**
 * An open A4 request on Building B's 2401, in the shape HQ's Approve writes
 * (hq-flow.ts), routed where alertSeatFor sends the AOM's items for Building B.
 */
function openBuildingBRequest(): ChargeRequest {
  const request: ChargeRequest = {
    id: "A4-77",
    kind: "A4",
    status: "open",
    seat: alertSeatFor("aom", "building-b"),
    jobId: "2401",
    tenant: "Meridian Partners",
    building: "building-b",
    floor: 12,
    text: "Tenant will hear: \"Probe.\" This is work on the tenant's fit-out (TS-CC-11). Who pays?",
    openedAt: "2026-10-06T10:00:00+08:00",
  };
  memory.update((s) => {
    s.requests.push(request);
  });
  return request;
}

describe("C9 review: Decide charge decides only a request routed to the pressing seat", () => {
  it("the Building B request is routed to the Building B card, and the AOM desk does not list it", () => {
    const request = openBuildingBRequest();
    expect(request.seat).toBe("building-b-card");
    expect(aomDesk(memory.read(), REAL_NOW).charges.map((c) => c.id)).not.toContain(request.id);
  });

  it("the Tower A AOM pressing it by its id is refused, and nothing changes", () => {
    const request = openBuildingBRequest();
    const before = JSON.stringify(memory.read());
    const r = runAction(
      {
        seat: "aom-tower-a",
        action: "decide-charge",
        payload: { requestId: request.id, choice: "goodwill", reason: REASON },
      },
      REAL_NOW
    );
    expect(r.ok).toBe(false);
    expect(r.message).toBe(`There is no open charge request called "${request.id}" (A4).`);
    expect(JSON.stringify(memory.read())).toBe(before);
  });

  it("the Tower A AOM pressing it by its job is refused, and nothing changes", () => {
    const request = openBuildingBRequest();
    const before = JSON.stringify(memory.read());
    const r = runAction(
      {
        seat: "aom-tower-a",
        action: "decide-charge",
        jobId: request.jobId,
        payload: { choice: "landlord-pays", reason: REASON },
      },
      REAL_NOW
    );
    expect(r.ok).toBe(false);
    expect(r.message).toBe(`There is no open charge request on job ${request.jobId} (A4).`);
    expect(JSON.stringify(memory.read())).toBe(before);
  });
});

describe("C9 review: questions for YY", () => {
  it.todo(
    'QUESTION C9 review: S17 says "Tenant pays (... and a reason of 3 words or more); Landlord pays (reason); Goodwill, no charge (reason, the AOM\'s own decision)", and T-C9 says only "Goodwill needs a reason". Built for now: every choice needs a reason of 3 words or more. Should Landlord pays and Goodwill take a shorter reason?'
  );

  it.todo(
    'QUESTION C9 review: S18 says "Visits: one per call", and S10 outcomes 2 and 3 (blinds up, after hours) say "No visit". Built for now: the meter counts every call at the spot, a self-check with no visit too, as one visit (an after-hours report on Level 23 moves Before from 5 visits, S$600 to 6 visits, S$720). Should a no-visit self-check count as a call without a visit, or not count at all?'
  );
});
