# The look

**Current look: Neon Quest**

(Changed 6 Oct 2026 from B. Utilitarian. The decision is in `docs/decisions/2026-10-06-new-look.md`.)

## Rules for every look
- Green, amber and red always mean the same thing: green the technician just does it, amber needs a named yes, red
  means stop and call someone. Status is never shown by colour alone: always a word ("Amber - needs your yes") and a
  mark.
- Buttons and tap targets at least 44 px tall on the phone. Text contrast at least 4.5 to 1. Visible keyboard focus.
- The technician screen is designed at 390 px wide first. The AOM screen is designed at 1440 px wide first. Neither
  scrolls sideways.
- Every colour, font, border, radius, shadow and spacing value is a CSS variable. No hardcoded colours in components.
- Rule ids, pill versions and signatures are always visible where advice is shown.

## Neon Quest (current)

### Feel
An Apple product mixed with a game map: dark, a skill tree path, a voxel character (Pip) walking the whole flow, and
diagrams so simple a kid gets it. Every screen answers: where am I, where can I go next, how do I get back.

### Colours
- Ground: near-black `#07080C` with a faint grid and a few still stars (no full-screen moving background).
- Path: violet `#8B7CFF` to cyan `#38BDF8`.
- Panels: dark glass `rgba(17, 20, 27, 0.72)`, `backdrop-filter: blur(20px) saturate(180%)`, `1px` border `#232836`
  with a brighter top edge. The active panel gets a soft violet glow.
- Status fills (always with a word, never colour only): green `#22C55E`, amber `#F59E0B`, red `#EF4444`. Tinted
  backgrounds, not full fills, so text stays readable.
- Locked items: `#374151`, dimmed.

### Type
- Sora for headings (700, letter-spacing `-0.02em`, line-height `1.05`).
- Inter for text (400/500/600, letter-spacing `0`, line-height `1.5`, sizes in rem).
- JetBrains Mono for rule ids, versions and labels.

### Shape
- Card corners `16px`, button corners `10px`, pill-shaped chips (`999px`), large radius `24px`.
- Soft shadow `0 2px 8px rgba(0,0,0,.2), 0 8px 32px rgba(0,0,0,.12)`. Active glow `0 0 24px var(--violet-glow)`.
- No hard divider lines under sticky bars. Use a soft fade.

### The character, Pip
- A voxel pill made of small cubes, a blocky capsule with eyes. Built in code with @react-three/fiber and
  @react-three/drei from box shapes. No image files, no model downloads.
- Isometric camera, soft light. Pip hops node to node along the path with a spring.
- Pip changes per step (notebook, hard hat, traffic light, stamp, version badge, splits in two).
- On other screens Pip is a small voxel avatar that reacts (happy, worried, stop pose).
- The 3D scene loads only in the browser (dynamic import, no server render). If WebGL is missing or reduced motion
  is on, a still SVG picture of Pip shows instead.

### The skill tree
- One thick glowing path joining 6 big round nodes. Done = green glow with a tick. Current = soft pulse. Locked =
  dim.
- On a 390px phone the path runs top to bottom and nothing scrolls sideways.

### Apple design rules (followed exactly)
- Every button reacts on press, not on release: scale `0.97` in `100ms`.
- Springs for all movement with framer-motion: bounce `0` and duration `0.4` by default. Bounce `0.2` only after a
  drag or flick.
- Any animation can be interrupted: always animate from where it is now, never block clicks during a transition.
- Things leave the same way they came in. Panels and popovers grow out of the button that opened them.
- Only animate transform and opacity.
- Glass: never light glass on light glass, text on glass slightly bolder, no hard divider lines under sticky bars,
  use a soft fade.
- Dim the background only for things that block, like a confirm. The demo guide does not block, so no dim.
- Big headings: letter-spacing `-0.02em`, line-height `1.05`. Body: letter-spacing `0`, line-height `1.5`, sizes in
  rem.
- Every screen answers: where am I, where can I go next, how do I get back.
- Labels say exactly what they do ("Start demo", not "OK").
- 4 kinds of feedback: status, done, warning, error. Done gets a small happy moment, not confetti everywhere.
- Tap targets at least `44px`.
- `prefers-reduced-motion`: swap moves for short fades. `prefers-reduced-transparency`: solid panels, no blur.
  `prefers-contrast more`: solid panels with clear borders.

## B. Utilitarian (previous)
- Ground `#E9E9E4`, panels `#F7F7F4`, ink `#111111`, IBM Plex Sans/Mono, square corners, no shadows. Replaced 6 Oct
  2026.

## A. Bento Box
- Calm dashboard. Not used.

## C. Neo-Brutalism
- Bold and memorable on stage. Not used.
