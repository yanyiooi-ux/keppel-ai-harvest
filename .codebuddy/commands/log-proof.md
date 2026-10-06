---
description: Add this chat's work to proof/BUILD-LOG.md (hackathon proof of CodeBuddy use). Run in Craft mode.
argument-hint: [your first name, and anything to stress]
---

This command edits `proof/BUILD-LOG.md`, so it must run in Craft mode. If you are in Ask or Plan mode, say so and
stop.

Add ONE new row at the bottom of the table in `proof/BUILD-LOG.md` for the work done in this conversation. Keep the
existing rows and the header exactly as they are. The columns, in order:

1. **Date**: today, as YYYY-MM-DD.
2. **Who**: the teammate's first name from the note below. If there is none, ask.
3. **Tool and mode**: CodeBuddy IDE or CLI, and the mode used (Ask, Craft or Plan). Name any sub-agent, skill or
   command used.
4. **What we asked**: one sentence.
5. **What the tool did**: one or two sentences, plain English.
6. **Files changed**: paths, or "none".
7. **Proof saved**: file names in `proof/screenshots/`, or "none yet".

Rules: no secrets, under 40 words per cell, be honest about what was and was not tested.

After writing the row, if "Proof saved" is "none yet", remind me to take a screenshot now (Windows:
`powershell -ExecutionPolicy Bypass -File scripts/snap.ps1 <label>`; Mac: Cmd+Shift+3), check it, and move it
from `proof/_inbox/` to `proof/screenshots/`.

Note from me: $ARGUMENTS
