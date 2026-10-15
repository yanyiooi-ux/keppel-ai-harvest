# The demo video

Home, /how and /flow show a "Watch the 6-minute video" player. It plays one file:

    web/public/media/pill-desk-video.mp4

The video is not in git. It is about 100 MB, GitHub refuses files over 100 MB, and it is re-made after each
change. `.gitignore` keeps every `.mp4` out.

## How to put it there

1. Get the latest render of the Pill Desk video (an H.264 `.mp4`).
2. Copy it into this folder and name it `pill-desk-video.mp4`.
3. Build and start the app again (`npx next build`, then `npx next start`). A built app serves only the files
   that were in `public/` when it was built. `npm run dev` picks the file up at once. The pages check for the
   file each time they load.

When the file is missing, the pages show one plain line instead of a broken player:
"The video is not on this copy of the demo."

## The poster

`pill-desk-poster.jpg` is the picture the player shows before you press play: one frame from the video
(about 8 seconds in, all five seats on screen), 1280 px wide. It is small, so it is committed. To take a new one
from a new video:

    ffmpeg -i pill-desk-video.mp4 -vf "select='eq(n\,240)',scale=1280:-2" -frames:v 1 -q:v 5 pill-desk-poster.jpg
