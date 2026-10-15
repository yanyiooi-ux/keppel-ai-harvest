import { existsSync } from "fs";
import { join } from "path";
import { VIDEO_FILE } from "./video-words";

/**
 * True when the demo video is on this copy of the demo (web/public/media).
 * Read on every request, so the page never shows a player for a file that is
 * not there.
 */
export function videoOnDisk(root: string = process.cwd()): boolean {
  return existsSync(join(root, "public", "media", VIDEO_FILE));
}
