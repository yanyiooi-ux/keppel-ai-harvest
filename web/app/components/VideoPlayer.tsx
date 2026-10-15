"use client";

import { useEffect, useRef, useState } from "react";
import { VIDEO_LINE, VIDEO_MISSING, VIDEO_POSTER, VIDEO_SRC, VIDEO_TITLE } from "../../lib/video-words";

/**
 * D4: "Watch the 6-minute video" on home, /how and /flow. A plain browser
 * player (controls, only the length loads until Play, a poster frame first).
 * The page checks the file on disk (lib/video.ts) and passes `available`;
 * when the file is missing it shows one plain line, never a broken player.
 *
 * A built app serves only the files that were in public/ when it started, so
 * the disk can say yes while the file still answers 404 (D4 review). When the
 * browser cannot load the file, the player turns into the same plain line:
 * at once if it failed before the page woke up, or on the source's error.
 */
export function VideoPlayer({ available }: { available: boolean }) {
  const [failed, setFailed] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // NETWORK_NO_SOURCE: every source failed, before React could hear the error.
    if (video.current && video.current.networkState === 3) setFailed(true);
  }, []);

  const show = available && !failed;
  return (
    <section id="video" className="video-box" aria-label={VIDEO_TITLE}>
      <h2 className="video-title">{VIDEO_TITLE}</h2>
      <p className="video-line">{VIDEO_LINE}</p>
      {show ? (
        <video ref={video} className="video" controls preload="metadata" poster={VIDEO_POSTER} playsInline>
          <source src={VIDEO_SRC} type="video/mp4" onError={() => setFailed(true)} />
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
