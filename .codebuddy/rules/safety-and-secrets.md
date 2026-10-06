---
name: safety-and-secrets
description: Keep secrets and private material out of the public repo; ask before destructive actions
alwaysApply: true
enabled: true
---

# Safety and secrets

This repo will be public on GitHub at submission, and git keeps every old version. Treat every committed file as
public forever.

- API keys and tokens go in `.env` only. Never write a real key into code, docs, `.mcp.json`, `.codebuddy/settings.json`
  or `.codebuddy/models.json` (that last file is gitignored because it can store keys in plain text).
- `private/` is not in git. Open it only when a person asks. Never copy its contents into a tracked file; summarise
  instead, at most one quoted sentence.
- Use made-up data in `data/`. Never paste real Keppel, tenant or personal data into the repo.
- Screenshots, plans and anything in `proof/` are public too. Before committing one, remind us to check it shows no
  private chats, email, other clients' work, keys or local file paths.
- Ask before deleting files, rewriting git history, force-pushing, or changing `.gitignore` rules about secrets.
- Before a commit, check that no secret or private file is staged.
