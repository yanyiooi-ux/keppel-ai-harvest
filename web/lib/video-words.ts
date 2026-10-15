/**
 * D4: the demo video's words and paths, safe in the browser. The file itself
 * is never committed (web/public/media/README.md); lib/video.ts checks it is
 * on this copy of the demo.
 */

export const VIDEO_FILE = "pill-desk-video.mp4";
export const VIDEO_SRC = `/media/${VIDEO_FILE}`;
export const VIDEO_POSTER = "/media/pill-desk-poster.jpg";

/** The render is 6 minutes 13 seconds long (ffprobe: 373.5 s). */
export const VIDEO_TITLE = "Watch the 6-minute video";
export const VIDEO_LINE = "The whole demo in one take, with captions: the problem, the five seats, and the fix that reaches every building.";

/** Shown in place of the player when the file is not there, so nothing looks broken. */
export const VIDEO_MISSING = "The video is not on this copy of the demo.";
