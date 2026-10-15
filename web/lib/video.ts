import { existsSync } from "fs";
import { join } from "path";
import { VIDEO_FILE } from "./video-words";

/**
 * True when the demo video is on this copy of the demo (web/public/media).
 * Read on every request. A built app serves only the files that were in
 * public/ when it started, so a file copied in later is on disk but not
 * served yet: the player (components/VideoPlayer.tsx) then turns into the
 * plain line by itself when the browser cannot load the file.
 */
export function videoOnDisk(root: string = process.cwd()): boolean {
  return existsSync(join(root, "public", "media", VIDEO_FILE));
}
