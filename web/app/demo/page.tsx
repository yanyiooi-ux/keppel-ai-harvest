import { StoryPlayer } from "../components/story/StoryPlayer";
import { currentAiMode } from "../../lib/ai-mode-cookie";
import { openingLineFor } from "../../lib/seat-opening";
import { SEAT_IDS } from "../../lib/permissions";
import { STORY, storyStepFromQuery } from "../../lib/story";

export const dynamic = "force-dynamic";

export const metadata = { title: "Story mode · Pill Desk" };

/**
 * Story mode (D2): the real app plays the demo by itself, one seat at a time,
 * with a short plain caption for each step. The player presses through the
 * same routes every seat uses; this page only reads where the AI switch
 * stands, each seat's opening line, and "?step=" (jump to a step) and
 * "?ai=switched" (the switch was moved once already).
 */
export default async function Demo({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const aiMode = await currentAiMode();
  const openings = Object.fromEntries(SEAT_IDS.map((seat) => [seat, openingLineFor(seat)]));

  return (
    <main className="story">
      <header className="story-head">
        <p className="how-kicker">Pill Desk · story mode</p>
        <h1>{`One too-cold call, fixed for good, in ${STORY.length} steps`}</h1>
      </header>
      <StoryPlayer
        aiMode={aiMode}
        openings={openings}
        startStep={storyStepFromQuery(query.step)}
        aiSwitchTried={query.ai === "switched"}
      />
    </main>
  );
}
