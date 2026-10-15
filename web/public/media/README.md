# The demo video

The home page shows a "Watch the 6-minute video" player near the top (only home: /how and /flow have none).
It plays one file:

    web/public/media/pill-desk-video.mp4

The video is not in git. It is about 77 MB and it is re-made after each change, so `.gitignore` keeps every
`.mp4` out.

## How to put it there

1. Get the latest render of the Pill Desk video (an H.264 `.mp4`).
2. Copy it into this folder and name it `pill-desk-video.mp4`.
3. Stop the app, then build and start it again (`npx next build`, then `npx next start`). A running app serves
   only the files that were in `public/` when it started. `npm run dev` picks the file up at once. The pages
   check for the file each time they load.

When the file is missing, the pages show one plain line instead of a broken player:
"The video is not on this copy of the demo." If the file is on disk but the running app cannot serve it yet
(copied in after the app started), the player turns into the same line by itself.

## The poster

`pill-desk-poster.jpg` is the picture the player shows before you press play: one frame from the video
(the title card, about 17 seconds in: Pip, "Pill Desk" and "Building know-how, kept and shared"), 1280 px
wide. It shows no seat names, so it stays right when a seat is renamed. It is small, so it is committed. To
take a new one from a new video:

    ffmpeg -ss 17.5 -i pill-desk-video.mp4 -vf "scale=1280:-2" -frames:v 1 -q:v 5 pill-desk-poster.jpg
