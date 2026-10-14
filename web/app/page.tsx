import Link from "next/link";
import { SEAT_IDS, SEAT_LABELS } from "../lib/permissions";
import { openingLineFor } from "../lib/seat-opening";
import { BuildingBCard } from "./components/BuildingBCard";

export const dynamic = "force-dynamic";

/**
 * Pick your seat (S21): the 5 seats, the Building B card and the way in for a
 * judge. Every seat is role-played and every name here is made up, which the
 * page says out loud rather than in a footnote.
 */
export default function Home() {
  return (
    <main className="page">
      <h1>Pick your seat</h1>
      <p className="lede">
        Five people around one brain. Pick the seat you want to sit in. Every
        building, tenant, ticket and signature here is made up for the demo, and
        every seat is role-played.
      </p>

      <ul className="seat-list">
        {SEAT_IDS.map((seat) => {
          const opening = openingLineFor(seat);
          return (
            <li key={seat}>
              <Link href={`/seat/${seat}`}>
                <span className="seat-name">{SEAT_LABELS[seat]}</span>
                <span className="seat-line">{opening.text}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <BuildingBCard />

      <p className="how-link">
        <Link href="/how">How this works, for judges</Link>
      </p>
    </main>
  );
}
