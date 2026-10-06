# The look

**Current look: B. Utilitarian**

(To switch, change the line above to `A. Bento Box` or `C. Neo-Brutalism` before prompt P2, or ask CodeBuddy to
"switch the look to A" later: the tokens live in `web/app/globals.css`.)

Open `style-samples.html` in a browser and click the tabs to see all three on the same screen: the AOM's
"Needs your decision" page and the technician's phone checklist.

## Rules for every look
- Green, amber and red always mean the same thing: green the technician just does it, amber needs a named yes, red
  means stop and call someone. Status is never shown by colour alone: always a word ("Amber · needs your yes") and a
  mark.
- Buttons and tap targets at least 44 px tall on the phone. Text contrast at least 4.5 to 1. Visible keyboard focus.
- The technician screen is designed at 390 px wide first. The AOM screen is designed at 1440 px wide first. Neither
  scrolls sideways.
- Every colour, font, border, radius, shadow and spacing value is a CSS variable. No hardcoded colours in components.
- Rule ids, pill versions and signatures are always visible where advice is shown.

## B. Utilitarian (current)
- **Feel:** a control room or an engineering manual. Rule ids, versions and signatures are the visual heroes.
- **Colours:** ground `#E9E9E4`, panels `#F7F7F4`, ink `#111111`, muted `#4A4A4A`, lines `#CFCFC7`, borders
  `#A9A9A0`, top bar `#111111` with `#F7F7F4` text.
- **Status fills:** green `#2E7D32` with white text, amber `#E8A317` with black text, red `#B3261E` with white text,
  info and updates `#111111` with `#F7F7F4` text.
- **Type:** IBM Plex Sans for text (15 px body, headings 600). IBM Plex Mono, uppercase, letter-spacing 0.06em, for
  ids, versions, labels, buttons and section numbers ("01 SAFETY").
- **Shape:** square corners everywhere, 1 px borders and hairline rules, no shadows, 12 px gaps, 16 px card padding.
  Card status shows as a full-width coloured band across the top of the card.

## A. Bento Box
- **Feel:** a modern dashboard. Calm and familiar.
- **Colours:** ground `#F4F5F7`, panels `#FFFFFF`, ink `#1A1D23`, muted `#5B6270`, lines `#E6E8EC`, accent blue
  `#2F6FED` (white text).
- **Status:** tinted chips. Green `#1F9D55` on `#E7F6EE`, amber `#8A4B05` on `#FEF3E2`, red `#9B1C1C` on `#FDECEC`,
  info `#1D4BB0` on `#EAF0FE`.
- **Type:** Inter, body 15 px, headings 650.
- **Shape:** 16 px card corners, 10 px button corners, pill-shaped chips, no borders, soft shadow
  `0 1px 2px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)`, 16 px gaps, 20 px padding.

## C. Neo-Brutalism
- **Feel:** bold and memorable on stage.
- **Colours:** ground cream `#FFF6E0`, panels `#FFFFFF`, ink `#000000`, top bar `#FFD23F`.
- **Status fills (black text):** green `#7BD389`, amber `#FFD23F`, red `#FF6B6B`, info `#A0C4FF`. Whole cards take
  their status fill.
- **Type:** Space Grotesk, bold headings, large sizes (page title 32 px).
- **Shape:** square corners, 3 px pure black borders, hard shadow `5px 5px 0 #000` on cards and `3px 3px 0 #000` on
  buttons, 22 px gaps. Borders are always black, never a brand colour.
