# Build log

One row per meaningful session. In CodeBuddy, type `/log-proof` and it adds the row. Newest at the bottom.

| Date | Who | Tool and mode | What we asked | What the tool did | Files changed | Proof saved |
|---|---|---|---|---|---|---|
| 2026-10-05 | YY | Claude Code (not CodeBuddy) | Prepare a planning kit for a fresh repo | Wrote the CodeBuddy brief and rules, the docs, the approved decisions, the look, and the wording of the build prompts YY pastes into CodeBuddy. No product code. | Planning kit | none, setup only |
| 2026-10-06 | YY | CodeBuddy IDE, Craft mode | Set up git and push the repo to GitHub | Ran git init with branch main, set local user.name and user.email, dry-run checked the staged file list (no private/ or .env), and committed 43 files as "chore: start from the planning kit". gh auth was not signed in inside CodeBuddy's shell, so Claude Code pushed the repo from this PC where gh was already authenticated. | none (git config and initial commit only) | none yet |
