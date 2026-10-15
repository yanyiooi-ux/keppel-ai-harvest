import Link from "next/link";
import { SEAT_IDS, SEAT_LABELS } from "../lib/permissions";
import { openingLineFor } from "../lib/seat-opening";
import { PILL_MEANS, plainOpening, seatLabelWords } from "../lib/plain-words";
import { BuildingBCard } from "./components/BuildingBCard";
import { STORY_LINK_WORDS } from "../lib/story";
import { FLOW_LINK_WORDS } from "../lib/flow-words";
import { videoOnDisk } from "../lib/video";
import { VideoPlayer } from "./components/VideoPlayer";

export const dynamic = "force-dynamic";

/**
 * Pick your seat (S21): the 5 seats, the Building B card and the way in for a
 * judge. Every seat is role-played and every name here is made up, which the
 * page says out loud rather than in a footnote.
 *
 * Plain words first (D1 review): the first line says what Pill Desk does, the
 * way in for a judge sits right under it, and "pill" is explained before a
 * seat uses the word.
 */
export default function Home() {
  return (
    <main className="page">
      <h1>Pick your seat</h1>
      <p className="lede home-what">
        Pill Desk helps building teams fix the real cause of too-cold and too-hot calls that keep coming back.
      </p>
      <p className="how-link how-link-top">
        New here? <Link href="/how">Start with how it works, for judges</Link>
      </p>
      <p className="how-link story-link">
        Short on time? <Link href="/demo">{STORY_LINK_WORDS}</Link>. The real app plays the whole demo by itself.
      </p>
      <p className="how-link flow-link">
        Want the whole map? <Link href="/flow">{FLOW_LINK_WORDS}</Link>.
      </p>

      <VideoPlayer available={videoOnDisk()} />

      <p className="lede">
        Five people share one rule book, each in their own chat with Pip. Pick the seat you want to sit in. {PILL_MEANS}{" "}
        Every building, tenant, ticket and signature here is made up for the demo, and every seat is role-played.
      </p>

      <ul className="seat-list">
        {SEAT_IDS.map((seat) => {
          const opening = openingLineFor(seat);
          return (
            <li key={seat}>
              <Link href={`/seat/${seat}`}>
                <span className="seat-name">{seatLabelWords(SEAT_LABELS[seat])}</span>
                <span className="seat-line">{plainOpening(opening.text)}</span>
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
