---
name: proof-and-honesty
description: Keep the hackathon's proof of CodeBuddy use up to date and report work honestly
alwaysApply: true
enabled: true
---

# Proof and honesty

The entry is not scored without proof that we built it with CodeBuddy (at least 3 screenshots or a screen
recording of CodeBuddy chats). Help us collect it as we go.

- When a chat produces meaningful work (a plan, a feature, a fix, a decision), remind us to:
  1. add a row to `proof/BUILD-LOG.md` (the `/log-proof` command does this; it needs Craft mode),
  2. take a screenshot with the clock visible. Windows:
     `powershell -ExecutionPolicy Bypass -File scripts/snap.ps1 <label>`. Mac: Cmd+Shift+3.
     Both land in `proof/_inbox/`; a person checks the image before moving it to `proof/screenshots/`,
  3. optionally export the chat from History into `proof/chat-exports/` (kept local, never committed).
- Never say something works unless it was run after the last change and the result was seen. Say "not tested" when
  it was not.
- Label anything mocked or faked as mocked. Label facts we have not checked at the source as unverified.
