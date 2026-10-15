"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VIDEO_LINE, VIDEO_MISSING, VIDEO_POSTER, VIDEO_SRC, VIDEO_TITLE } from "../../lib/video-words";

/** How long the player waits before it asks the server a second time, after a request that got no answer. */
export const VIDEO_RETRY_MS = 1000;

/**
 * D4: "Watch the 6-minute video" on home. A plain browser player (controls,
 * only the length loads until Play, a poster frame first). The page checks the
 * file on disk (lib/video.ts) and passes `available`; when the file is missing
 * it shows one plain line, never a broken player.
 *
 * A built app serves only the files that were in public/ when it started, so
 * the disk can say yes while the file still answers 404 (D4 review). The
 * browser's own signals are only hints: networkState is NETWORK_NO_SOURCE for
 * a moment at the start of resource selection, a <source> error can fire for
 * reasons other than a missing file, and a file lost after it loaded reports
 * its error on the <video> itself, not on <source>. On any hint the player
 * asks the server (HEAD, no cache) and keeps the player while it waits.
 *
 * Only an answer from the server that is not ok replaces the player with the
 * plain line. A request with no answer is not proof: Stop, Esc or a page change
 * cancels it with the same error as a network failure, and a full-page
 * navigation does not unmount React. So the player stays and asks once more
 * after VIDEO_RETRY_MS; if that also gets no answer, the player stays.
 */
export function VideoPlayer({ available }: { available: boolean }) {
  const [missing, setMissing] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const asking = useRef(false);
  const mounted = useRef(false);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);

  const askServer = useCallback(() => {
    if (asking.current) return;
    asking.current = true;
    const ask = (retriesLeft: number) => {
      // Promise.resolve().then turns a synchronous throw from fetch into a request with no answer.
      Promise.resolve()
        .then(() => fetch(VIDEO_SRC, { method: "HEAD", cache: "no-store" }))
        .then(
          (res) => {
            asking.current = false;
            if (!res.ok && mounted.current) setMissing(true);
          },
          () => {
            if (retriesLeft > 0 && mounted.current) {
              retry.current = setTimeout(() => {
                retry.current = null;
                ask(retriesLeft - 1);
              }, VIDEO_RETRY_MS);
            } else {
              asking.current = false;
            }
          },
        );
    };
    ask(1);
  }, []);

  useEffect(() => {
    mounted.current = true;
    // 3 is NETWORK_NO_SOURCE: a hint only, confirmed by the server before the line shows.
    if (available && video.current && video.current.networkState === 3) askServer();
    return () => {
      mounted.current = false;
      // A pending second ask dies with the mount; a later mount may ask again.
      if (retry.current !== null) {
        clearTimeout(retry.current);
        retry.current = null;
        asking.current = false;
      }
    };
  }, [available, askServer]);

  const show = available && !missing;
  return (
    <section id="video" className="video-box" aria-label={VIDEO_TITLE}>
      <h2 className="video-title">{VIDEO_TITLE}</h2>
      <p className="video-line">{VIDEO_LINE}</p>
      {show ? (
        <video
          ref={video}
          className="video"
          controls
          preload="metadata"
          poster={VIDEO_POSTER}
          playsInline
          onError={askServer}
        >
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
