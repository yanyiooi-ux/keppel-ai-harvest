"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VIDEO_LINE, VIDEO_MISSING, VIDEO_POSTER, VIDEO_SRC, VIDEO_TITLE } from "../../lib/video-words";

/**
 * D4: "Watch the 6-minute video" on home, /how and /flow. A plain browser
 * player (controls, only the length loads until Play, a poster frame first).
 * The page checks the file on disk (lib/video.ts) and passes `available`;
 * when the file is missing it shows one plain line, never a broken player.
 *
 * A built app serves only the files that were in public/ when it started, so
 * the disk can say yes while the file still answers 404 (D4 review). The
 * browser's own signals are only hints: networkState is NETWORK_NO_SOURCE for
 * a moment at the start of resource selection, and a <source> error can fire
 * for reasons other than a missing file. On either hint the player asks the
 * server (HEAD, no cache) and keeps the player while it waits; the plain line
 * replaces the player only when the answer is not ok or the request fails.
 */
export function VideoPlayer({ available }: { available: boolean }) {
  const [missing, setMissing] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const asking = useRef(false);
  const mounted = useRef(false);

  const askServer = useCallback(() => {
    if (asking.current) return;
    asking.current = true;
    // Promise.resolve().then turns a synchronous throw from fetch into a "no".
    Promise.resolve()
      .then(() => fetch(VIDEO_SRC, { method: "HEAD", cache: "no-store" }))
      .then(
        (res) => res.ok,
        () => false,
      )
      .then((ok) => {
        asking.current = false;
        if (!ok && mounted.current) setMissing(true);
      });
  }, []);

  useEffect(() => {
    mounted.current = true;
    // 3 is NETWORK_NO_SOURCE: a hint only, confirmed by the server before the line shows.
    if (available && video.current && video.current.networkState === 3) askServer();
    return () => {
      mounted.current = false;
    };
  }, [available, askServer]);

  const show = available && !missing;
  return (
    <section id="video" className="video-box" aria-label={VIDEO_TITLE}>
      <h2 className="video-title">{VIDEO_TITLE}</h2>
      <p className="video-line">{VIDEO_LINE}</p>
      {show ? (
        <video ref={video} className="video" controls preload="metadata" poster={VIDEO_POSTER} playsInline>
          <source src={VIDEO_SRC} type="video/mp4" onError={askServer} />
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
