---
name: safety-and-secrets
description: Keep secrets and private material out of the public repo; ask before destructive actions
alwaysApply: true
enabled: true
---

# Safety and secrets

This repo will be public on GitHub at submission, and git keeps every old version. Treat every committed file as
public forever.

- **The key file is private.** `web/.env.local` was made by YY. Nobody opens, prints, echoes, copies, cats, greps or
  reads it: not CodeBuddy, not the reviewer, not a test, and no script except the two loaders below. The same goes for
  every `web/.env*` file except `web/.env.example`. To check it, run only `Test-Path web/.env.local` and
  `git check-ignore web/.env.local`. Only two things load it: Next.js itself, for the app, and `@next/env`'s
  `loadEnvConfig` inside the two scripts `ai-ping.ts` and `ai-record.ts`, given a no-op logger so it never prints the
  file's path (S15). Nothing prints a value from it.
- **Errors never leak.** On any AI or network error, show and log only the HTTP status and a fixed phrase. Never
  `err.message`, the error object, headers, the base URL or the client config.
- `private/` is not in git. Open it only when a person asks. Never copy its contents into a tracked file; summarise
  instead, at most one quoted sentence.
- Use made-up data in `data/`. Never paste real Keppel, tenant or personal data into the repo.
- Screenshots, plans and anything in `proof/` are public too. Before committing one, remind us to check it shows no
  private chats, email, other clients' work, keys or local file paths.
- Ask before deleting files, rewriting git history, force-pushing, or changing `.gitignore` rules about secrets.
- Before a commit, check that no secret or private file is staged.
