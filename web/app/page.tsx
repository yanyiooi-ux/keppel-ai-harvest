import Link from "next/link";
import { SEAT_IDS, SEAT_LABELS } from "../lib/permissions";

export const dynamic = "force-dynamic";

/**
 * A plain list until C5b builds "pick your seat" with the Building B card.
 */
export default function Home() {
  return (
    <main className="page">
      <h1>Pill Desk</h1>
      <p>
        Five seats around one brain. Every name, building, tenant and ticket here is
        made up for the demo, and every seat is role-played.
      </p>
      <ul className="seat-list">
        {SEAT_IDS.map((seat) => (
          <li key={seat}>
            <Link href={`/seat/${seat}`}>{SEAT_LABELS[seat]}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
