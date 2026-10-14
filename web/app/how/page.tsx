import { HowStory } from "../components/how/HowStory";
import { HowLive } from "../components/how/HowLive";
import { howView, liveSeats } from "../../lib/how";
import { buildingBView } from "../../lib/hq-desk";
import * as memory from "../../lib/memory";
import { currentAiMode } from "../../lib/ai-mode-cookie";

export const dynamic = "force-dynamic";

export const metadata = { title: "How Pill Desk works" };

/**
 * The judges' page (S22, C10a): why, what and how in one scroll, then the 5
 * real chats side by side on the one memory, the Building B card and a bar
 * with the real Reset and the demo steps. Everything is read at request time
 * from the memory, the data and the pill; the chats then poll like their own
 * seat pages.
 */
export default async function How() {
  const state = memory.read();
  const aiMode = await currentAiMode();
  const view = howView(state);

  return (
    <main className="how">
      <HowStory view={view} />
      <HowLive
        seats={liveSeats(state, aiMode)}
        buildingB={buildingBView(state, new Date(), aiMode)}
        steps={view.demoSteps}
      />
      <footer className="how-close">
        <p className="close-line">{view.closeLine}</p>
      </footer>
    </main>
  );
}
