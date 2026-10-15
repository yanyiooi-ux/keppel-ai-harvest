import { VIDEO_LINE, VIDEO_MISSING, VIDEO_POSTER, VIDEO_SRC, VIDEO_TITLE } from "../../lib/video-words";

/**
 * D4: "Watch the 6-minute video" on home, /how and /flow. A plain browser
 * player (controls, only the length loads until Play, a poster frame first).
 * The page checks the file on disk (lib/video.ts) and passes `available`;
 * when the file is missing it shows one plain line, never a broken player.
 */
export function VideoPlayer({ available }: { available: boolean }) {
  return (
    <section id="video" className="video-box" aria-label={VIDEO_TITLE}>
      <h2 className="video-title">{VIDEO_TITLE}</h2>
      <p className="video-line">{VIDEO_LINE}</p>
      {available ? (
        <video className="video" controls preload="metadata" poster={VIDEO_POSTER} playsInline>
          <source src={VIDEO_SRC} type="video/mp4" />
          {VIDEO_MISSING}
        </video>
      ) : (
        <p className="video-missing" data-testid="video-missing">
          {VIDEO_MISSING}
        </p>
      )}
    </section>
  );
}
