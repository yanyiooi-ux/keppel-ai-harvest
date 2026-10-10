# Plan for C1b: AI connection and ai-ping

approved by YY on 10 Oct 2026. Product code in `web/` only, following spec S0 (rules 4, 10, 12), S15, T-C1b.

## Context
The key file `web/.env.local` exists (YY made it). We never open, print or echo it. We build the one AI client, the
test setup, and the ping script.

## Steps

### 1. Install packages
In `web/`:
- `npm install openai server-only` (dependencies)
- `npm install -D tsx` (dev dependency, for running scripts)

### 2. `web/lib/ai-core.ts`
- One OpenAI-compatible client for Tencent Cloud TokenHub (Hunyuan model hy3, model id from `process.env.LLM_MODEL`).
- NO `import "server-only"`.
- Never loads the env file itself (reads `process.env.LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` at call time).
- Never `NEXT_PUBLIC_`.
- Exports a function to get the client and the model id.

### 3. `web/lib/ai.ts`
- Only `import "server-only"` plus a re-export of everything from `ai-core.ts`.
- App code imports `ai.ts`, scripts import `ai-core.ts`.

### 4. Test infrastructure
- `web/tests/stubs/server-only.ts`: empty file.
- `vitest.config.ts`: add `setupFiles: ["./tests/setup.ts"]` and alias `server-only` to the stub.
- `web/tests/setup.ts`: sets `process.env.LLM_API_KEY = ""` and `process.env.REPLAY_MODE = "1"` before anything
  loads, and makes any network call throw `"network blocked in tests"`.
- `web/tests/ai-setup.test.ts`: one test that asserts `LLM_API_KEY` is empty and `REPLAY_MODE` is `"1"`, and one
  that shows a network call throws "network blocked in tests".
- Total tests: 38 existing + 2 new = 40.

### 5. `web/scripts/ai-ping.ts`
- Run by `npm run ai:ping` with `tsx`.
- Imports `ai-core.ts` (never `ai.ts`).
- Loads `web/.env.local` itself with `loadEnvConfig` from `@next/env`, passing a no-op logger
  `{ info() {}, error() {} }` so it never prints the file path.
- Sends one tiny streamed message to the model.
- Prints only the model id and the time to first reply in ms.
- Ignores `REPLAY_MODE` (with a key it always calls the model).
- Empty key: print "key: empty" and stop.
- Error: print only the HTTP status and "AI unavailable".
- No reply in 5 s or a long thinking part first: say so plainly.
- Never print the key, base URL, header, file path, `err.message` or the error object.

### 6. Add `"ai:ping": "tsx scripts/ai-ping.ts"` to `package.json` scripts.

### 7. Run `npm run ai:ping` and show the output.

## End sequence
1. `npm test` then `npm run build`. Both must pass. Show real output, test count (40).
2. `git diff --stat -- web/tests`: name every old test block changed (none).
3. Render check: no screen changed.
4. `git add`, `git grep --cached -l -E "LLM_API_KEY=[A-Za-z0-9_.-]{8,}"` must print nothing. `git status`: no
   `.env.local`, no `state.json`, nothing from `proof/_inbox`. Commit as
   "feat: AI connection and ai-ping [step C1 done]".
5. Say "C1b committed, ready for /log-proof". Don't push. Stop.
