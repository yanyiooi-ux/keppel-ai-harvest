import Link from "next/link";
import { SEAT_IDS, SEAT_LABELS, PIP_NEVER } from "../../lib/permissions";
import { openingLineFor } from "../../lib/seat-opening";
import { BuildingBCard } from "../components/BuildingBCard";
import * as memory from "../../lib/memory";

export const dynamic = "force-dynamic";

/**
 * The judges' way in. C10a builds the full version with the beats and the
 * links between the chats; this is the honest short form, so the link from
 * home goes somewhere real.
 */
export default function How() {
  const state = memory.read();

  return (
    <main className="page">
      <h1>How Pill Desk works</h1>

      <p className="lede">
        A building is full of judgement that lives in a few people&apos;s heads. Pill
        Desk writes that judgement down as a pill, a folder of plain files in Git,
        and then makes every seat work from the same copy. When someone finds
        something new, it goes up for approval once and comes back down to every
        building.
      </p>

      <h2>Who sits where</h2>
      <ul className="seat-list">
        {SEAT_IDS.map((seat) => (
          <li key={seat}>
            <Link href={`/seat/${seat}`}>
              <span className="seat-name">{SEAT_LABELS[seat]}</span>
              <span className="seat-line">{openingLineFor(seat).text}</span>
              <span className="never">Pip never {PIP_NEVER[seat]}.</span>
            </Link>
          </li>
        ))}
      </ul>

      <h2>Where a yes is needed</h2>
      <ul className="plain-list">
        <li>
          <b>A1</b> Version 1 of the brain: two senior experts. {state.a1Line}
        </li>
        <li>
          <b>A2</b> A new solution: HQ, and only after its tests pass on that exact
          draft.
        </li>
        <li>
          <b>A3</b> Outside help or money beyond the senior manager: HQ.
        </li>
        <li>
          <b>A4</b> Charging the tenant: the Asset Operations Manager.
        </li>
      </ul>
      <p className="card-mean">
        Nothing else needs a yes. The tenant&apos;s self-check, the technician&apos;s
        checklist and ticks, and applying a fix that is already in the brain all run
        without one. Safety is a stop, not an approval.
      </p>

      <h2>The same brain, somewhere else</h2>
      <BuildingBCard />

      <p className="card-mean">
        There is no login. Seats are role-played, so anyone can open any seat. Every
        building, tenant, ticket and signature is made up for this demo.
      </p>
    </main>
  );
}
