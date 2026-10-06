# Proof of CodeBuddy use

**This is a hard gate.** The handbook: the project must be built on CodeBuddy or WorkBuddy, and the submission needs
at least 3 screenshots or a screen recording of our CodeBuddy chats from development. Without proof, the project
is not scored. Aim for 10 or more real development chats, spread across the whole build.

## How to take a screenshot

**Before every screenshot:** this folder will be public, and a screenshot captures everything on that screen. Close
or cover private chats, email, other clients' work and any API key or `.env` file.

- **Windows:** from the repo folder run `powershell -ExecutionPolicy Bypass -File scripts/snap.ps1 plan-mode`
  (the last word is your label). After a 3-second countdown it captures the screen your mouse is on, saves it to
  `proof/_inbox/` and opens it.
- **Mac:** press Cmd+Shift+3 with the menu-bar clock visible, then move the file into `proof/_inbox/`.

Keep the clock visible: CodeBuddy's chat list shows only "Today" or "2d ago", not dates.

Then **check the image**. If it is clean, move it from `proof/_inbox/` to `proof/screenshots/`, named
`YYYY-MM-DD_HHMM_what.png` (snap.ps1 names it for you). `proof/_inbox/` is gitignored, so nothing unchecked is
committed by accident.

## What else to keep

| What | Where | Committed? |
|---|---|---|
| Checked screenshots | `screenshots/` | Yes |
| Build log, one row per meaningful session | `BUILD-LOG.md` (type `/log-proof` in CodeBuddy, Craft mode) | Yes |
| Plans CodeBuddy saved in Plan mode | `../.codebuddy/plans/` | Yes |
| Chat exports (History, then Export) | `chat-exports/` | No, local backup only: an export holds everything the chat saw |
| Demo video or screen recording | Upload (YouTube unlisted or Drive), put the link in `BUILD-LOG.md` | No, too big for git |

## Shots worth getting

1. Plan mode turning a feature request into a plan.
2. Craft mode building that feature, with the changed files visible.
3. The `judge-panel` sub-agent reviewing our work.
4. Debugging: an error, CodeBuddy's diagnosis, the fix.
5. CodeBuddy helping with the problem statement or the solution diagram.
6. Any CodeBuddy MCP, skill or Tencent Cloud integration we use.
7. A weekly screenshot of the credits page.

For the demo video, the handbook asks for a short reflection on how we built with CodeBuddy. This folder is the raw
material for it.
