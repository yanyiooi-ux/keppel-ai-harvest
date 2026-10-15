# Pill Desk app

This folder is the Pill Desk app: Next.js and TypeScript. What it does, how to run it on Replay with no key, and who
built what are in the [README at the repo root](../README.md).

- `app/`: the pages (`/` pick your seat, `/seat/<name>` for each of the 5 seats, `/how` for judges; the old short
  links `/tech`, `/engineer`, `/hq` and `/aom` redirect to a seat) and the API routes (`api/action`, `api/chat`,
  `api/state`, `api/reset`).
- `lib/`: the code that decides: ranking, the 30-day rule, safety stops, who may press what, new solutions and
  their tests, versions and rollback, and the AI layer (`lib/ai-core.ts`).
- `data/`: made-up demo data and the saved real AI answers in `data/replay/`. `pills/`: the signed pill.
  `prompts/`: the AI's 3 prompts. `tests/`: the vitest tests.
- Fonts: Chakra Petch and Inter, loaded with `next/font/google`.

Commands, run inside this folder:

```
npm install
npm run dev      # http://localhost:3000
npm test
npm run build
```
